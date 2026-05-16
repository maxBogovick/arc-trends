// ════════════════════════════════════════════════════════════════════════════
//  TRAIT EVOLUTION ENGINE — Rust port of personality-core/src/TraitEvolutionEngine.ts
// ════════════════════════════════════════════════════════════════════════════

use chrono::{DateTime, Utc};
use std::collections::HashMap;

use crate::engine::command_handlers::EngineState;
use crate::engine::types::{
    ActiveEmergentState, CoreMemory, EmergentStateType, EvolutionRecord, InfluenceCondition,
    RegisteredInfluence, StatKey, TraitKey, TraitVector, clamp,
};

pub const FORMATION_THRESHOLD: f64 = 200.0;
pub const SINGULARITY_THRESHOLD_SYNCS: u32 = 48;
pub const STABILITY_SYNCS: u32 = 72;
pub const CATHARSIS_THRESHOLD: f64 = 100.0;
pub const CATHARSIS_XP_BURST_MULTIPLIER: f64 = 5.0;
pub const SHADOW_FORM_TRAUMA_THRESHOLD: f64 = 75.0;
pub const SHADOW_FORM_COOLDOWN_DAYS: i64 = 14;
pub const VOID_THRESHOLD_SYNCS: u32 = 7 * 24;
pub const HYSTERESIS: f64 = 8.0;
pub const SMOOTHING_ALPHA: f64 = 0.08;
pub const REGRESSION_RATE: f64 = 0.02;
pub const LEGACY_BLEND_RATIO: f64 = 0.70;
pub const SINGULARITY_EPSILON: f64 = 0.15;
pub const CONFUSED_VARIANCE_THRESHOLD: f64 = 25.0;

fn daily_budget(key: TraitKey) -> f64 {
    match key {
        TraitKey::Vitality => 12.0,
        TraitKey::Sociality => 8.0,
        TraitKey::Order => 6.0,
        TraitKey::Appetite => 10.0,
        TraitKey::Caution => 8.0,
        TraitKey::Curiosity => 10.0,
    }
}

fn formation_weight(category: &str) -> f64 {
    match category {
        "action" => 1.0,
        "item" => 1.5,
        "training" => 2.0,
        "discipline" => 1.5,
        "cosmetic" => 1.2,
        "environment" => 0.8,
        "social" => 2.0,
        "system" => 0.0,
        _ => 1.0,
    }
}

pub fn apply_registered_influence(
    state: &mut EngineState,
    influence: &RegisteredInfluence,
    now: DateTime<Utc>,
) -> bool {
    if !blocked_influence_conditions(state, influence).is_empty() {
        return false;
    }

    let mut budgeted_delta: HashMap<TraitKey, f64> = HashMap::new();

    for (key, raw_delta) in &influence.trait_deltas {
        let Some(trait_key) = TraitKey::parse_key(key) else {
            continue;
        };
        let spent = state
            .daily_trait_budget
            .get(&trait_key)
            .copied()
            .unwrap_or(0.0);
        let remaining = (daily_budget(trait_key) - spent).max(0.0);
        let applied = clamp(*raw_delta, -remaining, remaining);
        if applied == 0.0 {
            continue;
        }

        budgeted_delta.insert(trait_key, applied);
        state
            .daily_trait_budget
            .insert(trait_key, spent + applied.abs());

        let current = state.trait_vector.get(&trait_key).copied().unwrap_or(50.0);
        state.trait_vector.insert(
            trait_key,
            clamp(current + applied * SMOOTHING_ALPHA, 0.0, 100.0),
        );
    }

    let variance_delta: f64 = budgeted_delta.values().map(|v| v.abs()).sum();
    state.daily_vector_variance += variance_delta;
    update_confused_state(state, now);

    if let Some(trauma_delta) = influence.trauma_delta {
        state.trauma_level = clamp(state.trauma_level + trauma_delta, 0.0, 100.0);
        check_shadow_form(state, now);
    }

    update_formation_progress(state, influence, &budgeted_delta, now);
    true
}

