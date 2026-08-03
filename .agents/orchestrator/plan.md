# Campaign System Monorepo Upgrade Plan: Velurix ReachOut Automation 2.0

## High-Level Objective
Upgrade Velurix ReachOut Automation 2.0 monorepo with a production-grade bulk messaging and multi-step campaign follow-up system featuring dynamic CSV/XLSX import, anti-ban safeguards (jitter, Spintax, simulated typing, warm-up tiers, working hours), multi-session account rotation, stop-on-reply automation, and persistent Rust async queueing.

---

## Milestone Breakdown

### Milestone 1: Engine & Protocol Enhancements (`apps/whatsapp-engine` & `apps/api/src/engine/protocol.rs`)
- Extend `protocol.ts` and `protocol.rs` with IPC commands and events for batch phone validation (`engine.validate_phones`, `phones.validated`) and presence simulation (`engine.simulate_presence`, `presence.simulated`).
- Baileys engine (`socket.ts`): Implement `engine.validate_phones` using `sock.onWhatsApp()` in batches; implement `engine.simulate_presence` using `sock.sendPresenceUpdate("composing", jid)`.
- WWebJS stealth engine (`wwebjs-socket.ts`): Implement `engine.validate_phones` using `client.isRegisteredUser()` or `client.getNumberId()`; implement `engine.simulate_presence` using chat presence methods (`chat.sendStateTyping()`).
- Router (`index.ts`): Wire up dispatch for `engine.validate_phones` and `engine.simulate_presence`.
- **Verification**: `cd apps/whatsapp-engine && npx tsc --noEmit` exits 0.

### Milestone 2: Database Schema, Rust Campaign Services & Async Worker (`apps/api`)
- Migration `005_create_campaigns.sql`:
  - `campaigns`: id, name, status (DRAFT, RUNNING, PAUSED, COMPLETED, STOPPED, FAILED), anti_ban_config_id, total_recipients, sent_count, delivered_count, read_count, replied_count, failed_count, created_at, updated_at.
  - `campaign_anti_ban_config`: id, campaign_id, min_delay_sec, max_delay_sec, typing_duration_sec, enable_spintax, working_hours_start, working_hours_end, timezone, max_messages_per_session_per_day, warmup_enabled.
  - `campaign_steps`: id, campaign_id, step_number, delay_after_previous_sec, template_text, media_url.
  - `campaign_recipients`: id, campaign_id, phone_number, jid, custom_variables_json, current_step, status (PENDING, PROCESSING, SENT, DELIVERED, READ, REPLIED, FAILED, OPTED_OUT), next_scheduled_at, last_sent_at.
  - `campaign_logs`: id, campaign_id, recipient_id, step_id, session_id, status, error_message, sent_at.
  - `blacklist`: id, phone_number, reason, added_at.
  - `campaign_templates`: id, name, category, body_text, variables_json, created_at, updated_at.
- Models & Services:
  - `SpintaxResolver`: Parse `{hi|hello|hey}` syntax and generate random variations.
  - `BlacklistService`: Add, check, remove numbers from global blacklist; auto-blacklist on "STOP".
  - `WorkingHoursService`: Timezone-aware check whether current time is within specified working hours window.
  - `WarmupManager`: Enforce daily session message limits based on account warm-up tier (25 -> 75 -> 200).
  - `CampaignService`: Campaign CRUD, lifecycle management (start/pause/stop/retry), CSV/XLSX recipient import/parsing, phone validation integration, campaign cloning.
  - `CampaignWorker`: Background Tokio async loop polling for due campaign steps across active sessions. Handles session rotation, anti-ban jitter delays, simulated typing via IPC, crash resilience with DB state & deduplication, and stop-on-reply sequence cancellation on incoming `MessageReceived`.
  - `ExportService`: Generate CSV and XLSX campaign performance audit trail exports.
- REST Routes (`apps/api/src/routes/`):
  - CRUD for `/api/v1/campaigns`, `/api/v1/campaigns/{id}/start`, `/pause`, `/stop`, `/retry`, `/clone`, `/export?format=csv|xlsx`, `/api/v1/blacklist`, `/api/v1/templates`, `/api/v1/phone-validation`.
- **Verification**: `cd apps/api && cargo check` & `cargo test` exit 0.

### Milestone 3: Next.js Campaign Studio Frontend (`apps/web`)
- Add `/dashboard/campaigns` route and navigation link.
- 4-Step Wizard Modal (`/dashboard/campaigns/new` or modal):
  - Step 1: Upload CSV/XLSX drag-and-drop file parsing (auto-detect columns, preview sample rows).
  - Step 2: Dynamic column mapping & variable substitution preview (`{{name}}`, `{{company}}`).
  - Step 3: Sequence step builder (multi-step follow-ups with delay timers) & Anti-ban configuration (jitter range, typing simulation toggle, Spintax toggle, working hours window, session selection/rotation).
  - Step 4: Batch phone validation preview, warm-up safety score, launch button.
- Real-Time Progress Dashboard (`/dashboard/campaigns/[id]`):
  - Live sending progress bar, stats counter (Sent, Delivered, Read, Replied, Failed).
  - Health score breakdown (Anti-ban risk gauge, spam score estimator).
  - Session quota monitors (daily message usage per session against warm-up tier limits).
- Blacklist Manager (`/dashboard/campaigns/blacklist`):
  - Manage blacklisted numbers, manual add, search, import/export.
- Templates Library (`/dashboard/campaigns/templates`):
  - Save and reuse Spintax message templates.
- **Verification**: `cd apps/web && npx tsc --noEmit` exits 0.

### Milestone 4: Integration, Verification & Forensic Audit
- Monorepo compilation and unit test execution across all 3 applications.
- Functional scenario testing: CSV/XLSX parsing, session rotation, jitter, typing status, stop-on-reply, global blacklist on "STOP", crash resilience mid-campaign.
- Forensic Auditor integrity verification across all modified files.
- Delivery of final victory report to Sentinel.
