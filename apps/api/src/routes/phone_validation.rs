use crate::config::Config;
use crate::engine::manager::EngineManager;
use crate::errors::AppError;
use crate::middleware::api_key::verify_api_key_header;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct ApiSuccessEnvelope<T> {
    pub success: bool,
    pub data: T,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidatePhonesRequestDto {
    pub session_id: String,
    pub phone_numbers: Vec<String>,
}

pub fn init_routes() -> Scope {
    web::scope("/phone-validation").route("", web::post().to(validate_phones))
}

async fn validate_phones(
    req: HttpRequest,
    config: web::Data<Config>,
    engine_manager: web::Data<EngineManager>,
    payload: web::Json<ValidatePhonesRequestDto>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let dto = payload.into_inner();
    if dto.session_id.trim().is_empty() {
        return Err(AppError::ValidationError(
            "sessionId cannot be empty".to_string(),
        ));
    }
    if dto.phone_numbers.is_empty() {
        return Err(AppError::ValidationError(
            "phoneNumbers list cannot be empty".to_string(),
        ));
    }

    engine_manager
        .validate_phones(&dto.session_id, dto.phone_numbers.clone())
        .await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({
            "sessionId": dto.session_id,
            "status": "QUEUED",
            "count": dto.phone_numbers.len()
        }),
    }))
}
