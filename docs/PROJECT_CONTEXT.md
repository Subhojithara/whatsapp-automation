# Project Context: Velurix ReachOut Automation

## Overview

Velurix ReachOut Automation is a production-oriented, self-hosted multi-session WhatsApp automation, messaging, and API gateway platform.

## Core Architecture Principle

"Build the smallest architecture that correctly supports the future."

The platform separates authoritative backend control and session management (Rust/Actix) from WhatsApp protocol execution (Node.js/Baileys), communicating via structured stdio JSON-line IPC.

```text
User ──► Next.js Dashboard ──► Rust / Actix API ──► Session Service ──► Engine Manager ──► Node.js Baileys ──► WhatsApp
```

## Technology Stack

- **Frontend**: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query v5, Lucide Icons.
- **Core Backend**: Rust, Actix Web 4, Tokio, SQLx, SQLite, tracing, actix-ws.
- **WhatsApp Engine**: Node.js 20+, TypeScript, `@whiskeysockets/baileys`.
- **Database**: SQLite (SQLx migrations) — designed for clean migration to PostgreSQL.

## Current Implementation State (Phase 1)

Phase 1 focuses exclusively on the core multi-session lifecycle and authentication:
- Multi-session creation and lifecycle management (`ses_<UUID>`)
- QR Code and Pairing Code authentication
- Auth state persistence (`data/sessions/{session_id}/auth/`)
- Platform restart session recovery
- Realtime WebSocket updates to Next.js dashboard
