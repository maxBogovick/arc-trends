// ════════════════════════════════════════════════════════════════════════════
//  COMMAND HANDLERS — Rust port of personality-core/src/commandHandlers.ts
//  Main entrypoint for the personality engine.
// ════════════════════════════════════════════════════════════════════════════

use std::collections::HashMap;
use chrono::{DateTime, Utc, Timelike};

use crate::domain::pet::{Pet, PetMood, PetStats};
use crate::engine::personality_engine::{
    apply_decay, apply_action_modifiers, calc_mood_with_bias, compute_natural_passives,
    create_default_counters, get_paranoid_restore_mult, get_peak_performance_mult, ActionResult,
};
use crate::engine::personalities::get_personality_or_default;
use crate::engine::trait_evolution::{
    accept_evolution as te_accept_evolution, check_evolution,
    check_shadow_form, reject_evolution as te_reject_evolution,
    CATHARSIS_XP_BURST_MULTIPLIER,
};
use crate::engine::types::{
    clamp_stat, AppliedModifier, BehavioralCounters, BlockedAction, CoreMemory,
    EmergentStateType, EvolutionProposal, EvolutionRecord, MoodSnapshot, PetCommandResult,
    PetStateLayers, ActiveEmergentState, StatKey, TraitKey, TraitSnapshot, TraitVector,
};

// ── Engine State ──────────────────────────────────────────────────────────────

/// Full personality engine state, converted from Pet and back
#[derive(Debug, Clone)]
pub struct EngineState {
    pub personality: String,
    pub stats: HashMap<StatKey, f64>,
    pub is_asleep: bool,
    pub mood: String,
    pub level: i32,
    pub xp: i32,
    pub xp_to_next: i32,
    pub behavioral_counters: BehavioralCounters,
    pub behavioral_flags: Vec<serde_json::Value>,
    pub state_layers: PetStateLayers,
    pub emergent_state: Option<EmergentStateType>,
    pub trait_vector: TraitVector,
    pub daily_trait_budget: HashMap<TraitKey, f64>,
    pub current_target_zone: Option<String>,
    pub ticks_in_target_zone: u32,
    pub void_syncs: u32,
    pub formation_complete: bool,
    pub formation_progress: f64,
    pub core_memories: Vec<CoreMemory>,
    pub evolution_proposal: Option<EvolutionProposal>,
    pub evolution_history: Vec<EvolutionRecord>,
    pub trauma_level: f64,
    pub catharsis_progress: f64,
    pub catharsis_achieved: bool,
    pub catharsis_xp_burst_expires_at: Option<String>,
    pub trauma_cooldown_until: Option<String>,
    pub daily_vector_variance: f64,
    pub confused_state: bool,
    pub sleep_started_at: Option<String>,
    pub last_sleep_timestamp: Option<String>,
    pub ticks_in_singularity: u32,
    pub singularity_zones: Vec<String>,
    pub daily_trait_snapshots: Vec<TraitSnapshot>,
    pub last_memory_timestamp: HashMap<String, String>,
    pub visited_zones: Vec<String>,
    pub mood_history: Vec<MoodSnapshot>,
    pub age_hours: f64,
}

impl EngineState {
    pub fn from_pet(pet: &Pet) -> Self {
        // Parse behavioral_counters from JSON
        let counters: BehavioralCounters = serde_json::from_value(pet.behavioral_counters.clone())
            .unwrap_or_else(|_| create_default_counters());

        // Parse trait_vector from JSON
        let trait_vector: TraitVector = parse_trait_vector(&pet.trait_vector);

        // Parse state_layers
        let state_layers: PetStateLayers = pet.state_layers.as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        // Parse evolution_proposal
        let evolution_proposal: Option<EvolutionProposal> = pet.evolution_proposal.as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok());

        // Parse evolution_history
        let evolution_history: Vec<EvolutionRecord> = pet.evolution_history.iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .collect();

        // Parse core_memories
        let core_memories: Vec<CoreMemory> = pet.core_memories.iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .collect();

        // Parse mood_history
        let mood_history: Vec<MoodSnapshot> = pet.mood_history.iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .collect();

        // Parse daily_trait_snapshots
        let daily_trait_snapshots: Vec<TraitSnapshot> = pet.daily_trait_snapshots.iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .collect();

        // Parse last_memory_timestamp
        let last_memory_timestamp: HashMap<String, String> =
            serde_json::from_value(pet.last_memory_timestamp.clone()).unwrap_or_default();