fn update_formation_progress(
    state: &mut EngineState,
    influence: &RegisteredInfluence,
    budgeted_delta: &HashMap<TraitKey, f64>,
    now: DateTime<Utc>,
) {
    if state.formation_complete {
        return;
    }

    let delta_sum: f64 = budgeted_delta.values().map(|v| v.abs()).sum();
    state.formation_progress = (state.formation_progress
        + delta_sum * formation_weight(&influence.category))
    .min(FORMATION_THRESHOLD);

    if state.formation_progress >= FORMATION_THRESHOLD {
        complete_formation(state, now);
    }
}

fn complete_formation(state: &mut EngineState, now: DateTime<Utc>) {
    let personalities = crate::engine::personalities::get_personalities();
    let starter = personalities
        .iter()
        .map(|p| {
            (
                p.id.clone(),
                depth_of_immersion(&state.trait_vector, &p.id, 0.0),
            )
        })
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    let Some((personality_id, _)) = starter else {
        return;
    };

    state.personality = personality_id.clone();
    state.formation_complete = true;

    let personality = crate::engine::personalities::get_personality(&personality_id);
    let text = format!(
        "Характер сформировался: {}",
        personality
            .map(|p| p.name.as_str())
            .unwrap_or(personality_id.as_str())
    );
    add_core_memory(
        state,
        "rare",
        "🥚",
        &text,
        "system",
        "vitality",
        "origin",
        Some(&personality_id),
        now,
    );
}

fn update_confused_state(state: &mut EngineState, now: DateTime<Utc>) {
    state.confused_state = state.daily_vector_variance >= CONFUSED_VARIANCE_THRESHOLD;
    if state.confused_state {
        let layer = ActiveEmergentState {
            state_type: EmergentStateType::Confused,
            layer: "cognitive".to_string(),
            entered_at: now.to_rfc3339(),
        };
        if let Some(ref mut layers) = state.state_layers.cognitive {
            if !layers
                .iter()
                .any(|s| s.state_type == EmergentStateType::Confused)
            {
                layers.push(layer);
            }
        } else {
            state.state_layers.cognitive = Some(vec![layer]);
        }
    } else if let Some(ref mut layers) = state.state_layers.cognitive {
        layers.retain(|s| s.state_type != EmergentStateType::Confused);
    }
}

fn blocked_influence_conditions(
    state: &EngineState,
    influence: &RegisteredInfluence,
) -> Vec<InfluenceCondition> {
    influence
        .conditions
        .clone()
        .unwrap_or_default()
        .into_iter()
        .filter(|condition| !evaluate_influence_condition(state, condition))
        .collect()
}

fn evaluate_influence_condition(state: &EngineState, condition: &InfluenceCondition) -> bool {
    let params = &condition.params;
    match condition.condition_type.as_str() {
        "personality_is" => params
            .get("id")
            .and_then(|v| v.as_str())
            .is_some_and(|id| state.formation_complete && id == state.personality),
        "trait_above" => {
            let Some(key) = params
                .get("key")
                .and_then(|v| v.as_str())
                .and_then(TraitKey::parse_key)
            else {
                return false;
            };
            let value = params.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
            state.trait_vector.get(&key).copied().unwrap_or(50.0) > value
        }
        "trait_below" => {
            let Some(key) = params
                .get("key")
                .and_then(|v| v.as_str())
                .and_then(TraitKey::parse_key)
            else {
                return false;
            };
            let value = params.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
            state.trait_vector.get(&key).copied().unwrap_or(50.0) < value
        }
        "stat_below" => {
            let Some(stat) = params
                .get("stat")
                .and_then(|v| v.as_str())
                .and_then(StatKey::parse_key)
            else {
                return false;
            };
            let value = params.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
            state.stats.get(&stat).copied().unwrap_or(50.0) < value
        }
        "session_gap_hours" => {
            let min = params.get("min").and_then(|v| v.as_f64()).unwrap_or(0.0);
            state.behavioral_counters.session_gap_hours >= min
        }
        "same_room_hours" => {
            let min = params.get("min").and_then(|v| v.as_f64()).unwrap_or(0.0);
            state.behavioral_counters.same_room_hours >= min
        }
        "formation_period" => params
            .get("active")
            .and_then(|v| v.as_bool())
            .is_some_and(|active| active != state.formation_complete),
        "streak_days" => {
            let days = params.get("days").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let action = params.get("action").and_then(|v| v.as_str()).unwrap_or("");
            action == "any"
                && state.behavioral_counters.consecutive_good_syncs as f64 >= days * 24.0
        }
        // Rust behavioral flags are still raw JSON; leave flag-specific gates off until the
        // flag model is ported into typed state.
        "flag_active" => false,
        _ => false,
    }
}

