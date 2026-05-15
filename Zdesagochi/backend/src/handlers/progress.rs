use axum::{extract::State, response::IntoResponse, Json};
use serde::Deserialize;
use utoipa::ToSchema;
use crate::{
    db::{economy_repo, progress_repo},
    domain::progress::{ClaimResult, QuestClaimResult},
    error::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};

/// Get achievements
#[utoipa::path(
    get, path = "/api/achievements",
    tag = "progress",
    responses((status = 200, description = "Achievements list")),
    security(("bearerAuth" = []))
)]
pub async fn get_achievements(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    let achievements = progress_repo::get_achievements(&state.db, &auth.user_id).await?;
    Ok(Json(achievements))
}

#[derive(Deserialize, ToSchema)]
pub struct ClaimAchievementBody {
    #[serde(rename = "achievementId")]
    pub achievement_id: String,
}

/// Claim an achievement reward
#[utoipa::path(
    post, path = "/api/achievements/claim",
    tag = "progress",
    request_body = ClaimAchievementBody,
    responses((status = 200, body = ClaimResult)),
    security(("bearerAuth" = []))
)]
pub async fn claim_achievement(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<ClaimAchievementBody>,
) -> Result<impl IntoResponse, AppError> {
    let mut tx = state.db.begin().await?;
    let achievement = progress_repo::mark_achievement_claimed_tx(&mut tx, &auth.user_id, &body.achievement_id).await?;
    let new_balance = economy_repo::add_coins_tx(&mut tx, &auth.user_id, achievement.reward).await?;
    tx.commit().await?;

    Ok(Json(ClaimResult { achievement, coins: new_balance, new_balance }))
}

/// Get daily quests
#[utoipa::path(
    get, path = "/api/quests",
    tag = "progress",
    responses((status = 200, description = "Daily quests")),
    security(("bearerAuth" = []))
)]
pub async fn get_quests(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    let quests = progress_repo::get_quests(&state.db, &auth.user_id).await?;
    Ok(Json(quests))
}

#[derive(Deserialize, ToSchema)]
pub struct ClaimQuestBody {
    #[serde(rename = "questId")]
    pub quest_id: String,
}

/// Claim a quest reward
#[utoipa::path(
    post, path = "/api/quests/claim",
    tag = "progress",
    request_body = ClaimQuestBody,
    responses((status = 200, body = QuestClaimResult)),
    security(("bearerAuth" = []))
)]
pub async fn claim_quest_reward(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<ClaimQuestBody>,
) -> Result<impl IntoResponse, AppError> {
    let mut tx = state.db.begin().await?;
    let quest = progress_repo::mark_quest_claimed_tx(&mut tx, &auth.user_id, &body.quest_id).await?;
    let new_balance = economy_repo::add_coins_tx(&mut tx, &auth.user_id, quest.reward.coins).await?;
    tx.commit().await?;

    Ok(Json(QuestClaimResult {
        coins: quest.reward.coins,
        xp: quest.reward.xp,
        new_balance,
        quest,
    }))
}
