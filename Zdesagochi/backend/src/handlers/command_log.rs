use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::{Postgres, Transaction};

use crate::{
    db::{command_repo, personality_telemetry_repo},
    domain::pet::Pet,
    engine::{
        command_handlers::{ItemEffect, PetCommand},
        types::PetCommandResult,
    },
    error::AppError,
    handlers::sync::command_result_json,
};

type Tx<'a> = Transaction<'a, Postgres>;

#[allow(clippy::too_many_arguments)]
pub async fn insert_engine_command_tx(
    tx: &mut Tx<'_>,
    pet: &Pet,
    user_id: &str,
    command: &PetCommand,
    result: &PetCommandResult,
    result_pet: &Pet,
    at: DateTime<Utc>,
    item_kind: Option<&str>,
    status: &str,
    reject_reason: Option<&str>,
) -> Result<(), AppError> {
    let raw_command = command_json(command, item_kind);
    let result_json = command_result_json(result, result_pet, &raw_command, command, at)?;

    command_repo::insert_command_tx(
        tx,
        &command.command_id,
        &pet.id,
        user_id,
        &command.command_type,
        &raw_command,
        Some(&result_json),
        status,
        reject_reason,
    )
    .await?;

    if status == "accepted" {
        if let Some(sample) = result_json.get("personalityTelemetry") {
            personality_telemetry_repo::insert_sample_tx(
                tx,
                &ulid::Ulid::new().to_string(),
                &pet.id,
                user_id,
                &command.command_id,
                &command.command_type,
                sample,
            )
            .await?;
        }
    }

    Ok(())
}

fn command_json(command: &PetCommand, item_kind: Option<&str>) -> Value {
    let mut value = serde_json::json!({
        "type": command.command_type,
        "commandId": command.command_id,
        "at": command.at,
    });
    let object = value.as_object_mut().expect("command json is object");

    if let Some(variant) = &command.variant {
        object.insert("variant".to_string(), Value::String(variant.clone()));
    }
    if let Some(food_id) = &command.food_id {
        object.insert("foodId".to_string(), Value::String(food_id.clone()));
    }
    if let Some(effect) = &command.food_effect {
        object.insert(
            "foodEffect".to_string(),
            serde_json::json!({
                "hungerRestore": effect.hunger_restore,
                "happinessBonus": effect.happiness_bonus,
                "healthBonus": effect.health_bonus,
            }),
        );
    }
    if let Some(item_id) = &command.item_id {
        object.insert("itemId".to_string(), Value::String(item_id.clone()));
    }
    if let Some(kind) = item_kind {
        object.insert("itemKind".to_string(), Value::String(kind.to_string()));
    }
    if let Some(effect) = &command.item_effect {
        object.insert("itemEffect".to_string(), item_effect_json(effect));
    }
    if let Some(score_seed) = command.score_seed {
        object.insert("score".to_string(), serde_json::json!(score_seed));
    }

    value
}

fn item_effect_json(effect: &ItemEffect) -> Value {
    let mut value = serde_json::Map::new();
    insert_optional(&mut value, "hunger", effect.hunger);
    insert_optional(&mut value, "happiness", effect.happiness);
    insert_optional(&mut value, "energy", effect.energy);
    insert_optional(&mut value, "health", effect.health);
    insert_optional(&mut value, "cleanliness", effect.cleanliness);
    insert_optional(&mut value, "bond", effect.bond);
    insert_optional(&mut value, "xp", effect.xp);
    insert_optional(&mut value, "coins", effect.coins);
    Value::Object(value)
}

fn insert_optional(map: &mut serde_json::Map<String, Value>, key: &str, value: Option<f64>) {
    if let Some(value) = value {
        map.insert(key.to_string(), serde_json::json!(value));
    }
}
