#[cfg(test)]
mod tests {
    use crate::engine::protocol::{
        ContactProfilePictureData, EngineCommand, EngineEvent,
        PhonesValidatedData, PresenceSimulatedData, QrData, ReadyData,
    };

    #[test]
    fn test_engine_command_validate_phones_serde() {
        // Test camelCase serialization output
        let cmd = EngineCommand::ValidatePhones {
            session_id: "sess_val_1".to_string(),
            phone_numbers: vec!["919876543210".to_string(), "919876543211".to_string()],
            v: 1,
        };
        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains(r#""cmd":"engine.validate_phones""#));
        assert!(json.contains(r#""sessionId":"sess_val_1""#));
        assert!(json.contains(r#""phoneNumbers":["919876543210","919876543211"]"#));

        // Test deserialization with camelCase phoneNumbers
        let json_in_camel = r#"{
            "cmd": "engine.validate_phones",
            "sessionId": "sess_val_1",
            "phoneNumbers": ["919876543210"],
            "v": 1
        }"#;
        let deserialized: EngineCommand = serde_json::from_str(json_in_camel).unwrap();
        match deserialized {
            EngineCommand::ValidatePhones { session_id, phone_numbers, v } => {
                assert_eq!(session_id, "sess_val_1");
                assert_eq!(phone_numbers, vec!["919876543210"]);
                assert_eq!(v, 1);
            }
            _ => panic!("Expected ValidatePhones command"),
        }

        // Test deserialization with snake_case alias phone_numbers
        let json_in_snake = r#"{
            "cmd": "engine.validate_phones",
            "sessionId": "sess_val_1",
            "phone_numbers": ["919876543210"],
            "v": 1
        }"#;
        let deserialized_snake: EngineCommand = serde_json::from_str(json_in_snake).unwrap();
        match deserialized_snake {
            EngineCommand::ValidatePhones { phone_numbers, .. } => {
                assert_eq!(phone_numbers, vec!["919876543210"]);
            }
            _ => panic!("Expected ValidatePhones command"),
        }
    }

    #[test]
    fn test_engine_command_simulate_presence_serde() {
        // With duration_ms = Some(3000)
        let cmd_some = EngineCommand::SimulatePresence {
            session_id: "sess_pres_1".to_string(),
            jid: "919876543210@s.whatsapp.net".to_string(),
            state: "composing".to_string(),
            duration_ms: Some(3000),
            v: 1,
        };
        let json_some = serde_json::to_string(&cmd_some).unwrap();
        assert!(json_some.contains(r#""cmd":"engine.simulate_presence""#));
        assert!(json_some.contains(r#""durationMs":3000"#));

        // Deserialization with durationMs
        let json_in = r#"{
            "cmd": "engine.simulate_presence",
            "sessionId": "sess_pres_1",
            "jid": "919876543210@s.whatsapp.net",
            "state": "composing",
            "durationMs": 5000,
            "v": 1
        }"#;
        let des: EngineCommand = serde_json::from_str(json_in).unwrap();
        match des {
            EngineCommand::SimulatePresence { duration_ms, state, jid, .. } => {
                assert_eq!(duration_ms, Some(5000));
                assert_eq!(state, "composing");
                assert_eq!(jid, "919876543210@s.whatsapp.net");
            }
            _ => panic!("Expected SimulatePresence command"),
        }

        // Deserialization with duration_ms alias
        let json_in_alias = r#"{
            "cmd": "engine.simulate_presence",
            "sessionId": "sess_pres_1",
            "jid": "919876543210@s.whatsapp.net",
            "state": "paused",
            "duration_ms": 2000,
            "v": 1
        }"#;
        let des_alias: EngineCommand = serde_json::from_str(json_in_alias).unwrap();
        match des_alias {
            EngineCommand::SimulatePresence { duration_ms, state, .. } => {
                assert_eq!(duration_ms, Some(2000));
                assert_eq!(state, "paused");
            }
            _ => panic!("Expected SimulatePresence command"),
        }

        // With duration_ms = None
        let json_none = r#"{
            "cmd": "engine.simulate_presence",
            "sessionId": "sess_pres_1",
            "jid": "919876543210@s.whatsapp.net",
            "state": "paused",
            "v": 1
        }"#;
        let des_none: EngineCommand = serde_json::from_str(json_none).unwrap();
        match des_none {
            EngineCommand::SimulatePresence { duration_ms, .. } => {
                assert_eq!(duration_ms, None);
            }
            _ => panic!("Expected SimulatePresence command"),
        }
    }

    #[test]
    fn test_engine_event_phones_validated_serde() {
        let event_json = r#"{
            "event": "phones.validated",
            "sessionId": "sess_val_ev",
            "timestamp": "2026-07-28T12:00:00Z",
            "data": {
                "results": [
                    { "phoneNumber": "919876543210", "jid": "919876543210@s.whatsapp.net", "exists": true },
                    { "phoneNumber": "919999999999", "jid": null, "exists": false }
                ]
            },
            "v": 1
        }"#;
        let event: EngineEvent = serde_json::from_str(event_json).unwrap();
        assert_eq!(event.session_id(), "sess_val_ev");
        match event {
            EngineEvent::PhonesValidated { data, .. } => {
                assert_eq!(data.results.len(), 2);
                assert_eq!(data.results[0].phone_number, "919876543210");
                assert_eq!(data.results[0].jid, Some("919876543210@s.whatsapp.net".to_string()));
                assert!(data.results[0].exists);

                assert_eq!(data.results[1].phone_number, "919999999999");
                assert_eq!(data.results[1].jid, None);
                assert!(!data.results[1].exists);
            }
            _ => panic!("Expected PhonesValidated event"),
        }

        // Also test deserialization when payload uses snake_case "phone_number"
        let event_json_snake = r#"{
            "event": "phones.validated",
            "sessionId": "sess_val_ev",
            "timestamp": "2026-07-28T12:00:00Z",
            "data": {
                "results": [
                    { "phone_number": "+919876543210", "jid": "919876543210@s.whatsapp.net", "exists": true }
                ]
            },
            "v": 1
        }"#;
        let event_snake: EngineEvent = serde_json::from_str(event_json_snake).unwrap();
        match event_snake {
            EngineEvent::PhonesValidated { data, .. } => {
                assert_eq!(data.results[0].phone_number, "+919876543210");
            }
            _ => panic!("Expected PhonesValidated event"),
        }
    }

    #[test]
    fn test_engine_event_presence_simulated_serde() {
        let event_json = r#"{
            "event": "presence.simulated",
            "sessionId": "sess_pres_ev",
            "timestamp": "2026-07-28T12:00:00Z",
            "data": {
                "jid": "919876543210@s.whatsapp.net",
                "state": "composing",
                "success": true
            },
            "v": 1
        }"#;
        let event: EngineEvent = serde_json::from_str(event_json).unwrap();
        assert_eq!(event.session_id(), "sess_pres_ev");
        match event {
            EngineEvent::PresenceSimulated { data, .. } => {
                assert_eq!(data.jid, "919876543210@s.whatsapp.net");
                assert_eq!(data.state, "composing");
                assert!(data.success);
            }
            _ => panic!("Expected PresenceSimulated event"),
        }
    }

    #[test]
    fn test_engine_event_contact_profile_picture_serde() {
        let event_json = r#"{
            "event": "contact.profile_picture",
            "sessionId": "sess_pic_ev",
            "timestamp": "2026-07-28T12:00:00Z",
            "data": {
                "jid": "919876543210@s.whatsapp.net",
                "avatarUrl": "https://example.com/avatar.jpg"
            },
            "v": 1
        }"#;
        let event: EngineEvent = serde_json::from_str(event_json).unwrap();
        assert_eq!(event.session_id(), "sess_pic_ev");
        match event {
            EngineEvent::ContactProfilePicture { data, .. } => {
                assert_eq!(data.jid, "919876543210@s.whatsapp.net");
                assert_eq!(data.avatar_url, Some("https://example.com/avatar.jpg".to_string()));
            }
            _ => panic!("Expected ContactProfilePicture event"),
        }
    }

