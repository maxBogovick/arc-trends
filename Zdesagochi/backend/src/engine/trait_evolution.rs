// ════════════════════════════════════════════════════════════════════════════
//  TRAIT EVOLUTION ENGINE — Rust port of personality-core/src/TraitEvolutionEngine.ts
// ════════════════════════════════════════════════════════════════════════════

use chrono::{DateTime, Utc};
use std::collections::HashMap;

use crate::engine::command_handlers::EngineState;
use crate::engine::types::{
    clamp, ActiveEmergentState, BehaviorAxis, CoreMemory, EmergentStateType, EvolutionRecord,
    InfluenceCondition, RegisteredInfluence, StatKey, TraitKey, TraitVector,
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
pub const PRE_FORMATION_SENSITIVITY_MULTIPLIER: f64 = 5.0;
pub const POST_FORMATION_ADAPTATION_MULTIPLIER: f64 = 4.0;
pub const BEHAVIOR_PROFILE_DECAY_PER_DAY: f64 = 0.96;
pub const BEHAVIOR_PROFILE_EVOLUTION_MIN_SAMPLES: u32 = 24;
pub const BEHAVIOR_PROFILE_EVOLUTION_THRESHOLD: f64 = 28.0;
pub const EVOLUTION_READINESS_THRESHOLD: f64 = 100.0;
pub const EVOLUTION_READINESS_GAIN_PER_CONFIRMED_SYNC: f64 = 35.0;
pub const EVOLUTION_READINESS_DECAY_PER_SYNC: f64 = 2.0;
pub const NEAR_TARGET_READINESS_MARGIN: f64 = 0.25;
pub const NEAR_TARGET_READINESS_GAIN_MULTIPLIER: f64 = 0.60;
pub const BEHAVIOR_TARGET_DEPTH_BONUS: f64 = 0.45;

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
        let context_multiplier = context_sensitivity_multiplier(state, &influence.id, trait_key);
        let applied = clamp(*raw_delta * context_multiplier, -remaining, remaining);
        if applied == 0.0 {
            continue;
        }

        budgeted_delta.insert(trait_key, applied);
        state
            .daily_trait_budget
            .insert(trait_key, spent + applied.abs());

        let current = state.trait_vector.get(&trait_key).copied().unwrap_or(50.0);
        let sensitivity_multiplier = if state.formation_complete {
            POST_FORMATION_ADAPTATION_MULTIPLIER
        } else {
            PRE_FORMATION_SENSITIVITY_MULTIPLIER
        };
        state.trait_vector.insert(
            trait_key,
            clamp(
                current + applied * SMOOTHING_ALPHA * sensitivity_multiplier,
                0.0,
                100.0,
            ),
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
    update_behavior_profile(state, &influence.id, now);
    true
}

pub fn apply_item_behavior_style(
    state: &mut EngineState,
    command_type: &str,
    item_id: &str,
    now: DateTime<Utc>,
) -> bool {
    if command_type != "add_item" && command_type != "use_item" {
        return false;
    }

    let item_counts = crate::engine::personality_engine::rolling_item_counts(
        &state.behavioral_counters,
        "both",
        7,
        now,
    );
    let total_7d: u32 = item_counts.values().sum();
    let unique_7d = item_counts.len() as u32;
    let max_repeat_7d = item_counts.values().copied().max().unwrap_or(0);
    let repeat_ratio = if total_7d > 0 {
        max_repeat_7d as f64 / total_7d as f64
    } else {
        0.0
    };

    let mut trait_deltas: HashMap<TraitKey, f64> = HashMap::new();
    let mut behavior_signal: HashMap<BehaviorAxis, f64> = HashMap::new();

    if command_type == "add_item" {
        add_trait_delta(&mut trait_deltas, TraitKey::Curiosity, 0.45);
        add_trait_delta(&mut trait_deltas, TraitKey::Order, 0.35);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Exploration, 0.45);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Order, 0.35);
    } else {
        add_trait_delta(&mut trait_deltas, TraitKey::Curiosity, 0.35);
        add_trait_delta(&mut trait_deltas, TraitKey::Vitality, 0.2);
        add_trait_delta(&mut trait_deltas, TraitKey::Caution, -0.25);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Exploration, 0.35);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Play, 0.2);
    }

    if total_7d >= 4 && unique_7d >= 3 {
        let mult = personality_item_style_multiplier(state, "diverse");
        add_trait_delta(&mut trait_deltas, TraitKey::Curiosity, 1.15 * mult);
        add_trait_delta(&mut trait_deltas, TraitKey::Sociality, 0.35 * mult);
        add_trait_delta(&mut trait_deltas, TraitKey::Caution, -0.25 * mult);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Exploration, 1.25 * mult);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Play, 0.35 * mult);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Social, 0.25 * mult);
    }

    if total_7d >= 4 && repeat_ratio >= 0.65 {
        let mult = personality_item_style_multiplier(state, "repetitive");
        add_trait_delta(&mut trait_deltas, TraitKey::Caution, 0.9 * mult);
        add_trait_delta(&mut trait_deltas, TraitKey::Order, 0.5 * mult);
        add_trait_delta(&mut trait_deltas, TraitKey::Curiosity, -0.35 * mult);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Order, 0.65 * mult);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Recovery, 0.25 * mult);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Disruption, 0.35 * mult);
    }

    if total_7d >= 6 {
        let mult = personality_item_style_multiplier(state, "frequent");
        add_trait_delta(&mut trait_deltas, TraitKey::Curiosity, 0.45 * mult);
        add_trait_delta(&mut trait_deltas, TraitKey::Vitality, 0.35 * mult);
        add_trait_delta(&mut trait_deltas, TraitKey::Order, -0.2 * mult);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Exploration, 0.45 * mult);
        add_behavior_delta(&mut behavior_signal, BehaviorAxis::Play, 0.35 * mult);
    }

    let applied_traits = apply_direct_trait_deltas(state, &trait_deltas, now);
    let applied_behavior = apply_behavior_signal(state, &behavior_signal, now);

    if applied_traits && !state.formation_complete {
        let influence = RegisteredInfluence {
            id: format!("item_style:{command_type}:{item_id}"),
            category: "item".to_string(),
            label: "Item behavior style".to_string(),
            trait_deltas: trait_deltas
                .iter()
                .map(|(key, value)| (key.as_str().to_string(), *value))
                .collect(),
            trauma_delta: None,
            cooldown_syncs: None,
            conditions: None,
            on_apply: None,
        };
        update_formation_progress(state, &influence, &trait_deltas, now);
    }

    applied_traits || applied_behavior
}

