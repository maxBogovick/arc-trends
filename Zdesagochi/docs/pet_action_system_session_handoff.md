# Pet Action System Session Handoff

Last updated: 2026-05-23.

Use this file to continue pet action/personality work in a new session.

Primary architecture map:

- `docs/personality_engine_llm_knowledge_base.md`
- `docs/pet_action_system_architecture.md`
- `docs/pet_action_system_action_template.md`
- `docs/pet_action_system_roadmap.md`

## Current Status

The action system has two implemented production slices.

The important rule remains:

```text
UI intent -> command -> engine result -> personality evidence -> persistence -> replay -> explanation
```

Do not add UI-only pet actions. New actions must enter the personality engine as commands or command variants and must preserve TypeScript/Rust behavior where backend replay applies them.

## Implemented Slice 1

### `play:active`

Purpose: energetic play.

Implemented behavior:

- stronger immediate happiness;
- higher energy cost;
- trait direction: vitality up, curiosity up, order down;
- behavior evidence: play plus slight disruption.

### `play:puzzle`

Purpose: curious/patient play.

Implemented behavior:

- lower energy cost than active play;
- lower XP/coin reward than classic/active;
- trait direction: curiosity up, order up, vitality slightly down;
- behavior evidence: play, exploration, order.

### `bond:listen`

Purpose: emotional repair and trust.

Implemented behavior:

- lower instant happiness than hug, strong bond gain;
- trait direction: sociality up, caution down;
- behavior evidence: recovery and social;
- stronger trauma reduction than legacy bond.

### `sleep:ritual`

Purpose: stable bedtime routine.

Implemented behavior:

- sleep lifecycle is unchanged;
- trait direction: order up, caution down, sociality slight up;
- behavior evidence: order, recovery, care;
- small trauma reduction.

## Implemented Slice 2

### `play:social`

Purpose: cooperative/warm play.

Implemented behavior:

- stronger bond gain than active play;
- trait direction: sociality up, vitality up, curiosity slight up;
- behavior evidence: play, social, care.

### `bond:praise`

Purpose: confidence and warm contact.

Implemented behavior:

- medium bond/happiness;
- small energy boost;
- trait direction: sociality up, vitality up, caution down;
- behavior evidence: social and care;
- mild trauma reduction.

### `sleep:nap`

Purpose: short recovery without strongly training strict routine.

Implemented behavior:

- sleep lifecycle is unchanged;
- trait direction: vitality up, caution down, order slight up;
- behavior evidence: recovery and care;
- smaller order signal than `sleep:ritual`;
- very small trauma reduction.

### `wake:gentle`

Purpose: safer wake style.

Implemented behavior:

- normal wake lifecycle still runs;
- early/natural wake influence still applies;
- gentle wake adds a separate influence afterward;
- trait direction: sociality up, caution down, order slight up;
- behavior evidence: recovery, social, care;
- softens trauma pressure compared with normal early wake.

## Existing Item Behavior

Item-oriented behavior is already implemented and tested.

Current engine reacts to:

- item add/use frequency;
- item diversity;
- repeated use of the same item;
- personality-specific style multipliers;
- long-term behavior profile evidence;
- formation and evolution through item behavior.

Important tests already exist around:

- `add_item records item-oriented style in traits and behavior profile`;
- `diverse frequent item usage changes long-term behavior profile`;
- `repeated and diverse item styles do not collapse into one trait shape`;
- `item behavior style can contribute to formation`;
- `offline replay remains deterministic for item add and use behavior`;
- `behavior semantics: item collection semantics separate diverse collectors from repeated item reliance`.

## Important Files Changed

TypeScript engine:

- `packages/personality-core/src/commands.ts`
- `packages/personality-core/src/commandHandlers.ts`
- `packages/personality-core/src/TraitEvolutionEngine.ts`
- `packages/personality-core/src/types.ts`

Preset data:

- `packages/personality-pet-preset/src/influenceRegistry.ts`

Backend Rust engine:

- `backend/src/engine/command_handlers.rs`
- `backend/src/engine/influence_registry.rs`
- `backend/src/engine/trait_evolution.rs`

Backend HTTP/sync/persistence:

- `backend/src/handlers/command_log.rs`
- `backend/src/handlers/pet.rs`
- `backend/src/handlers/sync.rs`
- `backend/src/handlers/economy.rs`
- `backend/src/handlers/mod.rs`

Frontend/app:

- `src/api/types.ts`
- `src/api/mockApi.ts`
- `src/api/realApi.ts`
- `src/store/petStore.ts`
- `src/components/Actions/ActionPanel.tsx`
- `src/personality/personalityAssistant.ts`

