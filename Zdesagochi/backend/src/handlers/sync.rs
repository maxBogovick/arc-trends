use crate::{
    db::{command_repo, economy_repo, personality_telemetry_repo, pet_repo},
    domain::pet::Pet,
    engine::{
        self,
        command_handlers::{FoodEffect, ItemEffect, PetCommand},
        types::PetCommandResult,
    },
    error::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};
use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use utoipa::ToSchema;

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimePetCommand {
    #[serde(rename = "type")]
    command_type: String,
    variant: Option<String>,
    command_id: String,
    at: String,
    food_id: Option<String>,
    food_effect: Option<RuntimeFoodEffect>,
    item_id: Option<String>,
    item_kind: Option<String>,
    item_effect: Option<RuntimeItemEffect>,
    #[serde(alias = "score")]
    score_seed: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeFoodEffect {
    hunger_restore: f64,
    happiness_bonus: f64,
    health_bonus: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeItemEffect {
    hunger: Option<f64>,
    happiness: Option<f64>,
    energy: Option<f64>,
    health: Option<f64>,
    cleanliness: Option<f64>,
    bond: Option<f64>,
    xp: Option<f64>,
    coins: Option<f64>,
}

struct ParsedCommand {
    command: RuntimePetCommand,
    raw: serde_json::Value,
    at: DateTime<Utc>,
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
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".into()))?;

    let server_last_accepted =
        command_repo::get_last_accepted_command_id(&state.db, &pet.id).await?;
    if batch.base_command_id != server_last_accepted {
        let rejected_cmds: Vec<RejectedCommand> = batch
            .commands
            .iter()
            .enumerate()
            .map(|(index, command)| RejectedCommand {
                command_id: rejected_command_id(command, index),
                reason: "stale_base".into(),
                message: "Batch base command does not match server cursor.".into(),
            })
            .collect();
        return Ok(Json(ServerCommandAck {
            accepted_command_ids: Vec::new(),
            rejected_command_ids: rejected_cmds
                .iter()
                .map(|cmd| cmd.command_id.clone())
                .collect(),
            rejected_commands: rejected_cmds,
            last_accepted_command_id: server_last_accepted,
        }));
    }

    let mut engine_state = engine::command_handlers::EngineState::from_pet(&pet);

    let mut accepted: Vec<String> = Vec::new();
    let mut rejected: Vec<String> = Vec::new();
    let mut rejected_cmds: Vec<RejectedCommand> = Vec::new();
    let mut last_accepted: Option<String> = server_last_accepted;
    let mut total_coin_delta: i32 = 0;

    let mut parsed_commands: Vec<ParsedCommand> = Vec::new();
    let mut seen_in_batch = HashSet::new();

    for (index, cmd_json) in batch.commands.into_iter().enumerate() {
        let parsed = match parse_runtime_command(cmd_json.clone()) {
            Ok(command) => command,
            Err(message) => {
                let command_id = rejected_command_id(&cmd_json, index);
                rejected.push(command_id.clone());
                rejected_cmds.push(RejectedCommand {
                    command_id,
                    reason: "invalid_command".into(),
                    message,
                });
                continue;
            }
        };

        if !seen_in_batch.insert(parsed.command_id.clone()) {
            rejected.push(parsed.command_id.clone());
            rejected_cmds.push(RejectedCommand {
                command_id: parsed.command_id,
                reason: "duplicate_in_batch".into(),
                message: "CommandId appears more than once in this batch.".into(),
            });
            continue;
        }

        let at = match parse_command_time(&parsed.at) {
            Ok(at) => at,
            Err(message) => {
                rejected.push(parsed.command_id.clone());
                rejected_cmds.push(RejectedCommand {
                    command_id: parsed.command_id,
                    reason: "invalid_command".into(),
                    message,
                });
                continue;
            }
        };

        if !is_supported_command_type(&parsed.command_type) {
            rejected.push(parsed.command_id.clone());
            rejected_cmds.push(RejectedCommand {
                command_id: parsed.command_id,
                reason: "invalid_command".into(),
                message: "Unsupported command type.".into(),
            });
            continue;
        }

        if let Err(message) =
            validate_command_variant(&parsed.command_type, parsed.variant.as_deref())
        {
            rejected.push(parsed.command_id.clone());
            rejected_cmds.push(RejectedCommand {
                command_id: parsed.command_id,
                reason: "invalid_command".into(),
                message,
            });
            continue;
        }

        parsed_commands.push(ParsedCommand {
            command: parsed,
            raw: cmd_json,
            at,
        });
    }

    parsed_commands.sort_by(|a, b| a.at.cmp(&b.at));

    let starting_coin_balance = economy_repo::get_coins(&state.db, &auth.user_id).await?;
    let mut tx = state.db.begin().await?;

    for parsed in parsed_commands {
        let cmd_id = parsed.command.command_id.clone();

        if let Some((existing_pet_id, existing_user_id)) =
            command_repo::get_command_owner(&state.db, &cmd_id).await?
        {
            if existing_pet_id == pet.id && existing_user_id == auth.user_id {
                accepted.push(cmd_id.clone());
                last_accepted = Some(cmd_id);
            } else {
                rejected.push(cmd_id.clone());
                rejected_cmds.push(RejectedCommand {
                    command_id: cmd_id,
                    reason: "invalid_command".into(),
                    message: "CommandId is already used by another pet.".into(),
                });
            }
            continue;
        }

        let coin_balance = starting_coin_balance + total_coin_delta;

        let command = PetCommand {
            command_id: cmd_id.clone(),
            command_type: parsed.command.command_type.clone(),
            variant: parsed.command.variant.clone(),
            at: parsed.at.to_rfc3339(),
            food_id: parsed.command.food_id.clone(),
            food_effect: parsed.command.food_effect.map(|effect| FoodEffect {
                hunger_restore: effect.hunger_restore,
                happiness_bonus: effect.happiness_bonus,
                health_bonus: effect.health_bonus,
            }),
            item_id: parsed.command.item_id.clone(),
            item_effect: parsed.command.item_effect.map(|effect| ItemEffect {
                hunger: effect.hunger,
                happiness: effect.happiness,
                energy: effect.energy,
                health: effect.health,
                cleanliness: effect.cleanliness,
                bond: effect.bond,
                xp: effect.xp,
                coins: effect.coins,
            }),
            score_seed: parse_score_seed(parsed.command.score_seed.as_ref()),
            coin_balance: coin_balance as f64,
        };

        let result = engine::apply_personality_command(&mut engine_state, &command, parsed.at);

        if let Some(ref blocked) = result.blocked_action {
            rejected.push(cmd_id.clone());
            rejected_cmds.push(RejectedCommand {
                command_id: cmd_id,
                reason: "blocked_action".into(),
                message: blocked.reason.clone(),
            });
            continue;
        }

        total_coin_delta += result.coin_delta;

        let mut result_pet = pet.clone();
        engine_state.apply_to_pet(&mut result_pet);
        let result_json =
            command_result_json(&result, &result_pet, &parsed.raw, &command, parsed.at)?;

        command_repo::insert_command_tx(
            &mut tx,
            &cmd_id,
            &pet.id,
            &auth.user_id,
            &command.command_type,
            &parsed.raw,
            Some(&result_json),
            "accepted",
            None,
        )
        .await?;

        if let Some(sample) = result_json.get("personalityTelemetry") {
            personality_telemetry_repo::insert_sample_tx(
                &mut tx,
                &ulid::Ulid::new().to_string(),
                &pet.id,
                &auth.user_id,
                &command.command_id,
                &command.command_type,
                sample,
            )
            .await?;
        }

        last_accepted = Some(cmd_id.clone());
        accepted.push(cmd_id);
    }

    // Apply final engine state back to pet
    engine_state.apply_to_pet(&mut pet);
    pet.last_updated = chrono::Utc::now().to_rfc3339();
    pet_repo::upsert_pet_tx(&mut tx, &auth.user_id, &pet).await?;
    if total_coin_delta != 0 {
        economy_repo::add_coins_tx(&mut tx, &auth.user_id, total_coin_delta).await?;
    }
    tx.commit().await?;

    // Publish SSE update
    publish_pet_update(&state, &auth.user_id, &pet).await;

    Ok(Json(ServerCommandAck {
        accepted_command_ids: accepted,
        rejected_command_ids: rejected,
        rejected_commands: rejected_cmds,
        last_accepted_command_id: last_accepted,
    }))
}

pub(crate) fn command_result_json(
    result: &PetCommandResult,
    pet: &Pet,
    raw_command: &serde_json::Value,
    command: &PetCommand,
    at: DateTime<Utc>,
) -> Result<serde_json::Value, AppError> {
    let mut value = serde_json::to_value(result).map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to serialize command result: {}", e))
    })?;
    let object = value.as_object_mut().ok_or_else(|| {
        AppError::Internal(anyhow::anyhow!("Command result is not a JSON object"))
    })?;

    object.insert(
        "pet".to_string(),
        serde_json::to_value(pet).map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Failed to serialize pet snapshot: {}", e))
        })?,
    );
    object.insert("command".to_string(), raw_command.clone());
    let events = command_events(result, command, at);
    object.insert(
        "events".to_string(),
        serde_json::Value::Array(events.clone()),
    );
    object.insert(
        "personalityTelemetry".to_string(),
        personality_telemetry_sample(pet, result, command, &events, at),
    );

    Ok(value)
}

