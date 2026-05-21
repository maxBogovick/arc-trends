# Personality Character Change Mechanism

> Date: 2026-05-21  
> Purpose: describe how character changes happen, what affects them, and what proves the current behavior.  
> Scope: TypeScript personality core, Rust backend port, command replay, and simulation artifacts.

---

## 1. Short Answer

Character is not changed directly by setting `pet.personality`. The engine changes a six-dimensional `traitVector`; formation and later evolution choose the nearest personality zone from that vector.

The six traits are:

| Trait | Meaning in the engine |
|---|---|
| `vitality` | energy, activity, force of movement |
| `sociality` | attachment, openness to contact |
| `order` | stability, cleanliness, structured routine |
| `appetite` | food orientation and feeding patterns |
| `caution` | anxiety, carefulness, defensiveness |
| `curiosity` | exploration, novelty, learning |

The important current rule:

> User behavior changes the vector. The vector decides formation/evolution. The starting personality label does not decide formation by itself.

This is intentional. Otherwise the user could pick a starting label and silently lock the result before playing.

---

## 2. Core Data Model

### 2.1 Trait vector

The primary state is `pet.traitVector`.

Source:

- TypeScript: `packages/personality-core/src/TraitEvolutionEngine.ts`
- Rust: `backend/src/engine/trait_evolution.rs`

New pets start from a neutral vector unless a legacy vector exists:

```ts
{ vitality: 50, sociality: 50, order: 50, appetite: 50, caution: 50, curiosity: 50 }
```

Legacy rebirth can blend a previous life vector into the neutral start through `createInitialTraitVector(legacyVector, legacyCoefficient)`.

### 2.2 Personality home zones

Each personality has a home position and radius in six-dimensional trait space.

Example:

| Personality | Home vector summary |
|---|---|
| `drowsy` | very low vitality and curiosity; moderate order |
| `pristine` | high order and caution; moderate sociality |
| `bold` | high vitality; very low caution |
| `empath` | very high sociality |
| `foodie` | very high appetite |

Source of truth:

- TypeScript: `packages/personality-core/src/personalityTraitMap.ts`
- Rust parity copy: `backend/src/engine/trait_evolution.rs`

Rust was fixed to match the TypeScript map. This matters because the old Rust map placed `drowsy` too close to neutral, which could make the server form "Сонливый" too often.

Proof:

- Rust test: `personality_positions_match_typescript_trait_map`
- Rust test: `neutral_formation_vector_is_not_closest_to_drowsy_after_parity_fix`

---

## 3. How One Command Changes Character

The command path is:

1. User performs a command: `feed`, `play`, `bathe`, `bond`, `sleep`, `wake`, `heal`, `use_item`, etc.
2. Command handler applies gameplay outcome: stats, XP, coins, blockers.
3. Command handler resolves a registered influence, for example:
   - `feed` -> `action:feed`
   - `play` -> `action:play`
   - `sleep` -> `action:sleep_natural` or `action:sleep_forced`
   - `wake` -> lifecycle hook `action:wake_natural` or `action:wake_early`
   - `use_item:puzzle` -> `item:puzzle`
4. Influence changes trait deltas.
5. Deltas are clamped by daily trait budget.
6. Deltas are smoothed into the trait vector.
7. If formation is incomplete, formation progress advances.
8. If formation progress reaches the threshold, formation chooses the nearest personality zone.

Formula, simplified:

```text
rawDelta = influenceDelta
  * intensityRules
  * globalIntensityMultiplier
  * contextSensitivityMultiplier

appliedDelta = clamp(rawDelta, dailyRemainingBudget)

traitVector[key] += appliedDelta
  * SMOOTHING_ALPHA
  * preFormationSensitivityMultiplier
```

Current constants:

