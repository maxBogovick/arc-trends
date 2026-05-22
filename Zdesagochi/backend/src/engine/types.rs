// ════════════════════════════════════════════════════════════════════════════
//  PERSONALITY ENGINE — Core Types (Rust port of personality-core/src/types.ts)
// ════════════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Stat keys ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StatKey {
    Hunger,
    Happiness,
    Energy,
    Health,
    Cleanliness,
    Bond,
}

impl StatKey {
    pub fn all() -> &'static [StatKey] {
        &[
            StatKey::Hunger,
            StatKey::Happiness,
            StatKey::Energy,
            StatKey::Health,
            StatKey::Cleanliness,
            StatKey::Bond,
        ]
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            StatKey::Hunger => "hunger",
            StatKey::Happiness => "happiness",
            StatKey::Energy => "energy",
            StatKey::Health => "health",
            StatKey::Cleanliness => "cleanliness",
            StatKey::Bond => "bond",
        }
    }

    pub fn parse_key(s: &str) -> Option<StatKey> {
        s.parse().ok()
    }
}

impl std::str::FromStr for StatKey {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "hunger" => Ok(StatKey::Hunger),
            "happiness" => Ok(StatKey::Happiness),
            "energy" => Ok(StatKey::Energy),
            "health" => Ok(StatKey::Health),
            "cleanliness" => Ok(StatKey::Cleanliness),
            "bond" => Ok(StatKey::Bond),
            _ => Err(()),
        }
    }
}

// ── Trait keys ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TraitKey {
    Vitality,
    Sociality,
    Order,
    Appetite,
    Caution,
    Curiosity,
}

impl TraitKey {
    pub fn all() -> &'static [TraitKey] {
        &[
            TraitKey::Vitality,
            TraitKey::Sociality,
            TraitKey::Order,
            TraitKey::Appetite,
            TraitKey::Caution,
            TraitKey::Curiosity,
        ]
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            TraitKey::Vitality => "vitality",
            TraitKey::Sociality => "sociality",
            TraitKey::Order => "order",
            TraitKey::Appetite => "appetite",
            TraitKey::Caution => "caution",
            TraitKey::Curiosity => "curiosity",
        }
    }

    pub fn parse_key(s: &str) -> Option<TraitKey> {
        s.parse().ok()
    }
}

impl std::str::FromStr for TraitKey {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "vitality" => Ok(TraitKey::Vitality),
            "sociality" => Ok(TraitKey::Sociality),
            "order" => Ok(TraitKey::Order),
            "appetite" => Ok(TraitKey::Appetite),
            "caution" => Ok(TraitKey::Caution),
            "curiosity" => Ok(TraitKey::Curiosity),
            _ => Err(()),
        }
    }
}

pub type TraitVector = HashMap<TraitKey, f64>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BehaviorAxis {
    Care,
    Play,
    Social,
    Order,
    Exploration,
    Disruption,
    Recovery,
}

impl BehaviorAxis {
    pub fn all() -> &'static [BehaviorAxis] {
        &[
            BehaviorAxis::Care,
            BehaviorAxis::Play,
            BehaviorAxis::Social,
            BehaviorAxis::Order,
            BehaviorAxis::Exploration,
            BehaviorAxis::Disruption,
            BehaviorAxis::Recovery,
        ]
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            BehaviorAxis::Care => "care",
            BehaviorAxis::Play => "play",
            BehaviorAxis::Social => "social",
            BehaviorAxis::Order => "order",
            BehaviorAxis::Exploration => "exploration",
            BehaviorAxis::Disruption => "disruption",
            BehaviorAxis::Recovery => "recovery",
        }
    }
}

impl std::str::FromStr for BehaviorAxis {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "care" => Ok(BehaviorAxis::Care),
            "play" => Ok(BehaviorAxis::Play),
            "social" => Ok(BehaviorAxis::Social),
            "order" => Ok(BehaviorAxis::Order),
            "exploration" => Ok(BehaviorAxis::Exploration),
            "disruption" => Ok(BehaviorAxis::Disruption),
            "recovery" => Ok(BehaviorAxis::Recovery),
            _ => Err(()),
        }
    }
}

pub type BehaviorVector = HashMap<BehaviorAxis, f64>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorProfile {
    pub axes: BehaviorVector,
    pub sample_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated_at: Option<String>,
}

impl Default for BehaviorProfile {
    fn default() -> Self {
        let mut axes = HashMap::new();
        for axis in BehaviorAxis::all() {
            axes.insert(*axis, 0.0);
        }
        Self {
            axes,
            sample_count: 0,
            last_updated_at: None,
        }
    }
}