// Personality trait positions (simplified map for evolution decisions)
// Each personality has a "home" trait vector position
fn personality_position(id: &str) -> TraitVector {
    let mut map: HashMap<TraitKey, f64> = HashMap::new();
    match id {
        "playful" => {
            map.insert(TraitKey::Vitality, 70.0);
            map.insert(TraitKey::Sociality, 60.0);
            map.insert(TraitKey::Order, 30.0);
            map.insert(TraitKey::Appetite, 50.0);
            map.insert(TraitKey::Caution, 25.0);
            map.insert(TraitKey::Curiosity, 75.0);
        }
        "drowsy" => {
            map.insert(TraitKey::Vitality, 30.0);
            map.insert(TraitKey::Sociality, 50.0);
            map.insert(TraitKey::Order, 60.0);
            map.insert(TraitKey::Appetite, 45.0);
            map.insert(TraitKey::Caution, 55.0);
            map.insert(TraitKey::Curiosity, 35.0);
        }
        "foodie" => {
            map.insert(TraitKey::Vitality, 55.0);
            map.insert(TraitKey::Sociality, 55.0);
            map.insert(TraitKey::Order, 40.0);
            map.insert(TraitKey::Appetite, 90.0);
            map.insert(TraitKey::Caution, 35.0);
            map.insert(TraitKey::Curiosity, 60.0);
        }
        "bold" => {
            map.insert(TraitKey::Vitality, 85.0);
            map.insert(TraitKey::Sociality, 45.0);
            map.insert(TraitKey::Order, 25.0);
            map.insert(TraitKey::Appetite, 50.0);
            map.insert(TraitKey::Caution, 10.0);
            map.insert(TraitKey::Curiosity, 65.0);
        }
        "zen" => {
            map.insert(TraitKey::Vitality, 45.0);
            map.insert(TraitKey::Sociality, 65.0);
            map.insert(TraitKey::Order, 75.0);
            map.insert(TraitKey::Appetite, 40.0);
            map.insert(TraitKey::Caution, 70.0);
            map.insert(TraitKey::Curiosity, 55.0);
        }
        "anxious" => {
            map.insert(TraitKey::Vitality, 40.0);
            map.insert(TraitKey::Sociality, 40.0);
            map.insert(TraitKey::Order, 35.0);
            map.insert(TraitKey::Appetite, 50.0);
            map.insert(TraitKey::Caution, 85.0);
            map.insert(TraitKey::Curiosity, 50.0);
        }
        "feral" => {
            map.insert(TraitKey::Vitality, 80.0);
            map.insert(TraitKey::Sociality, 25.0);
            map.insert(TraitKey::Order, 15.0);
            map.insert(TraitKey::Appetite, 65.0);
            map.insert(TraitKey::Caution, 30.0);
            map.insert(TraitKey::Curiosity, 70.0);
        }
        "sage" => {
            map.insert(TraitKey::Vitality, 50.0);
            map.insert(TraitKey::Sociality, 60.0);
            map.insert(TraitKey::Order, 70.0);
            map.insert(TraitKey::Appetite, 45.0);
            map.insert(TraitKey::Caution, 65.0);
            map.insert(TraitKey::Curiosity, 80.0);
        }
        "pristine" => {
            map.insert(TraitKey::Vitality, 50.0);
            map.insert(TraitKey::Sociality, 45.0);
            map.insert(TraitKey::Order, 90.0);
            map.insert(TraitKey::Appetite, 40.0);
            map.insert(TraitKey::Caution, 60.0);
            map.insert(TraitKey::Curiosity, 45.0);
        }
        "empath" => {
            map.insert(TraitKey::Vitality, 50.0);
            map.insert(TraitKey::Sociality, 90.0);
            map.insert(TraitKey::Order, 50.0);
            map.insert(TraitKey::Appetite, 45.0);
            map.insert(TraitKey::Caution, 40.0);
            map.insert(TraitKey::Curiosity, 55.0);
        }
        "greedy" => {
            map.insert(TraitKey::Vitality, 60.0);
            map.insert(TraitKey::Sociality, 35.0);
            map.insert(TraitKey::Order, 55.0);
            map.insert(TraitKey::Appetite, 70.0);
            map.insert(TraitKey::Caution, 50.0);
            map.insert(TraitKey::Curiosity, 65.0);
        }
        "melancholic" => {
            map.insert(TraitKey::Vitality, 35.0);
            map.insert(TraitKey::Sociality, 55.0);
            map.insert(TraitKey::Order, 45.0);
            map.insert(TraitKey::Appetite, 40.0);
            map.insert(TraitKey::Caution, 60.0);
            map.insert(TraitKey::Curiosity, 60.0);
        }
        "chaotic" => {
            map.insert(TraitKey::Vitality, 60.0);
            map.insert(TraitKey::Sociality, 50.0);
            map.insert(TraitKey::Order, 10.0);
            map.insert(TraitKey::Appetite, 55.0);
            map.insert(TraitKey::Caution, 20.0);
            map.insert(TraitKey::Curiosity, 85.0);
        }
        "stoic" => {
            map.insert(TraitKey::Vitality, 55.0);
            map.insert(TraitKey::Sociality, 30.0);
            map.insert(TraitKey::Order, 80.0);
            map.insert(TraitKey::Appetite, 40.0);
            map.insert(TraitKey::Caution, 75.0);
            map.insert(TraitKey::Curiosity, 40.0);
        }
        "adventurer" => {
            map.insert(TraitKey::Vitality, 75.0);
            map.insert(TraitKey::Sociality, 50.0);
            map.insert(TraitKey::Order, 20.0);
            map.insert(TraitKey::Appetite, 55.0);
            map.insert(TraitKey::Caution, 15.0);
            map.insert(TraitKey::Curiosity, 90.0);
        }
        "paranoid" => {
            map.insert(TraitKey::Vitality, 45.0);
            map.insert(TraitKey::Sociality, 20.0);
            map.insert(TraitKey::Order, 60.0);
            map.insert(TraitKey::Appetite, 45.0);
            map.insert(TraitKey::Caution, 90.0);
            map.insert(TraitKey::Curiosity, 50.0);
        }
        _ => {
            for &key in TraitKey::all() {
                map.insert(key, 50.0);
            }
        }
    }
    map
}

