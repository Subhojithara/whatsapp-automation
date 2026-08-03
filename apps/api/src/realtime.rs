use crate::engine::protocol::EngineEvent;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

#[derive(Clone)]
pub struct RealtimeHub {
    tx: broadcast::Sender<EngineEvent>,
    latest_qrs: Arc<RwLock<HashMap<String, String>>>,
    latest_pairing_codes: Arc<RwLock<HashMap<String, String>>>,
}

impl RealtimeHub {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(500);
        Self {
            tx,
            latest_qrs: Arc::new(RwLock::new(HashMap::new())),
            latest_pairing_codes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn publish(&self, event: EngineEvent) {
        let session_id = event.session_id().to_string();

        match &event {
            EngineEvent::Qr { data, .. } => {
                let mut qrs = this_or_that(&self.latest_qrs).write().await;
                qrs.insert(session_id, data.qr.clone());
            }
            EngineEvent::PairingCode { data, .. } => {
                let mut codes = this_or_that(&self.latest_pairing_codes).write().await;
                codes.insert(session_id, data.code.clone());
            }
            EngineEvent::Ready { .. }
            | EngineEvent::Stopped { .. }
            | EngineEvent::Failed { .. } => {
                let mut qrs = self.latest_qrs.write().await;
                qrs.remove(&session_id);
                let mut codes = self.latest_pairing_codes.write().await;
                codes.remove(&session_id);
            }
            _ => {}
        }

        let _ = self.tx.send(event);
    }

    pub async fn get_qr(&self, session_id: &str) -> Option<String> {
        let qrs = self.latest_qrs.read().await;
        qrs.get(session_id).cloned()
    }

    pub async fn get_pairing_code(&self, session_id: &str) -> Option<String> {
        let codes = self.latest_pairing_codes.read().await;
        codes.get(session_id).cloned()
    }

    pub fn subscribe(&self) -> broadcast::Receiver<EngineEvent> {
        self.tx.subscribe()
    }
}

fn this_or_that<T>(val: &T) -> &T {
    val
}
