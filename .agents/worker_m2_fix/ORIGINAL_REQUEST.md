## 2026-07-27T06:45:15Z
You are Worker_M2_Fix (teamwork_preview_worker).
Your working directory is `c:\client\reachout-automation2.0\.agents\worker_m2_fix`.
Please create your working directory if needed, write your `BRIEFING.md` and `progress.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Fix 3 specific defects identified during Milestone 2 challenger verification in `apps/api/`:

1. **SQLite Foreign Keys Enablement**:
   - In `apps/api/src/main.rs`, add `.foreign_keys(true)` to `SqliteConnectOptions` so SQLite foreign key constraints and `ON DELETE CASCADE` are enforced on all DB connections.

2. **Phone Number Normalization Alignment**:
   - Update `MessageService::validate_recipient` in `apps/api/src/services/message_service.rs` (or extract/share a helper with `ContactService::normalize_phone_number` in `contact_service.rs`) so that:
     - If a 10-digit number is provided (e.g., `9876543210`), auto-prepend `91` -> `919876543210` (matching R4 requirements and `ContactService`).
     - Handle numbers starting with leading `0` (e.g. `09876543210`) by stripping the leading `0` before normalizing.
     - Allow formatted JIDs (e.g. `919876543210@s.whatsapp.net` or group `@g.us`).

3. **Chat Unread Count Reset Endpoint**:
   - In `apps/api/src/services/chat_service.rs`, add `mark_chat_read(pool: &SqlitePool, session_id: &str, chat_id: &str) -> Result<Chat, AppError>` or `reset_unread_count` which sets `unread_count = 0` for the specified `(session_id, chat_id)`.
   - In `apps/api/src/routes/chats.rs`, add endpoint `POST /api/v1/sessions/{id}/chats/{chatId}/read` (and register route in `sessions.rs`).
   - Also, in `GET /api/v1/sessions/{id}/chats/{chatId}/messages`, optionally call `mark_chat_read` or allow explicit `/read` endpoint so frontend can mark chats as read.

4. Verify:
   - Run `cd apps/api && cargo check` (must exit 0).
   - Run `cd apps/api && cargo test` (must exit 0, all unit/integration tests passing).

Document your changes in `c:\client\reachout-automation2.0\.agents\worker_m2_fix\handoff.md` and report back to parent when done.
