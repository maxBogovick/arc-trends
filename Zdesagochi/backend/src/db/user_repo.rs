use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool, Postgres, Transaction};

use crate::error::AppError;

type Tx<'a> = Transaction<'a, Postgres>;

#[derive(Debug, Clone, FromRow)]
pub struct DbUser {
    pub id: String,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

pub async fn create_user(
    pool: &PgPool,
    id: &str,
    username: &str,
    email: &str,
    password_hash: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(username)
    .bind(email)
    .bind(password_hash)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Option<DbUser>, AppError> {
    let row = sqlx::query_as::<_, DbUser>(
        "SELECT id, username, email, password_hash, created_at FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn create_user_tx(
    tx: &mut Tx<'_>,
    id: &str,
    username: &str,
    email: &str,
    password_hash: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(username)
    .bind(email)
    .bind(password_hash)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn find_by_id(pool: &PgPool, id: &str) -> Result<Option<DbUser>, AppError> {
    let row = sqlx::query_as::<_, DbUser>(
        "SELECT id, username, email, password_hash, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}
