# Milestone 2 Implementation Specification: Rust DB Schema, Campaign Services & Async Worker Engine

**Target Subsystem**: `apps/api` (Velurix API Engine)  
**Author**: Explorer_M2  
**Date**: 2026-07-28  

---

## 1. Executive Summary & Overview

Milestone 2 expands the Velurix Rust backend (`apps/api`) into an automated campaign execution engine. It introduces full campaign lifecycle management, multi-step messaging sequences, anti-ban protection mechanisms (spintax generation, working hours windows, account warm-up tiers, simulated typing presence via stdio IPC), recipient import/export, global opt-out blacklisting, template management, phone number validation, and crash-resilient asynchronous worker polling.

### Key Objectives
1. **Database Persistence**: Create database migration `005_create_campaigns.sql` establishing 7 tables (`campaigns`, `campaign_anti_ban_config`, `campaign_steps`, `campaign_recipients`, `campaign_logs`, `blacklist`, `campaign_templates`) with strict SQLite relational integrity, default values, and indexes.
2. **Modular Services**: Build 7 core service components in `apps/api/src/services/` handling spintax resolution, blacklist operations, working hours constraints, warm-up throttling, campaign lifecycle management, Tokio async background execution loop, and export format generation.
3. **REST API Layer**: Expose endpoints under `/api/v1/campaigns`, `/api/v1/blacklist`, `/api/v1/templates`, and `/api/v1/phone-validation` with standardized `ApiSuccessEnvelope` and `ApiErrorEnvelope` response formats.
4. **Event Processor & IPC Integration**: Enhance `event_processor.rs` to detect incoming "STOP" messages for automatic blacklisting, and implement stop-on-reply campaign recipient sequence cancellation upon receiving incoming WhatsApp messages.

---

## 2. Database Migration Specification (`005_create_campaigns.sql`)

File Location: `apps/api/migrations/005_create_campaigns.sql`

```sql
-- Migration 005: Create Campaigns, Anti-Ban Config, Steps, Recipients, Logs, Blacklist, and Templates

-- 1. Anti-Ban Config Table
CREATE TABLE IF NOT EXISTS campaign_anti_ban_config (
    id                               TEXT PRIMARY KEY NOT NULL,
    campaign_id                      TEXT NOT NULL,
    min_delay_sec                    INTEGER NOT NULL DEFAULT 5,
    max_delay_sec                    INTEGER NOT NULL DEFAULT 15,
    typing_duration_sec              INTEGER NOT NULL DEFAULT 2,
    enable_spintax                   INTEGER NOT NULL DEFAULT 1,
    working_hours_start              TEXT NOT NULL DEFAULT '09:00',
    working_hours_end                TEXT NOT NULL DEFAULT '18:00',
    timezone                         TEXT NOT NULL DEFAULT 'UTC',
    max_messages_per_session_per_day INTEGER NOT NULL DEFAULT 100,
    warmup_enabled                   INTEGER NOT NULL DEFAULT 1
);

-- 2. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id                 TEXT PRIMARY KEY NOT NULL,
    name               TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'DRAFT',
    anti_ban_config_id TEXT REFERENCES campaign_anti_ban_config(id) ON DELETE SET NULL,
    total_recipients   INTEGER NOT NULL DEFAULT 0,
    sent_count         INTEGER NOT NULL DEFAULT 0,
    delivered_count    INTEGER NOT NULL DEFAULT 0,
    read_count         INTEGER NOT NULL DEFAULT 0,
    replied_count      INTEGER NOT NULL DEFAULT 0,
    failed_count       INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Foreign Key constraint linkage for anti_ban_config -> campaigns
-- (Note: Foreign key pragma enabled via SqliteConnectOptions in main.rs)

-- 3. Campaign Steps Table
CREATE TABLE IF NOT EXISTS campaign_steps (
    id                       TEXT PRIMARY KEY NOT NULL,
    campaign_id              TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    step_number              INTEGER NOT NULL,
    delay_after_previous_sec INTEGER NOT NULL DEFAULT 0,
    template_text            TEXT NOT NULL,
    media_url                TEXT,
    UNIQUE(campaign_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign ON campaign_steps(campaign_id);

-- 4. Campaign Recipients Table
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id                    TEXT PRIMARY KEY NOT NULL,
    campaign_id           TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    phone_number          TEXT NOT NULL,
    jid                   TEXT NOT NULL,
    custom_variables_json TEXT,
    current_step          INTEGER NOT NULL DEFAULT 1,
    status                TEXT NOT NULL DEFAULT 'PENDING',
    next_scheduled_at     TEXT,
    last_sent_at          TEXT,
    UNIQUE(campaign_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_scheduled ON campaign_recipients(status, next_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_phone ON campaign_recipients(phone_number);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_jid ON campaign_recipients(jid);

-- 5. Campaign Execution Audit Logs Table
CREATE TABLE IF NOT EXISTS campaign_logs (
    id            TEXT PRIMARY KEY NOT NULL,
    campaign_id   TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    recipient_id  TEXT NOT NULL REFERENCES campaign_recipients(id) ON DELETE CASCADE,
    step_id       TEXT NOT NULL REFERENCES campaign_steps(id) ON DELETE CASCADE,
    session_id    TEXT,
    status        TEXT NOT NULL,
    error_message TEXT,
    sent_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign ON campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_dedup ON campaign_logs(recipient_id, step_id);

-- 6. Global Blacklist Table
CREATE TABLE IF NOT EXISTS blacklist (
    id           TEXT PRIMARY KEY NOT NULL,
    phone_number TEXT NOT NULL UNIQUE,
    reason       TEXT,
    added_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone_number);

-- 7. Campaign Message Templates Table
CREATE TABLE IF NOT EXISTS campaign_templates (
    id             TEXT PRIMARY KEY NOT NULL,
    name           TEXT NOT NULL,
    category       TEXT,
    body_text      TEXT NOT NULL,
    variables_json TEXT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_campaign_templates_category ON campaign_templates(category);
```