fn personality_telemetry_sample(
    pet: &Pet,
    result: &PetCommandResult,
    command: &PetCommand,
    events: &[serde_json::Value],
    at: DateTime<Utc>,
) -> serde_json::Value {
    let behavior_axes = pet
        .behavior_profile
        .get("axes")
        .and_then(|value| value.as_object());
    let dominant_behavior_axis = behavior_axes.and_then(|axes| {
        axes.iter()
            .filter_map(|(axis, value)| value.as_f64().map(|score| (axis.as_str(), score)))
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(axis, _)| axis)
    });
    let behavior_sample_count = pet
        .behavior_profile
        .get("sampleCount")
        .and_then(|value| value.as_i64())
        .unwrap_or(0);
    let event_types: Vec<serde_json::Value> = events
        .iter()
        .filter_map(|event| event.get("type").and_then(|value| value.as_str()))
        .map(|event_type| serde_json::Value::String(event_type.to_string()))
        .collect();
    let evolution_proposal_target = pet
        .evolution_proposal
        .as_ref()
        .and_then(|proposal| proposal.get("targetPersonalityId"))
        .and_then(|value| value.as_str());

    serde_json::json!({
        "commandId": command.command_id,
        "commandType": command.command_type,
        "commandVariant": command.variant,
        "recordedAt": at.to_rfc3339(),
        "personalityId": pet.personality,
        "formationComplete": pet.formation_complete,
        "formationProgress": pet.formation_progress,
        "currentTargetZone": pet.current_target_zone,
        "evolutionReadiness": pet.evolution_readiness,
        "evolutionReadinessTarget": pet.evolution_readiness_target,
        "dominantBehaviorAxis": dominant_behavior_axis,
        "behaviorSampleCount": behavior_sample_count,
        "traitDrift": {},
        "behaviorDrift": {},
        "eventTypes": event_types,
        "evolutionProposalTarget": evolution_proposal_target,
        "engineVersion": result.engine_version,
        "registryVersion": result.registry_version,
    })
}

