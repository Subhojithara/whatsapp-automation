CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY NOT NULL,
    external_id     TEXT,
    session_id      TEXT NOT NULL,
    chat_id         TEXT NOT NULL,
    direction       TEXT NOT NULL DEFAULT 'outgoing',
    message_type    TEXT NOT NULL DEFAULT 'text',
    body            TEXT,
    status          TEXT NOT NULL DEFAULT 'PENDING',
    error           TEXT,
    created_at      TEXT NOT NULL,
    sent_at         TEXT,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