// ── Modifier caps ─────────────────────────────────────────────────────────────

pub const XP_MAX: f64 = 4.0;
pub const XP_MIN: f64 = 0.1;
pub const COIN_MAX: f64 = 3.0;
pub const COIN_MIN: f64 = 0.0;
pub const STAT_RESTORE_ADD_MAX: f64 = 80.0;
pub const DECAY_MULT_MAX: f64 = 3.0;
pub const DECAY_MULT_MIN: f64 = 0.05;

// ── Behavioral counters ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RollingDailyBucket {
    pub date: String,
    pub counts: HashMap<String, u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub food_counts: Option<HashMap<String, u32>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_add_counts: Option<HashMap<String, u32>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_use_counts: Option<HashMap<String, u32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BehavioralRollingWindows {
    pub daily_buckets: Vec<RollingDailyBucket>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehavioralCounters {
    // Session
    pub session_gap_hours: f64,
    pub last_action_timestamp: String,

    // Rolling 7-day
    pub feed_in_red_zone_7d: u32,
    pub feed_in_green_zone_7d: u32,
    pub forced_sleep_count_7d: u32,
    pub heal_when_healthy_7d: u32,
    pub night_wake_count_7d: u32,

    // Rolling 30-day
    pub session_gaps_over_48h_30d: u32,
    pub filth_crisis_count_30d: u32,

    // Streak counters
    pub consecutive_low_health_syncs: u32,
    pub consecutive_good_syncs: u32,
    pub consecutive_bad_mood_syncs: u32,
    pub max_consec_high_play_days: u32,
    pub current_high_play_days: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub night_single_interaction_days_7d: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_stats_snapshot: Option<HashMap<String, f64>>,

    // Daily (reset at midnight)
    pub play_count_today: u32,
    pub last_day_reset: String,
    pub daily_food_log: HashMap<String, u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recent_feed_timestamps: Option<Vec<String>>,

    // Lifetime
    pub unique_foods_tried: Vec<String>,
    #[serde(default)]
    pub unique_items_added: Vec<String>,
    #[serde(default)]
    pub unique_items_used: Vec<String>,
    #[serde(default)]
    pub daily_item_add_log: HashMap<String, u32>,
    #[serde(default)]
    pub daily_item_use_log: HashMap<String, u32>,
    #[serde(default)]
    pub item_adds_7d: u32,
    #[serde(default)]
    pub item_uses_7d: u32,
    #[serde(default)]
    pub repeated_item_use_7d: u32,
    pub total_bond_actions: u32,

    // Room (adventurer + wanderlust)
    pub same_room_hours: f64,
    pub last_equipped_room_id: String,
    pub last_room_check_ts: String,

    // Paranoid phase
    pub paranoid_phase: String, // "untrusted" | "trusted" | "collapsed"
    pub bond_actions_in_phase: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trusted_since: Option<String>,

    // One-time flags
    pub stoic_peak_used: bool,
    pub enlightenment_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enlightenment_start: Option<String>,
    pub chaos_daily_seed: f64,
    pub chaos_seed_date: String,
    pub melancholic_action_count: u32,

    // Rolling windows
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rolling_windows: Option<BehavioralRollingWindows>,
}

impl Default for BehavioralCounters {
    fn default() -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        Self {
            session_gap_hours: 0.0,
            last_action_timestamp: now.clone(),
            feed_in_red_zone_7d: 0,
            feed_in_green_zone_7d: 0,
            forced_sleep_count_7d: 0,
            heal_when_healthy_7d: 0,
            night_wake_count_7d: 0,
            session_gaps_over_48h_30d: 0,
            filth_crisis_count_30d: 0,
            consecutive_low_health_syncs: 0,
            consecutive_good_syncs: 0,
            consecutive_bad_mood_syncs: 0,
            max_consec_high_play_days: 0,
            current_high_play_days: 0,
            night_single_interaction_days_7d: Some(0),
            last_stats_snapshot: Some(HashMap::new()),
            play_count_today: 0,
            last_day_reset: today.clone(),
            daily_food_log: HashMap::new(),
            recent_feed_timestamps: Some(Vec::new()),
            unique_foods_tried: Vec::new(),
            unique_items_added: Vec::new(),
            unique_items_used: Vec::new(),
            daily_item_add_log: HashMap::new(),
            daily_item_use_log: HashMap::new(),
            item_adds_7d: 0,
            item_uses_7d: 0,
            repeated_item_use_7d: 0,
            total_bond_actions: 0,
            same_room_hours: 0.0,
            last_equipped_room_id: "default".to_string(),
            last_room_check_ts: now,
            paranoid_phase: "untrusted".to_string(),
            bond_actions_in_phase: 0,
            trusted_since: None,
            stoic_peak_used: false,
            enlightenment_active: false,
            enlightenment_start: None,
            chaos_daily_seed: 0.5,
            chaos_seed_date: today,
            melancholic_action_count: 0,
            rolling_windows: Some(BehavioralRollingWindows {
                daily_buckets: Vec::new(),
            }),
        }
    }
}

