// Runtime accessors for generated personality definitions.
// Source of truth: packages/personality-pet-preset/src/personalities.ts

use std::sync::OnceLock;

use crate::engine::types::PersonalityDefinition;

static PERSONALITIES: OnceLock<Vec<PersonalityDefinition>> = OnceLock::new();

pub fn get_personalities() -> &'static Vec<PersonalityDefinition> {
    PERSONALITIES.get_or_init(crate::engine::personality_definitions::build_personalities)
}

pub fn get_personality(id: &str) -> Option<&'static PersonalityDefinition> {
    get_personalities().iter().find(|p| p.id == id)
}

pub fn get_personality_or_default(id: &str) -> &'static PersonalityDefinition {
    get_personality(id)
        .or_else(|| get_personality("playful"))
        .expect("playful personality must exist")
}
