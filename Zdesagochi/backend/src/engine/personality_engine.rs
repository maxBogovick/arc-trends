// ════════════════════════════════════════════════════════════════════════════
//  PERSONALITY ENGINE — Rust port of personality-core/src/PersonalityEngine.ts
// ════════════════════════════════════════════════════════════════════════════

use chrono::{DateTime, Timelike, Utc};
use std::collections::HashMap;

use crate::engine::types::{
    avg_stats, clamp, clamp_stat, BehavioralCounters, EmergentStateType, PersonalityDefinition,
    PetStateLayers, StatKey,
};

// ── Constants ─────────────────────────────────────────────────────────────────

pub const STOIC_FLAT_PLAY_XP: f64 = 15.0;

pub const BASE_DECAY_PER_MINUTE: &[(StatKey, f64)] = &[
    (StatKey::Hunger, 0.083),
    (StatKey::Happiness, 0.083),
    (StatKey::Energy, 0.100),
    (StatKey::Health, 0.033),
    (StatKey::Cleanliness, 0.067),
    (StatKey::Bond, 0.050),
];

// ── Decay ─────────────────────────────────────────────────────────────────────

pub fn apply_decay(
    stats: &mut HashMap<StatKey, f64>,
    personality: &PersonalityDefinition,
    elapsed_minutes: f64,
    counters: &BehavioralCounters,
    local_hour: i32,
) {
    let chaos_mult = if personality
        .special_rules
        .as_ref()
        .is_some_and(|r| r.randomize_daily_seed.unwrap_or(false))
    {
        get_chaos_decay_mult(counters)
    } else {
        1.0
    };

    for &stat in StatKey::all() {
        let base_decay = BASE_DECAY_PER_MINUTE
            .iter()
            .find(|(k, _)| *k == stat)
            .map(|(_, v)| *v)
            .unwrap_or(0.0);

        let personality_mult = personality
            .decay_rates
            .get(stat.as_str())
            .copied()
            .unwrap_or(1.0);
        let rule_mult = get_decay_rule_mult(stat, stats, personality, local_hour);
        let total_mult = clamp(personality_mult * rule_mult * chaos_mult, 0.05, 3.0);

        let current = stats.get(&stat).copied().unwrap_or(0.0);
        stats.insert(
            stat,
            clamp_stat(current - base_decay * elapsed_minutes * total_mult),
        );
    }
}

fn get_decay_rule_mult(
    stat: StatKey,
    stats: &HashMap<StatKey, f64>,
    personality: &PersonalityDefinition,
    local_hour: i32,
) -> f64 {
    // empath: low bond decay
    if personality.id == "empath" {
        let bond = stats.get(&StatKey::Bond).copied().unwrap_or(100.0);
        if bond < 30.0 {
            return 1.3;
        }
    }
    // feral: night energy decay disabled
    if stat == StatKey::Energy
        && personality.id == "feral"
        && personality
            .special_rules
            .as_ref()
            .is_some_and(|r| r.night_energy_decay_disabled.unwrap_or(false))
    {
        let nighttime = personality
            .special_rules
            .as_ref()
            .and_then(|r| r.nighttime_hours)
            .unwrap_or([22, 6]);
        if is_night_hour(local_hour as u32, nighttime) {
            return 0.0;
        }
    }
    1.0
}

fn is_night_hour(hour: u32, range: [u32; 2]) -> bool {
    let [start, end] = range;
    if start > end {
        hour >= start || hour < end
    } else {
        hour >= start && hour < end
    }
}

// Simple seeded random for chaos
fn seeded_rng(seed: u64) -> impl FnMut() -> f64 {
    let mut state = seed.wrapping_add(1);
    move || {
        state = state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (state >> 33) as f64 / u32::MAX as f64
    }
}

fn get_chaos_seed(counters: &BehavioralCounters) -> u64 {
    // Use chaos_daily_seed as base
    (counters.chaos_daily_seed * 1_000_000_000.0) as u64
}

fn get_chaos_decay_mult(counters: &BehavioralCounters) -> f64 {
    let seed = get_chaos_seed(counters);
    let mut rng = seeded_rng(seed);
    0.5 + rng() * 2.0 // 0.5-2.5
}