| Constant | Value | Meaning |
|---|---:|---|
| `SMOOTHING_ALPHA` | `0.08` | How much of an applied influence reaches the vector per command |
| `PRE_FORMATION_SENSITIVITY_MULTIPLIER` | `5.0` | Before formation, commands move the vector five times as strongly |
| `POST_FORMATION_ADAPTATION_MULTIPLIER` | `4.0` | After formation, applied user behavior can still move the mature vector |
| `FORMATION_THRESHOLD` | `200` | Formation completes when weighted influence volume reaches this |
| `REGRESSION_RATE` | `0.02` | After formation, sync slowly pulls vector toward current personality home |
| `STABILITY_SYNCS` | `72` | Evolution proposal requires stable time in the target zone |
| `HYSTERESIS` | `8` | Prevents evolution proposals from tiny boundary drift |
| `BEHAVIOR_PROFILE_EVOLUTION_THRESHOLD` | `28` | Minimum behavioral evidence for mature evolution once enough samples exist |
| `EVOLUTION_READINESS_THRESHOLD` | `100` | Accumulated readiness needed for an earlier proposal before 72 strict syncs |
| `BEHAVIOR_TARGET_DEPTH_BONUS` | `0.45` | Limited bonus that lets behavior-supported targets compete with nearest geometry |

Proof:

- TS test: `applyInfluence clamps daily budget and smooths vector`
- TS test: `global intensity multiplier scales raw influence before smoothing`
- TS test: `pre-formation command path is more sensitive than mature regression path`
- Rust test: `pre_formation_command_path_is_more_sensitive_than_formed_path`

---

## 4. What Affects Character Changes

### 4.1 Registered influence deltas

The base influence registry defines how each action moves the vector.

Examples:

| Influence | Trait effect |
|---|---|
| `action:feed` | appetite up, sociality slightly up |
| `action:play` | vitality up, curiosity up, order down |
| `action:bathe` | order up, caution slightly down |
| `action:bond` | sociality up, caution down, trauma down |
| `action:sleep_natural` | vitality down, order up |
| `action:sleep_forced` | vitality down, order down, caution up, trauma up |
| `action:wake_early` | order down, caution up, vitality up, trauma up |
| `item:puzzle` | curiosity up, order up, vitality down |

Source:

- `packages/personality-pet-preset/src/influenceRegistry.ts`
- `backend/src/engine/influence_registry.rs`

Proof:

- TS tests around command influences in `tests/personalityEvolution.test.ts`
- Rust parity fixture: `backend/tests/fixtures/ts_parity_core.json`
- Rust test: `rust_engine_matches_ts_core_parity_fixtures`

### 4.2 Daily trait budget

Each trait has a daily budget. This prevents one repeated action from moving the vector without limit in a single day.

Current budgets:

| Trait | Daily budget |
|---|---:|
| `vitality` | 12 |
| `sociality` | 8 |
| `order` | 6 |
| `appetite` | 10 |
| `caution` | 8 |
| `curiosity` | 10 |

Proof:

- TS test: `applyInfluence clamps daily budget and smooths vector`

### 4.3 Context sensitivity

The same action can now matter more or less depending on the pet's current needs.

Examples:

| Situation | Effect |
|---|---|
| Feed when hunger <= 30 | `action:feed` influence is stronger |
| Feed when hunger >= 90 | `action:feed` influence is weaker |
| Play when energy <= 25 | `action:play` influence is weaker |
| Play when happiness <= 45 and energy >= 35 | `action:play` influence is stronger |
| Natural sleep when energy <= 30 | `action:sleep_natural` influence is stronger |
| Forced sleep when energy >= 80 | `action:sleep_forced` influence is stronger |
| Bathe when cleanliness <= 35 | `action:bathe` influence is stronger |
| Bathe when cleanliness >= 90 | `action:bathe` influence is weaker |
| Heal when health <= 45 | `action:heal` influence is stronger |
| Heal when health >= 90 | `action:heal` influence is weaker |
| Bond when bond <= 45 | `action:bond` influence is stronger |

Why this is needed:

Without context sensitivity, `feed` at 20 hunger and `feed` at 90 hunger looked almost identical to character formation. That made the system less responsive to the user's timing and care quality.

Proof:

- TS test: `action influence strength responds to user timing and pet needs`
- Rust test: `action_influence_strength_responds_to_pet_needs`

### 4.4 Pre-formation sensitivity

Before `formationComplete`, the vector moves faster. This makes early care patterns visible sooner and shortens the "nothing seems to matter" phase.

