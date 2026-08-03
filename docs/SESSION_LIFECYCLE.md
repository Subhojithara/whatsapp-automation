# Session Lifecycle & State Machine

## Canonical State Machine

```text
CREATED
   │
   ▼
STARTING ──► CONNECTING ──┬──► QR_READY ──► AUTHENTICATING ──┐
   │             │        │                                  │
   ▼             ▼        └──► READY ◄───────────────────────┘
 FAILED       FAILED             │
                                 ├──────────┬──────────┐
                                 ▼          ▼          ▼
                            DISCONNECTED  STOPPING   FAILED
                                 │          │
                                 ▼          ▼
                            RECONNECTING  STOPPED
                                 │          │
                                 ▼          ▼
                               READY     STARTING
```

## State Definitions

- `CREATED`: Session record exists in DB; engine process not yet spawned.
- `STARTING`: Spawn request issued; child process launching.
- `CONNECTING`: Engine initialized; connecting to WhatsApp socket.
- `QR_READY`: Engine emitted QR payload; awaiting user scan.
- `AUTHENTICATING`: QR scanned or pairing code submitted; establishing credentials.
- `READY`: Authenticated & actively connected to WhatsApp network.
- `DISCONNECTED`: Network drop or temporary disconnect; auto-reconnect pending.
- `RECONNECTING`: Reconnect loop active with exponential backoff.
- `STOPPING`: Termination requested by user; engine shutting down.
- `STOPPED`: Engine process terminated gracefully; credentials intact.
- `FAILED`: Unrecoverable error (e.g. `loggedOut`, 401, or max retries exceeded).
- `DELETED`: Terminal state; session record and auth directory wiped.
