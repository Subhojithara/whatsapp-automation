# Milestone 2 Handoff Report — Empirical Verification & Challenge

## 1. Observation

### Command Execution Results
1. `cargo check` in `apps/api/`:
   - Status: Success (Exit Code: 0)
   - Output: 4 dead-code / unused warnings:
     - `MessageStatus::parse_str` (`src/models/message.rs:26:12`)
     - `Message::parsed_status` (`src/models/message.rs:63:12`)
     - `init_routes` (`src/routes/messages.rs:12:8`)
     - `MessageService::get_message` (`src/services/message_service.rs:295:18`)
2. `cargo test` in `apps/api/`:
   - Status: Success (Exit Code: 0)
   - Results: 16 tests passed, 0 failed, 0 ignored (including 4 new empirical tests in `src/m2_challenger_tests.rs`).

### Codebase & Migration Inspection
- **Migration `003_contacts_and_chats.sql`**:
  - `contacts` table (lines 2–14): `id PRIMARY KEY`, `jid NOT NULL`, `session_id NOT NULL REFERENCES sessions(id) ON DELETE CASCADE`, `UNIQUE(session_id, jid)`.
  - `chats` table (lines 19–31): `id PRIMARY KEY`, `jid NOT NULL`, `unread_count DEFAULT 0`, `session_id NOT NULL REFERENCES sessions(id) ON DELETE CASCADE`, `UNIQUE(session_id, jid)`.
  - `messages` expansion (lines 38–39): `sender_jid TEXT`, `from_me INTEGER DEFAULT 1`.
  - Indexes created: `idx_contacts_session_id`, `idx_contacts_jid`, `idx_chats_session_id`, `idx_chats_jid`, `idx_chats_last_message`, `idx_messages_session_chat`.

- **Phone Normalization Inspection**:
  - `ContactService::normalize_phone_number` (`src/services/contact_service.rs:11–34`):
    - Filters ASCII digits.
    - If `digits.len() == 10`, prepends `"91"` -> `"91" + digits`.
    - If `digits.len() >= 11 && digits.len() <= 15`, keeps `digits`.
    - Otherwise returns `AppError::ValidationError`.
  - `MessageService::validate_recipient` (`src/services/message_service.rs:18–49`):
    - If `to` contains `'@'`, returns as-is (supports group JIDs e.g. `@g.us`).
    - Filters ASCII digits.
    - If `digits.len() == 10`, **returns `Err(AppError::InvalidRecipient(...))`** stating: `"Please include country code without special symbols (e.g. 91{} for India)."`.
    - If `digits.len() < 11 || digits.len() > 15`, returns `Err(AppError::InvalidRecipient(...))`.

- **Database Connection Pool Inspection**:
  - `src/main.rs:41–47`:
    ```rust
    let connect_options = SqliteConnectOptions::from_str(&config.database_url)?
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await?;
    ```
    Notice `.foreign_keys(true)` is **omitted**. In SQLite, foreign key enforcement is disabled by default unless explicitly enabled per connection or via PRAGMA.

- **Unread Count Logic Inspection**:
  - `ChatService::update_chat_last_message` (`src/services/chat_service.rs:86`):
    `unread_count = CASE WHEN ? THEN chats.unread_count + 1 ELSE chats.unread_count END`
  - Incremented only when `increment_unread = true` (triggered by incoming messages `!msg.from_me` in `MessageService::save_incoming_message`).
  - No service method or HTTP endpoint exists in `apps/api/src/` to reset `unread_count` to 0 when reading messages.

- **Stdio IPC Protocol Inspection**:
  - `EngineCommand` (`src/engine/protocol.rs:4–59`): `#[serde(tag = "cmd", rename_all = "snake_case")]`. Includes `Start`, `Stop`, `RequestPairingCode`, `SendText`, `GetContacts`, `GetChats`, `GetChatMessages`.
  - `EngineEvent` (`src/engine/protocol.rs:169–286`): `#[serde(tag = "event", rename_all = "snake_case")]`. Includes 15 event types.
  - `EngineClient` (`src/engine/client.rs:65–88`): Spawns `node`, reads stdout line by line, parses `EngineEvent` via `serde_json::from_str`, logs warnings on parse error, and forwards events via `tokio::sync::mpsc::channel`.