fn personality_radius_base(id: &str) -> f64 {
    match id {
        "playful" | "bold" | "feral" | "adventurer" => 20.0,
        "drowsy" | "stoic" | "zen" => 18.0,
        "chaotic" | "paranoid" => 22.0,
        _ => 18.0,
    }
}

pub fn dynamic_radius(id: &str, age_hours: f64) -> f64 {
    let base = personality_radius_base(id);
    let age_days = age_hours / 24.0;
    if age_days < 7.0 {
        base - 3.0
    } else if age_days < 30.0 {
        base
    } else if age_days < 90.0 {
        base + 4.0
    } else {
        base + 8.0
    }
}

pub fn euclidean_distance(a: &TraitVector, b: &TraitVector) -> f64 {
    let sum: f64 = TraitKey::all()
        .iter()
        .map(|k| {
            let av = a.get(k).copied().unwrap_or(50.0);
            let bv = b.get(k).copied().unwrap_or(50.0);
            (av - bv).powi(2)
        })
        .sum();
    sum.sqrt()
}

pub fn depth_of_immersion(vector: &TraitVector, personality_id: &str, age_hours: f64) -> f64 {
    let home = personality_position(personality_id);
    let radius = dynamic_radius(personality_id, age_hours);
    let distance = euclidean_distance(vector, &home);
    (radius - distance) / radius
}

