use crate::config::Config;
use crate::engine::manager::EngineManager;
use crate::errors::AppError;
use crate::models::session::{CreateSessionDto, SessionResponse};
use crate::realtime::RealtimeHub;
use crate::services::session_service::SessionService;
use crate::state_machine::SessionStatus;
use actix_web::{web, HttpResponse, Scope};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Serialize)]
pub struct ApiSuccessEnvelope<T> {
    pub success: bool,
    pub data: T,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingCodeRequestDto {
    pub phone_number: String,
}

pub fn init_routes() -> Scope {
    web::scope("/sessions")
        .route("", web::get().to(list_sessions))
        .route("", web::post().to(create_session))
        .route("/{id}", web::get().to(get_session))
        .route("/{id}", web::delete().to(delete_session))
        .route("/{id}/start", web::post().to(start_session))
        .route("/{id}/stop", web::post().to(stop_session))
        .route("/{id}/restart", web::post().to(restart_session))
        .route("/{id}/qr", web::get().to(get_qr))
        .route("/{id}/health", web::get().to(get_session_health))
        .route("/{id}/pairing-code", web::post().to(request_pairing_code))
        .route("/{id}/messages/send-text", web::post().to(crate::routes::messages::send_text_message))
        .service(crate::routes::contacts::init_routes())
        .service(crate::routes::chats::init_routes())
}


async fn list_sessions(pool: web::Data<SqlitePool>) -> Result<HttpResponse, AppError> {
    let sessions = SessionService::list_sessions(&pool).await?;
    let response_data: Vec<SessionResponse> = sessions.into_iter().map(Into::into).collect();

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn create_session(
    pool: web::Data<SqlitePool>,
    payload: web::Json<CreateSessionDto>,
) -> Result<HttpResponse, AppError> {
    let session = SessionService::create_session(&pool, payload.into_inner()).await?;
    let response_data: SessionResponse = session.into();

    Ok(HttpResponse::Created().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn get_session(
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let session_id = path.into_inner();
    let session = SessionService::get_session(&pool, &session_id).await?;
    let response_data: SessionResponse = session.into();

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn delete_session(
    pool: web::Data<SqlitePool>,
    engine_manager: web::Data<EngineManager>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let session_id = path.into_inner();
    let _ = engine_manager.stop_session(&session_id).await;
    SessionService::delete_session(&pool, &session_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({ "id": session_id }),
    }))
}

async fn start_session(
    pool: web::Data<SqlitePool>,
    engine_manager: web::Data<EngineManager>,
    config: web::Data<Config>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let session_id = path.into_inner();
    let session = SessionService::get_session(&pool, &session_id).await?;

    if engine_manager.is_running(&session_id).await {
        let response_data: SessionResponse = session.into();
        return Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
            success: true,
            data: response_data,
        }));
    }

    let auth_dir = format!("{}/{}/auth", config.engine_data_dir, session_id);
    let updated = SessionService::update_status(&pool, &session_id, SessionStatus::Starting, None).await?;

    engine_manager.start_session(session_id.clone(), auth_dir, Some(session.engine.clone())).await?;
    let response_data: SessionResponse = updated.into();

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn stop_session(
    pool: web::Data<SqlitePool>,
    engine_manager: web::Data<EngineManager>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let session_id = path.into_inner();
    let session = SessionService::get_session(&pool, &session_id).await?;
    let current_status = session.parsed_status();

    if !current_status.can_transition_to(SessionStatus::Stopping) {
        return Err(AppError::InvalidStateTransition {
            from: current_status.to_string(),
            to: SessionStatus::Stopping.to_string(),
        });
    }

    let updated = SessionService::update_status(&pool, &session_id, SessionStatus::Stopping, None).await?;
    engine_manager.stop_session(&session_id).await?;
    let response_data: SessionResponse = updated.into();

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn restart_session(
    pool: web::Data<SqlitePool>,
    engine_manager: web::Data<EngineManager>,
    config: web::Data<Config>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let session_id = path.into_inner();
    let _ = engine_manager.stop_session(&session_id).await;

    let auth_dir = format!("{}/{}/auth", config.engine_data_dir, session_id);
    let session = SessionService::get_session(&pool, &session_id).await?;
    let updated = SessionService::update_status(&pool, &session_id, SessionStatus::Starting, None).await?;

    engine_manager.start_session(session_id.clone(), auth_dir, Some(session.engine.clone())).await?;
    let response_data: SessionResponse = updated.into();

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn get_qr(
    hub: web::Data<RealtimeHub>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let session_id = path.into_inner();
    let qr = hub.get_qr(&session_id).await;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({ "sessionId": session_id, "qr": qr }),
    }))
}

async fn request_pairing_code(
    engine_manager: web::Data<EngineManager>,
    hub: web::Data<RealtimeHub>,
    path: web::Path<String>,
    payload: web::Json<PairingCodeRequestDto>,
) -> Result<HttpResponse, AppError> {
    let session_id = path.into_inner();
    let phone_number = payload.phone_number.trim();

    if phone_number.is_empty() || !phone_number.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::ValidationError(
            "Phone number must contain E.164 digits without +".to_string(),
        ));
    }

    engine_manager.request_pairing_code(&session_id, phone_number).await?;
    let code = hub.get_pairing_code(&session_id).await;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({ "sessionId": session_id, "phoneNumber": phone_number, "code": code }),
    }))
}

async fn get_session_health(
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let session_id = path.into_inner();
    let _ = SessionService::get_session(&pool, &session_id).await?;
    let health = crate::services::account_health_service::AccountHealthService::get_session_health(&pool, &session_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: health,
    }))
}

