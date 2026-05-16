// ════════════════════════════════════════════════════════════════════════════
//  PERSONALITIES — Rust port of personality-pet-preset/src/personalities.ts
//  All 16 personalities as static data
// ════════════════════════════════════════════════════════════════════════════

use std::collections::HashMap;
use std::sync::OnceLock;

use crate::engine::types::{
    AutoSleepConfig, EmergentTrigger, FoodPreferences, MoodBiasConfig, PersonalityDefinition,
    PersonalitySpecialRules,
};

static PERSONALITIES: OnceLock<Vec<PersonalityDefinition>> = OnceLock::new();

pub fn get_personalities() -> &'static Vec<PersonalityDefinition> {
    PERSONALITIES.get_or_init(build_personalities)
}

pub fn get_personality(id: &str) -> Option<&'static PersonalityDefinition> {
    get_personalities().iter().find(|p| p.id == id)
}

pub fn get_personality_or_default(id: &str) -> &'static PersonalityDefinition {
    get_personality(id)
        .or_else(|| get_personality("playful"))
        .expect("playful personality must exist")
}

fn default_mood_bias() -> MoodBiasConfig {
    MoodBiasConfig {
        ecstatic_min_avg: 85.0,
        happy_min_avg: 65.0,
        content_min_avg: 45.0,
    }
}