pub fn create_initial_trait_vector() -> TraitVector {
    let mut m = HashMap::new();
    for &key in TraitKey::all() {
        m.insert(key, 50.0);
    }
    m
}

// ── Shadow form ───────────────────────────────────────────────────────────────

pub fn check_shadow_form(state: &mut EngineState, now: DateTime<Utc>) -> bool {
    if state.emergent_state == Some(EmergentStateType::ShadowForm) {
        return true;
    }

    // Check cooldown
    if let Some(ref cooldown_str) = state.trauma_cooldown_until {
        if let Ok(cooldown) = cooldown_str.parse::<DateTime<Utc>>() {
            if now < cooldown {
                return false;
            }
        }
    }

    if state.trauma_level < SHADOW_FORM_TRAUMA_THRESHOLD {
        return false;
    }

    // Enter shadow form
    state.emergent_state = Some(EmergentStateType::ShadowForm);
    let layer = crate::engine::types::ActiveEmergentState {
        state_type: EmergentStateType::ShadowForm,
        layer: "evolution".to_string(),
        entered_at: now.to_rfc3339(),
    };
    if let Some(ref mut evo) = state.state_layers.evolution {
        evo.push(layer);
    } else {
        state.state_layers.evolution = Some(vec![layer]);
    }
    state.evolution_proposal = None;
    state.current_target_zone = None;
    state.ticks_in_target_zone = 0;
    true
}

// ── Catharsis ─────────────────────────────────────────────────────────────────

pub fn add_catharsis_progress(state: &mut EngineState, amount: f64, now: DateTime<Utc>) -> bool {
    if state.emergent_state != Some(EmergentStateType::ShadowForm) {
        return false;
    }
    state.catharsis_progress = clamp(state.catharsis_progress + amount, 0.0, CATHARSIS_THRESHOLD);
    if state.catharsis_progress < CATHARSIS_THRESHOLD {
        return false;
    }
    trigger_catharsis(state, now);
    true
}

pub fn trigger_catharsis(state: &mut EngineState, now: DateTime<Utc>) {
    let first_catharsis = !state.catharsis_achieved;

    // Exit shadow form
    state.emergent_state = None;
    if let Some(ref mut layers) = state.state_layers.evolution {
        layers.retain(|s| s.state_type != EmergentStateType::ShadowForm);
    }
    state.trauma_level = 0.0;
    state.catharsis_progress = 0.0;

    let cooldown = now + chrono::Duration::days(SHADOW_FORM_COOLDOWN_DAYS);
    state.trauma_cooldown_until = Some(cooldown.to_rfc3339());

    if first_catharsis {
        let burst_end = now + chrono::Duration::hours(2);
        state.catharsis_xp_burst_expires_at = Some(burst_end.to_rfc3339());
    }
    state.catharsis_achieved = true;

    // Add core memory
    let memory_text = if first_catharsis {
        "Прошли через тьму вместе"
    } else {
        "Снова нашли путь из тени"
    };
    add_core_memory(
        state,
        "rare",
        "🌅",
        memory_text,
        "system",
        "sociality",
        "up",
        None,
        now,
    );
}

