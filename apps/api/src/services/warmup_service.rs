use crate::errors::AppError;
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

pub struct WarmupManager;

impl WarmupManager {
    /// Calculates the daily message limit for a session based on warmup tier and config bounds.
    pub async fn get_session_daily_limit(
        pool: &SqlitePool,
        session_id: &str,
        config_max: i64,
        warmup_enabled: bool,
    ) -> Result<i64, AppError> {
        if !warmup_enabled {
            return Ok(config_max);
        }

        let session_row: Option<(String, Option<String>)> = sqlx::query_as(
            "SELECT created_at, last_connected_at FROM sessions WHERE id = ?",
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?;

        let created_at_str = match session_row {
            Some((c_at, _)) => c_at,
            None => return Ok(25), // Fallback default to Tier 1 if session row not found
        };

        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let age_days = (Utc::now() - created_at).num_days();

        let tier_limit = if age_days < 3 {
            25
        } else if age_days < 7 {
            75
        } else {
            200
        };

        Ok(tier_limit.min(config_max))
    }

    /// Counts total outgoing messages sent by `session_id` on the current calendar day (UTC).
    pub async fn get_sent_today_count(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<i64, AppError> {
        let start_of_today_utc = Utc::now()
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .to_rfc3339();

        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM messages
            WHERE session_id = ?
              AND direction = 'OUTGOING'
              AND created_at >= ?
            "#,
        )
        .bind(session_id)
        .bind(&start_of_today_utc)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Checks if a session can send a message today under warmup rules.
    pub async fn can_send_message(
        pool: &SqlitePool,
        session_id: &str,
        config_max: i64,
        warmup_enabled: bool,
    ) -> Result<bool, AppError> {
        let limit = Self::get_session_daily_limit(pool, session_id, config_max, warmup_enabled).await?;
        let sent_today = Self::get_sent_today_count(pool, session_id).await?;
        Ok(sent_today < limit)
    }
}