fn command_events(
    result: &PetCommandResult,
    command: &PetCommand,
    at: DateTime<Utc>,
) -> Vec<serde_json::Value> {
    let mut events = Vec::new();
    let at = at.to_rfc3339();

    for modifier in &result.applied_modifiers {
        if modifier.source == "base" {
            events.push(serde_json::json!({
                "type": "influence_applied",
                "at": at,
                "commandId": command.command_id,
                "influenceId": modifier.id,
                "label": modifier.description,
            }));
        }
    }

    if !result.stat_deltas.is_empty()
        || result.xp_delta != 0
        || result.coin_delta != 0
        || result.blocked_action.is_some()
    {
        events.push(serde_json::json!({
            "type": "gameplay_outcome_applied",
            "at": at,
            "commandId": command.command_id,
            "actionType": command.command_type,
            "statDeltas": result.stat_deltas,
            "xpDelta": result.xp_delta,
            "coinDelta": result.coin_delta,
            "blockedAction": result.blocked_action,
        }));
    }

    for event in &result.events {
        match event.as_str() {
            "sleep_started" => events.push(serde_json::json!({
                "type": "sleep_started",
                "at": at,
                "commandId": command.command_id,
            })),
            "sleep_finished" => events.push(serde_json::json!({
                "type": "sleep_finished",
                "at": at,
                "commandId": command.command_id,
                "naturalWake": result.meta.get("naturalWake").and_then(|v| v.as_bool()).unwrap_or(false),
                "sleptHours": result.meta.get("sleptHours").and_then(|v| v.as_f64()).unwrap_or(0.0),
            })),
            "sync_applied" => events.push(serde_json::json!({
                "type": "offline_sync_capped",
                "at": at,
                "commandId": command.command_id,
                "reason": "sync_applied",
            })),
            "evolution_accepted" | "evolution_rejected" => events.push(serde_json::json!({
                "type": "evolution_recorded",
                "at": at,
                "commandId": command.command_id,
                "record": {
                    "decision": event,
                },
            })),
            _ => {}
        }
    }

    events
}

