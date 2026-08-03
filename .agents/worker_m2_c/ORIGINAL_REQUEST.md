## 2026-07-28T13:59:23Z
You are Worker_M2 for Milestone 2: Rust DB Schema, Campaign Services & Async Worker Engine (`apps/api`).
Working directory: c:\client\reachout-automation2.0\.agents\worker_m2_c

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Implement the complete backend campaign subsystem in `apps/api/` based on Explorer_M2's specification (`c:\client\reachout-automation2.0\.agents\explorer_m2_c\analysis.md` and `handoff.md`).

1. `apps/api/Cargo.toml`: Add needed dependencies if missing (`csv`, `rust_xlsxwriter`, `calamine`, `rand`, `chrono-tz`, `actix-multipart`).
2. Migration `apps/api/migrations/005_create_campaigns.sql`:
   Create tables: `campaigns`, `campaign_anti_ban_config`, `campaign_steps`, `campaign_recipients`, `campaign_logs`, `blacklist`, `campaign_templates`.
3. Models (`apps/api/src/models/`):
   - `campaign.rs`: Structs for `Campaign`, `CampaignAntiBanConfig`, `CampaignStep`, `CampaignRecipient`, `CampaignLog`, `CampaignWithDetails`, `CreateCampaignRequest`, etc.
   - `blacklist.rs`: `BlacklistItem`, `AddBlacklistRequest`.
   - `template.rs`: `CampaignTemplate`, `CreateTemplateRequest`.
4. Services (`apps/api/src/services/`):
   - `spintax_service.rs`: SpintaxResolver (parse `{hi|hello|hey}` syntax & interpolate `{{var}}`).
   - `blacklist_service.rs`: Global BlacklistService (add, check, remove numbers; auto-blacklist on incoming "STOP").
   - `working_hours_service.rs`: WorkingHoursService with IANA timezone check.
   - `warmup_service.rs`: WarmupManager for daily tier message limits (25/75/200 msgs/day per session).
   - `export_service.rs`: ExportService generating CSV and XLSX campaign audit trail exports.
   - `campaign_service.rs`: Campaign CRUD, recipient import (CSV/XLSX parsing & phone normalization), phone validation integration, campaign cloning.
   - `campaign_worker.rs`: Tokio background async worker loop polling due steps across active sessions. Applies session rotation, anti-ban jitter delays, simulated presence typing via IPC, crash resilience with deduplication via `campaign_logs`, and stop-on-reply sequence cancellation on incoming `MessageReceived`.
5. REST API Routes (`apps/api/src/routes/`):
   - `campaigns.rs`: CRUD, `/start`, `/pause`, `/stop`, `/retry`, `/clone`, `/export`
   - `blacklist.rs`: CRUD
   - `templates.rs`: CRUD
   - `phone_validation.rs`: POST `/api/v1/phone-validation`
6. Application Entry Point (`apps/api/src/main.rs`):
   - Mount new routes in Actix HTTP scope `/api/v1`.
   - Spawn background `CampaignWorker` loop on startup (`tokio::spawn`).
   - Connect incoming `MessageReceived` events in `event_processor.rs` to stop-on-reply sequence cancellation & "STOP" auto-blacklisting.
7. Write unit tests in `apps/api/src/m2_unit_tests.rs` or `tests/` verifying Spintax parsing, blacklist logic, working hours, warmup tiers, and campaign state transitions.

Verification:
- Run `cd apps/api && cargo check` and confirm 0 errors.
- Run `cd apps/api && cargo test` and confirm 0 errors and all unit tests passing.

Document all created/modified files, build/test results, and write your report to `c:\client\reachout-automation2.0\.agents\worker_m2_c\handoff.md`. Send a message back to the orchestrator upon completion.
