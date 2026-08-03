use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MessageStatus {
    Pending,
    Sent,
    Failed,
    Delivered,
    Read,
}

impl MessageStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            MessageStatus::Pending => "PENDING",
            MessageStatus::Sent => "SENT",
            MessageStatus::Failed => "FAILED",
            MessageStatus::Delivered => "DELIVERED",
            MessageStatus::Read => "READ",
        }
    }

    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "PENDING" => Some(MessageStatus::Pending),
            "SENT" => Some(MessageStatus::Sent),
            "FAILED" => Some(MessageStatus::Failed),
            "DELIVERED" => Some(MessageStatus::Delivered),
            "READ" => Some(MessageStatus::Read),
            _ => None,
        }
    }
}

impl fmt::Display for MessageStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: String,
    pub external_id: Option<String>,
    pub session_id: String,
    pub chat_id: String,
    pub direction: String,
    pub message_type: String,
    pub body: Option<String>,
    pub media_url: Option<String>,
    pub status: String,
    pub error: Option<String>,
    pub created_at: String,
    pub sent_at: Option<String>,
    pub updated_at: String,
    pub sender_jid: Option<String>,
    pub from_me: bool,
}

impl Message {
    pub fn parsed_status(&self) -> MessageStatus {
        MessageStatus::parse_str(&self.status).unwrap_or(MessageStatus::Failed)
    }
}

#[derive(Debug, Deserialize)]
pub struct SendTextRequest {
    pub to: String,
    #[serde(alias = "body")]
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct SendMediaRequest {
    pub to: String,
    #[serde(rename = "mediaType")]
    pub media_type: String,
    #[serde(rename = "mediaUrl")]
    pub media_url: String,
    pub caption: Option<String>,
    #[serde(rename = "fileName")]
    pub file_name: Option<String>,
    pub mimetype: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub id: String,
    pub external_id: Option<String>,
    pub session_id: String,
    pub chat_id: String,
    pub to: String,
    pub direction: String,
    pub sender_jid: Option<String>,
    pub from_me: bool,
    pub type_name: String,
    pub text: Option<String>,
    pub media_url: Option<String>,
    pub status: String,
    pub created_at: String,
    pub sent_at: Option<String>,
    pub error: Option<String>,
}

impl From<Message> for MessageResponse {
    fn from(m: Message) -> Self {
        // Strip @s.whatsapp.net for clean phone number presentation if present
        let clean_to = m.chat_id.trim_end_matches("@s.whatsapp.net").to_string();
        MessageResponse {
            id: m.id,
            external_id: m.external_id,
            session_id: m.session_id,
            chat_id: m.chat_id,
            to: clean_to,
            direction: m.direction,
            sender_jid: m.sender_jid,
            from_me: m.from_me,
            type_name: m.message_type,
            text: m.body,
            media_url: m.media_url,
            status: m.status.to_lowercase(),
            created_at: m.created_at,
            sent_at: m.sent_at,
            error: m.error,
        }
    }
}
