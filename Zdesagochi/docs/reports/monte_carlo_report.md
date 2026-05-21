# Personality Engine Monte Carlo Report

Generated at: 2026-05-21T05:01:34.111Z
Runs per personality/style: 20
Simulation days: 120

## Summary by style (averaged across all personalities)

| Style | Formation% | Avg Formation Day | Evolution% | Avg Evolution Day | Target-zone syncs/run | Target stalls/run | Shadow Entry% | Shadow Recovery% | Singularity% | Avg Memories |
|---|---|---|---|---|---|---|---|---|---|---|
| common | 100% | 17.8 | 0% | -1.0 | 0.0 | 0.0 | 0% | 0% | 0% | 1.0 |
| random_noise | 100% | 31.3 | 0% | -1.0 | 0.0 | 0.0 | 31% | 1% | 0% | 1.0 |
| neglect | 0% | -1.0 | 0% | -1.0 | 0.0 | 0.0 | 100% | 100% | 0% | 1.0 |
| heavy | 0% | -1.0 | 0% | -1.0 | 0.0 | 0.0 | 100% | 100% | 0% | 1.0 |
| food_only | 0% | -1.0 | 0% | -1.0 | 0.0 | 0.0 | 100% | 100% | 0% | 1.0 |
| balanced | 100% | 21.0 | 0% | -1.0 | 0.0 | 0.0 | 0% | 0% | 0% | 1.0 |
| shadow_recovery | 100% | 96.0 | 0% | -1.0 | 0.0 | 0.0 | 0% | 0% | 0% | 1.0 |
| singularity_hunt | 100% | 16.0 | 0% | -1.0 | 0.0 | 0.0 | 82% | 78% | 0% | 1.8 |
| post_adventure_shift | 100% | 0.0 | 44% | 10.4 | 19.3 | 11.0 | 19% | 19% | 0% | 1.1 |
| post_food_shift | 100% | 0.0 | 0% | -1.0 | 0.0 | 0.0 | 25% | 24% | 0% | 0.3 |
| post_social_shift | 100% | 0.0 | 6% | 3.3 | 23.4 | 23.1 | 24% | 24% | 0% | 0.5 |
| post_clean_order_shift | 100% | 0.0 | 6% | 0.8 | 3.7 | 3.4 | 100% | 100% | 0% | 1.1 |
| post_disruption_shift | 100% | 0.0 | 0% | -1.0 | 16.5 | 14.5 | 100% | 100% | 0% | 1.1 |
| post_recovery_shift | 100% | 0.0 | 0% | -1.0 | 0.0 | 0.0 | 31% | 31% | 0% | 0.4 |

## Behavior profile by style

| Style | Dominant Axis | Avg Behavior Axes |
|---|---|---|
| common | social (48%) | care:35, play:26, social:40, order:15, exploration:26, disruption:11, recovery:0 |
| random_noise | exploration (100%) | care:1, play:5, social:1, order:1, exploration:19, disruption:0, recovery:0 |
| neglect | care (100%) | care:11, play:0, social:3, order:0, exploration:0, disruption:0, recovery:0 |
| heavy | play (100%) | care:2, play:8, social:0, order:0, exploration:4, disruption:0, recovery:0 |
| food_only | care (100%) | care:9, play:0, social:2, order:0, exploration:0, disruption:0, recovery:0 |
| balanced | social (100%) | care:14, play:49, social:50, order:3, exploration:24, disruption:0, recovery:0 |
| shadow_recovery | care (100%) | care:23, play:0, social:20, order:0, exploration:0, disruption:0, recovery:17 |
| singularity_hunt | exploration (100%) | care:1, play:12, social:1, order:1, exploration:50, disruption:0, recovery:0 |
| post_adventure_shift | exploration (100%) | care:47, play:61, social:12, order:0, exploration:76, disruption:0, recovery:0 |
| post_food_shift | care (81%) | care:65, play:0, social:16, order:0, exploration:1, disruption:0, recovery:1 |
| post_social_shift | social (100%) | care:10, play:0, social:48, order:0, exploration:0, disruption:0, recovery:1 |
| post_clean_order_shift | order (100%) | care:19, play:0, social:0, order:78, exploration:6, disruption:0, recovery:0 |
| post_disruption_shift | disruption (100%) | care:0, play:0, social:0, order:0, exploration:0, disruption:32, recovery:0 |
| post_recovery_shift | recovery (100%) | care:7, play:0, social:0, order:0, exploration:1, disruption:0, recovery:14 |

## Acceptance matrix

| Check | Styles | Expected | Observed | Result |
|---|---|---|---|---|
| Stable everyday play does not churn formed character | common, balanced, random_noise | max evolution <= 5% | max evolution 0% | PASS |
| Sustained post-formation behavior can change character | post_adventure_shift, post_food_shift, post_social_shift, post_clean_order_shift | average evolution >= 10% | average evolution 14% | PASS |
| post_adventure_shift records expected behavior profile | post_adventure_shift | dominant axis exploration | dominant axis exploration; exploration:76 | PASS |
| post_food_shift records expected behavior profile | post_food_shift | dominant axis care | dominant axis care; care:65 | PASS |
| post_social_shift records expected behavior profile | post_social_shift | dominant axis social | dominant axis social; social:48 | PASS |
| post_clean_order_shift records expected behavior profile | post_clean_order_shift | dominant axis order | dominant axis order; order:78 | PASS |
| post_disruption_shift records expected behavior profile | post_disruption_shift | dominant axis disruption | dominant axis disruption; disruption:32 | PASS |
| post_recovery_shift records expected behavior profile | post_recovery_shift | dominant axis recovery | dominant axis recovery; recovery:14 | PASS |

