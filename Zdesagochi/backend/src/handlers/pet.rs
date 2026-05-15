use axum::{
    extract::State,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use ulid::Ulid;
use utoipa::ToSchema;

use crate::{
    db::{economy_repo, pet_repo, progress_repo},
    domain::pet::{Account, NewLifeResult, Pet, PetEvent},
    engine::{
        apply_personality_command, EngineState, FoodEffect, PetCommand,
    },
    error::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};

// ─── Request types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateNameRequest {
    pub name: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct FeedRequest {
    #[serde(rename = "foodId")]
    pub food_id: Option<String>,
    #[serde(rename = "foodEffect")]
    pub food_effect: Option<FoodEffectRequest>,
}

#[derive(Debug, Deserialize, Clone, ToSchema)]
pub struct FoodEffectRequest {
    #[serde(rename = "hungerRestore", default)]
    pub hunger_restore: f64,
    #[serde(rename = "happinessBonus", default)]
    pub happiness_bonus: f64,
    #[serde(rename = "healthBonus", default)]
    pub health_bonus: f64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct PlayRequest {
    pub score: Option<u32>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct UseItemRequest {
    #[serde(rename = "itemId")]
    pub item_id: Option<String>,
    pub effect: Option<ItemEffectRequest>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
pub struct ItemEffectRequest {
    pub hunger: Option<f64>,
    pub happiness: Option<f64>,
    pub energy: Option<f64>,
    pub health: Option<f64>,
    pub cleanliness: Option<f64>,
    pub bond: Option<f64>,
    pub xp: Option<f64>,
    pub coins: Option<f64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PlayResult {
    pub pet: Pet,
    #[serde(rename = "xpGained")]
    pub xp_gained: i32,
    #[serde(rename = "coinsGained")]
    pub coins_gained: i32,
    pub score: f64,
    pub message: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActionResult {
    pub pet: Pet,
    #[serde(rename = "xpGained")]
    pub xp_gained: i32,
    #[serde(rename = "coinsGained")]
    pub coins_gained: i32,
    pub events: Vec<String>,
}

// ─── Helper ────────────────────────────────────────────────────────────────────

async fn load_coin_balance(state: &AppState, user_id: &str) -> Result<f64, AppError> {
    let coins = economy_repo::get_coins(&state.db, user_id).await?;
    Ok(coins as f64)
}

async fn insert_pet_event(
    state: &AppState,
    pet_id: &str,
    event_type: &str,
    description: &str,
    emoji: &str,
    xp: Option<i32>,
    coins: Option<i32>,
) -> Result<(), AppError> {
    let event = PetEvent {
        id: Ulid::new().to_string(),
        timestamp: Utc::now().to_rfc3339(),
        event_type: event_type.to_string(),
        description: description.to_string(),
        emoji: emoji.to_string(),
        xp_gained: xp,
        coins_gained: coins,
    };
    pet_repo::insert_event(&state.db, &event, pet_id).await
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// Get the current user's pet
#[utoipa::path(
    get, path = "/api/pet",
    tag = "pet",
    responses((status = 200, body = Pet), (status = 404, description = "Not found")),
    security(("bearerAuth" = []))
)]
pub async fn get_pet(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Pet>, AppError> {
    let pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;
    Ok(Json(pet))
}

pub async fn update_pet_name(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<UpdateNameRequest>,
) -> Result<Json<Pet>, AppError> {
    let name = req.name.trim().to_string();
    if name.is_empty() || name.len() > 30 {
        return Err(AppError::BadRequest(
            "Pet name must be 1-30 characters".to_string(),
        ));
    }

    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    pet.name = name;
    pet.last_updated = Utc::now().to_rfc3339();
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    Ok(Json(pet))
}

pub async fn get_pet_events(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<PetEvent>>, AppError> {
    let pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let events = pet_repo::get_events(&state.db, &pet.id, 50).await?;
    Ok(Json(events))
}

pub async fn import_pet(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<Value>,
) -> Result<Json<Pet>, AppError> {
    if pet_repo::get_pet(&state.db, &auth.user_id).await?.is_some() {
        return Err(AppError::Conflict("Pet already exists for this user".to_string()));
    }

    let mut pet: Pet = serde_json::from_value(body)
        .map_err(|e| AppError::BadRequest(format!("Invalid pet save format: {}", e)))?;

    pet.id = Ulid::new().to_string();
    pet.last_updated = Utc::now().to_rfc3339();

    pet_repo::create_pet(&state.db, &auth.user_id, &pet).await?;

    Ok(Json(pet))
}

pub async fn begin_new_life(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<NewLifeResult>, AppError> {
    let existing_pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let account = Account {
        legacy_vector: Some(existing_pet.trait_vector.clone()),
        legacy_coefficient: Some(
            if existing_pet.catharsis_achieved { 1.2 } else { 1.0 }
        ),
        legacy_generation: Some(existing_pet.evolution_history.len() as i32 + 1),
        legacy_description: Some(format!(
            "Legacy from {} (stage: {:?}, level: {})",
            existing_pet.name, existing_pet.stage, existing_pet.level
        )),
        memory_guardian: if existing_pet.core_memories.is_empty() {
            None
        } else {
            Some(serde_json::json!({
                "name": existing_pet.name,
                "personalityId": existing_pet.personality,
                "archivedMemories": existing_pet.core_memories,
                "guidance": [],
                "updatedAt": Utc::now().to_rfc3339()
            }))
        },
    };

    let new_pet_id = Ulid::new().to_string();
    let new_pet = Pet::new_default(new_pet_id, existing_pet.name.clone());

    pet_repo::upsert_pet(&state.db, &auth.user_id, &new_pet).await?;

    Ok(Json(NewLifeResult {
        pet: new_pet,
        account,
    }))
}

// ─── Phase 4: Action endpoints ────────────────────────────────────────────────

/// Feed the pet
#[utoipa::path(
    post, path = "/api/pet/feed",
    tag = "pet",
    request_body = FeedRequest,
    responses((status = 200, body = ActionResult)),
    security(("bearerAuth" = []))
)]
pub async fn feed_pet(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<FeedRequest>,
) -> Result<Json<ActionResult>, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let coin_balance = load_coin_balance(&state, &auth.user_id).await?;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "feed".to_string(),
        at: now.to_rfc3339(),
        food_id: req.food_id,
        food_effect: req.food_effect.map(|fe| FoodEffect {
            hunger_restore: fe.hunger_restore,
            happiness_bonus: fe.happiness_bonus,
            health_bonus: fe.health_bonus,
        }),
        item_id: None,
        item_effect: None,
        score_seed: None,
        coin_balance,
    };

    let result = apply_personality_command(&mut engine_state, &command, now);

    if let Some(blocked) = &result.blocked_action {
        return Err(AppError::BadRequest(blocked.reason.clone()));
    }

    engine_state.apply_to_pet(&mut pet);
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    // Achievements / quest ticks (best-effort)
    let _ = progress_repo::tick_achievement(&state.db, &auth.user_id, "first_meal", 1).await;
    let _ = progress_repo::tick_achievement(&state.db, &auth.user_id, "food_lover", 1).await;
    let _ = progress_repo::tick_quest(&state.db, &auth.user_id, "q_feed3").await;

    insert_pet_event(&state, &pet.id, "feed", "Питомца покормили", "🍕",
        Some(result.xp_delta), Some(result.coin_delta)).await.ok();

    Ok(Json(ActionResult {
        pet,
        xp_gained: result.xp_delta,
        coins_gained: result.coin_delta,
        events: result.events,
    }))
}

/// Play with the pet
#[utoipa::path(
    post, path = "/api/pet/play",
    tag = "pet",
    request_body(content = PlayRequest, description = "Optional play parameters"),
    responses((status = 200, body = PlayResult)),
    security(("bearerAuth" = []))
)]
pub async fn play_with_pet(
    State(state): State<AppState>,
    auth: AuthUser,
    body: Option<Json<PlayRequest>>,
) -> Result<Json<PlayResult>, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let score_seed = body.and_then(|b| b.score);
    let coin_balance = load_coin_balance(&state, &auth.user_id).await?;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "play".to_string(),
        at: now.to_rfc3339(),
        food_id: None,
        food_effect: None,
        item_id: None,
        item_effect: None,
        score_seed,
        coin_balance,
    };

    let result = apply_personality_command(&mut engine_state, &command, now);

    if let Some(blocked) = &result.blocked_action {
        return Err(AppError::BadRequest(blocked.reason.clone()));
    }

    let score = result.meta.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0);

    engine_state.apply_to_pet(&mut pet);
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    let _ = progress_repo::tick_achievement(&state.db, &auth.user_id, "playful", 1).await;
    let _ = progress_repo::tick_quest(&state.db, &auth.user_id, "q_play2").await;

    insert_pet_event(&state, &pet.id, "play", "Поиграли с питомцем", "🎮",
        Some(result.xp_delta), Some(result.coin_delta)).await.ok();

    let message = if result.xp_delta > 50 {
        "Отличная игра! Питомец в восторге".to_string()
    } else {
        "Питомец поиграл с удовольствием".to_string()
    };

    Ok(Json(PlayResult {
        pet,
        xp_gained: result.xp_delta,
        coins_gained: result.coin_delta,
        score,
        message,
    }))
}