// ── Evolution ─────────────────────────────────────────────────────────────────

pub fn check_evolution(state: &mut EngineState) {
    // Skip if in shadow form or singularity
    if state.emergent_state == Some(EmergentStateType::ShadowForm)
        || state.emergent_state == Some(EmergentStateType::Singularity)
    {
        return;
    }

    let current_id = state.personality.clone();
    let age_hours = state.age_hours;

    let current_depth = depth_of_immersion(&state.trait_vector, &current_id, age_hours);

    if current_depth > 0.0 {
        state.current_target_zone = None;
        state.ticks_in_target_zone = 0;
        state.evolution_proposal = None;
        state.void_syncs = 0;
        return;
    }

    // Find best candidate
    let personalities = crate::engine::personalities::get_personalities();
    let best = personalities
        .iter()
        .filter(|p| p.id != current_id)
        .map(|p| {
            let depth = depth_of_immersion(&state.trait_vector, &p.id, age_hours);
            (p.id.clone(), p.emoji.clone(), p.name.clone(), depth)
        })
        .max_by(|a, b| a.3.partial_cmp(&b.3).unwrap_or(std::cmp::Ordering::Equal));

    let (best_id, _best_emoji, best_name, best_depth) = match best {
        Some(b) if b.3 > 0.0 => b,
        _ => {
            // Void state
            state.current_target_zone = None;
            state.ticks_in_target_zone = 0;
            state.evolution_proposal = None;
            state.void_syncs += 1;
            if state.void_syncs >= VOID_THRESHOLD_SYNCS {
                state.emergent_state = Some(EmergentStateType::IdentityCrisis);
            }
            return;
        }
    };

    state.void_syncs = 0;

    if state.current_target_zone.as_deref() != Some(&best_id) {
        state.current_target_zone = Some(best_id.clone());
        state.ticks_in_target_zone = 0;
    }
    state.ticks_in_target_zone += 1;

    let current_depth_abs = current_depth.abs() * dynamic_radius(&current_id, age_hours);
    if current_depth_abs < HYSTERESIS {
        return;
    }
    if state.ticks_in_target_zone < STABILITY_SYNCS {
        return;
    }

    let readiness = ((state.ticks_in_target_zone as f64 / STABILITY_SYNCS as f64) * 100.0)
        .min(100.0)
        .round();
    let relevant_memories: Vec<String> = state
        .core_memories
        .iter()
        .filter(|m| m.tier == "rare" || m.personality_hint.as_deref() == Some(&best_id))
        .take(3)
        .map(|m| m.id.clone())
        .collect();

    let narrative = format!("Путь ведёт к: {}.", best_name);
    state.evolution_proposal = Some(crate::engine::types::EvolutionProposal {
        target_personality_id: best_id,
        readiness,
        depth: best_depth,
        proposed_at: chrono::Utc::now().to_rfc3339(),
        core_memory_ids: relevant_memories,
        narrative_text: Some(narrative),
    });
}

