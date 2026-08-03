use crate::config::Config;
use crate::engine::manager::EngineManager;
use crate::errors::AppError;
use crate::models::session::{CreateSessionDto, Session};
use crate::state_machine::SessionStatus;
use chrono::Utc;
use sqlx::SqlitePool;
use std::path::Path;
use uuid::Uuid;

pub struct SessionService;

impl SessionService {
    pub async fn create_session(
        pool: &SqlitePool,
        dto: CreateSessionDto,
    ) -> Result<Session, AppError> {
        let name = dto.name.trim();
        if name.is_empty() {
            return Err(AppError::ValidationError(
                "Session name cannot be empty".to_string(),
            ));
        }

        let session_id = format!("ses_{}", Uuid::new_v4());
        let engine = dto.engine.unwrap_or_else(|| "baileys".to_string());
        let now = Utc::now().to_rfc3339();

        let session = sqlx::query_as::<_, Session>(
            r#"
            INSERT INTO sessions (id, name, engine, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING *
            "#,
        )
        .bind(&session_id)
        .bind(name)
        .bind(&engine)
        .bind(SessionStatus::Created.as_str())
        .bind(&now)
        .bind(&now)
        .fetch_one(pool)
        .await?;

        Ok(session)
    }

    pub async fn list_sessions(pool: &SqlitePool) -> Result<Vec<Session>, AppError> {
        let sessions = sqlx::query_as::<_, Session>(
            "SELECT * FROM sessions ORDER BY created_at DESC",
        )
        .fetch_all(pool)
        .await?;

        Ok(sessions)
    }

    pub async fn get_session(pool: &SqlitePool, id: &str) -> Result<Session, AppError> {
        let session = sqlx::query_as::<_, Session>(
            "SELECT * FROM sessions WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::SessionNotFound(id.to_string()))?;

        Ok(session)
    }

    pub async fn update_status(
        pool: &SqlitePool,
        id: &str,
        new_status: SessionStatus,
        error_message: Option<String>,
    ) -> Result<Session, AppError> {
        let current = Self::get_session(pool, id).await?;
        let current_status = current.parsed_status();

        if !current_status.can_transition_to(new_status) {
            return Err(AppError::InvalidStateTransition {
                from: current_status.to_string(),
                to: new_status.to_string(),
            });
        }

        let now = Utc::now().to_rfc3339();
        let last_connected = if new_status == SessionStatus::Ready {
            Some(now.clone())
        } else {
            current.last_connected_at
        };

        let last_disconnected = if new_status == SessionStatus::Disconnected || new_status == SessionStatus::Stopped {
            Some(now.clone())
        } else {
            current.last_disconnected_at
        };

        let session = sqlx::query_as::<_, Session>(
            r#"
            UPDATE sessions
            SET status = ?, last_error = ?, updated_at = ?, last_connected_at = ?, last_disconnected_at = ?
            WHERE id = ?
            RETURNING *
            "#,
        )
        .bind(new_status.as_str())
        .bind(error_message)
        .bind(&now)
        .bind(last_connected)
        .bind(last_disconnected)
        .bind(id)
        .fetch_one(pool)
        .await?;

        Ok(session)
    }

    pub async fn update_metadata(
        pool: &SqlitePool,
        id: &str,
        phone_number: Option<String>,
        display_name: Option<String>,
    ) -> Result<Session, AppError> {
        let now = Utc::now().to_rfc3339();
        let session = sqlx::query_as::<_, Session>(
            r#"
            UPDATE sessions
            SET phone_number = COALESCE(?, phone_number),
                display_name = COALESCE(?, display_name),
                updated_at = ?
            WHERE id = ?
            RETURNING *
            "#,
        )
        .bind(phone_number)
        .bind(display_name)
        .bind(&now)
        .bind(id)
        .fetch_one(pool)
        .await?;

        Ok(session)
    }

    pub async fn delete_session(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
        let result = sqlx::query("DELETE FROM sessions WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::SessionNotFound(id.to_string()));
        }

        Ok(())
    }

    pub async fn recover_sessions(
        pool: &SqlitePool,
        engine_manager: &EngineManager,
        config: &Config,
    ) -> Result<(), AppError> {
        tracing::info!("Reconciling & recovering sessions on startup...");
        let sessions = Self::list_sessions(pool).await?;

        for session in sessions {
            let status = session.parsed_status();
            let auth_dir_path = Path::new(&config.engine_data_dir).join(&session.id).join("auth");
            let auth_creds_path = auth_dir_path.join("creds.json");
            let has_creds = auth_creds_path.exists();

            match status {
                SessionStatus::Ready
                | SessionStatus::Connecting
                | SessionStatus::Authenticating
                | SessionStatus::Reconnecting
                | SessionStatus::Disconnected => {
                    if has_creds {
                        tracing::info!(session_id = %session.id, creds_path = %auth_creds_path.display(), "Recovering authenticated session...");
                        let auth_dir = auth_dir_path.to_string_lossy().to_string();
                        let _ = Self::update_status(pool, &session.id, SessionStatus::Starting, None).await;
                        let _ = engine_manager.start_session(session.id, auth_dir).await;
                    } else {
                        tracing::info!(session_id = %session.id, creds_path = %auth_creds_path.display(), "Session has no auth creds, resetting status to STOPPED");
                        let _ = Self::update_status(pool, &session.id, SessionStatus::Stopped, None).await;
                    }
                }
                SessionStatus::Created | SessionStatus::Stopped | SessionStatus::Failed | SessionStatus::QrReady | SessionStatus::Starting | SessionStatus::Stopping | SessionStatus::Deleted => {
                    // Stale runtime states after process crash are set to STOPPED if not CREATED
                    if status != SessionStatus::Created && status != SessionStatus::Stopped && status != SessionStatus::Failed {
                        let _ = Self::update_status(pool, &session.id, SessionStatus::Stopped, None).await;
                    }
                }
            }
        }

        tracing::info!("Session recovery completed.");
        Ok(())
    }
}