fn get_chaos_restore_mult(counters: &BehavioralCounters) -> f64 {
    let seed = get_chaos_seed(counters);
    let mut rng = seeded_rng(seed);
    let _ = rng(); // skip decay
    0.5 + rng() * 2.0
}

fn get_chaos_xp_mult(counters: &BehavioralCounters) -> f64 {
    let seed = get_chaos_seed(counters);
    let mut rng = seeded_rng(seed);
    let _ = rng();
    let _ = rng(); // skip decay, restore
    0.5 + rng() * 2.0
}

fn get_chaos_coin_mult(counters: &BehavioralCounters) -> f64 {
    let seed = get_chaos_seed(counters);
    let mut rng = seeded_rng(seed);
    let _ = rng();
    let _ = rng();
    let _ = rng(); // skip decay, restore, xp
    0.5 + rng() * 2.0
}

// ── Mood ──────────────────────────────────────────────────────────────────────

pub fn calc_mood_with_bias(
    stats: &HashMap<StatKey, f64>,
    personality: &PersonalityDefinition,
    is_asleep: bool,
) -> String {
    if is_asleep {
        return "sleeping".to_string();
    }
    let health = stats.get(&StatKey::Health).copied().unwrap_or(100.0);
    let energy = stats.get(&StatKey::Energy).copied().unwrap_or(100.0);

    if health < 25.0 {
        return "sick".to_string();
    }
    if energy < 20.0 {
        return "tired".to_string();
    }

    // anxious: sad if any stat below threshold
    if let Some(threshold) = personality
        .special_rules
        .as_ref()
        .and_then(|r| r.anxious_stat_sad_threshold)
    {
        if stats.values().any(|&v| v < threshold) {
            return "sad".to_string();
        }
    }

    let hunger = stats.get(&StatKey::Hunger).copied().unwrap_or(50.0);
    let happiness = stats.get(&StatKey::Happiness).copied().unwrap_or(50.0);
    let avg = (hunger + happiness + energy + health) / 4.0;

    let bias = &personality.mood_bias;
    if avg >= bias.ecstatic_min_avg {
        "ecstatic".to_string()
    } else if avg >= bias.happy_min_avg {
        "happy".to_string()
    } else if avg >= bias.content_min_avg {
        "content".to_string()
    } else {
        "sad".to_string()
    }
}

// ── Natural passives ──────────────────────────────────────────────────────────

pub fn compute_natural_passives(
    stats: &HashMap<StatKey, f64>,
    personality: &PersonalityDefinition,
) -> HashMap<StatKey, f64> {
    let mut bonuses: HashMap<StatKey, f64> = HashMap::new();
    let hunger = stats.get(&StatKey::Hunger).copied().unwrap_or(0.0);
    let cleanliness = stats.get(&StatKey::Cleanliness).copied().unwrap_or(0.0);
    let bond = stats.get(&StatKey::Bond).copied().unwrap_or(0.0);
    let health = stats.get(&StatKey::Health).copied().unwrap_or(100.0);

    // foodie: full bonus
    if personality.id == "foodie"
        && personality
            .special_rules
            .as_ref()
            .is_some_and(|r| r.passive_stat_bonus_when_full.unwrap_or(false))
        && hunger > 80.0
    {
        *bonuses.entry(StatKey::Happiness).or_insert(0.0) += 3.0;
        *bonuses.entry(StatKey::Energy).or_insert(0.0) += 3.0;
        *bonuses.entry(StatKey::Health).or_insert(0.0) += 3.0;
        *bonuses.entry(StatKey::Cleanliness).or_insert(0.0) += 3.0;
        *bonuses.entry(StatKey::Bond).or_insert(0.0) += 3.0;
    }

    // pristine: clean bonus
    if personality.id == "pristine" && cleanliness > 85.0 {
        for &stat in StatKey::all() {
            if stat != StatKey::Cleanliness {
                *bonuses.entry(stat).or_insert(0.0) += 10.0;
            }
        }
    }

    // empath: bond happiness
    if personality.id == "empath" && bond > 80.0 {
        *bonuses.entry(StatKey::Happiness).or_insert(0.0) += 10.0;
    }

    // natural health regen
    if personality.natural_health_regen > 0.0 && health < 70.0 {
        *bonuses.entry(StatKey::Health).or_insert(0.0) += personality.natural_health_regen;
    }

    bonuses
}

