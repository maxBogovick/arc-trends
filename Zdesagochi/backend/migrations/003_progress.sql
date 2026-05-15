-- Migration 003: Progress

CREATE TABLE IF NOT EXISTS user_achievements (
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    progress       INTEGER NOT NULL DEFAULT 0,
    unlocked       BOOLEAN NOT NULL DEFAULT false,
    unlocked_at    TIMESTAMPTZ,
    claimed        BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS user_quests (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quest_id   TEXT NOT NULL,
    progress   INTEGER NOT NULL DEFAULT 0,
    completed  BOOLEAN NOT NULL DEFAULT false,
    claimed    BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, quest_id, expires_at)
);