/// Put the pet to sleep
#[utoipa::path(
    post, path = "/api/pet/sleep",
    tag = "pet",
    responses((status = 200, body = ActionResult)),
    security(("bearerAuth" = []))
)]
pub async fn sleep_pet(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<ActionResult>, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let coin_balance = load_coin_balance(&state, &auth.user_id).await?;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "sleep".to_string(),
        at: now.to_rfc3339(),
        food_id: None,
        food_effect: None,
        item_id: None,
        item_effect: None,
        score_seed: None,
        coin_balance,
    };

    let result = apply_personality_command(&mut engine_state, &command, now);

    if let Some(blocked) = &result.blocked_action {
        return Err(AppError::BadRequest(blocked.reason.clone()));
    }

    engine_state.apply_to_pet(&mut pet);
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    let _ = progress_repo::tick_achievement(&state.db, &auth.user_id, "sweet_dreams", 1).await;

    insert_pet_event(&state, &pet.id, "sleep", "Питомец заснул", "😴", None, None).await.ok();

    Ok(Json(ActionResult {
        pet,
        xp_gained: result.xp_delta,
        coins_gained: result.coin_delta,
        events: result.events,
    }))
}

/// Wake the pet up
#[utoipa::path(
    post, path = "/api/pet/wake",
    tag = "pet",
    responses((status = 200, body = ActionResult)),
    security(("bearerAuth" = []))
)]
pub async fn wake_pet(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<ActionResult>, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let coin_balance = load_coin_balance(&state, &auth.user_id).await?;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "wake".to_string(),
        at: now.to_rfc3339(),
        food_id: None,
        food_effect: None,
        item_id: None,
        item_effect: None,
        score_seed: None,
        coin_balance,
    };

    let result = apply_personality_command(&mut engine_state, &command, now);

    if let Some(blocked) = &result.blocked_action {
        return Err(AppError::BadRequest(blocked.reason.clone()));
    }

    engine_state.apply_to_pet(&mut pet);
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    insert_pet_event(&state, &pet.id, "wake", "Питомец проснулся", "☀️", None, None).await.ok();

    Ok(Json(ActionResult {
        pet,
        xp_gained: result.xp_delta,
        coins_gained: result.coin_delta,
        events: result.events,
    }))
}

