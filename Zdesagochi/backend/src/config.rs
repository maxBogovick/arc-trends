use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub jwt_expiry_seconds: u64,
    pub refresh_token_expiry_seconds: u64,
    pub host: String,
    pub port: u16,
    pub environment: String,
    pub cors_origins: Vec<String>,
    #[allow(dead_code)]
    pub log_level: String,
    pub rate_limit_requests_per_minute: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let jwt_secret = std::env::var("JWT_SECRET").context("JWT_SECRET must be set")?;
        if jwt_secret.len() < 32 {
            anyhow::bail!("JWT_SECRET must be at least 32 characters");
        }
        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?,
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            jwt_secret,
            jwt_expiry_seconds: std::env::var("JWT_EXPIRY_SECONDS")
                .unwrap_or_else(|_| "3600".to_string())
                .parse()
                .context("JWT_EXPIRY_SECONDS must be a number")?,
            refresh_token_expiry_seconds: std::env::var("REFRESH_TOKEN_EXPIRY_SECONDS")
                .unwrap_or_else(|_| "2592000".to_string())
                .parse()
                .context("REFRESH_TOKEN_EXPIRY_SECONDS must be a number")?,
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .context("PORT must be a number")?,
            environment: std::env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string()),
            cors_origins: std::env::var("CORS_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:5173".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            log_level: std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
            rate_limit_requests_per_minute: std::env::var("RATE_LIMIT_REQUESTS_PER_MINUTE")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .context("RATE_LIMIT_REQUESTS_PER_MINUTE must be a number")?,
        })
    }
}
