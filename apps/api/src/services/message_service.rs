use crate::config::Config;
use crate::engine::manager::EngineManager;
use crate::engine::pending_messages::{MessageResult, PendingMessages};
use crate::engine::protocol::IncomingMessage;
use crate::errors::AppError;
use crate::models::message::{Message, MessageResponse, MessageStatus, SendTextRequest};
use crate::services::chat_service::ChatService;
use crate::services::contact_service::ContactService;
use crate::services::session_service::SessionService;
use crate::state_machine::SessionStatus;
use chrono::Utc;
use sqlx::SqlitePool;
use std::time::Duration;
use uuid::Uuid;

pub struct MessageService;

impl MessageService {
    pub fn validate_recipient(to: &str) -> Result<String, AppError> {
        let trimmed = to.trim();
        if trimmed.is_empty() {
            return Err(AppError::InvalidRecipient(
                "Recipient phone number or chat ID cannot be empty".to_string(),
            ));
        }

        if trimmed.contains('@') {
            // Already formatted JID e.g. 123456789@s.whatsapp.net or 123456789@g.us
            return Ok(trimmed.to_string());
        }

        match ContactService::normalize_phone_number(trimmed) {
            Ok((_phone, jid)) => Ok(jid),
            Err(AppError::ValidationError(msg)) => Err(AppError::InvalidRecipient(msg)),
            Err(e) => Err(e),
        }
    }

    pub fn validate_text(text: &str) -> Result<String, AppError> {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Err(AppError::InvalidMessage(
                "Message text cannot be empty".to_string(),
            ));
        }

        if trimmed.len() > 4096 {
            return Err(AppError::InvalidMessage(format!(
                "Message text exceeds maximum supported length of 4096 characters (length: {}).",
                trimmed.len()
            )));
        }

