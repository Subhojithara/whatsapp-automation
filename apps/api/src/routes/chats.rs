use crate::config::Config;
use crate::engine::manager::EngineManager;
use crate::errors::AppError;
use crate::middleware::api_key::verify_api_key_header;
use crate::routes::sessions::ApiSuccessEnvelope;
use crate::services::chat_service::ChatService;
use crate::services::message_service::MessageService;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use serde::Deserialize;
use sqlx::SqlitePool;

#[derive(Deserialize)]
pub struct PaginationQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub fn init_routes() -> Scope {
    web::scope("/{id}/chats")
        .route("", web::get().to(list_chats))
        .route("/sync", web::post().to(sync_chats))
        .route("/{chat_id}/messages", web::get().to(get_chat_messages))
        .route("/{chat_id}/read", web::post().to(mark_chat_read))
}

pub async fn list_chats(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    config: web::Data<Config>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let session_id = path.into_inner();
    let chats = ChatService::list_chats(&pool, &session_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: chats,
    }))
}

pub async fn sync_chats(
    req: HttpRequest,
    engine_manager: web::Data<EngineManager>,
    config: web::Data<Config>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let session_id = path.into_inner();
    engine_manager.get_chats(&session_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({ "message": "Chat sync requested", "sessionId": session_id }),
    }))
}

pub async fn get_chat_messages(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    engine_manager: web::Data<EngineManager>,
    config: web::Data<Config>,
    path: web::Path<(String, String)>,
    query: web::Query<PaginationQuery>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let (session_id, chat_id) = path.into_inner();
    let limit = query.limit.unwrap_or(50).max(1).min(200);
    let offset = query.offset.unwrap_or(0).max(0);

    let _ = ChatService::mark_chat_read(&pool, &session_id, &chat_id).await;
    let _ = engine_manager.mark_chat_read(&session_id, &chat_id).await;

    let messages =
        MessageService::list_messages(&pool, &session_id, &chat_id, limit, offset).await?;

    // Only query engine if local database has no messages yet for this chat
    if messages.is_empty() && offset == 0 && engine_manager.is_running(&session_id).await {
        let _ = engine_manager
            .get_chat_messages(&session_id, &chat_id, Some(limit as u32))
            .await;
    }

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: messages,
    }))
}

pub async fn mark_chat_read(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    engine_manager: web::Data<EngineManager>,
    config: web::Data<Config>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let (session_id, chat_id) = path.into_inner();
    let chat = ChatService::mark_chat_read(&pool, &session_id, &chat_id).await?;
    let _ = engine_manager.mark_chat_read(&session_id, &chat_id).await;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: chat,
    }))
}
