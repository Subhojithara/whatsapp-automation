# Milestone 2 Handoff Report: Rust DB Schema, Campaign Services & Async Worker Engine

**Agent**: Explorer_M2  
**Working Directory**: `c:\client\reachout-automation2.0\.agents\explorer_m2_c\`  
**Target Subsystem**: `apps/api`  
**Date**: 2026-07-28  

---

## 1. Observation

Direct observations from codebase inspection of `apps/api`:

1. **Existing Migrations (`apps/api/migrations/`)**:
   - `001_create_sessions.sql`: Table `sessions` (status index `idx_sessions_status`, ISO 8601 strings).
   - `002_create_messages.sql`: Table `messages` with FK `session_id REFERENCES sessions(id) ON DELETE CASCADE`.
   - `003_contacts_and_chats.sql`: Tables `contacts` and `chats` with composite UNIQUE constraints `(session_id, jid)`.
   - `004_add_media_url_to_messages.sql`: Column `media_url` added to `messages`.

2. **Cargo Dependencies (`apps/api/Cargo.toml`)**:
   - Web framework: `actix-web = "4.9"` with `actix-cors = "0.7"`.
   - Database: `sqlx = "0.8"` with `runtime-tokio`, `sqlite`, `chrono`, `uuid`.
   - Serialization: `serde`, `serde_json`, `uuid`, `chrono`.
   - Missing crates required for M2: `csv`, `rust_xlsxwriter`, `calamine`, `rand`, `chrono-tz`, `actix-multipart`.

3. **Engine IPC Capabilities (`src/engine/protocol.rs` & `src/engine/manager.rs`)**:
   - Stdio IPC commands for `SimulatePresence` (`cmd: "engine.simulate_presence"`) and `ValidatePhones` (`cmd: "engine.validate_phones"`) are already defined in Rust protocol and client wrappers.
   - Incoming events include `EngineEvent::MessageReceived` (`event: "message.received"`) containing `IncomingMessage`.

4. **Existing Application Setup (`src/main.rs`)**:
   - Uses `sqlx::migrate!("./migrations").run(&pool).await`.
   - Initializes `EngineManager`, `PendingMessages`, `RealtimeHub`, and `start_event_processor`.
   - Actix HTTP server mounts scope `/api/v1` with API key verification.

---

## 2. Logic Chain

1. **Database Schema Design**:
   - Campaigns require multi-step sequences (`campaign_steps`), anti-ban execution windows (`campaign_anti_ban_config`), individual recipient tracking (`campaign_recipients`), execution audit logs (`campaign_logs`), global blacklist enforcement (`blacklist`), and reusable text templates (`campaign_templates`).
   - Using foreign key ON DELETE CASCADE rules ensures clean deletion of campaign artifacts when a campaign is deleted.

2. **Anti-Ban Architecture**:
   - **Spintax & Variables**: `SpintaxResolver` resolves randomized variations `{hi|hello}` and interpolates recipient variables `{{first_name}}` prior to sending.
   - **Working Hours**: `WorkingHoursService` ensures sending occurs only within specified local time windows (e.g., 09:00 - 18:00 in specified timezone).
   - **Warmup Limits**: `WarmupManager` caps daily sending volume per session based on session age (25 -> 75 -> 200 msgs/day) to prevent account flags.
   - **Presence Simulation**: Calling `simulate_presence` with state `"composing"` before `send_text` mimics natural human typing behavior over IPC.

3. **Worker Engine & Crash Resilience**:
   - `CampaignWorker` runs an async Tokio loop polling due recipients (`status IN ('PENDING', 'SCHEDULED') AND next_scheduled_at <= now`).
   - Deduplication check against `campaign_logs` prevents double-sending if process restarts mid-execution.
   - Stop-on-reply check in `event_processor.rs` immediately cancels remaining steps for a recipient when an incoming message is received.

4. **Export & Import Services**:
   - `ExportService` uses `csv` and `rust_xlsxwriter` to format binary audit logs.
   - `CampaignService` uses `csv` and `calamine` to parse uploaded spreadsheets and normalize phone numbers via `ContactService::normalize_phone_number`.

---

## 3. Caveats

1. **Implementation Status**: This investigation is read-only analysis. The code changes in `apps/api/` must be executed by the implementer agent.
2. **New Dependencies**: `Cargo.toml` must be updated with additional crates (`csv`, `rust_xlsxwriter`, `calamine`, `rand`, `chrono-tz`, `actix-multipart`).
3. **Timezone Support**: `chrono-tz` requires valid IANA timezone strings (e.g., `"Asia/Kolkata"`). A fallback to UTC must be included if an unrecognized timezone string is supplied.

---

## 4. Conclusion

The technical specification in `analysis.md` provides a complete, production-grade architectural blueprint for Milestone 2. It covers the migration SQL script, model definitions, 7 core Rust services, REST API routes, error handling, IPC event integration, and test verification.

---

## 5. Verification Method

To verify the implementation once completed by the implementer:

1. **Compilation Check**:
   ```bash
   cd apps/api
   cargo check
   ```

2. **Migration & Unit Testing**:
   ```bash
   cd apps/api
   cargo test --lib m2_challenger_tests
   ```

3. **Verification Checklist**:
   - [ ] Migration `005_create_campaigns.sql` runs cleanly against SQLite memory/file database.
   - [ ] Spintax resolver handles single and nested variations correctly.
   - [ ] Blacklist service blocks and auto-blacklists numbers matching "STOP".
   - [ ] Working hours service correctly evaluates time window bounds.
   - [ ] Warmup manager enforces 25/75/200 daily message caps.
   - [ ] Campaign CRUD, start, pause, stop, retry, clone, import, and export functions operate as specified.
   - [ ] Worker loop correctly polls recipients, simulates typing, applies jitter delay, and logs execution.
   - [ ] REST API endpoints return 200 OK with `ApiSuccessEnvelope`.