---

## 3. Rust Domain Models (`apps/api/src/models/`)

### A. `src/models/campaign.rs`
Contains structs for database entities and DTOs:
- `Campaign`: Represents row in `campaigns` table. Statuses: `DRAFT`, `RUNNING`, `PAUSED`, `COMPLETED`, `STOPPED`, `FAILED`.
- `CampaignAntiBanConfig`: Row in `campaign_anti_ban_config`.
- `CampaignStep`: Row in `campaign_steps`.
- `CampaignRecipient`: Row in `campaign_recipients`. Statuses: `PENDING`, `SCHEDULED`, `SENDING`, `SENT`, `DELIVERED`, `READ`, `REPLIED`, `FAILED`, `BLACKLISTED`, `CANCELLED`.
- `CampaignLog`: Row in `campaign_logs`.
- DTOs:
  - `CreateCampaignDto`: Includes `name`, `antiBanConfig: Option<CreateAntiBanConfigDto>`, `steps: Vec<CreateStepDto>`.
  - `UpdateCampaignDto`: Optional fields for updating campaign settings/steps.
  - `CampaignResponse`: Serialized camelCase response containing campaign details, aggregated counts, steps list, and anti-ban configuration object.
  - `ImportRecipientsRequest`: Used when posting recipients JSON or file data.

### B. `src/models/blacklist.rs`
- `BlacklistEntry`: Represents row in `blacklist` table.
- `CreateBlacklistDto`: `{ phoneNumber: String, reason: Option<String> }`.
- `BlacklistResponse`: Serialized camelCase format.

### C. `src/models/template.rs`
- `CampaignTemplate`: Represents row in `campaign_templates`.
- `CreateTemplateDto`: `{ name: String, category: Option<String>, bodyText: String, variables: Option<Vec<String>> }`.
- `UpdateTemplateDto`: Optional fields for template updates.
- `TemplateResponse`: Serialized camelCase format.

---

