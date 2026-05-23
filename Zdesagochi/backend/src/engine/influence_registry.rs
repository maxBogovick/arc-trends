// ════════════════════════════════════════════════════════════════════════════
//  INFLUENCE REGISTRY — Rust port of personality-pet-preset/src/influenceRegistry.ts
// ════════════════════════════════════════════════════════════════════════════

use std::collections::HashMap;
use std::sync::OnceLock;

use crate::engine::types::{InfluenceCondition, RegisteredInfluence};

static INFLUENCE_REGISTRY: OnceLock<Vec<RegisteredInfluence>> = OnceLock::new();

pub fn get_influence_registry() -> &'static Vec<RegisteredInfluence> {
    INFLUENCE_REGISTRY.get_or_init(build_registry)
}

pub fn get_influence(id: &str) -> Option<&'static RegisteredInfluence> {
    get_influence_registry().iter().find(|inf| inf.id == id)
}

fn cond(condition_type: &str, params: &[(&str, serde_json::Value)]) -> InfluenceCondition {
    InfluenceCondition {
        condition_type: condition_type.to_string(),
        params: params
            .iter()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect(),
    }
}

fn td<const N: usize>(pairs: [(&str, f64); N]) -> HashMap<String, f64> {
    pairs.iter().map(|(k, v)| (k.to_string(), *v)).collect()
}

