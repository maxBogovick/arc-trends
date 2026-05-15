use axum::{extract::State, response::IntoResponse, Json};
use serde::Deserialize;
use utoipa::ToSchema;
use crate::{
    db::{economy_repo, room_repo},
    engine::catalog,
    error::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};

/// Get rooms (owned and catalog)
#[utoipa::path(
    get, path = "/api/rooms",
    tag = "rooms",
    responses((status = 200, description = "Room list")),
    security(("bearerAuth" = []))
)]
pub async fn get_rooms(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    let rooms = room_repo::get_rooms(&state.db, &auth.user_id).await?;
    Ok(Json(rooms))
}

#[derive(Deserialize, ToSchema)]
pub struct BuyRoomBody {
    #[serde(rename = "roomId")]
    pub room_id: String,
}

/// Buy a room
#[utoipa::path(
    post, path = "/api/rooms/buy",
    tag = "rooms",
    request_body = BuyRoomBody,
    responses((status = 200, description = "Updated room list")),
    security(("bearerAuth" = []))
)]
pub async fn buy_room(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<BuyRoomBody>,
) -> Result<impl IntoResponse, AppError> {
    let def = catalog::rooms_catalog()
        .into_iter()
        .find(|r| r.id == body.room_id)
        .ok_or_else(|| AppError::NotFound(format!("Room {} not found", body.room_id)))?;

    // Atomic purchase: spend coins, mark room owned, tick achievement
    let mut tx = state.db.begin().await?;
    if def.price > 0 {
        economy_repo::spend_coins_tx(&mut tx, &auth.user_id, def.price).await?;
    }
    room_repo::buy_room_tx(&mut tx, &auth.user_id, &body.room_id).await?;
    crate::db::progress_repo::tick_achievement_tx(&mut tx, &auth.user_id, "room_owner", 1).await?;
    tx.commit().await?;

    let rooms = room_repo::get_rooms(&state.db, &auth.user_id).await?;
    Ok(Json(rooms))
}

#[derive(Deserialize, ToSchema)]
pub struct EquipRoomBody {
    #[serde(rename = "roomId")]
    pub room_id: String,
}

/// Equip a room
#[utoipa::path(
    post, path = "/api/rooms/equip",
    tag = "rooms",
    request_body = EquipRoomBody,
    responses((status = 200, description = "Room equipped")),
    security(("bearerAuth" = []))
)]
pub async fn equip_room(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<EquipRoomBody>,
) -> Result<impl IntoResponse, AppError> {
    room_repo::equip_room(&state.db, &auth.user_id, &body.room_id).await?;

    // Update equippedRoomId in pet state
    if let Some(mut pet) = crate::db::pet_repo::get_pet(&state.db, &auth.user_id).await? {
        pet.equipped_room_id = body.room_id.clone();
        crate::db::pet_repo::upsert_pet(&state.db, &auth.user_id, &pet).await?;
    }

    Ok(Json(serde_json::json!({ "roomId": body.room_id })))
}

/// Get leaderboard
#[utoipa::path(
    get, path = "/api/leaderboard",
    tag = "rooms",
    responses((status = 200, description = "Leaderboard")),
    security(("bearerAuth" = []))
)]
pub async fn get_leaderboard(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    let entries = room_repo::get_leaderboard(&state.db).await?;
    Ok(Json(entries))
}
