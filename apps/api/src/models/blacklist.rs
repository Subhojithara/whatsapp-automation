use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BlacklistItem {
    pub id: String,
    pub phone_number: String,
    pub reason: Option<String>,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddBlacklistRequest {
    pub phone_number: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlacklistResponse {
    pub id: String,
    pub phone_number: String,
    pub reason: Option<String>,
    pub added_at: String,
}

impl From<BlacklistItem> for BlacklistResponse {
    fn from(b: BlacklistItem) -> Self {
        BlacklistResponse {
            id: b.id,
            phone_number: b.phone_number,
            reason: b.reason,
            added_at: b.added_at,
        }
    }
}
