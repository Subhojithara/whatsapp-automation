use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CampaignStatus {
    Draft,
    Running,
    Paused,
    Completed,
    Stopped,
    Failed,
}

impl CampaignStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            CampaignStatus::Draft => "DRAFT",
            CampaignStatus::Running => "RUNNING",
            CampaignStatus::Paused => "PAUSED",
            CampaignStatus::Completed => "COMPLETED",
            CampaignStatus::Stopped => "STOPPED",
            CampaignStatus::Failed => "FAILED",
        }
    }

    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "DRAFT" => Some(CampaignStatus::Draft),
            "RUNNING" => Some(CampaignStatus::Running),
            "PAUSED" => Some(CampaignStatus::Paused),
            "COMPLETED" => Some(CampaignStatus::Completed),
            "STOPPED" => Some(CampaignStatus::Stopped),
            "FAILED" => Some(CampaignStatus::Failed),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RecipientStatus {
    Pending,
    Scheduled,
    Sending,
    Sent,
    Delivered,
    Read,
    Replied,
    Failed,
    Blacklisted,
    Cancelled,
}

impl RecipientStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            RecipientStatus::Pending => "PENDING",
            RecipientStatus::Scheduled => "SCHEDULED",
            RecipientStatus::Sending => "SENDING",
            RecipientStatus::Sent => "SENT",
            RecipientStatus::Delivered => "DELIVERED",
            RecipientStatus::Read => "READ",
            RecipientStatus::Replied => "REPLIED",
            RecipientStatus::Failed => "FAILED",
            RecipientStatus::Blacklisted => "BLACKLISTED",
            RecipientStatus::Cancelled => "CANCELLED",
        }
    }

    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "PENDING" => Some(RecipientStatus::Pending),
            "SCHEDULED" => Some(RecipientStatus::Scheduled),
            "SENDING" => Some(RecipientStatus::Sending),
            "SENT" => Some(RecipientStatus::Sent),
            "DELIVERED" => Some(RecipientStatus::Delivered),
            "READ" => Some(RecipientStatus::Read),
            "REPLIED" => Some(RecipientStatus::Replied),
            "FAILED" => Some(RecipientStatus::Failed),
            "BLACKLISTED" => Some(RecipientStatus::Blacklisted),
            "CANCELLED" => Some(RecipientStatus::Cancelled),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Campaign {
    pub id: String,
    pub name: String,
    pub status: String,
    pub anti_ban_config_id: Option<String>,
    pub total_recipients: i64,
    pub sent_count: i64,
    pub delivered_count: i64,
    pub read_count: i64,
    pub replied_count: i64,
    pub failed_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CampaignAntiBanConfig {
    pub id: String,
    pub campaign_id: String,
    pub min_delay_sec: i64,
    pub max_delay_sec: i64,
    pub typing_duration_sec: i64,
    pub enable_spintax: i64,
    pub working_hours_start: String,
    pub working_hours_end: String,
    pub timezone: String,
    pub max_messages_per_session_per_day: i64,
    pub warmup_enabled: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CampaignStep {
    pub id: String,
    pub campaign_id: String,
    pub step_number: i64,
    pub delay_after_previous_sec: i64,
    pub template_text: String,
    pub media_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CampaignRecipient {
    pub id: String,
    pub campaign_id: String,
    pub phone_number: String,
    pub jid: String,
    pub custom_variables_json: Option<String>,
    pub current_step: i64,
    pub status: String,
    pub next_scheduled_at: Option<String>,
    pub last_sent_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CampaignLog {
    pub id: String,
    pub campaign_id: String,
    pub recipient_id: String,
    pub step_id: String,
    pub session_id: Option<String>,
    pub status: String,
    pub error_message: Option<String>,
    pub sent_at: String,
}

// DTOs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAntiBanConfigDto {
    #[serde(alias = "min_delay_sec", alias = "minDelaySecs", alias = "min_delay_secs")]
    pub min_delay_sec: Option<i64>,
    #[serde(alias = "max_delay_sec", alias = "maxDelaySecs", alias = "max_delay_secs")]
    pub max_delay_sec: Option<i64>,
    #[serde(alias = "typing_duration_sec", alias = "typingMinSecs")]
    pub typing_duration_sec: Option<i64>,
    #[serde(alias = "enable_spintax", alias = "spintaxEnabled")]
    pub enable_spintax: Option<bool>,
    #[serde(alias = "working_hours_start")]
    pub working_hours_start: Option<String>,
    #[serde(alias = "working_hours_end")]
    pub working_hours_end: Option<String>,
    #[serde(alias = "timezone", alias = "timezoneAware")]
    pub timezone: Option<String>,
    #[serde(alias = "max_messages_per_session_per_day")]
    pub max_messages_per_session_per_day: Option<i64>,
    #[serde(alias = "warmup_enabled")]
    pub warmup_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStepDto {
    #[serde(alias = "step_number", alias = "stepIndex", alias = "step_index")]
    pub step_number: Option<i64>,
    #[serde(alias = "delay_after_previous_sec", alias = "delaySeconds", alias = "delay_seconds")]
    pub delay_after_previous_sec: Option<i64>,
    #[serde(alias = "template_text", alias = "templateText", alias = "messageTemplate", alias = "message_template", alias = "body", alias = "text")]
    pub template_text: String,
    pub media_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCampaignDto {
    pub name: String,
    pub anti_ban_config: Option<CreateAntiBanConfigDto>,
    pub steps: Option<Vec<CreateStepDto>>,
    pub recipients: Option<Vec<RecipientImportItem>>,
}



#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCampaignDto {
    pub name: Option<String>,
    pub anti_ban_config: Option<CreateAntiBanConfigDto>,
    pub steps: Option<Vec<CreateStepDto>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntiBanConfigResponse {
    pub id: String,
    pub campaign_id: String,
    pub min_delay_sec: i64,
    pub max_delay_sec: i64,
    pub typing_duration_sec: i64,
    pub enable_spintax: bool,
    pub working_hours_start: String,
    pub working_hours_end: String,
    pub timezone: String,
    pub max_messages_per_session_per_day: i64,
    pub warmup_enabled: bool,
}

impl From<CampaignAntiBanConfig> for AntiBanConfigResponse {
    fn from(c: CampaignAntiBanConfig) -> Self {
        AntiBanConfigResponse {
            id: c.id,
            campaign_id: c.campaign_id,
            min_delay_sec: c.min_delay_sec,
            max_delay_sec: c.max_delay_sec,
            typing_duration_sec: c.typing_duration_sec,
            enable_spintax: c.enable_spintax != 0,
            working_hours_start: c.working_hours_start,
            working_hours_end: c.working_hours_end,
            timezone: c.timezone,
            max_messages_per_session_per_day: c.max_messages_per_session_per_day,
            warmup_enabled: c.warmup_enabled != 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepResponse {
    pub id: String,
    pub campaign_id: String,
    pub step_number: i64,
    pub delay_after_previous_sec: i64,
    pub template_text: String,
    pub media_url: Option<String>,
}

impl From<CampaignStep> for StepResponse {
    fn from(s: CampaignStep) -> Self {
        StepResponse {
            id: s.id,
            campaign_id: s.campaign_id,
            step_number: s.step_number,
            delay_after_previous_sec: s.delay_after_previous_sec,
            template_text: s.template_text,
            media_url: s.media_url,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignResponse {
    pub id: String,
    pub name: String,
    pub status: String,
    pub anti_ban_config_id: Option<String>,
    pub anti_ban_config: Option<AntiBanConfigResponse>,
    pub total_recipients: i64,
    pub sent_count: i64,
    pub delivered_count: i64,
    pub read_count: i64,
    pub replied_count: i64,
    pub failed_count: i64,
    pub created_at: String,
    pub updated_at: String,
    pub steps: Vec<StepResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipientResponse {
    pub id: String,
    pub campaign_id: String,
    pub phone_number: String,
    pub jid: String,
    pub custom_variables: Option<serde_json::Value>,
    pub current_step: i64,
    pub status: String,
    pub next_scheduled_at: Option<String>,
    pub last_sent_at: Option<String>,
}

impl From<CampaignRecipient> for RecipientResponse {
    fn from(r: CampaignRecipient) -> Self {
        let vars = r
            .custom_variables_json
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());
        RecipientResponse {
            id: r.id,
            campaign_id: r.campaign_id,
            phone_number: r.phone_number,
            jid: r.jid,
            custom_variables: vars,
            current_step: r.current_step,
            status: r.status,
            next_scheduled_at: r.next_scheduled_at,
            last_sent_at: r.last_sent_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipientImportItem {
    pub phone_number: String,
    pub custom_variables: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRecipientsRequest {
    pub recipients: Vec<RecipientImportItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummaryResponse {
    pub total_imported: usize,
    pub skipped_blacklisted: usize,
    pub invalid_numbers: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignLogResponse {
    pub id: String,
    pub recipient_id: String,
    pub phone_number: String,
    pub step_number: i64,
    pub message_body: String,
    pub status: String,
    pub error_message: Option<String>,
    pub sent_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecipientDto {
    pub custom_variables_json: Option<serde_json::Value>,
    pub next_scheduled_at: Option<String>,
}