// ── Emergent state computation ────────────────────────────────────────────────

pub fn compute_emergent_state(
    stats: &HashMap<StatKey, f64>,
    personality: &PersonalityDefinition,
    counters: &BehavioralCounters,
    state_layers: &PetStateLayers,
    now: DateTime<Utc>,
    coin_balance: f64,
    session_gap_hours: f64,
) -> Option<EmergentStateType> {
    let local_hour = now.hour();
    let current_state = state_layers
        .gameplay
        .as_ref()
        .and_then(|v| v.first())
        .map(|s| &s.state_type);
    let entered_at = state_layers
        .gameplay
        .as_ref()
        .and_then(|v| v.first())
        .map(|s| s.entered_at.as_str());

    let _avg = avg_stats(stats);

    // Compute candidates (check personality restrictions)
    let mut candidates: Vec<(EmergentStateType, u32)> = Vec::new();

    macro_rules! candidate {
        ($personality_ids:expr, $state:expr, $condition:expr) => {
            let allowed: &[&str] = $personality_ids;
            if allowed.is_empty() || allowed.contains(&personality.id.as_str()) {
                if $condition {
                    let prio = $state.priority();
                    candidates.push(($state, prio));
                }
            }
        };
    }

    // stoic_peak
    {
        let ids: &[&str] = &["stoic"];
        if ids.contains(&personality.id.as_str()) {
            // Check if already active and should retain (2 hour window)
            let retaining = if current_state == Some(&EmergentStateType::StoicPeak) {
                entered_at.is_some_and(|ea| {
                    let elapsed = now
                        .signed_duration_since(ea.parse::<DateTime<Utc>>().unwrap_or(now))
                        .num_seconds() as f64
                        / 3600.0;
                    elapsed < 2.0
                })
            } else {
                false
            };
            if retaining || (!counters.stoic_peak_used && counters.consecutive_good_syncs >= 10) {
                candidates.push((
                    EmergentStateType::StoicPeak,
                    EmergentStateType::StoicPeak.priority(),
                ));
            }
        }
    }

    // enlightenment (sage)
    candidate!(
        &["sage"],
        EmergentStateType::Enlightenment,
        !counters.enlightenment_active && counters.consecutive_good_syncs >= 7 * 24
    );

    // feast_frenzy (foodie)
    {
        let ids: &[&str] = &["foodie"];
        if ids.contains(&personality.id.as_str()) {
            let happiness = stats.get(&StatKey::Happiness).copied().unwrap_or(0.0);
            let recent_count = count_recent_feeds(counters, now);
            if recent_count >= 3 && happiness > 90.0 {
                candidates.push((
                    EmergentStateType::FeastFrenzy,
                    EmergentStateType::FeastFrenzy.priority(),
                ));
            }
        }
    }

    // deep_melancholy (melancholic)
    candidate!(
        &["melancholic"],
        EmergentStateType::DeepMelancholy,
        counters.consecutive_bad_mood_syncs >= 5
    );

    // wanderlust (adventurer)
    candidate!(
        &["adventurer"],
        EmergentStateType::Wanderlust,
        counters.same_room_hours >= 48.0
    );

    // midnight_zoomies (feral)
    {
        let ids: &[&str] = &["feral"];
        if ids.contains(&personality.id.as_str()) {
            let nighttime = personality
                .special_rules
                .as_ref()
                .and_then(|r| r.nighttime_hours)
                .unwrap_or([22, 6]);
            if is_night_hour(local_hour, nighttime) {
                candidates.push((
                    EmergentStateType::MidnightZoomies,
                    EmergentStateType::MidnightZoomies.priority(),
                ));
            }
        }
    }

    // coin_obsession (greedy)
    candidate!(
        &["greedy"],
        EmergentStateType::CoinObsession,
        coin_balance < 50.0 && counters.play_count_today < 5
    );

    // food_panic (any with food_anxiety flag) - checked via flags
    // (simplified: just check if any flag counters indicate food anxiety)
    // food_panic - check via consecutive low health
    {
        let hunger = stats.get(&StatKey::Hunger).copied().unwrap_or(100.0);
        // Simple approximation: food_panic if hunger very low (< 20) and some stress indicators
        if hunger < 20.0 && counters.feed_in_red_zone_7d >= 5 {
            candidates.push((
                EmergentStateType::FoodPanic,
                EmergentStateType::FoodPanic.priority(),
            ));
        }
    }

    // trust_collapse (paranoid)
    candidate!(
        &["paranoid"],
        EmergentStateType::TrustCollapse,
        counters.paranoid_phase == "collapsed"
    );

    // apathy (empath)
    candidate!(
        &["empath"],
        EmergentStateType::Apathy,
        session_gap_hours >= 48.0
    );

    // tantrum (bold, playful)
    {
        let ids: &[&str] = &["bold", "playful"];
        if ids.contains(&personality.id.as_str()) {
            let energy = stats.get(&StatKey::Energy).copied().unwrap_or(100.0);
            if energy < 15.0 {
                candidates.push((
                    EmergentStateType::Tantrum,
                    EmergentStateType::Tantrum.priority(),
                ));
            }
        }
    }

    // contamination_crisis (pristine)
    {
        let ids: &[&str] = &["pristine"];
        if ids.contains(&personality.id.as_str()) {
            let cleanliness = stats.get(&StatKey::Cleanliness).copied().unwrap_or(100.0);
            if cleanliness < 20.0 {
                candidates.push((
                    EmergentStateType::ContaminationCrisis,
                    EmergentStateType::ContaminationCrisis.priority(),
                ));
            }
        }
    }

    // breakdown (anxious)
    {
        let ids: &[&str] = &["anxious"];
        if ids.contains(&personality.id.as_str()) {
            let low_count = StatKey::all()
                .iter()
                .filter(|&&s| stats.get(&s).copied().unwrap_or(100.0) < 30.0)
                .count();
            if low_count >= 3 {
                candidates.push((
                    EmergentStateType::Breakdown,
                    EmergentStateType::Breakdown.priority(),
                ));
            }
        }
    }

    // chaos_surge (chaotic)
    {
        let ids: &[&str] = &["chaotic"];
        if ids.contains(&personality.id.as_str())
            && is_chaos_surge_active(personality, counters, now)
        {
            candidates.push((
                EmergentStateType::ChaosSurge,
                EmergentStateType::ChaosSurge.priority(),
            ));
        }
    }

    // Pick winner (lowest priority number = highest priority)
    candidates.sort_by_key(|(_, p)| *p);
    candidates.dedup_by(|(a, _), (b, _)| a == b);
    candidates.into_iter().next().map(|(t, _)| t)
}

