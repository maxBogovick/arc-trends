use axum::{
    body::Body,
    extract::ConnectInfo,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Extension,
};
use deadpool_redis::Pool as RedisPool;
use deadpool_redis::redis::AsyncCommands;
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;

use crate::config::Config;

/// Rate limiting middleware using Redis INCR + EXPIRE
/// Key: `rate_limit:{ip}`, limit: config.rate_limit_requests_per_minute
pub async fn rate_limit_middleware(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Extension(redis): Extension<RedisPool>,
    Extension(config): Extension<Arc<Config>>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let ip = addr.ip().to_string();
    let key = format!("rate_limit:{}", ip);
    let limit = config.rate_limit_requests_per_minute;

    match check_rate_limit(&redis, &key, limit).await {
        Ok(true) => next.run(req).await,
        Ok(false) => {
            let body = axum::Json(json!({ "error": "Too Many Requests" }));
            (StatusCode::TOO_MANY_REQUESTS, body).into_response()
        }
        Err(e) => {
            tracing::error!("Rate limit check failed: {:?}", e);
            // On Redis error, allow the request through
            next.run(req).await
        }
    }
}

async fn check_rate_limit(redis: &RedisPool, key: &str, limit: u64) -> anyhow::Result<bool> {
    let mut conn = redis.get().await?;
    let count: i64 = conn.incr(key, 1i64).await?;
    if count == 1 {
        // First request in this window — set expiry of 60 seconds
        let _: () = conn.expire(key, 60).await?;
    }
    Ok(count <= limit as i64)
}
