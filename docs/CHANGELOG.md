# Changelog

All notable changes to Velurix ReachOut Automation will be documented in this file.

## [0.1.0] - 2026-07-26
### Added
- Monorepo directory structure (`apps/api`, `apps/web`, `apps/whatsapp-engine`, `packages/contracts`).
- Complete documentation suite (`docs/`).
- Rust Actix-web backend (`apps/api`) with SQLite embedded migrations, `/api/v1/health`, and session REST endpoints.
- Session state machine in Rust with canonical transitions and SQLite persistence.
- Node.js `@whiskeysockets/baileys` WhatsApp engine runtime with stdio IPC (`stdin`/`stdout`).
- Realtime WebSocket hub (`/ws`) in Rust with broadcast event stream.
- Per-session process supervision and authentication state persistence (`data/sessions/{id}/auth/`).
- Platform startup recovery (`recover_sessions`).
- Next.js 16.2.11 App Router dashboard (`apps/web`) with Session Cards, Status Badges, Create Session Dialog, Connect Dialog (QR & Pairing tabs), and Session Detail Sheet.