## 4. Rust Services Specification (`apps/api/src/services/`)

### 4.1 `SpintaxResolver` (`src/services/spintax_resolver.rs`)
- **Responsibility**: Parse spintax patterns (e.g. `{hi|hello|hey}`) and replace variables (e.g. `{{first_name}}` or `{first_name}`).
- **Algorithm**:
  1. Recursively find nested brace groups `{option1|option2|...}`.
  2. Select a random option using `rand::thread_rng()`.
  3. Replace variable tokens `{{var_name}}` using key-value entries in recipient's `custom_variables_json`.
  4. If a variable is missing, fallback to empty string or preserve default.
- **API**:
  ```rust
  pub struct SpintaxResolver;
  impl SpintaxResolver {
      pub fn resolve(template: &str, custom_vars: Option<&serde_json::Value>) -> String;
      pub fn parse_spintax(input: &str) -> String;
  }
  ```

### 4.2 `BlacklistService` (`src/services/blacklist_service.rs`)
- **Responsibility**: Global phone number blacklist control and automatic opt-out.
- **Functions**:
  - `add(pool: &SqlitePool, phone_number: &str, reason: Option<&str>) -> Result<BlacklistEntry, AppError>`
    - Normalizes phone number via `ContactService::normalize_phone_number`.
    - Inserts into `blacklist` table using UPSERT (`ON CONFLICT(phone_number) DO UPDATE SET reason = excluded.reason`).
  - `check(pool: &SqlitePool, phone_number: &str) -> Result<bool, AppError>`
    - Checks both raw phone number and normalized formats (`919876543210`, `+919876543210`).
  - `remove(pool: &SqlitePool, id_or_phone: &str) -> Result<(), AppError>`
  - `list(pool: &SqlitePool, limit: i64, offset: i64) -> Result<Vec<BlacklistEntry>, AppError>`
  - `handle_incoming_stop(pool: &SqlitePool, phone_number: &str, body: &str) -> Result<bool, AppError>`
    - Case-insensitive check if `body.trim()` equals "STOP", "UNSUBSCRIBE", "QUIT", or "CANCEL".
    - If matched, auto-adds `phone_number` to `blacklist` with reason `"AUTO_STOP_REPLY"`.
    - Updates any active recipient entries in `campaign_recipients` for this phone number to status `'BLACKLISTED'`.

### 4.3 `WorkingHoursService` (`src/services/working_hours_service.rs`)
- **Responsibility**: Ensure messages are sent only during configured working hours in the campaign's specified timezone.
- **Algorithm**:
  1. Parse `working_hours_start` (e.g. `"09:00"`) and `working_hours_end` (e.g. `"18:00"`).
  2. Parse `timezone` string (e.g. `"Asia/Kolkata"`, `"America/New_York"`, `"UTC"`). Fallback to UTC if invalid.
  3. Convert current UTC timestamp (`Utc::now()`) to specified timezone time.
  4. Compare time of day (hours and minutes) against start and end bounds.
  5. Handle wrap-around windows (e.g., start `"22:00"`, end `"06:00"`).
  6. Return `is_active: bool` and `next_available_utc: Option<String>` for scheduling.

### 4.4 `WarmupManager` (`src/services/warmup_manager.rs`)
- **Responsibility**: Enforce daily session message caps to protect accounts based on warm-up tiers.
- **Tier Rules**:
  - **Tier 1** (Day 1-3 of session): Max 25 msgs/day
  - **Tier 2** (Day 4-7 of session): Max 75 msgs/day
  - **Tier 3** (Day 8+ of session): Max 200 msgs/day (or `max_messages_per_session_per_day` config limit)
- **Functions**:
  - Calculates session age in days from `sessions.created_at` or `last_connected_at`.
  - Queries `messages` table for number of outgoing sent messages for `session_id` on the current calendar day (UTC).
  - Returns `can_send: bool` and `remaining_quota: i64`.

