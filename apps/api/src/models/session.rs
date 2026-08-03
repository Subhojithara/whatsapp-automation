use crate::state_machine::SessionStatus;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub name: String,
    pub engine: String,
    pub status: String,
    pub phone_number: Option<String>,
    pub display_name: Option<String>,
    pub last_error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_connected_at: Option<String>,
    pub last_disconnected_at: Option<String>,
}

impl Session {
    pub fn parsed_status(&self) -> SessionStatus {
        SessionStatus::parse_str(&self.status).unwrap_or(SessionStatus::Failed)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionDto {
    pub name: String,
    pub engine: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub id: String,
    pub name: String,
    pub engine: String,
    pub status: SessionStatus,
    pub phone_number: Option<String>,
    pub display_name: Option<String>,
    pub last_error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_connected_at: Option<String>,
    pub last_disconnected_at: Option<String>,
}

impl From<Session> for SessionResponse {
    fn from(s: Session) -> Self {
        let status = s.parsed_status();
        SessionResponse {
            id: s.id,
            name: s.name,
            engine: s.engine,
            status,
            phone_number: s.phone_number,
            display_name: s.display_name,
            last_error: s.last_error,
            created_at: s.created_at,
            updated_at: s.updated_at,
            last_connected_at: s.last_connected_at,
            last_disconnected_at: s.last_disconnected_at,
        }
    }
}
