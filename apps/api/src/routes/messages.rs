use crate::config::Config;
use crate::engine::manager::EngineManager;
use crate::engine::pending_messages::PendingMessages;
use crate::errors::AppError;
use crate::middleware::api_key::verify_api_key_header;
use crate::models::message::{SendMediaRequest, SendTextRequest};
use crate::routes::sessions::ApiSuccessEnvelope;
use crate::services::message_service::MessageService;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use sqlx::SqlitePool;

pub fn init_routes() -> Scope {
    web::scope("/sessions/{id}/messages")
        .route("/send-text", web::post().to(send_text_message))
        .route("/send-media", web::post().to(send_media_message))
}

pub async fn send_text_message(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    engine_manager: web::Data<EngineManager>,
    pending_messages: web::Data<PendingMessages>,
    config: web::Data<Config>,
    path: web::Path<String>,
    payload: web::Json<SendTextRequest>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let session_id = path.into_inner();
    let request = payload.into_inner();

    tracing::info!(
        session_id = %session_id,
        to = %request.to,
        "Processing send-text message request"
    );

    let message_response = MessageService::send_text(
        pool.get_ref(),
        engine_manager.get_ref(),
        pending_messages.get_ref(),
        config.get_ref(),
        &session_id,
        request,
    )
    .await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: message_response,
    }))
}

pub async fn send_media_message(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    engine_manager: web::Data<EngineManager>,
    pending_messages: web::Data<PendingMessages>,
    config: web::Data<Config>,
    path: web::Path<String>,
    payload: web::Json<SendMediaRequest>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let session_id = path.into_inner();
    let request = payload.into_inner();

    tracing::info!(
        session_id = %session_id,
        to = %request.to,
        media_type = %request.media_type,
        "Processing send-media message request"
    );

    let message_response = MessageService::send_media_message(
        pool.get_ref(),
        engine_manager.get_ref(),
        pending_messages.get_ref(),
        config.get_ref(),
        &session_id,
        &request.to,
        &request.media_type,
        &request.media_url,
        request.caption.as_deref(),
        request.file_name.as_deref(),
        request.mimetype.as_deref(),
    )
    .await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: message_response,
    }))
}
