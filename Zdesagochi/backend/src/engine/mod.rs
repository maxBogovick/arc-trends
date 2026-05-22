#![allow(dead_code)]

pub mod catalog;
pub mod command_handlers;
pub mod influence_registry;
pub mod memory_generator;
pub mod personalities;
pub mod personality_catalog;
pub mod personality_definitions;
pub mod personality_engine;
pub mod trait_evolution;
pub mod types;

pub use command_handlers::{apply_personality_command, EngineState, FoodEffect, PetCommand};
