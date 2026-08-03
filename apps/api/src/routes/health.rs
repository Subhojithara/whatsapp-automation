use actix_web::{get, web, HttpResponse, Responder};
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Serialize)]
pub struct HealthResponseData {
    pub status: String,
    pub services: ServicesStatus,
}

#[derive(Serialize)]
pub struct ServicesStatus {
    pub api: String,
    pub database: String,
}

#[derive(Serialize)]
pub struct HealthEnvelope {
    pub success: bool,
    pub data: HealthResponseData,
}

#[get("/health")]
pub async fn health_check(pool: web::Data<SqlitePool>) -> impl Responder {
    let db_status = match sqlx::query("SELECT 1").execute(pool.get_ref()).await {
        Ok(_) => "up",
        Err(_) => "down",
    };

    HttpResponse::Ok().json(HealthEnvelope {
        success: true,
        data: HealthResponseData {
            status: if db_status == "up" { "healthy".to_string() } else { "degraded".to_string() },
            services: ServicesStatus {
                api: "up".to_string(),
                database: db_status.to_string(),
            },
        },
    })
}
