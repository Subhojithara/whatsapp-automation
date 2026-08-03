-- Migration 005: Create Campaigns, Anti-Ban Config, Steps, Recipients, Logs, Blacklist, and Templates

-- 1. Anti-Ban Config Table
CREATE TABLE IF NOT EXISTS campaign_anti_ban_config (
    id                               TEXT PRIMARY KEY NOT NULL,
    campaign_id                      TEXT NOT NULL,
    min_delay_sec                    INTEGER NOT NULL DEFAULT 5,
    max_delay_sec                    INTEGER NOT NULL DEFAULT 15,
    typing_duration_sec              INTEGER NOT NULL DEFAULT 2,
    enable_spintax                   INTEGER NOT NULL DEFAULT 1,
    working_hours_start              TEXT NOT NULL DEFAULT '09:00',
    working_hours_end                TEXT NOT NULL DEFAULT '18:00',
    timezone                         TEXT NOT NULL DEFAULT 'UTC',
    max_messages_per_session_per_day INTEGER NOT NULL DEFAULT 100,
    warmup_enabled                   INTEGER NOT NULL DEFAULT 1
);

-- 2. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id                 TEXT PRIMARY KEY NOT NULL,
    name               TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'DRAFT',
    anti_ban_config_id TEXT REFERENCES campaign_anti_ban_config(id) ON DELETE SET NULL,
    total_recipients   INTEGER NOT NULL DEFAULT 0,
    sent_count         INTEGER NOT NULL DEFAULT 0,
    delivered_count    INTEGER NOT NULL DEFAULT 0,
    read_count         INTEGER NOT NULL DEFAULT 0,
    replied_count      INTEGER NOT NULL DEFAULT 0,
    failed_count       INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- 3. Campaign Steps Table
CREATE TABLE IF NOT EXISTS campaign_steps (
    id                       TEXT PRIMARY KEY NOT NULL,
    campaign_id              TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    step_number              INTEGER NOT NULL,
    delay_after_previous_sec INTEGER NOT NULL DEFAULT 0,
    template_text            TEXT NOT NULL,
    media_url                TEXT,
    UNIQUE(campaign_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign ON campaign_steps(campaign_id);

-- 4. Campaign Recipients Table
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id                    TEXT PRIMARY KEY NOT NULL,
    campaign_id           TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    phone_number          TEXT NOT NULL,
    jid                   TEXT NOT NULL,
    custom_variables_json TEXT,
    current_step          INTEGER NOT NULL DEFAULT 1,
    status                TEXT NOT NULL DEFAULT 'PENDING',
    next_scheduled_at     TEXT,
    last_sent_at          TEXT,
    UNIQUE(campaign_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_scheduled ON campaign_recipients(status, next_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_phone ON campaign_recipients(phone_number);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_jid ON campaign_recipients(jid);

-- 5. Campaign Execution Audit Logs Table
CREATE TABLE IF NOT EXISTS campaign_logs (
    id            TEXT PRIMARY KEY NOT NULL,
    campaign_id   TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    recipient_id  TEXT NOT NULL REFERENCES campaign_recipients(id) ON DELETE CASCADE,
    step_id       TEXT NOT NULL REFERENCES campaign_steps(id) ON DELETE CASCADE,
    session_id    TEXT,
    status        TEXT NOT NULL,
    error_message TEXT,
    sent_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign ON campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_dedup ON campaign_logs(recipient_id, step_id);

-- 6. Global Blacklist Table
CREATE TABLE IF NOT EXISTS blacklist (
    id           TEXT PRIMARY KEY NOT NULL,
    phone_number TEXT NOT NULL UNIQUE,
    reason       TEXT,
    added_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone_number);

-- 7. Campaign Message Templates Table
CREATE TABLE IF NOT EXISTS campaign_templates (
    id             TEXT PRIMARY KEY NOT NULL,
    name           TEXT NOT NULL,
    category       TEXT,
    body_text      TEXT NOT NULL,
    variables_json TEXT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_campaign_templates_category ON campaign_templates(category);
