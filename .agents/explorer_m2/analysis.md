# Technical Analysis & Implementation Specification: Milestone 2 (Rust API Enhancements)

## Executive Summary
This document provides full technical analysis and explicit specifications for implementing **Milestone 2 (Rust API Enhancements)** in `apps/api/`.
All specifications adhere to existing patterns in sqlx, Actix-Web, and stdio IPC protocol in the Velurix ReachOut Automation 2.0 architecture.

---

## 1. Migration File Specification
- **Target File**: `apps/api/migrations/003_contacts_and_chats.sql`
- **Prefix Sequence**: `003` (following `001_create_sessions.sql` and `002_create_messages.sql`).

```sql
-- Migration 003: Contacts, Chats, and Messages expansion
CREATE TABLE IF NOT EXISTS contacts (
    id           TEXT PRIMARY KEY NOT NULL,
    jid          TEXT NOT NULL,
    name         TEXT,
    phone_number TEXT,
    avatar_url   TEXT,
    is_group     INTEGER DEFAULT 0,
    session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    synced_at    TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    UNIQUE(session_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_contacts_session_id ON contacts(session_id);
CREATE INDEX IF NOT EXISTS idx_contacts_jid ON contacts(jid);

CREATE TABLE IF NOT EXISTS chats (
    id                TEXT PRIMARY KEY NOT NULL,
    jid               TEXT NOT NULL,
    name              TEXT,
    is_group          INTEGER DEFAULT 0,
    last_message_body TEXT,
    last_message_at   TEXT,
    unread_count      INTEGER DEFAULT 0,
    session_id        TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    UNIQUE(session_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_chats_session_id ON chats(session_id);
CREATE INDEX IF NOT EXISTS idx_chats_jid ON chats(jid);
CREATE INDEX IF NOT EXISTS idx_chats_last_message ON chats(session_id, last_message_at DESC);

-- Messages expansion for chat UI & direction handling
ALTER TABLE messages ADD COLUMN sender_jid TEXT;
ALTER TABLE messages ADD COLUMN from_me INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_messages_session_chat ON messages(session_id, chat_id, created_at DESC);
```

---

## 2. Models Specification (`src/models/`)

### 2.1 `src/models/contact.rs`
```rust
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
```

### 2.2 `src/models/chat.rs`
```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    pub id: String,
    pub jid: String,
    pub name: Option<String>,
    pub is_group: bool,
    pub last_message_body: Option<String>,
    pub last_message_at: Option<String>,
    pub unread_count: i64,
    pub session_id: String,
    pub created_at: String,
    pub updated_at: String,
}
```

### 2.3 `src/models/message.rs` (updates)
Add fields to `Message` and `MessageResponse`:
- `pub sender_jid: Option<String>`
- `pub from_me: bool`
- In `MessageResponse`: `pub sender_jid: Option<String>`, `pub from_me: bool`, `pub chat_id: String`, `pub direction: String`.

### 2.4 `src/models/mod.rs`
```rust
pub mod chat;
pub mod contact;
pub mod message;
pub mod session;
```

---

## 3. Services Specification (`src/services/`)

### 3.1 `ContactService` (`src/services/contact_service.rs`)
- `upsert_contacts(pool: &SqlitePool, session_id: &str, contacts: &[ContactData]) -> Result<(), AppError>`
  - Performs `INSERT ... ON CONFLICT(session_id, jid) DO UPDATE SET ...` for batch syncing contacts.
- `list_contacts(pool: &SqlitePool, session_id: &str) -> Result<Vec<Contact>, AppError>`
  - `SELECT * FROM contacts WHERE session_id = ? ORDER BY COALESCE(name, jid) ASC`
- `search_contacts(pool: &SqlitePool, session_id: &str, query: &str) -> Result<Vec<Contact>, AppError>`
  - `SELECT * FROM contacts WHERE session_id = ? AND (name LIKE ? OR phone_number LIKE ? OR jid LIKE ?) ORDER BY COALESCE(name, jid) ASC`