fn apply_direct_trait_deltas(
    state: &mut EngineState,
    trait_deltas: &HashMap<TraitKey, f64>,
    now: DateTime<Utc>,
) -> bool {
    let mut applied_any = false;
    for (trait_key, delta) in trait_deltas {
        if *delta == 0.0 {
            continue;
        }
        let spent = state
            .daily_trait_budget
            .get(trait_key)
            .copied()
            .unwrap_or(0.0);
        let remaining = (daily_budget(*trait_key) - spent).max(0.0);
        let applied = clamp(*delta, -remaining, remaining);
        if applied == 0.0 {
            continue;
        }
        state
            .daily_trait_budget
            .insert(*trait_key, spent + applied.abs());
        let current = state.trait_vector.get(trait_key).copied().unwrap_or(50.0);
        let sensitivity_multiplier = if state.formation_complete {
            POST_FORMATION_ADAPTATION_MULTIPLIER
        } else {
            PRE_FORMATION_SENSITIVITY_MULTIPLIER
        };
        state.trait_vector.insert(
            *trait_key,
            clamp(
                current + applied * SMOOTHING_ALPHA * sensitivity_multiplier,
                0.0,
                100.0,
            ),
        );
        state.daily_vector_variance += applied.abs();
        applied_any = true;
    }
    if applied_any {
        update_confused_state(state, now);
    }
    applied_any
}