fn build_registry() -> Vec<RegisteredInfluence> {
    vec![
        RegisteredInfluence {
            id: "action:play".to_string(),
            category: "action".to_string(),
            label: "Игра".to_string(),
            trait_deltas: td([("vitality", 2.0), ("curiosity", 1.0), ("order", -1.0)]),
            trauma_delta: None,
            cooldown_syncs: Some(0),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "action:play:active".to_string(),
            category: "action".to_string(),
            label: "Активная игра".to_string(),
            trait_deltas: td([("vitality", 2.4), ("curiosity", 0.8), ("order", -1.1)]),
            trauma_delta: None,
            cooldown_syncs: Some(0),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "action:play:puzzle".to_string(),
            category: "action".to_string(),
            label: "Головоломка".to_string(),
            trait_deltas: td([("curiosity", 2.2), ("order", 1.3), ("vitality", -0.4)]),
            trauma_delta: None,
            cooldown_syncs: Some(0),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "action:play:social".to_string(),
            category: "action".to_string(),
            label: "Совместная игра".to_string(),
            trait_deltas: td([("sociality", 1.8), ("vitality", 1.2), ("curiosity", 0.5)]),
            trauma_delta: None,
            cooldown_syncs: Some(0),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "action:feed".to_string(),
            category: "action".to_string(),
            label: "Кормление".to_string(),
            trait_deltas: td([("appetite", 2.0), ("sociality", 0.5)]),
            trauma_delta: None,
            cooldown_syncs: Some(0),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "action:bond".to_string(),
            category: "action".to_string(),
            label: "Bond".to_string(),
            trait_deltas: td([("sociality", 2.0), ("caution", -1.0)]),
            trauma_delta: Some(-3.0),
            cooldown_syncs: Some(1),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "action:bond:listen".to_string(),
            category: "action".to_string(),
            label: "Выслушать".to_string(),
            trait_deltas: td([("sociality", 1.4), ("caution", -1.6)]),
            trauma_delta: Some(-4.0),
            cooldown_syncs: Some(1),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "action:bond:praise".to_string(),
            category: "action".to_string(),
            label: "Похвалить".to_string(),
            trait_deltas: td([("sociality", 1.6), ("vitality", 0.7), ("caution", -0.8)]),
            trauma_delta: Some(-2.0),
            cooldown_syncs: Some(1),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "action:sleep_natural".to_string(),
            category: "action".to_string(),
            label: "Естественный сон".to_string(),
            trait_deltas: td([("vitality", -1.0), ("order", 1.5)]),
            trauma_delta: None,
            cooldown_syncs: Some(12),
            conditions: None,
            on_apply: Some("sleep_start".to_string()),
        },
        RegisteredInfluence {
            id: "action:sleep:ritual".to_string(),
            category: "action".to_string(),
            label: "Ритуал перед сном".to_string(),
            trait_deltas: td([("order", 1.8), ("caution", -0.9), ("sociality", 0.4)]),
            trauma_delta: Some(-1.0),
            cooldown_syncs: Some(4),
            conditions: None,
            on_apply: Some("sleep_start".to_string()),
        },
        RegisteredInfluence {
            id: "action:sleep:nap".to_string(),
            category: "action".to_string(),
            label: "Короткий отдых".to_string(),
            trait_deltas: td([("vitality", 0.6), ("caution", -0.4), ("order", 0.5)]),
            trauma_delta: Some(-0.5),
            cooldown_syncs: Some(3),
            conditions: None,
            on_apply: Some("sleep_start".to_string()),
        },
        RegisteredInfluence {
            id: "action:wake_early".to_string(),
            category: "action".to_string(),
            label: "Разбудили в первый час сна".to_string(),
            trait_deltas: td([("order", -2.0), ("caution", 2.0), ("vitality", 1.0)]),
            trauma_delta: Some(2.0),
            cooldown_syncs: Some(2),
            conditions: None,
            on_apply: Some("sleep_wake_early".to_string()),
        },
        RegisteredInfluence {
            id: "action:wake_natural".to_string(),
            category: "action".to_string(),
            label: "Естественное пробуждение".to_string(),
            trait_deltas: HashMap::new(),
            trauma_delta: Some(-1.0),
            cooldown_syncs: Some(6),
            conditions: None,
            on_apply: Some("sleep_wake_natural".to_string()),
        },
        RegisteredInfluence {
            id: "action:wake:gentle".to_string(),
            category: "action".to_string(),
            label: "Мягко разбудить".to_string(),
            trait_deltas: td([("sociality", 0.7), ("caution", -0.8), ("order", 0.4)]),
            trauma_delta: Some(-1.0),
            cooldown_syncs: Some(2),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "action:sleep_forced".to_string(),
            category: "action".to_string(),
            label: "Принудительный сон".to_string(),
            trait_deltas: td([("vitality", -2.0), ("order", -1.0), ("caution", 1.0)]),
            trauma_delta: Some(1.0),
            cooldown_syncs: Some(6),
            conditions: None,
            on_apply: Some("sleep_start".to_string()),
        },
        RegisteredInfluence {
            id: "action:bathe".to_string(),
            category: "action".to_string(),
            label: "Купание".to_string(),
            trait_deltas: td([("order", 2.0), ("caution", -0.5)]),
            trauma_delta: None,
            cooldown_syncs: None,
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "action:heal".to_string(),
            category: "action".to_string(),
            label: "Лечение".to_string(),
            trait_deltas: td([("caution", 1.0), ("sociality", 0.5)]),
            trauma_delta: Some(-2.0),
            cooldown_syncs: Some(3),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "system:inactivity_long".to_string(),
            category: "system".to_string(),
            label: "Перерыв > 48ч".to_string(),
            trait_deltas: td([("sociality", -3.0), ("caution", 3.0), ("order", -1.0)]),
            trauma_delta: Some(3.0),
            cooldown_syncs: Some(48),
            conditions: Some(vec![cond(
                "session_gap_hours",
                &[("min", serde_json::json!(48))],
            )]),
            on_apply: None,
        },
        RegisteredInfluence {
            id: "system:consistent_week".to_string(),
            category: "system".to_string(),
            label: "7 дней подряд".to_string(),
            trait_deltas: td([("order", 3.0), ("sociality", 2.0), ("caution", -2.0)]),
            trauma_delta: Some(-5.0),
            cooldown_syncs: Some(168),
            conditions: Some(vec![cond(
                "streak_days",
                &[
                    ("action", serde_json::json!("any")),
                    ("days", serde_json::json!(7)),
                ],
            )]),
            on_apply: None,
        },
        RegisteredInfluence {
            id: "system:starvation".to_string(),
            category: "system".to_string(),
            label: "Голод < 5".to_string(),
            trait_deltas: td([("caution", 3.0), ("sociality", -2.0)]),
            trauma_delta: Some(5.0),
            cooldown_syncs: Some(6),
            conditions: Some(vec![cond(
                "stat_below",
                &[
                    ("stat", serde_json::json!("hunger")),
                    ("value", serde_json::json!(5)),
                ],
            )]),
            on_apply: None,
        },
        RegisteredInfluence {
            id: "item:puzzle".to_string(),
            category: "item".to_string(),
            label: "Головоломка".to_string(),
            trait_deltas: td([("curiosity", 4.0), ("order", 2.0), ("vitality", -1.0)]),
            trauma_delta: None,
            cooldown_syncs: Some(6),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "item:music_box".to_string(),
            category: "item".to_string(),
            label: "Музыкальная шкатулка".to_string(),
            trait_deltas: td([("sociality", 3.0), ("caution", -2.0), ("order", 1.0)]),
            trauma_delta: Some(-4.0),
            cooldown_syncs: Some(8),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "item:magic_potion".to_string(),
            category: "item".to_string(),
            label: "Магическое зелье".to_string(),
            trait_deltas: td([("curiosity", 3.0), ("appetite", 2.0)]),
            trauma_delta: Some(-8.0),
            cooldown_syncs: Some(24),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "item:magic_wand".to_string(),
            category: "item".to_string(),
            label: "Волшебная палочка".to_string(),
            trait_deltas: td([("curiosity", 5.0), ("vitality", 3.0), ("caution", -2.0)]),
            trauma_delta: None,
            cooldown_syncs: Some(12),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "item:crystal_ball".to_string(),
            category: "item".to_string(),
            label: "Хрустальный шар".to_string(),
            trait_deltas: td([("curiosity", 4.0), ("caution", -1.0), ("sociality", 2.0)]),
            trauma_delta: Some(-3.0),
            cooldown_syncs: Some(24),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "env:new_room".to_string(),
            category: "environment".to_string(),
            label: "Новая комната".to_string(),
            trait_deltas: td([("curiosity", 4.0), ("vitality", 2.0), ("caution", -1.0)]),
            trauma_delta: None,
            cooldown_syncs: Some(0),
            conditions: None,
            on_apply: None,
        },
        RegisteredInfluence {
            id: "env:same_room_48h".to_string(),
            category: "environment".to_string(),
            label: "48ч в одной комнате".to_string(),
            trait_deltas: td([("curiosity", -2.0), ("order", 1.0)]),
            trauma_delta: None,
            cooldown_syncs: Some(48),
            conditions: Some(vec![cond(
                "same_room_hours",
                &[("min", serde_json::json!(48))],
            )]),
            on_apply: None,
        },
        RegisteredInfluence {
            id: "social:visit_feral".to_string(),
            category: "social".to_string(),
            label: "С Диким".to_string(),
            trait_deltas: td([("vitality", 1.0), ("order", -1.0), ("caution", -0.5)]),
            trauma_delta: None,
            cooldown_syncs: Some(12),
            conditions: Some(vec![cond(
                "formation_period",
                &[("active", serde_json::json!(false))],
            )]),
            on_apply: None,
        },
        RegisteredInfluence {
            id: "social:visit_sage".to_string(),
            category: "social".to_string(),
            label: "С Мудрым".to_string(),
            trait_deltas: td([("curiosity", 2.0), ("order", 1.0)]),
            trauma_delta: None,
            cooldown_syncs: Some(8),
            conditions: Some(vec![cond(
                "formation_period",
                &[("active", serde_json::json!(false))],
            )]),
            on_apply: None,
        },
        RegisteredInfluence {
            id: "social:visit_paranoid".to_string(),
            category: "social".to_string(),
            label: "С Параноиком".to_string(),
            trait_deltas: td([("caution", 2.0), ("sociality", -1.0)]),
            trauma_delta: None,
            cooldown_syncs: Some(12),
            conditions: Some(vec![cond(
                "formation_period",
                &[("active", serde_json::json!(false))],
            )]),
            on_apply: None,
        },
        RegisteredInfluence {
            id: "social:visit_empath".to_string(),
            category: "social".to_string(),
            label: "С Эмпатом".to_string(),
            trait_deltas: td([("sociality", 2.0), ("caution", -1.0)]),
            trauma_delta: None,
            cooldown_syncs: Some(8),
            conditions: Some(vec![cond(
                "formation_period",
                &[("active", serde_json::json!(false))],
            )]),
            on_apply: None,
        },
        RegisteredInfluence {
            id: "social:visit_chaotic".to_string(),
            category: "social".to_string(),
            label: "С Хаотиком".to_string(),
            trait_deltas: td([("curiosity", 2.0), ("order", -1.5), ("vitality", 1.0)]),
            trauma_delta: None,
            cooldown_syncs: Some(12),
            conditions: Some(vec![cond(
                "formation_period",
                &[("active", serde_json::json!(false))],
            )]),
            on_apply: None,
        },
        RegisteredInfluence {
            id: "social:visit_playful".to_string(),
            category: "social".to_string(),
            label: "С Игривым".to_string(),
            trait_deltas: td([("vitality", 1.0), ("curiosity", 1.0), ("order", -0.5)]),
            trauma_delta: None,
            cooldown_syncs: Some(12),
            conditions: Some(vec![cond(
                "formation_period",
                &[("active", serde_json::json!(false))],
            )]),
            on_apply: None,
        },
    ]
}