        Ok(trimmed.to_string())
    }

    pub async fn send_text(
        pool: &SqlitePool,
        engine_manager: &EngineManager,
        pending_messages: &PendingMessages,
        config: &Config,
        session_id: &str,
        req: SendTextRequest,
    ) -> Result<MessageResponse, AppError> {
        let chat_id = Self::validate_recipient(&req.to)?;
        let text_body = Self::validate_text(&req.text)?;

        // 1. Session validation with transient reconnect wait (up to 10s)
        let mut session = SessionService::get_session(pool, session_id).await?;
        let mut current_status = session.parsed_status();

        if current_status == SessionStatus::Connecting
            || current_status == SessionStatus::Reconnecting
            || current_status == SessionStatus::Authenticating
        {
            tracing::info!(
                session_id = %session_id,
                status = %current_status,
                "Session is in transient connecting/reconnecting state. Waiting up to 10s for READY..."
            );
            let max_wait = Duration::from_secs(10);
            let poll_interval = Duration::from_millis(500);
            let start = std::time::Instant::now();

            while start.elapsed() < max_wait {
                tokio::time::sleep(poll_interval).await;
                if let Ok(s) = SessionService::get_session(pool, session_id).await {
                    current_status = s.parsed_status();
                    if current_status == SessionStatus::Ready {
                        session = s;
                        break;
                    }
                    if current_status == SessionStatus::Failed
                        || current_status == SessionStatus::Disconnected
                        || current_status == SessionStatus::Stopped
                    {
                        break;
                    }
                }
            }
        }

        if current_status != SessionStatus::Ready {
            return Err(AppError::SessionNotReady(format!(
                "Session '{}' is currently in '{}' state. Messages can only be sent when state is READY.",
                session_id, current_status
            )));
        }

        // 2. Engine running check (Auto-start if session is READY but process was stopped or died)
        if !engine_manager.is_running(session_id).await {
            let auth_dir_path = std::path::Path::new(&config.engine_data_dir).join(session_id).join("auth");
            let auth_creds_path = auth_dir_path.join("creds.json");
            if auth_creds_path.exists() {
                tracing::info!(session_id = %session_id, creds_path = %auth_creds_path.display(), "Engine process not running for READY session, auto-starting engine...");
                engine_manager.start_session(session_id.to_string(), auth_dir_path.to_string_lossy().to_string()).await?;

                // Wait for the engine to actually connect to WhatsApp (up to 15 seconds)
                let max_wait = Duration::from_secs(15);
                let poll_interval = Duration::from_millis(500);
                let start = std::time::Instant::now();
                let mut engine_ready = false;

                while start.elapsed() < max_wait {
                    tokio::time::sleep(poll_interval).await;
                    // Check if session status has been updated to READY by the event processor
                    if let Ok(s) = SessionService::get_session(pool, session_id).await {
                        if s.parsed_status() == SessionStatus::Ready {
                            engine_ready = true;
                            break;
                        }
                        // If it failed or disconnected during startup, bail early
                        let st = s.parsed_status();
                        if st == SessionStatus::Failed || st == SessionStatus::Disconnected || st == SessionStatus::Stopped {
                            return Err(AppError::EngineNotAvailable(format!(
                                "Engine for session '{}' entered '{}' state during auto-start. Cannot send message.",
                                session_id, st
                            )));
                        }
                    }
                }

                if !engine_ready {
                    return Err(AppError::EngineTimeout(format!(
                        "Engine auto-start timed out: session '{}' did not reach READY within {} seconds",
                        session_id, max_wait.as_secs()
                    )));
                }

                tracing::info!(session_id = %session_id, "Engine auto-started and reached READY state");
            } else {
                return Err(AppError::EngineNotAvailable(format!(
                    "Session '{}' is marked READY but its engine process is not running (creds not found at {}).",
                    session_id, auth_creds_path.display()
                )));
            }
        }

        // 3. Create PENDING message record in DB
        let message_id = format!("msg_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        let _pending_msg = sqlx::query_as::<_, Message>(
            r#"
            INSERT INTO messages (id, session_id, chat_id, direction, message_type, body, status, created_at, updated_at, sender_jid, from_me)
            VALUES (?, ?, ?, 'outgoing', 'text', ?, ?, ?, ?, NULL, 1)
            RETURNING *
            "#,
        )
        .bind(&message_id)
        .bind(session_id)
        .bind(&chat_id)
        .bind(&text_body)
        .bind(MessageStatus::Pending.as_str())
        .bind(&now)
        .bind(&now)
        .fetch_one(pool)
        .await?;

        // Update chat last message
        let _ = ChatService::update_chat_last_message(
            pool,
            session_id,
            &chat_id,
            &text_body,
            &now,
            false,
        )
        .await;

        // 4. Register oneshot response receiver
        let rx = pending_messages.register(message_id.clone()).await;

        // 5. Send command to engine
        if let Err(err) = engine_manager
            .send_text(session_id, &chat_id, &text_body, &message_id)
            .await
        {
            let err_msg = err.to_string();
            let _ = Self::update_message_failed(pool, &message_id, &err_msg).await;
            return Err(err);
        }

        // 6. Await engine response event with timeout
        let timeout_duration = Duration::from_secs(config.engine_send_timeout_secs);
        match tokio::time::timeout(timeout_duration, rx).await {
            Ok(Ok(MessageResult::Sent { external_id })) => {
                let updated = Self::update_message_sent(pool, &message_id, external_id).await?;
                Ok(updated.into())
            }
            Ok(Ok(MessageResult::Failed { error })) => {
                let _ = Self::update_message_failed(pool, &message_id, &error).await;
                Err(AppError::MessageSendFailed(error))
            }
            Ok(Err(_)) => {
                let err_msg = "Pending message response channel closed unexpectedly".to_string();
                let _ = Self::update_message_failed(pool, &message_id, &err_msg).await;
                Err(AppError::InternalError(err_msg))
            }
            Err(_) => {
                let timeout_msg = format!(
                    "Engine send command timed out after {} seconds",
                    config.engine_send_timeout_secs
                );
                let _ = Self::update_message_failed(pool, &message_id, &timeout_msg).await;
                Err(AppError::EngineTimeout(timeout_msg))
            }
        }
    }

    pub async fn send_media_message(
        pool: &SqlitePool,
        engine_manager: &EngineManager,
        pending_messages: &PendingMessages,
        config: &Config,
        session_id: &str,
        chat_id: &str,
        media_type: &str,
        media_url: &str,
        caption: Option<&str>,
        file_name: Option<&str>,
        mimetype: Option<&str>,
    ) -> Result<MessageResponse, AppError> {
        SessionService::get_session(pool, session_id).await?;

        let message_id = format!("msg_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let fallback_caption = match media_type {
            "audio" => "🎙️ Voice Note",
            "image" => "📷 Image",
            "video" => "🎥 Video",
            "document" => file_name.unwrap_or("📄 Document"),
            "sticker" => "🏷️ Sticker",
            _ => "Attachment",
        };
        let body_text = caption.unwrap_or(fallback_caption);

        let _ = sqlx::query(
            r#"
            INSERT INTO messages (id, external_id, session_id, chat_id, direction, message_type, body, media_url, status, created_at, updated_at, sender_jid, from_me)
            VALUES (?, NULL, ?, ?, 'outgoing', ?, ?, ?, ?, ?, ?, NULL, 1)
            "#,
        )
        .bind(&message_id)
        .bind(session_id)
        .bind(chat_id)
        .bind(media_type)
        .bind(body_text)
        .bind(media_url)
        .bind(MessageStatus::Pending.as_str())
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        let _ = ChatService::update_chat_last_message(
            pool,
            session_id,
            chat_id,
            body_text,
            &now,
            false,
        )
        .await;

        let rx = pending_messages.register(message_id.clone()).await;

        if let Err(err) = engine_manager
            .send_media(
                session_id,
                chat_id,
                media_type,
                media_url,
                caption,
                file_name,
                mimetype,
                &message_id,
            )
            .await
        {
            let err_msg = err.to_string();
            let _ = Self::update_message_failed(pool, &message_id, &err_msg).await;
            return Err(err);
        }

        let timeout_duration = Duration::from_secs(config.engine_send_timeout_secs);
        match tokio::time::timeout(timeout_duration, rx).await {
            Ok(Ok(MessageResult::Sent { external_id })) => {
                let updated = Self::update_message_sent(pool, &message_id, external_id).await?;
                Ok(updated.into())
            }
            Ok(Ok(MessageResult::Failed { error })) => {
                let _ = Self::update_message_failed(pool, &message_id, &error).await;
                Err(AppError::MessageSendFailed(error))
            }
            Ok(Err(_)) => {
                let err_msg = "Pending message response channel closed unexpectedly".to_string();
                let _ = Self::update_message_failed(pool, &message_id, &err_msg).await;
                Err(AppError::InternalError(err_msg))
            }
            Err(_) => {
                let timeout_msg = format!(
                    "Engine send media command timed out after {} seconds",
                    config.engine_send_timeout_secs
                );
                let _ = Self::update_message_failed(pool, &message_id, &timeout_msg).await;
                Err(AppError::EngineTimeout(timeout_msg))
            }
        }
    }

    pub async fn save_incoming_message(
        pool: &SqlitePool,
        session_id: &str,
        msg: &IncomingMessage,
    ) -> Result<Message, AppError> {
        let message_id = format!("msg_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let timestamp = if msg.timestamp.is_empty() {
            now.clone()
        } else {
            msg.timestamp.clone()
        };

        let direction = if msg.from_me { "outgoing" } else { "incoming" };
        let status = if msg.from_me { "SENT" } else { "RECEIVED" };
        let msg_type = msg.message_type.as_deref().unwrap_or("text");

        // Resolve @lid JID to a clean phone JID if possible
        let resolved_storage;
        let target_jid = if msg.jid.ends_with("@lid") {
            let found: Option<(String,)> = sqlx::query_as(
                "SELECT jid FROM contacts WHERE session_id = ? AND jid LIKE '%@s.whatsapp.net' ORDER BY updated_at DESC LIMIT 1"
            )
            .bind(session_id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

            if let Some((pn_jid,)) = found {
                resolved_storage = pn_jid;
                &resolved_storage
            } else {
                &msg.jid
            }
        } else {
            &msg.jid
        };

        let message = sqlx::query_as::<_, Message>(
            r#"
            INSERT INTO messages (id, external_id, session_id, chat_id, direction, message_type, body, media_url, status, created_at, updated_at, sender_jid, from_me)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            "#,
        )
        .bind(&message_id)
        .bind(Some(&msg.id))
        .bind(session_id)
        .bind(target_jid)
        .bind(direction)
        .bind(msg_type)
        .bind(&msg.body)
        .bind(&msg.media_url)
        .bind(status)
        .bind(&timestamp)
        .bind(&now)
        .bind(Some(&msg.sender_jid))
        .bind(msg.from_me)
        .fetch_one(pool)
        .await?;

        let _ = ChatService::update_chat_last_message(
            pool,
            session_id,
            target_jid,
            &msg.body,
            &timestamp,
            !msg.from_me,
        )
        .await;

        Ok(message)
    }

    pub async fn list_messages(
        pool: &SqlitePool,
        session_id: &str,
        chat_id: &str,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<MessageResponse>, AppError> {
        // chat_id could be a JID (919477762699@s.whatsapp.net) or a DB id (chat_ses_xxx_919477762699@s.whatsapp.net)
        // Messages are stored with chat_id = JID, so we need to extract the JID if a DB id was passed
        let jid = if chat_id.starts_with("chat_") {
            // Extract JID from format: chat_{session_id}_{jid}
            // Find the JID part after the session_id prefix
            let prefix = format!("chat_{}_", session_id);
            if chat_id.starts_with(&prefix) {
                &chat_id[prefix.len()..]
            } else {
                chat_id
            }
        } else {
            chat_id
        };

        let messages = sqlx::query_as::<_, Message>(
            r#"
            SELECT *
            FROM messages
            WHERE session_id = ? AND (chat_id = ? OR chat_id = ?)
            ORDER BY created_at ASC
            LIMIT ? OFFSET ?
            "#,
        )
        .bind(session_id)
        .bind(jid)
        .bind(chat_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(messages.into_iter().map(Into::into).collect())
    }

    pub async fn update_message_sent(
        pool: &SqlitePool,
        id: &str,
        external_id: Option<String>,
    ) -> Result<Message, AppError> {
        let now = Utc::now().to_rfc3339();
        let message = sqlx::query_as::<_, Message>(
            r#"
            UPDATE messages
            SET status = ?, external_id = ?, sent_at = ?, updated_at = ?
            WHERE id = ?
            RETURNING *
            "#,
        )
        .bind(MessageStatus::Sent.as_str())
        .bind(external_id)
        .bind(&now)
        .bind(&now)
        .bind(id)
        .fetch_one(pool)
        .await?;

        Ok(message)
    }

    pub async fn update_message_failed(
        pool: &SqlitePool,
        id: &str,
        error: &str,
    ) -> Result<Message, AppError> {
        let now = Utc::now().to_rfc3339();
        let message = sqlx::query_as::<_, Message>(
            r#"
            UPDATE messages
            SET status = ?, error = ?, updated_at = ?
            WHERE id = ?
            RETURNING *
            "#,
        )
        .bind(MessageStatus::Failed.as_str())
        .bind(error)
        .bind(&now)
        .bind(id)
        .fetch_one(pool)
        .await?;

        Ok(message)
    }

    pub async fn get_message(pool: &SqlitePool, id: &str) -> Result<Message, AppError> {
        let message = sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::ValidationError(format!("Message not found: {}", id)))?;

        Ok(message)
    }

    pub async fn update_message_delivery_by_external_id(
        pool: &SqlitePool,
        external_id: &str,
        status_str: &str,
    ) -> Result<Option<Message>, AppError> {
        let status = match status_str {
            "delivered" => MessageStatus::Delivered,
            "read" => MessageStatus::Read,
            "failed" => MessageStatus::Failed,
            "sent" => MessageStatus::Sent,
            _ => return Ok(None),
        };

        let now = Utc::now().to_rfc3339();
        let message = sqlx::query_as::<_, Message>(
            r#"
            UPDATE messages
            SET status = ?, updated_at = ?
            WHERE external_id = ? OR id = ?
            RETURNING *
            "#,
        )
        .bind(status.as_str())
        .bind(&now)
        .bind(external_id)
        .bind(external_id)
        .fetch_optional(pool)
        .await?;

        Ok(message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_recipient_valid() {
        assert_eq!(
            MessageService::validate_recipient("9876543210").unwrap(),
            "919876543210@s.whatsapp.net"
        );
        assert_eq!(
            MessageService::validate_recipient("09876543210").unwrap(),
            "919876543210@s.whatsapp.net"
        );
        assert_eq!(
            MessageService::validate_recipient("919876543210").unwrap(),
            "919876543210@s.whatsapp.net"
        );
        assert_eq!(
            MessageService::validate_recipient("+91 98765 43210").unwrap(),
            "919876543210@s.whatsapp.net"
        );
        assert_eq!(
            MessageService::validate_recipient("1234567890@s.whatsapp.net").unwrap(),
            "1234567890@s.whatsapp.net"
        );
        assert_eq!(
            MessageService::validate_recipient("1234567890@g.us").unwrap(),
            "1234567890@g.us"
        );
    }

    #[test]
    fn test_validate_recipient_invalid() {
        assert!(MessageService::validate_recipient("").is_err());
        assert!(MessageService::validate_recipient("   ").is_err());
        assert!(MessageService::validate_recipient("1234").is_err()); // Too short
        assert!(MessageService::validate_recipient("12345678901234567").is_err()); // Too long
    }


    #[test]
    fn test_validate_text_valid() {
        assert_eq!(
            MessageService::validate_text("Hello World").unwrap(),
            "Hello World"
        );
    }

    #[test]
    fn test_validate_text_invalid() {
        assert!(MessageService::validate_text("").is_err());
        assert!(MessageService::validate_text("   ").is_err());

        let long_text = "a".repeat(4097);
        assert!(MessageService::validate_text(&long_text).is_err());
    }

    #[tokio::test]
    async fn test_message_service_incoming_and_history() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();

        sqlx::query("INSERT INTO sessions (id, name) VALUES ('sess_1', 'Test Session')")
            .execute(&pool)
            .await
            .unwrap();

        let inc = IncomingMessage {
            id: "ext_msg_1".to_string(),
            jid: "919876543210@s.whatsapp.net".to_string(),
            sender_jid: "919876543210@s.whatsapp.net".to_string(),
            body: "Hello from Whatsapp!".to_string(),
            message_type: None,
            media_url: None,
            timestamp: "2026-07-27T01:30:00Z".to_string(),
            from_me: false,
        };

        let saved = MessageService::save_incoming_message(&pool, "sess_1", &inc)
            .await
            .unwrap();

        assert_eq!(saved.chat_id, "919876543210@s.whatsapp.net");
        assert_eq!(saved.direction, "incoming");
        assert_eq!(saved.from_me, false);
        assert_eq!(saved.body, Some("Hello from Whatsapp!".to_string()));

        let history = MessageService::list_messages(
            &pool,
            "sess_1",
            "919876543210@s.whatsapp.net",
            50,
            0,
        )
        .await
        .unwrap();

        assert_eq!(history.len(), 1);
        assert_eq!(history[0].text, Some("Hello from Whatsapp!".to_string()));
        assert_eq!(history[0].direction, "incoming");
        assert_eq!(history[0].from_me, false);
    }
}

