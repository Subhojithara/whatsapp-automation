use crate::engine::protocol::ContactData;
use crate::errors::AppError;
use crate::models::contact::{Contact, CreateContactDto};
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

pub struct ContactService;

impl ContactService {
    pub fn normalize_phone_number(phone: &str) -> Result<(String, String), AppError> {
        let trimmed = phone.trim();
        if trimmed.is_empty() {
            return Err(AppError::ValidationError(
                "Phone number cannot be empty".to_string(),
            ));
        }

        let mut digits: String = trimmed.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.starts_with('0') {
            digits = digits.trim_start_matches('0').to_string();
        }

        let digits_with_cc = if digits.len() == 10 {
            format!("91{}", digits)
        } else if digits.len() >= 11 && digits.len() <= 15 {
            digits
        } else {
            return Err(AppError::ValidationError(format!(
                "Invalid phone number '{}'. Must contain 10 digits (for India default) or 11-15 digits with country code.",
                phone
            )));
        };

        let jid = format!("{}@s.whatsapp.net", digits_with_cc);
        Ok((digits_with_cc, jid))
    }

    pub async fn upsert_contacts(
        pool: &SqlitePool,
        session_id: &str,
        contacts: &[ContactData],
    ) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();
        for c in contacts {
            let contact_id = format!("cnt_{}_{}", session_id, c.jid);
            sqlx::query(
                r#"
                INSERT INTO contacts (id, jid, name, phone_number, avatar_url, is_group, session_id, synced_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id, jid) DO UPDATE SET
                    name = COALESCE(excluded.name, contacts.name),
                    phone_number = COALESCE(excluded.phone_number, contacts.phone_number),
                    avatar_url = COALESCE(excluded.avatar_url, contacts.avatar_url),
                    is_group = excluded.is_group,
                    synced_at = excluded.synced_at,
                    updated_at = excluded.updated_at
                "#,
            )
            .bind(&contact_id)
            .bind(&c.jid)
            .bind(&c.name)
            .bind(&c.phone_number)
            .bind(&c.avatar_url)
            .bind(c.is_group)
            .bind(session_id)
            .bind(&now)
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await?;
        }
        Ok(())
    }

    pub async fn update_avatar_url(
        pool: &SqlitePool,
        session_id: &str,
        jid: &str,
        avatar_url: Option<&str>,
    ) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();
        let _ = sqlx::query(
            "UPDATE contacts SET avatar_url = ?, updated_at = ? WHERE session_id = ? AND jid = ?",
        )
        .bind(avatar_url)
        .bind(&now)
        .bind(session_id)
        .bind(jid)
        .execute(pool)
        .await;

        let _ = sqlx::query(
            "UPDATE chats SET avatar_url = ?, updated_at = ? WHERE session_id = ? AND jid = ?",
        )
        .bind(avatar_url)
        .bind(&now)
        .bind(session_id)
        .bind(jid)
        .execute(pool)
        .await;

        Ok(())
    }

    pub async fn list_contacts(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<Vec<Contact>, AppError> {
        let contacts = sqlx::query_as::<_, Contact>(
            r#"
            SELECT id, jid, name, phone_number, avatar_url, is_group, session_id, synced_at, created_at, updated_at
            FROM contacts
            WHERE session_id = ?
            ORDER BY COALESCE(NULLIF(name, ''), jid) ASC
            "#,
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        Ok(contacts)
    }

    pub async fn search_contacts(
        pool: &SqlitePool,
        session_id: &str,
        query: &str,
    ) -> Result<Vec<Contact>, AppError> {
        let pattern = format!("%{}%", query.trim());
        let contacts = sqlx::query_as::<_, Contact>(
            r#"
            SELECT id, jid, name, phone_number, avatar_url, is_group, session_id, synced_at, created_at, updated_at
            FROM contacts
            WHERE session_id = ?
              AND (name LIKE ? OR phone_number LIKE ? OR jid LIKE ?)
            ORDER BY COALESCE(NULLIF(name, ''), jid) ASC
            "#,
        )
        .bind(session_id)
        .bind(&pattern)
        .bind(&pattern)
        .bind(&pattern)
        .fetch_all(pool)
        .await?;

        Ok(contacts)
    }

    pub async fn create_manual_contact(
        pool: &SqlitePool,
        session_id: &str,
        dto: CreateContactDto,
    ) -> Result<Contact, AppError> {
        let (phone_number, jid) = Self::normalize_phone_number(&dto.phone_number)?;
        let contact_id = format!("cnt_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let name = dto.name.filter(|n| !n.trim().is_empty());

        let contact = sqlx::query_as::<_, Contact>(
            r#"
            INSERT INTO contacts (id, jid, name, phone_number, avatar_url, is_group, session_id, synced_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, 0, ?, ?, ?, ?)
            ON CONFLICT(session_id, jid) DO UPDATE SET
                name = COALESCE(excluded.name, contacts.name),
                phone_number = excluded.phone_number,
                updated_at = excluded.updated_at
            RETURNING id, jid, name, phone_number, avatar_url, is_group, session_id, synced_at, created_at, updated_at
            "#,
        )
        .bind(&contact_id)
        .bind(&jid)
        .bind(&name)
        .bind(&phone_number)
        .bind(session_id)
        .bind(&now)
        .bind(&now)
        .bind(&now)
        .fetch_one(pool)
        .await?;

        // Initialize corresponding chat entry so the contact immediately shows up in the Chat UI list
        let _ = crate::services::chat_service::ChatService::update_chat_last_message(
            pool,
            session_id,
            &contact.jid,
            "",
            &now,
            false,
        )
        .await;

        Ok(contact)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_phone_number_10_digits() {
        let (phone, jid) = ContactService::normalize_phone_number("9876543210").unwrap();
        assert_eq!(phone, "919876543210");
        assert_eq!(jid, "919876543210@s.whatsapp.net");
    }

    #[test]
    fn test_normalize_phone_number_with_country_code() {
        let (phone, jid) = ContactService::normalize_phone_number("+91 98765 43210").unwrap();
        assert_eq!(phone, "919876543210");
        assert_eq!(jid, "919876543210@s.whatsapp.net");
    }

    #[test]
    fn test_normalize_phone_number_leading_zero() {
        let (phone, jid) = ContactService::normalize_phone_number("09876543210").unwrap();
        assert_eq!(phone, "919876543210");
        assert_eq!(jid, "919876543210@s.whatsapp.net");
    }

    #[test]
    fn test_normalize_phone_number_invalid() {
        assert!(ContactService::normalize_phone_number("123").is_err());
        assert!(ContactService::normalize_phone_number("").is_err());
    }

    #[tokio::test]
    async fn test_contact_service_db_operations() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();

        // Create dummy session
        sqlx::query("INSERT INTO sessions (id, name) VALUES ('sess_1', 'Test Session')")
            .execute(&pool)
            .await
            .unwrap();

        // 1. Manual Contact Creation
        let created = ContactService::create_manual_contact(
            &pool,
            "sess_1",
            CreateContactDto {
                phone_number: "9876543210".to_string(),
                name: Some("Alice".to_string()),
            },
        )
        .await
        .unwrap();

        assert_eq!(created.phone_number, Some("919876543210".to_string()));
        assert_eq!(created.name, Some("Alice".to_string()));
        assert_eq!(created.jid, "919876543210@s.whatsapp.net");

        // 2. List Contacts
        let list = ContactService::list_contacts(&pool, "sess_1").await.unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, Some("Alice".to_string()));

        // 3. Search Contacts
        let search_res = ContactService::search_contacts(&pool, "sess_1", "Ali").await.unwrap();
        assert_eq!(search_res.len(), 1);

        let search_empty = ContactService::search_contacts(&pool, "sess_1", "Bob").await.unwrap();
        assert_eq!(search_empty.len(), 0);

        // 4. Upsert Contacts from Engine
        let engine_contacts = vec![ContactData {
            jid: "919876543210@s.whatsapp.net".to_string(),
            name: Some("Alice Updated".to_string()),
            phone_number: Some("919876543210".to_string()),
            avatar_url: None,
            is_group: false,
        }];
        ContactService::upsert_contacts(&pool, "sess_1", &engine_contacts).await.unwrap();

        let list_updated = ContactService::list_contacts(&pool, "sess_1").await.unwrap();
        assert_eq!(list_updated[0].name, Some("Alice Updated".to_string()));
    }
}
