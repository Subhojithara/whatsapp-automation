#[cfg(test)]
mod tests {
    use crate::engine::protocol::IncomingMessage;
    use crate::models::campaign::*;
    use crate::services::blacklist_service::BlacklistService;
    use crate::services::campaign_service::CampaignService;
    use crate::services::campaign_worker::CampaignWorker;
    use crate::services::export_service::ExportService;
    use crate::services::spintax_service::SpintaxResolver;
    use crate::services::warmup_service::WarmupManager;
    use crate::services::working_hours_service::WorkingHoursService;
    use serde_json::json;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use sqlx::SqlitePool;
    use std::str::FromStr;

    async fn setup_test_db() -> SqlitePool {
        let opts = SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .foreign_keys(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(opts)
            .await
            .unwrap();

        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[test]
    fn test_spintax_resolver_single_and_nested() {
        // Single level spintax
        let template = "Hello {World|Friend|User}!";
        let resolved = SpintaxResolver::parse_spintax(template);
        assert!(
            resolved == "Hello World!" || resolved == "Hello Friend!" || resolved == "Hello User!",
            "Unexpected resolved text: {}",
            resolved
        );

        // Nested spintax
        let nested = "{Hi {there|buddy}|Hello}";
        let res_nested = SpintaxResolver::parse_spintax(nested);
        assert!(
            res_nested == "Hi there" || res_nested == "Hi buddy" || res_nested == "Hello",
            "Unexpected nested resolved text: {}",
            res_nested
        );

        // Variable interpolation
        let var_template = "Hi {{name}}, welcome to {{city}}! Code: {code}.";
        let vars = json!({
            "name": "Alice",
            "city": "Mumbai",
            "code": "1234"
        });
        let res_vars = SpintaxResolver::interpolate_variables(var_template, Some(&vars));
        assert_eq!(res_vars, "Hi Alice, welcome to Mumbai! Code: 1234.");

        // Combined SpintaxResolver::resolve
        let combined = "{Hey|Hi} {{name}}!";
        let res_combined = SpintaxResolver::resolve(combined, Some(&vars));
        assert!(
            res_combined == "Hey Alice!" || res_combined == "Hi Alice!",
            "Unexpected combined result: {}",
            res_combined
        );
    }

    #[tokio::test]
    async fn test_blacklist_service_operations() {
        let pool = setup_test_db().await;

        // Add to blacklist
        let item = BlacklistService::add(&pool, "9876543210", Some("User request"))
            .await
            .unwrap();
        assert_eq!(item.phone_number, "919876543210");
        assert_eq!(item.reason.as_deref(), Some("User request"));

        // Check blacklist (both raw and normalized)
        assert!(BlacklistService::check(&pool, "9876543210").await.unwrap());
        assert!(BlacklistService::check(&pool, "919876543210").await.unwrap());
        assert!(BlacklistService::check(&pool, "+919876543210").await.unwrap());
        assert!(!BlacklistService::check(&pool, "911234567890").await.unwrap());

        // Remove from blacklist
        BlacklistService::remove(&pool, "9876543210").await.unwrap();
        assert!(!BlacklistService::check(&pool, "9876543210").await.unwrap());

        // Handle incoming STOP auto-blacklist
        let stopped = BlacklistService::handle_incoming_stop(&pool, "9876543210", "stop")
            .await
            .unwrap();
        assert!(stopped);
        assert!(BlacklistService::check(&pool, "9876543210").await.unwrap());
    }

    #[test]
    fn test_working_hours_service() {
        // Standard window: 00:00 to 23:59 always true
        assert!(WorkingHoursService::is_within_working_hours("00:00", "23:59", "UTC"));

        // Wrap-around window 22:00 to 06:00
        let is_wrap = WorkingHoursService::is_within_working_hours("22:00", "06:00", "UTC");
        // Result depends on current hour, but call must not panic
        let _ = is_wrap;

        // Invalid timezone falls back to UTC gracefully
        let _ = WorkingHoursService::is_within_working_hours("09:00", "18:00", "Invalid/Timezone");
        let next_utc = WorkingHoursService::calculate_next_working_window_utc("09:00", "Invalid/TZ");
        assert!(next_utc.timestamp() > 0);
    }

    #[tokio::test]
    async fn test_warmup_manager_limits() {
        let pool = setup_test_db().await;

        // Create dummy session in sessions table created right now (0 days old -> Tier 1 limit 25)
        sqlx::query("INSERT INTO sessions (id, name, created_at) VALUES ('sess_warmup', 'Warmup Sess', (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))")
            .execute(&pool)
            .await
            .unwrap();

        let limit = WarmupManager::get_session_daily_limit(&pool, "sess_warmup", 100, true)
            .await
            .unwrap();
        assert_eq!(limit, 25, "Day 0 session should have Tier 1 limit of 25 msgs/day");

        // Warmup disabled -> uses config_max
        let limit_disabled = WarmupManager::get_session_daily_limit(&pool, "sess_warmup", 100, false)
            .await
            .unwrap();
        assert_eq!(limit_disabled, 100);

        // Check sent count
        let can_send = WarmupManager::can_send_message(&pool, "sess_warmup", 100, true)
            .await
            .unwrap();
        assert!(can_send);
    }

    #[tokio::test]
    async fn test_campaign_lifecycle_and_service_crud() {
        let pool = setup_test_db().await;

        // 1. Create Campaign
        let campaign = CampaignService::create_campaign(
            &pool,
            CreateCampaignDto {
                name: "Test Campaign".to_string(),
                recipients: None,
                anti_ban_config: Some(CreateAntiBanConfigDto {
                    min_delay_sec: Some(1),
                    max_delay_sec: Some(2),
                    typing_duration_sec: Some(1),
                    enable_spintax: Some(true),
                    working_hours_start: Some("00:00".to_string()),
                    working_hours_end: Some("23:59".to_string()),
                    timezone: Some("UTC".to_string()),
                    max_messages_per_session_per_day: Some(50),
                    warmup_enabled: Some(true),
                }),
                steps: Some(vec![
                    CreateStepDto {
                        step_number: 1,
                        delay_after_previous_sec: Some(0),
                        template_text: "Hello {{name}}!".to_string(),
                        media_url: None,
                    },
                    CreateStepDto {
                        step_number: 2,
                        delay_after_previous_sec: Some(10),
                        template_text: "Follow up message for {{name}}.".to_string(),
                        media_url: None,
                    },
                ]),
            },
        )
        .await
        .unwrap();

        assert_eq!(campaign.name, "Test Campaign");
        assert_eq!(campaign.status, "DRAFT");
        assert_eq!(campaign.steps.len(), 2);

        // 2. Import Recipients (JSON)
        let import_res = CampaignService::import_recipients_json(
            &pool,
            &campaign.id,
            ImportRecipientsRequest {
                recipients: vec![
                    RecipientImportItem {
                        phone_number: "9876543210".to_string(),
                        custom_variables: Some(json!({ "name": "Bob" })),
                    },
                    RecipientImportItem {
                        phone_number: "9876543211".to_string(),
                        custom_variables: Some(json!({ "name": "Alice" })),
                    },
                ],
            },
        )
        .await
        .unwrap();

        assert_eq!(import_res.total_imported, 2);
        assert_eq!(import_res.skipped_blacklisted, 0);

        let cmp = CampaignService::get_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(cmp.total_recipients, 2);

        // 3. Start Campaign
        let started = CampaignService::start_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(started.status, "RUNNING");

        // 4. Pause Campaign
        let paused = CampaignService::pause_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(paused.status, "PAUSED");

        // 5. Clone Campaign
        let cloned = CampaignService::clone_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(cloned.name, "Test Campaign (Copy)");
        assert_eq!(cloned.status, "DRAFT");
        assert_eq!(cloned.steps.len(), 2);

        // 6. Stop Campaign
        let stopped = CampaignService::stop_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(stopped.status, "STOPPED");

        // 7. Retry Failed Recipients
        // Manually fail a recipient to test retry
        sqlx::query("UPDATE campaign_recipients SET status = 'FAILED' WHERE campaign_id = ? AND phone_number = '919876543210'")
            .bind(&campaign.id)
            .execute(&pool)
            .await
            .unwrap();

        let retried_count = CampaignService::retry_failed_recipients(&pool, &campaign.id).await.unwrap();
        assert_eq!(retried_count, 1);

        // 8. Export CSV & XLSX
        let csv_bytes = ExportService::export_csv(&pool, &campaign.id).await.unwrap();
        assert!(!csv_bytes.is_empty());
        let csv_str = String::from_utf8(csv_bytes).unwrap();
        assert!(csv_str.contains("919876543210"));

        let xlsx_bytes = ExportService::export_xlsx(&pool, &campaign.id).await.unwrap();
        assert!(!xlsx_bytes.is_empty());
    }

    #[tokio::test]
    async fn test_stop_on_reply_cancellation() {
        let pool = setup_test_db().await;

        let campaign = CampaignService::create_campaign(
            &pool,
            CreateCampaignDto {
                name: "Reply Campaign".to_string(),
                recipients: None,
                anti_ban_config: None,
                steps: Some(vec![CreateStepDto {
                    step_number: 1,
                    delay_after_previous_sec: Some(0),
                    template_text: "Hi!".to_string(),
                    media_url: None,
                }]),
            },
        )
        .await
        .unwrap();

        let _ = CampaignService::import_recipients_json(
            &pool,
            &campaign.id,
            ImportRecipientsRequest {
                recipients: vec![RecipientImportItem {
                    phone_number: "9876543210".to_string(),
                    custom_variables: None,
                }],
            },
        )
        .await
        .unwrap();

        let incoming = IncomingMessage {
            id: "msg_reply_1".to_string(),
            jid: "919876543210@s.whatsapp.net".to_string(),
            sender_jid: "919876543210@s.whatsapp.net".to_string(),
            body: "I am interested!".to_string(),
            message_type: None,
            media_url: None,
            timestamp: "2026-07-28T12:00:00Z".to_string(),
            from_me: false,
        };

        let handled = CampaignWorker::handle_incoming_reply(&pool, "sess_1", &incoming)
            .await
            .unwrap();

        assert!(handled, "Should detect and handle recipient reply");

        let cmp = CampaignService::get_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(cmp.replied_count, 1);
    }
}
