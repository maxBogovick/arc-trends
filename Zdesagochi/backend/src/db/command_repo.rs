use sqlx::PgPool;
use serde_json::Value;
use crate::error::AppError;

pub async fn is_command_processed(pool: &PgPool, command_id: &str) -> Result<bool, AppError> {
    let row = sqlx::query_as::<_, (bool,)>(
        "SELECT EXISTS(SELECT 1 FROM pet_commands WHERE id = $1)"
    )
    .bind(command_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_command(
    pool: &PgPool,
    id: &str,
    pet_id: &str,
    user_id: &str,
    command_type: &str,
    command_json: &Value,
    result_json: Option<&Value>,
    status: &str,
    reject_reason: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO pet_commands
           (id, pet_id, user_id, command_type, command_json, result_json, status, reject_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING"
    )
    .bind(id)
    .bind(pet_id)
    .bind(user_id)
    .bind(command_type)
    .bind(command_json)
    .bind(result_json)
    .bind(status)
    .bind(reject_reason)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_results_since(
    pool: &PgPool,
    pet_id: &str,
    since_id: Option<&str>,
) -> Result<Vec<Value>, AppError> {
    let rows: Vec<(Value,)> = if let Some(sid) = since_id {
        sqlx::query_as::<_, (Value,)>(
            "SELECT result_json FROM pet_commands
             WHERE pet_id = $1 AND status = 'accepted' AND result_json IS NOT NULL
               AND created_at > (SELECT created_at FROM pet_commands WHERE id = $2)
             ORDER BY created_at ASC LIMIT 100"
        )
        .bind(pet_id)
        .bind(sid)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, (Value,)>(
            "SELECT result_json FROM pet_commands
             WHERE pet_id = $1 AND status = 'accepted' AND result_json IS NOT NULL
             ORDER BY created_at DESC LIMIT 50"
        )
        .bind(pet_id)
        .fetch_all(pool)
        .await?
    };

    Ok(rows.into_iter().map(|r| r.0).collect())
}
