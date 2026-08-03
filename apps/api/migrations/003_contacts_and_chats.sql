-- Migration 003: Contacts, Chats, and Messages expansion
CREATE TABLE IF NOT EXISTS contacts (
    id           TEXT PRIMARY KEY NOT NULL,
    jid          TEXT NOT NULL,
    name         TEXT,
    phone_number TEXT,
    avatar_url   TEXT,
    is_group     INTEGER DEFAULT 0,
    session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    synced_at    TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    UNIQUE(session_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_contacts_session_id ON contacts(session_id);
CREATE INDEX IF NOT EXISTS idx_contacts_jid ON contacts(jid);

CREATE TABLE IF NOT EXISTS chats (
    id                TEXT PRIMARY KEY NOT NULL,
    jid               TEXT NOT NULL,
    name              TEXT,
    is_group          INTEGER DEFAULT 0,
    last_message_body TEXT,
    last_message_at   TEXT,
    unread_count      INTEGER DEFAULT 0,
    session_id        TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    UNIQUE(session_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_chats_session_id ON chats(session_id);
CREATE INDEX IF NOT EXISTS idx_chats_jid ON chats(jid);
CREATE INDEX IF NOT EXISTS idx_chats_last_message ON chats(session_id, last_message_at DESC);

-- Messages expansion for chat UI & direction handling
ALTER TABLE messages ADD COLUMN sender_jid TEXT;
ALTER TABLE messages ADD COLUMN from_me INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_messages_session_chat ON messages(session_id, chat_id, created_at DESC);
