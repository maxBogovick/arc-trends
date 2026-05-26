-- Migration 007: Proactive routine config, analytics ingestion, audit log

CREATE TABLE IF NOT EXISTS proactive_configs (
    id          TEXT PRIMARY KEY,
    version     TEXT NOT NULL,
    config_json JSONB NOT NULL,
    signature   TEXT NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proactive_configs_active_created_idx
    ON proactive_configs(active, created_at DESC);

CREATE TABLE IF NOT EXISTS proactive_analytics (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload    JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proactive_analytics_created_idx
    ON proactive_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS proactive_analytics_user_created_idx
    ON proactive_analytics(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS proactive_audit_log (
    id            TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action        TEXT NOT NULL,
    details       JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proactive_audit_created_idx
    ON proactive_audit_log(created_at DESC);