fn count_recent_feeds(counters: &BehavioralCounters, now: DateTime<Utc>) -> usize {
    let window_ms = 60 * 60 * 1000i64; // 1 hour in ms
    counters.recent_feed_timestamps.as_ref().map_or(0, |ts| {
        ts.iter()
            .filter(|t| {
                if let Ok(parsed) = t.parse::<DateTime<Utc>>() {
                    let diff = now.signed_duration_since(parsed).num_milliseconds();
                    diff >= 0 && diff <= window_ms
                } else {
                    false
                }
            })
            .count()
    })
}

fn is_chaos_surge_active(
    personality: &PersonalityDefinition,
    counters: &BehavioralCounters,
    now: DateTime<Utc>,
) -> bool {
    if !personality
        .special_rules
        .as_ref()
        .is_some_and(|r| r.randomize_daily_seed.unwrap_or(false))
    {
        return false;
    }

    let chaos_surge_interval_minutes = 3 * 60u64;
    let chaos_surge_min_duration = 30u64;
    let chaos_surge_max_duration = 60u64;

    let minute_in_day = (now.hour() as u64) * 60 + now.minute() as u64;
    let bucket = minute_in_day / chaos_surge_interval_minutes;
    let minute_in_bucket = minute_in_day % chaos_surge_interval_minutes;

    let date_key = now.format("%Y%m%d").to_string().parse::<u64>().unwrap_or(0);
    let seed = ((counters.chaos_daily_seed * 1_000_000_000.0) as u64)
        .max(1)
        .wrapping_add(date_key)
        .wrapping_add(bucket);

    let mut rng = seeded_rng(seed);
    let duration = chaos_surge_min_duration
        + (rng() * (chaos_surge_max_duration - chaos_surge_min_duration + 1) as f64) as u64;
    let max_start = chaos_surge_interval_minutes.saturating_sub(duration);
    let start = (rng() * (max_start + 1) as f64) as u64;

    minute_in_bucket >= start && minute_in_bucket < start + duration
}