/// Bathe the pet
#[utoipa::path(
    post, path = "/api/pet/bathe",
    tag = "pet",
    responses((status = 200, body = ActionResult)),
    security(("bearerAuth" = []))
)]
pub async fn bathe_pet(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<ActionResult>, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let coin_balance = load_coin_balance(&state, &auth.user_id).await?;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "bathe".to_string(),
        at: now.to_rfc3339(),
        food_id: None,
        food_effect: None,
        item_id: None,
        item_effect: None,
        score_seed: None,
        coin_balance,
    };

    let result = apply_personality_command(&mut engine_state, &command, now);

    if let Some(blocked) = &result.blocked_action {
        return Err(AppError::BadRequest(blocked.reason.clone()));
    }

    engine_state.apply_to_pet(&mut pet);
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    let _ = progress_repo::tick_achievement(&state.db, &auth.user_id, "clean_freak", 1).await;
    let _ = progress_repo::tick_quest(&state.db, &auth.user_id, "q_bathe").await;

    insert_pet_event(&state, &pet.id, "bathe", "Питомец помылся", "🛁",
        Some(result.xp_delta), None).await.ok();

    Ok(Json(ActionResult {
        pet,
        xp_gained: result.xp_delta,
        coins_gained: result.coin_delta,
        events: result.events,
    }))
}