fn parse_runtime_command(value: serde_json::Value) -> Result<RuntimePetCommand, String> {
    serde_json::from_value::<RuntimePetCommand>(value)
        .map_err(|e| format!("Command shape is invalid: {}", e))
        .and_then(|command| {
            if command.command_id.trim().is_empty() {
                Err("CommandId is required.".into())
            } else if command.at.trim().is_empty() {
                Err("Command timestamp is required.".into())
            } else if command
                .item_kind
                .as_deref()
                .is_some_and(|kind| !matches!(kind, "food" | "toy" | "medicine" | "decoration"))
            {
                Err("Item kind is unsupported.".into())
            } else {
                Ok(command)
            }
        })
}

fn parse_command_time(value: &str) -> Result<DateTime<Utc>, String> {
    DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| "Command timestamp must be a valid RFC3339 date.".into())
}

fn parse_score_seed(value: Option<&serde_json::Value>) -> Option<u32> {
    match value {
        Some(serde_json::Value::Number(number)) => number.as_u64().map(|n| n as u32),
        Some(serde_json::Value::String(text)) => text.parse::<u32>().ok(),
        _ => None,
    }
}

fn is_supported_command_type(command_type: &str) -> bool {
    matches!(
        command_type,
        "feed"
            | "play"
            | "sleep"
            | "wake"
            | "bathe"
            | "heal"
            | "bond"
            | "use_item"
            | "add_item"
            | "accept_evolution"
            | "reject_evolution"
            | "sync"
    )
}

fn validate_command_variant(command_type: &str, variant: Option<&str>) -> Result<(), String> {
    let Some(variant) = variant else {
        return Ok(());
    };

    let supported = match command_type {
        "play" => matches!(variant, "classic" | "active" | "puzzle" | "social"),
        "sleep" => matches!(variant, "night" | "nap" | "ritual"),
        "wake" => matches!(variant, "normal" | "gentle"),
        "bond" => matches!(variant, "hug" | "listen" | "praise"),
        _ => false,
    };

    if supported {
        Ok(())
    } else {
        Err(format!(
            "Unsupported variant '{}' for command type '{}'.",
            variant, command_type
        ))
    }
}

fn rejected_command_id(command: &serde_json::Value, index: usize) -> String {
    command
        .get("commandId")
        .and_then(|value| value.as_str())
        .filter(|id| !id.trim().is_empty())
        .map(String::from)
        .unwrap_or_else(|| format!("invalid-command-{}", index))
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
    let pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".into()))?;

    let results =
        command_repo::get_results_since(&state.db, &pet.id, query.since.as_deref()).await?;

    Ok(Json(results))
}

#[derive(Deserialize)]
pub struct TelemetryQuery {
    pub limit: Option<i64>,
}

