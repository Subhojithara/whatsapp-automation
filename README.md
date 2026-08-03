# Velurix ReachOut Automation

Multi-session WhatsApp automation, messaging, and API gateway platform.

## Architecture

- **`apps/api`**: Rust + Actix-web backend (API, SQLite persistence, session management, process supervision, WebSocket gateway).
- **`apps/whatsapp-engine`**: Node.js/TypeScript Baileys runtime (per-session child processes communicating via stdio IPC).
- **`apps/web`**: Next.js App Router dashboard (React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query).
- **`packages/contracts`**: Shared TypeScript contracts and schemas for engine IPC and API response envelopes.

## Documentation

Full architectural specifications and development guides are located in the [`docs/`](./docs) directory:

- [PROJECT_CONTEXT.md](./docs/PROJECT_CONTEXT.md)
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [SESSION_LIFECYCLE.md](./docs/SESSION_LIFECYCLE.md)
- [ENGINE_PROTOCOL.md](./docs/ENGINE_PROTOCOL.md)
- [API.md](./docs/API.md)
- [PHASES.md](./docs/PHASES.md)
- [DEVELOPMENT.md](./docs/DEVELOPMENT.md)
- [DECISIONS.md](./docs/DECISIONS.md)
- [CHANGELOG.md](./docs/CHANGELOG.md)

## Quick Start (Phase 1)

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for setup and development instructions.
