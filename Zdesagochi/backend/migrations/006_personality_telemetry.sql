-- Migration 006: Personality telemetry samples

CREATE TABLE IF NOT EXISTS pet_personality_telemetry (
    id                       TEXT PRIMARY KEY,
    pet_id                   TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    command_id               TEXT NOT NULL REFERENCES pet_commands(id) ON DELETE CASCADE,
    command_type             TEXT NOT NULL,
    personality_id           TEXT NOT NULL,
    formation_complete       BOOLEAN NOT NULL,
    formation_progress       DOUBLE PRECISION NOT NULL,
    current_target_zone      TEXT,
    evolution_readiness      DOUBLE PRECISION NOT NULL,
    evolution_readiness_target TEXT,
    dominant_behavior_axis   TEXT,
    behavior_sample_count    INTEGER NOT NULL,
    trait_drift              JSONB NOT NULL DEFAULT '{}'::jsonb,
    behavior_drift           JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_types              JSONB NOT NULL DEFAULT '[]'::jsonb,
    evolution_proposal_target TEXT,
    sample_json              JSONB NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (command_id)
);

CREATE INDEX IF NOT EXISTS pet_personality_telemetry_pet_id_idx
    ON pet_personality_telemetry(pet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pet_personality_telemetry_user_id_idx
    ON pet_personality_telemetry(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pet_personality_telemetry_target_idx
    ON pet_personality_telemetry(evolution_readiness_target, created_at DESC)
    WHERE evolution_readiness_target IS NOT NULL;
