use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RoomDecoration {
    pub emoji: String,
    pub x: f64,
    pub y: f64,
    pub size: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub description: String,
    pub price: i32,
    pub unlocked: bool,
    pub gradient: String,
    pub floor_gradient: String,
    pub decorations: Vec<RoomDecoration>,
}

// Static definition (without unlocked state — that comes from DB)
#[derive(Debug, Clone)]
pub struct RoomDef {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub description: String,
    pub price: i32,
    pub gradient: String,
    pub floor_gradient: String,
    pub decorations: Vec<RoomDecoration>,
}

impl RoomDef {
    pub fn into_room(self, unlocked: bool) -> Room {
        Room {
            id: self.id,
            name: self.name,
            emoji: self.emoji,
            description: self.description,
            price: self.price,
            unlocked,
            gradient: self.gradient,
            floor_gradient: self.floor_gradient,
            decorations: self.decorations,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub owner_name: String,
    pub pet_name: String,
    pub pet_stage: String,
    pub level: i32,
    pub score: i64,
}
