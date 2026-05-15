-- Migration 002: Economy

CREATE TABLE IF NOT EXISTS user_coins (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS user_inventory (
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id  TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, item_id)
);
