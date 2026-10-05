use crate::engine::manager::EngineManager;
use crate::engine::protocol::IncomingMessage;
use crate::errors::AppError;
use crate::models::campaign::{CampaignAntiBanConfig, CampaignRecipient, CampaignStep};
use crate::services::account_health_service::{AccountHealthService, SafetyCheckResult};
use crate::services::blacklist_service::BlacklistService;
use crate::services::contact_service::ContactService;
use crate::services::spintax_service::SpintaxResolver;
use crate::services::warmup_service::WarmupManager;
use crate::services::working_hours_service::WorkingHoursService;
use chrono::{Duration, Utc};
use rand::Rng;
use sqlx::SqlitePool;
use std::time::Duration as StdDuration;
use uuid::Uuid;

pub struct CampaignWorker;

impl CampaignWorker {
    pub fn start_campaign_worker(pool: SqlitePool, engine_manager: EngineManager) {
        tokio::spawn(async move {
            tracing::info!("Campaign worker loop started.");
            loop {
                if let Err(err) = Self::process_campaigns(&pool, &engine_manager).await {
                    tracing::error!("Error in campaign worker loop: {}", err);
                }
                tokio::time::sleep(StdDuration::from_secs(3)).await;
            }
        });
    }

    pub async fn process_campaigns(
        pool: &SqlitePool,
        engine_manager: &EngineManager,
    ) -> Result<(), AppError> {
        let active_campaign_ids: Vec<(String,)> =
            sqlx::query_as("SELECT id FROM campaigns WHERE status = 'RUNNING'")
                .fetch_all(pool)
                .await?;

        if active_campaign_ids.is_empty() {
            return Ok(());
        }

        let ready_session_ids: Vec<(String,)> =
            sqlx::query_as("SELECT id FROM sessions WHERE status = 'READY'")
                .fetch_all(pool)
                .await?;

        for (campaign_id,) in active_campaign_ids {
            let config = sqlx::query_as::<_, CampaignAntiBanConfig>(
                "SELECT id, campaign_id, min_delay_sec, max_delay_sec, typing_duration_sec, enable_spintax, working_hours_start, working_hours_end, timezone, max_messages_per_session_per_day, warmup_enabled FROM campaign_anti_ban_config WHERE campaign_id = ?",
            )
            .bind(&campaign_id)
            .fetch_optional(pool)
            .await?
            .unwrap_or(CampaignAntiBanConfig {
                id: format!("abc_{}", Uuid::new_v4()),
                campaign_id: campaign_id.clone(),
                min_delay_sec: 5,
                max_delay_sec: 15,
                typing_duration_sec: 2,
                enable_spintax: 1,
                working_hours_start: "00:00".to_string(),
                working_hours_end: "23:59".to_string(),
                timezone: "Asia/Kolkata".to_string(),
                max_messages_per_session_per_day: 100,
                warmup_enabled: 1,
            });

            // Check working hours
            if !WorkingHoursService::is_within_working_hours(
                &config.working_hours_start,
                &config.working_hours_end,
                &config.timezone,
            ) {
                let next_utc = WorkingHoursService::calculate_next_working_window_utc(
                    &config.working_hours_start,
                    &config.timezone,
                );
                let next_str = next_utc.to_rfc3339();
                let now_str = Utc::now().to_rfc3339();

                sqlx::query(
                    r#"
                    UPDATE campaign_recipients
                    SET next_scheduled_at = ?
                    WHERE campaign_id = ?
                      AND status IN ('PENDING', 'SCHEDULED')
                      AND (next_scheduled_at IS NULL OR next_scheduled_at <= ?)
                    "#,
                )
                .bind(&next_str)
                .bind(&campaign_id)
                .bind(&now_str)
                .execute(pool)
                .await?;

                continue;
            }

            let now_str = Utc::now().to_rfc3339();
            let due_recipients = sqlx::query_as::<_, CampaignRecipient>(
                r#"
                SELECT id, campaign_id, phone_number, jid, custom_variables_json, current_step, status, next_scheduled_at, last_sent_at
                FROM campaign_recipients
                WHERE campaign_id = ?
                  AND status IN ('PENDING', 'SCHEDULED')
                  AND (next_scheduled_at IS NULL OR next_scheduled_at <= ?)
                ORDER BY current_step ASC
                LIMIT 50
                "#,
            )
            .bind(&campaign_id)
            .bind(&now_str)
            .fetch_all(pool)
            .await?;

            if due_recipients.is_empty() {
                // Check if campaign is finished
                let active_recipients_count: (i64,) = sqlx::query_as(
                    "SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = ? AND status IN ('PENDING', 'SCHEDULED', 'SENDING')",
                )
                .bind(&campaign_id)
                .fetch_one(pool)
                .await?;

                if active_recipients_count.0 == 0 {
                    let now = Utc::now().to_rfc3339();
                    sqlx::query("UPDATE campaigns SET status = 'COMPLETED', updated_at = ? WHERE id = ? AND status = 'RUNNING'")
                        .bind(&now)
                        .bind(&campaign_id)
                        .execute(pool)
                        .await?;
                }
                continue;
            }

            if ready_session_ids.is_empty() {
                tracing::warn!(campaign_id = %campaign_id, "No READY session available to dispatch campaign messages");
                continue;
            }

            let mut session_index = 0;

            for recipient in due_recipients {
                // Immediate halt check: verify campaign is still RUNNING before each recipient
                let current_campaign_status: Option<(String,)> = sqlx::query_as(
                    "SELECT status FROM campaigns WHERE id = ?",
                )
                .bind(&campaign_id)
                .fetch_optional(pool)
                .await?;

                if let Some((status,)) = current_campaign_status {
                    if status != "RUNNING" {
                        tracing::info!(
                            campaign_id = %campaign_id,
                            status = %status,
                            "Campaign is no longer RUNNING (now {}). Halting recipient loop immediately.",
                            status
                        );
                        break;
                    }
                } else {
                    break;
                }

                // Check blacklist
                if BlacklistService::check(pool, &recipient.phone_number).await? {
                    let log_id = format!("log_{}", Uuid::new_v4());
                    let now = Utc::now().to_rfc3339();

                    sqlx::query("UPDATE campaign_recipients SET status = 'BLACKLISTED' WHERE id = ?")
                        .bind(&recipient.id)
                        .execute(pool)
                        .await?;

                    // Get step ID if available
                    let step: Option<CampaignStep> = sqlx::query_as(
                        "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps WHERE campaign_id = ? AND step_number = ?",
                    )
                    .bind(&campaign_id)
                    .bind(recipient.current_step)
                    .fetch_optional(pool)
                    .await?;

                    let step = match step {
                        Some(s) => Some(s),
                        None => {
                            let fallback_campaign_step = sqlx::query_as::<_, CampaignStep>(
                                "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps WHERE campaign_id = ? ORDER BY step_number ASC LIMIT 1",
                            )
                            .bind(&campaign_id)
                            .fetch_optional(pool)
                            .await?;

                            if fallback_campaign_step.is_some() {
                                fallback_campaign_step
                            } else {
                                sqlx::query_as::<_, CampaignStep>(
                                    "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps ORDER BY step_number ASC LIMIT 1",
                                )
                                .fetch_optional(pool)
                                .await?
                            }
                        }
                    };

                    if let Some(step) = step {
                        if let Err(err) = sqlx::query(
                            r#"
                            INSERT INTO campaign_logs (id, campaign_id, recipient_id, step_id, session_id, status, error_message, sent_at)
                            VALUES (?, ?, ?, ?, NULL, 'BLACKLISTED', 'Recipient phone number is in global blacklist', ?)
                            "#,
                        )
                        .bind(&log_id)
                        .bind(&campaign_id)
                        .bind(&recipient.id)
                        .bind(&step.id)
                        .bind(&now)
                        .execute(pool)
                        .await
                        {
                            tracing::error!(
                                recipient_id = %recipient.id,
                                campaign_id = %campaign_id,
                                error = %err,
                                "Failed to insert BLACKLISTED audit log into campaign_logs"
                            );
                        }
                    } else {
                        tracing::warn!(
                            recipient_id = %recipient.id,
                            campaign_id = %campaign_id,
                            "No step found in campaign_steps to link BLACKLISTED audit log"
                        );
                    }

                    sqlx::query("UPDATE campaigns SET failed_count = failed_count + 1, updated_at = ? WHERE id = ?")
                        .bind(&now)
                        .bind(&campaign_id)
                        .execute(pool)
                        .await?;

                    continue;
                }

                // Fetch step definition
                let step: Option<CampaignStep> = sqlx::query_as(
                    "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps WHERE campaign_id = ? AND step_number = ?",
                )
                .bind(&campaign_id)
                .bind(recipient.current_step)
                .fetch_optional(pool)
                .await?;

                let step = match step {
                    Some(s) => s,
                    None => {
                        sqlx::query("UPDATE campaign_recipients SET status = 'COMPLETED' WHERE id = ?")
                            .bind(&recipient.id)
                            .execute(pool)
                            .await?;
                        continue;
                    }
                };

                // Deduplication check in campaign_logs
                let sent_log_exists: (i64,) = sqlx::query_as(
                    "SELECT COUNT(*) FROM campaign_logs WHERE recipient_id = ? AND step_id = ? AND status = 'SENT'",
                )
                .bind(&recipient.id)
                .bind(&step.id)
                .fetch_one(pool)
                .await?;

                if sent_log_exists.0 > 0 {
                    let next_step: Option<CampaignStep> = sqlx::query_as(
                        "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps WHERE campaign_id = ? AND step_number = ?",
                    )
                    .bind(&campaign_id)
                    .bind(recipient.current_step + 1)
                    .fetch_optional(pool)
                    .await?;

                    if let Some(next_s) = next_step {
                        let now = Utc::now();
                        let next_sched = (now + Duration::seconds(next_s.delay_after_previous_sec)).to_rfc3339();
                        sqlx::query(
                            "UPDATE campaign_recipients SET current_step = current_step + 1, status = 'SCHEDULED', next_scheduled_at = ? WHERE id = ?",
                        )
                        .bind(&next_sched)
                        .bind(&recipient.id)
                        .execute(pool)
                        .await?;
                    } else {
                        sqlx::query("UPDATE campaign_recipients SET status = 'COMPLETED' WHERE id = ?")
                            .bind(&recipient.id)
                            .execute(pool)
                            .await?;
                    }
                    continue;
                }

                // Pick an available session that hasn't exceeded warmup limit and has safe health metrics
                let mut chosen_session_id = None;
                let mut chosen_delay_multiplier = 1.0;

                for _ in 0..ready_session_ids.len() {
                    let sess_id = &ready_session_ids[session_index % ready_session_ids.len()].0;
                    session_index += 1;

                    if !WarmupManager::can_send_message(
                        pool,
                        sess_id,
                        config.max_messages_per_session_per_day,
                        config.warmup_enabled != 0,
                    )
                    .await?
                    {
                        continue;
                    }

                    match AccountHealthService::check_dispatch_safety(pool, sess_id).await? {
                        SafetyCheckResult::Proceed { delay_multiplier } => {
                            chosen_session_id = Some(sess_id.clone());
                            chosen_delay_multiplier = delay_multiplier;
                            break;
                        }
                        SafetyCheckResult::PauseForCooldown { reason, unreplied_streak } => {
                            tracing::warn!(
                                session_id = %sess_id,
                                streak = unreplied_streak,
                                campaign_id = %campaign_id,
                                "Session temporarily skipped for outreach safety: {}",
                                reason
                            );
                        }
                    }
                }

                let session_id = match chosen_session_id {
                    Some(s) => s,
                    None => {
                        tracing::warn!(
                            campaign_id = %campaign_id,
                            "All READY sessions have reached daily limits or require anti-ban cooldown"
                        );
                        break; // Break out of recipient loop for this campaign iteration
                    }
                };

                // Spintax & Variable resolution (supports per-recipient custom messages from CSV/Excel)
                let custom_vars_json: Option<serde_json::Value> = recipient
                    .custom_variables_json
                    .as_deref()
                    .and_then(|s| serde_json::from_str(s).ok());

                let per_recipient_custom_msg = custom_vars_json.as_ref().and_then(|v| {
                    if let Some(obj) = v.as_object() {
                        // 1. Explicit internal step key
                        let step_key = format!("__step_{}_message", step.step_number);
                        if let Some(msg) = obj.get(&step_key).and_then(|m| m.as_str()).filter(|m| !m.trim().is_empty()) {
                            return Some(msg.to_string());
                        }

                        // 2. Dynamic column name matching based on step.step_number
                        let possible_keys: Vec<&str> = match step.step_number {
                            1 => vec!["Message", "Initial Message", "Step 1", "Message 1", "Initial"],
                            2 => vec!["1st Follow", "1st Followup", "1st Follow-up", "Follow 1", "Followup 1", "Step 2"],
                            3 => vec!["2nd Follow", "2nd Followup", "2nd Follow-up", "Follow 2", "Followup 2", "Step 3"],
                            4 => vec!["3rd Follow", "3rd Followup", "3rd Follow-up", "Follow 3", "Followup 3", "Step 4"],
                            5 => vec!["4th Follow", "4th Followup", "4th Follow-up", "Follow 4", "Followup 4", "Step 5"],
                            6 => vec!["5th Follow", "5th Followup", "5th Follow-up", "Follow 5", "Followup 5", "Step 6"],
                            _ => vec![],
                        };

                        for k in possible_keys {
                            if let Some(msg) = obj.get(k).and_then(|m| m.as_str()).filter(|m| !m.trim().is_empty()) {
                                return Some(msg.to_string());
                            }
                        }
                    }
                    None
                });

                let template_to_use = per_recipient_custom_msg.as_deref().unwrap_or(&step.template_text);

                let body = if config.enable_spintax != 0 {
                    SpintaxResolver::resolve(template_to_use, custom_vars_json.as_ref())
                } else {
                    SpintaxResolver::interpolate_variables(template_to_use, custom_vars_json.as_ref())
                };

                // Anti-ban delay jitter with micro-variance & dynamic throttle multiplier
                if config.max_delay_sec > 0 && config.max_delay_sec >= config.min_delay_sec {
                    let total_delay_ms = {
                        let mut rng = rand::thread_rng();
                        let min_ms = (config.min_delay_sec * 1000) as u64;
                        let max_ms = (config.max_delay_sec * 1000) as u64;
                        let raw_ms = rng.gen_range(min_ms..=max_ms);
                        let micro_jitter = rng.gen_range(100..=900);
                        ((raw_ms + micro_jitter) as f64 * chosen_delay_multiplier) as u64
                    };
                    if total_delay_ms > 0 {
                        tokio::time::sleep(StdDuration::from_millis(total_delay_ms)).await;
                    }
                }

                // Presence typing simulation (natural human typing speed proportional to body length)
                if config.typing_duration_sec > 0 {
                    let char_count = body.chars().count();
                    let think_pause_ms = rand::thread_rng().gen_range(300..=800);
                    tokio::time::sleep(StdDuration::from_millis(think_pause_ms)).await;

                    let typing_duration_ms = {
                        let mut rng = rand::thread_rng();
                        let char_ms = (char_count as u64) * 28;
                        let jitter_ms = rng.gen_range(400..=1200);
                        let calculated_ms = char_ms + jitter_ms;

                        let max_bound = (config.typing_duration_sec * 1000).max(4500) as u64;
                        calculated_ms.clamp(1200, max_bound)
                    };

                    let _ = engine_manager
                        .simulate_presence(
                            &session_id,
                            &recipient.jid,
                            "composing",
                            Some(typing_duration_ms),
                        )
                        .await;
                    tokio::time::sleep(StdDuration::from_millis(typing_duration_ms)).await;
                }

                // Verify campaign is still RUNNING right before dispatching the message (in case user paused during anti-ban delay)
                let current_campaign_status_before_send: Option<(String,)> = sqlx::query_as(
                    "SELECT status FROM campaigns WHERE id = ?",
                )
                .bind(&campaign_id)
                .fetch_optional(pool)
                .await?;

                if let Some((status,)) = current_campaign_status_before_send {
                    if status != "RUNNING" {
                        tracing::info!(
                            campaign_id = %campaign_id,
                            status = %status,
                            "Campaign is no longer RUNNING (now {}). Aborting message dispatch to {}.",
                            status,
                            recipient.phone_number
                        );
                        break;
                    }
                } else {
                    break;
                }

                // Execute sending
                let message_id = format!("msg_{}", Uuid::new_v4());
                let send_res = if let Some(ref media_url) = step.media_url {
                    engine_manager
                        .send_media(
                            &session_id,
                            &recipient.jid,
                            "image",
                            media_url,
                            Some(&body),
                            None,
                            None,
                            &message_id,
                        )
                        .await
                } else {
                    engine_manager
                        .send_text(&session_id, &recipient.jid, &body, &message_id)
                        .await
                };

                let log_id = format!("log_{}", Uuid::new_v4());
                let now = Utc::now();
                let now_str = now.to_rfc3339();

                match send_res {
                    Ok(_) => {
                        // Record log
                        sqlx::query(
                            r#"
                            INSERT INTO campaign_logs (id, campaign_id, recipient_id, step_id, session_id, status, error_message, sent_at, message_body)
                            VALUES (?, ?, ?, ?, ?, 'SENT', NULL, ?, ?)
                            "#,
                        )
                        .bind(&log_id)
                        .bind(&campaign_id)
                        .bind(&recipient.id)
                        .bind(&step.id)
                        .bind(&session_id)
                        .bind(&now_str)
                        .bind(&body)
                        .execute(pool)
                        .await?;

                        // Ensure contact, message history, and chat UI entries are updated
                        let cnt_id = format!("cnt_{}_{}", session_id, recipient.jid);
                        let recipient_name = custom_vars_json
                            .as_ref()
                            .and_then(|v| v.get("Name").or_else(|| v.get("name")))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());

                        let _ = sqlx::query(
                            r#"
                            INSERT INTO contacts (id, jid, name, phone_number, avatar_url, is_group, session_id, synced_at, created_at, updated_at)
                            VALUES (?, ?, ?, ?, NULL, 0, ?, ?, ?, ?)
                            ON CONFLICT(session_id, jid) DO UPDATE SET
                                phone_number = COALESCE(excluded.phone_number, contacts.phone_number),
                                name = COALESCE(excluded.name, contacts.name),
                                updated_at = excluded.updated_at
                            "#,
                        )
                        .bind(&cnt_id)
                        .bind(&recipient.jid)
                        .bind(&recipient_name)
                        .bind(&recipient.phone_number)
                        .bind(&session_id)
                        .bind(&now_str)
                        .bind(&now_str)
                        .bind(&now_str)
                        .execute(pool)
                        .await;

                        let msg_id = format!("msg_{}", Uuid::new_v4());
                        let _ = sqlx::query(
                            r#"
                            INSERT INTO messages (id, external_id, session_id, chat_id, direction, message_type, body, media_url, status, created_at, updated_at, sender_jid, from_me)
                            VALUES (?, ?, ?, ?, 'outgoing', 'text', ?, ?, 'SENT', ?, ?, NULL, 1)
                            "#,
                        )
                        .bind(&msg_id)
                        .bind(&message_id)
                        .bind(&session_id)
                        .bind(&recipient.jid)
                        .bind(&body)
                        .bind(&step.media_url)
                        .bind(&now_str)
                        .bind(&now_str)
                        .execute(pool)
                        .await;

                        let _ = crate::services::chat_service::ChatService::update_chat_last_message(
                            pool,
                            &session_id,
                            &recipient.jid,
                            &body,
                            &now_str,
                            false,
                        )
                        .await;

                        // Check if next step exists and schedule it using the next step's delay_after_previous_sec
                        let next_step: Option<CampaignStep> = sqlx::query_as(
                            "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps WHERE campaign_id = ? AND step_number = ?",
                        )
                        .bind(&campaign_id)
                        .bind(recipient.current_step + 1)
                        .fetch_optional(pool)
                        .await?;

                        if let Some(next_s) = next_step {
                            let next_sched = (now + Duration::seconds(next_s.delay_after_previous_sec))
                                .to_rfc3339();
                            sqlx::query(
                                r#"
                                UPDATE campaign_recipients
                                SET current_step = current_step + 1,
                                    status = 'SCHEDULED',
                                    next_scheduled_at = ?,
                                    last_sent_at = ?
                                WHERE id = ?
                                "#,
                            )
                            .bind(&next_sched)
                            .bind(&now_str)
                            .bind(&recipient.id)
                            .execute(pool)
                            .await?;
                        } else {
                            sqlx::query(
                                r#"
                                UPDATE campaign_recipients
                                SET status = 'COMPLETED',
                                    last_sent_at = ?
                                WHERE id = ?
                                "#,
                            )
                            .bind(&now_str)
                            .bind(&recipient.id)
                            .execute(pool)
                            .await?;
                        }

                        sqlx::query("UPDATE campaigns SET sent_count = sent_count + 1, updated_at = ? WHERE id = ?")
                            .bind(&now_str)
                            .bind(&campaign_id)
                            .execute(pool)
                            .await?;
                    }
                    Err(err) => {
                        let err_msg = err.to_string();
                        sqlx::query(
                            r#"
                            INSERT INTO campaign_logs (id, campaign_id, recipient_id, step_id, session_id, status, error_message, sent_at, message_body)
                            VALUES (?, ?, ?, ?, ?, 'FAILED', ?, ?, ?)
                            "#,
                        )
                        .bind(&log_id)
                        .bind(&campaign_id)
                        .bind(&recipient.id)
                        .bind(&step.id)
                        .bind(&session_id)
                        .bind(&err_msg)
                        .bind(&now_str)
                        .bind(&body)
                        .execute(pool)
                        .await?;

                        sqlx::query(
                            r#"
                            UPDATE campaign_recipients
                            SET status = 'FAILED',
                                last_sent_at = ?
                            WHERE id = ?
                            "#,
                        )
                        .bind(&now_str)
                        .bind(&recipient.id)
                        .execute(pool)
                        .await?;

                        sqlx::query("UPDATE campaigns SET failed_count = failed_count + 1, updated_at = ? WHERE id = ?")
                            .bind(&now_str)
                            .bind(&campaign_id)
                            .execute(pool)
                            .await?;
                    }
                }
            }
        }