Tests:

- `tests/personalityEvolution.test.ts`
- `backend/tests/http_integration.rs`
- Rust unit tests inside `backend/src/engine/command_handlers.rs`

## Backend Command Log Status

Accepted direct backend actions now write accepted command results to `pet_commands`.

Covered direct actions include:

- feed;
- play;
- sleep/wake;
- bathe;
- heal;
- bond;
- add item through shop buy;
- use item through inventory use;
- sync;
- accept/reject evolution.

Command result JSON includes:

- pet snapshot;
- command JSON;
- events;
- personality telemetry;
- variant when present.

Current limitation:

- blocked/rejected direct endpoint actions are not yet persisted as rejected history.
- offline sync rejects invalid/blocked commands in the ack, but rejected command history policy is still a product/backend decision.

## Supported Variants Now

TypeScript and backend sync/direct endpoints currently support:

```text
play: classic | active | puzzle | social
sleep: night | nap | ritual
wake: normal | gentle
bond: hug | listen | praise
```

Unsupported variants must be rejected explicitly on backend sync/direct paths.

Do not silently map unsupported variants to legacy behavior.

## Known Unimplemented Backlog

### Risky Actions

Do not implement these as simple influence rows:

- `play:chaos`
- `wake:forceful`
- `bond:boundary`
- `explore:new_thing`

They need a separate risk design:

- trauma accumulation semantics;
- recovery/mitigation actions;
- assistant warnings;
- blocked/rejected display policy;
- tests proving repeated risk is visible and recoverable;
- TypeScript/Rust parity.

### Exploration Actions

Candidate next safe slice:

- `explore:room`
- `explore:inspect_item`

Open design decision:

- whether to add a new `explore` command family or model these as item/room command variants.

Prefer a new command family only if the command has a distinct payload and lifecycle. Otherwise use existing `add_item`, `use_item`, or room/equipment events.

### Item Actions

Candidate item-oriented variants:

- `items:rotate_toys`
- `items:organize`
- `items:repeat_favorite`

Recommended implementation direction:

- avoid fake UI actions if inventory state does not actually change;
- prefer engine-level item behavior style data if action is only about style;
- if there is a direct player action, make it command-backed and persisted.

### UI Work

ActionPanel now has more buttons and is becoming crowded.

Next UI work should:

- group actions by intent: Care, Play, Bond, Routine, Items;
- show 3-5 recommended actions first;
- keep the full list behind progressive disclosure;
- keep assistant hints tied to actual engine evidence.

Do not add a large flat button wall.

### Backend Hardening

Still open:

- payload-hash idempotency for duplicate command IDs;
- rejected/blocked command history policy;
- reducing TS/Rust duplicated action logic;
- deciding whether complex future mechanics should be server-authoritative in real mode.

## Tests That Must Keep Passing

Run after action-system changes:

```bash
npm test
npm run build
cargo fmt
cargo test
cargo clippy -- -D warnings
git diff --check
```

If generated Rust personality data changes:

```bash
npm run generate:rust-personality-catalog
npm run generate:rust-personality-definitions
cargo fmt
npm run check:rust-personality-catalog
npm run check:rust-personality-definitions
```

## Last Verified Checks

These passed after slice 2:

```bash
npm test
npm run build
cargo fmt
cargo test
cargo clippy -- -D warnings
git diff --check
```

Build note:

- `npm run build` still emits the existing Vite chunk-size warning for a large JS bundle.
- This is not caused by the action-system logic itself, but it remains frontend performance debt.

## Recommended Next Session Plan

1. Read `docs/personality_engine_llm_knowledge_base.md`.
2. Read this handoff file.
3. Inspect current dirty worktree before editing.
4. Choose exactly one next slice.
5. Recommended next slice: action UI grouping and recommendations, because the action count is now high enough that the panel needs structure before adding more actions.
6. Alternative next slice: implement `explore:inspect_item` and `explore:room`, but only after deciding the command family/payload.
7. Do not start risky actions until trauma warning/recovery policy is designed and tested.

## Suggested Acceptance Criteria For Next Slice

For UI grouping/recommendations:

- action panel is grouped by intent;
- recommended actions are derived from pet state and assistant guidance, not hardcoded only by label;
- no engine behavior changes are introduced unless tests are added;
- existing action variants still call the same command variants;
- build passes.

For exploration actions:

- command contract is explicit;
- legacy replay remains stable;
- TS and Rust both reject unsupported variants;
- action changes stats, traits, behavior evidence, and explainability;
- backend direct and sync paths both support or both reject the command;
- TS and Rust tests prove behavior does not collapse into existing play/item styles.
