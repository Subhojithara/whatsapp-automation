use crate::errors::AppError;
use crate::models::campaign::*;
use crate::services::blacklist_service::BlacklistService;
use crate::services::contact_service::ContactService;
use calamine::{Data, Reader, Xlsx};
use chrono::Utc;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::io::Cursor;
use uuid::Uuid;

pub struct CampaignService;

impl CampaignService {
    pub async fn create_campaign(
        pool: &SqlitePool,
        req: CreateCampaignDto,
    ) -> Result<CampaignResponse, AppError> {
        let campaign_id = format!("cmp_{}", Uuid::new_v4());
        let config_id = format!("abc_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        let cfg = req.anti_ban_config.unwrap_or(CreateAntiBanConfigDto {
            min_delay_sec: Some(5),
            max_delay_sec: Some(15),
            typing_duration_sec: Some(2),
            enable_spintax: Some(true),
            working_hours_start: Some("00:00".to_string()),
            working_hours_end: Some("23:59".to_string()),
            timezone: Some("Asia/Kolkata".to_string()),
            max_messages_per_session_per_day: Some(100),
            warmup_enabled: Some(true),
        });

        // Insert anti-ban config
        sqlx::query(
            r#"
            INSERT INTO campaign_anti_ban_config (
                id, campaign_id, min_delay_sec, max_delay_sec, typing_duration_sec,
                enable_spintax, working_hours_start, working_hours_end, timezone,
                max_messages_per_session_per_day, warmup_enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&config_id)
        .bind(&campaign_id)
        .bind(cfg.min_delay_sec.unwrap_or(5))
        .bind(cfg.max_delay_sec.unwrap_or(15))
        .bind(cfg.typing_duration_sec.unwrap_or(2))
        .bind(if cfg.enable_spintax.unwrap_or(true) { 1 } else { 0 })
        .bind(cfg.working_hours_start.as_deref().unwrap_or("09:00"))
        .bind(cfg.working_hours_end.as_deref().unwrap_or("18:00"))
        .bind(cfg.timezone.as_deref().unwrap_or("UTC"))
        .bind(cfg.max_messages_per_session_per_day.unwrap_or(100))
        .bind(if cfg.warmup_enabled.unwrap_or(true) { 1 } else { 0 })
        .execute(pool)
        .await?;

        // Insert campaign
        sqlx::query(
            r#"
            INSERT INTO campaigns (
                id, name, status, anti_ban_config_id, total_recipients,
                sent_count, delivered_count, read_count, replied_count, failed_count,
                created_at, updated_at
            ) VALUES (?, ?, 'DRAFT', ?, 0, 0, 0, 0, 0, 0, ?, ?)
            "#,
        )
        .bind(&campaign_id)
        .bind(&req.name)
        .bind(&config_id)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        // Insert steps if provided
        if let Some(steps) = req.steps {
            for step in steps {
                let step_id = format!("stp_{}", Uuid::new_v4());
                sqlx::query(
                    r#"
                    INSERT INTO campaign_steps (
                        id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    "#,
                )
                .bind(&step_id)
                .bind(&campaign_id)
                .bind(step.step_number)
                .bind(step.delay_after_previous_sec.unwrap_or(0))
                .bind(&step.template_text)
                .bind(&step.media_url)
                .execute(pool)
                .await?;
            }
        }

        // Insert recipients if provided directly
        if let Some(recipients) = req.recipients {
            if !recipients.is_empty() {
                let import_req = ImportRecipientsRequest { recipients };
                let _ = Self::import_recipients_json(pool, &campaign_id, import_req).await?;
            }
        }

        Self::get_campaign(pool, &campaign_id).await
    }

    pub async fn get_campaign(
        pool: &SqlitePool,
        id: &str,
    ) -> Result<CampaignResponse, AppError> {
        let campaign = sqlx::query_as::<_, Campaign>(
            "SELECT id, name, status, anti_ban_config_id, total_recipients, sent_count, delivered_count, read_count, replied_count, failed_count, created_at, updated_at FROM campaigns WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::CampaignNotFound(id.to_string()))?;

        let anti_ban_config = if let Some(ref config_id) = campaign.anti_ban_config_id {
            sqlx::query_as::<_, CampaignAntiBanConfig>(
                "SELECT id, campaign_id, min_delay_sec, max_delay_sec, typing_duration_sec, enable_spintax, working_hours_start, working_hours_end, timezone, max_messages_per_session_per_day, warmup_enabled FROM campaign_anti_ban_config WHERE id = ?",
            )
            .bind(config_id)
            .fetch_optional(pool)
            .await?
            .map(AntiBanConfigResponse::from)
        } else {
            None
        };

        let steps = sqlx::query_as::<_, CampaignStep>(
            "SELECT id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url FROM campaign_steps WHERE campaign_id = ? ORDER BY step_number ASC",
        )
        .bind(id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(StepResponse::from)
        .collect();

        Ok(CampaignResponse {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            anti_ban_config_id: campaign.anti_ban_config_id,
            anti_ban_config,
            total_recipients: campaign.total_recipients,
            sent_count: campaign.sent_count,
            delivered_count: campaign.delivered_count,
            read_count: campaign.read_count,
            replied_count: campaign.replied_count,
            failed_count: campaign.failed_count,
            created_at: campaign.created_at,
            updated_at: campaign.updated_at,
            steps,
        })
    }

    pub async fn list_campaigns(
        pool: &SqlitePool,
        status: Option<String>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<CampaignResponse>, AppError> {
        let campaigns = if let Some(ref st) = status {
            sqlx::query_as::<_, Campaign>(
                "SELECT id, name, status, anti_ban_config_id, total_recipients, sent_count, delivered_count, read_count, replied_count, failed_count, created_at, updated_at FROM campaigns WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            )
            .bind(st)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        } else {
            sqlx::query_as::<_, Campaign>(
                "SELECT id, name, status, anti_ban_config_id, total_recipients, sent_count, delivered_count, read_count, replied_count, failed_count, created_at, updated_at FROM campaigns ORDER BY created_at DESC LIMIT ? OFFSET ?",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        };

        let mut responses = Vec::with_capacity(campaigns.len());
        for c in campaigns {
            responses.push(Self::get_campaign(pool, &c.id).await?);
        }
        Ok(responses)
    }

    pub async fn update_campaign(
        pool: &SqlitePool,
        id: &str,
        req: UpdateCampaignDto,
    ) -> Result<CampaignResponse, AppError> {
        let existing = Self::get_campaign(pool, id).await?;
        let now = Utc::now().to_rfc3339();

        if let Some(name) = req.name {
            sqlx::query("UPDATE campaigns SET name = ?, updated_at = ? WHERE id = ?")
                .bind(&name)
                .bind(&now)
                .bind(id)
                .execute(pool)
                .await?;
        }

        if let Some(cfg) = req.anti_ban_config {
            if let Some(config_id) = existing.anti_ban_config_id {
                sqlx::query(
                    r#"
                    UPDATE campaign_anti_ban_config SET
                        min_delay_sec = COALESCE(?, min_delay_sec),
                        max_delay_sec = COALESCE(?, max_delay_sec),
                        typing_duration_sec = COALESCE(?, typing_duration_sec),
                        enable_spintax = COALESCE(?, enable_spintax),
                        working_hours_start = COALESCE(?, working_hours_start),
                        working_hours_end = COALESCE(?, working_hours_end),
                        timezone = COALESCE(?, timezone),
                        max_messages_per_session_per_day = COALESCE(?, max_messages_per_session_per_day),
                        warmup_enabled = COALESCE(?, warmup_enabled)
                    WHERE id = ?
                    "#,
                )
                .bind(cfg.min_delay_sec)
                .bind(cfg.max_delay_sec)
                .bind(cfg.typing_duration_sec)
                .bind(cfg.enable_spintax.map(|b| if b { 1 } else { 0 }))
                .bind(cfg.working_hours_start)
                .bind(cfg.working_hours_end)
                .bind(cfg.timezone)
                .bind(cfg.max_messages_per_session_per_day)
                .bind(cfg.warmup_enabled.map(|b| if b { 1 } else { 0 }))
                .bind(&config_id)
                .execute(pool)
                .await?;
            }
        }

        if let Some(steps) = req.steps {
            sqlx::query("DELETE FROM campaign_steps WHERE campaign_id = ?")
                .bind(id)
                .execute(pool)
                .await?;

            for step in steps {
                let step_id = format!("stp_{}", Uuid::new_v4());
                sqlx::query(
                    r#"
                    INSERT INTO campaign_steps (
                        id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    "#,
                )
                .bind(&step_id)
                .bind(id)
                .bind(step.step_number)
                .bind(step.delay_after_previous_sec.unwrap_or(0))
                .bind(&step.template_text)
                .bind(&step.media_url)
                .execute(pool)
                .await?;
            }
        }

        Self::get_campaign(pool, id).await
    }

    pub async fn delete_campaign(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
        let res = sqlx::query("DELETE FROM campaigns WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        if res.rows_affected() == 0 {
            return Err(AppError::CampaignNotFound(id.to_string()));
        }
        Ok(())
    }

    pub async fn start_campaign(pool: &SqlitePool, id: &str) -> Result<CampaignResponse, AppError> {
        let now = Utc::now().to_rfc3339();
        let res = sqlx::query("UPDATE campaigns SET status = 'RUNNING', updated_at = ? WHERE id = ? AND status IN ('DRAFT', 'PAUSED')")
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await?;

        // Only reset next_scheduled_at for unstarted PENDING recipients on Step 1 (do NOT wipe SCHEDULED follow-up times)
        let _ = sqlx::query("UPDATE campaign_recipients SET next_scheduled_at = NULL WHERE campaign_id = ? AND status = 'PENDING' AND current_step = 1")
            .bind(id)
            .execute(pool)
            .await;

        if res.rows_affected() == 0 {
            let c = Self::get_campaign(pool, id).await?;
            if c.status != "RUNNING" {
                return Err(AppError::InvalidStateTransition {
                    from: c.status,
                    to: "RUNNING".to_string(),
                });
            }
        }
        Self::get_campaign(pool, id).await
    }

    pub async fn pause_campaign(pool: &SqlitePool, id: &str) -> Result<CampaignResponse, AppError> {
        let now = Utc::now().to_rfc3339();
        let res = sqlx::query("UPDATE campaigns SET status = 'PAUSED', updated_at = ? WHERE id = ? AND status = 'RUNNING'")
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await?;
        if res.rows_affected() == 0 {
            let c = Self::get_campaign(pool, id).await?;
            if c.status != "PAUSED" {
                return Err(AppError::InvalidStateTransition {
                    from: c.status,
                    to: "PAUSED".to_string(),
                });
            }
        }
        Self::get_campaign(pool, id).await
    }

    pub async fn stop_campaign(pool: &SqlitePool, id: &str) -> Result<CampaignResponse, AppError> {
        let now = Utc::now().to_rfc3339();
        sqlx::query("UPDATE campaigns SET status = 'STOPPED', updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await?;

        sqlx::query("UPDATE campaign_recipients SET status = 'CANCELLED' WHERE campaign_id = ? AND status IN ('PENDING', 'SCHEDULED', 'SENDING')")
            .bind(id)
            .execute(pool)
            .await?;

        Self::get_campaign(pool, id).await
    }

    pub async fn retry_failed_recipients(pool: &SqlitePool, id: &str) -> Result<u64, AppError> {
        let now = Utc::now().to_rfc3339();
        let res = sqlx::query("UPDATE campaign_recipients SET status = 'PENDING' WHERE campaign_id = ? AND status = 'FAILED'")
            .bind(id)
            .execute(pool)
            .await?;

        let count = res.rows_affected();
        if count > 0 {
            sqlx::query("UPDATE campaigns SET status = 'RUNNING', updated_at = ? WHERE id = ?")
                .bind(&now)
                .bind(id)
                .execute(pool)
                .await?;
        }

        Ok(count)
    }

    pub async fn clone_campaign(pool: &SqlitePool, id: &str) -> Result<CampaignResponse, AppError> {
        let source = Self::get_campaign(pool, id).await?;
        let new_campaign_id = format!("cmp_{}", Uuid::new_v4());
        let new_config_id = format!("abc_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        if let Some(cfg) = source.anti_ban_config {
            sqlx::query(
                r#"
                INSERT INTO campaign_anti_ban_config (
                    id, campaign_id, min_delay_sec, max_delay_sec, typing_duration_sec,
                    enable_spintax, working_hours_start, working_hours_end, timezone,
                    max_messages_per_session_per_day, warmup_enabled
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&new_config_id)
            .bind(&new_campaign_id)
            .bind(cfg.min_delay_sec)
            .bind(cfg.max_delay_sec)
            .bind(cfg.typing_duration_sec)
            .bind(if cfg.enable_spintax { 1 } else { 0 })
            .bind(&cfg.working_hours_start)
            .bind(&cfg.working_hours_end)
            .bind(&cfg.timezone)
            .bind(cfg.max_messages_per_session_per_day)
            .bind(if cfg.warmup_enabled { 1 } else { 0 })
            .execute(pool)
            .await?;
        }

        sqlx::query(
            r#"
            INSERT INTO campaigns (
                id, name, status, anti_ban_config_id, total_recipients,
                sent_count, delivered_count, read_count, replied_count, failed_count,
                created_at, updated_at
            ) VALUES (?, ?, 'DRAFT', ?, 0, 0, 0, 0, 0, 0, ?, ?)
            "#,
        )
        .bind(&new_campaign_id)
        .bind(format!("{} (Copy)", source.name))
        .bind(&new_config_id)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        for step in source.steps {
            let step_id = format!("stp_{}", Uuid::new_v4());
            sqlx::query(
                r#"
                INSERT INTO campaign_steps (
                    id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url
                ) VALUES (?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&step_id)
            .bind(&new_campaign_id)
            .bind(step.step_number)
            .bind(step.delay_after_previous_sec)
            .bind(&step.template_text)
            .bind(&step.media_url)
            .execute(pool)
            .await?;
        }

        Self::get_campaign(pool, &new_campaign_id).await
    }

    pub async fn import_recipients_json(
        pool: &SqlitePool,
        campaign_id: &str,
        req: ImportRecipientsRequest,
    ) -> Result<ImportSummaryResponse, AppError> {
        let mut total_imported = 0;
        let mut skipped_blacklisted = 0;
        let mut invalid_numbers = 0;

        for item in req.recipients {
            let (phone_number, jid) = match ContactService::normalize_phone_number(&item.phone_number) {
                Ok(res) => res,
                Err(_) => {
                    invalid_numbers += 1;
                    continue;
                }
            };

            if BlacklistService::check(pool, &phone_number).await? {
                skipped_blacklisted += 1;
                continue;
            }

            let rec_id = format!("rcp_{}", Uuid::new_v4());
            let vars_json = item.custom_variables.map(|v| v.to_string());

            let res = sqlx::query(
                r#"
                INSERT INTO campaign_recipients (
                    id, campaign_id, phone_number, jid, custom_variables_json, current_step, status
                ) VALUES (?, ?, ?, ?, ?, 1, 'PENDING')
                ON CONFLICT(campaign_id, phone_number) DO NOTHING
                "#,
            )
            .bind(&rec_id)
            .bind(campaign_id)
            .bind(&phone_number)
            .bind(&jid)
            .bind(&vars_json)
            .execute(pool)
            .await?;

            if res.rows_affected() > 0 {
                total_imported += 1;
            }
        }

        // Update campaign total recipients count
        sqlx::query(
            "UPDATE campaigns SET total_recipients = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = ?) WHERE id = ?",
        )
        .bind(campaign_id)
        .bind(campaign_id)
        .execute(pool)
        .await?;

        Ok(ImportSummaryResponse {
            total_imported,
            skipped_blacklisted,
            invalid_numbers,
        })
    }

    pub async fn import_recipients_csv(
        pool: &SqlitePool,
        campaign_id: &str,
        csv_data: &[u8],
    ) -> Result<ImportSummaryResponse, AppError> {
        let mut rdr = csv::Reader::from_reader(csv_data);
        let headers = rdr
            .headers()
            .map_err(|e| AppError::ImportError(e.to_string()))?
            .clone();

        let phone_col_idx = headers.iter().position(|h| {
            let lower = h.to_lowercase();
            lower == "phone_number" || lower == "phone" || lower == "mobile" || lower == "number"
        }).unwrap_or(0);

        let mut items = Vec::new();
        for result in rdr.records() {
            let record = result.map_err(|e| AppError::ImportError(e.to_string()))?;
            if let Some(phone_val) = record.get(phone_col_idx) {
                let mut vars = HashMap::new();
                for (idx, field) in record.iter().enumerate() {
                    if idx != phone_col_idx {
                        if let Some(header_name) = headers.get(idx) {
                            vars.insert(header_name.to_string(), field.to_string());
                        }
                    }
                }
                let vars_value = if vars.is_empty() {
                    None
                } else {
                    Some(serde_json::to_value(vars).unwrap())
                };

                items.push(RecipientImportItem {
                    phone_number: phone_val.to_string(),
                    custom_variables: vars_value,
                });
            }
        }

        Self::import_recipients_json(
            pool,
            campaign_id,
            ImportRecipientsRequest { recipients: items },
        )
        .await
    }

fn cell_data_to_string(cell: &Data) -> String {
    match cell {
        Data::String(s) => s.trim().to_string(),
        Data::Float(f) => {
            if f.fract() == 0.0 {
                format!("{:.0}", f)
            } else {
                f.to_string()
            }
        }
        Data::Int(i) => i.to_string(),
        Data::Bool(b) => b.to_string(),
        Data::DateTime(dt) => dt.to_string(),
        Data::DateTimeIso(s) => s.clone(),
        Data::DurationIso(s) => s.clone(),
        Data::Error(e) => format!("{:?}", e),
        Data::Empty => String::new(),
    }
}

    pub async fn import_recipients_xlsx(
        pool: &SqlitePool,
        campaign_id: &str,
        xlsx_data: &[u8],
    ) -> Result<ImportSummaryResponse, AppError> {
        let cursor = Cursor::new(xlsx_data);
        let mut workbook: Xlsx<_> = calamine::open_workbook_from_rs(cursor)
            .map_err(|e: calamine::XlsxError| AppError::ImportError(e.to_string()))?;

        let range: calamine::Range<Data> = workbook
            .worksheet_range_at(0)
            .ok_or_else(|| AppError::ImportError("XLSX workbook has no sheets".to_string()))?
            .map_err(|e: calamine::XlsxError| AppError::ImportError(e.to_string()))?;

        let mut rows = range.rows();
        let headers_row: &[Data] = match rows.next() {
            Some(row) => row,
            None => {
                return Ok(ImportSummaryResponse {
                    total_imported: 0,
                    skipped_blacklisted: 0,
                    invalid_numbers: 0,
                })
            }
        };

        let headers: Vec<String> = headers_row
            .iter()
            .map(|cell: &Data| Self::cell_data_to_string(cell))
            .collect();

        let phone_col_idx = headers.iter().position(|h: &String| {
            let lower = h.to_lowercase();
            lower == "phone_number" || lower == "phone" || lower == "mobile" || lower == "number"
        }).unwrap_or(0);

        let mut items = Vec::new();
        for row in rows {
            let row_slice: &[Data] = row;
            if let Some(phone_cell) = row_slice.get(phone_col_idx) {
                let phone_val = Self::cell_data_to_string(phone_cell);
                if phone_val.is_empty() {
                    continue;
                }

                let mut vars: HashMap<String, String> = HashMap::new();
                for (idx, cell) in row_slice.iter().enumerate() {
                    if idx != phone_col_idx {
                        if let Some(header_name) = headers.get(idx) {
                            vars.insert(header_name.clone(), Self::cell_data_to_string(cell));
                        }
                    }
                }

                let vars_value = if vars.is_empty() {
                    None
                } else {
                    Some(serde_json::to_value(vars).unwrap())
                };

                items.push(RecipientImportItem {
                    phone_number: phone_val,
                    custom_variables: vars_value,
                });
            }
        }

        Self::import_recipients_json(
            pool,
            campaign_id,
            ImportRecipientsRequest { recipients: items },
        )
        .await
    }

    pub async fn list_recipients(
        pool: &SqlitePool,
        campaign_id: &str,
    ) -> Result<Vec<RecipientResponse>, AppError> {
        let rows = sqlx::query_as::<_, CampaignRecipient>(
            "SELECT id, campaign_id, phone_number, jid, custom_variables_json, current_step, status, next_scheduled_at, last_sent_at FROM campaign_recipients WHERE campaign_id = ? ORDER BY phone_number ASC"
        )
        .bind(campaign_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(RecipientResponse::from).collect())
    }

    pub async fn list_logs(
        pool: &SqlitePool,
        campaign_id: &str,
    ) -> Result<Vec<CampaignLogResponse>, AppError> {
        let rows = sqlx::query(
            r#"SELECT cl.id, cl.recipient_id, cr.phone_number, cs.step_number, 
                COALESCE(cl.message_body, '') as message_body, cl.status, cl.error_message, cl.sent_at
                FROM campaign_logs cl
                JOIN campaign_recipients cr ON cr.id = cl.recipient_id
                JOIN campaign_steps cs ON cs.id = cl.step_id
                WHERE cl.campaign_id = ?
                ORDER BY cl.sent_at DESC"#
        )
        .bind(campaign_id)
        .fetch_all(pool)
        .await?;

        use sqlx::Row;
        Ok(rows.into_iter().map(|row| CampaignLogResponse {
            id: row.get("id"),
            recipient_id: row.get("recipient_id"),
            phone_number: row.get("phone_number"),
            step_number: row.get("step_number"),
            message_body: row.get("message_body"),
            status: row.get("status"),
            error_message: row.get("error_message"),
            sent_at: row.get("sent_at"),
        }).collect())
    }

    pub async fn update_recipient(
        pool: &SqlitePool,
        campaign_id: &str,
        recipient_id: &str,
        dto: UpdateRecipientDto,
    ) -> Result<RecipientResponse, AppError> {
        // Verify recipient belongs to campaign
        let _existing = sqlx::query_as::<_, CampaignRecipient>(
            "SELECT id, campaign_id, phone_number, jid, custom_variables_json, current_step, status, next_scheduled_at, last_sent_at FROM campaign_recipients WHERE id = ? AND campaign_id = ?"
        )
        .bind(recipient_id)
        .bind(campaign_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::InvalidRecipient("Recipient not found".to_string()))?;

        if let Some(vars) = &dto.custom_variables_json {
            let vars_str = serde_json::to_string(vars).unwrap_or_default();
            sqlx::query("UPDATE campaign_recipients SET custom_variables_json = ? WHERE id = ?")
                .bind(&vars_str)
                .bind(recipient_id)
                .execute(pool)
                .await?;
        }

        if let Some(next_at) = &dto.next_scheduled_at {
            sqlx::query("UPDATE campaign_recipients SET next_scheduled_at = ? WHERE id = ?")
                .bind(next_at)
                .bind(recipient_id)
                .execute(pool)
                .await?;
        }

        // Fetch updated record
        let updated = sqlx::query_as::<_, CampaignRecipient>(
            "SELECT id, campaign_id, phone_number, jid, custom_variables_json, current_step, status, next_scheduled_at, last_sent_at FROM campaign_recipients WHERE id = ?"
        )
        .bind(recipient_id)
        .fetch_one(pool)
        .await?;

        Ok(RecipientResponse::from(updated))
    }
}
