-- Migration 004: Rooms

CREATE TABLE IF NOT EXISTS user_rooms (
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id  TEXT NOT NULL,
    unlocked BOOLEAN NOT NULL DEFAULT false,
    equipped BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, room_id)
);