### 4.5 `CampaignService` (`src/services/campaign_service.rs`)
- **Responsibility**: CRUD operations, lifecycle state transitions, recipient CSV/XLSX parsing, campaign cloning.
- **Lifecycle Methods**:
  - `create_campaign(pool, req) -> Result<CampaignResponse, AppError>`
  - `get_campaign(pool, id) -> Result<CampaignResponse, AppError>`
  - `list_campaigns(pool, status, limit, offset) -> Result<Vec<CampaignResponse>, AppError>`
  - `update_campaign(pool, id, req) -> Result<CampaignResponse, AppError>`
  - `delete_campaign(pool, id) -> Result<(), AppError>` (cascade deletes config, steps, recipients, logs)
  - `start_campaign(pool, id) -> Result<CampaignResponse, AppError>` (transitions DRAFT/PAUSED -> RUNNING)
  - `pause_campaign(pool, id) -> Result<CampaignResponse, AppError>` (transitions RUNNING -> PAUSED)
  - `stop_campaign(pool, id) -> Result<CampaignResponse, AppError>` (transitions RUNNING/PAUSED -> STOPPED; sets PENDING recipients to CANCELLED)
  - `retry_failed_recipients(pool, id) -> Result<u64, AppError>` (resets status FAILED -> PENDING; sets campaign -> RUNNING)
  - `clone_campaign(pool, id) -> Result<CampaignResponse, AppError>` (copies campaign, config, steps with new UUIDs and status DRAFT)
  - `import_recipients_csv(pool, campaign_id, csv_data: &[u8]) -> Result<ImportSummary, AppError>`
    - Uses `csv::Reader` to parse columns (`phone_number`, `phone`, `mobile`, `name`, etc.).
    - Normalizes phone numbers using `ContactService::normalize_phone_number`.
    - Checks global `blacklist`. Skips blacklisted numbers.
    - Stores additional columns in `custom_variables_json`.
    - Updates `campaigns.total_recipients`.
  - `import_recipients_xlsx(pool, campaign_id, xlsx_data: &[u8]) -> Result<ImportSummary, AppError>`
    - Uses `calamine::Reader` to extract sheet data and parse rows.

### 4.6 `CampaignWorker` (`src/services/campaign_worker.rs`)
- **Responsibility**: Tokio async loop polling database for scheduled campaign steps and executing sending jobs.
- **Worker Execution Flow**:
  1. Spawning: Started via `tokio::spawn` in `src/main.rs`. Poll loop interval: 3 seconds.
  2. Query active campaigns (`status = 'RUNNING'`).
  3. For each active campaign:
     - Query due recipients: `status IN ('PENDING', 'SCHEDULED') AND (next_scheduled_at IS NULL OR next_scheduled_at <= now()) ORDER BY current_step ASC LIMIT 50`.
     - Check working hours window via `WorkingHoursService`. If outside window, delay execution by updating recipient `next_scheduled_at` to next window start.
     - Get all active READY sessions via `SessionService` and `EngineManager`.
     - Round-robin select an available READY session.
     - Check session quota via `WarmupManager`. If session limit reached, select next READY session or skip.
     - Check `BlacklistService`. If recipient is blacklisted, update recipient status to `BLACKLISTED`, record in `campaign_logs`, increment `failed_count`.
     - Fetch step definition (`campaign_steps` where `step_number = recipient.current_step`).
     - Check deduplication: check if entry already exists in `campaign_logs` for `(recipient_id, step_id, status = 'SENT')`. If exists, advance recipient to next step.
     - Calculate anti-ban jitter delay: random duration between `min_delay_sec` and `max_delay_sec`.
     - Simulate typing presence: call `engine_manager.simulate_presence(session_id, jid, "composing", typing_duration_sec * 1000)`.
     - Resolve spintax and custom variables using `SpintaxResolver`.
     - Send message: call `MessageService::send_text` or `MessageService::send_media_message`.
     - Record log entry in `campaign_logs` (`SENT` or `FAILED`).
     - Update `campaign_recipients`:
       - If message sent: set `last_sent_at = now`. If more steps exist, set `current_step += 1`, status = `SCHEDULED`, `next_scheduled_at = now + step.delay_after_previous_sec`. If no more steps, status = `COMPLETED`.
       - If message failed: set status = `FAILED`.
     - Update campaign counters in `campaigns` table (`sent_count`, `failed_count`).
     - Check if all recipients for campaign are in terminal state (`COMPLETED`, `FAILED`, `CANCELLED`, `BLACKLISTED`, `REPLIED`). If so, transition campaign status to `COMPLETED`.
  4. **Stop-On-Reply Sequence Cancellation**:
     - When `event_processor.rs` receives a `MessageReceived` event:
     - Query if `sender_jid` / `phone_number` is an active recipient in any campaign with status `PENDING`, `SCHEDULED`, or `SENDING`.
     - If matched, update recipient status to `REPLIED`.
     - Log cancellation in `campaign_logs` (`status = 'REPLIED'`).
     - Increment `campaigns.replied_count`.