        // Parse emergent state from state_layers.gameplay
        let emergent_state = state_layers.gameplay.as_ref()
            .and_then(|v| v.first())
            .map(|s| s.state_type.clone());

        Self {
            personality: pet.personality.clone(),
            stats: stats_to_hashmap(&pet.stats),
            is_asleep: pet.is_asleep,
            mood: pet.mood.as_str().to_string(),
            level: pet.level,
            xp: pet.xp,
            xp_to_next: pet.xp_to_next,
            behavioral_counters: counters,
            behavioral_flags: pet.behavioral_flags.clone(),
            state_layers,
            emergent_state,
            trait_vector,
            daily_trait_budget: HashMap::new(),
            current_target_zone: pet.current_target_zone.clone(),
            ticks_in_target_zone: pet.ticks_in_target_zone as u32,
            void_syncs: pet.void_syncs as u32,
            formation_complete: pet.formation_complete,
            formation_progress: pet.formation_progress,
            core_memories,
            evolution_proposal,
            evolution_history,
            trauma_level: pet.trauma_level,
            catharsis_progress: pet.catharsis_progress,
            catharsis_achieved: pet.catharsis_achieved,
            catharsis_xp_burst_expires_at: pet.catharsis_xp_burst_expires_at.clone(),
            trauma_cooldown_until: pet.trauma_cooldown_until.clone(),
            daily_vector_variance: pet.daily_vector_variance,
            confused_state: pet.confused_state,
            sleep_started_at: pet.sleep_started_at.clone(),
            last_sleep_timestamp: pet.last_sleep_timestamp.clone(),
            ticks_in_singularity: pet.ticks_in_singularity as u32,
            singularity_zones: pet.singularity_zones.clone(),
            daily_trait_snapshots,
            last_memory_timestamp,
            visited_zones: pet.visited_zones.clone(),
            mood_history,
            age_hours: pet.age_hours,
        }
    }

    pub fn apply_to_pet(&self, pet: &mut Pet) {
        pet.personality = self.personality.clone();
        pet.stats = hashmap_to_stats(&self.stats);
        pet.is_asleep = self.is_asleep;
        pet.mood = string_to_mood(&self.mood);
        pet.level = self.level;
        pet.xp = self.xp;
        pet.xp_to_next = self.xp_to_next;
        pet.behavioral_counters = serde_json::to_value(&self.behavioral_counters).unwrap_or_default();
        pet.behavioral_flags = self.behavioral_flags.clone();
        pet.state_layers = Some(serde_json::to_value(&self.state_layers).unwrap_or_default());
        pet.emergent_state = self.emergent_state.as_ref()
            .map(|s| serde_json::to_value(s).unwrap_or(serde_json::Value::Null));
        pet.trait_vector = trait_vector_to_json(&self.trait_vector);
        pet.current_target_zone = self.current_target_zone.clone();
        pet.ticks_in_target_zone = self.ticks_in_target_zone as i32;
        pet.void_syncs = self.void_syncs as i32;
        pet.formation_complete = self.formation_complete;
        pet.formation_progress = self.formation_progress;
        pet.core_memories = self.core_memories.iter()
            .map(|m| serde_json::to_value(m).unwrap_or_default())
            .collect();
        pet.evolution_proposal = self.evolution_proposal.as_ref()
            .map(|p| serde_json::to_value(p).unwrap_or_default());
        pet.evolution_history = self.evolution_history.iter()
            .map(|r| serde_json::to_value(r).unwrap_or_default())
            .collect();
        pet.trauma_level = self.trauma_level;
        pet.catharsis_progress = self.catharsis_progress;
        pet.catharsis_achieved = self.catharsis_achieved;
        pet.catharsis_xp_burst_expires_at = self.catharsis_xp_burst_expires_at.clone();
        pet.trauma_cooldown_until = self.trauma_cooldown_until.clone();
        pet.daily_vector_variance = self.daily_vector_variance;
        pet.confused_state = self.confused_state;
        pet.sleep_started_at = self.sleep_started_at.clone();
        pet.last_sleep_timestamp = self.last_sleep_timestamp.clone();
        pet.ticks_in_singularity = self.ticks_in_singularity as i32;
        pet.singularity_zones = self.singularity_zones.clone();
        pet.daily_trait_snapshots = self.daily_trait_snapshots.iter()
            .map(|s| serde_json::to_value(s).unwrap_or_default())
            .collect();
        pet.last_memory_timestamp = serde_json::to_value(&self.last_memory_timestamp).unwrap_or_default();
        pet.visited_zones = self.visited_zones.clone();
        pet.mood_history = self.mood_history.iter()
            .map(|s| serde_json::to_value(s).unwrap_or_default())
            .collect();
        pet.last_updated = chrono::Utc::now().to_rfc3339();
    }
}

