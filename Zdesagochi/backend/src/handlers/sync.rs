use axum::{extract::{Query, State}, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use crate::{
    db::{command_repo, pet_repo},
    engine::{self, command_handlers::PetCommand},
    error::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};

#[allow(dead_code)]
#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ServerCommandBatch {
    pub client_id: String,
    pub commands: Vec<serde_json::Value>,
    pub base_command_id: Option<String>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RejectedCommand {
    pub command_id: String,
    pub reason: String,
    pub message: String,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ServerCommandAck {
    pub accepted_command_ids: Vec<String>,
    pub rejected_command_ids: Vec<String>,
    pub rejected_commands: Vec<RejectedCommand>,
    pub last_accepted_command_id: Option<String>,
}

/// Submit offline commands batch
#[utoipa::path(
    post, path = "/api/pet/sync/commands",
    tag = "sync",
    request_body = ServerCommandBatch,
    responses((status = 200, body = ServerCommandAck)),
    security(("bearerAuth" = []))
)]
pub async fn submit_commands(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(batch): Json<ServerCommandBatch>,
) -> Result<impl IntoResponse, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id).await?
        .ok_or_else(|| AppError::NotFound("Pet not found".into()))?;

    let mut engine_state = engine::command_handlers::EngineState::from_pet(&pet);
    let _personalities = engine::personalities::get_personalities();

    let mut accepted: Vec<String> = Vec::new();
    let mut rejected: Vec<String> = Vec::new();
    let mut rejected_cmds: Vec<RejectedCommand> = Vec::new();
    let mut last_accepted: Option<String> = None;

    // Sort commands by timestamp
    let mut commands = batch.commands;
    commands.sort_by(|a, b| {
        let ta = a.get("at").and_then(|v| v.as_str()).unwrap_or("");
        let tb = b.get("at").and_then(|v| v.as_str()).unwrap_or("");
        ta.cmp(tb)
    });

    for cmd_json in commands {
        let cmd_id = cmd_json.get("commandId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if cmd_id.is_empty() {
            continue;
        }

        // Deduplication
        if command_repo::is_command_processed(&state.db, &cmd_id).await? {
            accepted.push(cmd_id.clone());
            last_accepted = Some(cmd_id);
            continue;
        }

        let cmd_type = cmd_json.get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("sync")
            .to_string();

        let now = cmd_json.get("at")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(chrono::Utc::now);

        let command = PetCommand {
            command_id: cmd_id.clone(),
            command_type: cmd_type.clone(),
            at: now.to_rfc3339(),
            food_id: cmd_json.get("foodId").and_then(|v| v.as_str()).map(String::from),
            food_effect: None,
            item_id: cmd_json.get("itemId").and_then(|v| v.as_str()).map(String::from),
            item_effect: None,
            score_seed: cmd_json.get("score").and_then(|v| v.as_u64()).map(|v| v as u32),
            coin_balance: 0.0,
        };

        let result = engine::apply_personality_command(&mut engine_state, &command, now);

        if let Some(ref blocked) = result.blocked_action {
            rejected.push(cmd_id.clone());
            rejected_cmds.push(RejectedCommand {
                command_id: cmd_id,
                reason: "blocked_action".into(),
                message: blocked.reason.clone(),
            });
            continue;
        }

        let result_json = serde_json::to_value(&result).unwrap_or_default();
        command_repo::insert_command(
            &state.db,
            &cmd_id,
            &pet.id,
            &auth.user_id,
            &cmd_type,
            &cmd_json,
            Some(&result_json),
            "accepted",
            None,
        ).await?;

        last_accepted = Some(cmd_id.clone());
        accepted.push(cmd_id);
    }

    // Apply final engine state back to pet
    engine_state.apply_to_pet(&mut pet);
    pet.last_updated = chrono::Utc::now().to_rfc3339();
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    // Publish SSE update
    publish_pet_update(&state, &auth.user_id, &pet).await;

    Ok(Json(ServerCommandAck {
        accepted_command_ids: accepted,
        rejected_command_ids: rejected,
        rejected_commands: rejected_cmds,
        last_accepted_command_id: last_accepted,
    }))
}

#[derive(Deserialize)]
pub struct SinceQuery {
    pub since: Option<String>,
}

/// Get sync results since a given command ID
#[utoipa::path(
    get, path = "/api/pet/sync/results",
    tag = "sync",
    params(("since" = Option<String>, Query, description = "Cursor command ID")),
    responses((status = 200, description = "Sync results")),
    security(("bearerAuth" = []))
)]
pub async fn get_sync_results(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<SinceQuery>,
) -> Result<impl IntoResponse, AppError> {
    let pet = pet_repo::get_pet(&state.db, &auth.user_id).await?
        .ok_or_else(|| AppError::NotFound("Pet not found".into()))?;

    let results = command_repo::get_results_since(
        &state.db,
        &pet.id,
        query.since.as_deref(),
    ).await?;

    Ok(Json(results))
}

pub async fn publish_pet_update(state: &AppState, user_id: &str, pet: &crate::domain::pet::Pet) {
    let channel = format!("pet_updates:{}", user_id);
    let json = match serde_json::to_string(pet) {
        Ok(s) => s,
        Err(_) => return,
    };

    if let Ok(mut conn) = state.redis.get().await {
        let _: Result<(), _> = deadpool_redis::redis::cmd("PUBLISH")
            .arg(&channel)
            .arg(&json)
            .query_async(&mut conn)
            .await;
    }
}
