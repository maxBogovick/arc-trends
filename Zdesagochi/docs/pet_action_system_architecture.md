# Pet Action System Architecture

Last verified against current architecture on 2026-05-23.

This document defines stable architecture rules for pet actions in Zdesagochi. It does not define release priorities or balance numbers. Use it together with `docs/personality_engine_llm_knowledge_base.md`.

## Purpose

Pet actions must become character-training mechanics, not just buttons that change stats.

An action is architecture-complete when it can be traced through:

```text
UI intent -> command -> engine result -> personality evidence -> persistence -> replay -> explanation
```

If an action only exists in UI and does not enter this chain, it is a UI control or animation, not a pet action.

## Core Rules

1. Engine ownership
   - Any action that changes pet stats, rewards, inventory, character, history, or recommendations must enter the engine as a command or command variant.
   - Pure UI controls are allowed, but they must not pretend to be pet actions.

2. Deterministic replay
   - Engine output must be deterministic from previous state, command payload, registry/config data, and explicit engine context.
   - Outcome logic must not read wall-clock time directly. Use command timestamp or injected context.
   - Random outcomes must use command-provided seed or deterministic derived input.

3. Backward compatibility
   - Existing command logs must keep replaying.
   - Missing `variant` must map to fixed legacy behavior, not to whatever the new default happens to be.

4. Explainability
   - Any action that changes `traitVector`, `behaviorProfile`, trauma/catharsis, formation, or evolution readiness must emit enough data for the assistant to explain the change.

5. Data-first, not data-only
   - Static influence should live in data/config.
   - Stateful mechanics may use code when they depend on previous state, time windows, inventory ownership, deduplication, random seed resolution, sleep lifecycle, or evolution state machines.
   - Stateful code should be small, named, and covered by tests.

6. Backend support boundary
   - If backend can receive or apply a command, backend must either support it completely or reject it explicitly.
   - Silent partial replay is not allowed.

## State Semantics

### Stats

Stats are immediate pet condition:

- hunger;
- happiness;
- energy;
- health;
- cleanliness;
- bond.

Stats answer: "What changed right now?"

### Trait Vector

`traitVector` is personality position:

- vitality;
- sociality;
- order;
- appetite;
- caution;
- curiosity.

Traits answer: "What kind of pet is this becoming?"

### Behavior Profile

`behaviorProfile` is long-term evidence of user style:

- care;
- play;
- social;
- order;
- exploration;
- disruption;
- recovery.

Behavior answers: "What did the player repeatedly teach?"

Rule of thumb:

- Stat: immediate condition.
- Trait: identity direction.
- Behavior: repeated training method.

If a new action cannot explain these separately, the design is not ready.

## Command Shape

Engine-applied commands must include:

```ts
{
  type: string;
  commandId: string;
  at: string;
  variant?: string;
}
```

Requirements:

- `at` is explicit and persisted.
- `commandId` is generated once and persisted unchanged.
- command IDs must be collision-resistant enough for offline sync. ULID/UUIDv7 are acceptable implementations.
- duplicate command handling is backend architecture, not action design. If payload-hash idempotency is not implemented, do not claim reliable retry idempotency.

## Legacy Variant Mapping

Old commands without `variant` map to fixed legacy behavior:

| Legacy command | Fixed behavior |
|---|---|
| `feed` | existing `action:feed` |
| `play` | existing `action:play` |
| `sleep` | existing sleep start logic |
| `wake` | existing wake early/natural logic |
| `bathe` | existing `action:bathe` |
| `heal` | existing `action:heal` |
| `bond` | existing `action:bond` |

Do not redefine legacy behavior as a new preferred variant. Add new variants beside it.

## Variant Acceptance

A variant is valid when it has a distinct gameplay purpose and a meaningful mechanical difference from neighboring variants.

At least one hard difference is required:

- different stats or reward profile;
- different trait evidence;
- different behavior evidence;
- different risk/blocking/cooldown;
- different command payload or state lifecycle.

Player intent is required, but intent alone is not proof. Magnitude-only differences are acceptable only when they create a real risk/reward tradeoff visible to the player and covered by a semantic test.

## TypeScript/Rust Strategy

Current architecture has TypeScript engine logic and Rust backend replay logic. That is a real maintenance risk.

Preferred long-term direction:

1. Move as much action influence as possible into shared data/config.
2. Keep stateful logic small and mirrored only when backend replay truly needs it.
3. For real mode, consider server-authoritative command execution for new complex mechanics.

Parity tests are required while two implementations exist, but they are a safety net, not the architecture goal.

Parity fixtures for new semantics should come from action specs or hand-written scenarios, not from "run TS and bless output" unless explicitly marked as characterization tests.

## Backend Persistence

Accepted engine commands should be persisted in `pet_commands` with:

- command JSON;
- result JSON;
- status;
- reject reason when applicable;
- personality telemetry when present.

Direct endpoints and offline sync must not diverge silently. If one path supports a variant and another does not, the unsupported path must reject it explicitly.

Rejected/blocked action logging is a product decision. If implemented:

- rejected commands must not advance the accepted offline cursor;
- rejected commands must not emit accepted telemetry;
- assistant display must make clear that the action did not apply.

## UI Architecture

The action UI should be organized by intent, not by raw command names.

Recommended structure:

- recommended actions;
- categories such as Care, Play, Bond, Routine, Explore, Items;
- progressive disclosure for large sets;
- friendly hints, not raw engine terms.

Do not rely on a flat grid once actions become numerous. Exact UI limits belong in product/design guidance, not this architecture contract.

## Testing Expectations

Action-system changes should test the layers they touch:

- engine semantics for stats/traits/behavior;
- offline replay determinism;
- legacy command compatibility;
- explainability output;
- frontend selectors/recommendations when UI changes;
- backend command logging and sync behavior when backend is involved;
- Rust parity when backend applies the command.

Required broad checks for implementation work:

```bash
npm test
npm run build
cargo test
cargo clippy -- -D warnings
git diff --check
```

If generated Rust personality data changed:

```bash
npm run generate:rust-personality-catalog
npm run generate:rust-personality-definitions
cargo fmt
npm run check:rust-personality-catalog
npm run check:rust-personality-definitions
```

## Open Architecture Debt

Track these separately from individual action work:

- backend payload-hash idempotency for duplicate command IDs;
- reducing TS/Rust duplicated logic;
- deciding whether real mode should become server-authoritative for complex action mechanics;
- direct endpoint response contract: legacy wrappers versus full `PetCommandResult`;
- rejected/blocked command history policy.