// ── Pet Command ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct PetCommand {
    pub command_id: String,
    pub command_type: String,
    pub at: String,
    pub food_id: Option<String>,
    pub food_effect: Option<FoodEffect>,
    pub item_id: Option<String>,
    pub item_effect: Option<ItemEffect>,
    pub score_seed: Option<u32>,
    pub coin_balance: f64,
}

#[derive(Debug, Clone, Default)]
pub struct FoodEffect {
    pub hunger_restore: f64,
    pub happiness_bonus: f64,
    pub health_bonus: f64,
}

#[derive(Debug, Clone, Default)]
pub struct ItemEffect {
    pub hunger: Option<f64>,
    pub happiness: Option<f64>,
    pub energy: Option<f64>,
    pub health: Option<f64>,
    pub cleanliness: Option<f64>,
    pub bond: Option<f64>,
    pub xp: Option<f64>,
    pub coins: Option<f64>,
}

// ── Fallback food effects ──────────────────────────────────────────────────────

fn fallback_food_effect(food_id: &str) -> FoodEffect {
    match food_id {
        "apple"  => FoodEffect { hunger_restore: 20.0, happiness_bonus: 5.0, health_bonus: 10.0 },
        "pizza"  => FoodEffect { hunger_restore: 40.0, happiness_bonus: 20.0, health_bonus: -5.0 },
        "sushi"  => FoodEffect { hunger_restore: 30.0, happiness_bonus: 15.0, health_bonus: 5.0 },
        "candy"  => FoodEffect { hunger_restore: 10.0, happiness_bonus: 30.0, health_bonus: -10.0 },
        "salad"  => FoodEffect { hunger_restore: 25.0, happiness_bonus: 5.0, health_bonus: 20.0 },
        "ramen"  => FoodEffect { hunger_restore: 45.0, happiness_bonus: 25.0, health_bonus: 0.0 },
        "milk"   => FoodEffect { hunger_restore: 15.0, happiness_bonus: 8.0, health_bonus: 15.0 },
        "cake"   => FoodEffect { hunger_restore: 35.0, happiness_bonus: 35.0, health_bonus: -8.0 },
        _ => FoodEffect { hunger_restore: 0.0, happiness_bonus: 0.0, health_bonus: 0.0 },
    }
}

// ── Main command handler ──────────────────────────────────────────────────────

