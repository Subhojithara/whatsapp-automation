use crate::engine::client::EngineClient;
use crate::engine::protocol::EngineEvent;
use crate::errors::AppError;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

#[derive(Clone)]
pub struct EngineManager {
    clients: Arc<RwLock<HashMap<String, Arc<EngineClient>>>>,
    engine_script_path: String,
    event_tx: mpsc::Sender<EngineEvent>,
}

impl EngineManager {
    pub fn new(engine_script_path: String, event_tx: mpsc::Sender<EngineEvent>) -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            engine_script_path,
            event_tx,
        }
    }

    pub async fn start_session(
        &self,
        session_id: String,
        auth_dir: String,
        engine_type: Option<String>,
    ) -> Result<(), AppError> {
        let mut clients = self.clients.write().await;
        if clients.contains_key(&session_id) {
            return Err(AppError::SessionAlreadyRunning(session_id));
        }

        let client = EngineClient::spawn(
            session_id.clone(),
            auth_dir,
            engine_type,
            self.engine_script_path.clone(),
            self.event_tx.clone(),
        )
        .await?;

        clients.insert(session_id, Arc::new(client));
        Ok(())
    }

    pub async fn stop_session(&self, session_id: &str) -> Result<(), AppError> {
        let mut clients = self.clients.write().await;
        if let Some(client) = clients.remove(session_id) {
            let _ = client.stop().await;
        }
        Ok(())
    }

    pub async fn request_pairing_code(
        &self,
        session_id: &str,
        phone_number: &str,
    ) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.request_pairing_code(phone_number).await?;
            Ok(())
        } else {
            Err(AppError::SessionNotFound(session_id.to_string()))
        }
    }

    pub async fn send_text(
        &self,
        session_id: &str,
        chat_id: &str,
        text: &str,
        message_id: &str,
    ) -> Result<(), AppError> {
        let client_opt = {
            let clients = self.clients.read().await;
            clients.get(session_id).cloned()
        };

        if let Some(client) = client_opt {
            if client.is_alive().await {
                client.send_text(chat_id, text, message_id).await
            } else {
                let mut clients = self.clients.write().await;
                clients.remove(session_id);
                Err(AppError::EngineNotAvailable(format!(
                    "Engine process for session {} exited unexpectedly.",
                    session_id
                )))
            }
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }

    pub async fn send_media(
        &self,
        session_id: &str,
        chat_id: &str,
        media_type: &str,
        media_url: &str,
        caption: Option<&str>,
        file_name: Option<&str>,
        mimetype: Option<&str>,
        message_id: &str,
    ) -> Result<(), AppError> {
        let client_opt = {
            let clients = self.clients.read().await;
            clients.get(session_id).cloned()
        };

        if let Some(client) = client_opt {
            if client.is_alive().await {
                client
                    .send_media(chat_id, media_type, media_url, caption, file_name, mimetype, message_id)
                    .await
            } else {
                let mut clients = self.clients.write().await;
                clients.remove(session_id);
                Err(AppError::EngineNotAvailable(format!(
                    "Engine process for session {} exited unexpectedly.",
                    session_id
                )))
            }
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }

    pub async fn get_contacts(&self, session_id: &str) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.get_contacts().await
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }

    pub async fn get_chats(&self, session_id: &str) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.get_chats().await
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }

    pub async fn get_profile_picture(&self, session_id: &str, jid: &str) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.get_profile_picture(jid).await
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }

    pub async fn get_chat_messages(
        &self,
        session_id: &str,
        jid: &str,
        limit: Option<u32>,
    ) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.get_chat_messages(jid, limit).await
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }

    pub async fn validate_phones(
        &self,
        session_id: &str,
        phone_numbers: Vec<String>,
    ) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.validate_phones(phone_numbers).await
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }

    pub async fn simulate_presence(
        &self,
        session_id: &str,
        jid: &str,
        state: &str,
        duration_ms: Option<u64>,
    ) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.simulate_presence(jid, state, duration_ms).await
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }

    pub async fn mark_chat_read(&self, session_id: &str, jid: &str) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.mark_chat_read(jid).await
        } else {
            Ok(())
        }
    }

    pub async fn send_reaction(&self, session_id: &str, chat_id: &str, message_id: &str, emoji: &str) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.send_reaction(chat_id, message_id, emoji).await
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }

    pub async fn is_running(&self, session_id: &str) -> bool {
        let client_opt = {
            let clients = self.clients.read().await;
            clients.get(session_id).cloned()
        };

        if let Some(client) = client_opt {
            if client.is_alive().await {
                true
            } else {
                let mut clients = self.clients.write().await;
                clients.remove(session_id);
                false
            }
        } else {
            false
        }
    }
}