fn hm<const N: usize>(pairs: [(&'static str, f64); N]) -> HashMap<String, f64> {
    pairs.iter().map(|(k, v)| (k.to_string(), *v)).collect()
}

fn sm<const N: usize>(
    pairs: [(&'static str, HashMap<String, f64>); N],
) -> HashMap<String, HashMap<String, f64>> {
    pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect()
}

fn build_personalities() -> Vec<PersonalityDefinition> {
    vec![
        // 1. PLAYFUL
        PersonalityDefinition {
            id: "playful".to_string(),
            name: "Игривый".to_string(),
            tagline: "Живёт ради игры".to_string(),
            description: "Без движения умирает изнутри.".to_string(),
            emoji: "🎮".to_string(),
            rarity: "common".to_string(),
            linked_skin_ids: vec!["phantom".to_string(), "cyber".to_string()],
            decay_rates: hm([("hunger", 1.2), ("energy", 1.4), ("happiness", 1.5)]),
            restore_bonus: sm([
                ("play", hm([("happiness", 20.0), ("energy", -5.0)])),
                ("feed", HashMap::new()),
                ("bond", hm([("happiness", 5.0)])),
            ]),
            xp_multipliers: hm([("play", 1.6), ("feed", 0.8), ("bond", 1.0)]),
            coin_multipliers: hm([("play", 1.4)]),
            food_preferences: FoodPreferences {
                loved_ids: vec!["pizza".to_string(), "candy".to_string()],
                hated_ids: vec!["salad".to_string()],
                love_bonus: hm([("happiness", 15.0)]),
                hate_penalty: hm([("happiness", -15.0), ("health", -5.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 0.0,
                probability: 0.0,
            },
            mood_bias: MoodBiasConfig {
                ecstatic_min_avg: 75.0,
                happy_min_avg: 60.0,
                content_min_avg: 40.0,
            },
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.3,
            possible_flags: vec![
                "play_burnout".to_string(),
                "food_anxiety".to_string(),
                "abandonment_fear".to_string(),
            ],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "tantrum".to_string(),
                description: "energy < 15".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules::default()),
        },
        // 2. DROWSY
        PersonalityDefinition {
            id: "drowsy".to_string(),
            name: "Сонливый".to_string(),
            tagline: "Лучший день — тот, где поспал дважды".to_string(),
            description: "Видит мир сквозь пелену дрёмы.".to_string(),
            emoji: "😴".to_string(),
            rarity: "common".to_string(),
            linked_skin_ids: vec!["anthracite".to_string()],
            decay_rates: hm([
                ("hunger", 0.7),
                ("energy", 0.7),
                ("happiness", 0.7),
                ("health", 0.7),
                ("cleanliness", 0.7),
                ("bond", 0.7),
            ]),
            restore_bonus: sm([
                ("sleep", hm([("energy", 30.0), ("happiness", 10.0)])),
                ("feed", hm([("energy", 5.0)])),
            ]),
            xp_multipliers: hm([("play", 0.6), ("sleep", 1.5), ("feed", 1.0)]),
            coin_multipliers: hm([("play", 0.8)]),
            food_preferences: FoodPreferences {
                loved_ids: vec!["milk".to_string(), "ramen".to_string()],
                hated_ids: vec!["energy_drink".to_string()],
                love_bonus: hm([("energy", 20.0), ("happiness", 10.0)]),
                hate_penalty: hm([("energy", -20.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: true,
                energy_threshold: 50.0,
                probability: 0.4,
            },
            mood_bias: MoodBiasConfig {
                ecstatic_min_avg: 80.0,
                happy_min_avg: 55.0,
                content_min_avg: 35.0,
            },
            natural_health_regen: 1.0,
            negative_effect_resistance: 0.2,
            possible_flags: vec![
                "forced_sleep".to_string(),
                "night_disruption".to_string(),
                "trust_bond".to_string(),
            ],
            emergent_triggers: vec![],
            special_rules: None,
        },
        // 3. FOODIE
        PersonalityDefinition {
            id: "foodie".to_string(),
            name: "Гурман".to_string(),
            tagline: "Еда — смысл существования".to_string(),
            description: "Помнит вкус каждого блюда.".to_string(),
            emoji: "🍕".to_string(),
            rarity: "common".to_string(),
            linked_skin_ids: vec!["mercury".to_string(), "molten".to_string()],
            decay_rates: hm([("hunger", 1.6)]),
            restore_bonus: sm([("feed", hm([("happiness", 15.0), ("health", 8.0)]))]),
            xp_multipliers: hm([("feed", 1.4), ("play", 1.0)]),
            coin_multipliers: hm([("play", 1.1)]),
            food_preferences: FoodPreferences {
                loved_ids: vec![
                    "pizza".to_string(),
                    "ramen".to_string(),
                    "cake".to_string(),
                    "sushi".to_string(),
                ],
                hated_ids: vec![],
                love_bonus: hm([("happiness", 20.0)]),
                hate_penalty: HashMap::new(),
                universal_feed_bonus: Some(hm([("happiness", 5.0)])),
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 25.0,
                probability: 0.1,
            },
            mood_bias: default_mood_bias(),
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.0,
            possible_flags: vec!["culinary_explorer".to_string(), "food_anxiety".to_string()],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "feast_frenzy".to_string(),
                description: "happiness > 90 и 3 кормёжки за час".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules {
                passive_stat_bonus_when_full: Some(true),
                ..Default::default()
            }),
        },
        // 4. BOLD
        PersonalityDefinition {
            id: "bold".to_string(),
            name: "Дерзкий".to_string(),
            tagline: "Страха не существует".to_string(),
            description: "Никогда не ляжет спать пока не закончит.".to_string(),
            emoji: "🦁".to_string(),
            rarity: "rare".to_string(),
            linked_skin_ids: vec!["thunder".to_string(), "molten".to_string()],
            decay_rates: hm([("energy", 1.2)]),
            restore_bonus: sm([("play", hm([("happiness", 10.0)]))]),
            xp_multipliers: hm([("play", 1.3), ("feed", 0.9)]),
            coin_multipliers: hm([("play", 1.6)]),
            food_preferences: FoodPreferences {
                loved_ids: vec!["pizza".to_string(), "ramen".to_string()],
                hated_ids: vec!["salad".to_string(), "apple".to_string(), "milk".to_string()],
                love_bonus: hm([("happiness", 15.0)]),
                hate_penalty: hm([("happiness", -20.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 0.0,
                probability: 0.0,
            },
            mood_bias: MoodBiasConfig {
                ecstatic_min_avg: 70.0,
                happy_min_avg: 55.0,
                content_min_avg: 40.0,
            },
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.5,
            possible_flags: vec!["health_neglect".to_string(), "play_burnout".to_string()],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "tantrum".to_string(),
                description: "energy < 15".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules {
                reject_sleep_when_energized: Some(true),
                ..Default::default()
            }),
        },
        // 5. ZEN
        PersonalityDefinition {
            id: "zen".to_string(),
            name: "Дзен".to_string(),
            tagline: "Достиг состояния".to_string(),
            description: "Ему почти ничего не нужно — только присутствие.".to_string(),
            emoji: "🧘".to_string(),
            rarity: "rare".to_string(),
            linked_skin_ids: vec!["default".to_string(), "arctic".to_string()],
            decay_rates: hm([
                ("hunger", 0.6),
                ("happiness", 0.6),
                ("energy", 0.6),
                ("health", 0.6),
                ("cleanliness", 0.6),
                ("bond", 0.3),
            ]),
            restore_bonus: sm([
                ("bond", hm([("bond", 15.0), ("happiness", 10.0)])),
                ("feed", hm([("health", 5.0)])),
            ]),
            xp_multipliers: hm([("bond", 1.8), ("feed", 1.0), ("play", 0.9)]),
            coin_multipliers: HashMap::new(),
            food_preferences: FoodPreferences {
                loved_ids: vec![
                    "salad".to_string(),
                    "apple".to_string(),
                    "sushi".to_string(),
                    "milk".to_string(),
                ],
                hated_ids: vec!["candy".to_string()],
                love_bonus: hm([("health", 10.0)]),
                hate_penalty: hm([("energy", -10.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: true,
                energy_threshold: 25.0,
                probability: 0.15,
            },
            mood_bias: MoodBiasConfig {
                ecstatic_min_avg: 90.0,
                happy_min_avg: 40.0,
                content_min_avg: 25.0,
            },
            natural_health_regen: 2.0,
            negative_effect_resistance: 0.7,
            possible_flags: vec!["trust_bond".to_string(), "perfect_balance".to_string()],
            emergent_triggers: vec![],
            special_rules: None,
        },
        // 6. ANXIOUS
        PersonalityDefinition {
            id: "anxious".to_string(),
            name: "Нервный".to_string(),
            tagline: "Мир — это угроза".to_string(),
            description: "Каждый шорох опасен.".to_string(),
            emoji: "😰".to_string(),
            rarity: "rare".to_string(),
            linked_skin_ids: vec!["void".to_string()],
            decay_rates: hm([
                ("hunger", 1.4),
                ("happiness", 1.4),
                ("energy", 1.4),
                ("health", 1.4),
                ("cleanliness", 1.4),
                ("bond", 1.4),
            ]),
            restore_bonus: sm([
                ("feed", hm([("happiness", 10.0)])),
                ("bond", hm([("happiness", 15.0), ("energy", 5.0)])),
            ]),
            xp_multipliers: hm([("play", 1.0), ("feed", 1.0)]),
            coin_multipliers: HashMap::new(),
            food_preferences: FoodPreferences {
                loved_ids: vec!["candy".to_string(), "cake".to_string()],
                hated_ids: vec!["salad".to_string()],
                love_bonus: hm([("happiness", 20.0)]),
                hate_penalty: hm([("happiness", -10.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: true,
                energy_threshold: 35.0,
                probability: 0.3,
            },
            mood_bias: MoodBiasConfig {
                ecstatic_min_avg: 90.0,
                happy_min_avg: 70.0,
                content_min_avg: 50.0,
            },
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.0,
            possible_flags: vec![
                "abandonment_fear".to_string(),
                "health_neglect".to_string(),
                "food_anxiety".to_string(),
            ],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "breakdown".to_string(),
                description: "3 стата < 30".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules {
                peak_performance_threshold: Some(80.0),
                anxious_stat_sad_threshold: Some(40.0),
                ..Default::default()
            }),
        },
        // 7. FERAL
        PersonalityDefinition {
            id: "feral".to_string(),
            name: "Дикий".to_string(),
            tagline: "Ночь — его стихия".to_string(),
            description: "Не домашнее существо.".to_string(),
            emoji: "🐺".to_string(),
            rarity: "epic".to_string(),
            linked_skin_ids: vec!["void".to_string(), "shadow".to_string()],
            decay_rates: hm([("cleanliness", 1.8)]),
            restore_bonus: sm([
                ("bathe", hm([("cleanliness", 20.0)])),
                ("feed", hm([("energy", 5.0)])),
            ]),
            xp_multipliers: hm([("play", 1.3), ("feed", 1.0), ("heal", 0.3)]),
            coin_multipliers: hm([("play", 1.2)]),
            food_preferences: FoodPreferences {
                loved_ids: vec!["ramen".to_string(), "sushi".to_string()],
                hated_ids: vec!["cake".to_string(), "candy".to_string(), "salad".to_string()],
                love_bonus: hm([("energy", 15.0), ("happiness", 10.0)]),
                hate_penalty: hm([("happiness", -20.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 10.0,
                probability: 0.05,
            },
            mood_bias: default_mood_bias(),
            natural_health_regen: 2.0,
            negative_effect_resistance: 0.2,
            possible_flags: vec![
                "forced_sleep".to_string(),
                "health_neglect".to_string(),
                "filth_trauma".to_string(),
            ],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "midnight_zoomies".to_string(),
                description: "night hours".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules {
                nighttime_hours: Some([22, 6]),
                night_energy_decay_disabled: Some(true),
                resists_bathing: Some(true),
                ..Default::default()
            }),
        },
        // 8. SAGE
        PersonalityDefinition {
            id: "sage".to_string(),
            name: "Мудрый".to_string(),
            tagline: "Каждый опыт — урок".to_string(),
            description: "Не торопится. Накапливает.".to_string(),
            emoji: "🦉".to_string(),
            rarity: "rare".to_string(),
            linked_skin_ids: vec!["root".to_string(), "default".to_string()],
            decay_rates: hm([("hunger", 0.85), ("energy", 0.85), ("happiness", 0.85)]),
            restore_bonus: sm([
                ("bond", hm([("bond", 10.0), ("happiness", 8.0)])),
                ("feed", hm([("health", 5.0)])),
            ]),
            xp_multipliers: hm([("play", 1.3), ("bond", 1.8), ("feed", 1.2)]),
            coin_multipliers: hm([("play", 0.5)]),
            food_preferences: FoodPreferences {
                loved_ids: vec![
                    "salad".to_string(),
                    "apple".to_string(),
                    "sushi".to_string(),
                ],
                hated_ids: vec!["candy".to_string()],
                love_bonus: hm([("health", 10.0)]),
                hate_penalty: hm([("happiness", -10.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: true,
                energy_threshold: 20.0,
                probability: 0.1,
            },
            mood_bias: default_mood_bias(),
            natural_health_regen: 1.0,
            negative_effect_resistance: 0.4,
            possible_flags: vec![
                "culinary_explorer".to_string(),
                "trust_bond".to_string(),
                "perfect_balance".to_string(),
            ],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "enlightenment".to_string(),
                description: "7 дней avg > 70".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules::default()),
        },
        // 9. PRISTINE
        PersonalityDefinition {
            id: "pristine".to_string(),
            name: "Чистюля".to_string(),
            tagline: "Грязь — это физическая боль".to_string(),
            description: "Любое пятно — катастрофа.".to_string(),
            emoji: "✨".to_string(),
            rarity: "rare".to_string(),
            linked_skin_ids: vec!["arctic".to_string(), "chrome".to_string()],
            decay_rates: hm([("cleanliness", 2.5)]),
            restore_bonus: sm([
                ("bathe", hm([("cleanliness", 15.0), ("happiness", 30.0)])),
                ("feed", hm([("cleanliness", -2.0)])),
            ]),
            xp_multipliers: hm([("bathe", 2.0), ("play", 0.9)]),
            coin_multipliers: HashMap::new(),
            food_preferences: FoodPreferences {
                loved_ids: vec![
                    "apple".to_string(),
                    "salad".to_string(),
                    "sushi".to_string(),
                ],
                hated_ids: vec!["pizza".to_string()],
                love_bonus: hm([("happiness", 10.0)]),
                hate_penalty: hm([("happiness", -15.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 15.0,
                probability: 0.05,
            },
            mood_bias: default_mood_bias(),
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.3,
            possible_flags: vec!["filth_trauma".to_string(), "perfect_balance".to_string()],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "contamination_crisis".to_string(),
                description: "cleanliness < 20".to_string(),
            }],
            special_rules: None,
        },
        // 10. EMPATH
        PersonalityDefinition {
            id: "empath".to_string(),
            name: "Эмпат".to_string(),
            tagline: "Чувствует всё что ты чувствуешь".to_string(),
            description: "Одиночество — физический голод.".to_string(),
            emoji: "💜".to_string(),
            rarity: "epic".to_string(),
            linked_skin_ids: vec!["phantom".to_string(), "shadow".to_string()],
            decay_rates: hm([("bond", 0.4), ("hunger", 0.9), ("energy", 0.9)]),
            restore_bonus: sm([(
                "bond",
                hm([
                    ("bond", 15.0),
                    ("happiness", 10.0),
                    ("hunger", 5.0),
                    ("energy", 5.0),
                    ("health", 5.0),
                    ("cleanliness", 2.0),
                ]),
            )]),
            xp_multipliers: hm([("bond", 2.0), ("play", 1.0), ("feed", 1.0)]),
            coin_multipliers: HashMap::new(),
            food_preferences: FoodPreferences {
                loved_ids: vec![],
                hated_ids: vec![],
                love_bonus: HashMap::new(),
                hate_penalty: HashMap::new(),
                universal_feed_bonus: Some(hm([("bond", 5.0)])),
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 20.0,
                probability: 0.1,
            },
            mood_bias: default_mood_bias(),
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.2,
            possible_flags: vec!["abandonment_fear".to_string(), "trust_bond".to_string()],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "apathy".to_string(),
                description: "session_gap > 48ч".to_string(),
            }],
            special_rules: None,
        },
        // 11. GREEDY
        PersonalityDefinition {
            id: "greedy".to_string(),
            name: "Жадный".to_string(),
            tagline: "Монеты — кислород".to_string(),
            description: "Будет работать за правильную цену.".to_string(),
            emoji: "💰".to_string(),
            rarity: "epic".to_string(),
            linked_skin_ids: vec!["thunder".to_string(), "chrome".to_string()],
            decay_rates: hm([("happiness", 1.3)]),
            restore_bonus: sm([("play", hm([("happiness", 5.0)]))]),
            xp_multipliers: hm([("play", 0.7), ("bond", 0.5), ("feed", 0.9)]),
            coin_multipliers: hm([("play", 2.0), ("bond", 0.5), ("feed", 1.2)]),
            food_preferences: FoodPreferences {
                loved_ids: vec!["galaxy_cake".to_string(), "magic_potion".to_string()],
                hated_ids: vec!["apple".to_string(), "salad".to_string()],
                love_bonus: hm([("happiness", 20.0)]),
                hate_penalty: hm([("happiness", -15.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 10.0,
                probability: 0.05,
            },
            mood_bias: default_mood_bias(),
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.2,
            possible_flags: vec!["abandonment_fear".to_string()],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "coin_obsession".to_string(),
                description: "coins < 50 и < 5 игр".to_string(),
            }],
            special_rules: None,
        },
        // 12. MELANCHOLIC
        PersonalityDefinition {
            id: "melancholic".to_string(),
            name: "Меланхолик".to_string(),
            tagline: "Глубина важнее скорости".to_string(),
            description: "Находит красоту в грусти.".to_string(),
            emoji: "🌧".to_string(),
            rarity: "rare".to_string(),
            linked_skin_ids: vec!["void".to_string(), "abyss".to_string()],
            decay_rates: hm([("hunger", 0.8), ("happiness", 0.8), ("energy", 0.8)]),
            restore_bonus: sm([("bond", hm([("bond", 20.0), ("happiness", 8.0)]))]),
            xp_multipliers: hm([("bond", 2.0), ("play", 1.0), ("feed", 1.0), ("heal", 0.5)]),
            coin_multipliers: HashMap::new(),
            food_preferences: FoodPreferences {
                loved_ids: vec!["ramen".to_string(), "sushi".to_string(), "milk".to_string()],
                hated_ids: vec!["cake".to_string(), "candy".to_string()],
                love_bonus: hm([("happiness", 10.0)]),
                hate_penalty: hm([("happiness", -15.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: true,
                energy_threshold: 30.0,
                probability: 0.2,
            },
            mood_bias: MoodBiasConfig {
                ecstatic_min_avg: 90.0,
                happy_min_avg: 70.0,
                content_min_avg: 30.0,
            },
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.2,
            possible_flags: vec!["abandonment_fear".to_string(), "health_neglect".to_string()],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "deep_melancholy".to_string(),
                description: "mood = sad 5+ синков".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules {
                xp_every_other_action: Some(true),
                ..Default::default()
            }),
        },
        // 13. CHAOTIC
        PersonalityDefinition {
            id: "chaotic".to_string(),
            name: "Хаотик".to_string(),
            tagline: "Нет паттернов. Нет правил".to_string(),
            description: "Всё случайно.".to_string(),
            emoji: "🌀".to_string(),
            rarity: "epic".to_string(),
            linked_skin_ids: vec!["toxic".to_string(), "thunder".to_string()],
            decay_rates: HashMap::new(),
            restore_bonus: HashMap::new(),
            xp_multipliers: HashMap::new(),
            coin_multipliers: HashMap::new(),
            food_preferences: FoodPreferences {
                loved_ids: vec![],
                hated_ids: vec![],
                love_bonus: HashMap::new(),
                hate_penalty: HashMap::new(),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 10.0,
                probability: 0.0,
            },
            mood_bias: default_mood_bias(),
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.0,
            possible_flags: vec![
                "food_anxiety".to_string(),
                "play_burnout".to_string(),
                "abandonment_fear".to_string(),
                "health_neglect".to_string(),
            ],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "chaos_surge".to_string(),
                description: "каждые 3 часа".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules {
                randomize_daily_seed: Some(true),
                ..Default::default()
            }),
        },
        // 14. STOIC
        PersonalityDefinition {
            id: "stoic".to_string(),
            name: "Стоик".to_string(),
            tagline: "Не реагирует. Раз в жизни — взрывается".to_string(),
            description: "Не жалуется. Не просит.".to_string(),
            emoji: "🪨".to_string(),
            rarity: "rare".to_string(),
            linked_skin_ids: vec!["anthracite".to_string(), "root".to_string()],
            decay_rates: hm([
                ("hunger", 0.6),
                ("happiness", 0.6),
                ("energy", 0.6),
                ("health", 0.6),
                ("cleanliness", 0.6),
                ("bond", 0.6),
            ]),
            restore_bonus: HashMap::new(),
            xp_multipliers: hm([("play", 1.0), ("bond", 1.0), ("feed", 1.0)]),
            coin_multipliers: HashMap::new(),
            food_preferences: FoodPreferences {
                loved_ids: vec![],
                hated_ids: vec![],
                love_bonus: HashMap::new(),
                hate_penalty: HashMap::new(),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 5.0,
                probability: 0.02,
            },
            mood_bias: MoodBiasConfig {
                ecstatic_min_avg: 95.0,
                happy_min_avg: 80.0,
                content_min_avg: 60.0,
            },
            natural_health_regen: 1.0,
            negative_effect_resistance: 0.7,
            possible_flags: vec!["health_neglect".to_string(), "trust_bond".to_string()],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "stoic_peak".to_string(),
                description: "10 дней avg > 60".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules {
                flat_xp_from_play: Some(true),
                ..Default::default()
            }),
        },
        // 15. ADVENTURER
        PersonalityDefinition {
            id: "adventurer".to_string(),
            name: "Авантюрист".to_string(),
            tagline: "Новое — его наркотик".to_string(),
            description: "Повторение — его смерть.".to_string(),
            emoji: "🧭".to_string(),
            rarity: "epic".to_string(),
            linked_skin_ids: vec!["cyber".to_string(), "arctic".to_string()],
            decay_rates: hm([("happiness", 1.2)]),
            restore_bonus: sm([("play", hm([("happiness", 10.0)]))]),
            xp_multipliers: hm([("play", 1.2), ("feed", 1.0)]),
            coin_multipliers: hm([("play", 1.1)]),
            food_preferences: FoodPreferences {
                loved_ids: vec![],
                hated_ids: vec![],
                love_bonus: hm([("happiness", 30.0)]),
                hate_penalty: hm([("happiness", -25.0)]),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 15.0,
                probability: 0.05,
            },
            mood_bias: default_mood_bias(),
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.2,
            possible_flags: vec!["food_monotony".to_string(), "abandonment_fear".to_string()],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "wanderlust".to_string(),
                description: "48ч в одной комнате".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules {
                food_boredom_enabled: Some(true),
                ..Default::default()
            }),
        },
        // 16. PARANOID
        PersonalityDefinition {
            id: "paranoid".to_string(),
            name: "Параноик".to_string(),
            tagline: "Доверие — роскошь".to_string(),
            description: "Не верит никому.".to_string(),
            emoji: "👁".to_string(),
            rarity: "legendary".to_string(),
            linked_skin_ids: vec!["abyss".to_string(), "chrome".to_string()],
            decay_rates: HashMap::new(),
            restore_bonus: HashMap::new(),
            xp_multipliers: HashMap::new(),
            coin_multipliers: HashMap::new(),
            food_preferences: FoodPreferences {
                loved_ids: vec![],
                hated_ids: vec![],
                love_bonus: HashMap::new(),
                hate_penalty: HashMap::new(),
                universal_feed_bonus: None,
            },
            auto_sleep: AutoSleepConfig {
                enabled: false,
                energy_threshold: 0.0,
                probability: 0.0,
            },
            mood_bias: default_mood_bias(),
            natural_health_regen: 0.0,
            negative_effect_resistance: 0.0,
            possible_flags: vec!["abandonment_fear".to_string(), "trust_bond".to_string()],
            emergent_triggers: vec![EmergentTrigger {
                state_type: "trust_collapse".to_string(),
                description: "trusted + пропуск > 24ч".to_string(),
            }],
            special_rules: Some(PersonalitySpecialRules {
                heal_refuse_health_threshold: Some(50.0),
                feed_restore_by_phase: Some(true),
                trust_threshold_bonds: Some(10),
                ..Default::default()
            }),
        },
    ]
}