Current multiplier:

```text
PRE_FORMATION_SENSITIVITY_MULTIPLIER = 5.0
POST_FORMATION_ADAPTATION_MULTIPLIER = 4.0
```

What it changes:

- It increases trait-vector movement before formation.
- It does not make the starting personality label decide the result.
- It does not increase formation progress itself; progress still uses the budgeted influence volume.

Proof:

- TS test: `pre-formation command path is more sensitive than mature regression path`
- Rust test: `pre_formation_command_path_is_more_sensitive_than_formed_path`
- Monte Carlo: average formation day became faster:
  - `common`: 23 -> 19
  - `balanced`: 21 -> 18
  - `singularity_hunt`: 16 -> 14

### 4.5 Influence cooldowns

Some influences cannot apply every command. Example: `bond` has a cooldown. The action can still happen, but the trait influence can be skipped until enough syncs pass.

Proof:

- TS test: `personality command handler gates influences with serializable cooldown state`
- TS test: `personality replay advances sync buckets and preserves cooldown math`
- Rust test: `influence_cooldown_blocks_repeated_bond_until_sync_advances`

### 4.6 System and environment influences

Some influences are not direct button actions. They happen on sync if conditions match.

Examples:

| Influence | Trigger |
|---|---|
| `system:inactivity_long` | session gap >= 48 hours |
| `system:consistent_week` | long good-care streak |
| `system:starvation` | hunger below threshold |
| `env:same_room_48h` | same room for 48 hours |

Proof:

- TS test: `personality command sync applies eligible system influences from registry`
- TS test: `personality command sync records skipped system influence conditions and cooldowns`
- TS test: `personality command sync applies eligible environment influences from registry`

### 4.7 Behavior profile

The engine now records a separate `behaviorProfile` in addition to `traitVector`.

This is important because the trait vector describes where the character currently is, while `behaviorProfile` describes what the player has repeatedly been doing.

Current behavior axes:

| Axis | Typical evidence |
|---|---|
| `care` | feeding, bathing, healing, rescue-style care |
| `play` | play actions and playful exploration |
| `social` | bonding and social items such as `music_box` |
| `order` | bathing, natural sleep, ordered routines |
| `exploration` | new rooms, adventure items, puzzle/magic items |
| `disruption` | forced sleep and early wake patterns |
| `recovery` | healing, trauma recovery, recovery items |

The profile decays slowly over time (`BEHAVIOR_PROFILE_DECAY_PER_DAY = 0.96`) so recent behavior matters more than stale history, but old habits do not disappear instantly.

Why this is needed:

Without `behaviorProfile`, a temporary stat or vector spike could look like a real character shift. With `behaviorProfile`, mature evolution requires both:

- trait-vector movement toward a new zone;
- repeated behavior that semantically supports that target.

Proof:

- TS test: `personality command records long-term behavior profile separately from traits`
- TS test: `checkEvolution requires behavior evidence once behavior profile is established`
- TS test: `checkEvolution accepts stable target only when behavior profile supports it`
- Rust test: `behavior_profile_records_command_evidence_separately_from_traits`
- Rust test: `evolution_requires_matching_behavior_profile_after_evidence_window`

### 4.8 Sleep/wake lifecycle

Sleep and wake affect more than stats.

Important cases:

| Case | Character impact |
|---|---|
| Natural sleep | tends toward lower vitality and higher order |
| Forced sleep while energized | stronger forced-sleep influence |
| Natural wake after >= 4 hours | resets confused variance and reduces trauma through wake influence |
| Early wake | raises caution/trauma and lowers order |

Rust and TS now both apply wake lifecycle influences.

Proof:

- TS test: `personality command forced sleep records sleep start and energized context influence`
- TS test: `personality command natural wake resets confused only after four hours`
- TS test: `personality command early wake keeps confused variance and applies wake trauma`
- Rust test: `early_wake_applies_wake_early_lifecycle_influence`
- Rust test: `natural_wake_applies_wake_natural_lifecycle_influence`

---

## 5. Formation

Formation happens while `formationComplete === false`.