/// Heal the pet
#[utoipa::path(
    post, path = "/api/pet/heal",
    tag = "pet",
    responses((status = 200, body = ActionResult)),
    security(("bearerAuth" = []))
)]
pub async fn heal_pet(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<ActionResult>, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let coin_balance = load_coin_balance(&state, &auth.user_id).await?;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "heal".to_string(),
        at: now.to_rfc3339(),
        food_id: None,
        food_effect: None,
        item_id: None,
        item_effect: None,
        score_seed: None,
        coin_balance,
    };

    let result = apply_personality_command(&mut engine_state, &command, now);

    if let Some(blocked) = &result.blocked_action {
        return Err(AppError::BadRequest(blocked.reason.clone()));
    }

    engine_state.apply_to_pet(&mut pet);
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    let _ = progress_repo::tick_achievement(&state.db, &auth.user_id, "good_doctor", 1).await;
    let _ = progress_repo::tick_quest(&state.db, &auth.user_id, "q_heal").await;

    insert_pet_event(&state, &pet.id, "heal", "Питомца подлечили", "💊",
        Some(result.xp_delta), None).await.ok();

    Ok(Json(ActionResult {
        pet,
        xp_gained: result.xp_delta,
        coins_gained: result.coin_delta,
        events: result.events,
    }))
}

/// Bond with the pet (quality time)
#[utoipa::path(
    post, path = "/api/pet/bond",
    tag = "pet",
    responses((status = 200, body = ActionResult)),
    security(("bearerAuth" = []))
)]
pub async fn bond_with_pet(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<ActionResult>, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let coin_balance = load_coin_balance(&state, &auth.user_id).await?;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "bond".to_string(),
        at: now.to_rfc3339(),
        food_id: None,
        food_effect: None,
        item_id: None,
        item_effect: None,
        score_seed: None,
        coin_balance,
    };

    let result = apply_personality_command(&mut engine_state, &command, now);

    if let Some(blocked) = &result.blocked_action {
        return Err(AppError::BadRequest(blocked.reason.clone()));
    }

    engine_state.apply_to_pet(&mut pet);
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    let _ = progress_repo::tick_achievement(&state.db, &auth.user_id, "best_friends", 1).await;
    let _ = progress_repo::tick_quest(&state.db, &auth.user_id, "q_bond3").await;

    insert_pet_event(&state, &pet.id, "bond", "Провели время вместе", "💜",
        Some(result.xp_delta), None).await.ok();

    Ok(Json(ActionResult {
        pet,
        xp_gained: result.xp_delta,
        coins_gained: result.coin_delta,
        events: result.events,
    }))
}

/// Sync pet state (apply time-based decay)
#[utoipa::path(
    post, path = "/api/pet/sync",
    tag = "pet",
    responses((status = 200, body = Pet)),
    security(("bearerAuth" = []))
)]
pub async fn sync_pet(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Pet>, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let coin_balance = load_coin_balance(&state, &auth.user_id).await?;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "sync".to_string(),
        at: now.to_rfc3339(),
        food_id: None,
        food_effect: None,
        item_id: None,
        item_effect: None,
        score_seed: None,
        coin_balance,
    };

    apply_personality_command(&mut engine_state, &command, now);
    engine_state.apply_to_pet(&mut pet);
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    Ok(Json(pet))
}

pub async fn accept_evolution(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Pet>, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let coin_balance = load_coin_balance(&state, &auth.user_id).await?;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "accept_evolution".to_string(),
        at: now.to_rfc3339(),
        food_id: None,
        food_effect: None,
        item_id: None,
        item_effect: None,
        score_seed: None,
        coin_balance,
    };

    let _result = apply_personality_command(&mut engine_state, &command, now);

    engine_state.apply_to_pet(&mut pet);
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    insert_pet_event(&state, &pet.id, "evolution", "Принята эволюция", "✨", None, None).await.ok();

    Ok(Json(pet))
}

pub async fn reject_evolution(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Pet>, AppError> {
    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".to_string()))?;

    let coin_balance = load_coin_balance(&state, &auth.user_id).await?;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "reject_evolution".to_string(),
        at: now.to_rfc3339(),
        food_id: None,
        food_effect: None,
        item_id: None,
        item_effect: None,
        score_seed: None,
        coin_balance,
    };

    apply_personality_command(&mut engine_state, &command, now);
    engine_state.apply_to_pet(&mut pet);
    pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;

    Ok(Json(pet))
}
