use crate::config::Config;
use crate::errors::AppError;
use actix_web::HttpRequest;

pub fn verify_api_key_header(req: &HttpRequest, config: &Config) -> Result<(), AppError> {
    if let Some(expected_key) = &config.api_key {
        let provided_key = req
            .headers()
            .get("X-API-Key")
            .and_then(|h| h.to_str().ok());

        match provided_key {
            Some(key) if key == expected_key => Ok(()),
            Some(_) => Err(AppError::Unauthorized(
                "Invalid API Key provided in X-API-Key header".to_string(),
            )),
            None => Err(AppError::Unauthorized(
                "Missing required X-API-Key header".to_string(),
            )),
        }
    } else {
        // No API_KEY configured in environment, access is permitted
        Ok(())
    }
}
