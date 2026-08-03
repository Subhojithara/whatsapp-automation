use crate::config::Config;
use crate::errors::AppError;
use crate::middleware::api_key::verify_api_key_header;
use crate::models::template::*;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Serialize)]
pub struct ApiSuccessEnvelope<T> {
    pub success: bool,
    pub data: T,
}

#[derive(Deserialize)]
pub struct ListTemplatesQuery {
    pub category: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub fn init_routes() -> Scope {
    web::scope("/templates")
        .route("", web::get().to(list_templates))
        .route("", web::post().to(create_template))
        .route("/{id}", web::get().to(get_template))
        .route("/{id}", web::put().to(update_template))
        .route("/{id}", web::delete().to(delete_template))
}

async fn list_templates(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    query: web::Query<ListTemplatesQuery>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);

    let templates = if let Some(ref cat) = query.category {
        sqlx::query_as::<_, CampaignTemplate>(
            "SELECT id, name, category, body_text, variables_json, created_at, updated_at FROM campaign_templates WHERE category = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(cat)
        .bind(limit)
        .bind(offset)
        .fetch_all(&**pool)
        .await?
    } else {
        sqlx::query_as::<_, CampaignTemplate>(
            "SELECT id, name, category, body_text, variables_json, created_at, updated_at FROM campaign_templates ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&**pool)
        .await?
    };

    let response_data: Vec<TemplateResponse> = templates.into_iter().map(Into::into).collect();

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn create_template(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    payload: web::Json<CreateTemplateRequest>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let dto = payload.into_inner();
    let id = format!("tpl_{}", Uuid::new_v4());
    let now = Utc::now().to_rfc3339();
    let vars_json = dto.variables.map(|v| serde_json::to_string(&v).unwrap());

    let template = sqlx::query_as::<_, CampaignTemplate>(
        r#"
        INSERT INTO campaign_templates (id, name, category, body_text, variables_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id, name, category, body_text, variables_json, created_at, updated_at
        "#,
    )
    .bind(&id)
    .bind(&dto.name)
    .bind(&dto.category)
    .bind(&dto.body_text)
    .bind(&vars_json)
    .bind(&now)
    .bind(&now)
    .fetch_one(&**pool)
    .await?;

    let response_data: TemplateResponse = template.into();

    Ok(HttpResponse::Created().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn get_template(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let id = path.into_inner();
    let template = sqlx::query_as::<_, CampaignTemplate>(
        "SELECT id, name, category, body_text, variables_json, created_at, updated_at FROM campaign_templates WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&**pool)
    .await?
    .ok_or_else(|| AppError::TemplateNotFound(id.clone()))?;

    let response_data: TemplateResponse = template.into();

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn update_template(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
    payload: web::Json<UpdateTemplateRequest>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let id = path.into_inner();
    let dto = payload.into_inner();
    let now = Utc::now().to_rfc3339();
    let vars_json = dto.variables.map(|v| serde_json::to_string(&v).unwrap());

    let template = sqlx::query_as::<_, CampaignTemplate>(
        r#"
        UPDATE campaign_templates SET
            name = COALESCE(?, name),
            category = COALESCE(?, category),
            body_text = COALESCE(?, body_text),
            variables_json = COALESCE(?, variables_json),
            updated_at = ?
        WHERE id = ?
        RETURNING id, name, category, body_text, variables_json, created_at, updated_at
        "#,
    )
    .bind(&dto.name)
    .bind(&dto.category)
    .bind(&dto.body_text)
    .bind(&vars_json)
    .bind(&now)
    .bind(&id)
    .fetch_optional(&**pool)
    .await?
    .ok_or_else(|| AppError::TemplateNotFound(id.clone()))?;

    let response_data: TemplateResponse = template.into();

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: response_data,
    }))
}

async fn delete_template(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    verify_api_key_header(&req, &config)?;

    let id = path.into_inner();
    let res = sqlx::query("DELETE FROM campaign_templates WHERE id = ?")
        .bind(&id)
        .execute(&**pool)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::TemplateNotFound(id.clone()));
    }

    Ok(HttpResponse::Ok().json(ApiSuccessEnvelope {
        success: true,
        data: serde_json::json!({ "id": id }),
    }))
}
