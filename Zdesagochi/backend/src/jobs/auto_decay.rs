use std::time::Duration;
use tracing::{error, info};

use crate::{
    db::pet_repo,
    handlers::sync::publish_pet_update,
    state::AppState,
};

const TICK_INTERVAL_SECS: u64 = 300; // 5 minutes

pub async fn run(state: AppState) {
    let mut interval = tokio::time::interval(Duration::from_secs(TICK_INTERVAL_SECS));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;
        if let Err(e) = tick_all_pets(&state).await {
            error!(error = %e, "auto_decay tick failed");
        }
    }
}

async fn tick_all_pets(state: &AppState) -> anyhow::Result<()> {
    let pets = pet_repo::get_all_pets(&state.db).await?;
    let now = chrono::Utc::now();

    for (user_id, mut pet) in pets {
        let last_updated = chrono::DateTime::parse_from_rfc3339(&pet.last_updated)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or(now);

        let elapsed_hours = (now - last_updated).num_seconds() as f64 / 3600.0;
        if elapsed_hours < 0.05 {
            continue;
        }

        apply_time_decay(&mut pet.stats, pet.is_asleep, elapsed_hours);
        pet.last_updated = now.to_rfc3339();

        if let Err(e) = pet_repo::upsert_pet(&state.db, &user_id, &pet).await {
            error!(user_id = %user_id, error = %e, "failed to save pet after decay");
            continue;
        }

        publish_pet_update(state, &user_id, &pet).await;
        info!(user_id = %user_id, elapsed_hours = elapsed_hours, "pet decay applied");
    }

    Ok(())
}

fn apply_time_decay(stats: &mut crate::domain::pet::PetStats, is_asleep: bool, elapsed_hours: f64) {
    fn decay(val: f64, rate: f64, hours: f64) -> f64 {
        (val - rate * hours).clamp(0.0, 100.0)
    }

    stats.hunger = decay(stats.hunger, 2.0, elapsed_hours);
    stats.happiness = decay(stats.happiness, 1.5, elapsed_hours);
    stats.health = decay(stats.health, 0.5, elapsed_hours);
    stats.cleanliness = decay(stats.cleanliness, 1.0, elapsed_hours);

    if is_asleep {
        stats.energy = (stats.energy + 10.0 * elapsed_hours).clamp(0.0, 100.0);
    } else {
        stats.energy = decay(stats.energy, 1.0, elapsed_hours);
    }
}
