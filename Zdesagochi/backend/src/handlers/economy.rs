use crate::{
    db::{economy_repo, pet_repo},
    domain::economy::{BuyResult, InventoryItem, ItemEffect},
    engine::{
        apply_personality_command, catalog,
        command_handlers::{EngineState, ItemEffect as CommandItemEffect, PetCommand},
    },
    error::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};
use axum::{extract::State, response::IntoResponse, Json};
use chrono::Utc;
use serde::Deserialize;
use ulid::Ulid;
use utoipa::ToSchema;

/// Get coin balance
#[utoipa::path(
    get, path = "/api/coins",
    tag = "economy",
    responses((status = 200, description = "Coin balance")),
    security(("bearerAuth" = []))
)]
pub async fn get_coins(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    let coins = economy_repo::get_coins(&state.db, &auth.user_id).await?;
    Ok(Json(serde_json::json!({ "coins": coins })))
}

/// Get shop items
#[utoipa::path(
    get, path = "/api/shop",
    tag = "economy",
    responses((status = 200, description = "Shop items")),
    security(("bearerAuth" = []))
)]
pub async fn get_shop(_auth: AuthUser) -> impl IntoResponse {
    Json(catalog::shop_items())
}

/// Get available food items
#[utoipa::path(
    get, path = "/api/foods",
    tag = "economy",
    responses((status = 200, description = "Food items")),
    security(("bearerAuth" = []))
)]
pub async fn get_foods(_auth: AuthUser) -> impl IntoResponse {
    Json(catalog::foods())
}

#[derive(Deserialize, ToSchema)]
pub struct BuyItemBody {
    #[serde(rename = "itemId")]
    pub item_id: String,
}

/// Buy a shop item
#[utoipa::path(
    post, path = "/api/shop/buy",
    tag = "economy",
    request_body = BuyItemBody,
    responses((status = 200, body = BuyResult), (status = 404, description = "Item not found")),
    security(("bearerAuth" = []))
)]
pub async fn buy_item(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<BuyItemBody>,
) -> Result<impl IntoResponse, AppError> {
    let item = catalog::find_shop_item(&body.item_id)
        .ok_or_else(|| AppError::NotFound(format!("Item {} not found", body.item_id)))?;

    // Atomic: spend coins + add to inventory + tick shop achievements
    let mut tx = state.db.begin().await?;
    let new_balance = economy_repo::spend_coins_tx(&mut tx, &auth.user_id, item.price).await?;
    economy_repo::add_inventory_tx(&mut tx, &auth.user_id, &body.item_id, 1).await?;
    economy_repo::increment_shop_buy_count_tx(&mut tx, &auth.user_id).await?;
    tx.commit().await?;

    let raw_inv = economy_repo::get_inventory(&state.db, &auth.user_id).await?;
    let inventory: Vec<InventoryItem> = raw_inv
        .into_iter()
        .filter_map(|(id, qty)| {
            catalog::find_shop_item(&id).map(|it| InventoryItem {
                item_id: id,
                quantity: qty,
                item: it,
            })
        })
        .collect();

    Ok(Json(BuyResult {
        coins: new_balance,
        inventory,
        item,
    }))
}

/// Get inventory
#[utoipa::path(
    get, path = "/api/inventory",
    tag = "economy",
    responses((status = 200, body = Vec<InventoryItem>)),
    security(("bearerAuth" = []))
)]
pub async fn get_inventory(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    let raw = economy_repo::get_inventory(&state.db, &auth.user_id).await?;
    let inventory: Vec<InventoryItem> = raw
        .into_iter()
        .filter_map(|(id, qty)| {
            catalog::find_shop_item(&id).map(|item| InventoryItem {
                item_id: id,
                quantity: qty,
                item,
            })
        })
        .collect();
    Ok(Json(inventory))
}

#[derive(Deserialize)]
pub struct UseItemBody {
    #[serde(rename = "itemId")]
    pub item_id: String,
}

pub async fn use_inventory_item(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UseItemBody>,
) -> Result<impl IntoResponse, AppError> {
    let item = catalog::find_shop_item(&body.item_id)
        .ok_or_else(|| AppError::NotFound(format!("Item {} not found", body.item_id)))?;

    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Pet not found".into()))?;

    let coin_balance = economy_repo::get_coins(&state.db, &auth.user_id).await? as f64;
    let mut engine_state = EngineState::from_pet(&pet);
    let now = Utc::now();
    let command = PetCommand {
        command_id: Ulid::new().to_string(),
        command_type: "use_item".to_string(),
        at: now.to_rfc3339(),
        food_id: None,
        food_effect: None,
        item_id: Some(body.item_id.clone()),
        item_effect: Some(to_command_item_effect(&item.effect)),
        score_seed: None,
        coin_balance,
    };

    let result = apply_personality_command(&mut engine_state, &command, now);
    if let Some(blocked) = &result.blocked_action {
        return Err(AppError::BadRequest(blocked.reason.clone()));
    }

    engine_state.apply_to_pet(&mut pet);

    let mut tx = state.db.begin().await?;
    economy_repo::use_inventory_item_tx(&mut tx, &auth.user_id, &body.item_id).await?;
    if result.coin_delta != 0 {
        economy_repo::add_coins_tx(&mut tx, &auth.user_id, result.coin_delta).await?;
    }
    pet_repo::upsert_pet_tx(&mut tx, &auth.user_id, &pet).await?;
    tx.commit().await?;

    Ok(Json(pet))
}

fn to_command_item_effect(effect: &ItemEffect) -> CommandItemEffect {
    CommandItemEffect {
        hunger: effect.hunger.map(f64::from),
        happiness: effect.happiness.map(f64::from),
        energy: effect.energy.map(f64::from),
        health: effect.health.map(f64::from),
        cleanliness: effect.cleanliness.map(f64::from),
        bond: effect.bond.map(f64::from),
        xp: effect.xp.map(f64::from),
        coins: None,
    }
}
