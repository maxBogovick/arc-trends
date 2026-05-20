use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use deadpool_redis::{Config as RedisConfig, Runtime};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: deadpool_redis::Pool,
    pub config: Arc<Config>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self> {
        // Create PostgreSQL connection pool with sane defaults
        let db = PgPoolOptions::new()
            .max_connections(20)
            .min_connections(2)
            .acquire_timeout(Duration::from_secs(5))
            .connect(&config.database_url)
            .await?;

        // Create Redis connection pool
        let redis_cfg = RedisConfig::from_url(&config.redis_url);
        let redis = redis_cfg.create_pool(Some(Runtime::Tokio1))?;

        Ok(Self {
            db,
            redis,
            config: Arc::new(config),
        })
    }
}
