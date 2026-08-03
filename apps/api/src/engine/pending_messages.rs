use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{oneshot, Mutex};

#[derive(Debug)]
pub enum MessageResult {
    Sent { external_id: Option<String> },
    Failed { error: String },
}

#[derive(Clone, Default)]
pub struct PendingMessages {
    senders: Arc<Mutex<HashMap<String, oneshot::Sender<MessageResult>>>>,
}

impl PendingMessages {
    pub fn new() -> Self {
        Self {
            senders: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn register(&self, message_id: String) -> oneshot::Receiver<MessageResult> {
        let (tx, rx) = oneshot::channel();
        let mut senders = self.senders.lock().await;
        senders.insert(message_id, tx);
        rx
    }

    pub async fn resolve(&self, message_id: &str, result: MessageResult) -> bool {
        let mut senders = self.senders.lock().await;
        if let Some(tx) = senders.remove(message_id) {
            let _ = tx.send(result);
            true
        } else {
            false
        }
    }
}
