use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};

use crate::error::AppError;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ProactiveConfigRecord {
    pub id: String,
    pub version: String,
    pub config_json: Value,
    pub signature: String,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ProactiveAnalyticsRecord {
    pub id: String,
    pub user_id: String,
    pub payload: Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ProactiveAuditRecord {
    pub id: String,
    pub actor_user_id: String,
    pub action: String,
    pub details: Value,
    pub created_at: DateTime<Utc>,
}

pub async fn get_active_config(pool: &PgPool) -> Result<Option<ProactiveConfigRecord>, AppError> {
    let row = sqlx::query_as::<_, ProactiveConfigRecord>(
        "SELECT id, version, config_json, signature, created_by, created_at
         FROM proactive_configs
         WHERE active = TRUE
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn insert_config(
    pool: &PgPool,
    id: &str,
    version: &str,
    config_json: &Value,
    signature: &str,
    created_by: &str,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE proactive_configs SET active = FALSE WHERE active = TRUE")
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO proactive_configs (id, version, config_json, signature, active, created_by)
         VALUES ($1, $2, $3, $4, TRUE, $5)",
    )
    .bind(id)
    .bind(version)
    .bind(config_json)
    .bind(signature)
    .bind(created_by)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

pub async fn insert_analytics(
    pool: &PgPool,
    id: &str,
    user_id: &str,
    payload: &Value,
) -> Result<(), AppError> {
    sqlx::query("INSERT INTO proactive_analytics (id, user_id, payload) VALUES ($1, $2, $3)")
        .bind(id)
        .bind(user_id)
        .bind(payload)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_recent_analytics(pool: &PgPool, limit: i64) -> Result<Vec<ProactiveAnalyticsRecord>, AppError> {
    let rows = sqlx::query_as::<_, ProactiveAnalyticsRecord>(
        "SELECT id, user_id, payload, created_at
         FROM proactive_analytics
         ORDER BY created_at DESC
         LIMIT $1",
    )
    .bind(limit.clamp(1, 500))
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn insert_audit(
    pool: &PgPool,
    id: &str,
    actor_user_id: &str,
    action: &str,
    details: &Value,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO proactive_audit_log (id, actor_user_id, action, details)
         VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(actor_user_id)
    .bind(action)
    .bind(details)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_recent_audit(pool: &PgPool, limit: i64) -> Result<Vec<ProactiveAuditRecord>, AppError> {
    let rows = sqlx::query_as::<_, ProactiveAuditRecord>(
        "SELECT id, actor_user_id, action, details, created_at
         FROM proactive_audit_log
         ORDER BY created_at DESC
         LIMIT $1",
    )
    .bind(limit.clamp(1, 500))
    .fetch_all(pool)
    .await?;
    Ok(rows)
}