    #[test]
    fn test_all_engine_events_session_id_exhaustive() {
        // Verify session_id() on all 19 enum variants to ensure pattern match completeness
        let session = "test_sess_999";
        let time = "2026-07-28T12:00:00Z";

        let events: Vec<EngineEvent> = vec![
            EngineEvent::ContactProfilePicture {
                session_id: session.into(),
                timestamp: time.into(),
                data: ContactProfilePictureData { jid: "jid".into(), avatar_url: None },
                v: 1,
            },
            EngineEvent::PhonesValidated {
                session_id: session.into(),
                timestamp: time.into(),
                data: PhonesValidatedData { results: vec![] },
                v: 1,
            },
            EngineEvent::PresenceSimulated {
                session_id: session.into(),
                timestamp: time.into(),
                data: PresenceSimulatedData { jid: "jid".into(), state: "state".into(), success: true },
                v: 1,
            },
            EngineEvent::Connecting { session_id: session.into(), timestamp: time.into(), v: 1 },
            EngineEvent::Qr { session_id: session.into(), timestamp: time.into(), data: QrData { qr: "qr".into() }, v: 1 },
            EngineEvent::PairingCode { session_id: session.into(), timestamp: time.into(), data: crate::engine::protocol::PairingCodeData { code: "123".into() }, v: 1 },
            EngineEvent::Authenticating { session_id: session.into(), timestamp: time.into(), v: 1 },
            EngineEvent::Reconnecting { session_id: session.into(), timestamp: time.into(), v: 1 },
            EngineEvent::Ready { session_id: session.into(), timestamp: time.into(), data: ReadyData { phone_number: None, display_name: None }, v: 1 },
            EngineEvent::Disconnected { session_id: session.into(), timestamp: time.into(), data: crate::engine::protocol::DisconnectedData { status_code: None, reason: None }, v: 1 },
            EngineEvent::Failed { session_id: session.into(), timestamp: time.into(), data: crate::engine::protocol::FailedData { error: "err".into(), status_code: None }, v: 1 },
            EngineEvent::Stopped { session_id: session.into(), timestamp: time.into(), v: 1 },
            EngineEvent::MessageSent { session_id: session.into(), timestamp: time.into(), data: crate::engine::protocol::MessageSentData { message_id: "m1".into(), external_id: None }, v: 1 },
            EngineEvent::MessageFailed { session_id: session.into(), timestamp: time.into(), data: crate::engine::protocol::MessageFailedData { message_id: "m1".into(), error: "err".into() }, v: 1 },
            EngineEvent::ContactsSynced { session_id: session.into(), timestamp: time.into(), data: crate::engine::protocol::ContactsSyncedData { contacts: vec![] }, v: 1 },
            EngineEvent::ChatsSynced { session_id: session.into(), timestamp: time.into(), data: crate::engine::protocol::ChatsSyncedData { chats: vec![] }, v: 1 },
            EngineEvent::ChatMessages { session_id: session.into(), timestamp: time.into(), data: crate::engine::protocol::ChatMessagesData { jid: "j".into(), messages: vec![] }, v: 1 },
            EngineEvent::MessageReceived { session_id: session.into(), timestamp: time.into(), data: crate::engine::protocol::MessageReceivedData { message: crate::engine::protocol::IncomingMessage { id: "1".into(), jid: "j".into(), sender_jid: "s".into(), body: "b".into(), message_type: None, media_url: None, timestamp: time.into(), from_me: false } }, v: 1 },
            EngineEvent::MessageDeliveryUpdate { session_id: session.into(), timestamp: time.into(), data: crate::engine::protocol::MessageDeliveryUpdateData { external_id: "ext".into(), status: "sent".into(), status_code: None }, v: 1 },
        ];

        for ev in events {
            assert_eq!(ev.session_id(), session);
        }
    }
}
