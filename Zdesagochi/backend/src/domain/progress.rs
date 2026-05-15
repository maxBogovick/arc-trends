use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum AchievementCategory {
    Care,
    Social,
    Play,
    Progress,
    Shop,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Achievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub emoji: String,
    pub category: AchievementCategory,
    pub progress: i32,
    pub target: i32,
    pub unlocked: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unlocked_at: Option<String>,
    pub claimed: bool,
    pub reward: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementDef {
    pub id: String,
    pub name: String,
    pub description: String,
    pub emoji: String,
    pub category: AchievementCategory,
    pub target: i32,
    pub reward: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClaimResult {
    pub achievement: Achievement,
    pub coins: i32,
    pub new_balance: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QuestReward {
    pub coins: i32,
    pub xp: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DailyQuest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub emoji: String,
    pub progress: i32,
    pub target: i32,
    pub completed: bool,
    pub claimed: bool,
    pub reward: QuestReward,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestDef {
    pub id: String,
    pub name: String,
    pub description: String,
    pub emoji: String,
    pub target: i32,
    pub reward: QuestReward,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QuestClaimResult {
    pub quest: DailyQuest,
    pub coins: i32,
    pub xp: i32,
    pub new_balance: i32,
}