fn apply_behavior_signal(
    state: &mut EngineState,
    signal: &HashMap<BehaviorAxis, f64>,
    now: DateTime<Utc>,
) -> bool {
    if signal.values().all(|v| *v == 0.0) {
        return false;
    }

    let elapsed_days = state
        .behavior_profile
        .last_updated_at
        .as_ref()
        .and_then(|value| value.parse::<DateTime<Utc>>().ok())
        .map(|last| (now - last).num_seconds().max(0) as f64 / 86_400.0)
        .unwrap_or(0.0);
    let decay = if elapsed_days > 0.0 {
        BEHAVIOR_PROFILE_DECAY_PER_DAY.powf(elapsed_days)
    } else {
        1.0
    };

    for axis in BehaviorAxis::all() {
        let current = state
            .behavior_profile
            .axes
            .get(axis)
            .copied()
            .unwrap_or(0.0)
            * decay;
        let added = signal.get(axis).copied().unwrap_or(0.0);
        state
            .behavior_profile
            .axes
            .insert(*axis, clamp(current + added, 0.0, 100.0));
    }
    state.behavior_profile.sample_count = state
        .behavior_profile
        .sample_count
        .saturating_add(1)
        .min(10_000);
    state.behavior_profile.last_updated_at = Some(now.to_rfc3339());
    true
}

fn add_trait_delta(target: &mut HashMap<TraitKey, f64>, key: TraitKey, value: f64) {
    *target.entry(key).or_insert(0.0) += value;
}

fn add_behavior_delta(target: &mut HashMap<BehaviorAxis, f64>, key: BehaviorAxis, value: f64) {
    *target.entry(key).or_insert(0.0) += value;
}

fn personality_item_style_multiplier(state: &EngineState, style: &str) -> f64 {
    if !state.formation_complete {
        return 1.0;
    }
    let personality_id = state.personality.as_str();
    match (style, personality_id) {
        ("diverse", "curious" | "adventurer" | "playful" | "chaotic") => 1.25,
        ("diverse", "stoic" | "pristine") => 0.9,
        ("repetitive", "paranoid" | "anxious" | "stoic") => 1.35,
        ("repetitive", "adventurer" | "chaotic" | "playful") => 0.75,
        ("frequent", "playful" | "bold" | "chaotic") => 1.2,
        ("frequent", "melancholic" | "drowsy") => 0.8,
        _ => 1.0,
    }
}

fn context_sensitivity_multiplier(
    state: &EngineState,
    influence_id: &str,
    trait_key: TraitKey,
) -> f64 {
    match influence_id {
        "action:feed" => {
            let hunger = state.stats.get(&StatKey::Hunger).copied().unwrap_or(50.0);
            if hunger <= 30.0 {
                if trait_key == TraitKey::Appetite {
                    0.5
                } else {
                    1.4
                }
            } else if hunger >= 90.0 {
                if trait_key == TraitKey::Appetite {
                    1.2
                } else {
                    0.65
                }
            } else {
                1.0
            }
        }
        "action:play" => {
            let happiness = state
                .stats
                .get(&StatKey::Happiness)
                .copied()
                .unwrap_or(50.0);
            let energy = state.stats.get(&StatKey::Energy).copied().unwrap_or(50.0);
            if energy <= 25.0 {
                0.65
            } else if happiness <= 45.0 && energy >= 35.0 {
                1.35
            } else {
                1.0
            }
        }
        "action:sleep_natural" => {
            let energy = state.stats.get(&StatKey::Energy).copied().unwrap_or(50.0);
            if energy <= 30.0 {
                1.5
            } else {
                1.0
            }
        }
        "action:sleep_forced" => {
            let energy = state.stats.get(&StatKey::Energy).copied().unwrap_or(50.0);
            if energy >= 80.0 {
                1.35
            } else {
                1.0
            }
        }
        "action:bathe" => {
            let cleanliness = state
                .stats
                .get(&StatKey::Cleanliness)
                .copied()
                .unwrap_or(50.0);
            if cleanliness <= 35.0 {
                1.4
            } else if cleanliness >= 90.0 {
                0.7
            } else {
                1.0
            }
        }
        "action:heal" => {
            let health = state.stats.get(&StatKey::Health).copied().unwrap_or(50.0);
            if health <= 45.0 {
                1.4
            } else if health >= 90.0 {
                0.75
            } else {
                1.0
            }
        }
        "action:bond" => {
            let bond = state.stats.get(&StatKey::Bond).copied().unwrap_or(50.0);
            if bond <= 45.0 {
                1.35
            } else {
                1.0
            }
        }
        _ => 1.0,
    }
}

