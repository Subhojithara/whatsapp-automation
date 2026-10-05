use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum EngineCommand {
    #[serde(rename = "engine.start")]
    Start {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "authDir")]
        auth_dir: String,
        #[serde(rename = "engineType", skip_serializing_if = "Option::is_none")]
        engine_type: Option<String>,
        v: u32,
    },
    #[serde(rename = "engine.stop")]
    Stop {
        #[serde(rename = "sessionId")]
        session_id: String,
        v: u32,
    },
    #[serde(rename = "engine.request_pairing_code")]
    RequestPairingCode {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "phoneNumber")]
        phone_number: String,
        v: u32,
    },
    #[serde(rename = "engine.send_text")]
    SendText {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "chatId")]
        chat_id: String,
        text: String,
        #[serde(rename = "messageId")]
        message_id: String,
        v: u32,
    },
    #[serde(rename = "engine.send_media")]
    SendMedia {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "chatId")]
        chat_id: String,
        #[serde(rename = "mediaType")]
        media_type: String,
        #[serde(rename = "mediaUrl")]
        media_url: String,
        caption: Option<String>,
        #[serde(rename = "fileName")]
        file_name: Option<String>,
        mimetype: Option<String>,
        #[serde(rename = "messageId")]
        message_id: String,
        v: u32,
    },
    #[serde(rename = "engine.get_contacts")]
    GetContacts {
        #[serde(rename = "sessionId")]
        session_id: String,
        v: u32,
    },
    #[serde(rename = "engine.get_chats")]
    GetChats {
        #[serde(rename = "sessionId")]
        session_id: String,
        v: u32,
    },
    #[serde(rename = "engine.get_chat_messages")]
    GetChatMessages {
        #[serde(rename = "sessionId")]
        session_id: String,
        jid: String,
        limit: Option<u32>,
        v: u32,
    },
    #[serde(rename = "engine.get_profile_picture")]
    GetProfilePicture {
        #[serde(rename = "sessionId")]
        session_id: String,
        jid: String,
        v: u32,
    },
    #[serde(rename = "engine.validate_phones")]
    ValidatePhones {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "phoneNumbers", alias = "phone_numbers")]
        phone_numbers: Vec<String>,
        v: u32,
    },
    #[serde(rename = "engine.simulate_presence")]
    SimulatePresence {
        #[serde(rename = "sessionId")]
        session_id: String,
        jid: String,
        state: String,
        #[serde(rename = "durationMs", alias = "duration_ms")]
        duration_ms: Option<u64>,
        v: u32,
    },
    #[serde(rename = "engine.mark_chat_read")]
    MarkChatRead {
        #[serde(rename = "sessionId")]
        session_id: String,
        jid: String,
        v: u32,
    },
    #[serde(rename = "engine.send_reaction")]
    SendReaction {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "chatId")]
        chat_id: String,
        #[serde(rename = "messageId")]
        message_id: String,
        emoji: String,
        v: u32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrData {
    pub qr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingCodeData {
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadyData {
    #[serde(rename = "phoneNumber")]
    pub phone_number: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisconnectedData {
    #[serde(rename = "statusCode")]
    pub status_code: Option<u16>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailedData {
    pub error: String,
    #[serde(rename = "statusCode")]
    pub status_code: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageSentData {
    #[serde(rename = "messageId")]
    pub message_id: String,
    #[serde(rename = "externalId")]
    pub external_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageFailedData {
    #[serde(rename = "messageId")]
    pub message_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactData {
    pub jid: String,
    pub name: Option<String>,
    #[serde(rename = "phoneNumber")]
    pub phone_number: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "isGroup")]
    pub is_group: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactsSyncedData {
    pub contacts: Vec<ContactData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatData {
    pub jid: String,
    pub name: Option<String>,
    #[serde(rename = "isGroup")]
    pub is_group: bool,
    #[serde(rename = "lastMessageBody")]
    pub last_message_body: Option<String>,
    #[serde(rename = "lastMessageAt")]
    pub last_message_at: Option<String>,
    #[serde(rename = "unreadCount")]
    pub unread_count: i64,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatsSyncedData {
    pub chats: Vec<ChatData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessagesData {
    pub jid: String,
    pub messages: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomingMessage {
    pub id: String,
    pub jid: String,
    #[serde(rename = "senderJid")]
    pub sender_jid: String,
    pub body: String,
    #[serde(rename = "messageType")]
    pub message_type: Option<String>,
    #[serde(rename = "mediaUrl")]
    pub media_url: Option<String>,
    pub timestamp: String,
    #[serde(rename = "fromMe")]
    pub from_me: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageReceivedData {
    pub message: IncomingMessage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageDeliveryUpdateData {
    #[serde(rename = "externalId")]
    pub external_id: String,
    pub status: String,
    #[serde(rename = "statusCode")]
    pub status_code: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactProfilePictureData {
    pub jid: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhoneValidationResult {
    #[serde(rename = "phoneNumber", alias = "phone_number")]
    pub phone_number: String,
    pub jid: Option<String>,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhonesValidatedData {
    pub results: Vec<PhoneValidationResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceSimulatedData {
    pub jid: String,
    pub state: String,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallRejectedData {
    #[serde(rename = "callId")]
    pub call_id: String,
    pub from: String,
    #[serde(rename = "isVideo")]
    pub is_video: bool,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum EngineEvent {
    #[serde(rename = "contact.profile_picture")]
    ContactProfilePicture {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: ContactProfilePictureData,
        v: u32,
    },
    #[serde(rename = "phones.validated")]
    PhonesValidated {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: PhonesValidatedData,
        v: u32,
    },
    #[serde(rename = "presence.simulated")]
    PresenceSimulated {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: PresenceSimulatedData,
        v: u32,
    },
    #[serde(rename = "session.connecting")]
    Connecting {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        v: u32,
    },
    #[serde(rename = "session.qr")]
    Qr {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: QrData,
        v: u32,
    },
    #[serde(rename = "session.pairing_code")]
    PairingCode {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: PairingCodeData,
        v: u32,
    },
    #[serde(rename = "session.authenticating")]
    Authenticating {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        v: u32,
    },
    #[serde(rename = "session.reconnecting")]
    Reconnecting {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        v: u32,
    },
    #[serde(rename = "session.ready")]
    Ready {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: ReadyData,
        v: u32,
    },
    #[serde(rename = "session.disconnected")]
    Disconnected {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: DisconnectedData,
        v: u32,
    },
    #[serde(rename = "session.failed")]
    Failed {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: FailedData,
        v: u32,
    },
    #[serde(rename = "session.stopped")]
    Stopped {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        v: u32,
    },
    #[serde(rename = "message.sent")]
    MessageSent {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: MessageSentData,
        v: u32,
    },
    #[serde(rename = "message.failed")]
    MessageFailed {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: MessageFailedData,
        v: u32,
    },
    #[serde(rename = "contacts.synced")]
    ContactsSynced {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: ContactsSyncedData,
        v: u32,
    },
    #[serde(rename = "chats.synced")]
    ChatsSynced {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: ChatsSyncedData,
        v: u32,
    },
    #[serde(rename = "chat.messages")]
    ChatMessages {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: ChatMessagesData,
        v: u32,
    },
    #[serde(rename = "message.received")]
    MessageReceived {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: MessageReceivedData,
        v: u32,
    },
    #[serde(rename = "message.delivery_update")]
    MessageDeliveryUpdate {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: MessageDeliveryUpdateData,
        v: u32,
    },
    #[serde(rename = "call.rejected")]
    CallRejected {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: CallRejectedData,
        v: u32,
    },
}

impl EngineEvent {
    pub fn session_id(&self) -> &str {
        match self {
            EngineEvent::ContactProfilePicture { session_id, .. } => session_id,
            EngineEvent::PhonesValidated { session_id, .. } => session_id,
            EngineEvent::PresenceSimulated { session_id, .. } => session_id,
            EngineEvent::Connecting { session_id, .. } => session_id,
            EngineEvent::Qr { session_id, .. } => session_id,
            EngineEvent::PairingCode { session_id, .. } => session_id,
            EngineEvent::Authenticating { session_id, .. } => session_id,
            EngineEvent::Reconnecting { session_id, .. } => session_id,
            EngineEvent::Ready { session_id, .. } => session_id,
            EngineEvent::Disconnected { session_id, .. } => session_id,
            EngineEvent::Failed { session_id, .. } => session_id,
            EngineEvent::Stopped { session_id, .. } => session_id,
            EngineEvent::MessageSent { session_id, .. } => session_id,
            EngineEvent::MessageFailed { session_id, .. } => session_id,
            EngineEvent::ContactsSynced { session_id, .. } => session_id,
            EngineEvent::ChatsSynced { session_id, .. } => session_id,
            EngineEvent::ChatMessages { session_id, .. } => session_id,
            EngineEvent::MessageReceived { session_id, .. } => session_id,
            EngineEvent::MessageDeliveryUpdate { session_id, .. } => session_id,
            EngineEvent::CallRejected { session_id, .. } => session_id,
        }
    }
}