// ── Update counters ───────────────────────────────────────────────────────────

pub fn update_counters(
    counters: &mut BehavioralCounters,
    action: &str,
    stats: &HashMap<StatKey, f64>,
    now: DateTime<Utc>,
    local_hour: i32,
    food_id: Option<&str>,
    personality: Option<&PersonalityDefinition>,
) {
    let now_str = now.to_rfc3339();
    let today = now.format("%Y-%m-%d").to_string();

    // Update stats snapshot
    let mut snap = HashMap::new();
    for &stat in StatKey::all() {
        snap.insert(
            stat.as_str().to_string(),
            stats.get(&stat).copied().unwrap_or(0.0),
        );
    }
    counters.last_stats_snapshot = Some(snap);

    // Prune recent feed timestamps
    if let Some(ref mut ts) = counters.recent_feed_timestamps {
        let window_ms = 3600 * 1000i64;
        ts.retain(|t| {
            t.parse::<DateTime<Utc>>()
                .is_ok_and(|dt| now.signed_duration_since(dt).num_milliseconds() <= window_ms)
        });
    }

    // Session gap
    if let Ok(last) = counters.last_action_timestamp.parse::<DateTime<Utc>>() {
        let gap_hours = now.signed_duration_since(last).num_seconds() as f64 / 3600.0;
        counters.session_gap_hours = gap_hours;
        if gap_hours >= 48.0 {
            increment_rolling(counters, &today, "session_gap_48h");
        }
    }
    counters.last_action_timestamp = now_str.clone();

    // Night interaction
    if action != "sync" && local_hour <= 5 {
        increment_rolling(counters, &today, "night_interaction");
    }

    // Day reset
    if counters.last_day_reset != today {
        counters.play_count_today = 0;
        counters.daily_food_log.clear();
        counters.last_day_reset = today.clone();
    }

    // Action-specific
    let hunger = stats.get(&StatKey::Hunger).copied().unwrap_or(50.0);
    let energy = stats.get(&StatKey::Energy).copied().unwrap_or(50.0);
    let health = stats.get(&StatKey::Health).copied().unwrap_or(50.0);
    let cleanliness = stats.get(&StatKey::Cleanliness).copied().unwrap_or(50.0);

    match action {
        "feed" => {
            if let Some(fid) = food_id {
                let ts = counters.recent_feed_timestamps.get_or_insert_with(Vec::new);
                ts.push(now_str.clone());
                *counters.daily_food_log.entry(fid.to_string()).or_insert(0) += 1;
                if !counters.unique_foods_tried.contains(&fid.to_string()) {
                    counters.unique_foods_tried.push(fid.to_string());
                }
            }
            if hunger < 20.0 {
                increment_rolling(counters, &today, "feed_red");
            }
            if hunger > 60.0 {
                increment_rolling(counters, &today, "feed_green");
            }
        }
        "play" => {
            counters.play_count_today += 1;
            increment_rolling(counters, &today, "play");
        }
        "sleep" => {
            if energy > 70.0 {
                increment_rolling(counters, &today, "sleep_forced");
            }
        }
        "wake" => {
            if local_hour <= 2 {
                increment_rolling(counters, &today, "night_wake");
            }
        }
        "heal" => {
            if health > 90.0 {
                increment_rolling(counters, &today, "heal_healthy");
            }
        }
        "bond" => {
            counters.total_bond_actions += 1;
            counters.bond_actions_in_phase += 1;
        }
        "sync" => {
            if cleanliness < 10.0 {
                increment_rolling(counters, &today, "filth_crisis");
            }
        }
        _ => {}
    }

    // Health neglect streak
    if health < 20.0 && action == "sync" {
        counters.consecutive_low_health_syncs += 1;
    } else if action == "heal" || (action == "sync" && health >= 20.0) {
        counters.consecutive_low_health_syncs = 0;
    }

    // Paranoid phase transition
    let trust_threshold = personality
        .and_then(|p| p.special_rules.as_ref())
        .and_then(|r| r.trust_threshold_bonds)
        .unwrap_or(10);

    if counters.paranoid_phase == "untrusted" && counters.bond_actions_in_phase >= trust_threshold {
        counters.paranoid_phase = "trusted".to_string();
        counters.bond_actions_in_phase = 0;
        counters.trusted_since = Some(now_str.clone());
    }
    if counters.paranoid_phase == "trusted" && counters.session_gap_hours >= 24.0 {
        counters.paranoid_phase = "collapsed".to_string();
    }
    if counters.paranoid_phase == "collapsed"
        && counters.bond_actions_in_phase >= trust_threshold * 2
    {
        counters.paranoid_phase = "trusted".to_string();
        counters.bond_actions_in_phase = 0;
        counters.trusted_since = Some(now_str.clone());
    }

    // Room check (sync)
    if action == "sync" {
        if let Ok(last_room) = counters.last_room_check_ts.parse::<DateTime<Utc>>() {
            let elapsed_hours = now.signed_duration_since(last_room).num_seconds() as f64 / 3600.0;
            counters.same_room_hours += elapsed_hours;
        }
        counters.last_room_check_ts = now_str.clone();
    }

    // Chaos seed update
    let chaos_today = now.format("%Y-%m-%d").to_string();
    if counters.chaos_seed_date != chaos_today {
        // Deterministic seed based on date
        let date_num = now.format("%Y%m%d").to_string().parse::<u64>().unwrap_or(0);
        let mut rng = seeded_rng(date_num);
        counters.chaos_daily_seed = rng();
        counters.chaos_seed_date = chaos_today;
    }

    // Materialize rolling counters
    materialize_rolling(counters, now);
}

