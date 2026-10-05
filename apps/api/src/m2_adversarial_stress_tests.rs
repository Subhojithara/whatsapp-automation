#[cfg(test)]
mod tests {
    use crate::engine::protocol::IncomingMessage;
    use crate::errors::AppError;
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

    // -------------------------------------------------------------
    // Area 1: Spintax Resolver Variations & Variable Interpolation
    // -------------------------------------------------------------

    #[test]
    fn test_adversarial_spintax_nested_and_variations() {
        // Deeply nested spintax
        let template = "Start {Option A|{Option B1|Option B2}|{Option C1|{Option C2a|Option C2b}}} End";
        let mut choices = HashSet::new();
        for _ in 0..300 {
            let res = SpintaxResolver::parse_spintax(template);
            assert!(res.starts_with("Start ") && res.ends_with(" End"));
            let inner = res.trim_start_matches("Start ").trim_end_matches(" End");
            assert!(
                matches!(
                    inner,
                    "Option A" | "Option B1" | "Option B2" | "Option C1" | "Option C2a" | "Option C2b"
                ),
                "Unexpected middle string: '{}'",
                inner
            );
            choices.insert(res);
        }
        // Verify all 6 options are reachable
        assert_eq!(
            choices.len(),
            6,
            "Expected all 6 spintax options to be generated, got {}",
            choices.len()
        );
    }

    #[test]
    fn test_adversarial_spintax_malformed_double_braces() {
        // Double brace containing single brace inside: {{name}
        let template = "Hello {{name} world";
        let res = SpintaxResolver::interpolate_variables(template, None);
        // Checking behavior on {{name}
        println!("Resolved {{name}}: '{}'", res);
    }

    #[test]
    fn test_adversarial_variable_types_and_cleanup() {
        let template = "Hi {{name}}, score: {{score}}, active: {{active}}, null: {{empty}}!";
        let vars = json!({
            "name": "Alice",
            "score": 100,
            "active": true,
            "empty": null
        });
        let res = SpintaxResolver::interpolate_variables(template, Some(&vars));
        assert_eq!(res, "Hi Alice, score: 100, active: true, null: null!");

        // Missing variable cleanup test
        let template_missing = "Hello {{first_name}} {{last_name}}, your code is {code}.";
        let partial_vars = json!({"first_name": "Bob"});
        let res_missing = SpintaxResolver::interpolate_variables(template_missing, Some(&partial_vars));
        assert_eq!(res_missing, "Hello Bob , your code is .");
    }

    // -------------------------------------------------------------
    // Area 2: Blacklist Handling & STOP Auto-Blacklist
    // -------------------------------------------------------------

    #[tokio::test]
    async fn test_adversarial_blacklist_number_formats_and_stop_triggers() {
        let pool = setup_test_db().await;

        // Test STOP variations
        let triggers = vec!["stop", "STOP", "  stop  ", "UNSUBSCRIBE", "QUIT", "CANCEL"];
        for trig in triggers {
            let phone = format!("987654321{}", trig.len());
            let handled = BlacklistService::handle_incoming_stop(&pool, &phone, trig)
                .await
                .unwrap();
            assert!(handled, "Trigger '{}' should be handled as auto-stop", trig);
            assert!(
                BlacklistService::check(&pool, &phone).await.unwrap(),
                "Phone '{}' should be blacklisted",
                phone
            );
        }

        // Test Non-STOP triggers that should NOT auto-blacklist
        let non_triggers = vec!["STOP!", "Please stop", "stop now", "NO", "HALT"];
        for non_trig in non_triggers {
            let phone = "9111111111";
            let handled = BlacklistService::handle_incoming_stop(&pool, phone, non_trig)
                .await
                .unwrap();
            assert!(!handled, "Non-trigger '{}' should NOT be auto-stopped", non_trig);
        }

        // Blacklist check with phone format variations
        let base_phone = "9876540000";
        BlacklistService::add(&pool, base_phone, Some("Testing formats"))
            .await
            .unwrap();

        assert!(BlacklistService::check(&pool, "9876540000").await.unwrap());
        assert!(BlacklistService::check(&pool, "919876540000").await.unwrap());
        assert!(BlacklistService::check(&pool, "+919876540000").await.unwrap());
        assert!(BlacklistService::check(&pool, "09876540000").await.unwrap());
        assert!(BlacklistService::check(&pool, "+91 98765 40000").await.unwrap());
    }

