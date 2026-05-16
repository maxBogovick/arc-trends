use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};
use axum::{Json, extract::State};
use deadpool_redis::redis::AsyncCommands;
use jsonwebtoken::{EncodingKey, Header, encode};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use ulid::Ulid;
use utoipa::ToSchema;

use crate::{
    db::user_repo,
    domain::{pet::Pet, user::Claims},
    error::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};

// ─── Request / Response types ────────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuthResponse {
    pub token: String,
    pub refresh_token: String,
    pub user: UserPublic,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RefreshResponse {
    pub token: String,
    pub refresh_token: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserPublic {
    pub id: String,
    pub username: String,
    pub email: String,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn generate_jwt(user_id: &str, secret: &str, expiry_seconds: u64) -> Result<String, AppError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = Claims {
        sub: user_id.to_string(),
        iat: now,
        exp: now + expiry_seconds,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("JWT encode error: {}", e)))
}

/// Generate a 32-byte cryptographically random refresh token, hex-encoded.
fn generate_refresh_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Hash a refresh token (SHA-256) — used as the Redis key so raw tokens are never stored.
fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

fn refresh_key(token: &str) -> String {
    format!("refresh:{}", hash_token(token))
}

async fn store_refresh_token(
    redis: &deadpool_redis::Pool,
    user_id: &str,
    refresh_token: &str,
    ttl_seconds: u64,
) -> Result<(), AppError> {
    let mut conn = redis
        .get()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis connection error: {}", e)))?;
    let _: () = conn
        .set_ex(refresh_key(refresh_token), user_id, ttl_seconds)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis set error: {}", e)))?;
    Ok(())
}

fn validate_username(username: &str) -> Result<(), AppError> {
    let trimmed = username.trim();
    if trimmed.is_empty() {
        return Err(AppError::BadRequest("Username cannot be empty".to_string()));
    }
    if trimmed.len() < 3 || trimmed.len() > 30 {
        return Err(AppError::BadRequest(
            "Username must be 3-30 characters".into(),
        ));
    }
    if !trimmed.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(AppError::BadRequest(
            "Username may only contain letters, numbers, and underscores".into(),
        ));
    }
    Ok(())
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// Register a new user
#[utoipa::path(
    post,
    path = "/api/auth/register",
    tag = "auth",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "User registered", body = AuthResponse),
        (status = 400, description = "Bad request"),
        (status = 409, description = "Email already registered"),
    )
)]
pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // Validate input
    validate_username(&req.username)?;
    if req.email.trim().is_empty() || !req.email.contains('@') {
        return Err(AppError::BadRequest("Invalid email".to_string()));
    }
    if req.password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".to_string(),
        ));
    }

    // Check if email already exists
    if user_repo::find_by_email(&state.db, &req.email)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict("Email already registered".to_string()));
    }

    // Hash password with argon2
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hash error: {}", e)))?
        .to_string();

    // Generate ULID for user
    let user_id = Ulid::new().to_string();
    let pet_id = Ulid::new().to_string();
    let pet = Pet::new_default(pet_id, format!("{}'s Pet", req.username));

    // All DB writes in a single transaction
    let mut tx = state.db.begin().await?;
    user_repo::create_user_tx(&mut tx, &user_id, &req.username, &req.email, &password_hash).await?;

    sqlx::query("INSERT INTO user_coins (user_id, balance) VALUES ($1, 100)")
        .bind(&user_id)
        .execute(&mut *tx)
        .await?;

    crate::db::pet_repo::create_pet_tx(&mut tx, &user_id, &pet).await?;
    tx.commit().await?;

    // Tokens — only after the DB transaction succeeds
    let token = generate_jwt(
        &user_id,
        &state.config.jwt_secret,
        state.config.jwt_expiry_seconds,
    )?;
    let refresh_token = generate_refresh_token();
    store_refresh_token(
        &state.redis,
        &user_id,
        &refresh_token,
        state.config.refresh_token_expiry_seconds,
    )
    .await?;

    tracing::info!(user_id = %user_id, "User registered");

    Ok(Json(AuthResponse {
        token,
        refresh_token,
        user: UserPublic {
            id: user_id,
            username: req.username,
            email: req.email,
        },
    }))
}