fn increment_rolling(counters: &mut BehavioralCounters, date: &str, key: &str) {
    let windows = counters
        .rolling_windows
        .get_or_insert_with(Default::default);
    if let Some(bucket) = windows.daily_buckets.iter_mut().find(|b| b.date == date) {
        *bucket.counts.entry(key.to_string()).or_insert(0) += 1;
    } else {
        let mut counts = HashMap::new();
        counts.insert(key.to_string(), 1u32);
        windows
            .daily_buckets
            .push(crate::engine::types::RollingDailyBucket {
                date: date.to_string(),
                counts,
                food_counts: None,
            });
    }
}

fn rolling_count(counters: &BehavioralCounters, key: &str, days: i64, now: DateTime<Utc>) -> u32 {
    let today = now.format("%Y-%m-%d").to_string();
    counters.rolling_windows.as_ref().map_or(0, |rw| {
        rw.daily_buckets
            .iter()
            .filter(|b| {
                if let (Ok(bdate), Ok(tdate)) = (
                    chrono::NaiveDate::parse_from_str(&b.date, "%Y-%m-%d"),
                    chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d"),
                ) {
                    (tdate - bdate).num_days() < days
                } else {
                    false
                }
            })
            .map(|b| b.counts.get(key).copied().unwrap_or(0))
            .sum()
    })
}