        Ok(())
    }

    pub async fn handle_incoming_reply(
        pool: &SqlitePool,
        _session_id: &str,
        incoming_msg: &IncomingMessage,
    ) -> Result<bool, AppError> {
        let sender = &incoming_msg.sender_jid;
        let (normalized_phone, _) = ContactService::normalize_phone_number(sender)
            .unwrap_or_else(|_| (sender.trim().to_string(), "".to_string()));

        let recipients = sqlx::query_as::<_, CampaignRecipient>(
            r#"
            SELECT id, campaign_id, phone_number, jid, custom_variables_json, current_step, status, next_scheduled_at, last_sent_at
            FROM campaign_recipients
            WHERE (jid = ? OR phone_number = ? OR phone_number = ?)
              AND status IN ('PENDING', 'SCHEDULED', 'SENDING')
            "#,
        )
        .bind(sender)
        .bind(sender)
        .bind(&normalized_phone)
        .fetch_all(pool)
        .await?;

        if recipients.is_empty() {
            return Ok(false);
        }

        let now = Utc::now().to_rfc3339();

        for r in recipients {
            sqlx::query("UPDATE campaign_recipients SET status = 'REPLIED' WHERE id = ?")
                .bind(&r.id)
                .execute(pool)
                .await?;

            let step: Option<CampaignStep> = sqlx::query_as(
                "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps WHERE campaign_id = ? AND step_number = ?",
            )
            .bind(&r.campaign_id)
            .bind(r.current_step)
            .fetch_optional(pool)
            .await?;

            let step = match step {
                Some(s) => Some(s),
                None => {
                    let fallback_step = if r.current_step > 1 {
                        sqlx::query_as::<_, CampaignStep>(
                            "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps WHERE campaign_id = ? AND step_number = ?",
                        )
                        .bind(&r.campaign_id)
                        .bind(r.current_step - 1)
                        .fetch_optional(pool)
                        .await?
                    } else {
                        None
                    };

                    if fallback_step.is_some() {
                        fallback_step
                    } else {
                        let campaign_first_step = sqlx::query_as::<_, CampaignStep>(
                            "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps WHERE campaign_id = ? ORDER BY step_number ASC LIMIT 1",
                        )
                        .bind(&r.campaign_id)
                        .fetch_optional(pool)
                        .await?;

                        if campaign_first_step.is_some() {
                            campaign_first_step
                        } else {
                            sqlx::query_as::<_, CampaignStep>(
                                "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps ORDER BY step_number ASC LIMIT 1",
                            )
                            .fetch_optional(pool)
                            .await?
                        }
                    }
                }
            };

            if let Some(step) = step {
                let log_id = format!("log_{}", Uuid::new_v4());
                if let Err(err) = sqlx::query(
                    r#"
                    INSERT INTO campaign_logs (id, campaign_id, recipient_id, step_id, session_id, status, error_message, sent_at)
                    VALUES (?, ?, ?, ?, ?, 'REPLIED', 'Recipient replied to campaign message', ?)
                    "#,
                )
                .bind(&log_id)
                .bind(&r.campaign_id)
                .bind(&r.id)
                .bind(&step.id)
                .bind(_session_id)
                .bind(&now)
                .execute(pool)
                .await
                {
                    tracing::error!(
                        recipient_id = %r.id,
                        campaign_id = %r.campaign_id,
                        error = %err,
                        "Failed to insert REPLIED audit log into campaign_logs"
                    );
                }
            } else {
                tracing::warn!(
                    recipient_id = %r.id,
                    campaign_id = %r.campaign_id,
                    "No valid step found in campaign_steps to link REPLIED audit log"
                );
            }

            sqlx::query("UPDATE campaigns SET replied_count = replied_count + 1, updated_at = ? WHERE id = ?")
                .bind(&now)
                .bind(&r.campaign_id)
                .execute(pool)
                .await?;
        }

        Ok(true)
    }
}