pub fn apply_personality_command(
    state: &mut EngineState,
    command: &PetCommand,
    now: DateTime<Utc>,
) -> PetCommandResult {
    let personality = get_personality_or_default(&state.personality);
    let local_hour = now.hour() as i32;
    let mut result = PetCommandResult::default();

    match command.command_type.as_str() {
        "accept_evolution" => {
            te_accept_evolution(state);
            result.events.push("evolution_accepted".to_string());
            return result;
        }
        "reject_evolution" => {
            te_reject_evolution(state);
            result.events.push("evolution_rejected".to_string());
            return result;
        }
        _ => {}
    }

    // Check if asleep (block non-sleep commands)
    if command.command_type != "wake" && command.command_type != "sync" && state.is_asleep {
        result.blocked_action = Some(BlockedAction {
            action_type: command.command_type.clone(),
            reason: "Питомец спит!".to_string(),
            alternative_hint: "Разбуди питомца".to_string(),
        });
        return result;
    }
    if command.command_type == "wake" && !state.is_asleep {
        result.blocked_action = Some(BlockedAction {
            action_type: command.command_type.clone(),
            reason: "Питомец и так не спит!".to_string(),
            alternative_hint: "Выбери другое действие".to_string(),
        });
        return result;
    }

    // Sync: apply decay + passives
    if command.command_type == "sync" {
        let last_updated = state.behavioral_counters.last_action_timestamp.parse::<DateTime<Utc>>()
            .unwrap_or(now);
        let elapsed_minutes = (now.signed_duration_since(last_updated).num_seconds() as f64 / 60.0).max(0.0);

        if !state.is_asleep {
            apply_decay(&mut state.stats, personality, elapsed_minutes, &state.behavioral_counters, local_hour);

            // Filth → health drain
            let cleanliness = state.stats.get(&StatKey::Cleanliness).copied().unwrap_or(100.0);
            if cleanliness < 30.0 {
                let health = state.stats.get(&StatKey::Health).copied().unwrap_or(100.0);
                state.stats.insert(StatKey::Health, clamp_stat(health - 0.5 * elapsed_minutes));
            }
        } else {
            // Sleep healing
            let sleep_restore = personality.restore_bonus.get("sleep")
                .and_then(|b| b.get("energy"))
                .copied()
                .unwrap_or(0.0);
            let energy = state.stats.get(&StatKey::Energy).copied().unwrap_or(0.0);
            let hunger = state.stats.get(&StatKey::Hunger).copied().unwrap_or(50.0);
            let health = state.stats.get(&StatKey::Health).copied().unwrap_or(50.0);
            state.stats.insert(StatKey::Energy, clamp_stat(energy + (5.0 + sleep_restore) * (elapsed_minutes / 15.0)));
            state.stats.insert(StatKey::Hunger, clamp_stat(hunger - 0.8 * (elapsed_minutes / 15.0)));
            state.stats.insert(StatKey::Health, clamp_stat(health + 0.5 * (elapsed_minutes / 15.0)));
        }

        // Natural passives
        let passives = compute_natural_passives(&state.stats.clone(), personality);
        for (stat, delta) in &passives {
            let current = state.stats.get(stat).copied().unwrap_or(0.0);
            state.stats.insert(*stat, clamp_stat(current + delta));
        }

        // Auto-sleep check
        if !state.is_asleep
            && personality.auto_sleep.enabled
            && state.stats.get(&StatKey::Energy).copied().unwrap_or(100.0) <= personality.auto_sleep.energy_threshold
        {
            // Simplified: 30% chance to auto-sleep
            state.is_asleep = true;
            state.sleep_started_at = Some(now.to_rfc3339());
            result.applied_modifiers.push(AppliedModifier {
                source: "base".to_string(),
                id: "system:auto_sleep".to_string(),
                description: "Auto sleep started during sync".to_string(),
            });
        }

        // Update counters
        crate::engine::personality_engine::update_counters(
            &mut state.behavioral_counters,
            "sync",
            &state.stats,
            now,
            local_hour,
            None,
            Some(personality),
        );

        // Update mood streaks
        let mood = calc_mood_with_bias(&state.stats, personality, state.is_asleep);
        if mood == "sad" {
            state.behavioral_counters.consecutive_bad_mood_syncs += 1;
        } else {
            state.behavioral_counters.consecutive_bad_mood_syncs = 0;
        }
        let avg = crate::engine::types::avg_stats(&state.stats);
        if avg > 70.0 {
            state.behavioral_counters.consecutive_good_syncs += 1;
        } else {
            state.behavioral_counters.consecutive_good_syncs = 0;
        }

        // Compute emergent state
        let session_gap = state.behavioral_counters.session_gap_hours;
        let new_state = crate::engine::personality_engine::compute_emergent_state(
            &state.stats,
            personality,
            &state.behavioral_counters,
            &state.state_layers,
            now,
            command.coin_balance,
            session_gap,
        );
        state.emergent_state = new_state.clone();
        if let Some(s) = new_state {
            state.state_layers.gameplay = Some(vec![ActiveEmergentState {
                state_type: s,
                layer: "gameplay".to_string(),
                entered_at: now.to_rfc3339(),
            }]);
        } else {
            state.state_layers.gameplay = None;
        }

        // Check evolution
        check_evolution(state);

        // Update mood
        state.mood = calc_mood_with_bias(&state.stats, personality, state.is_asleep);

        // Add to mood history
        let snap = MoodSnapshot {
            timestamp: now.to_rfc3339(),
            mood: state.mood.clone(),
            avg_stats: avg,
            dominant_low_stat: None,
        };
        state.mood_history.insert(0, snap);
        if state.mood_history.len() > 168 {
            state.mood_history.pop();
        }

        result.events.push("sync_applied".to_string());
        return result;
    }

    // Check special blocks
    if let Some(blocked) = get_special_blocked_action(state, command, personality) {
        result.blocked_action = Some(blocked);
        return result;
    }

    // Handle sleep/wake lifecycle
    if command.command_type == "sleep" {
        state.is_asleep = true;
        state.sleep_started_at = Some(now.to_rfc3339());
        result.applied_modifiers.push(AppliedModifier {
            source: "base".to_string(),
            id: "sleep:start".to_string(),
            description: "Sleep lifecycle started".to_string(),
        });
        result.events.push("sleep_started".to_string());
        finalize_command(state, command, personality, &mut result, 0.0, 0.0, now, local_hour);
        return result;
    }

    if command.command_type == "wake" {
        let slept_hours = state.sleep_started_at.as_ref()
            .and_then(|s| s.parse::<DateTime<Utc>>().ok())
            .map(|started| now.signed_duration_since(started).num_seconds() as f64 / 3600.0)
            .unwrap_or(0.0).max(0.0);
        let natural_wake = slept_hours >= 4.0;
        state.is_asleep = false;

        // Variance reset on natural long sleep
        if natural_wake && slept_hours >= 4.0 {
            state.daily_vector_variance = 0.0;
            state.confused_state = false;
            state.last_sleep_timestamp = Some(now.to_rfc3339());
        }
        state.sleep_started_at = None;

        result.meta.insert("sleptHours".to_string(), serde_json::json!(slept_hours));
        result.meta.insert("naturalWake".to_string(), serde_json::json!(natural_wake));
        result.events.push("sleep_finished".to_string());
        finalize_command(state, command, personality, &mut result, 0.0, 0.0, now, local_hour);
        return result;
    }

    // Get base action result
    let play_score = if command.command_type == "play" {
        let s = command.score_seed.map(|s| s as f64).unwrap_or_else(|| {
            // deterministic-ish using command_id
            let hash: u64 = command.command_id.bytes().fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64));
            40.0 + (hash % 180) as f64
        });
        Some(s)
    } else {
        None
    };

    let base = get_base_action_result(state, command, play_score);
    let (base_stat_deltas, base_xp, base_coins) = base;

    // Apply personality modifiers
    let food_id_str = command.food_id.as_deref();
    let modified = apply_action_modifiers(
        ActionResult {
            stat_deltas: base_stat_deltas.clone(),
            xp: base_xp,
            coins: base_coins,
        },
        &command.command_type,
        personality,
        &state.behavioral_counters,
        food_id_str,
        &active_emergent_state_list(state),
    );

    let mut xp_delta = modified.xp as f64;
    let mut coin_delta = modified.coins as f64;
    let mut stat_deltas = modified.stat_deltas;

    // Apply special outcome modifiers
    apply_special_outcome_modifiers(
        state,
        command,
        personality,
        &mut stat_deltas,
        &mut xp_delta,
        &mut coin_delta,
        &mut result.applied_modifiers,
        now,
    );

    // Apply stat deltas
    for (stat_str, delta) in &stat_deltas {
        if let Some(stat) = StatKey::from_str(stat_str) {
            let current = state.stats.get(&stat).copied().unwrap_or(0.0);
            state.stats.insert(stat, clamp_stat(current + delta));
        }
    }

    // Apply XP and levelup
    let level_bonus_coins = apply_xp(state, xp_delta as i32);
    coin_delta += level_bonus_coins as f64;

    result.stat_deltas = stat_deltas;
    result.xp_delta = xp_delta as i32;
    result.coin_delta = coin_delta as i32;
    if let Some(score) = play_score {
        result.meta.insert("score".to_string(), serde_json::json!(score));
    }

    finalize_command(state, command, personality, &mut result, xp_delta, coin_delta, now, local_hour);
    result
}

