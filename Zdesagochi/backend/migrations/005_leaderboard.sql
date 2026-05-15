-- Migration 005: Leaderboard view

CREATE OR REPLACE VIEW leaderboard_view AS
SELECT
    ROW_NUMBER() OVER (
        ORDER BY
            (COALESCE((p.state->>'level')::int, 1) * 100)
            + COALESCE((p.state->>'xp')::int, 0)
            + COALESCE((p.state->'stats'->>'bond')::numeric, 0)::int * 10
        DESC
    ) AS rank,
    u.username            AS owner_name,
    p.state->>'name'      AS pet_name,
    p.state->>'stage'     AS pet_stage,
    COALESCE((p.state->>'level')::int, 1) AS level,
    (COALESCE((p.state->>'level')::int, 1) * 100)
        + COALESCE((p.state->>'xp')::int, 0)
        + COALESCE((p.state->'stats'->>'bond')::numeric, 0)::int * 10
        AS score
FROM pets p
JOIN users u ON p.user_id = u.id;
