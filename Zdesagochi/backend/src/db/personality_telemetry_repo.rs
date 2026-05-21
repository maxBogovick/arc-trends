use crate::error::AppError;
use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};

type Tx<'a> = Transaction<'a, Postgres>;

#[allow(clippy::too_many_arguments)]
pub async fn insert_sample_tx(
    tx: &mut Tx<'_>,
    id: &str,
    pet_id: &str,
    user_id: &str,
    command_id: &str,
    command_type: &str,
    sample: &Value,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO pet_personality_telemetry
           (id, pet_id, user_id, command_id, command_type, personality_id,
            formation_complete, formation_progress, current_target_zone,
            evolution_readiness, evolution_readiness_target, dominant_behavior_axis,
            behavior_sample_count, trait_drift, behavior_drift, event_types,
            evolution_proposal_target, sample_json)
         VALUES
           ($1, $2, $3, $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18)
         ON CONFLICT (command_id) DO NOTHING",
    )
    .bind(id)
    .bind(pet_id)
    .bind(user_id)
    .bind(command_id)
    .bind(command_type)
    .bind(
        sample
            .get("personalityId")
            .and_then(Value::as_str)
            .unwrap_or(""),
    )
    .bind(
        sample
            .get("formationComplete")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    )
    .bind(
        sample
            .get("formationProgress")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    )
    .bind(sample.get("currentTargetZone").and_then(Value::as_str))
    .bind(
        sample
            .get("evolutionReadiness")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    )
    .bind(
        sample
            .get("evolutionReadinessTarget")
            .and_then(Value::as_str),
    )
    .bind(sample.get("dominantBehaviorAxis").and_then(Value::as_str))
    .bind(
        sample
            .get("behaviorSampleCount")
            .and_then(Value::as_i64)
            .unwrap_or(0) as i32,
    )
    .bind(
        sample
            .get("traitDrift")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({})),
    )
    .bind(
        sample
            .get("behaviorDrift")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({})),
    )
    .bind(
        sample
            .get("eventTypes")
            .cloned()
            .unwrap_or_else(|| serde_json::json!([])),
    )
    .bind(
        sample
            .get("evolutionProposalTarget")
            .and_then(Value::as_str),
    )
    .bind(sample)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn get_recent_samples(
    pool: &PgPool,
    pet_id: &str,
    limit: i64,
) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, (Value,)>(
        "SELECT sample_json
         FROM pet_personality_telemetry
         WHERE pet_id = $1
         ORDER BY created_at DESC
         LIMIT $2",
    )
    .bind(pet_id)
    .bind(limit.clamp(1, 200))
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|row| row.0).collect())
}
