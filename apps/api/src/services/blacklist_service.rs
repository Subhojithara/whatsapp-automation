use crate::errors::AppError;
use crate::models::blacklist::BlacklistItem;
use crate::services::contact_service::ContactService;
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

pub struct BlacklistService;

impl BlacklistService {
    pub async fn add(
        pool: &SqlitePool,
        phone_number: &str,
        reason: Option<&str>,
    ) -> Result<BlacklistItem, AppError> {
        let normalized = ContactService::normalize_phone_number(phone_number)
            .map(|(p, _)| p)
            .unwrap_or_else(|_| phone_number.trim().to_string());

        let id = format!("blk_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        let item = sqlx::query_as::<_, BlacklistItem>(
            r#"
            INSERT INTO blacklist (id, phone_number, reason, added_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(phone_number) DO UPDATE SET
                reason = COALESCE(excluded.reason, blacklist.reason)
            RETURNING id, phone_number, reason, added_at
            "#,
        )
        .bind(&id)
        .bind(&normalized)
        .bind(reason)
        .bind(&now)
        .fetch_one(pool)
        .await?;

        Ok(item)
    }

    pub async fn check(pool: &SqlitePool, phone_number: &str) -> Result<bool, AppError> {
        let normalized = ContactService::normalize_phone_number(phone_number)
            .map(|(p, _)| p)
            .unwrap_or_else(|_| phone_number.trim().to_string());

        let raw = phone_number.trim();
        let with_plus = if !raw.starts_with('+') {
            format!("+{}", raw)
        } else {
            raw.to_string()
        };
        let without_plus = raw.trim_start_matches('+').to_string();

        let row: Option<(i64,)> = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM blacklist
            WHERE phone_number = ? OR phone_number = ? OR phone_number = ? OR phone_number = ?
            "#,
        )
        .bind(raw)
        .bind(&normalized)
        .bind(&with_plus)
        .bind(&without_plus)
        .fetch_optional(pool)
        .await?;

        let count = row.map(|r| r.0).unwrap_or(0);
        Ok(count > 0)
    }

    pub async fn remove(pool: &SqlitePool, id_or_phone: &str) -> Result<(), AppError> {
        let normalized = ContactService::normalize_phone_number(id_or_phone)
            .map(|(p, _)| p)
            .unwrap_or_else(|_| id_or_phone.trim().to_string());

        sqlx::query("DELETE FROM blacklist WHERE id = ? OR phone_number = ? OR phone_number = ?")
            .bind(id_or_phone)
            .bind(id_or_phone)
            .bind(&normalized)
            .execute(pool)
            .await?;

        Ok(())
    }

    pub async fn list(
        pool: &SqlitePool,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<BlacklistItem>, AppError> {
        let items = sqlx::query_as::<_, BlacklistItem>(
            "SELECT id, phone_number, reason, added_at FROM blacklist ORDER BY added_at DESC LIMIT ? OFFSET ?",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    pub async fn handle_incoming_stop(
        pool: &SqlitePool,
        phone_number: &str,
        body: &str,
    ) -> Result<bool, AppError> {
        let trimmed = body.trim().to_uppercase();
        if trimmed == "STOP" || trimmed == "UNSUBSCRIBE" || trimmed == "QUIT" || trimmed == "CANCEL"
        {
            Self::add(pool, phone_number, Some("AUTO_STOP_REPLY")).await?;

            let (normalized_phone, jid) = ContactService::normalize_phone_number(phone_number)
                .unwrap_or_else(|_| (phone_number.trim().to_string(), format!("{}@s.whatsapp.net", phone_number.trim())));

            sqlx::query(
                r#"
                UPDATE campaign_recipients
                SET status = 'BLACKLISTED'
                WHERE (phone_number = ? OR jid = ? OR phone_number = ?)
                  AND status IN ('PENDING', 'SCHEDULED', 'SENDING')
                "#,
            )
            .bind(phone_number)
            .bind(&jid)
            .bind(&normalized_phone)
            .execute(pool)
            .await?;

            return Ok(true);
        }
        Ok(false)
    }
}