Formation progress is increased by the absolute amount of budgeted trait deltas, multiplied by category weight.

Category weights:

| Category | Weight |
|---|---:|
| `action` | 1.0 |
| `item` | 1.5 |
| `training` | 2.0 |
| `discipline` | 1.5 |
| `cosmetic` | 1.2 |
| `environment` | 0.8 |
| `social` | 2.0 |
| `system` | 0.0 |

When progress reaches `FORMATION_THRESHOLD = 200`, the engine chooses the personality with the highest `depthOfImmersion()` for the current trait vector.

Important design rule:

> Pre-formation `pet.personality` is treated as a placeholder label. It does not enable personality-specific modifiers, passives, blockers, or `personality_is` intensity.

Why:

If a placeholder personality affected behavior before formation, the selected starting label would bias the result too strongly. The current design makes user actions and care context responsible for the result.

Proof:

- TS invariant: `pre-formation sync is label-invariant for every personality id`
- TS invariant: `pre-formation personality_is intensity rules are ignored`
- TS invariant: `same formation history forms the same personality regardless of placeholder label`
- TS test: `formation completes at threshold and selects nearest personality`
- Rust test: `neutral_formation_vector_is_not_closest_to_drowsy_after_parity_fix`

Current honest limitation:

> Identical pre-formation command histories still form the same personality. This is expected. The engine is sensitive to behavior and context, not to random starting labels.

---

## 6. Evolution After Formation

After formation, the current personality is no longer just a placeholder.

On sync:

1. Regression pulls the vector slightly toward the current personality home.
2. The engine checks whether the vector left the current zone.
3. It ranks candidate personalities by trait-vector depth, with a limited behavior-supported depth bonus.
4. If a candidate is inside or near a target zone and behavior evidence supports it, evolution readiness accumulates.
5. If readiness reaches the threshold, or the pet stays strictly inside the target zone for the full stability window, it creates an evolution proposal.
6. The user can accept or reject the proposal.

Guardrails:

| Mechanism | Purpose |
|---|---|
| `REGRESSION_RATE = 0.02` | prevents tiny noise from immediately changing personality |
| `STABILITY_SYNCS = 72` | requires stable target-zone presence |
| `HYSTERESIS = 8` | prevents boundary flicker |
| `BEHAVIOR_PROFILE_EVOLUTION_MIN_SAMPLES = 24` | avoids judging behavior before there is enough evidence |
| `EVOLUTION_READINESS_GAIN_PER_CONFIRMED_SYNC = 35` | lets repeated confirmed behavior reach proposal before 72 strict syncs |
| `NEAR_TARGET_READINESS_MARGIN = 0.25` | allows behavior-confirmed near-zone drift to count gradually |
| `BEHAVIOR_TARGET_DEPTH_BONUS = 0.45` | lets behavior-supported candidates compete with purely nearest geometry |
| `voidSyncs` | tracks being outside all meaningful zones |

Proof:

- TS test: `applyRegression moves exactly 2 percent toward personality home`
- TS test: `checkEvolution creates proposal after stable target zone`
- TS test: `checkEvolution requires behavior evidence once behavior profile is established`
- TS test: `checkEvolution accepts stable target only when behavior profile supports it`
- TS test: `checkEvolution can accumulate readiness across confirmed target-zone syncs`
- TS test: `checkEvolution does not accumulate readiness from unsupported behavior spikes`
- TS test: `checkEvolution respects hysteresis boundary before proposing`
- TS test: `checkEvolution clears target when pet returns to current zone`
- TS test: `acceptEvolution records stable evolution and rare memory`
- TS test: `rejectEvolution clears proposal without changing personality`
- Rust test: `evolution_readiness_accumulates_before_full_stability_window`

---

## 7. Special Long-Term States

### 7.1 Shadow form

Trauma can push the pet into `shadow_form`. Recovery requires catharsis progress through care actions such as `bond` and `heal`.

Proof:

- TS test: `shadow form enters from trauma and exits through catharsis cooldown`
- TS test: `personality commands advance catharsis recovery in shadow form`
- TS test: `repeated care actions reduce trauma even when trait influence is on cooldown`

