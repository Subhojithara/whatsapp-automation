mod config;
mod engine;
mod errors;
mod event_processor;
mod middleware;
mod models;
mod realtime;
mod routes;
mod services;
mod state_machine;

#[cfg(test)]
mod m1_challenger_tests;
#[cfg(test)]
mod m2_challenger_tests;
#[cfg(test)]
mod m2_unit_tests;
#[cfg(test)]
mod m2_empirical_verification_tests;
#[cfg(test)]
mod m2_adversarial_stress_tests;




use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpServer};
use config::Config;
use engine::manager::EngineManager;
use engine::pending_messages::PendingMessages;
use event_processor::start_event_processor;
use realtime::RealtimeHub;
use services::session_service::SessionService;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::fs;
use std::path::Path;
use std::str::FromStr;
use tokio::sync::mpsc;
use tracing_subscriber::EnvFilter;

#[actix_web::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse()?))
        .init();

    let config = Config::from_env();
    tracing::info!("Starting Velurix API on {}:{}", config.host, config.port);

    if let Some(parent) = Path::new(&config.database_url.trim_start_matches("sqlite:")).parent() {
        fs::create_dir_all(parent)?;
    }
    fs::create_dir_all(&config.engine_data_dir)?;

    let connect_options = SqliteConnectOptions::from_str(&config.database_url)?
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await?;

    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Database migrations completed.");

    // Realtime Hub
    let realtime_hub = RealtimeHub::new();

    // Pending Messages Registry
    let pending_messages = PendingMessages::new();

    // Setup Engine Event Channel & Engine Manager
    let (event_tx, event_rx) = mpsc::channel(100);
    let engine_manager = EngineManager::new(config.engine_script_path.clone(), event_tx);

    // Start Engine Event Processor loop
    start_event_processor(
        event_rx,
        pool.clone(),
        realtime_hub.clone(),
        pending_messages.clone(),
    );

    // Recover sessions from database on startup
    if let Err(err) = SessionService::recover_sessions(&pool, &engine_manager, &config).await {
        tracing::error!("Error during session recovery: {}", err);
    }

    // Start Campaign Worker loop
    services::campaign_worker::CampaignWorker::start_campaign_worker(pool.clone(), engine_manager.clone());

    let pool_data = web::Data::new(pool);
    let engine_manager_data = web::Data::new(engine_manager);
    let config_data = web::Data::new(config.clone());
    let hub_data = web::Data::new(realtime_hub);
    let pending_messages_data = web::Data::new(pending_messages);

    let bind_addr = format!("{}:{}", config.host, config.port);
    HttpServer::new(move || {
        let cors = Cors::permissive();

        App::new()
            .wrap(Logger::default())
            .wrap(cors)
            .app_data(pool_data.clone())
            .app_data(engine_manager_data.clone())
            .app_data(config_data.clone())
            .app_data(hub_data.clone())
            .app_data(pending_messages_data.clone())
            .route("/ws", web::get().to(routes::ws::ws_handler))
            .service(
                web::scope("/api/v1")
                    .service(routes::health::health_check)
                    .service(routes::sessions::init_routes())
                    .service(routes::campaigns::init_routes())
                    .service(routes::blacklist::init_routes())
                    .service(routes::templates::init_routes())
                    .service(routes::phone_validation::init_routes()),
            )
    })

    .bind(&bind_addr)?
    .run()
    .await?;

    Ok(())
}

