#[cfg(test)]
mod tests {
    use crate::engine::protocol::IncomingMessage;
    use crate::models::campaign::*;
    use crate::services::blacklist_service::BlacklistService;
    use crate::services::campaign_service::CampaignService;
    use crate::services::campaign_worker::CampaignWorker;
    use crate::services::spintax_service::SpintaxResolver;
    use crate::services::warmup_service::WarmupManager;
    use crate::services::working_hours_service::WorkingHoursService;
    use chrono::{Duration, Utc};
    use serde_json::json;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use sqlx::SqlitePool;
    use std::collections::HashSet;
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

    // 1. Spintax Resolver Tests
    #[test]
    fn test_spintax_resolver_deep_nesting_and_types() {
        // Deeply nested spintax
        let template = "Start {Option A|{Option B1|Option B2}|{Option C1|{Option C2a|Option C2b}}} End";
        let mut observed = HashSet::new();
        for _ in 0..200 {
            let res = SpintaxResolver::parse_spintax(template);
            assert!(res.starts_with("Start ") && res.ends_with(" End"));
            let middle = res.trim_start_matches("Start ").trim_end_matches(" End");
            assert!(
                matches!(
                    middle,
                    "Option A" | "Option B1" | "Option B2" | "Option C1" | "Option C2a" | "Option C2b"
                ),
                "Unexpected middle string: {}",
                middle
            );
            observed.insert(res);
        }
        assert!(observed.len() > 1, "Spintax should produce varied outputs across runs");

        // Spintax + Variable Interpolation combined
        let combined = "{Hi|Hello} {{name}}, active status: {{is_active}}, points: {{points}}!";
        let vars = json!({
            "name": "Bob",
            "is_active": true,
            "points": 1500
        });
        let resolved = SpintaxResolver::resolve(combined, Some(&vars));
        assert!(
            resolved == "Hi Bob, active status: true, points: 1500!"
                || resolved == "Hello Bob, active status: true, points: 1500!",
            "Unexpected resolved text: {}",
            resolved
        );

        // UTF-8 Emojis in spintax options
        let emoji_template = "{Welcome 😃|Greetings 👋|Hi 🚀}";
        let res_emoji = SpintaxResolver::parse_spintax(emoji_template);
        assert!(
            res_emoji == "Welcome 😃" || res_emoji == "Greetings 👋" || res_emoji == "Hi 🚀",
            "Emoji spintax failed: {}",
            res_emoji
        );

        // Uninterpolated variable placeholder cleanup
        let missing_vars_template = "Hello {{name}}, your ref is {{unknown_ref}}.";
        let res_missing = SpintaxResolver::interpolate_variables(missing_vars_template, Some(&json!({"name": "Alice"})));
        assert_eq!(res_missing, "Hello Alice, your ref is .");
    }