/// Login with email and password
#[utoipa::path(
    post,
    path = "/api/auth/login",
    tag = "auth",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = AuthResponse),
        (status = 401, description = "Invalid credentials"),
    )
)]
pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // Find user by email
    let db_user = match user_repo::find_by_email(&state.db, &req.email).await? {
        Some(u) => u,
        None => {
            // Constant-time dummy verify to avoid leaking whether the email is registered.
            // Hash for password "dummy_password_for_timing_attack".
            const DUMMY_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$gPiNRLrYqI3MMl3oqx3jBfQiTfgUjxk7QKkn4xnP5Eg";
            if let Ok(parsed) = PasswordHash::new(DUMMY_HASH) {
                let _ = Argon2::default().verify_password(req.password.as_bytes(), &parsed);
            }
            return Err(AppError::Unauthorized);
        }
    };

    // Verify password
    let parsed_hash = PasswordHash::new(&db_user.password_hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hash parse error: {}", e)))?;
    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized)?;

    // Generate tokens
    let token = generate_jwt(
        &db_user.id,
        &state.config.jwt_secret,
        state.config.jwt_expiry_seconds,
    )?;
    let refresh_token = generate_refresh_token();
    store_refresh_token(
        &state.redis,
        &db_user.id,
        &refresh_token,
        state.config.refresh_token_expiry_seconds,
    )
    .await?;

    tracing::info!(user_id = %db_user.id, "User logged in");

    Ok(Json(AuthResponse {
        token,
        refresh_token,
        user: UserPublic {
            id: db_user.id,
            username: db_user.username,
            email: db_user.email,
        },
    }))
}

/// Refresh access token using a refresh token (rotates the refresh token)
#[utoipa::path(
    post,
    path = "/api/auth/refresh",
    tag = "auth",
    request_body = RefreshRequest,
    responses(
        (status = 200, description = "Token refreshed", body = RefreshResponse),
        (status = 401, description = "Invalid refresh token"),
    )
)]
pub async fn refresh(
    State(state): State<AppState>,
    Json(req): Json<RefreshRequest>,
) -> Result<Json<RefreshResponse>, AppError> {
    let mut conn = state
        .redis
        .get()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let key = refresh_key(&req.refresh_token);
    let user_id: Option<String> = conn
        .get(&key)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis get error: {}", e)))?;

    let user_id = user_id.ok_or(AppError::Unauthorized)?;

    // Rotate: invalidate old refresh token then mint a new one
    let _: () = conn
        .del(&key)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis del error: {}", e)))?;

    let token = generate_jwt(
        &user_id,
        &state.config.jwt_secret,
        state.config.jwt_expiry_seconds,
    )?;
    let new_refresh_token = generate_refresh_token();
    let _: () = conn
        .set_ex(
            refresh_key(&new_refresh_token),
            &user_id,
            state.config.refresh_token_expiry_seconds,
        )
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis set error: {}", e)))?;

    Ok(Json(RefreshResponse {
        token,
        refresh_token: new_refresh_token,
    }))
}

/// Logout — invalidate refresh token (requires the caller's access token)
#[utoipa::path(
    post,
    path = "/api/auth/logout",
    tag = "auth",
    request_body = RefreshRequest,
    responses(
        (status = 204, description = "Logged out"),
    ),
    security(("bearerAuth" = []))
)]
pub async fn logout(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<RefreshRequest>,
) -> Result<axum::http::StatusCode, AppError> {
    let mut conn = state
        .redis
        .get()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let key = refresh_key(&req.refresh_token);
    // Verify ownership: the token must belong to the authenticated user
    let owner: Option<String> = conn
        .get(&key)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis get error: {}", e)))?;

    if owner.as_deref() != Some(auth.user_id.as_str()) {
        // Don't reveal whether the token exists — treat any mismatch as auth failure.
        return Err(AppError::Unauthorized);
    }

    let _: () = conn
        .del(key)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis del error: {}", e)))?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}
