use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Contact {
    pub id: String,
    pub jid: String,
    pub name: Option<String>,
    pub phone_number: Option<String>,
    pub avatar_url: Option<String>,
    pub is_group: bool,
    pub session_id: String,
    pub synced_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContactDto {
    pub phone_number: String,
    pub name: Option<String>,
}
