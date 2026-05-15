use axum::{extract::State, response::IntoResponse, Json};
use deadpool_redis::redis::AsyncCommands;
use serde_json::json;

use crate::state::AppState;

pub async fn health(State(state): State<AppState>) -> impl IntoResponse {
    // Check DB
    let db_status = match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => "ok",
        Err(e) => {
            tracing::warn!("Health check DB failed: {:?}", e);
            "error"
        }
    };

    // Check Redis - use PING via AsyncCommands
    let redis_status = match state.redis.get().await {
        Ok(mut conn) => {
            // Use EXISTS as a no-op check since it's always available via AsyncCommands
            let result: Result<i64, _> = conn.exists("__health_check__").await;
            match result {
                Ok(_) => "ok",
                Err(e) => {
                    tracing::warn!("Health check Redis failed: {:?}", e);
                    "error"
                }
            }
        }
        Err(e) => {
            tracing::warn!("Health check Redis conn failed: {:?}", e);
            "error"
        }
    };

    let status = if db_status == "ok" && redis_status == "ok" {
        "ok"
    } else {
        "degraded"
    };

    Json(json!({
        "status": status,
        "db": db_status,
        "redis": redis_status
    }))
}
