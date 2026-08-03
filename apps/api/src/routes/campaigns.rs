use crate::config::Config;
use crate::errors::AppError;
use crate::middleware::api_key::verify_api_key_header;
use crate::models::campaign::*;
use crate::services::campaign_service::CampaignService;
use crate::services::export_service::ExportService;
use actix_multipart::Multipart;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Serialize)]
pub struct ApiSuccessEnvelope<T> {
    pub success: bool,
    pub data: T,
}

#[derive(Deserialize)]
pub struct ListCampaignsQuery {
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Deserialize)]
pub struct ExportQuery {
    pub format: Option<String>,
}

pub fn init_routes() -> Scope {
    web::scope("/campaigns")
        .route("", web::get().to(list_campaigns))
        .route("", web::post().to(create_campaign))
        .route("/{id}", web::get().to(get_campaign))
        .route("/{id}", web::put().to(update_campaign))
        .route("/{id}", web::delete().to(delete_campaign))
        .route("/{id}/start", web::post().to(start_campaign))
        .route("/{id}/pause", web::post().to(pause_campaign))
        .route("/{id}/stop", web::post().to(stop_campaign))
        .route("/{id}/retry", web::post().to(retry_campaign))
        .route("/{id}/clone", web::post().to(clone_campaign))
        .route("/{id}/import-recipients", web::post().to(import_recipients))
        .route("/{id}/export", web::get().to(export_campaign))
        .route("/{id}/recipients", web::get().to(list_recipients))
        .route("/{id}/recipients/{recipient_id}", web::put().to(update_recipient))
        .route("/{id}/logs", web::get().to(list_logs))
}

async fn list_campaigns(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    query: web::Query<ListCampaignsQuery>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);
    let campaigns = CampaignService::list_campaigns(&pool, query.status.clone(), limit, offset).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: campaigns,
    }))
}

async fn create_campaign(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    payload: web::Json<CreateCampaignDto>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign = CampaignService::create_campaign(&pool, payload.into_inner()).await?;

    Ok(HttpResponse::Created().json(ApiSuccessEnvelope {
        success: true,
        data: campaign,
    }))
}

async fn get_campaign(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign_id = path.into_inner();
    let campaign = CampaignService::get_campaign(&pool, &campaign_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: campaign,
    }))
}

async fn update_campaign(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
    payload: web::Json<UpdateCampaignDto>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign_id = path.into_inner();
    let campaign = CampaignService::update_campaign(&pool, &campaign_id, payload.into_inner()).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: campaign,
    }))
}

async fn delete_campaign(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign_id = path.into_inner();
    CampaignService::delete_campaign(&pool, &campaign_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({ "id": campaign_id }),
    }))
}

async fn start_campaign(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign_id = path.into_inner();
    let campaign = CampaignService::start_campaign(&pool, &campaign_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: campaign,
    }))
}

async fn pause_campaign(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign_id = path.into_inner();
    let campaign = CampaignService::pause_campaign(&pool, &campaign_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: campaign,
    }))
}

async fn stop_campaign(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign_id = path.into_inner();
    let campaign = CampaignService::stop_campaign(&pool, &campaign_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: campaign,
    }))
}

async fn retry_campaign(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign_id = path.into_inner();
    let retried_count = CampaignService::retry_failed_recipients(&pool, &campaign_id).await?;

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({ "retriedCount": retried_count }),
    }))
}

async fn clone_campaign(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign_id = path.into_inner();
    let cloned = CampaignService::clone_campaign(&pool, &campaign_id).await?;

    Ok(HttpResponse::Created().json(ApiSuccessEnvelope {
        success: true,
        data: cloned,
    }))
}

async fn import_recipients(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
    bytes_or_json: web::Bytes,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign_id = path.into_inner();
    let content_type = req
        .headers()
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");

    let summary = if content_type.contains("multipart/form-data") {
        let mut payload = Multipart::new(req.headers(), futures_util::stream::once(async move { Ok(bytes_or_json) }));
        let mut file_bytes = Vec::new();
        let mut filename = String::new();

        while let Some(item) = payload.next().await {
            let mut field = item.map_err(|e| AppError::ImportError(e.to_string()))?;
            if let Some(content_disp) = field.content_disposition() {
                if let Some(name) = content_disp.get_filename() {
                    filename = name.to_string();
                }
            }
            while let Some(chunk) = field.next().await {
                let data = chunk.map_err(|e| AppError::ImportError(e.to_string()))?;
                file_bytes.extend_from_slice(&data);
            }
        }

        if filename.to_lowercase().ends_with(".xlsx") {
            CampaignService::import_recipients_xlsx(&pool, &campaign_id, &file_bytes).await?
        } else {
            CampaignService::import_recipients_csv(&pool, &campaign_id, &file_bytes).await?
        }
    } else if let Ok(import_req) = serde_json::from_slice::<ImportRecipientsRequest>(&bytes_or_json) {
        CampaignService::import_recipients_json(&pool, &campaign_id, import_req).await?
    } else {
        // Fallback to trying CSV parse on raw bytes
        CampaignService::import_recipients_csv(&pool, &campaign_id, &bytes_or_json).await?
    };

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: summary,
    }))
}

async fn export_campaign(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
    query: web::Query<ExportQuery>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let campaign_id = path.into_inner();
    let fmt = query.format.as_deref().unwrap_or("csv").to_lowercase();

    if fmt == "xlsx" {
        let data = ExportService::export_xlsx(&pool, &campaign_id).await?;
        Ok(HttpResponse::Ok()
            .content_type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            .insert_header((
                "Content-Disposition",
                format!("attachment; filename=\"campaign_{}_export.xlsx\"", campaign_id),
            ))
            .body(data))
    } else {
        let data = ExportService::export_csv(&pool, &campaign_id).await?;
        Ok(HttpResponse::Ok()
            .content_type("text/csv")
            .insert_header((
                "Content-Disposition",
                format!("attachment; filename=\"campaign_{}_export.csv\"", campaign_id),
            ))
            .body(data))
    }
}

async fn list_recipients(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let campaign_id = path.into_inner();
    let recipients = CampaignService::list_recipients(&pool, &campaign_id).await?;
    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: recipients,
    }))
}

async fn update_recipient(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<(String, String)>,
    payload: web::Json<UpdateRecipientDto>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let (campaign_id, recipient_id) = path.into_inner();
    let recipient = CampaignService::update_recipient(&pool, &campaign_id, &recipient_id, payload.into_inner()).await?;
    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: recipient,
    }))
}

async fn list_logs(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;
    let campaign_id = path.into_inner();
    let logs = CampaignService::list_logs(&pool, &campaign_id).await?;
    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: logs,
    }))
}
