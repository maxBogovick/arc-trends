# Backend Readiness Audit

Date: 2026-05-16

## Verdict

The Rust backend is implemented and compiles, but it is not production-ready yet.

Current status:

- `cargo check` passes.
- `cargo clippy -- -D warnings` passes.
- `cargo test` passes and currently runs backend unit tests for Rust command influence behavior and core TS parity fixtures.
- The backend has routes, migrations, DB repositories, auth, SSE, metrics, OpenAPI, economy/progress/rooms, and a Rust personality-engine port.

Production readiness is blocked by contract, economy, sync, and engine-parity issues below.

## Remediation Applied

After the initial audit:

- `src/api/realApi.ts` now unwraps `ActionResult.pet` for non-play pet action endpoints, so real-mode UI no longer stores an action wrapper where it expects `Pet`.
- `backend/src/handlers/pet.rs` now persists `result.coin_delta` into `user_coins` for pet action endpoints.
- `backend/src/handlers/sync.rs` now accumulates accepted command `coin_delta` values and persists them into `user_coins` after offline sync replay.
- Direct pet action endpoints now persist pet state, coin deltas, achievement/quest ticks, and pet events in a single database transaction.
- Offline sync replay now persists accepted command logs, final pet state, and accumulated coin delta in a single database transaction.
- Offline sync now persists TS-shaped command result JSON for accepted commands, including `pet`, original `command`, structured domain events, deltas, applied modifiers, cooldowns, and version metadata returned by `/api/pet/sync/results`.
- `backend/src/handlers/sync.rs` now validates `baseCommandId`, rejects duplicate command IDs inside a batch, rejects invalid command shapes, parses `scoreSeed`/`foodEffect`/`itemEffect`, and scopes already-processed command handling to the current pet/user.
- `backend/src/db/command_repo.rs` now exposes current-pet cursor lookup and scopes `get_results_since()` cursor subqueries to the current pet.
- `backend/src/handlers/economy.rs` now routes `/api/inventory/use` through `apply_personality_command()` and persists inventory decrement, pet state, and item coin delta in one transaction.
- `backend/src/engine/trait_evolution.rs` and `backend/src/engine/command_handlers.rs` now apply registered command influences to the Rust trait vector, daily trait budget, formation progress, confused state, trauma, and shadow/catharsis checks.
- `backend/src/domain/pet.rs` now persists `influenceCooldowns` and `currentSync` in pet JSON state with serde defaults for old saves.
- `backend/src/engine/types.rs` now returns cooldown/current sync/version metadata in `PetCommandResult`.
- `backend/src/engine/command_handlers.rs` now enforces influence cooldowns, advances `currentSync` on sync commands, and includes regression tests proving influence application, cooldown blocking/re-application, and pet roundtrip persistence.
- `backend/tests/fixtures/ts_parity_core.json` now records core TS-compatible expected outcomes, and the Rust engine test suite verifies backend command outcomes against that fixture for feed, bond cooldown, play, bathe, heal, and use-item commands.
- `backend/tests/http_integration.rs` now provides a router-level integration harness for register, authenticated pet action, offline sync submit, and TS-shaped sync result fetch. It runs against real Postgres/Redis when `TEST_DATABASE_URL` and `TEST_REDIS_URL` are set.

## P0 Blockers

### 1. Backend still needs expanded integration and parity tests

Initial unit tests were added for:

- trait influence movement from feed commands;
- influence cooldown blocking and re-application after sync advances `currentSync`;
- pet JSON roundtrip for `influenceCooldowns`.
- core TS-compatible parity fixture outcomes for feed, bond cooldown, play, bathe, heal, and use-item scenarios.
- router-level HTTP flow for register, authenticated play, offline sync submit, and sync result fetch when test Postgres/Redis env vars are provided.

Still missing automated proof for:

- auth login/refresh/logout;
- multi-user data isolation;
- the rest of the pet command endpoints;
- offline sync cursor semantics beyond the happy path;
- duplicate command handling;
- economy transactions;
- broader Rust/TS parity across offline sync, unsupported command variants, automatic influences, and edge cases.

Required fix:

- Run integration tests in CI with dedicated Postgres/Redis services.
- Expand integration coverage beyond the first router-level flow.
- Expand parity fixtures for offline sync and remaining command variants.

### 2. Direct action result contract is still legacy-shaped

Initial coin persistence and transactional hardening were fixed:

- direct pet actions persist pet state, coin delta, progress ticks, and events in one transaction;
- `/api/inventory/use` persists inventory decrement, pet state, and item coin delta in one transaction;
- offline sync replay persists accepted command logs, final pet state, and accumulated coin delta in one transaction.
- `/api/pet/sync/results` now returns persisted TS-shaped command results for accepted offline commands.

Remaining risk:

- Direct pet action endpoints still return their legacy HTTP wrapper shapes rather than the full command replay contract.

Required fix:

- Decide whether direct action endpoints should keep their existing wrappers or also return full `PetCommandResult`.

### 3. Offline sync still needs broader parity

Initial stale-base and validation issues were fixed:

- `baseCommandId` is validated against the current pet's last accepted command.
- duplicate IDs in the same batch are rejected as `duplicate_in_batch`.
- invalid command shapes are rejected as `invalid_command`.
- already-processed commands are accepted only when they belong to the same pet/user.
- `scoreSeed`, `foodEffect`, and `itemEffect` are parsed.
- accepted command logs, final pet state, and coin delta are committed together.
- accepted command results are persisted with `pet`, original `command`, structured domain events, cooldowns, and version metadata.