    #[tokio::test]
    async fn test_adversarial_auto_stop_recipients_cancellation() {
        let pool = setup_test_db().await;

        let campaign = CampaignService::create_campaign(
            &pool,
            CreateCampaignDto {
                name: "Auto Stop Campaign".to_string(),
                recipients: None,
                anti_ban_config: None,
                steps: Some(vec![CreateStepDto {
                    step_number: Some(1),
                    delay_after_previous_sec: Some(0),
                    template_text: "Hello".to_string(),
                    media_url: None,
                }]),
            },
        )
        .await
        .unwrap();

        // Import recipient with formatted number
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

        // Recipient replies "STOP" with raw number 9876543210
        let is_stop = BlacklistService::handle_incoming_stop(&pool, "9876543210", "STOP")
            .await
            .unwrap();
        assert!(is_stop);

        // Verify recipient status in database
        let recipient: (String,) = sqlx::query_as(
            "SELECT status FROM campaign_recipients WHERE campaign_id = ?",
        )
        .bind(&campaign.id)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(recipient.0, "BLACKLISTED");
    }

    // -------------------------------------------------------------
    // Area 3: Working Hours Filter Boundaries
    // -------------------------------------------------------------

    #[test]
    fn test_adversarial_working_hours_boundaries() {
        // Test standard 00:00 to 23:59
        assert!(WorkingHoursService::is_within_working_hours("00:00", "23:59", "UTC"));

        // Single-digit hour format parsing test e.g. "9:00" vs "09:00"
        let parsed_single = WorkingHoursService::is_within_working_hours("9:00", "18:00", "UTC");
        let parsed_double = WorkingHoursService::is_within_working_hours("09:00", "18:00", "UTC");
        assert_eq!(parsed_single, parsed_double);

        // Equal start and end time e.g. "09:00" to "09:00"
        let equal_window = WorkingHoursService::is_within_working_hours("09:00", "09:00", "UTC");
        assert!(!equal_window, "Equal start and end time should return false");
    }

    // -------------------------------------------------------------
    // Area 4: Warmup Manager Daily Limits
    // -------------------------------------------------------------

    #[tokio::test]
    async fn test_adversarial_warmup_tier_boundaries() {
        let pool = setup_test_db().await;
        let now = Utc::now();

        // Session age: 2 days 23 hours -> Tier 1 (25)
        let age_t1 = (now - Duration::hours(71)).to_rfc3339();
        sqlx::query("INSERT INTO sessions (id, name, created_at) VALUES ('sess_t1_edge', 'Sess T1', ?)")
            .bind(&age_t1)
            .execute(&pool)
            .await
            .unwrap();

        let limit_t1 = WarmupManager::get_session_daily_limit(&pool, "sess_t1_edge", 500, true)
            .await
            .unwrap();
        assert_eq!(limit_t1, 25);

        // Session age: 3 days 0 hours -> Tier 2 (75)
        let age_t2 = (now - Duration::hours(72)).to_rfc3339();
        sqlx::query("INSERT INTO sessions (id, name, created_at) VALUES ('sess_t2_edge', 'Sess T2', ?)")
            .bind(&age_t2)
            .execute(&pool)
            .await
            .unwrap();

        let limit_t2 = WarmupManager::get_session_daily_limit(&pool, "sess_t2_edge", 500, true)
            .await
            .unwrap();
        assert_eq!(limit_t2, 75);

        // Session age: 6 days 23 hours -> Tier 2 (75)
        let age_t2_end = (now - Duration::hours(167)).to_rfc3339();
        sqlx::query("INSERT INTO sessions (id, name, created_at) VALUES ('sess_t2_end', 'Sess T2 End', ?)")
            .bind(&age_t2_end)
            .execute(&pool)
            .await
            .unwrap();

        let limit_t2_end = WarmupManager::get_session_daily_limit(&pool, "sess_t2_end", 500, true)
            .await
            .unwrap();
        assert_eq!(limit_t2_end, 75);

        // Session age: 7 days 0 hours -> Tier 3 (200)
        let age_t3 = (now - Duration::hours(168)).to_rfc3339();
        sqlx::query("INSERT INTO sessions (id, name, created_at) VALUES ('sess_t3_edge', 'Sess T3', ?)")
            .bind(&age_t3)
            .execute(&pool)
            .await
            .unwrap();

        let limit_t3 = WarmupManager::get_session_daily_limit(&pool, "sess_t3_edge", 500, true)
            .await
            .unwrap();
        assert_eq!(limit_t3, 200);
    }