// ── Emergent state types ──────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EmergentStateType {
    Tantrum,
    Apathy,
    MidnightZoomies,
    FoodPanic,
    Breakdown,
    ContaminationCrisis,
    TrustCollapse,
    CoinObsession,
    DeepMelancholy,
    Enlightenment,
    Wanderlust,
    StoicPeak,
    ChaosSurge,
    FeastFrenzy,
    Singularity,
    IdentityCrisis,
    ShadowForm,
    Confused,
}

impl EmergentStateType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EmergentStateType::Tantrum => "tantrum",
            EmergentStateType::Apathy => "apathy",
            EmergentStateType::MidnightZoomies => "midnight_zoomies",
            EmergentStateType::FoodPanic => "food_panic",
            EmergentStateType::Breakdown => "breakdown",
            EmergentStateType::ContaminationCrisis => "contamination_crisis",
            EmergentStateType::TrustCollapse => "trust_collapse",
            EmergentStateType::CoinObsession => "coin_obsession",
            EmergentStateType::DeepMelancholy => "deep_melancholy",
            EmergentStateType::Enlightenment => "enlightenment",
            EmergentStateType::Wanderlust => "wanderlust",
            EmergentStateType::StoicPeak => "stoic_peak",
            EmergentStateType::ChaosSurge => "chaos_surge",
            EmergentStateType::FeastFrenzy => "feast_frenzy",
            EmergentStateType::Singularity => "singularity",
            EmergentStateType::IdentityCrisis => "identity_crisis",
            EmergentStateType::ShadowForm => "shadow_form",
            EmergentStateType::Confused => "confused",
        }
    }

    pub fn priority(&self) -> u32 {
        match self {
            EmergentStateType::ShadowForm => 1,
            EmergentStateType::Singularity => 2,
            EmergentStateType::Breakdown => 3,
            EmergentStateType::TrustCollapse => 4,
            EmergentStateType::IdentityCrisis => 5,
            EmergentStateType::StoicPeak => 6,
            EmergentStateType::Enlightenment => 6,
            EmergentStateType::Tantrum => 7,
            EmergentStateType::Apathy => 7,
            EmergentStateType::DeepMelancholy => 8,
            EmergentStateType::ContaminationCrisis => 8,
            EmergentStateType::FoodPanic => 8,
            EmergentStateType::ChaosSurge => 9,
            EmergentStateType::MidnightZoomies => 9,
            EmergentStateType::FeastFrenzy => 10,
            EmergentStateType::Wanderlust => 10,
            EmergentStateType::CoinObsession => 10,
            EmergentStateType::Confused => 15,
        }
    }
}

// ── Active emergent state layers ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PetStateLayers {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gameplay: Option<Vec<ActiveEmergentState>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evolution: Option<Vec<ActiveEmergentState>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cognitive: Option<Vec<ActiveEmergentState>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveEmergentState {
    #[serde(rename = "type")]
    pub state_type: EmergentStateType,
    pub layer: String,
    pub entered_at: String,
}

// ── Core Memory ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreMemory {
    pub id: String,
    pub timestamp: String,
    pub tier: String, // "rare" | "common"
    pub emoji: String,
    pub text: String,
    pub category: String,
    pub trait_key: String,
    pub direction: String, // "up" | "down" | "origin"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub personality_hint: Option<String>,
}

// ── Evolution types ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionProposal {
    pub target_personality_id: String,
    pub readiness: f64,
    pub depth: f64,
    pub proposed_at: String,
    pub core_memory_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub narrative_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionRecord {
    pub from_personality_id: String,
    pub to_personality_id: String,
    pub evolved_at: String,
    pub trigger: String, // "formation" | "stability" | "singularity" | "manual"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub core_memory_ids: Option<Vec<String>>,
}

// ── Mood snapshot ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodSnapshot {
    pub timestamp: String,
    pub mood: String,
    pub avg_stats: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dominant_low_stat: Option<String>,
}

// ── Trait snapshot ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraitSnapshot {
    pub date: String,
    pub vector: TraitVector,
}