Remaining risk:

- Commands represented by the TS union but not by Rust `PetCommand` fields, such as `equip_room`/`npc_visit`, are still not behaviorally equivalent.

Required fix:

- Add parity tests for offline sync and remaining command variants.

### 4. Command ID storage is still globally unique by schema

Runtime handling now rejects already-used command IDs unless they belong to the current pet/user. However, the DB schema still uses `pet_commands.id` as a global primary key.

Impact:

- This is acceptable if command IDs are globally unique ULIDs/UUIDs.
- It is not a true `(user_id, pet_id, command_id)` scoped command log.

Required fix:

- Decide whether command IDs are globally unique by contract.
- If not, migrate to a composite command identity.

### 5. Offline sync is closer to TS command parsing, but not fully behavior-equivalent

Fixed:

- missing/invalid command IDs are rejected;
- missing/invalid timestamps are rejected;
- unsupported or not-yet-representable types are rejected;
- `scoreSeed`, legacy `score`, `foodEffect`, `itemEffect`, and `itemKind` are parsed/validated;
- `coin_balance` now uses current server coins plus accepted in-batch coin delta.

Remaining risk:

- `itemKind` is validated but not yet used for food-item fallback to `action:feed` when an item-specific influence is absent.
- `equip_room` and `npc_visit` are rejected by sync until Rust `PetCommand` can represent and apply their fields.

Impact:

- Some server replay outcomes can still differ from client replay.

Required fix:

- Extend Rust `PetCommand` or reject not-yet-supported command variants explicitly.
- Port influence behavior and add parity tests.

### 6. Rust personality command handler still needs TS/Rust parity proof

Initial trait influence application and cooldown persistence have been ported:

- actions map to registered influence IDs;
- registered trait deltas move the Rust trait vector with daily budgets and smoothing;
- formation progress advances and can complete formation;
- trauma deltas update shadow-form checks;
- `bond`/`heal` can advance catharsis while in shadow form;
- applied command influences are surfaced in `appliedModifiers`.
- influence cooldowns are stored in pet JSON state;
- `currentSync` advances on sync and gates cooldown re-application;
- command results include cooldown/current sync metadata.

Remaining gap:

- System/environment automatic influences are still not fully equivalent to the TS command handler.
- The current TS/Rust parity fixture proves the core supported command path for feed, bond cooldown, play, bathe, heal, and use-item commands, but not full sync/end-to-end equivalence yet.

Impact:

- Server-side actions now drive formation and cooldown cadence, but exact equivalence with TS is not yet proven.

Required fix:

- Add broader TS fixtures for automatic influences, sync replay, and remaining command variants.

### 7. Rust `PetCommandResult` is not the same shape as TS `PetCommandResult`

TS result includes:

- `pet`
- `command`
- `influenceCooldowns`
- `schemaVersion`
- `engineVersion`
- `registryVersion`
- structured `DomainEvent[]`

Rust result includes only:

- `statDeltas`
- `xpDelta`
- `coinDelta`
- `blockedAction`
- `appliedModifiers`
- `events: Vec<String>`
- `activeEmergentStates`
- `meta`

Impact:

- `/api/pet/sync/results` cannot satisfy the existing frontend `ServerApi` contract.
- Explainability and replay metadata are lost server-side.

Required fix:

- Align Rust result JSON with `packages/personality-core/src/commands.ts`.
- Persist full command result, including command metadata and version fields.

## P1 Issues

### 1. Pet action writes are not transactional

Several handlers do:

1. apply engine;
2. persist pet;
3. tick achievements/quests best-effort;
4. insert event best-effort.

Impact:

- Event/progress failures are silently dropped.
- Pet state, progress, events, and economy can diverge.

Required fix:

- Use a shared transactional `execute_command` helper for command endpoints.
- Decide which side effects are critical vs best-effort, and record failures explicitly.

### 2. `get_results_since()` cursor lookup is not scoped inside the subquery

The query uses:

```sql
created_at > (SELECT created_at FROM pet_commands WHERE id = $2)
```

Impact:

- With globally unique IDs this works most of the time.
- After dedupe is fixed to be scoped, this must also scope the cursor by `pet_id`/`user_id`.

### 3. `backend/TASKS.md` is stale

It lists most backend phases as unchecked even though the implementation exists.

Impact:

- Planning from `TASKS.md` leads to wrong next steps.

Required fix:

- Replace it with a truth-based readiness checklist or update statuses from actual code.

## Recommended Order

1. Run the HTTP integration harness in CI with dedicated Postgres/Redis services.
2. Add TS/Rust parity fixtures for offline sync scenarios and remaining command variants.
3. Expand integration tests for auth/user isolation/sync/economy.
4. Decide whether direct action endpoints should return full `PetCommandResult` or keep legacy wrappers.
5. Update backend docs/task checklist to match reality.

## Current Readiness

| Area | Status |
|---|---|
| Compiles | Ready |
| Clippy clean | Ready |
| HTTP route surface | Mostly implemented |
| Auth implementation | Implemented; register path covered by conditional HTTP integration harness |
| DB migrations/repos | Implemented; migrations run in conditional HTTP integration harness |
| Economy | Implemented; action, inventory, and sync coin side effects persist transactionally |
| Offline sync | Implemented with stale-base validation, transactional replay, and TS-shaped persisted results; broader parity still pending |
| Rust personality engine | Implemented with command influences/cooldowns, but not TS/Rust parity-proven |
| Frontend real API compatibility | Improved for pet action responses; sync result shape covered by conditional HTTP integration harness |
| Production readiness | Not ready |