fn materialize_rolling(counters: &mut BehavioralCounters, now: DateTime<Utc>) {
    counters.feed_in_red_zone_7d = rolling_count(counters, "feed_red", 7, now);
    counters.feed_in_green_zone_7d = rolling_count(counters, "feed_green", 7, now);
    counters.forced_sleep_count_7d = rolling_count(counters, "sleep_forced", 7, now);
    counters.heal_when_healthy_7d = rolling_count(counters, "heal_healthy", 7, now);
    counters.night_wake_count_7d = rolling_count(counters, "night_wake", 7, now);
    counters.session_gaps_over_48h_30d = rolling_count(counters, "session_gap_48h", 30, now);
    counters.filth_crisis_count_30d = rolling_count(counters, "filth_crisis", 30, now);

    // Compute play streaks
    counters.current_high_play_days = compute_current_high_play_streak(counters, now);
    counters.max_consec_high_play_days = compute_max_high_play_streak(counters, now);
    counters.night_single_interaction_days_7d = Some(compute_consec_single_night(counters, now));
}

fn compute_current_high_play_streak(counters: &BehavioralCounters, now: DateTime<Utc>) -> u32 {
    let mut streak = 0u32;
    let mut cursor = now.date_naive();
    loop {
        let date_str = cursor.format("%Y-%m-%d").to_string();
        let play_count = counters.rolling_windows.as_ref().map_or(0, |rw| {
            rw.daily_buckets
                .iter()
                .find(|b| b.date == date_str)
                .and_then(|b| b.counts.get("play"))
                .copied()
                .unwrap_or(0)
        });
        if play_count > 8 {
            streak += 1;
            cursor -= chrono::Duration::days(1);
        } else {
            break;
        }
    }
    streak
}

fn compute_max_high_play_streak(counters: &BehavioralCounters, now: DateTime<Utc>) -> u32 {
    let mut best = 0u32;
    let mut current = 0u32;
    for i in (0..7i64).rev() {
        let date = now.date_naive() - chrono::Duration::days(i);
        let date_str = date.format("%Y-%m-%d").to_string();
        let play_count = counters.rolling_windows.as_ref().map_or(0, |rw| {
            rw.daily_buckets
                .iter()
                .find(|b| b.date == date_str)
                .and_then(|b| b.counts.get("play"))
                .copied()
                .unwrap_or(0)
        });
        if play_count > 8 {
            current += 1;
            best = best.max(current);
        } else {
            current = 0;
        }
    }
    best
}

fn compute_consec_single_night(counters: &BehavioralCounters, now: DateTime<Utc>) -> u32 {
    let mut streak = 0u32;
    let mut cursor = now.date_naive();
    loop {
        let date_str = cursor.format("%Y-%m-%d").to_string();
        let night_count = counters.rolling_windows.as_ref().map_or(0, |rw| {
            rw.daily_buckets
                .iter()
                .find(|b| b.date == date_str)
                .and_then(|b| b.counts.get("night_interaction"))
                .copied()
                .unwrap_or(0)
        });
        if night_count == 1 {
            streak += 1;
            cursor -= chrono::Duration::days(1);
        } else {
            break;
        }
    }
    streak
}

// ── Paranoid restore multiplier ───────────────────────────────────────────────

pub fn get_paranoid_restore_mult(counters: &BehavioralCounters) -> f64 {
    match counters.paranoid_phase.as_str() {
        "untrusted" => 0.4,
        "trusted" => 1.8,
        "collapsed" => 0.2,
        _ => 1.0,
    }
}

// ── Peak performance ──────────────────────────────────────────────────────────

pub fn get_peak_performance_mult(
    stats: &HashMap<StatKey, f64>,
    personality: &PersonalityDefinition,
) -> (f64, f64) {
    if let Some(threshold) = personality
        .special_rules
        .as_ref()
        .and_then(|r| r.peak_performance_threshold)
    {
        if avg_stats(stats) >= threshold {
            return (2.5, 2.0);
        }
    }
    (1.0, 1.0)
}

// ── Apply action modifiers ────────────────────────────────────────────────────

pub struct ActionResult {
    pub stat_deltas: HashMap<String, f64>,
    pub xp: f64,
    pub coins: f64,
}

