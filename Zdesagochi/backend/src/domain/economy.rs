use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FoodItem {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub hunger_restore: i32,
    pub happiness_bonus: i32,
    pub health_bonus: i32,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum ItemType {
    Food,
    Toy,
    Medicine,
    Decoration,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum ItemRarity {
    Common,
    Rare,
    Epic,
    Legendary,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ItemEffect {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hunger: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub happiness: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub energy: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cleanliness: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bond: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xp: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ShopItem {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub description: String,
    pub price: i32,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub rarity: ItemRarity,
    pub effect: ItemEffect,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InventoryItem {
    pub item_id: String,
    pub quantity: i32,
    pub item: ShopItem,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BuyResult {
    pub coins: i32,
    pub inventory: Vec<InventoryItem>,
    pub item: ShopItem,
}
