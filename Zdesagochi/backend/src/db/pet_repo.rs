use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool, Postgres, Transaction};

use crate::{
    domain::pet::{Pet, PetEvent},
    error::AppError,
};

type Tx<'a> = Transaction<'a, Postgres>;

#[derive(FromRow)]
struct PetStateRow {
    state: serde_json::Value,
}

#[derive(FromRow)]
struct PetEventRow {
    id: String,
    event_type: String,
    description: String,
    emoji: String,
    xp_gained: Option<i32>,
    coins_gained: Option<i32>,
    created_at: DateTime<Utc>,
}

pub async fn get_pet(pool: &PgPool, user_id: &str) -> Result<Option<Pet>, AppError> {
    let row = sqlx::query_as::<_, PetStateRow>("SELECT state FROM pets WHERE user_id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

    match row {
        None => Ok(None),
        Some(r) => {
            let pet: Pet = serde_json::from_value(r.state).map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Failed to deserialize pet: {}", e))
            })?;
            Ok(Some(pet))
        }
    }
}

pub async fn create_pet(pool: &PgPool, user_id: &str, pet: &Pet) -> Result<(), AppError> {
    let state = serde_json::to_value(pet)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to serialize pet: {}", e)))?;

    sqlx::query("INSERT INTO pets (id, user_id, state) VALUES ($1, $2, $3)")
        .bind(&pet.id)
        .bind(user_id)
        .bind(state)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn upsert_pet(pool: &PgPool, user_id: &str, pet: &Pet) -> Result<(), AppError> {
    let state = serde_json::to_value(pet)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to serialize pet: {}", e)))?;

    sqlx::query(
        r#"
        INSERT INTO pets (id, user_id, state, updated_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (user_id)
        DO UPDATE SET state = EXCLUDED.state, updated_at = now()
        "#,
    )
    .bind(&pet.id)
    .bind(user_id)
    .bind(state)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn create_pet_tx(tx: &mut Tx<'_>, user_id: &str, pet: &Pet) -> Result<(), AppError> {
    let state = serde_json::to_value(pet)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to serialize pet: {}", e)))?;

    sqlx::query("INSERT INTO pets (id, user_id, state) VALUES ($1, $2, $3)")
        .bind(&pet.id)
        .bind(user_id)
        .bind(state)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn upsert_pet_tx(tx: &mut Tx<'_>, user_id: &str, pet: &Pet) -> Result<(), AppError> {
    let state = serde_json::to_value(pet)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to serialize pet: {}", e)))?;

    sqlx::query(
        r#"
        INSERT INTO pets (id, user_id, state, updated_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (user_id)
        DO UPDATE SET state = EXCLUDED.state, updated_at = now()
        "#,
    )
    .bind(&pet.id)
    .bind(user_id)
    .bind(state)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn get_events(
    pool: &PgPool,
    pet_id: &str,
    limit: i64,
) -> Result<Vec<PetEvent>, AppError> {
    let rows = sqlx::query_as::<_, PetEventRow>(
        r#"
        SELECT id, event_type, description, emoji, xp_gained, coins_gained, created_at
        FROM pet_events
        WHERE pet_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
    )
    .bind(pet_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let events = rows
        .into_iter()
        .map(|r| PetEvent {
            id: r.id,
            timestamp: r.created_at.to_rfc3339(),
            event_type: r.event_type,
            description: r.description,
            emoji: r.emoji,
            xp_gained: r.xp_gained,
            coins_gained: r.coins_gained,
        })
        .collect();

    Ok(events)
}

pub async fn get_all_pets(pool: &PgPool) -> Result<Vec<(String, Pet)>, AppError> {
    #[derive(sqlx::FromRow)]
    struct Row {
        user_id: String,
        state: serde_json::Value,
    }

    let rows = sqlx::query_as::<_, Row>("SELECT user_id, state FROM pets")
        .fetch_all(pool)
        .await?;

    let mut result = Vec::new();
    for row in rows {
        if let Ok(pet) = serde_json::from_value::<Pet>(row.state) {
            result.push((row.user_id, pet));
        }
    }
    Ok(result)
}

pub async fn insert_event(pool: &PgPool, event: &PetEvent, pet_id: &str) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO pet_events (id, pet_id, event_type, description, emoji, xp_gained, coins_gained)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(&event.id)
    .bind(pet_id)
    .bind(&event.event_type)
    .bind(&event.description)
    .bind(&event.emoji)
    .bind(event.xp_gained)
    .bind(event.coins_gained)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert_event_tx(
    tx: &mut Tx<'_>,
    event: &PetEvent,
    pet_id: &str,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO pet_events (id, pet_id, event_type, description, emoji, xp_gained, coins_gained)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(&event.id)
    .bind(pet_id)
    .bind(&event.event_type)
    .bind(&event.description)
    .bind(&event.emoji)
    .bind(event.xp_gained)
    .bind(event.coins_gained)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
