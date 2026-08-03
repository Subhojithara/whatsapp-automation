use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    pub id: String,
    pub jid: String,
    pub name: Option<String>,
    pub is_group: bool,
    pub last_message_body: Option<String>,
    pub last_message_at: Option<String>,
    pub unread_count: i64,
    pub session_id: String,
    pub created_at: String,
    pub updated_at: String,
}
