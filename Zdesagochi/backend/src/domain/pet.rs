use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Mirror of TypeScript PetMood
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema, Default)]
#[serde(rename_all = "lowercase")]
pub enum PetMood {
    Ecstatic,
    Happy,
    #[default]
    Content,
    Sad,
    Tired,
    Sick,
    Sleeping,
}

impl PetMood {
    pub fn as_str(&self) -> &'static str {
        match self {
            PetMood::Ecstatic => "ecstatic",
            PetMood::Happy => "happy",
            PetMood::Content => "content",
            PetMood::Sad => "sad",
            PetMood::Tired => "tired",
            PetMood::Sick => "sick",
            PetMood::Sleeping => "sleeping",
        }
    }
}

/// Mirror of TypeScript PetStage
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema, Default)]
#[serde(rename_all = "lowercase")]
pub enum PetStage {
    #[default]
    Egg,
    Baby,
    Child,
    Teen,
    Adult,
    Elder,
}

/// Mirror of TypeScript PetStats
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PetStats {
    pub hunger: f64,
    pub happiness: f64,
    pub energy: f64,
    pub health: f64,
    pub cleanliness: f64,
    pub bond: f64,
}

impl Default for PetStats {
    fn default() -> Self {
        Self {
            hunger: 50.0,
            happiness: 50.0,
            energy: 50.0,
            health: 50.0,
            cleanliness: 50.0,
            bond: 0.0,
        }
    }
}

/// Mirror of TypeScript Pet interface — all fields from types.ts
/// Complex personality engine types use serde_json::Value for now (Phase 3 will replace them)
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Pet {
    pub id: String,
    pub name: String,
    pub stage: PetStage,
    pub mood: PetMood,
    pub stats: PetStats,
    pub age_hours: f64,
    pub level: i32,
    pub xp: i32,
    pub xp_to_next: i32,
    pub is_asleep: bool,
    pub color: String,
    pub equipped_room_id: String,
    pub created_at: String,
    pub last_updated: String,

    // Personality system
    pub personality: String,
    pub behavioral_flags: Vec<Value>,
    pub emergent_state: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emergent_state_entered_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state_layers: Option<Value>,
    pub behavioral_counters: Value,
    pub mood_history: Vec<Value>,

    // Trait Evolution System v5.0
    pub trait_vector: Value,
    pub daily_trait_budget: Value,
    pub current_target_zone: Option<String>,
    pub ticks_in_target_zone: i32,
    pub void_syncs: i32,
    pub daily_trait_snapshots: Vec<Value>,

    // Core Memories
    pub core_memories: Vec<Value>,
    pub last_memory_timestamp: Value,
    pub visited_zones: Vec<String>,

    // Evolution
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evolution_proposal: Option<Value>,
    pub evolution_history: Vec<Value>,

    // Formation
    pub formation_complete: bool,
    pub formation_progress: f64,

    // Trauma / Catharsis
    pub trauma_level: f64,
    pub catharsis_progress: f64,
    pub catharsis_achieved: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub catharsis_xp_burst_expires_at: Option<String>,
    pub trauma_cooldown_until: Option<String>,

    // Cognitive dissonance / sleep lifecycle
    pub daily_vector_variance: f64,
    pub confused_state: bool,
    pub sleep_started_at: Option<String>,
    pub last_sleep_timestamp: Option<String>,

    // Singularity
    pub ticks_in_singularity: i32,
    pub singularity_zones: Vec<String>,
}

impl Pet {
    /// Create a new pet with default values for a given user
    pub fn new_default(pet_id: String, name: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: pet_id,
            name,
            stage: PetStage::Egg,
            mood: PetMood::Content,
            stats: PetStats::default(),
            age_hours: 0.0,
            level: 1,
            xp: 0,
            xp_to_next: 100,
            is_asleep: false,
            color: "#A8D8EA".to_string(),
            equipped_room_id: "default".to_string(),
            created_at: now.clone(),
            last_updated: now,
            personality: "playful".to_string(),
            behavioral_flags: vec![],
            emergent_state: None,
            emergent_state_entered_at: None,
            state_layers: None,
            behavioral_counters: serde_json::json!({
                "feedCount": 0,
                "playCount": 0,
                "sleepCount": 0,
                "bathCount": 0,
                "healCount": 0,
                "bondCount": 0,
                "syncCount": 0,
                "totalActions": 0
            }),
            mood_history: vec![],
            trait_vector: serde_json::json!({}),
            daily_trait_budget: serde_json::json!({}),
            current_target_zone: None,
            ticks_in_target_zone: 0,
            void_syncs: 0,
            daily_trait_snapshots: vec![],
            core_memories: vec![],
            last_memory_timestamp: serde_json::json!({}),
            visited_zones: vec![],
            evolution_proposal: None,
            evolution_history: vec![],
            formation_complete: false,
            formation_progress: 0.0,
            trauma_level: 0.0,
            catharsis_progress: 0.0,
            catharsis_achieved: false,
            catharsis_xp_burst_expires_at: None,
            trauma_cooldown_until: None,
            daily_vector_variance: 0.0,
            confused_state: false,
            sleep_started_at: None,
            last_sleep_timestamp: None,
            ticks_in_singularity: 0,
            singularity_zones: vec![],
        }
    }
}

/// Mirror of TypeScript Account
#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_vector: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_coefficient: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_generation: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_guardian: Option<Value>,
}

/// Mirror of TypeScript NewLifeResult
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct NewLifeResult {
    pub pet: Pet,
    pub account: Account,
}

/// Mirror of TypeScript PetEvent
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PetEvent {
    pub id: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub description: String,
    pub emoji: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xp_gained: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coins_gained: Option<i32>,
}
