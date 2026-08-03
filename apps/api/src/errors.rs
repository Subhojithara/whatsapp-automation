use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use serde::Serialize;
use thiserror::Error;

#[derive(Serialize)]
pub struct ApiErrorPayload {
    pub code: String,
    pub message: String,
}

#[derive(Serialize)]
pub struct ApiErrorEnvelope {
    pub success: bool,
    pub error: ApiErrorPayload,
}

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session already running: {0}")]
    SessionAlreadyRunning(String),

    #[error("Invalid state transition from {from} to {to}")]
    InvalidStateTransition { from: String, to: String },

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Internal server error: {0}")]
    InternalError(String),

    #[error("Session not ready: {0}")]
    SessionNotReady(String),

    #[error("Engine not available: {0}")]
    EngineNotAvailable(String),

    #[error("Invalid recipient: {0}")]
    InvalidRecipient(String),

    #[error("Invalid message: {0}")]
    InvalidMessage(String),

    #[error("Message send failed: {0}")]
    MessageSendFailed(String),

    #[error("Engine timeout: {0}")]
    EngineTimeout(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Campaign not found: {0}")]
    CampaignNotFound(String),

    #[error("Template not found: {0}")]
    TemplateNotFound(String),

    #[error("Blacklist error: {0}")]
    BlacklistError(String),

    #[error("Import error: {0}")]
    ImportError(String),

    #[error("Export error: {0}")]
    ExportError(String),
}

impl AppError {
    pub fn error_code(&self) -> &'static str {
        match self {
            AppError::Database(_) => "DATABASE_ERROR",
            AppError::SessionNotFound(_) => "SESSION_NOT_FOUND",
            AppError::SessionAlreadyRunning(_) => "SESSION_ALREADY_RUNNING",
            AppError::InvalidStateTransition { .. } => "INVALID_STATE_TRANSITION",
            AppError::ValidationError(_) => "VALIDATION_ERROR",
            AppError::InternalError(_) => "INTERNAL_ERROR",
            AppError::SessionNotReady(_) => "SESSION_NOT_READY",
            AppError::EngineNotAvailable(_) => "ENGINE_NOT_AVAILABLE",
            AppError::InvalidRecipient(_) => "INVALID_RECIPIENT",
            AppError::InvalidMessage(_) => "INVALID_MESSAGE",
            AppError::MessageSendFailed(_) => "MESSAGE_SEND_FAILED",
            AppError::EngineTimeout(_) => "ENGINE_TIMEOUT",
            AppError::Unauthorized(_) => "UNAUTHORIZED",
            AppError::CampaignNotFound(_) => "CAMPAIGN_NOT_FOUND",
            AppError::TemplateNotFound(_) => "TEMPLATE_NOT_FOUND",
            AppError::BlacklistError(_) => "BLACKLIST_ERROR",
            AppError::ImportError(_) => "IMPORT_ERROR",
            AppError::ExportError(_) => "EXPORT_ERROR",
        }
    }
}

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::SessionNotFound(_) | AppError::CampaignNotFound(_) | AppError::TemplateNotFound(_) => StatusCode::NOT_FOUND,
            AppError::ValidationError(_) | AppError::InvalidRecipient(_) | AppError::InvalidMessage(_) | AppError::BlacklistError(_) | AppError::ImportError(_) | AppError::ExportError(_) => StatusCode::BAD_REQUEST,
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::InvalidStateTransition { .. } | AppError::SessionAlreadyRunning(_) | AppError::SessionNotReady(_) => StatusCode::CONFLICT,
            AppError::EngineNotAvailable(_) | AppError::MessageSendFailed(_) => StatusCode::BAD_GATEWAY,
            AppError::EngineTimeout(_) => StatusCode::GATEWAY_TIMEOUT,
            AppError::Database(_) | AppError::InternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }



    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code()).json(ApiErrorEnvelope {
            success: false,
            error: ApiErrorPayload {
                code: self.error_code().to_string(),
                message: self.to_string(),
            },
        })
    }
}