pub fn accept_evolution(state: &mut EngineState) -> bool {
    let proposal = match state.evolution_proposal.clone() {
        Some(p) => p,
        None => return false,
    };

    let from = state.personality.clone();
    let to = proposal.target_personality_id.clone();
    let now = chrono::Utc::now().to_rfc3339();

    state.evolution_history.push(EvolutionRecord {
        from_personality_id: from,
        to_personality_id: to.clone(),
        evolved_at: now.clone(),
        trigger: "stability".to_string(),
        core_memory_ids: Some(proposal.core_memory_ids),
    });

    state.personality = to.clone();
    state.current_target_zone = None;
    state.ticks_in_target_zone = 0;
    state.evolution_proposal = None;
    state.void_syncs = 0;

    // Clear identity_crisis and confused from layers
    if let Some(ref mut layers) = state.state_layers.cognitive {
        layers.retain(|s| {
            s.state_type != EmergentStateType::IdentityCrisis
                && s.state_type != EmergentStateType::Confused
        });
    }
    if state.emergent_state == Some(EmergentStateType::IdentityCrisis)
        || state.emergent_state == Some(EmergentStateType::Confused)
    {
        state.emergent_state = None;
    }

    let to_emoji = crate::engine::personalities::get_personality(&to)
        .map(|p| p.emoji.as_str())
        .unwrap_or("🌟");
    let to_name = crate::engine::personalities::get_personality(&to)
        .map(|p| p.name.as_str())
        .unwrap_or(&to);
    let text = format!("Выбран новый путь: {}", to_name);
    add_core_memory(
        state,
        "rare",
        to_emoji,
        &text,
        "system",
        "vitality",
        "origin",
        Some(&to.clone()),
        chrono::Utc::now(),
    );

    true
}

pub fn reject_evolution(state: &mut EngineState) -> bool {
    if state.evolution_proposal.is_none() {
        return false;
    }
    state.evolution_proposal = None;
    state.current_target_zone = None;
    state.ticks_in_target_zone = 0;
    true
}

pub fn detect_singularity(state: &EngineState) -> Option<Vec<String>> {
    let age_hours = 0.0;
    let personalities = crate::engine::personalities::get_personalities();
    let mut inside: Vec<(String, f64)> = personalities
        .iter()
        .map(|p| {
            let depth = depth_of_immersion(&state.trait_vector, &p.id, age_hours);
            (p.id.clone(), depth)
        })
        .filter(|(_, d)| *d > 0.0)
        .collect();
    inside.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    if inside.len() < 3 {
        return None;
    }
    if inside[0].1 - inside[2].1 >= SINGULARITY_EPSILON {
        return None;
    }
    Some(inside.into_iter().take(3).map(|(id, _)| id).collect())
}

// ── Core memory helper ────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
pub fn add_core_memory(
    state: &mut EngineState,
    tier: &str,
    emoji: &str,
    text: &str,
    category: &str,
    trait_key: &str,
    direction: &str,
    personality_hint: Option<&str>,
    now: DateTime<Utc>,
) {
    let id = format!("mem-{}-{}", now.to_rfc3339(), state.core_memories.len() + 1);
    let memory = CoreMemory {
        id,
        timestamp: now.to_rfc3339(),
        tier: tier.to_string(),
        emoji: emoji.to_string(),
        text: text.to_string(),
        category: category.to_string(),
        trait_key: trait_key.to_string(),
        direction: direction.to_string(),
        personality_hint: personality_hint.map(|s| s.to_string()),
    };
    state.core_memories.push(memory);

    // Cap at limits (rare: 50, common: 20)
    let rare_cap = 50usize;
    let common_cap = 20usize;
    let rare: Vec<_> = state
        .core_memories
        .drain(..)
        .filter(|m| m.tier == "rare")
        .collect();
    let common: Vec<_> = state
        .core_memories
        .drain(..)
        .filter(|m| m.tier == "common")
        .collect();
    // After drain all items are in rare/common
    // Actually we need to re-separate since drain clears the vec
    // Fix: save all first
    state.core_memories = {
        let all = [rare.as_slice(), common.as_slice()].concat();
        all
    };
    let mut rare2: Vec<_> = state
        .core_memories
        .iter()
        .filter(|m| m.tier == "rare")
        .cloned()
        .collect();
    let mut common2: Vec<_> = state
        .core_memories
        .iter()
        .filter(|m| m.tier == "common")
        .cloned()
        .collect();
    rare2.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    common2.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    rare2.truncate(rare_cap);
    common2.truncate(common_cap);
    state.core_memories = rare2;
    state.core_memories.extend(common2);
    state
        .core_memories
        .sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    let _ = (rare, common); // silence unused warnings
}