### 4.7 `ExportService` (`src/services/export_service.rs`)
- **Responsibility**: Generate downloadable CSV and XLSX files containing campaign audit reports and recipient results.
- **API**:
  - `export_csv(pool: &SqlitePool, campaign_id: &str) -> Result<Vec<u8>, AppError>`
    - Uses `csv::Writer` to format columns: `Phone Number`, `JID`, `Status`, `Current Step`, `Last Sent At`, `Error Message`, `Custom Variables`.
  - `export_xlsx(pool: &SqlitePool, campaign_id: &str) -> Result<Vec<u8>, AppError>`
    - Uses `rust_xlsxwriter::Workbook` to create formatted Excel spreadsheet with header styling.

---

## 5. REST API Routes Specifications (`apps/api/src/routes/`)

All routes require API Key header verification via `verify_api_key_header(&req, &config)?`.

### 5.1 Campaign Routes (`src/routes/campaigns.rs`)
- Scope: `/api/v1/campaigns`
  - `POST /` - Create new campaign. Payload: `CreateCampaignDto`. Response: `201 Created` with `ApiSuccessEnvelope<CampaignResponse>`.
  - `GET /` - List campaigns. Query params: `status: Option<String>`, `limit: Option<i64>`, `offset: Option<i64>`. Response: `200 OK`.
  - `GET /{id}` - Get campaign by ID. Response: `200 OK`.
  - `PUT /{id}` - Update campaign details or steps. Response: `200 OK`.
  - `DELETE /{id}` - Delete campaign. Response: `200 OK`.
  - `POST /{id}/start` - Start or resume campaign. Response: `200 OK`.
  - `POST /{id}/pause` - Pause running campaign. Response: `200 OK`.
  - `POST /{id}/stop` - Stop campaign and cancel pending recipients. Response: `200 OK`.
  - `POST /{id}/retry` - Reset failed recipients to pending and resume campaign. Response: `200 OK`.
  - `POST /{id}/clone` - Deep copy campaign to DRAFT state. Response: `201 Created`.
  - `POST /{id}/import-recipients` - Multipart form or JSON import of recipients. Response: `200 OK` with summary (`totalImported`, `skippedBlacklisted`, `invalidNumbers`).
  - `GET /{id}/export` - Query param: `format=csv` or `format=xlsx`. Returns binary file with appropriate `Content-Type` (`text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) and `Content-Disposition` header.

### 5.2 Blacklist Routes (`src/routes/blacklist.rs`)
- Scope: `/api/v1/blacklist`
  - `GET /` - List blacklisted phone numbers with pagination.
  - `POST /` - Add number to blacklist (`{ "phoneNumber": "...", "reason": "..." }`).
  - `DELETE /{id}` - Remove number from blacklist.

### 5.3 Template Routes (`src/routes/templates.rs`)
- Scope: `/api/v1/templates`
  - `GET /` - List templates (`category` filter).
  - `POST /` - Create template.
  - `GET /{id}` - Get template details.
  - `PUT /{id}` - Update template.
  - `DELETE /{id}` - Delete template.

### 5.4 Phone Validation Route (`src/routes/phone_validation.rs`)
- Scope: `/api/v1/phone-validation`
  - `POST /` - Request WhatsApp phone validation for list of numbers. Payload: `{ "sessionId": "...", "phoneNumbers": ["..."] }`. Invokes `engine_manager.validate_phones`.

---

## 6. Dependency & Configuration Updates

### `apps/api/Cargo.toml` Additions
```toml
[dependencies]
# Existing dependencies...
actix-web = "4.9"
actix-cors = "0.7"
tokio = { version = "1.37", features = ["full"] }
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite", "chrono", "uuid"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1.8", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
tracing = "0.1"

# Milestone 2 Required Additions:
csv = "1.3"
rust_xlsxwriter = "0.80"
calamine = "0.26"
rand = "0.8"
chrono-tz = "0.9"
actix-multipart = "0.7"
```

---

## 7. App Error Enum Extensions (`src/errors.rs`)

Add the following variants to `AppError`:
```rust
#[error("Campaign not found: {0}")]
CampaignNotFound(String),

#[error("Template not found: {0}")]
TemplateNotFound(String),

#[error("Blacklist error: {0}")]
BlacklistError(String),

#[error("Import error: {0}")]
ImportError(String),

#[error("Export error: {0}")]
ExportError(String),
```

Mapping in `AppError::error_code()` and `ResponseError::status_code()`:
- `CampaignNotFound` / `TemplateNotFound` -> `StatusCode::NOT_FOUND`
- `BlacklistError` / `ImportError` / `ExportError` -> `StatusCode::BAD_REQUEST`

---

## 8. Integration Points in `main.rs` and `event_processor.rs`

### `src/main.rs`
1. Register route scopes:
   ```rust
   .service(
       web::scope("/api/v1")
           .service(routes::health::health_check)
           .service(routes::sessions::init_routes())
           .service(routes::campaigns::init_routes())
           .service(routes::blacklist::init_routes())
           .service(routes::templates::init_routes())
           .service(routes::phone_validation::init_routes())
   )
   ```
2. Spawn Campaign Worker background loop:
   ```rust
   services::campaign_worker::start_campaign_worker(pool.clone(), engine_manager.clone());
   ```

### `src/event_processor.rs`
1. On `EngineEvent::MessageReceived`:
   - Check if message body equals `"STOP"` (case-insensitive).
   - If true: call `BlacklistService::handle_incoming_stop`.
   - Call `CampaignWorker::handle_incoming_reply(pool, session_id, incoming_msg)` to trigger stop-on-reply sequence cancellation for recipient.

---

## 9. Implementation Checklist & Verification Strategy

### Step-by-Step Implementation Sequence
1. **Migration**: Write `apps/api/migrations/005_create_campaigns.sql`.
2. **Cargo.toml**: Add `csv`, `rust_xlsxwriter`, `calamine`, `rand`, `chrono-tz`, `actix-multipart`.
3. **Models**: Create `src/models/campaign.rs`, `blacklist.rs`, `template.rs`, update `src/models/mod.rs`.
4. **Error Handling**: Update `src/errors.rs` with new error variants.
5. **Services**: Create `spintax_resolver.rs`, `blacklist_service.rs`, `working_hours_service.rs`, `warmup_manager.rs`, `campaign_service.rs`, `campaign_worker.rs`, `export_service.rs`, update `src/services/mod.rs`.
6. **Routes**: Create `routes/campaigns.rs`, `routes/blacklist.rs`, `routes/templates.rs`, `routes/phone_validation.rs`, update `src/routes/mod.rs`.
7. **Main & Event Processor**: Connect worker and routes in `main.rs`, update `event_processor.rs`.
8. **Tests**: Create unit tests in `src/m2_challenger_tests.rs` verifying DB migration execution, spintax parsing, blacklist enforcement, working hours bounds, warm-up daily limits, campaign lifecycle state transitions, CSV/XLSX exports, and worker polling logic.

---
