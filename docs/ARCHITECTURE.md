# Architecture Specification

## Overview Diagram

```mermaid
graph TB
    subgraph Frontend ["Next.js App Router (apps/web)"]
        UI[Dashboard /sessions]
        TQ[TanStack Query]
        WS_CLIENT[WebSocket Hook]
    end

    subgraph Backend ["Rust + Actix Web (apps/api)"]
        API[REST API Handlers]
        WS_GW[actix-ws Gateway]
        SS[Session Service]
        EM[Engine Manager]
        DB[(SQLite - SQLx)]
        HUB[Tokio Broadcast Hub]
    end

    subgraph Engines ["Engine Subprocesses (apps/whatsapp-engine)"]
        E1["Node.js Engine Process 1<br/>(ses_01...)"]
        E2["Node.js Engine Process 2<br/>(ses_02...)"]
    end

    UI --> TQ
    UI --> API
    WS_CLIENT <--> WS_GW
    API --> SS
    SS --> DB
    SS --> EM
    SS --> HUB
    HUB --> WS_GW
    EM -->|"stdin / stdout IPC"| E1
    EM -->|"stdin / stdout IPC"| E2
    E1 <-->|WebSocket| WA1[WhatsApp Servers]
    E2 <-->|WebSocket| WA2[WhatsApp Servers]
```

## Component Boundaries

### 1. Next.js Dashboard (`apps/web`)
- Provides UI for session management, connection state monitoring, QR display, and pairing code input.
- Receives realtime state events via WebSocket to invalidate TanStack Query cache.

### 2. Rust Actix Backend (`apps/api`)
- Authoritative application layer.
- Manages session records in SQLite database (`sessions` table).
- Controls session state machine transitions.
- Manages lifecycle of Node.js engine child processes (`tokio::process::Command`).
- Broadcasts session state changes over WebSocket.

### 3. WhatsApp Engine (`apps/whatsapp-engine`)
- Node.js runtime process executed per session.
- Runs `@whiskeysockets/baileys` to communicate with WhatsApp Web servers.
- Receives JSON-line commands on `stdin` (`engine.start`, `engine.stop`, `engine.request_pairing_code`).
- Emits JSON-line events on `stdout` (`session.qr`, `session.ready`, `session.disconnected`, etc.).
- Persists auth material to `data/sessions/{session_id}/auth/`.
