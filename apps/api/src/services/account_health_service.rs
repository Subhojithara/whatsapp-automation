use crate::errors::AppError;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionHealth {
    pub session_id: String,
    pub outgoing_today: i64,
    pub incoming_today: i64,
    pub outgoing_last_24h: i64,
    pub incoming_last_24h: i64,
    pub unreplied_outbound_streak: i64,
    pub health_score: i64,
    pub risk_level: String,
    pub throttle_multiplier: f64,
    pub recommendation: String,
}

#[derive(Debug, Clone)]
pub enum SafetyCheckResult {
    Proceed { delay_multiplier: f64 },
    PauseForCooldown { reason: String, unreplied_streak: i64 },
}

pub struct AccountHealthService;

impl AccountHealthService {
    /// Computes full health diagnostic metrics for a session.
    pub async fn get_session_health(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<SessionHealth, AppError> {
        let now = Utc::now();
        let start_of_today_utc = now
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .to_rfc3339();
        let twenty_four_hours_ago = (now - Duration::hours(24)).to_rfc3339();

        // 1. Messages today
        let out_today_row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM messages
            WHERE session_id = ?
              AND (direction = 'OUTGOING' OR direction = 'outgoing' OR from_me = 1)
              AND created_at >= ?
            "#,
        )
        .bind(session_id)
        .bind(&start_of_today_utc)
        .fetch_one(pool)
        .await
        .unwrap_or((0,));

        let in_today_row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM messages
            WHERE session_id = ?
              AND (direction = 'INCOMING' OR direction = 'incoming' OR from_me = 0)
              AND created_at >= ?
            "#,
        )
        .bind(session_id)
        .bind(&start_of_today_utc)
        .fetch_one(pool)
        .await
        .unwrap_or((0,));

        // 2. Messages last 24h
        let out_24h_row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM messages
            WHERE session_id = ?
              AND (direction = 'OUTGOING' OR direction = 'outgoing' OR from_me = 1)
              AND created_at >= ?
            "#,
        )
        .bind(session_id)
        .bind(&twenty_four_hours_ago)
        .fetch_one(pool)
        .await
        .unwrap_or((0,));

        let in_24h_row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM messages
            WHERE session_id = ?
              AND (direction = 'INCOMING' OR direction = 'incoming' OR from_me = 0)
              AND created_at >= ?
            "#,
        )
        .bind(session_id)
        .bind(&twenty_four_hours_ago)
        .fetch_one(pool)
        .await
        .unwrap_or((0,));

        // 3. Consecutive outbound streak (unreplied outbound messages from most recent backward)
        let recent_messages: Vec<(Option<String>, Option<i64>)> = sqlx::query_as(
            r#"
            SELECT direction, from_me FROM messages
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT 100
            "#,
        )
        .bind(session_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let mut unreplied_streak: i64 = 0;
        for (dir_opt, from_me_opt) in recent_messages {
            let is_outgoing = dir_opt
                .as_deref()
                .map(|d| d.eq_ignore_ascii_case("outgoing"))
                .unwrap_or(false)
                || from_me_opt.unwrap_or(0) == 1;

            if is_outgoing {
                unreplied_streak += 1;
            } else {
                // Encountered an incoming reply! Stop counting streak.
                break;
            }
        }

        // 4. Calculate health score (0-100)
        let mut score: i64 = 100;

        if unreplied_streak > 15 {
            score -= (unreplied_streak - 15) * 2;
        }
        if out_24h_row.0 > 25 && in_24h_row.0 == 0 {
            score -= 20;
        }
        if in_24h_row.0 >= 3 {
            score = (score + 10).min(100);
        }
        score = score.clamp(0, 100);

        let (risk_level, throttle_multiplier, recommendation) = if score >= 70 {
            (
                "SAFE".to_string(),
                1.0,
                "Account health is optimal. Safe to continue standard campaigns.".to_string(),
            )
        } else if score >= 40 {
            (
                "MODERATE".to_string(),
                1.5,
                format!(
                    "Moderate ban risk: {} unreplied outbound messages. Delays throttled by 1.5x.",
                    unreplied_streak
                ),
            )
        } else {
            (
                "CRITICAL".to_string(),
                2.5,
                format!(
                    "Critical risk: {} unreplied messages without replies. Pause outreach to avoid ban.",
                    unreplied_streak
                ),
            )
        };

        Ok(SessionHealth {
            session_id: session_id.to_string(),
            outgoing_today: out_today_row.0,
            incoming_today: in_today_row.0,
            outgoing_last_24h: out_24h_row.0,
            incoming_last_24h: in_24h_row.0,
            unreplied_outbound_streak: unreplied_streak,
            health_score: score,
            risk_level,
            throttle_multiplier,
            recommendation,
        })
    }

    /// Evaluates whether an automated campaign message should proceed from this session.
    pub async fn check_dispatch_safety(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<SafetyCheckResult, AppError> {
        let health = Self::get_session_health(pool, session_id).await?;

        // Hard safety threshold: 50 unreplied messages
        if health.unreplied_outbound_streak >= 50 {
            return Ok(SafetyCheckResult::PauseForCooldown {
                reason: format!(
                    "Session '{}' has sent {} consecutive messages with zero incoming replies. Pausing campaign to protect number from WhatsApp ban.",
                    session_id, health.unreplied_outbound_streak
                ),
                unreplied_streak: health.unreplied_outbound_streak,
            });
        }

        Ok(SafetyCheckResult::Proceed {
            delay_multiplier: health.throttle_multiplier,
        })
    }
}