    // 2. Global Blacklist Tests
    #[tokio::test]
    async fn test_global_blacklist_auto_stop_and_normalizations() {
        let pool = setup_test_db().await;

        // Populate a campaign recipient
        let campaign = CampaignService::create_campaign(
            &pool,
            CreateCampaignDto {
                name: "Blacklist Test Campaign".to_string(),
                recipients: None,
                anti_ban_config: None,
                steps: Some(vec![CreateStepDto {
                    step_number: 1,
                    delay_after_previous_sec: Some(0),
                    template_text: "Promo text".to_string(),
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
                    phone_number: "+91 98765 43210".to_string(),
                    custom_variables: None,
                }],
            },
        )
        .await
        .unwrap();

        // 1. Auto-stop triggered by "STOP" reply
        let is_stop = BlacklistService::handle_incoming_stop(&pool, "9876543210", "  stop  ")
            .await
            .unwrap();
        assert!(is_stop, "handle_incoming_stop should recognize 'stop'");

        // Verify recipient status updated to BLACKLISTED
        let cmp = CampaignService::get_campaign(&pool, &campaign.id).await.unwrap();
        let recipients = sqlx::query_as::<_, CampaignRecipient>(
            "SELECT * FROM campaign_recipients WHERE campaign_id = ?",
        )
        .bind(&campaign.id)
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(recipients[0].status, "BLACKLISTED");

        // 2. Verify BlacklistService::check for all phone number formats
        assert!(BlacklistService::check(&pool, "9876543210").await.unwrap());
        assert!(BlacklistService::check(&pool, "919876543210").await.unwrap());
        assert!(BlacklistService::check(&pool, "+919876543210").await.unwrap());
        assert!(BlacklistService::check(&pool, "09876543210").await.unwrap());

        // 3. Idempotent re-adding
        let item = BlacklistService::add(&pool, "9876543210", Some("Manual addition"))
            .await
            .unwrap();
        assert_eq!(item.phone_number, "919876543210");
        assert_eq!(item.reason.as_deref(), Some("Manual addition"));
    }

    // 3. Timezone-aware Working Hours Filter Tests
    #[test]
    fn test_working_hours_timezones_and_windows() {
        // Standard daytime window: 00:00 to 23:59
        let in_std = WorkingHoursService::is_within_working_hours("00:00", "23:59", "UTC");
        // Overnight wrap window: 22:00 to 06:00
        let in_wrap = WorkingHoursService::is_within_working_hours("22:00", "06:00", "UTC");
        let _ = (in_std, in_wrap);

        // Invalid timezone fallback to UTC (must not panic)
        let fallback_check = WorkingHoursService::is_within_working_hours("09:00", "17:00", "NonExistent/TZ");
        let _ = fallback_check;

        let next_utc = WorkingHoursService::calculate_next_working_window_utc("09:00", "Asia/Kolkata");
        assert!(next_utc > Utc::now() - Duration::hours(24));
    }

    // 4. Warm-up Daily Tier Limits Tests
    #[tokio::test]
    async fn test_warmup_tier_limits_and_age_brackets() {
        let pool = setup_test_db().await;

        let now = Utc::now();

        // Tier 1: Day 0 (age < 3 days) -> Limit 25
        let t1_created = (now - Duration::days(1)).to_rfc3339();
        sqlx::query("INSERT INTO sessions (id, name, created_at) VALUES ('sess_t1', 'T1 Session', ?)")
            .bind(&t1_created)
            .execute(&pool)
            .await
            .unwrap();

        let limit_t1 = WarmupManager::get_session_daily_limit(&pool, "sess_t1", 500, true)
            .await
            .unwrap();
        assert_eq!(limit_t1, 25, "Session age < 3 days should have Tier 1 limit of 25");

        // Tier 2: Day 4 (3 <= age < 7 days) -> Limit 75
        let t2_created = (now - Duration::days(4)).to_rfc3339();
        sqlx::query("INSERT INTO sessions (id, name, created_at) VALUES ('sess_t2', 'T2 Session', ?)")
            .bind(&t2_created)
            .execute(&pool)
            .await
            .unwrap();

        let limit_t2 = WarmupManager::get_session_daily_limit(&pool, "sess_t2", 500, true)
            .await
            .unwrap();
        assert_eq!(limit_t2, 75, "Session age 4 days should have Tier 2 limit of 75");

        // Tier 3: Day 10 (age >= 7 days) -> Limit 200
        let t3_created = (now - Duration::days(10)).to_rfc3339();
        sqlx::query("INSERT INTO sessions (id, name, created_at) VALUES ('sess_t3', 'T3 Session', ?)")
            .bind(&t3_created)
            .execute(&pool)
            .await
            .unwrap();

        let limit_t3 = WarmupManager::get_session_daily_limit(&pool, "sess_t3", 500, true)
            .await
            .unwrap();
        assert_eq!(limit_t3, 200, "Session age 10 days should have Tier 3 limit of 200");

        // Config max override (config_max = 50 caps Tier 3 limit 200 to 50)
        let limit_t3_capped = WarmupManager::get_session_daily_limit(&pool, "sess_t3", 50, true)
            .await
            .unwrap();
        assert_eq!(limit_t3_capped, 50, "Tier limit should be capped by config_max");

        // Warmup disabled -> uses config_max
        let limit_disabled = WarmupManager::get_session_daily_limit(&pool, "sess_t1", 500, false)
            .await
            .unwrap();
        assert_eq!(limit_disabled, 500);
    }

    // 5. Campaign State Machine Transitions Tests
    #[tokio::test]
    async fn test_campaign_state_machine_transitions_and_retry() {
        let pool = setup_test_db().await;

        // Create campaign (DRAFT)
        let campaign = CampaignService::create_campaign(
            &pool,
            CreateCampaignDto {
                name: "State Machine Campaign".to_string(),
                recipients: None,
                anti_ban_config: None,
                steps: Some(vec![CreateStepDto {
                    step_number: 1,
                    delay_after_previous_sec: Some(0),
                    template_text: "Hello".to_string(),
                    media_url: None,
                }]),
            },
        )
        .await
        .unwrap();
        assert_eq!(campaign.status, "DRAFT");

        // DRAFT -> RUNNING
        let running = CampaignService::start_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(running.status, "RUNNING");

        // RUNNING -> PAUSED
        let paused = CampaignService::pause_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(paused.status, "PAUSED");

        // PAUSED -> RUNNING
        let resumed = CampaignService::start_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(resumed.status, "RUNNING");

        // RUNNING -> STOPPED
        let stopped = CampaignService::stop_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(stopped.status, "STOPPED");

        // Cannot pause a STOPPED campaign
        let pause_err = CampaignService::pause_campaign(&pool, &campaign.id).await;
        assert!(pause_err.is_err(), "Pausing a STOPPED campaign should fail with InvalidStateTransition");

        // Retry failed recipients
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

        // Mark recipient as FAILED
        sqlx::query("UPDATE campaign_recipients SET status = 'FAILED' WHERE campaign_id = ?")
            .bind(&campaign.id)
            .execute(&pool)
            .await
            .unwrap();

        let retried = CampaignService::retry_failed_recipients(&pool, &campaign.id).await.unwrap();
        assert_eq!(retried, 1);

        let cmp = CampaignService::get_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(cmp.status, "RUNNING", "Retrying failed recipients should set campaign status to RUNNING");
    }

    // 6. Stop-on-Reply Sequence Cancellation Tests
    #[tokio::test]
    async fn test_stop_on_reply_sequence_cancellation() {
        let pool = setup_test_db().await;

        let campaign = CampaignService::create_campaign(
            &pool,
            CreateCampaignDto {
                name: "Stop on Reply Campaign".to_string(),
                recipients: None,
                anti_ban_config: None,
                steps: Some(vec![
                    CreateStepDto {
                        step_number: 1,
                        delay_after_previous_sec: Some(0),
                        template_text: "Step 1".to_string(),
                        media_url: None,
                    },
                    CreateStepDto {
                        step_number: 2,
                        delay_after_previous_sec: Some(60),
                        template_text: "Step 2".to_string(),
                        media_url: None,
                    },
                ]),
            },
        )
        .await
        .unwrap();

        let _ = CampaignService::import_recipients_json(
            &pool,
            &campaign.id,
            ImportRecipientsRequest {
                recipients: vec![
                    RecipientImportItem {
                        phone_number: "9876543210".to_string(),
                        custom_variables: None,
                    },
                    RecipientImportItem {
                        phone_number: "9876543211".to_string(),
                        custom_variables: None,
                    },
                ],
            },
        )
        .await
        .unwrap();

        let incoming_reply = IncomingMessage {
            id: "msg_reply_9876543210".to_string(),
            jid: "919876543210@s.whatsapp.net".to_string(),
            sender_jid: "919876543210@s.whatsapp.net".to_string(),
            body: "Interested!".to_string(),
            message_type: None,
            media_url: None,
            timestamp: Utc::now().to_rfc3339(),
            from_me: false,
        };

        let handled = CampaignWorker::handle_incoming_reply(&pool, "sess_1", &incoming_reply)
            .await
            .unwrap();

        assert!(handled, "Incoming reply should be detected and handled");

        // Verify recipient status is REPLIED and campaign replied_count is 1
        let cmp = CampaignService::get_campaign(&pool, &campaign.id).await.unwrap();
        assert_eq!(cmp.replied_count, 1);

        let recipients = sqlx::query_as::<_, CampaignRecipient>(
            "SELECT * FROM campaign_recipients WHERE campaign_id = ? ORDER BY phone_number ASC",
        )
        .bind(&campaign.id)
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(recipients[0].phone_number, "919876543210");
        assert_eq!(recipients[0].status, "REPLIED");

        assert_eq!(recipients[1].phone_number, "919876543211");
        assert_eq!(recipients[1].status, "PENDING");
    }
}