    #[tokio::test]
    async fn test_adversarial_sent_today_count_rfc3339_comparison() {
        let pool = setup_test_db().await;

        sqlx::query("INSERT INTO sessions (id, name) VALUES ('sess_today', 'Session Today')")
            .execute(&pool)
            .await
            .unwrap();

        // Insert message sent yesterday 23:59:59 UTC
        let yesterday_ts = (Utc::now() - Duration::days(1))
            .date_naive()
            .and_hms_opt(23, 59, 59)
            .unwrap()
            .and_utc()
            .to_rfc3339();

        sqlx::query(
            "INSERT INTO messages (id, session_id, chat_id, body, direction, status, created_at, updated_at) VALUES ('msg_old', 'sess_today', '123@s.whatsapp.net', 'hi', 'OUTGOING', 'SENT', ?, ?)",
        )
        .bind(&yesterday_ts)
        .bind(&yesterday_ts)
        .execute(&pool)
        .await
        .unwrap();

        // Insert message sent today 00:00:01 UTC
        let today_ts = Utc::now()
            .date_naive()
            .and_hms_opt(0, 0, 1)
            .unwrap()
            .and_utc()
            .to_rfc3339();

        sqlx::query(
            "INSERT INTO messages (id, session_id, chat_id, body, direction, status, created_at, updated_at) VALUES ('msg_new', 'sess_today', '123@s.whatsapp.net', 'hi', 'OUTGOING', 'SENT', ?, ?)",
        )
        .bind(&today_ts)
        .bind(&today_ts)
        .execute(&pool)
        .await
        .unwrap();

        let sent_today = WarmupManager::get_sent_today_count(&pool, "sess_today")
            .await
            .unwrap();
        assert_eq!(sent_today, 1, "Only today's outgoing message should be counted");
    }

    // -------------------------------------------------------------
    // Area 5: Campaign Worker & Stop-On-Reply Sequence Cancellation
    // -------------------------------------------------------------

    #[tokio::test]
    async fn test_adversarial_stop_on_reply_sequence_cancellation() {
        let pool = setup_test_db().await;

        let campaign = CampaignService::create_campaign(
            &pool,
            CreateCampaignDto {
                name: "Multi-Step Campaign".to_string(),
                recipients: None,
                anti_ban_config: None,
                steps: Some(vec![
                    CreateStepDto {
                        step_number: Some(1),
                        delay_after_previous_sec: Some(0),
                        template_text: "Step 1".to_string(),
                        media_url: None,
                    },
                    CreateStepDto {
                        step_number: Some(2),
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

        // Recipient 1 replies after Step 1
        let incoming_reply = IncomingMessage {
            id: "msg_reply_1".to_string(),
            jid: "919876543210@s.whatsapp.net".to_string(),
            sender_jid: "919876543210@s.whatsapp.net".to_string(),
            body: "I got your message, thanks!".to_string(),
            message_type: None,
            media_url: None,
            timestamp: Utc::now().to_rfc3339(),
            from_me: false,
        };

        let handled = CampaignWorker::handle_incoming_reply(&pool, "sess_1", &incoming_reply)
            .await
            .unwrap();

        assert!(handled);

        // Verify recipient status
        let rec1: (String, i64) = sqlx::query_as(
            "SELECT status, current_step FROM campaign_recipients WHERE phone_number = '919876543210'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(rec1.0, "REPLIED");

        // Verify recipient 2 is still PENDING
        let rec2: (String, i64) = sqlx::query_as(
            "SELECT status, current_step FROM campaign_recipients WHERE phone_number = '919876543211'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(rec2.0, "PENDING");
    }

    // -------------------------------------------------------------
    // Area 6: Foreign Key Safety in SQLite (PRAGMA foreign_keys = ON)
    // -------------------------------------------------------------

    #[tokio::test]
    async fn test_adversarial_foreign_key_constraints_and_cascades() {
        let pool = setup_test_db().await;

        // 1. Attempt to insert campaign_step with non-existent campaign_id -> MUST FAIL
        let step_res = sqlx::query(
            "INSERT INTO campaign_steps (id, campaign_id, step_number, template_text) VALUES ('stp_bad', 'cmp_nonexistent', 1, 'Test')",
        )
        .execute(&pool)
        .await;

        assert!(step_res.is_err(), "Foreign key constraint failure expected when campaign_id does not exist");

        // 2. Create campaign and steps, then delete campaign -> MUST CASCADE
        let campaign = CampaignService::create_campaign(
            &pool,
            CreateCampaignDto {
                name: "FK Test Campaign".to_string(),
                recipients: None,
                anti_ban_config: None,
                steps: Some(vec![CreateStepDto {
                    step_number: Some(1),
                    delay_after_previous_sec: Some(0),
                    template_text: "FK Step".to_string(),
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

        // Delete campaign
        CampaignService::delete_campaign(&pool, &campaign.id)
            .await
            .unwrap();

        // Verify steps, recipients, and anti_ban_config
        let steps_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM campaign_steps WHERE campaign_id = ?")
            .bind(&campaign.id)
            .fetch_one(&pool)
            .await
            .unwrap();

        let rec_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = ?")
            .bind(&campaign.id)
            .fetch_one(&pool)
            .await
            .unwrap();

        assert_eq!(steps_count.0, 0, "Steps must be deleted on campaign cascade delete");
        assert_eq!(rec_count.0, 0, "Recipients must be deleted on campaign cascade delete");
    }
}