pub async fn get_personality_telemetry(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<TelemetryQuery>,
) -> Result<impl IntoResponse, AppError> {
    let pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".into()))?;

    let samples = personality_telemetry_repo::get_recent_samples(
        &state.db,
        &pet.id,
        query.limit.unwrap_or(50),
    )
    .await?;

    Ok(Json(samples))
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::types::AppliedModifier;
    use std::collections::HashMap;

    #[test]
    fn command_result_json_includes_ts_contract_fields() {
        let pet = Pet::new_default("pet-test".to_string(), "Test".to_string());
        let raw_command = serde_json::json!({
            "type": "play",
            "commandId": "cmd-play-1",
            "scoreSeed": 100,
            "at": "2026-05-16T12:00:00Z"
        });
        let command = PetCommand {
            command_id: "cmd-play-1".to_string(),
            command_type: "play".to_string(),
            variant: None,
            at: "2026-05-16T12:00:00Z".to_string(),
            food_id: None,
            food_effect: None,
            item_id: None,
            item_effect: None,
            score_seed: Some(100),
            coin_balance: 100.0,
        };

        let mut result = PetCommandResult {
            xp_delta: 80,
            coin_delta: 17,
            schema_version: 1,
            engine_version: "rust-backend".to_string(),
            registry_version: "static".to_string(),
            ..Default::default()
        };
        result.stat_deltas = HashMap::from([
            ("happiness".to_string(), 40.0),
            ("energy".to_string(), -20.0),
        ]);
        result.influence_cooldowns = HashMap::from([("action:play".to_string(), 0)]);
        result.applied_modifiers = vec![AppliedModifier {
            source: "base".to_string(),
            id: "action:play".to_string(),
            description: "Command influence applied".to_string(),
        }];

        let value = command_result_json(
            &result,
            &pet,
            &raw_command,
            &command,
            DateTime::parse_from_rfc3339("2026-05-16T12:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
        )
        .unwrap();

        assert_eq!(value["pet"]["id"], "pet-test");
        assert_eq!(value["command"], raw_command);
        assert_eq!(value["xpDelta"], 80);
        assert_eq!(value["coinDelta"], 17);
        assert_eq!(value["schemaVersion"], 1);
        assert_eq!(value["engineVersion"], "rust-backend");
        assert_eq!(value["registryVersion"], "static");
        assert_eq!(value["influenceCooldowns"]["action:play"], 0);
        assert_eq!(value["events"][0]["type"], "influence_applied");
        assert_eq!(value["events"][0]["influenceId"], "action:play");
        assert_eq!(value["events"][1]["type"], "gameplay_outcome_applied");
        assert_eq!(value["events"][1]["actionType"], "play");
        assert_eq!(value["personalityTelemetry"]["commandId"], "cmd-play-1");
        assert_eq!(value["personalityTelemetry"]["commandType"], "play");
        assert_eq!(value["personalityTelemetry"]["personalityId"], "playful");
        assert_eq!(
            value["personalityTelemetry"]["eventTypes"][0],
            "influence_applied"
        );
    }

    #[test]
    fn command_events_preserve_sleep_lifecycle_shape() {
        let command = PetCommand {
            command_id: "cmd-wake-1".to_string(),
            command_type: "wake".to_string(),
            variant: None,
            at: "2026-05-16T12:00:00Z".to_string(),
            food_id: None,
            food_effect: None,
            item_id: None,
            item_effect: None,
            score_seed: None,
            coin_balance: 100.0,
        };
        let mut result = PetCommandResult {
            events: vec!["sleep_finished".to_string()],
            ..Default::default()
        };
        result
            .meta
            .insert("naturalWake".to_string(), serde_json::json!(true));
        result
            .meta
            .insert("sleptHours".to_string(), serde_json::json!(8.5));

        let events = command_events(
            &result,
            &command,
            DateTime::parse_from_rfc3339("2026-05-16T12:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
        );

        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["type"], "sleep_finished");
        assert_eq!(events[0]["commandId"], "cmd-wake-1");
        assert_eq!(events[0]["naturalWake"], true);
        assert_eq!(events[0]["sleptHours"], 8.5);
    }
}
