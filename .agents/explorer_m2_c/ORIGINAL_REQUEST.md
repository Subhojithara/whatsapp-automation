## 2026-07-28T19:27:15Z
<USER_REQUEST>
You are Explorer_M2 for Milestone 2: Rust DB Schema, Campaign Services & Async Worker Engine (`apps/api`).
Working directory: c:\client\reachout-automation2.0\.agents\explorer_m2_c

Your task:
Analyze existing code in `apps/api/` (migrations, models, services, routes, main server setup) and formulate a comprehensive implementation specification for Milestone 2:

1. SQLite DB Migration (`apps/api/migrations/005_create_campaigns.sql`):
   - Table `campaigns` (id, name, status, anti_ban_config_id, total_recipients, sent_count, delivered_count, read_count, replied_count, failed_count, created_at, updated_at).
   - Table `campaign_anti_ban_config` (id, campaign_id, min_delay_sec, max_delay_sec, typing_duration_sec, enable_spintax, working_hours_start, working_hours_end, timezone, max_messages_per_session_per_day, warmup_enabled).
   - Table `campaign_steps` (id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url).
   - Table `campaign_recipients` (id, campaign_id, phone_number, jid, custom_variables_json, current_step, status, next_scheduled_at, last_sent_at).
   - Table `campaign_logs` (id, campaign_id, recipient_id, step_id, session_id, status, error_message, sent_at).
   - Table `blacklist` (id, phone_number, reason, added_at).
   - Table `campaign_templates` (id, name, category, body_text, variables_json, created_at, updated_at).

2. Rust Services (`apps/api/src/services/`):
   - `SpintaxResolver`: Parse `{hi|hello|hey}` syntax and generate random variations.
   - `BlacklistService`: Add, check, remove numbers from global blacklist; auto-blacklist on incoming message matching "STOP".
   - `WorkingHoursService`: Timezone-aware check whether current time is within specified working hours window.
   - `WarmupManager`: Enforce daily session message limits based on account warm-up tier (25 -> 75 -> 200 msgs/day).
   - `CampaignService`: Campaign CRUD, lifecycle management (start, pause, stop, retry), phone validation integration, CSV/XLSX recipient import/parsing, campaign cloning.
   - `CampaignWorker`: Background Tokio async loop polling for due campaign steps across active sessions. Handles session rotation, anti-ban jitter delays, simulated typing via IPC, crash resilience with DB state & deduplication (`campaign_logs`), and stop-on-reply sequence cancellation on incoming `MessageReceived`.
   - `ExportService`: Generate CSV and XLSX audit trail exports.

3. REST API Routes (`apps/api/src/routes/`):
   - `/api/v1/campaigns` CRUD, `/start`, `/pause`, `/stop`, `/retry`, `/clone`, `/export?format=csv|xlsx`
   - `/api/v1/blacklist` CRUD
   - `/api/v1/templates` CRUD
   - `/api/v1/phone-validation` POST

Write your technical specification to `c:\client\reachout-automation2.0\.agents\explorer_m2_c\analysis.md` and deliver your handoff report to `c:\client\reachout-automation2.0\.agents\explorer_m2_c\handoff.md`.
Send a message back to the orchestrator upon completion.
</USER_REQUEST>