### 7.2 Singularity

Singularity is a rare state when the pet is simultaneously near several personality zones. It requires sustained multi-zone proximity, then collapses into one active zone.

Proof:

- TS test: `singularity intercepts checkEvolution and collapses into one active zone`
- TS test: `personality command replay uses deterministic rng for singularity collapse`
- Balance report: `docs/reports/personality_balance_report.md`

---

## 8. TypeScript / Rust Parity

There are two implementations:

| Layer | Role |
|---|---|
| TypeScript personality core | primary reusable engine and frontend/offline command logic |
| Rust backend | server-side authoritative command replay and persistence path |

Current parity guarantees:

| Area | Proof |
|---|---|
| Personality home vectors and radii match TS | `personality_positions_match_typescript_trait_map` |
| Neutral vector no longer maps closest to `drowsy` | `neutral_formation_vector_is_not_closest_to_drowsy_after_parity_fix` |
| Command influence fixture parity | `rust_engine_matches_ts_core_parity_fixtures` |
| Wake lifecycle parity | `early_wake_applies_wake_early_lifecycle_influence`, `natural_wake_applies_wake_natural_lifecycle_influence` |
| Context sensitivity parity | `action_influence_strength_responds_to_pet_needs` in TS and Rust |
| Pre-formation sensitivity parity | `pre-formation command path...` in TS and `pre_formation_command_path...` in Rust |
| Behavior profile and evolution readiness parity | TS evolution tests and Rust `behavior_profile...`, `evolution_requires...`, `evolution_readiness...` tests |

---

## 9. Observability And Player Explanation

The client command path now emits character-specific events and stores telemetry through the existing explainability log.

New command events:

| Event | Meaning |
|---|---|
| `behavior_profile_changed` | A command changed long-term behavior evidence, for example social/care/order/exploration |
| `evolution_readiness_changed` | Mature character drift accumulated or decayed readiness toward a target personality |

Every persisted explainability record can now include `personalityTelemetry`:

| Field | Use |
|---|---|
| `personalityId` | current character at the time of the command result |
| `formationComplete` / `formationProgress` | separates formation telemetry from mature evolution telemetry |
| `currentTargetZone` | current geometric target zone, if any |
| `evolutionReadiness` / `evolutionReadinessTarget` | how close the pet is to a proposed mature change |
| `dominantBehaviorAxis` | strongest long-term behavior signal |
| `traitDrift` | per-command trait-vector deltas |
| `behaviorDrift` | per-command behavior-profile deltas |
| `eventTypes` | compact event taxonomy for analytics aggregation |
| `evolutionProposalTarget` | active proposal target, if one exists |

Player-facing explanation is produced by `explainCommandRecord()`:

- `personalitySummary` gives a short sentence such as "Поведение двигает характер к paranoid: 35%".
- `personalityDetails` lists concrete reasons, for example behavior-profile changes or readiness movement.
- Existing stat, XP, coin, modifier, memory, and evolution details remain available.

Proof:

- TS test: `explainability records personality telemetry and player-facing character reasons`
- TS test: `explainability telemetry captures evolution readiness movement`
- TS test: `MockApi persists local save and sync queue without gameplay logic`
- Package typecheck: `tsc -p tsconfig.packages.json`

---

## 10. Proof Commands

These commands were run after the current personality-engine changes:

```bash
npm test
cargo test
cargo check
cargo clippy -- -D warnings
npm run simulate:montecarlo
```

Observed results:

| Command | Result |
|---|---|
| `npm test` | passed |
| `cargo test` | passed |
| `cargo check` | passed |
| `cargo clippy -- -D warnings` | passed |
| `npm run simulate:montecarlo` | passed |

Monte Carlo artifact:

- `docs/reports/monte_carlo_report.md`

Current Monte Carlo acceptance summary:

| Check | Observed result |
|---|---|
| Stable everyday play does not churn formed character | PASS; `common`, `balanced`, `random_noise` max evolution is `0%` |
| Sustained post-formation behavior can change character | PASS; `post_adventure_shift`, `post_food_shift`, `post_social_shift`, `post_clean_order_shift` average evolution is `14%` |
| Behavior profile records expected axes | PASS for exploration, care, social, order, disruption, recovery scenarios |
| Product readiness gate | PASS |

