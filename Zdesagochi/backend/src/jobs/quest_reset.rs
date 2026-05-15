use chrono::{Timelike, Utc};
use std::time::Duration;
use tracing::{error, info};

use crate::{db::progress_repo, state::AppState};

pub async fn run(state: AppState) {
    loop {
        let seconds_until_midnight = {
            let now = Utc::now();
            let secs_since_midnight = now.num_seconds_from_midnight() as u64;
            86400u64.saturating_sub(secs_since_midnight)
        };

        tokio::time::sleep(Duration::from_secs(seconds_until_midnight)).await;

        match progress_repo::reset_daily_quests(&state.db).await {
            Ok(deleted) => info!(deleted_rows = deleted, "daily quest reset complete"),
            Err(e) => error!(error = %e, "quest_reset job failed"),
        }

        // Pause briefly so we don't re-trigger at exactly midnight
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}
