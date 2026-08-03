use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CampaignTemplate {
    pub id: String,
    pub name: String,
    pub category: Option<String>,
    pub body_text: String,
    pub variables_json: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTemplateRequest {
    pub name: String,
    pub category: Option<String>,
    #[serde(alias = "body", alias = "content", alias = "text", alias = "body_text")]
    pub body_text: String,
    pub variables: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub category: Option<String>,
    #[serde(alias = "body", alias = "content", alias = "text", alias = "body_text")]
    pub body_text: Option<String>,
    pub variables: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateResponse {
    pub id: String,
    pub name: String,
    pub category: Option<String>,
    pub body_text: String,
    pub variables: Option<Vec<String>>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<CampaignTemplate> for TemplateResponse {
    fn from(t: CampaignTemplate) -> Self {
        let vars = t
            .variables_json
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());
        TemplateResponse {
            id: t.id,
            name: t.name,
            category: t.category,
            body_text: t.body_text,
            variables: vars,
            created_at: t.created_at,
            updated_at: t.updated_at,
        }
    }
}