/// Apply personality-specific modifiers to an action result
pub fn apply_action_modifiers(
    base: ActionResult,
    action: &str,
    personality: &PersonalityDefinition,
    counters: &BehavioralCounters,
    food_id: Option<&str>,
    _active_states: &[EmergentStateType],
) -> ActionResult {
    let mut result = base;

    let is_chaotic = personality
        .special_rules
        .as_ref()
        .is_some_and(|r| r.randomize_daily_seed.unwrap_or(false));
    let chaos_restore_mult = if is_chaotic {
        get_chaos_restore_mult(counters)
    } else {
        1.0
    };
    let chaos_xp_mult = if is_chaotic {
        get_chaos_xp_mult(counters)
    } else {
        1.0
    };
    let chaos_coin_mult = if is_chaotic {
        get_chaos_coin_mult(counters)
    } else {
        1.0
    };

    // 1. Restore bonus from personality
    if let Some(action_bonus) = personality.restore_bonus.get(action) {
        for (stat, bonus) in action_bonus {
            let existing = result.stat_deltas.get(stat).copied().unwrap_or(0.0);
            result
                .stat_deltas
                .insert(stat.clone(), existing + bonus * chaos_restore_mult);
        }
    }

    // 2. Food preferences
    if action == "feed" {
        // Universal feed bonus
        if let Some(ref universal) = personality.food_preferences.universal_feed_bonus {
            for (stat, bonus) in universal {
                let existing = result.stat_deltas.get(stat).copied().unwrap_or(0.0);
                result.stat_deltas.insert(stat.clone(), existing + bonus);
            }
        }

        if let Some(fid) = food_id {
            if personality
                .special_rules
                .as_ref()
                .is_some_and(|r| r.food_boredom_enabled.unwrap_or(false))
            {
                // Adventurer: first time = loveBonus, second time = nothing, third+ = hatePenalty
                let count_today = counters.daily_food_log.get(fid).copied().unwrap_or(0);
                let source = if count_today == 0 {
                    &personality.food_preferences.love_bonus
                } else if count_today >= 2 {
                    &personality.food_preferences.hate_penalty
                } else {
                    // count_today == 1: neutral (no bonus/penalty)
                    return result; // short circuit adding food bonuses
                };
                for (stat, bonus) in source {
                    let existing = result.stat_deltas.get(stat).copied().unwrap_or(0.0);
                    result.stat_deltas.insert(stat.clone(), existing + bonus);
                }
            } else if personality
                .food_preferences
                .loved_ids
                .iter()
                .any(|id| id == fid)
            {
                for (stat, bonus) in &personality.food_preferences.love_bonus {
                    let existing = result.stat_deltas.get(stat).copied().unwrap_or(0.0);
                    result.stat_deltas.insert(stat.clone(), existing + bonus);
                }
            } else if personality
                .food_preferences
                .hated_ids
                .iter()
                .any(|id| id == fid)
            {
                for (stat, penalty) in &personality.food_preferences.hate_penalty {
                    let existing = result.stat_deltas.get(stat).copied().unwrap_or(0.0);
                    result.stat_deltas.insert(stat.clone(), existing + penalty);
                }
            }
        }
    }

    // 3. XP multipliers
    if personality
        .special_rules
        .as_ref()
        .is_some_and(|r| r.flat_xp_from_play.unwrap_or(false))
        && action == "play"
    {
        result.xp = STOIC_FLAT_PLAY_XP;
    } else {
        let xp_mult = personality
            .xp_multipliers
            .get(action)
            .copied()
            .unwrap_or(1.0);
        let total_xp_mult = clamp(xp_mult * chaos_xp_mult, 0.1, 4.0);
        result.xp = (result.xp * total_xp_mult).round();
    }

    // 4. Coin multipliers
    let coin_mult = personality
        .coin_multipliers
        .get(action)
        .copied()
        .unwrap_or(1.0);
    let total_coin_mult = clamp(coin_mult * chaos_coin_mult, 0.0, 3.0);
    result.coins = (result.coins * total_coin_mult).round();

    result
}

// ── Create default counters ───────────────────────────────────────────────────

pub fn create_default_counters() -> BehavioralCounters {
    BehavioralCounters::default()
}
