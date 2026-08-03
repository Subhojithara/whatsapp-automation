#[cfg(test)]
mod tests {
    use crate::engine::protocol::{ChatData, EngineCommand, EngineEvent};
    use crate::models::contact::CreateContactDto;
    use crate::services::chat_service::ChatService;
    use crate::services::contact_service::ContactService;
    use crate::services::message_service::MessageService;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use sqlx::SqlitePool;
    use std::str::FromStr;

    async fn setup_db_with_pragma(foreign_keys: bool) -> SqlitePool {
        let opts = SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .foreign_keys(foreign_keys);

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(opts)
            .await
            .unwrap();

        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_phone_normalization_contact_vs_message_service() {
        // 10-digit Indian number: ContactService and MessageService auto-prepend 91
        let (cnt_phone, cnt_jid) = ContactService::normalize_phone_number("9876543210").unwrap();
        assert_eq!(cnt_phone, "919876543210");
        assert_eq!(cnt_jid, "919876543210@s.whatsapp.net");

        let msg_jid_10 = MessageService::validate_recipient("9876543210").unwrap();
        assert_eq!(msg_jid_10, "919876543210@s.whatsapp.net");

        // Leading 0 stripping
        let (cnt_phone_0, cnt_jid_0) = ContactService::normalize_phone_number("09876543210").unwrap();
        assert_eq!(cnt_phone_0, "919876543210");
        assert_eq!(cnt_jid_0, "919876543210@s.whatsapp.net");

        let msg_jid_0 = MessageService::validate_recipient("09876543210").unwrap();
        assert_eq!(msg_jid_0, "919876543210@s.whatsapp.net");

        // 12-digit number with +91 country code and spaces
        let (cnt_phone_cc, cnt_jid_cc) =
            ContactService::normalize_phone_number("+91 98765 43210").unwrap();
        assert_eq!(cnt_phone_cc, "919876543210");
        assert_eq!(cnt_jid_cc, "919876543210@s.whatsapp.net");

        let msg_jid_cc = MessageService::validate_recipient("+91 98765 43210").unwrap();
        assert_eq!(msg_jid_cc, "919876543210@s.whatsapp.net");

        // Group JID passed to MessageService vs ContactService
        let group_jid = "123456789012345678@g.us";
        let msg_group = MessageService::validate_recipient(group_jid).unwrap();
        assert_eq!(msg_group, group_jid);

        // Invalid numbers
        assert!(ContactService::normalize_phone_number("").is_err());
        assert!(ContactService::normalize_phone_number("12345").is_err());
        assert!(MessageService::validate_recipient("").is_err());
        assert!(MessageService::validate_recipient("12345").is_err());
    }

    #[tokio::test]
    async fn test_sql_schema_unique_and_foreign_key_cascade() {
        // Without foreign_keys(true), SQLite does not enforce ON DELETE CASCADE!
        let pool_no_fk = setup_db_with_pragma(false).await;

        sqlx::query("INSERT INTO sessions (id, name) VALUES ('sess_1', 'Test Session')")
            .execute(&pool_no_fk)
            .await
            .unwrap();

        ContactService::create_manual_contact(
            &pool_no_fk,
            "sess_1",
            CreateContactDto {
                phone_number: "9876543210".to_string(),
                name: Some("Alice".to_string()),
            },
        )
        .await
        .unwrap();

        // Verify UNIQUE constraint UPSERT works
        ContactService::create_manual_contact(
            &pool_no_fk,
            "sess_1",
            CreateContactDto {
                phone_number: "9876543210".to_string(),
                name: Some("Alice Updated".to_string()),
            },
        )
        .await
        .unwrap();

        let contacts = ContactService::list_contacts(&pool_no_fk, "sess_1")
            .await
            .unwrap();
        assert_eq!(contacts.len(), 1);
        assert_eq!(contacts[0].name, Some("Alice Updated".to_string()));

        // Delete session in DB without foreign_keys enabled
        sqlx::query("DELETE FROM sessions WHERE id = 'sess_1'")
            .execute(&pool_no_fk)
            .await
            .unwrap();

        let orphaned_contacts: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM contacts")
            .fetch_one(&pool_no_fk)
            .await
            .unwrap();

        // Without PRAGMA foreign_keys = ON, orphaned contacts remain!
        assert_eq!(
            orphaned_contacts.0, 1,
            "Orphaned contacts remain if PRAGMA foreign_keys = ON is missing"
        );

        // Now test WITH foreign_keys(true)
        let pool_with_fk = setup_db_with_pragma(true).await;

        sqlx::query("INSERT INTO sessions (id, name) VALUES ('sess_2', 'Test Session FK')")
            .execute(&pool_with_fk)
            .await
            .unwrap();

        ContactService::create_manual_contact(
            &pool_with_fk,
            "sess_2",
            CreateContactDto {
                phone_number: "9876543210".to_string(),
                name: Some("Bob".to_string()),
            },
        )
        .await
        .unwrap();

        ChatService::update_chat_last_message(
            &pool_with_fk,
            "sess_2",
            "919876543210@s.whatsapp.net",
            "Hello",
            "2026-07-27T00:00:00Z",
            true,
        )
        .await
        .unwrap();

        sqlx::query("DELETE FROM sessions WHERE id = 'sess_2'")
            .execute(&pool_with_fk)
            .await
            .unwrap();

        let contacts_after: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM contacts")
            .fetch_one(&pool_with_fk)
            .await
            .unwrap();
        let chats_after: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM chats")
            .fetch_one(&pool_with_fk)
            .await
            .unwrap();

        assert_eq!(contacts_after.0, 0, "Contacts deleted via ON DELETE CASCADE");
        assert_eq!(chats_after.0, 0, "Chats deleted via ON DELETE CASCADE");
    }

    #[tokio::test]
    async fn test_unread_count_increment_and_sync() {
        let pool = setup_db_with_pragma(true).await;

        sqlx::query("INSERT INTO sessions (id, name) VALUES ('sess_1', 'Test Session')")
            .execute(&pool)
            .await
            .unwrap();

        let jid = "919876543210@s.whatsapp.net";

        // 1. Initial incoming message increments unread count from 0 to 1
        let chat1 = ChatService::update_chat_last_message(
            &pool,
            "sess_1",
            jid,
            "Message 1",
            "2026-07-27T00:00:00Z",
            true,
        )
        .await
        .unwrap();

        assert_eq!(chat1.unread_count, 1);

        // 2. Second incoming message increments unread count to 2
        let chat2 = ChatService::update_chat_last_message(
            &pool,
            "sess_1",
            jid,
            "Message 2",
            "2026-07-27T00:01:00Z",
            true,
        )
        .await
        .unwrap();

        assert_eq!(chat2.unread_count, 2);

        // 3. Outgoing message preserves unread count (increment_unread = false)
        let chat3 = ChatService::update_chat_last_message(
            &pool,
            "sess_1",
            jid,
            "Message 3 (outgoing)",
            "2026-07-27T00:02:00Z",
            false,
        )
        .await
        .unwrap();

        assert_eq!(chat3.unread_count, 2);

        // 4. Engine sync can reset unread_count when upserting chats
        let engine_chats = vec![ChatData {
            jid: jid.to_string(),
            name: Some("Alice".to_string()),
            is_group: false,
            last_message_body: Some("Message 3 (outgoing)".to_string()),
            last_message_at: Some("2026-07-27T00:02:00Z".to_string()),
            unread_count: 0,
            avatar_url: None,
        }];
        ChatService::upsert_chats(&pool, "sess_1", &engine_chats)
            .await
            .unwrap();

        let chats = ChatService::list_chats(&pool, "sess_1").await.unwrap();
        assert_eq!(chats[0].unread_count, 0);

        // 5. Incoming message increments unread_count, then mark_chat_read resets it to 0
        let chat4 = ChatService::update_chat_last_message(
            &pool,
            "sess_1",
            jid,
            "Message 4",
            "2026-07-27T00:03:00Z",
            true,
        )
        .await
        .unwrap();
        assert_eq!(chat4.unread_count, 1);

        let chat_read = ChatService::mark_chat_read(&pool, "sess_1", jid)
            .await
            .unwrap();
        assert_eq!(chat_read.unread_count, 0);
    }

    #[test]
    fn test_stdio_ipc_protocol_serde() {
        // Test command serialization
        let cmd = EngineCommand::SendText {
            session_id: "sess_123".to_string(),
            chat_id: "919876543210@s.whatsapp.net".to_string(),
            text: "Hello IPC".to_string(),
            message_id: "msg_456".to_string(),
            v: 1,
        };
        let json_cmd = serde_json::to_string(&cmd).unwrap();
        assert!(json_cmd.contains(r#""cmd":"engine.send_text""#));
        assert!(json_cmd.contains(r#""sessionId":"sess_123""#));
        assert!(json_cmd.contains(r#""chatId":"919876543210@s.whatsapp.net""#));

        // Test event deserialization: Ready event
        let event_json = r#"{
            "event": "session.ready",
            "sessionId": "sess_123",
            "timestamp": "2026-07-27T12:00:00Z",
            "data": { "phoneNumber": "919876543210", "displayName": "Alice" },
            "v": 1
        }"#;
        let event: EngineEvent = serde_json::from_str(event_json).unwrap();
        match event {
            EngineEvent::Ready { session_id, data, .. } => {
                assert_eq!(session_id, "sess_123");
                assert_eq!(data.phone_number, Some("919876543210".to_string()));
                assert_eq!(data.display_name, Some("Alice".to_string()));
            }
            _ => panic!("Expected Ready event"),
        }

        // Test event deserialization: MessageReceived event
        let msg_event_json = r#"{
            "event": "message.received",
            "sessionId": "sess_123",
            "timestamp": "2026-07-27T12:05:00Z",
            "data": {
                "message": {
                    "id": "ext_789",
                    "jid": "919876543210@s.whatsapp.net",
                    "senderJid": "919876543210@s.whatsapp.net",
                    "body": "Hi back!",
                    "timestamp": "2026-07-27T12:05:00Z",
                    "fromMe": false
                }
            },
            "v": 1
        }"#;
        let msg_event: EngineEvent = serde_json::from_str(msg_event_json).unwrap();
        match msg_event {
            EngineEvent::MessageReceived { session_id, data, .. } => {
                assert_eq!(session_id, "sess_123");
                assert_eq!(data.message.id, "ext_789");
                assert_eq!(data.message.from_me, false);
                assert_eq!(data.message.body, "Hi back!");
            }
            _ => panic!("Expected MessageReceived event"),
        }
    }
}
