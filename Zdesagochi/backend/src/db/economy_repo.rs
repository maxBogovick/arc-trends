use crate::{engine::catalog, error::AppError};
use sqlx::{PgPool, Postgres, Transaction};

type Tx<'a> = Transaction<'a, Postgres>;

pub async fn get_coins(pool: &PgPool, user_id: &str) -> Result<i32, AppError> {
    let row = sqlx::query_as::<_, (i32,)>("SELECT balance FROM user_coins WHERE user_id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|r| r.0).unwrap_or(0))
}

pub async fn add_coins(pool: &PgPool, user_id: &str, delta: i32) -> Result<i32, AppError> {
    let row = sqlx::query_as::<_, (i32,)>(
        "INSERT INTO user_coins (user_id, balance) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET balance = user_coins.balance + $2
         RETURNING balance",
    )
    .bind(user_id)
    .bind(delta)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn spend_coins(pool: &PgPool, user_id: &str, amount: i32) -> Result<i32, AppError> {
    let row = sqlx::query_as::<_, (i32,)>(
        "UPDATE user_coins SET balance = balance - $2
         WHERE user_id = $1 AND balance >= $2
         RETURNING balance",
    )
    .bind(user_id)
    .bind(amount)
    .fetch_optional(pool)
    .await?;
    row.map(|r| r.0)
        .ok_or_else(|| AppError::BadRequest("Недостаточно монет".into()))
}

pub async fn get_inventory(pool: &PgPool, user_id: &str) -> Result<Vec<(String, i32)>, AppError> {
    let rows = sqlx::query_as::<_, (String, i32)>(
        "SELECT item_id, quantity FROM user_inventory WHERE user_id = $1 AND quantity > 0",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn add_inventory(
    pool: &PgPool,
    user_id: &str,
    item_id: &str,
    qty: i32,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_inventory.quantity + $3",
    )
    .bind(user_id)
    .bind(item_id)
    .bind(qty)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn use_inventory_item(
    pool: &PgPool,
    user_id: &str,
    item_id: &str,
) -> Result<(), AppError> {
    let row = sqlx::query_as::<_, (i32,)>(
        "UPDATE user_inventory SET quantity = quantity - 1
         WHERE user_id = $1 AND item_id = $2 AND quantity > 0
         RETURNING quantity",
    )
    .bind(user_id)
    .bind(item_id)
    .fetch_optional(pool)
    .await?;
    row.map(|_| ())
        .ok_or_else(|| AppError::NotFound(format!("Предмет {} не найден в инвентаре", item_id)))
}

pub async fn increment_shop_buy_count(pool: &PgPool, user_id: &str) -> Result<(), AppError> {
    for achievement_id in ["shopaholic", "collector"] {
        let target = achievement_target(achievement_id);
        sqlx::query(
            "INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, claimed)
             VALUES ($1, $2, 1, 1 >= $3, false)
             ON CONFLICT (user_id, achievement_id) DO UPDATE SET
               progress = LEAST(user_achievements.progress + 1, $3),
               unlocked = LEAST(user_achievements.progress + 1, $3) >= $3,
               unlocked_at = CASE
                 WHEN NOT user_achievements.unlocked AND LEAST(user_achievements.progress + 1, $3) >= $3
                 THEN NOW() ELSE user_achievements.unlocked_at END",
        )
        .bind(user_id)
        .bind(achievement_id)
        .bind(target)
        .execute(pool)
        .await?;
    }
    Ok(())
}

// ─── Transactional variants ─────────────────────────────────────────────────

pub async fn add_coins_tx(tx: &mut Tx<'_>, user_id: &str, delta: i32) -> Result<i32, AppError> {
    let row = sqlx::query_as::<_, (i32,)>(
        "INSERT INTO user_coins (user_id, balance) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET balance = user_coins.balance + $2
         RETURNING balance",
    )
    .bind(user_id)
    .bind(delta)
    .fetch_one(&mut **tx)
    .await?;
    Ok(row.0)
}

pub async fn spend_coins_tx(tx: &mut Tx<'_>, user_id: &str, amount: i32) -> Result<i32, AppError> {
    let row = sqlx::query_as::<_, (i32,)>(
        "UPDATE user_coins SET balance = balance - $2
         WHERE user_id = $1 AND balance >= $2
         RETURNING balance",
    )
    .bind(user_id)
    .bind(amount)
    .fetch_optional(&mut **tx)
    .await?;
    row.map(|r| r.0)
        .ok_or_else(|| AppError::BadRequest("Недостаточно монет".into()))
}

pub async fn add_inventory_tx(
    tx: &mut Tx<'_>,
    user_id: &str,
    item_id: &str,
    qty: i32,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_inventory.quantity + $3",
    )
    .bind(user_id)
    .bind(item_id)
    .bind(qty)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn use_inventory_item_tx(
    tx: &mut Tx<'_>,
    user_id: &str,
    item_id: &str,
) -> Result<(), AppError> {
    let row = sqlx::query_as::<_, (i32,)>(
        "UPDATE user_inventory SET quantity = quantity - 1
         WHERE user_id = $1 AND item_id = $2 AND quantity > 0
         RETURNING quantity",
    )
    .bind(user_id)
    .bind(item_id)
    .fetch_optional(&mut **tx)
    .await?;
    row.map(|_| ())
        .ok_or_else(|| AppError::NotFound(format!("Предмет {} не найден в инвентаре", item_id)))
}

pub async fn increment_shop_buy_count_tx(tx: &mut Tx<'_>, user_id: &str) -> Result<(), AppError> {
    for achievement_id in ["shopaholic", "collector"] {
        let target = achievement_target(achievement_id);
        sqlx::query(
            "INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, claimed)
             VALUES ($1, $2, 1, 1 >= $3, false)
             ON CONFLICT (user_id, achievement_id) DO UPDATE SET
               progress = LEAST(user_achievements.progress + 1, $3),
               unlocked = LEAST(user_achievements.progress + 1, $3) >= $3,
               unlocked_at = CASE
                 WHEN NOT user_achievements.unlocked AND LEAST(user_achievements.progress + 1, $3) >= $3
                 THEN NOW() ELSE user_achievements.unlocked_at END",
        )
        .bind(user_id)
        .bind(achievement_id)
        .bind(target)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

fn achievement_target(achievement_id: &str) -> i32 {
    catalog::achievement_defs()
        .iter()
        .find(|definition| definition.id == achievement_id)
        .map(|definition| definition.target)
        .unwrap_or(1)
}
