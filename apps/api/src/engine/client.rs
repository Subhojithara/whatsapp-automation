use crate::engine::protocol::{EngineCommand, EngineEvent};
use crate::errors::AppError;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{mpsc, Mutex};

pub struct EngineClient {
    pub session_id: String,
    stdin: Arc<Mutex<ChildStdin>>,
    _child: Arc<Mutex<Child>>,
}

impl EngineClient {
    pub async fn spawn(
        session_id: String,
        auth_dir: String,
        engine_script_path: String,
        event_sender: mpsc::Sender<EngineEvent>,
    ) -> Result<Self, AppError> {
        tracing::info!(session_id = %session_id, "Spawning WhatsApp engine process...");

        let engine_dir = std::path::Path::new(&engine_script_path)
            .parent()
            .and_then(|p| p.parent())
            .unwrap_or_else(|| std::path::Path::new("."));

        let mut child = Command::new("node")
            .current_dir(engine_dir)
            .arg(&engine_script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| AppError::InternalError(format!("Failed to spawn engine: {}", e)))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| AppError::InternalError("Failed to capture engine stdin".to_string()))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AppError::InternalError("Failed to capture engine stdout".to_string()))?;

        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| AppError::InternalError("Failed to capture engine stderr".to_string()))?;

        // Stderr reader task (forward engine logs to Rust tracing)
        let session_id_err = session_id.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                tracing::info!(session_id = %session_id_err, "[Node STDERR] {}", line);
            }
        });

        // Stdout reader task (parse JSON-line events from engine)
        let session_id_out = session_id.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                match serde_json::from_str::<EngineEvent>(trimmed) {
                    Ok(event) => {
                        let _ = event_sender.send(event).await;
                    }
                    Err(err) => {
                        tracing::warn!(
                            session_id = %session_id_out,
                            error = %err,
                            line = %trimmed,
                            "Failed to parse engine event JSON"
                        );
                    }
                }
            }
            tracing::info!(session_id = %session_id_out, "Engine stdout stream ended");
        });

        let client = Self {
            session_id: session_id.clone(),
            stdin: Arc::new(Mutex::new(stdin)),
            _child: Arc::new(Mutex::new(child)),
        };

        // Automatically send engine.start command upon spawning
        let start_cmd = EngineCommand::Start {
            session_id: session_id.clone(),
            auth_dir,
            v: 1,
        };
        client.send_command(&start_cmd).await?;

        Ok(client)
    }

    pub async fn send_command(&self, cmd: &EngineCommand) -> Result<(), AppError> {
        let json_line = serde_json::to_string(cmd)
            .map_err(|e| AppError::InternalError(format!("Failed to serialize command: {}", e)))?
            + "\n";

        tracing::info!(session_id = %self.session_id, cmd = %json_line.trim(), "Writing command to engine stdin");

        let mut stdin = self.stdin.lock().await;
        stdin
            .write_all(json_line.as_bytes())
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to write to engine stdin: {}", e)))?;
        stdin
            .flush()
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to flush engine stdin: {}", e)))?;

        Ok(())
    }

    pub async fn request_pairing_code(&self, phone_number: &str) -> Result<(), AppError> {
        let cmd = EngineCommand::RequestPairingCode {
            session_id: self.session_id.clone(),
            phone_number: phone_number.to_string(),
            v: 1,
        };
        self.send_command(&cmd).await
    }

    pub async fn send_text(
        &self,
        chat_id: &str,
        text: &str,
        message_id: &str,
    ) -> Result<(), AppError> {
        let cmd = EngineCommand::SendText {
            session_id: self.session_id.clone(),
            chat_id: chat_id.to_string(),
            text: text.to_string(),
            message_id: message_id.to_string(),
            v: 1,
        };
        self.send_command(&cmd).await
    }

    pub async fn send_media(
        &self,
        chat_id: &str,
        media_type: &str,
        media_url: &str,
        caption: Option<&str>,
        file_name: Option<&str>,
        mimetype: Option<&str>,
        message_id: &str,
    ) -> Result<(), AppError> {
        let cmd = EngineCommand::SendMedia {
            session_id: self.session_id.clone(),
            chat_id: chat_id.to_string(),
            media_type: media_type.to_string(),
            media_url: media_url.to_string(),
            caption: caption.map(|s| s.to_string()),
            file_name: file_name.map(|s| s.to_string()),
            mimetype: mimetype.map(|s| s.to_string()),
            message_id: message_id.to_string(),
            v: 1,
        };
        self.send_command(&cmd).await
    }

    pub async fn get_contacts(&self) -> Result<(), AppError> {
        let cmd = EngineCommand::GetContacts {
            session_id: self.session_id.clone(),
            v: 1,
        };
        self.send_command(&cmd).await
    }

    pub async fn get_chats(&self) -> Result<(), AppError> {
        let cmd = EngineCommand::GetChats {
            session_id: self.session_id.clone(),
            v: 1,
        };
        self.send_command(&cmd).await
    }

    pub async fn get_profile_picture(&self, jid: &str) -> Result<(), AppError> {
        let cmd = EngineCommand::GetProfilePicture {
            session_id: self.session_id.clone(),
            jid: jid.to_string(),
            v: 1,
        };
        self.send_command(&cmd).await
    }

    pub async fn get_chat_messages(
        &self,
        jid: &str,
        limit: Option<u32>,
    ) -> Result<(), AppError> {
        let cmd = EngineCommand::GetChatMessages {
            session_id: self.session_id.clone(),
            jid: jid.to_string(),
            limit,
            v: 1,
        };
        self.send_command(&cmd).await
    }

    pub async fn validate_phones(&self, phone_numbers: Vec<String>) -> Result<(), AppError> {
        let cmd = EngineCommand::ValidatePhones {
            session_id: self.session_id.clone(),
            phone_numbers,
            v: 1,
        };
        self.send_command(&cmd).await
    }

    pub async fn simulate_presence(
        &self,
        jid: &str,
        state: &str,
        duration_ms: Option<u64>,
    ) -> Result<(), AppError> {
        let cmd = EngineCommand::SimulatePresence {
            session_id: self.session_id.clone(),
            jid: jid.to_string(),
            state: state.to_string(),
            duration_ms,
            v: 1,
        };
        self.send_command(&cmd).await
    }

    pub async fn is_alive(&self) -> bool {
        let mut child = self._child.lock().await;
        match child.try_wait() {
            Ok(None) => true,
            _ => false,
        }
    }

    pub async fn stop(&self) -> Result<(), AppError> {
        let cmd = EngineCommand::Stop {
            session_id: self.session_id.clone(),
            v: 1,
        };
        self.send_command(&cmd).await
    }
}