Interpretation:

- The engine no longer collapses ordinary play into constant mature evolution.
- Long-running post-formation behavior can now produce character evolution proposals.
- Disruption and recovery scenarios are tracked as behavior profiles and special-state pressure; they are not required to become ordinary personality evolution in the acceptance gate.

---

## 11. What Is Proven vs Not Yet Proven

### Proven

| Claim | Evidence |
|---|---|
| Commands move the trait vector through registered influences | TS command tests, Rust parity fixture |
| Daily budgets clamp influence volume | `applyInfluence clamps daily budget and smooths vector` |
| Pre-formation movement is stronger than formed movement | TS and Rust pre-formation sensitivity tests |
| Action timing/context changes influence strength | TS and Rust context sensitivity tests |
| Starting placeholder label does not decide formation | invariant suite |
| Formation chooses nearest personality home | formation test and home-map tests |
| Rust no longer biases neutral formation toward `drowsy` | Rust neutral-vector test |
| Rust and TS personality maps are synchronized | Rust map parity test |
| Wake lifecycle changes character in both implementations | TS and Rust wake tests |
| Formation is faster after sensitivity changes | Monte Carlo report |
| Mature character can react to sustained post-formation behavior | Monte Carlo acceptance matrix, TS/Rust evolution readiness tests |
| Stable/common behavior does not churn mature personality | Monte Carlo acceptance matrix |
| Behavior profile captures semantic behavior axes | Monte Carlo behavior profile matrix, TS/Rust behavior profile tests |
| Character changes are observable in command telemetry | Explainability telemetry tests |
| Player-facing explanations can say why character drift happened | `personalitySummary` / `personalityDetails` tests |

### Not Yet Proven

| Claim | Status |
|---|---|
| Exact live production distribution across real players | Not proven until telemetry exists |
| Current numeric multipliers are perfectly balanced | Not proven; current values are conservative and regression-tested |
| Final UI placement for the explanation surfaces | Not proven here; API/log fields are ready, visual placement is product UI work |
| Remote LiveOps balance updates are production-ready | Not proven; validation exists, full telemetry/update pipeline does not |

---

## 12. Practical Debug Checklist

When character formation looks wrong:

1. Inspect `traitVector`.
2. Compute nearest personality homes using `depthOfImmersion()`.
3. Check whether the pet is pre-formation or formed.
4. Check `dailyTraitBudget`; the action may be budget-clamped.
5. Check `influenceCooldowns`; the action may have skipped trait influence.
6. Check the pet's stats before the action; context sensitivity may strengthen or weaken the influence.
7. Check `formationProgress`; formation may not have completed yet.
8. Check `behaviorProfile`; mature evolution can be blocked if behavior does not support the candidate.
9. Check `evolutionReadiness` and `evolutionReadinessTarget`; near-zone behavior can accumulate readiness before 72 strict target syncs.
10. Check the latest `ExplainabilityLog` record and its `personalityTelemetry`.
11. Check `personalitySummary` / `personalityDetails` for the player-facing reason.
12. Check whether TS and Rust replay produce the same result through the parity fixture.
13. Re-run:

```bash
npm test
cargo test
cargo check
cargo clippy -- -D warnings
npm run simulate:montecarlo
```

---

## 13. Current Design Position

The engine is now meaningfully more sensitive to user behavior than before because:

- early care has stronger vector impact;
- action timing matters through pet stats;
- long-term behavior is recorded separately from raw trait drift;
- mature evolution uses behavior evidence and accumulated readiness, not only a strict 72-sync geometric wait;
- command results now expose telemetry and player-facing explanations for character drift;
- sleep/wake lifecycle affects long-term traits;
- server and client use the same core mechanics;
- tests prove the sensitive paths directly.

The remaining product work is not the core character-change mechanism itself. The next layer is visual placement and production analytics plumbing: decide where in the UI to show the existing explanation fields, forward telemetry samples to a backend analytics sink, and tune numeric balance against real cohorts.