- **Facade / Mock Detection**:
  - Searched all `.rs` files for `todo!`, `unimplemented!`, `mock`, `facade`, `fake`, `dummy`.
  - Zero hardcoded mock returns or facade implementations found in `apps/api/src/`.

---

## 2. Logic Chain

1. **Build and Test Verification**:
   - Running `cargo check` and `cargo test` confirms the codebase compiles without errors and all unit/integration tests pass (16/16).
   - 4 unused function warnings exist (`MessageStatus::parse_str`, `Message::parsed_status`, `messages::init_routes`, `MessageService::get_message`), indicating minor dead code.

2. **Phone Normalization Inconsistency**:
   - `ContactService` automatically prepends `"91"` for 10-digit Indian numbers, converting `"9876543210"` to `"919876543210@s.whatsapp.net"`.
   - `MessageService` explicitly rejects 10-digit numbers with an error requiring the caller to supply the country code.
   - *Result*: A user can successfully create a contact with `"9876543210"`, but sending a text message to `"to": "9876543210"` will fail with `400 Bad Request`.
   - Additionally, numbers starting with `0` (e.g. `"09876543210"`, 11 digits) bypass length validation and produce `"09876543210@s.whatsapp.net"`, which is an invalid JID format.

3. **SQLite Foreign Key ON DELETE CASCADE Vulnerability**:
   - Migration `003_contacts_and_chats.sql` defines `ON DELETE CASCADE` foreign keys for `contacts` and `chats` referencing `sessions(id)`.
   - However, `SqliteConnectOptions` in `src/main.rs` does not call `.foreign_keys(true)`.
   - Empirical test `test_sql_schema_unique_and_foreign_key_cascade` proved that deleting a session from `sessions` without `foreign_keys(true)` leaves orphaned rows in `contacts` and `chats`. Enabling `.foreign_keys(true)` causes cascade deletion to work as expected.

4. **Chat Unread Count Reset Deficit**:
   - `ChatService::update_chat_last_message` correctly increments `unread_count` on incoming messages.
   - However, fetching chat messages (`GET /api/v1/sessions/{id}/chats/{chat_id}/messages`) does not reset `unread_count`, and no endpoint exists to mark a chat as read. The count can only be reset if the external engine sends a `ChatsSynced` event with a reset count.

5. **Stdio IPC Robustness**:
   - `EngineClient` safely isolates JSON parsing errors, logging warnings without terminating the event processing loop.
   - Command and event serde roundtripping functions correctly across all command and event types.

6. **Absence of Facades**:
   - Code inspection and automated grep search verified that all DB and IPC paths are real, functional implementations.

---

## 3. Caveats

- Node.js environment was not spawned during isolated Rust unit tests, but process spawning logic in `EngineClient::spawn` was inspected and verified.
- Foreign key cascade test was executed against SQLite in-memory database with and without `.foreign_keys(true)` to prove SQLite behavior.

---

## 4. Conclusion

Milestone 2 Rust API implementation in `apps/api/` is **empirically functional and contains no mock short-circuits or facade implementations**. 

However, 3 specific defects/improvements were identified and verified empirically:
1. **[High] Disabled Foreign Keys in DB Pool**: `src/main.rs` missing `.foreign_keys(true)` on `SqliteConnectOptions`, causing `ON DELETE CASCADE` to be ignored by SQLite.
2. **[Medium] Phone Normalization Inconsistency**: `ContactService` auto-prepends 91 to 10-digit numbers, but `MessageService` rejects 10-digit numbers.
3. **[Medium] Missing Chat Read / Unread Reset API**: No endpoint or service method exists to reset `unread_count` to 0 when chat messages are read.

---

## 5. Verification Method

To independently verify all claims:

1. **Run cargo check & test**:
   ```powershell
   cd apps/api
   cargo check
   cargo test
   ```
2. **Inspect added empirical tests**:
   Inspect `apps/api/src/m2_challenger_tests.rs`:
   - `test_phone_normalization_contact_vs_message_service`
   - `test_sql_schema_unique_and_foreign_key_cascade`
   - `test_unread_count_increment_and_sync`
   - `test_stdio_ipc_protocol_serde`
3. **Inspect DB pool options**:
   Inspect `apps/api/src/main.rs` lines 41–47 to confirm missing `.foreign_keys(true)`.
