use axum::{extract::{Query, State}, Json};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use ulid::Ulid;
use utoipa::ToSchema;

use crate::{
    db::{proactive_repo, user_repo},
    error::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SignedProactiveConfig {
    pub version: String,
    #[serde(flatten)]
    pub body: Value,
    pub signature: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct PublishProactiveConfigRequest {
    pub config: Value,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct IngestProactiveAnalyticsRequest {
    pub payload: Value,
}

#[derive(Debug, Deserialize)]
pub struct LimitQuery {
    pub limit: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/api/proactive/config",
    tag = "proactive",
    responses(
        (status = 200, description = "Active proactive config", body = Option<SignedProactiveConfig>),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = []))
)]
pub async fn get_config(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> Result<Json<Option<SignedProactiveConfig>>, AppError> {
    let record = proactive_repo::get_active_config(&state.db).await?;
    Ok(Json(record.map(|record| SignedProactiveConfig {
        version: record.version,
        body: record.config_json,
        signature: record.signature,
        created_at: Some(record.created_at),
    })))
}

#[utoipa::path(
    post,
    path = "/api/admin/proactive/config",
    tag = "proactive",
    request_body = PublishProactiveConfigRequest,
    responses(
        (status = 200, description = "Published proactive config", body = SignedProactiveConfig),
        (status = 400, description = "Bad request"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
    ),
    security(("bearerAuth" = []))
)]
pub async fn publish_config(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<PublishProactiveConfigRequest>,
) -> Result<Json<SignedProactiveConfig>, AppError> {
    ensure_admin(&state, &auth).await?;
    let version = body.config
        .get("version")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::BadRequest("config.version is required".to_string()))?
        .to_string();
    validate_proactive_config(&body.config)?;
    let signature = sign_config(&body.config, &state.config.proactive_config_signing_secret)?;
    let id = Ulid::new().to_string();

    proactive_repo::insert_config(
        &state.db,
        &id,
        &version,
        &body.config,
        &signature,
        &auth.user_id,
    ).await?;
    proactive_repo::insert_audit(
        &state.db,
        &Ulid::new().to_string(),
        &auth.user_id,
        "proactive_config.publish",
        &json!({ "config_id": id, "version": version }),
    ).await?;

    Ok(Json(SignedProactiveConfig {
        version,
        body: body.config,
        signature,
        created_at: Some(Utc::now()),
    }))
}

#[utoipa::path(
    post,
    path = "/api/proactive/analytics",
    tag = "proactive",
    request_body = IngestProactiveAnalyticsRequest,
    responses(
        (status = 200, description = "Analytics accepted"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = []))
)]
pub async fn ingest_analytics(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<IngestProactiveAnalyticsRequest>,
) -> Result<Json<Value>, AppError> {
    let id = Ulid::new().to_string();
    proactive_repo::insert_analytics(&state.db, &id, &auth.user_id, &body.payload).await?;
    Ok(Json(json!({ "accepted": true, "id": id })))
}

#[utoipa::path(
    get,
    path = "/api/admin/proactive/analytics",
    tag = "proactive",
    params(("limit" = Option<i64>, Query, description = "Max rows")),
    responses(
        (status = 200, description = "Recent proactive analytics"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
    ),
    security(("bearerAuth" = []))
)]
pub async fn get_analytics(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<LimitQuery>,
) -> Result<Json<Vec<proactive_repo::ProactiveAnalyticsRecord>>, AppError> {
    ensure_admin(&state, &auth).await?;
    Ok(Json(proactive_repo::get_recent_analytics(&state.db, query.limit.unwrap_or(100)).await?))
}

#[utoipa::path(
    get,
    path = "/api/admin/proactive/audit",
    tag = "proactive",
    params(("limit" = Option<i64>, Query, description = "Max rows")),
    responses(
        (status = 200, description = "Recent proactive audit entries"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
    ),
    security(("bearerAuth" = []))
)]
pub async fn get_audit(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<LimitQuery>,
) -> Result<Json<Vec<proactive_repo::ProactiveAuditRecord>>, AppError> {
    ensure_admin(&state, &auth).await?;
    Ok(Json(proactive_repo::get_recent_audit(&state.db, query.limit.unwrap_or(100)).await?))
}