- `create_manual_contact(pool: &SqlitePool, session_id: &str, dto: CreateContactDto) -> Result<Contact, AppError>`
  - Auto-prepends `91` to 10-digit Indian phone numbers (R4 requirement). Formats to JID `<number>@s.whatsapp.net`.

### 3.2 `ChatService` (`src/services/chat_service.rs`)
- `upsert_chats(pool: &SqlitePool, session_id: &str, chats: &[ChatData]) -> Result<(), AppError>`
  - Performs `INSERT ... ON CONFLICT(session_id, jid) DO UPDATE SET ...`
- `list_chats(pool: &SqlitePool, session_id: &str) -> Result<Vec<Chat>, AppError>`
  - `SELECT * FROM chats WHERE session_id = ? ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC`
- `update_chat_last_message(pool: &SqlitePool, session_id: &str, chat_id: &str, last_body: &str, timestamp: &str, increment_unread: bool) -> Result<Chat, AppError>`

### 3.3 `MessageService` (`src/services/message_service.rs`) enhancements
- `save_incoming_message(pool: &SqlitePool, session_id: &str, msg: &IncomingMessage) -> Result<Message, AppError>`
  - Inserts message record into `messages` table with `direction = 'incoming'`, `status = 'RECEIVED'`, `from_me = false`.
  - Triggers update to `chats` table via `ChatService::update_chat_last_message`.
- `list_messages(pool: &SqlitePool, session_id: &str, chat_id: &str, limit: i64, offset: i64) -> Result<Vec<MessageResponse>, AppError>`
  - `SELECT * FROM messages WHERE session_id = ? AND chat_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`

---

## 4. Stdio IPC & Event Processing Specification (`src/engine/` & `src/event_processor.rs`)

### 4.1 `src/engine/protocol.rs`
Add `EngineCommand` variants:
```rust
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
```

Add `EngineEvent` payload structs & variants:
```rust
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
    pub timestamp: String,
    #[serde(rename = "fromMe")]
    pub from_me: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageReceivedData {
    pub message: IncomingMessage,
}

// In EngineEvent enum:
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
```

### 4.2 Passthrough Methods (`src/engine/client.rs` & `src/engine/manager.rs`)
Add `get_contacts`, `get_chats`, `get_chat_messages` methods on `EngineClient` and delegate on `EngineManager`.

### 4.3 Event Processor (`src/event_processor.rs`)
In `start_event_processor`:
- Handle `EngineEvent::ContactsSynced { session_id, data, .. }` -> `ContactService::upsert_contacts(&pool, &session_id, &data.contacts)`.
- Handle `EngineEvent::ChatsSynced { session_id, data, .. }` -> `ChatService::upsert_chats(&pool, &session_id, &data.chats)`.
- Handle `EngineEvent::MessageReceived { session_id, data, .. }` -> `MessageService::save_incoming_message(&pool, &session_id, &data.message)`.

---

## 5. Actix-Web Route Handlers (`src/routes/`)

### 5.1 `src/routes/contacts.rs`
- `GET /api/v1/sessions/{id}/contacts` -> `list_contacts`
- `GET /api/v1/sessions/{id}/contacts/search?q=query` -> `search_contacts`
- `POST /api/v1/sessions/{id}/contacts/sync` -> `sync_contacts`

### 5.2 `src/routes/chats.rs`
- `GET /api/v1/sessions/{id}/chats` -> `list_chats`
- `POST /api/v1/sessions/{id}/chats/sync` -> `sync_chats`
- `GET /api/v1/sessions/{id}/chats/{chatId}/messages?limit=50&offset=0` -> `get_chat_messages`

### 5.3 App Routing Registration
Register all endpoints under `/api/v1/sessions` in `src/routes/sessions.rs`.

---

## 6. Verification Criteria
- `cargo check` and `cargo test` pass cleanly.
- `sqlx::migrate!("./migrations").run(&pool)` applies migration `003_contacts_and_chats.sql` without error.
- Standard JSON envelope format `{ "success": true, "data": ... }` used across all new endpoints.