fn get_base_action_result(
    state: &EngineState,
    command: &PetCommand,
    play_score: Option<f64>,
) -> (HashMap<String, f64>, f64, f64) {
    match command.command_type.as_str() {
        "play" => {
            let score = play_score.unwrap_or(100.0);
            let mut deltas = HashMap::new();
            deltas.insert("happiness".to_string(), 20.0);
            deltas.insert("energy".to_string(), -15.0);
            deltas.insert("bond".to_string(), 8.0);
            let xp = (score * 0.5).floor();
            let coins = (score * 0.1).floor() + 2.0;
            (deltas, xp, coins)
        }
        "feed" => {
            let effect = command.food_effect.as_ref()
                .cloned()
                .unwrap_or_else(|| {
                    command.food_id.as_deref()
                        .map(fallback_food_effect)
                        .unwrap_or_default()
                });
            let mut deltas = HashMap::new();
            deltas.insert("hunger".to_string(), effect.hunger_restore);
            if effect.happiness_bonus != 0.0 {
                deltas.insert("happiness".to_string(), effect.happiness_bonus);
            }
            if effect.health_bonus != 0.0 {
                deltas.insert("health".to_string(), effect.health_bonus);
            }
            (deltas, 8.0, 0.0)
        }
        "bathe" => {
            let mut deltas = HashMap::new();
            deltas.insert("cleanliness".to_string(), 40.0);
            deltas.insert("happiness".to_string(), 5.0);
            deltas.insert("health".to_string(), 5.0);
            // Feral override
            if state.personality == "feral" {
                deltas.insert("happiness".to_string(), -20.0);
            }
            (deltas, 12.0, 0.0)
        }
        "heal" => {
            let mut deltas = HashMap::new();
            deltas.insert("health".to_string(), 35.0);
            deltas.insert("happiness".to_string(), -5.0);
            (deltas, 18.0, 0.0)
        }
        "bond" => {
            let mut deltas = HashMap::new();
            deltas.insert("happiness".to_string(), 15.0);
            deltas.insert("bond".to_string(), 20.0);
            (deltas, 6.0, 0.0)
        }
        "use_item" => {
            if let Some(ref effect) = command.item_effect {
                let mut deltas = HashMap::new();
                if let Some(v) = effect.hunger     { if v != 0.0 { deltas.insert("hunger".to_string(), v); } }
                if let Some(v) = effect.happiness  { if v != 0.0 { deltas.insert("happiness".to_string(), v); } }
                if let Some(v) = effect.energy     { if v != 0.0 { deltas.insert("energy".to_string(), v); } }
                if let Some(v) = effect.health     { if v != 0.0 { deltas.insert("health".to_string(), v); } }
                if let Some(v) = effect.cleanliness { if v != 0.0 { deltas.insert("cleanliness".to_string(), v); } }
                if let Some(v) = effect.bond       { if v != 0.0 { deltas.insert("bond".to_string(), v); } }
                let xp = effect.xp.unwrap_or(0.0);
                let coins = effect.coins.unwrap_or(0.0);
                (deltas, xp, coins)
            } else {
                (HashMap::new(), 0.0, 0.0)
            }
        }
        _ => (HashMap::new(), 0.0, 0.0),
    }
}