Product readiness gate: **PASS**

## Calibration readout

- post_adventure_shift: evolution 44%, target-zone syncs/run 19.3, target stalls/run 11.0, behavior axes care:47, play:61, social:12, order:0, exploration:76, disruption:0, recovery:0.
- post_food_shift: evolution 0%, target-zone syncs/run 0.0, target stalls/run 0.0, behavior axes care:65, play:0, social:16, order:0, exploration:1, disruption:0, recovery:1.
- post_social_shift: evolution 6%, target-zone syncs/run 23.4, target stalls/run 23.1, behavior axes care:10, play:0, social:48, order:0, exploration:0, disruption:0, recovery:1.
- post_clean_order_shift: evolution 6%, target-zone syncs/run 3.7, target stalls/run 3.4, behavior axes care:19, play:0, social:0, order:78, exploration:6, disruption:0, recovery:0.
- post_disruption_shift: evolution 0%, target-zone syncs/run 16.5, target stalls/run 14.5, behavior axes care:0, play:0, social:0, order:0, exploration:0, disruption:32, recovery:0.
- post_recovery_shift: evolution 0%, target-zone syncs/run 0.0, target stalls/run 0.0, behavior axes care:7, play:0, social:0, order:0, exploration:1, disruption:0, recovery:14.

## Per-personality detail (common play style)

| Personality | Formation% | Avg Day | Evolution% | Avg Evolution Day | Target-zone syncs/run | Target stalls/run | Dominant Behavior | Confused/120d | Memories |
|---|---|---|---|---|---|---|---|---|---|
| playful | 100% | 17.5 | 0% | -1.0 | 0.0 | 0.0 | social (55%) | 10.2 | 1.0 |
| drowsy | 100% | 16.9 | 0% | -1.0 | 0.0 | 0.0 | care (45%) | 2.7 | 1.0 |
| foodie | 100% | 17.8 | 0% | -1.0 | 0.0 | 0.0 | care (65%) | 3.2 | 1.1 |
| bold | 100% | 17.1 | 0% | -1.0 | 0.0 | 0.0 | social (50%) | 2.2 | 1.0 |
| zen | 100% | 18.5 | 0% | -1.0 | 0.0 | 0.0 | care (45%) | 10.9 | 1.1 |
| anxious | 100% | 17.4 | 0% | -1.0 | 0.0 | 0.0 | care (45%) | 3.9 | 1.1 |
| feral | 100% | 17.8 | 0% | -1.0 | 0.0 | 0.0 | care (65%) | 3.2 | 1.1 |
| sage | 100% | 19.1 | 0% | -1.0 | 0.0 | 0.0 | social (50%) | 12.9 | 1.0 |
| pristine | 100% | 17.5 | 0% | -1.0 | 0.0 | 0.0 | social (55%) | 10.2 | 1.0 |
| empath | 100% | 19.3 | 0% | -1.0 | 0.0 | 0.0 | care (40%) | 10.1 | 1.1 |
| greedy | 100% | 18.3 | 0% | -1.0 | 0.0 | 0.0 | care (50%) | 6.1 | 1.0 |
| melancholic | 100% | 15.6 | 0% | -1.0 | 0.0 | 0.0 | social (70%) | 1.7 | 1.0 |
| chaotic | 100% | 17.5 | 0% | -1.0 | 0.0 | 0.0 | social (50%) | 16.1 | 1.0 |
| stoic | 100% | 19.1 | 0% | -1.0 | 0.0 | 0.0 | social (50%) | 12.9 | 1.0 |
| adventurer | 100% | 17.4 | 0% | -1.0 | 0.0 | 0.0 | care (45%) | 3.9 | 1.1 |
| paranoid | 100% | 17.5 | 0% | -1.0 | 0.0 | 0.0 | social (55%) | 10.2 | 1.0 |

## Final personality distribution (common play style, % of runs ending as each personality)

| Start \ End | playful | foodie | pristine | sage |
|---|---|---|---|---|
| playful | 55% | 35% | 10% | 0% |
| drowsy | 45% | 40% | 10% | 5% |
| foodie | 35% | 60% | 0% | 5% |
| bold | 45% | 45% | 5% | 5% |
| zen | 40% | 45% | 15% | 0% |
| anxious | 40% | 50% | 10% | 0% |
| feral | 35% | 60% | 0% | 5% |
| sage | 45% | 35% | 10% | 10% |
| pristine | 55% | 35% | 10% | 0% |
| empath | 25% | 30% | 25% | 20% |
| greedy | 35% | 45% | 10% | 10% |
| melancholic | 70% | 30% | 0% | 0% |
| chaotic | 50% | 25% | 5% | 20% |
| stoic | 45% | 35% | 10% | 10% |
| adventurer | 40% | 50% | 10% | 0% |
| paranoid | 55% | 35% | 10% | 0% |