async fn ensure_admin(state: &AppState, auth: &AuthUser) -> Result<(), AppError> {
    let user = user_repo::find_by_id(&state.db, &auth.user_id)
        .await?
        .ok_or(AppError::Unauthorized)?;
    if state.config.proactive_admin_emails.is_empty() {
        return Err(AppError::Forbidden);
    }
    let email = user.email.to_ascii_lowercase();
    if state.config.proactive_admin_emails.iter().any(|allowed| allowed == &email) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

fn sign_config(config: &Value, secret: &str) -> Result<String, AppError> {
    let canonical = serde_json::to_string(config)
        .map_err(|e| AppError::BadRequest(format!("Invalid config JSON: {e}")))?;
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    hasher.update(b":");
    hasher.update(canonical.as_bytes());
    Ok(BASE64.encode(hasher.finalize()))
}

fn validate_proactive_config(config: &Value) -> Result<(), AppError> {
    if !config.is_object() {
        return Err(AppError::BadRequest("config must be an object".to_string()));
    }
    if config.get("version").and_then(Value::as_str).is_none() {
        return Err(AppError::BadRequest("config.version is required".to_string()));
    }
    if let Some(patch) = config.get("timeOfDayConfigPatch") {
        validate_time_of_day_patch(patch)?;
    }
    if let Some(tuning) = config.get("tuningConfig") {
        if !tuning.is_object() {
            return Err(AppError::BadRequest("tuningConfig must be an object".to_string()));
        }
    }
    Ok(())
}

fn validate_time_of_day_patch(patch: &Value) -> Result<(), AppError> {
    let object = patch.as_object()
        .ok_or_else(|| AppError::BadRequest("timeOfDayConfigPatch must be an object".to_string()))?;

    if let Some(periods) = object.get("periods") {
        let periods = periods.as_array()
            .ok_or_else(|| AppError::BadRequest("timeOfDayConfigPatch.periods must be an array".to_string()))?;
        for period in periods {
            require_string(period, "id")?;
            require_number(period, "startHour")?;
            require_number(period, "endHour")?;
            require_string(period, "fallbackMessage")?;
        }
    }

    if let Some(activity_rules) = object.get("activityRules") {
        let rules = activity_rules.as_array()
            .ok_or_else(|| AppError::BadRequest("timeOfDayConfigPatch.activityRules must be an array".to_string()))?;
        for rule in rules {
            require_string(rule, "id")?;
            require_string(rule, "activityId")?;
            require_number(rule, "baseScore")?;
            require_object(rule, "periodWeights")?;
            require_string(rule, "message")?;
            require_string(rule, "reason")?;
        }
    }

    if let Some(overrides) = object.get("activityRuleOverrides") {
        let overrides = overrides.as_object()
            .ok_or_else(|| AppError::BadRequest("timeOfDayConfigPatch.activityRuleOverrides must be an object".to_string()))?;
        for (activity_id, override_value) in overrides {
            if activity_id.trim().is_empty() || !override_value.is_object() {
                return Err(AppError::BadRequest("activityRuleOverrides entries must be keyed objects".to_string()));
            }
        }
    }

    Ok(())
}

fn require_string(value: &Value, field: &str) -> Result<(), AppError> {
    if value.get(field).and_then(Value::as_str).is_some() {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!("{field} must be a string")))
    }
}

fn require_number(value: &Value, field: &str) -> Result<(), AppError> {
    if value.get(field).and_then(Value::as_f64).is_some() {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!("{field} must be a number")))
    }
}

fn require_object(value: &Value, field: &str) -> Result<(), AppError> {
    if value.get(field).and_then(Value::as_object).is_some() {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!("{field} must be an object")))
    }
}