fn update_behavior_profile(state: &mut EngineState, influence_id: &str, now: DateTime<Utc>) {
    let signal = behavior_signal_for_influence(influence_id);
    if signal.is_empty() {
        return;
    }

    let elapsed_days = state
        .behavior_profile
        .last_updated_at
        .as_ref()
        .and_then(|value| value.parse::<DateTime<Utc>>().ok())
        .map(|last| (now - last).num_seconds().max(0) as f64 / 86_400.0)
        .unwrap_or(0.0);
    let decay = if elapsed_days > 0.0 {
        BEHAVIOR_PROFILE_DECAY_PER_DAY.powf(elapsed_days)
    } else {
        1.0
    };

    for axis in BehaviorAxis::all() {
        let current = state
            .behavior_profile
            .axes
            .get(axis)
            .copied()
            .unwrap_or(0.0)
            * decay;
        let added = signal.get(axis).copied().unwrap_or(0.0);
        state
            .behavior_profile
            .axes
            .insert(*axis, clamp(current + added, 0.0, 100.0));
    }

    state.behavior_profile.sample_count = state
        .behavior_profile
        .sample_count
        .saturating_add(1)
        .min(10_000);
    state.behavior_profile.last_updated_at = Some(now.to_rfc3339());
}

fn behavior_signal_for_influence(influence_id: &str) -> HashMap<BehaviorAxis, f64> {
    use BehaviorAxis::*;
    let pairs: &[(BehaviorAxis, f64)] = match influence_id {
        "action:feed" => &[(Care, 2.0), (Social, 0.5)],
        "action:play" => &[(Play, 2.0), (Exploration, 1.0)],
        "action:bond" => &[(Social, 2.0), (Care, 0.5)],
        "action:bathe" => &[(Order, 2.0), (Care, 0.5)],
        "action:heal" => &[(Recovery, 2.0), (Care, 1.0)],
        "action:sleep_natural" => &[(Order, 1.2), (Care, 0.6)],
        "action:sleep_forced" => &[(Disruption, 2.0), (Order, -0.5)],
        "action:wake_early" => &[(Disruption, 2.0), (Order, -1.0)],
        "item:puzzle" => &[(Exploration, 2.0), (Order, 1.0)],
        "item:magic_potion" => &[(Exploration, 1.5), (Recovery, 0.8)],
        "item:music_box" => &[(Social, 2.5), (Recovery, 0.5)],
        "item:magic_wand" => &[(Exploration, 2.5), (Play, 1.5)],
        "item:crystal_ball" => &[(Exploration, 2.0), (Social, 1.0)],
        "env:new_room" => &[(Exploration, 2.0), (Play, 0.5)],
        _ if influence_id.starts_with("social:") => &[(Social, 1.5), (Exploration, 0.5)],
        _ => &[],
    };

    pairs.iter().copied().collect()
}

fn behavior_evidence_for_personality(state: &EngineState, personality_id: &str) -> f64 {
    if state.behavior_profile.sample_count < BEHAVIOR_PROFILE_EVOLUTION_MIN_SAMPLES {
        return f64::INFINITY;
    }

    crate::engine::personality_catalog::behavior_evidence_for_personality(
        &state.behavior_profile.axes,
        personality_id,
    )
}

fn decay_evolution_readiness(state: &mut EngineState, target: Option<&str>) {
    if let Some(target) = target {
        if state.evolution_readiness_target.as_deref() != Some(target) {
            state.evolution_readiness_target = Some(target.to_string());
            state.evolution_readiness = 0.0;
            return;
        }
    }

    state.evolution_readiness =
        (state.evolution_readiness - EVOLUTION_READINESS_DECAY_PER_SYNC).max(0.0);
    if state.evolution_readiness == 0.0 && target.is_none() {
        state.evolution_readiness_target = None;
    }
}

fn near_target_readiness_ratio(depth: f64) -> f64 {
    if depth > 0.0 {
        1.0
    } else {
        clamp(
            (depth + NEAR_TARGET_READINESS_MARGIN) / NEAR_TARGET_READINESS_MARGIN,
            0.0,
            1.0,
        )
    }
}