// ── Personality special rules ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersonalitySpecialRules {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passive_stat_bonus_when_full: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reject_sleep_when_energized: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peak_performance_threshold: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anxious_stat_sad_threshold: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nighttime_hours: Option<[u32; 2]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub night_energy_decay_disabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resists_bathing: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xp_every_other_action: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub randomize_daily_seed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flat_xp_from_play: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub food_boredom_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub heal_refuse_health_threshold: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feed_restore_by_phase: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trust_threshold_bonds: Option<u32>,
}

// ── Food preferences ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FoodPreferences {
    pub loved_ids: Vec<String>,
    pub hated_ids: Vec<String>,
    pub love_bonus: HashMap<String, f64>,
    pub hate_penalty: HashMap<String, f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub universal_feed_bonus: Option<HashMap<String, f64>>,
}

// ── Auto-sleep config ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoSleepConfig {
    pub enabled: bool,
    pub energy_threshold: f64,
    pub probability: f64,
}

impl Default for AutoSleepConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            energy_threshold: 0.0,
            probability: 0.0,
        }
    }
}

// ── Mood bias ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodBiasConfig {
    pub ecstatic_min_avg: f64,
    pub happy_min_avg: f64,
    pub content_min_avg: f64,
}

impl Default for MoodBiasConfig {
    fn default() -> Self {
        Self {
            ecstatic_min_avg: 85.0,
            happy_min_avg: 65.0,
            content_min_avg: 45.0,
        }
    }
}

// ── Personality definition ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonalityDefinition {
    pub id: String,
    pub name: String,
    pub tagline: String,
    pub description: String,
    pub emoji: String,
    pub rarity: String,
    pub decay_rates: HashMap<String, f64>,
    pub restore_bonus: HashMap<String, HashMap<String, f64>>,
    pub xp_multipliers: HashMap<String, f64>,
    pub coin_multipliers: HashMap<String, f64>,
    pub food_preferences: FoodPreferences,
    pub auto_sleep: AutoSleepConfig,
    pub mood_bias: MoodBiasConfig,
    pub natural_health_regen: f64,
    pub negative_effect_resistance: f64,
    pub possible_flags: Vec<String>,
    pub emergent_triggers: Vec<EmergentTrigger>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub special_rules: Option<PersonalitySpecialRules>,
    pub linked_skin_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmergentTrigger {
    pub state_type: String,
    pub description: String,
}

// ── Blocked action ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockedAction {
    pub action_type: String,
    pub reason: String,
    pub alternative_hint: String,
}

// ── Applied modifier ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppliedModifier {
    pub source: String,
    pub id: String,
    pub description: String,
}

// ── Command result ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PetCommandResult {
    pub stat_deltas: HashMap<String, f64>,
    pub xp_delta: i32,
    pub coin_delta: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocked_action: Option<BlockedAction>,
    pub applied_modifiers: Vec<AppliedModifier>,
    pub events: Vec<String>,
    pub active_emergent_states: Vec<String>,
    pub meta: HashMap<String, serde_json::Value>,
    pub influence_cooldowns: HashMap<String, u32>,
    pub current_sync: u32,
    pub schema_version: i32,
    pub engine_version: String,
    pub registry_version: String,
}

// ── Registered influence ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredInfluence {
    pub id: String,
    pub category: String,
    pub label: String,
    pub trait_deltas: HashMap<String, f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trauma_delta: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cooldown_syncs: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditions: Option<Vec<InfluenceCondition>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_apply: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InfluenceCondition {
    #[serde(rename = "type")]
    pub condition_type: String,
    pub params: HashMap<String, serde_json::Value>,
}

// ── Helper functions ──────────────────────────────────────────────────────────

pub fn clamp(v: f64, lo: f64, hi: f64) -> f64 {
    v.max(lo).min(hi)
}

pub fn clamp_stat(v: f64) -> f64 {
    clamp(v, 0.0, 100.0)
}

pub fn avg_stats(stats: &HashMap<StatKey, f64>) -> f64 {
    if stats.is_empty() {
        return 0.0;
    }
    let sum: f64 = stats.values().sum();
    sum / stats.len() as f64
}

pub fn stats_to_map(
    hunger: f64,
    happiness: f64,
    energy: f64,
    health: f64,
    cleanliness: f64,
    bond: f64,
) -> HashMap<StatKey, f64> {
    let mut m = HashMap::new();
    m.insert(StatKey::Hunger, hunger);
    m.insert(StatKey::Happiness, happiness);
    m.insert(StatKey::Energy, energy);
    m.insert(StatKey::Health, health);
    m.insert(StatKey::Cleanliness, cleanliness);
    m.insert(StatKey::Bond, bond);
    m
}
