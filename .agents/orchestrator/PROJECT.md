# Project Scope & Architecture: Velurix ReachOut Automation 2.0 Campaign Upgrade

## Architecture
- **`apps/api`**: Rust Actix-Web backend, SQLite DB via sqlx, process management for engine instances, JSON-stdio IPC, background async campaign worker loop, Spintax resolver, blacklist service, working hours filter, warm-up manager, CSV/XLSX exporter.
- **`apps/whatsapp-engine`**: Node.js/TypeScript engine process supporting Baileys & WWebJS drivers with batch phone validation (`onWhatsApp`) and presence simulation (`sendPresenceUpdate`).
- **`apps/web`**: Next.js 16 frontend with React 18, TanStack Query, Tailwind CSS 3, Lucide icons, real-time WebSocket connection to API, dynamic CSV/XLSX import wizard, campaign dashboard, health score breakdown, session quota monitors, blacklist manager.

## Code Layout
- `apps/whatsapp-engine/src/protocol.ts`: Command & Event IPC schemas for batch validation & presence simulation
- `apps/whatsapp-engine/src/socket.ts`: Baileys implementation for `engine.validate_phones` & `engine.simulate_presence`
- `apps/whatsapp-engine/src/wwebjs-socket.ts`: WWebJS implementation for `engine.validate_phones` & `engine.simulate_presence`
- `apps/whatsapp-engine/src/index.ts`: IPC router handlers
- `apps/api/migrations/005_create_campaigns.sql`: Database schema for campaigns, anti-ban config, steps, recipients, logs, blacklist, templates
- `apps/api/src/engine/protocol.rs`: Rust IPC command & event variants for batch validation & presence
- `apps/api/src/models/campaign.rs`: Entity structs and DB models
- `apps/api/src/services/`: Services (`spintax_service.rs`, `blacklist_service.rs`, `working_hours_service.rs`, `warmup_service.rs`, `campaign_service.rs`, `campaign_worker.rs`, `export_service.rs`)
- `apps/api/src/routes/campaigns.rs`, `blacklist.rs`, `templates.rs`: REST endpoints
- `apps/web/src/app/dashboard/campaigns/`: Campaign studio pages & components
- `apps/web/src/components/campaigns/`: 4-step wizard modal, real-time progress dashboard, health score breakdown, session quota monitors, blacklist manager
- `apps/web/src/lib/api.ts`: API client additions

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Engine & Protocol Enhancements | `apps/whatsapp-engine` & `apps/api/src/engine/protocol.rs` batch validation & presence simulation | none | DONE |
| 2 | Rust DB Schema, Campaign Services & Async Worker | `apps/api` migration 005, services, worker loop, REST routes | M1 interface | DONE |
| 3 | Campaign Studio Frontend | `apps/web` `/dashboard/campaigns` suite & wizard | M2 endpoints | IN_PROGRESS |
| 4 | Monorepo E2E Verification & Forensic Integrity Audit | Full verification & integrity check | M1, M2, M3 | PLANNED |



## Interface Contracts

### Stdio IPC Protocol Contract
- **Commands**:
  - `engine.validate_phones`: `{ session_id: string, phone_numbers: string[] }` -> returns `phones.validated`
  - `engine.simulate_presence`: `{ session_id: string, jid: string, state: "composing" | "paused", duration_ms?: number }` -> returns `presence.simulated`
- **Events**:
  - `phones.validated`: `{ session_id: string, results: Array<{ phone_number: string, jid?: string, exists: boolean }> }`
  - `presence.simulated`: `{ session_id: string, jid: string, state: string, success: boolean }`