fn behavior_target_depth_bonus(evidence: f64) -> f64 {
    if !evidence.is_finite() {
        return BEHAVIOR_TARGET_DEPTH_BONUS;
    }
    clamp(
        evidence / BEHAVIOR_PROFILE_EVOLUTION_THRESHOLD.max(1.0),
        0.0,
        1.0,
    ) * BEHAVIOR_TARGET_DEPTH_BONUS
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
                depth_of_immersion(&state.trait_vector, &p.id, state.age_hours),
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

fn personality_position(id: &str) -> TraitVector {
    crate::engine::personality_catalog::personality_position(id)
}

fn personality_radius_base(id: &str) -> f64 {
    crate::engine::personality_catalog::personality_radius_base(id)
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
        decay_evolution_readiness(state, None);
        return;
    }

    // Find best candidate
    let personalities = crate::engine::personalities::get_personalities();
    let mut candidates: Vec<_> = personalities
        .iter()
        .filter(|p| p.id != current_id)
        .map(|p| {
            let depth = depth_of_immersion(&state.trait_vector, &p.id, age_hours);
            let evidence = behavior_evidence_for_personality(state, &p.id);
            let adjusted_depth = depth + behavior_target_depth_bonus(evidence);
            (
                p.id.clone(),
                p.emoji.clone(),
                p.name.clone(),
                depth,
                adjusted_depth,
            )
        })
        .collect();
    candidates.sort_by(|a, b| b.4.partial_cmp(&a.4).unwrap_or(std::cmp::Ordering::Equal));

    let best = candidates
        .iter()
        .find(|candidate| {
            near_target_readiness_ratio(candidate.4) > 0.0
                && behavior_evidence_for_personality(state, &candidate.0)
                    >= BEHAVIOR_PROFILE_EVOLUTION_THRESHOLD
        })
        .or_else(|| candidates.first())
        .cloned();

    let (best_id, _best_emoji, best_name, best_depth, best_adjusted_depth) = match best {
        Some(b) => b,
        _ => {
            decay_evolution_readiness(state, None);
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

    let readiness_ratio = near_target_readiness_ratio(best_adjusted_depth);
    if readiness_ratio <= 0.0 {
        // Void state
        decay_evolution_readiness(state, None);
        state.current_target_zone = None;
        state.ticks_in_target_zone = 0;
        state.evolution_proposal = None;
        state.void_syncs += 1;
        if state.void_syncs >= VOID_THRESHOLD_SYNCS {
            state.emergent_state = Some(EmergentStateType::IdentityCrisis);
        }
        return;
    }

    state.void_syncs = 0;

    if behavior_evidence_for_personality(state, &best_id) < BEHAVIOR_PROFILE_EVOLUTION_THRESHOLD {
        decay_evolution_readiness(state, Some(&best_id));
        state.current_target_zone = Some(best_id);
        state.ticks_in_target_zone = 0;
        state.evolution_proposal = None;
        return;
    }

    if state.current_target_zone.as_deref() != Some(&best_id) {
        state.current_target_zone = Some(best_id.clone());
        state.ticks_in_target_zone = 0;
        state.evolution_readiness = if state.evolution_readiness_target.as_deref() == Some(&best_id)
        {
            state.evolution_readiness
        } else {
            0.0
        };
        state.evolution_readiness_target = Some(best_id.clone());
    }
    if best_depth > 0.0 {
        state.ticks_in_target_zone += 1;
    } else {
        state.ticks_in_target_zone = 0;
    }

    let current_depth_abs = current_depth.abs() * dynamic_radius(&current_id, age_hours);
    if current_depth_abs < HYSTERESIS {
        return;
    }
    state.evolution_readiness_target = Some(best_id.clone());
    let readiness_gain = EVOLUTION_READINESS_GAIN_PER_CONFIRMED_SYNC
        * if best_depth > 0.0 {
            1.0
        } else {
            readiness_ratio * NEAR_TARGET_READINESS_GAIN_MULTIPLIER
        };
    state.evolution_readiness = clamp(
        state.evolution_readiness + readiness_gain,
        0.0,
        EVOLUTION_READINESS_THRESHOLD,
    );

    let strict_readiness = ((state.ticks_in_target_zone as f64 / STABILITY_SYNCS as f64) * 100.0)
        .min(100.0)
        .round();
    let accumulated_readiness = state.evolution_readiness.round();
    if state.ticks_in_target_zone < STABILITY_SYNCS
        && state.evolution_readiness < EVOLUTION_READINESS_THRESHOLD
    {
        return;
    }

    let readiness = strict_readiness.max(accumulated_readiness);
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
    state.evolution_readiness = 0.0;
    state.evolution_readiness_target = None;
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
    state.evolution_readiness = 0.0;
    state.evolution_readiness_target = None;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_close(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < 1e-9,
            "actual {actual} expected {expected}"
        );
    }

    fn best_personality(vector: &TraitVector, age_hours: f64) -> String {
        crate::engine::personalities::get_personalities()
            .iter()
            .map(|p| (p.id.clone(), depth_of_immersion(vector, &p.id, age_hours)))
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(id, _)| id)
            .expect("personalities must not be empty")
    }

    #[test]
    fn personality_positions_match_typescript_trait_map() {
        let cases = [
            ("playful", [90.0, 60.0, 20.0, 40.0, 20.0, 60.0], 25.0),
            ("drowsy", [10.0, 40.0, 55.0, 35.0, 40.0, 15.0], 25.0),
            ("foodie", [55.0, 50.0, 50.0, 95.0, 30.0, 45.0], 25.0),
            ("bold", [80.0, 40.0, 35.0, 45.0, 5.0, 55.0], 22.0),
            ("zen", [30.0, 75.0, 85.0, 30.0, 25.0, 45.0], 22.0),
            ("anxious", [60.0, 50.0, 40.0, 55.0, 90.0, 50.0], 22.0),
            ("feral", [75.0, 10.0, 15.0, 60.0, 15.0, 55.0], 20.0),
            ("sage", [35.0, 65.0, 70.0, 40.0, 45.0, 90.0], 22.0),
            ("pristine", [50.0, 55.0, 80.0, 40.0, 65.0, 40.0], 22.0),
            ("empath", [45.0, 95.0, 55.0, 40.0, 55.0, 50.0], 20.0),
            ("greedy", [70.0, 30.0, 55.0, 85.0, 35.0, 60.0], 20.0),
            ("melancholic", [20.0, 55.0, 60.0, 35.0, 60.0, 65.0], 22.0),
            ("chaotic", [70.0, 40.0, 5.0, 50.0, 20.0, 80.0], 20.0),
            ("stoic", [15.0, 35.0, 95.0, 20.0, 30.0, 20.0], 22.0),
            ("adventurer", [75.0, 55.0, 25.0, 45.0, 10.0, 95.0], 20.0),
            ("paranoid", [40.0, 20.0, 65.0, 35.0, 95.0, 55.0], 18.0),
            ("curious", [65.0, 45.0, 60.0, 30.0, 55.0, 95.0], 22.0),
        ];

        for (id, expected, radius) in cases {
            let position = personality_position(id);
            assert_close(position[&TraitKey::Vitality], expected[0]);
            assert_close(position[&TraitKey::Sociality], expected[1]);
            assert_close(position[&TraitKey::Order], expected[2]);
            assert_close(position[&TraitKey::Appetite], expected[3]);
            assert_close(position[&TraitKey::Caution], expected[4]);
            assert_close(position[&TraitKey::Curiosity], expected[5]);
            assert_close(personality_radius_base(id), radius);
        }
    }

    #[test]
    fn curious_personality_is_registered_in_backend_catalog() {
        let personality = crate::engine::personalities::get_personality("curious")
            .expect("curious personality must be registered");

        assert_eq!(personality.name, "Любознательный");
        assert_close(
            depth_of_immersion(&personality_position("curious"), "curious", 3.0),
            1.0,
        );
    }

    #[test]
    fn neutral_formation_vector_is_not_closest_to_drowsy_after_parity_fix() {
        let vector = create_initial_trait_vector();

        assert_eq!(best_personality(&vector, 3.0), "pristine");
        assert!(
            depth_of_immersion(&vector, "pristine", 3.0)
                > depth_of_immersion(&vector, "drowsy", 3.0)
        );
    }

    #[test]
    fn dynamic_radius_uses_typescript_radius_bases_and_age_bands() {
        assert_close(dynamic_radius("drowsy", 3.0 * 24.0), 22.0);
        assert_close(dynamic_radius("drowsy", 10.0 * 24.0), 25.0);
        assert_close(dynamic_radius("drowsy", 45.0 * 24.0), 29.0);
        assert_close(dynamic_radius("drowsy", 100.0 * 24.0), 33.0);
    }
}
