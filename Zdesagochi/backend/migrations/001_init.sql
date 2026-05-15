-- Migration 001: Initial schema

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pets (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state      JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pets_user_id_idx ON pets(user_id);

CREATE TABLE IF NOT EXISTS pet_events (
    id           TEXT PRIMARY KEY,
    pet_id       TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    event_type   TEXT NOT NULL,
    description  TEXT NOT NULL,
    emoji        TEXT NOT NULL DEFAULT '',
    xp_gained    INTEGER,
    coins_gained INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pet_events_pet_id_idx ON pet_events(pet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pet_commands (
    id           TEXT PRIMARY KEY,
    pet_id       TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL,
    command_type TEXT NOT NULL,
    command_json JSONB NOT NULL,
    result_json  JSONB,
    status       TEXT NOT NULL DEFAULT 'accepted',
    reject_reason TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pet_commands_pet_id_idx ON pet_commands(pet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pet_commands_user_id_idx ON pet_commands(user_id);
