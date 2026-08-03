CREATE TABLE IF NOT EXISTS sessions (
    id                   TEXT PRIMARY KEY NOT NULL,
    name                 TEXT NOT NULL,
    engine               TEXT NOT NULL DEFAULT 'baileys',
    status               TEXT NOT NULL DEFAULT 'CREATED',
    phone_number         TEXT,
    display_name         TEXT,
    last_error           TEXT,
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_connected_at    TEXT,
    last_disconnected_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