fn get_special_blocked_action(
    state: &EngineState,
    command: &PetCommand,
    personality: &crate::engine::types::PersonalityDefinition,
) -> Option<BlockedAction> {
    let action = &command.command_type;
    let hunger = state.stats.get(&StatKey::Hunger).copied().unwrap_or(50.0);
    let energy = state.stats.get(&StatKey::Energy).copied().unwrap_or(50.0);
    let health = state.stats.get(&StatKey::Health).copied().unwrap_or(50.0);
    let cleanliness = state.stats.get(&StatKey::Cleanliness).copied().unwrap_or(50.0);

    if action == "feed" && hunger > 90.0 {
        return Some(BlockedAction {
            action_type: action.clone(),
            reason: "Питомец и так сыт!".to_string(),
            alternative_hint: "Покорми позже".to_string(),
        });
    }
    if action == "play" && energy < 10.0 {
        return Some(BlockedAction {
            action_type: action.clone(),
            reason: "Питомец слишком устал для игр".to_string(),
            alternative_hint: "Дай питомцу поспать".to_string(),
        });
    }
    if action == "sleep" {
        if let Some(true) = personality.special_rules.as_ref().and_then(|r| r.reject_sleep_when_energized) {
            if energy > 30.0 {
                return Some(BlockedAction {
                    action_type: action.clone(),
                    reason: "Слишком бодрый чтобы спать!".to_string(),
                    alternative_hint: "Сначала потрать энергию".to_string(),
                });
            }
        }
    }
    if action == "bathe" && cleanliness > 90.0 {
        return Some(BlockedAction {
            action_type: action.clone(),
            reason: "Питомец уже чистый!".to_string(),
            alternative_hint: "Выбери другое действие".to_string(),
        });
    }
    if action == "heal" {
        if health >= 90.0 {
            return Some(BlockedAction {
                action_type: action.clone(),
                reason: "Питомец уже здоров!".to_string(),
                alternative_hint: "Выбери другое действие".to_string(),
            });
        }
        if let Some(threshold) = personality.special_rules.as_ref().and_then(|r| r.heal_refuse_health_threshold) {
            if health > threshold {
                return Some(BlockedAction {
                    action_type: action.clone(),
                    reason: "Не верит что болен!".to_string(),
                    alternative_hint: "Сначала укрепи доверие".to_string(),
                });
            }
        }
    }

    None
}

