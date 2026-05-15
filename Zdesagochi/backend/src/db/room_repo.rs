use sqlx::{PgPool, Postgres, Transaction};
use crate::{domain::rooms::{Room, LeaderboardEntry}, engine::catalog, error::AppError};

type Tx<'a> = Transaction<'a, Postgres>;

pub async fn get_rooms(pool: &PgPool, user_id: &str) -> Result<Vec<Room>, AppError> {
    // Seed default room for new users
    sqlx::query(
        "INSERT INTO user_rooms (user_id, room_id, unlocked, equipped)
         VALUES ($1, 'default', true, true)
         ON CONFLICT (user_id, room_id) DO NOTHING"
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    #[derive(sqlx::FromRow)]
    struct Row { room_id: String, unlocked: bool }

    let rows = sqlx::query_as::<_, Row>(
        "SELECT room_id, unlocked FROM user_rooms WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let defs = catalog::rooms_catalog();
    let rooms = defs.into_iter().map(|def| {
        let unlocked = rows.iter().any(|r| r.room_id == def.id && r.unlocked)
            || def.price == 0;
        def.into_room(unlocked)
    }).collect();
    Ok(rooms)
}

pub async fn buy_room(pool: &PgPool, user_id: &str, room_id: &str) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO user_rooms (user_id, room_id, unlocked, equipped)
         VALUES ($1, $2, true, false)
         ON CONFLICT (user_id, room_id) DO UPDATE SET unlocked = true"
    )
    .bind(user_id)
    .bind(room_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn buy_room_tx(tx: &mut Tx<'_>, user_id: &str, room_id: &str) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO user_rooms (user_id, room_id, unlocked, equipped)
         VALUES ($1, $2, true, false)
         ON CONFLICT (user_id, room_id) DO UPDATE SET unlocked = true"
    )
    .bind(user_id)
    .bind(room_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn equip_room(pool: &PgPool, user_id: &str, room_id: &str) -> Result<(), AppError> {
    // Default room can always be equipped
    let is_default = catalog::rooms_catalog().iter().any(|r| r.id == room_id && r.price == 0);

    if !is_default {
        // Check room is unlocked / owned
        let owned = sqlx::query_as::<_, (bool,)>(
            "SELECT unlocked FROM user_rooms WHERE user_id = $1 AND room_id = $2"
        )
        .bind(user_id)
        .bind(room_id)
        .fetch_optional(pool)
        .await?;

        if !owned.map(|r| r.0).unwrap_or(false) {
            return Err(AppError::Forbidden);
        }
    }

    // Ensure row exists for the equipped room (default case may not be seeded yet)
    sqlx::query(
        "INSERT INTO user_rooms (user_id, room_id, unlocked, equipped)
         VALUES ($1, $2, true, false)
         ON CONFLICT (user_id, room_id) DO NOTHING"
    )
    .bind(user_id)
    .bind(room_id)
    .execute(pool)
    .await?;

    // Persist equipped flag: only the chosen room becomes equipped
    sqlx::query(
        "UPDATE user_rooms SET equipped = (room_id = $2) WHERE user_id = $1"
    )
    .bind(user_id)
    .bind(room_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_leaderboard(pool: &PgPool) -> Result<Vec<LeaderboardEntry>, AppError> {
    #[derive(sqlx::FromRow)]
    struct Row {
        rank: i64,
        owner_name: String,
        pet_name: String,
        pet_stage: String,
        level: i64,
        score: i64,
    }

    let rows = sqlx::query_as::<_, Row>(
        "SELECT rank, owner_name, pet_name, pet_stage, level, score FROM leaderboard_view LIMIT 20"
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| LeaderboardEntry {
        rank: r.rank as i32,
        owner_name: r.owner_name,
        pet_name: r.pet_name,
        pet_stage: r.pet_stage,
        level: r.level as i32,
        score: r.score,
    }).collect())
}
