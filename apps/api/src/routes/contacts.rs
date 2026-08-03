use crate::config::Config;
use crate::engine::manager::EngineManager;
use crate::errors::AppError;
use crate::middleware::api_key::verify_api_key_header;
use crate::models::contact::CreateContactDto;
use crate::routes::sessions::ApiSuccessEnvelope;
use crate::services::contact_service::ContactService;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use serde::Deserialize;
use sqlx::SqlitePool;

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
}

pub fn init_routes() -> Scope {
    web::scope("/{id}/contacts")
        .route("", web::get().to(list_contacts))
        .route("", web::post().to(create_contact))
        .route("/search", web::get().to(search_contacts))
        .route("/sync", web::post().to(sync_contacts))
        .route("/{contact_id}/profile-picture", web::get().to(get_profile_picture))
}

pub async fn get_profile_picture(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    engine_manager: web::Data<EngineManager>,
    config: web::Data<Config>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let (session_id, contact_id) = path.into_inner();

    let jid = if contact_id.contains('@') {
        contact_id.clone()
    } else if let Ok((_, norm_jid)) = ContactService::normalize_phone_number(&contact_id) {
        norm_jid
    } else {
        contact_id.clone()
    };

    let existing: Option<String> = sqlx::query_scalar(
        "SELECT avatar_url FROM contacts WHERE session_id = ? AND (jid = ? OR id = ? OR phone_number = ?) AND avatar_url IS NOT NULL AND avatar_url != ''"
    )
    .bind(&session_id)
    .bind(&contact_id)
    .bind(&contact_id)
    .bind(&contact_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    if let Some(url) = existing {
        return Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
            success: true,
            data: serde_json::json!({ "jid": jid, "avatarUrl": url }),
        }));
    }

    let _ = engine_manager.get_profile_picture(&session_id, &jid).await;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({ "jid": jid, "avatarUrl": serde_json::Value::Null }),
    }))
}

pub async fn list_contacts(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    config: web::Data<Config>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let session_id = path.into_inner();
    let contacts = ContactService::list_contacts(&pool, &session_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: contacts,
    }))
}

pub async fn search_contacts(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    config: web::Data<Config>,
    path: web::Path<String>,
    query: web::Query<SearchQuery>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let session_id = path.into_inner();
    let q = query.q.as_deref().unwrap_or("");
    let contacts = ContactService::search_contacts(&pool, &session_id, q).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: contacts,
    }))
}

pub async fn create_contact(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    config: web::Data<Config>,
    path: web::Path<String>,
    payload: web::Json<CreateContactDto>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let session_id = path.into_inner();
    let contact =
        ContactService::create_manual_contact(&pool, &session_id, payload.into_inner()).await?;

    Ok(HttpResponse::Created().json(ApiSuccessEnvelope {
        success: true,
        data: contact,
    }))
}

pub async fn sync_contacts(
    req: HttpRequest,
    engine_manager: web::Data<EngineManager>,
    config: web::Data<Config>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let session_id = path.into_inner();
    engine_manager.get_contacts(&session_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({ "message": "Contact sync requested", "sessionId": session_id }),
    }))
}
