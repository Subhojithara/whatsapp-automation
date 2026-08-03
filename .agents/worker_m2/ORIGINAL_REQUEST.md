## 2026-07-26T21:20:11Z
You are the Worker for Milestone 2 (Rust API Enhancements).
Your working directory is `c:\client\reachout-automation2.0\.agents\worker_m2`. Create this folder if it doesn't exist.

Read `c:\client\reachout-automation2.0\.agents\explorer_m2\analysis.md` for line-by-line implementation guidance.

Task: Implement all requirements for R2, R4 (backend), and R5 (backend) in `apps/api`:
1. Create `apps/api/migrations/003_contacts_and_chats.sql` defining `contacts` table, `chats` table, and adding `sender_jid` & `from_me` columns to `messages` table.
2. Create `src/models/contact.rs` and `src/models/chat.rs`. Update `src/models/message.rs` and export all in `src/models/mod.rs`.
3. Create `src/services/contact_service.rs` (upsert, list, search, manual contact creation with +91 Indian country code default) and `src/services/chat_service.rs` (upsert, list, last_message updates). Update `src/services/message_service.rs` (save_incoming_message, list_messages history). Export all in `src/services/mod.rs`.
4. Expand `src/engine/protocol.rs` with new `EngineCommand` variants (`GetContacts`, `GetChats`, `GetChatMessages`) and `EngineEvent` variants (`ContactsSynced`, `ChatsSynced`, `ChatMessages`, `MessageReceived`).
5. Update `src/engine/client.rs` & `src/engine/manager.rs` with pass-through methods (`get_contacts`, `get_chats`, `get_chat_messages`).
6. Update `src/engine/event_processor.rs` to handle `ContactsSynced`, `ChatsSynced`, `MessageReceived` events (persist contacts, chats, incoming messages to DB and forward to realtime hub).
7. Create routes `src/routes/contacts.rs` & `src/routes/chats.rs`, register them under `/api/v1/sessions` in `src/routes/sessions.rs`.
8. Verify with `cd apps/api && cargo check` and `cd apps/api && cargo test`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When completed, produce `handoff.md` in `c:\client\reachout-automation2.0\.agents\worker_m2\`, update your `progress.md`, and send a message back to parent.