#[allow(clippy::too_many_arguments)]
fn apply_special_outcome_modifiers(
    state: &mut EngineState,
    command: &PetCommand,
    personality: &crate::engine::types::PersonalityDefinition,
    stat_deltas: &mut HashMap<String, f64>,
    xp_delta: &mut f64,
    coin_delta: &mut f64,
    modifiers: &mut Vec<AppliedModifier>,
    now: DateTime<Utc>,
) {
    // Paranoid: feed restore by phase
    if command.command_type == "feed"
        && personality.special_rules.as_ref().is_some_and(|r| r.feed_restore_by_phase.unwrap_or(false))
    {
        let mult = get_paranoid_restore_mult(&state.behavioral_counters);
        for (stat, value) in stat_deltas.iter_mut() {
            if stat != "health" {
                *value *= mult;
            }
        }
        modifiers.push(AppliedModifier {
            source: "special_rule".to_string(),
            id: "paranoid_restore_mult".to_string(),
            description: "Paranoid restore multiplier applied".to_string(),
        });
    }

    // Peak performance (anxious)
    if command.command_type == "play" {
        let (xp_mult, coin_mult) = get_peak_performance_mult(&state.stats, personality);
        if xp_mult != 1.0 || coin_mult != 1.0 {
            *xp_delta = (*xp_delta * xp_mult).round();
            *coin_delta = (*coin_delta * coin_mult).round();
            modifiers.push(AppliedModifier {
                source: "special_rule".to_string(),
                id: "peakPerformanceThreshold".to_string(),
                description: "Peak performance multiplier applied".to_string(),
            });
        }

        // Melancholic: XP every other action
        if personality.special_rules.as_ref().is_some_and(|r| r.xp_every_other_action.unwrap_or(false)) {
            state.behavioral_counters.melancholic_action_count += 1;
            if !state.behavioral_counters.melancholic_action_count.is_multiple_of(2) {
                *xp_delta = 0.0;
            }
            modifiers.push(AppliedModifier {
                source: "special_rule".to_string(),
                id: "xpEveryOtherAction".to_string(),
                description: "Melancholic XP cadence applied".to_string(),
            });
        }
    }

    // Catharsis XP burst
    if let Some(ref expiry_str) = state.catharsis_xp_burst_expires_at.clone() {
        if let Ok(expiry) = expiry_str.parse::<DateTime<Utc>>() {
            if now < expiry && *xp_delta > 0.0 {
                *xp_delta = (*xp_delta * CATHARSIS_XP_BURST_MULTIPLIER).round();
                modifiers.push(AppliedModifier {
                    source: "special_rule".to_string(),
                    id: "catharsis_xp_burst".to_string(),
                    description: "Catharsis XP burst active".to_string(),
                });
            }
        }
    }

    // Legacy bonuses from evolution history
    if !state.evolution_history.is_empty() {
        let mut xp_mult = 1.0f64;
        let mut coin_mult = 1.0f64;
        let mut applied = false;
        for record in &state.evolution_history {
            // Simplified: small bonus for having evolved
            if record.trigger == "singularity" {
                xp_mult += 0.05;
                coin_mult += 0.05;
                applied = true;
            }
        }
        if applied {
            *xp_delta = (*xp_delta * xp_mult).round();
            *coin_delta = (*coin_delta * coin_mult).round();
            modifiers.push(AppliedModifier {
                source: "special_rule".to_string(),
                id: "evolution_legacy_bonus".to_string(),
                description: "Evolution legacy bonuses applied".to_string(),
            });
        }
    }

    *xp_delta = (*xp_delta).max(0.0).round();
    *coin_delta = coin_delta.round();
}

