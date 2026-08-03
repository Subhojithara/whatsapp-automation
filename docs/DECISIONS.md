# Architecture Decision Records (ADR)

## ADR 001: Engine Communication Protocol
- **Date**: 2026-07-26
- **Context**: Need reliable communication between Rust API and Node.js Baileys engine.
- **Decision**: Stdio single-line JSON IPC (`stdin`/`stdout`).
- **Rationale**: Zero port allocation issues, no network listening/exposure, works seamlessly across operating systems, native supervision via Tokio child processes.

## ADR 002: Process Isolation Strategy
- **Date**: 2026-07-26
- **Context**: Running multiple WhatsApp sessions concurrently.
- **Decision**: One Node.js child process per WhatsApp session.
- **Rationale**: Fault isolation — if a Baileys session crashes or experiences a memory leak, it does not impact any other session.

## ADR 003: Session Identification Format
- **Date**: 2026-07-26
- **Context**: Choosing session primary key structure.
- **Decision**: `ses_<UUID>` (e.g. `ses_12345678-1234-1234-1234-123456789abc`).
- **Rationale**: Globally unique, easily identifiable in log files, avoids ambiguity with integer IDs.

## ADR 004: Auth Storage Path
- **Date**: 2026-07-26
- **Context**: Storing Baileys signal keys & session credentials.
- **Decision**: `data/sessions/{session_id}/auth/`.
- **Rationale**: Isolated per session, contained within `data/` directory (gitignored), secure filesystem boundaries.
