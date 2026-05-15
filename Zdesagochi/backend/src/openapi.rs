use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::handlers::auth::register,
        crate::handlers::auth::login,
        crate::handlers::auth::refresh,
        crate::handlers::auth::logout,
        crate::handlers::pet::get_pet,
        crate::handlers::pet::feed_pet,
        crate::handlers::pet::play_with_pet,
        crate::handlers::pet::sleep_pet,
        crate::handlers::pet::wake_pet,
        crate::handlers::pet::bathe_pet,
        crate::handlers::pet::heal_pet,
        crate::handlers::pet::bond_with_pet,
        crate::handlers::pet::sync_pet,
        crate::handlers::economy::get_coins,
        crate::handlers::economy::get_shop,
        crate::handlers::economy::buy_item,
        crate::handlers::economy::get_inventory,
        crate::handlers::economy::get_foods,
        crate::handlers::progress::get_achievements,
        crate::handlers::progress::claim_achievement,
        crate::handlers::progress::get_quests,
        crate::handlers::progress::claim_quest_reward,
        crate::handlers::rooms::get_rooms,
        crate::handlers::rooms::buy_room,
        crate::handlers::rooms::equip_room,
        crate::handlers::rooms::get_leaderboard,
        crate::handlers::sync::submit_commands,
        crate::handlers::sync::get_sync_results,
    ),
    components(schemas(
        // Auth
        crate::handlers::auth::RegisterRequest,
        crate::handlers::auth::LoginRequest,
        crate::handlers::auth::RefreshRequest,
        crate::handlers::auth::AuthResponse,
        crate::handlers::auth::RefreshResponse,
        crate::handlers::auth::UserPublic,
        // Pet
        crate::domain::pet::Pet,
        crate::domain::pet::PetStats,
        crate::domain::pet::PetMood,
        crate::domain::pet::PetStage,
        crate::domain::pet::PetEvent,
        crate::domain::pet::Account,
        crate::domain::pet::NewLifeResult,
        crate::handlers::pet::FeedRequest,
        crate::handlers::pet::FoodEffectRequest,
        crate::handlers::pet::PlayRequest,
        crate::handlers::pet::ActionResult,
        crate::handlers::pet::PlayResult,
        // Economy
        crate::domain::economy::ShopItem,
        crate::domain::economy::FoodItem,
        crate::domain::economy::InventoryItem,
        crate::domain::economy::BuyResult,
        crate::domain::economy::ItemEffect,
        crate::domain::economy::ItemType,
        crate::domain::economy::ItemRarity,
        crate::handlers::economy::BuyItemBody,
        // Progress
        crate::domain::progress::Achievement,
        crate::domain::progress::AchievementCategory,
        crate::domain::progress::ClaimResult,
        crate::domain::progress::DailyQuest,
        crate::domain::progress::QuestReward,
        crate::domain::progress::QuestClaimResult,
        crate::handlers::progress::ClaimAchievementBody,
        crate::handlers::progress::ClaimQuestBody,
        // Rooms
        crate::domain::rooms::Room,
        crate::domain::rooms::RoomDecoration,
        crate::domain::rooms::LeaderboardEntry,
        crate::handlers::rooms::BuyRoomBody,
        crate::handlers::rooms::EquipRoomBody,
        // Sync
        crate::handlers::sync::ServerCommandBatch,
        crate::handlers::sync::ServerCommandAck,
        crate::handlers::sync::RejectedCommand,
    )),
    tags(
        (name = "auth",     description = "Authentication"),
        (name = "pet",      description = "Pet management"),
        (name = "economy",  description = "Economy & inventory"),
        (name = "progress", description = "Achievements & quests"),
        (name = "rooms",    description = "Rooms & leaderboard"),
        (name = "sync",     description = "Offline sync protocol"),
    ),
    info(
        title = "Zdesagochi API",
        version = "1.0.0",
        description = "Modern Tamagotchi backend",
    ),
    modifiers(&SecurityAddon),
)]
pub struct ApiDoc;

struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearerAuth",
                utoipa::openapi::security::SecurityScheme::Http(
                    utoipa::openapi::security::HttpBuilder::new()
                        .scheme(utoipa::openapi::security::HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}
