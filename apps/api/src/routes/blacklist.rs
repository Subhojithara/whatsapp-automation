use crate::config::Config;
use crate::errors::AppError;
use crate::middleware::api_key::verify_api_key_header;
use crate::models::blacklist::*;
use crate::services::blacklist_service::BlacklistService;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Serialize)]
pub struct ApiSuccessEnvelope<T> {
    pub success: bool,
    pub data: T,
}

#[derive(Deserialize)]
pub struct ListBlacklistQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub fn init_routes() -> Scope {
    web::scope("/blacklist")
        .route("", web::get().to(list_blacklist))
        .route("", web::post().to(add_blacklist))
        .route("/{id}", web::delete().to(remove_blacklist))
}

async fn list_blacklist(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    query: web::Query<ListBlacklistQuery>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);
    let items = BlacklistService::list(&pool, limit, offset).await?;
    let response_data: Vec<BlacklistResponse> = items.into_iter().map(Into::into).collect();

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn add_blacklist(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    payload: web::Json<AddBlacklistRequest>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let req_body = payload.into_inner();
    let item = BlacklistService::add(&pool, &req_body.phone_number, req_body.reason.as_deref()).await?;
    let response_data: BlacklistResponse = item.into();

    Ok(HttpResponse::Created().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn remove_blacklist(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let id_or_phone = path.into_inner();
    BlacklistService::remove(&pool, &id_or_phone).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({ "id": id_or_phone }),
    }))
}
