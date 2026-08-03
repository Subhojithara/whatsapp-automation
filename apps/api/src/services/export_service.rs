use crate::errors::AppError;
use crate::models::campaign::CampaignRecipient;
use rust_xlsxwriter::{Format, Workbook};
use sqlx::SqlitePool;

pub struct ExportService;

impl ExportService {
    pub async fn export_csv(pool: &SqlitePool, campaign_id: &str) -> Result<Vec<u8>, AppError> {
        let recipients = sqlx::query_as::<_, CampaignRecipient>(
            r#"
            SELECT id, campaign_id, phone_number, jid, custom_variables_json, current_step, status, next_scheduled_at, last_sent_at
            FROM campaign_recipients
            WHERE campaign_id = ?
            ORDER BY phone_number ASC
            "#,
        )
        .bind(campaign_id)
        .fetch_all(pool)
        .await?;

        let mut wtr = csv::Writer::from_writer(Vec::new());
        wtr.write_record(&[
            "Phone Number",
            "JID",
            "Status",
            "Current Step",
            "Last Sent At",
            "Custom Variables",
        ])
        .map_err(|e| AppError::ExportError(e.to_string()))?;

        for r in recipients {
            wtr.write_record(&[
                &r.phone_number,
                &r.jid,
                &r.status,
                &r.current_step.to_string(),
                r.last_sent_at.as_deref().unwrap_or(""),
                r.custom_variables_json.as_deref().unwrap_or(""),
            ])
            .map_err(|e| AppError::ExportError(e.to_string()))?;
        }

        let data = wtr
            .into_inner()
            .map_err(|e| AppError::ExportError(e.to_string()))?;

        Ok(data)
    }

    pub async fn export_xlsx(pool: &SqlitePool, campaign_id: &str) -> Result<Vec<u8>, AppError> {
        let recipients = sqlx::query_as::<_, CampaignRecipient>(
            r#"
            SELECT id, campaign_id, phone_number, jid, custom_variables_json, current_step, status, next_scheduled_at, last_sent_at
            FROM campaign_recipients
            WHERE campaign_id = ?
            ORDER BY phone_number ASC
            "#,
        )
        .bind(campaign_id)
        .fetch_all(pool)
        .await?;

        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();

        let header_format = Format::new().set_bold();

        let headers = [
            "Phone Number",
            "JID",
            "Status",
            "Current Step",
            "Last Sent At",
            "Custom Variables",
        ];

        for (col_idx, &h) in headers.iter().enumerate() {
            worksheet
                .write_string_with_format(0, col_idx as u16, h, &header_format)
                .map_err(|e| AppError::ExportError(e.to_string()))?;
        }

        for (row_idx, r) in recipients.iter().enumerate() {
            let row = (row_idx + 1) as u32;
            worksheet
                .write_string(row, 0, &r.phone_number)
                .map_err(|e| AppError::ExportError(e.to_string()))?;
            worksheet
                .write_string(row, 1, &r.jid)
                .map_err(|e| AppError::ExportError(e.to_string()))?;
            worksheet
                .write_string(row, 2, &r.status)
                .map_err(|e| AppError::ExportError(e.to_string()))?;
            worksheet
                .write_number(row, 3, r.current_step as f64)
                .map_err(|e| AppError::ExportError(e.to_string()))?;
            worksheet
                .write_string(row, 4, r.last_sent_at.as_deref().unwrap_or(""))
                .map_err(|e| AppError::ExportError(e.to_string()))?;
            worksheet
                .write_string(row, 5, r.custom_variables_json.as_deref().unwrap_or(""))
                .map_err(|e| AppError::ExportError(e.to_string()))?;
        }

        let buf = workbook
            .save_to_buffer()
            .map_err(|e| AppError::ExportError(e.to_string()))?;

        Ok(buf)
    }
}
