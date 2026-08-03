use crate::engine::protocol::ChatData;
use crate::errors::AppError;
use crate::models::chat::Chat;
use chrono::Utc;
use sqlx::SqlitePool;

pub struct ChatService;

impl ChatService {
    pub async fn upsert_chats(
        pool: &SqlitePool,
        session_id: &str,
        chats: &[ChatData],
    ) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();
        for c in chats {
            let chat_id = format!("chat_{}_{}", session_id, c.jid);
            sqlx::query(
                r#"
                INSERT INTO chats (id, jid, name, is_group, last_message_body, last_message_at, unread_count, session_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id, jid) DO UPDATE SET
                    name = COALESCE(excluded.name, chats.name),
                    is_group = excluded.is_group,
                    last_message_body = COALESCE(excluded.last_message_body, chats.last_message_body),
                    last_message_at = COALESCE(excluded.last_message_at, chats.last_message_at),
                    unread_count = excluded.unread_count,
                    updated_at = excluded.updated_at
                "#,
            )
            .bind(&chat_id)
            .bind(&c.jid)
            .bind(&c.name)
            .bind(c.is_group)
            .bind(&c.last_message_body)
            .bind(&c.last_message_at)
            .bind(c.unread_count)
            .bind(session_id)
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await?;
        }
        Ok(())
    }

    pub async fn list_chats(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<Vec<Chat>, AppError> {
        // Automatically purge any invalid/corrupted or duplicate @lid chat records
        let _ = sqlx::query(
            "DELETE FROM chats WHERE jid LIKE 'chat_%' OR jid = '0' OR jid = 'status@broadcast' OR jid LIKE '%@lid'",
        )
        .execute(pool)
        .await;

        let chats = sqlx::query_as::<_, Chat>(
            r#"
            SELECT 
                c.id, 
                c.jid, 
                COALESCE(NULLIF(c.name, ''), cnt.name) AS name, 
                c.is_group, 
                c.last_message_body, 
                c.last_message_at, 
                c.unread_count, 
                c.session_id, 
                c.created_at, 
                c.updated_at
            FROM chats c
            LEFT JOIN contacts cnt ON c.session_id = cnt.session_id AND (c.jid = cnt.jid OR c.jid = cnt.phone_number || '@s.whatsapp.net')
            WHERE c.session_id = ? AND c.jid NOT LIKE 'chat_%' AND c.jid != '0' AND c.jid != 'status@broadcast' AND c.jid NOT LIKE '%@lid'
            ORDER BY COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC
            "#,
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        Ok(chats)
    }

    pub async fn update_chat_last_message(
        pool: &SqlitePool,
        session_id: &str,
        chat_jid: &str,
        last_body: &str,
        timestamp: &str,
        increment_unread: bool,
    ) -> Result<Chat, AppError> {
        let raw_clean = if chat_jid.starts_with("chat_") {
            let prefix = format!("chat_{}_", session_id);
            if chat_jid.starts_with(&prefix) {
                &chat_jid[prefix.len()..]
            } else {
                chat_jid
            }
        } else {
            chat_jid
        };

        if raw_clean.is_empty() || raw_clean.starts_with("chat_") || raw_clean == "0" {
            return Err(AppError::ValidationError(format!("Invalid chat JID: {}", chat_jid)));
        }

        // If raw_clean is an @lid JID, attempt to map it to a contact's standard phone JID
        let resolved_storage;
        let clean_jid = if raw_clean.ends_with("@lid") {
            let found_jid: Option<(String,)> = sqlx::query_as(
                "SELECT jid FROM contacts WHERE session_id = ? AND jid LIKE '%@s.whatsapp.net' ORDER BY updated_at DESC LIMIT 1"
            )
            .bind(session_id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

            if let Some((pn_jid,)) = found_jid {
                resolved_storage = pn_jid;
                &resolved_storage
            } else {
                raw_clean
            }
        } else {
            raw_clean
        };

        let now = Utc::now().to_rfc3339();
        let chat_id = format!("chat_{}_{}", session_id, clean_jid);
        let is_group = clean_jid.ends_with("@g.us");
        let initial_unread: i64 = if increment_unread { 1 } else { 0 };

        let chat = sqlx::query_as::<_, Chat>(
            r#"
            INSERT INTO chats (id, jid, name, is_group, last_message_body, last_message_at, unread_count, session_id, created_at, updated_at)
            VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id, jid) DO UPDATE SET
                last_message_body = excluded.last_message_body,
                last_message_at = excluded.last_message_at,
                unread_count = CASE WHEN ? THEN chats.unread_count + 1 ELSE chats.unread_count END,
                updated_at = excluded.updated_at
            RETURNING id, jid, name, is_group, last_message_body, last_message_at, unread_count, session_id, created_at, updated_at
            "#,
        )
        .bind(&chat_id)
        .bind(clean_jid)
        .bind(is_group)
        .bind(last_body)
        .bind(timestamp)
        .bind(initial_unread)
        .bind(session_id)
        .bind(&now)
        .bind(&now)
        .bind(increment_unread)
        .fetch_one(pool)
        .await?;

        Ok(chat)
    }

    pub async fn mark_chat_read(
        pool: &SqlitePool,
        session_id: &str,
        chat_id: &str,
    ) -> Result<Chat, AppError> {
        let now = Utc::now().to_rfc3339();
        let extracted_jid = if chat_id.starts_with("chat_") {
            let prefix = format!("chat_{}_", session_id);
            if chat_id.starts_with(&prefix) {
                chat_id[prefix.len()..].to_string()
            } else {
                chat_id.to_string()
            }
        } else {
            chat_id.to_string()
        };

        let jid = if extracted_jid.contains('@') {
            extracted_jid
        } else if let Ok((_, norm_jid)) = crate::services::contact_service::ContactService::normalize_phone_number(&extracted_jid) {
            norm_jid
        } else {
            extracted_jid
        };

        if jid.is_empty() || jid.starts_with("chat_") || jid == "0" {
            return Err(AppError::ValidationError(format!("Invalid chat JID: {}", chat_id)));
        }

        let chat_db_id = format!("chat_{}_{}", session_id, jid);
        let is_group = jid.ends_with("@g.us");

        let chat = sqlx::query_as::<_, Chat>(
            r#"
            INSERT INTO chats (id, jid, name, is_group, last_message_body, last_message_at, unread_count, session_id, created_at, updated_at)
            VALUES (?, ?, NULL, ?, NULL, NULL, 0, ?, ?, ?)
            ON CONFLICT(session_id, jid) DO UPDATE SET
                unread_count = 0,
                updated_at = excluded.updated_at
            RETURNING id, jid, name, is_group, last_message_body, last_message_at, unread_count, session_id, created_at, updated_at
            "#,
        )
        .bind(&chat_db_id)
        .bind(&jid)
        .bind(is_group)
        .bind(session_id)
        .bind(&now)
        .bind(&now)
        .fetch_one(pool)
        .await?;

        Ok(chat)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_chat_service_db_operations() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();

        sqlx::query("INSERT INTO sessions (id, name) VALUES ('sess_1', 'Test Session')")
            .execute(&pool)
            .await
            .unwrap();

        // 1. Upsert Chats
        let engine_chats = vec![ChatData {
            jid: "919876543210@s.whatsapp.net".to_string(),
            name: Some("Alice Chat".to_string()),
            is_group: false,
            last_message_body: Some("Hello".to_string()),
            last_message_at: Some("2026-07-27T00:00:00Z".to_string()),
            unread_count: 2,
            avatar_url: None,
        }];
        ChatService::upsert_chats(&pool, "sess_1", &engine_chats).await.unwrap();

        let chats = ChatService::list_chats(&pool, "sess_1").await.unwrap();
        assert_eq!(chats.len(), 1);
        assert_eq!(chats[0].name, Some("Alice Chat".to_string()));
        assert_eq!(chats[0].unread_count, 2);

        // 2. Update Chat Last Message with increment_unread = true
        let updated = ChatService::update_chat_last_message(
            &pool,
            "sess_1",
            "919876543210@s.whatsapp.net",
            "New message",
            "2026-07-27T01:00:00Z",
            true,
        )
        .await
        .unwrap();

        assert_eq!(updated.last_message_body, Some("New message".to_string()));
        assert_eq!(updated.unread_count, 3);

        // 3. Mark Chat Read resets unread count to 0
        let read = ChatService::mark_chat_read(&pool, "sess_1", "919876543210@s.whatsapp.net")
            .await
            .unwrap();
        assert_eq!(read.unread_count, 0);
    }
}
