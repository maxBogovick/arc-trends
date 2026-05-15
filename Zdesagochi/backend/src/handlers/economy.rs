use axum::{extract::State, response::IntoResponse, Json};
use serde::Deserialize;
use utoipa::ToSchema;
use crate::{
    db::{economy_repo, pet_repo},
    domain::economy::{BuyResult, InventoryItem},
    engine::catalog,
    error::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};

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
pub async fn get_shop(
    _auth: AuthUser,
) -> impl IntoResponse {
    Json(catalog::shop_items())
}

/// Get available food items
#[utoipa::path(
    get, path = "/api/foods",
    tag = "economy",
    responses((status = 200, description = "Food items")),
    security(("bearerAuth" = []))
)]
pub async fn get_foods(
    _auth: AuthUser,
) -> impl IntoResponse {
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
    let inventory: Vec<InventoryItem> = raw_inv.into_iter().filter_map(|(id, qty)| {
        catalog::find_shop_item(&id).map(|it| InventoryItem { item_id: id, quantity: qty, item: it })
    }).collect();

    Ok(Json(BuyResult { coins: new_balance, inventory, item }))
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
    let inventory: Vec<InventoryItem> = raw.into_iter().filter_map(|(id, qty)| {
        catalog::find_shop_item(&id).map(|item| InventoryItem { item_id: id, quantity: qty, item })
    }).collect();
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
    // Load item + pet outside transaction (read-only lookups)
    let item = catalog::find_shop_item(&body.item_id)
        .ok_or_else(|| AppError::NotFound(format!("Item {} not found", body.item_id)))?;

    let mut pet = pet_repo::get_pet(&state.db, &auth.user_id).await?
        .ok_or_else(|| AppError::NotFound("Pet not found".into()))?;

    let eff = &item.effect;
    fn clamp(v: f64) -> f64 { v.clamp(0.0, 100.0) }
    if let Some(v) = eff.hunger     { pet.stats.hunger      = clamp(pet.stats.hunger      + v as f64); }
    if let Some(v) = eff.happiness  { pet.stats.happiness   = clamp(pet.stats.happiness   + v as f64); }
    if let Some(v) = eff.energy     { pet.stats.energy      = clamp(pet.stats.energy      + v as f64); }
    if let Some(v) = eff.health     { pet.stats.health      = clamp(pet.stats.health      + v as f64); }
    if let Some(v) = eff.cleanliness { pet.stats.cleanliness = clamp(pet.stats.cleanliness + v as f64); }
    if let Some(v) = eff.bond       { pet.stats.bond        = clamp(pet.stats.bond        + v as f64); }
    if let Some(v) = eff.xp        { pet.xp = (pet.xp + v).max(0); }

    pet.last_updated = chrono::Utc::now().to_rfc3339();

    // Atomic: decrement inventory + persist pet state
    let mut tx = state.db.begin().await?;
    economy_repo::use_inventory_item_tx(&mut tx, &auth.user_id, &body.item_id).await?;
    pet_repo::upsert_pet_tx(&mut tx, &auth.user_id, &pet).await?;
    tx.commit().await?;

    Ok(Json(pet))
}