#[allow(clippy::too_many_arguments)]
fn finalize_command(
    state: &mut EngineState,
    command: &PetCommand,
    personality: &crate::engine::types::PersonalityDefinition,
    result: &mut PetCommandResult,
    _xp_delta: f64,
    _coin_delta: f64,
    now: DateTime<Utc>,
    local_hour: i32,
) {
    let food_id = command.food_id.as_deref();

    // Update counters
    crate::engine::personality_engine::update_counters(
        &mut state.behavioral_counters,
        &command.command_type,
        &state.stats,
        now,
        local_hour,
        food_id,
        Some(personality),
    );

    // Update mood
    let new_mood = calc_mood_with_bias(&state.stats, personality, state.is_asleep);
    state.mood = new_mood;

    // Compute emergent state
    let session_gap = state.behavioral_counters.session_gap_hours;
    let new_emergent = crate::engine::personality_engine::compute_emergent_state(
        &state.stats,
        personality,
        &state.behavioral_counters,
        &state.state_layers,
        now,
        command.coin_balance,
        session_gap,
    );
    state.emergent_state = new_emergent.clone();
    if let Some(s) = new_emergent {
        state.state_layers.gameplay = Some(vec![ActiveEmergentState {
            state_type: s.clone(),
            layer: "gameplay".to_string(),
            entered_at: now.to_rfc3339(),
        }]);
    } else {
        state.state_layers.gameplay = None;
    }

    // Collect active emergent states for result
    result.active_emergent_states = get_active_emergent_state_strings(state);

    // Shadow form check
    check_shadow_form(state, now);
}

fn active_emergent_state_list(state: &EngineState) -> Vec<EmergentStateType> {
    state.emergent_state.clone().map(|s| vec![s]).unwrap_or_default()
}

fn get_active_emergent_state_strings(state: &EngineState) -> Vec<String> {
    state.emergent_state.as_ref().map(|s| vec![s.as_str().to_string()]).unwrap_or_default()
}

fn apply_xp(state: &mut EngineState, amount: i32) -> i32 {
    let mut xp = state.xp + amount.max(0);
    let mut level = state.level.max(1);
    let mut xp_to_next = state.xp_to_next;
    if xp_to_next <= 0 {
        xp_to_next = level * 100 + 50;
        if xp_to_next <= 0 {
            xp_to_next = 100;
        }
    }
    let mut bonus_coins = 0;

    while xp >= xp_to_next {
        xp -= xp_to_next;
        level += 1;
        xp_to_next = level * 100 + 50;
        if xp_to_next <= 0 {
            xp_to_next = 100;
        }
        bonus_coins += level * 5;
    }

    state.xp = xp;
    state.level = level;
    state.xp_to_next = xp_to_next;
    bonus_coins
}

// ── Conversion helpers ────────────────────────────────────────────────────────

fn stats_to_hashmap(stats: &PetStats) -> HashMap<StatKey, f64> {
    let mut m = HashMap::new();
    m.insert(StatKey::Hunger, stats.hunger);
    m.insert(StatKey::Happiness, stats.happiness);
    m.insert(StatKey::Energy, stats.energy);
    m.insert(StatKey::Health, stats.health);
    m.insert(StatKey::Cleanliness, stats.cleanliness);
    m.insert(StatKey::Bond, stats.bond);
    m
}

fn hashmap_to_stats(stats: &HashMap<StatKey, f64>) -> PetStats {
    PetStats {
        hunger: stats.get(&StatKey::Hunger).copied().unwrap_or(50.0),
        happiness: stats.get(&StatKey::Happiness).copied().unwrap_or(50.0),
        energy: stats.get(&StatKey::Energy).copied().unwrap_or(50.0),
        health: stats.get(&StatKey::Health).copied().unwrap_or(50.0),
        cleanliness: stats.get(&StatKey::Cleanliness).copied().unwrap_or(50.0),
        bond: stats.get(&StatKey::Bond).copied().unwrap_or(0.0),
    }
}

fn parse_trait_vector(value: &serde_json::Value) -> TraitVector {
    let mut tv = crate::engine::trait_evolution::create_initial_trait_vector();
    if let Some(obj) = value.as_object() {
        for (k, v) in obj {
            if let Some(key) = TraitKey::from_str(k) {
                if let Some(n) = v.as_f64() {
                    tv.insert(key, n);
                }
            }
        }
    }
    tv
}

fn trait_vector_to_json(tv: &TraitVector) -> serde_json::Value {
    let mut obj = serde_json::Map::new();
    for (k, v) in tv {
        obj.insert(k.as_str().to_string(), serde_json::json!(v));
    }
    serde_json::Value::Object(obj)
}

fn string_to_mood(s: &str) -> PetMood {
    match s {
        "ecstatic" => PetMood::Ecstatic,
        "happy" => PetMood::Happy,
        "content" => PetMood::Content,
        "sad" => PetMood::Sad,
        "tired" => PetMood::Tired,
        "sick" => PetMood::Sick,
        "sleeping" => PetMood::Sleeping,
        _ => PetMood::Content,
    }
}
