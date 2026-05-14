# Personality Engine Decision Log

> Дата создания: 2026-05-09  
> Назначение: фиксировать не только что было сделано, но и почему было принято именно такое инженерное решение.  
> Перед важными изменениями читать вместе с `docs/personality_engine_progress.md`.

---

## 1. Как пользоваться

Добавлять запись, когда решение:

- меняет архитектуру;
- переносит logic между слоями;
- закрывает gap из `docs/personality_engine_v5_gap_analysis.md`;
- выбирает один вариант из нескольких;
- меняет public contract/types;
- удаляет обещание из docs или реализует его иначе;
- влияет на replay/backend/UI assumptions.

Не добавлять запись для чисто механических правок:

- форматирование;
- переименование без изменения смысла;
- простая правка комментария.

---

## 2. Шаблон решения

```md
## DEC-000N: Short decision title

Status: proposed | accepted | superseded  
Date: YYYY-MM-DD  
Related files: `path`, `path`  
Related roadmap item: P?/Sprint?

### Context

Какая проблема была.

### Decision

Что решили сделать.

### Why

Почему это правильный выбор относительно конечной цели.

### Alternatives

- Option A: accepted/rejected, причина.
- Option B: accepted/rejected, причина.

### Consequences

Что станет лучше, какие tradeoffs остаются.

### Verification

Какие тесты/команды/поисковые проверки должны подтвердить решение.

### Next

Какой следующий шаг вытекает из решения.
```

---

## 3. Accepted Decisions

## DEC-0001: Use progress log as mandatory control entrypoint

Status: accepted  
Date: 2026-05-09  
Related files: `docs/personality_engine_progress.md`, `docs/personality_engine_coding_rules.md`, `docs/personality_engine_next_steps.md`  
Related roadmap item: Process control

### Context

Кода стало много, а контроль был размазан между roadmap, audit и handoff. Было трудно быстро понять:

- что уже сделано;
- почему это было нужно;
- чем это помогло конечной цели;
- что проверено;
- почему следующий шаг именно такой.

### Decision

Сделать `docs/personality_engine_progress.md` обязательным первым файлом для любой задачи по personality engine.

### Why

Это создает единый контрольный контур:

> goal -> current step -> why -> implementation -> verification -> impact -> next step.

Без такого контура refactor легко превращается в добавление кода без доказанного движения к цели.

### Alternatives

- Только `next_steps.md`: rejected, потому что roadmap показывает план, но не фиксирует фактический прогресс и вектор после каждого шага.
- Только финальные сообщения в чате: rejected, потому что история теряется между сессиями.
- Только git diff: rejected, потому что diff показывает что изменилось, но не объясняет почему.

### Consequences

Плюсы:

- каждый шаг должен иметь причину, impact и next step;
- проще продолжать работу между сессиями;
- проще заметить отклонение от вектора.

Tradeoff:

- каждый meaningful step требует обновлять progress file.

### Verification

- `docs/personality_engine_progress.md` существует;
- `docs/personality_engine_coding_rules.md` требует читать progress file первым;
- `docs/personality_engine_next_steps.md` ссылается на progress file.

### Next

Усилить progress file обязательными блоками Last Completed Step, Control Dashboard, Required Closeout.

---

## DEC-0002: Add decision log for architectural choices

Status: accepted  
Date: 2026-05-09  
Related files: `docs/personality_engine_decisions.md`, `docs/personality_engine_progress.md`  
Related roadmap item: Process control

### Context

Progress log отвечает "где мы сейчас", но не должен становиться длинной историей всех архитектурных компромиссов.

Для профессионального контроля нужен отдельный файл, который отвечает:

- почему выбран конкретный путь;
- какие альтернативы отклонены;
- какие последствия приняты;
- какие проверки доказывают решение.

### Decision

Создать `docs/personality_engine_decisions.md` как ADR-lite decision log.

### Why

Это предотвращает повторные споры и возвраты к уже отклоненным подходам. Также помогает понять, почему код устроен именно так, когда контекст переписки потерян.

### Alternatives

- Хранить решения в `progress.md`: rejected, progress должен оставаться оперативным и коротким.
- Хранить решения только в comments: rejected, comments не показывают alternatives/consequences.
- Хранить решения только в commit messages: rejected, они неудобны как рабочий документ между задачами.

### Consequences

Плюсы:

- каждое важное решение получает контекст;
- проще проводить review;
- легче видеть, когда новое изменение противоречит старому решению.

Tradeoff:

- architectural tasks требуют обновлять еще один файл.

### Verification

- decision log создан;
- progress/coding rules ссылаются на decision log;
- future architecture changes добавляют DEC entries.

### Next

Начать Sprint 1 cleanup и фиксировать решения, если cleanup выбирает между несколькими вариантами поведения.

---

## DEC-0003: Command outcome blocks mockApi replacement and offline sync

Status: accepted  
Date: 2026-05-10  
Related files: `src/personality/commandHandlers.ts`, `src/personality/commands.ts`, `src/api/mockApi.ts`, `docs/personality_engine_function_readiness.md`, `docs/personality_engine_progress.md`  
Related roadmap item: M2 / P3 Command outcome

### Context

`mockApi` сейчас одновременно:

- хранит локальное состояние;
- считает stats/XP/coins;
- применяет часть gameplay/special cases;
- вызывает personality command layer;
- имитирует будущий backend.

Пока `applyPersonalityCommand()` не возвращает полный результат действия, `mockApi` нельзя честно убрать: иначе offline, replay и будущий backend будут считать результат действия разными способами.

### Decision

Следующий главный этап после Sprint 1 cleanup — **Command outcome first**.

До замены `mockApi` нужно расширить `PetCommandResult`, чтобы каждая команда возвращала:

- `statDeltas`;
- `xpDelta`;
- `coinDelta`;
- `blockedAction`;
- `appliedModifiers`;
- domain events;
- новый pet snapshot.

Только после этого `mockApi` можно разрезать на `PetService`, `LocalSave`, `SyncQueue` и `ServerApi`.

### Why

Offline-first игра требует одного источника правды:

```text
player action -> command engine -> local save -> sync queue -> backend
```

Если gameplay outcome останется в `mockApi`, backend придется копировать клиентскую логику, а replay не сможет доказуемо восстановить то же состояние.

### Alternatives

- Сначала делать data-driven emergent states: partially rejected as immediate priority. Это важно для добавления новых характеров, но не разблокирует удаление `mockApi`.
- Сразу удалять `mockApi`: rejected. Нечем заменить расчет stats/XP/coins, offline behavior сломается или разойдется с backend.
- Оставить `mockApi` навсегда: rejected. Тогда не будет единого backend/mock/replay outcome.

### Consequences

Плюсы:

- появляется понятный путь к offline + sync;
- `mockApi` перестает быть местом игровой логики;
- backend сможет принимать команды и проверять тот же результат;
- replay станет ближе к полному восстановлению gameplay.

Tradeoff:

- data-driven states временно отодвигаются после command outcome или идут только как второй крупный этап.

### Verification

- `PetCommandResult` содержит full gameplay outcome;
- `mockApi` для основных действий использует command result, а не считает stats/XP/coins сам;
- tests доказывают одинаковый outcome для command/replay/mock path;
- targeted check показывает уменьшение gameplay calculators в `src/api/mockApi.ts`.

### Next

Начать M2/P3: расширить `PetCommandResult` и перенести base action result calculation из `mockApi` в command/gameplay layer.

---

## DEC-0004: Introduce PersonalityState before package extraction

Status: accepted  
Date: 2026-05-13  
Related files: `src/personality/coreState.ts`, `src/personality/engineFacade.ts`, `src/api/personalityPetAdapter.ts`, `src/api/petService.ts`  
Related roadmap item: Library extraction — Iteration 1

### Context

The personality engine still uses app `Pet` as its operational state. That makes the future library boundary unsafe because app-only fields, storage assumptions, and API contracts can leak into the reusable core.

### Decision

Introduce `PersonalityState` inside `src/personality/coreState.ts`, keep app `Pet` conversion in `src/api/personalityPetAdapter.ts`, and route `PetService` through:

```text
Pet -> PersonalityState -> applyPersonalityStateCommand() -> Pet
```

Keep the existing `applyPersonalityCommand(pet, command, options)` as the compatibility path for legacy callers during strangler extraction.

### Why

This separates the public state shape of the future core from the app API contract without rewriting gameplay logic, moving packages, or changing balance numbers.

### Alternatives

- Move files into `packages/` immediately: rejected, because the import boundary is not clean enough yet.
- Put the app adapter in `src/personality`: rejected, because it would keep app `Pet` inside future core.
- Rewrite command handlers around the new state in one step: rejected, because it would be a larger behavioral-risk refactor than Iteration 1 needs.

### Consequences

The app has a real adapter path now, and future extraction can target `PersonalityState` instead of app `Pet`. Some legacy `src/personality` files still import `src/api/types`; those are known follow-up work for later iterations.

### Verification

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`
- Boundary `rg` checks for app API imports in `src/personality`.

### Next

Add `createPersonalityEngine(config)` and `zdesagochiPetPreset` so core behavior can be configured through a preset before any package move.

---

## DEC-0005: Use engine factory and preset before package-like extraction

Status: accepted  
Date: 2026-05-13  
Related files: `src/personality/engineFactory.ts`, `src/personality/zdesagochiPetPreset.ts`, `src/api/petService.ts`  
Related roadmap item: Library extraction — Iteration 2

### Context

After `PersonalityState` was introduced, app code could enter the command path through a state adapter. The next problem was construction: consumers still needed to know which default registries, validators, versions, and runtime hooks belonged together.

### Decision

Add `createPersonalityEngine(config)` and keep the Zdesagochi defaults behind `zdesagochiPetPreset`. Route `PetService` through an engine instance created from that preset.

The engine exposes:

- `applyCommand(state, command, runtime?)`;
- `replay(state, commands, runtime?)`;
- `explain(result)`;
- `validateConfig()`.

### Why

This moves the public entrypoint toward the target consumer shape:

```text
createPersonalityEngine(zdesagochiPetPreset).applyCommand(state, command)
```

without moving files into `packages/` yet and without changing gameplay balance.

### Alternatives

- Keep app code calling `applyPersonalityStateCommand()` directly: rejected, because it does not prove preset-driven construction.
- Move packages now: rejected, because legacy app `Pet` imports still exist in `src/personality`.
- Build a plugin system: rejected, because the current target is a virtual pet / companion engine, not a generic extension framework.

### Consequences

The app now uses the same factory/preset shape future consumers will use. Some default imports remain inside legacy command/gameplay implementation; Iteration 3 must create a stricter package-like boundary and continue separating pure exports from app adapters.

### Verification

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`
- Boundary `rg` checks for app API imports in new core/factory/preset files.

### Next

Create the package-like boundary for pure core/preset exports without npm publishing, then move/re-export only code that does not import app API, storage, sync, backend replay, or browser APIs.

---

## DEC-0006: Add package-like re-export boundary before moving implementations

Status: accepted  
Date: 2026-05-13  
Related files: `packages/personality-core/src/index.ts`, `packages/personality-pet-preset/src/index.ts`, `src/personality/commands.ts`, `src/personality/commandHandlers.ts`, `src/personality/TraitEvolutionEngine.ts`, `src/personality/stateLayers.ts`, `src/api/petService.ts`  
Related roadmap item: Library extraction — Iteration 3

### Context

The engine factory and preset existed, but implementation still lived under `src/personality`, and several legacy core files imported app `Pet` / `Account` from `src/api/types`. Moving implementation files directly into packages would have been risky while those imports existed.

### Decision

Create package-like `packages/personality-core/src` and `packages/personality-pet-preset/src` entrypoints as controlled re-export surfaces. Before exposing them, remove app API type imports from `src/personality` by using structural core types:

- `PersonalityState`;
- `PersonalityAccount`;
- generic `PetCommandResult<TState>`;
- generic replay results.

Route `PetService` through the package-like engine/preset imports while keeping storage/browser adapters app-side.

### Why

This gives the app the same import shape that a future package consumer will use, while avoiding a large file move and preserving gameplay behavior.

### Alternatives

- Move all implementation files into `packages/` immediately: rejected, because storage and legacy app imports needed cleanup first.
- Re-export all of `src/personality`: rejected, because that would expose browser storage and legacy helpers as public core API.
- Keep package boundary only in docs: rejected, because app imports would not prove the boundary.

### Consequences

Core/preset package-like surfaces now exist and do not import app API types or storage/sync/backend adapters. Implementation still mostly lives in `src/personality`, so the next iteration should move or isolate storage adapters and then continue physical extraction.

### Verification

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`
- `rg` checks confirm no `src/api/types` imports in `packages/personality-core`, `packages/personality-pet-preset`, or `src/personality`.

### Next

Move browser/local storage surface out of the personality public module and keep storage/sync/backend adapters on the app side before deeper physical package extraction.

---

## DEC-0007: Keep storage and sync adapters app-side

Status: accepted  
Date: 2026-05-13  
Related files: `src/api/offlineStorage.ts`, `src/api/localSave.ts`, `src/api/syncQueue.ts`, `src/api/explainability.ts`, `src/api/backendReplayServer.ts`, `src/api/personalityEngineAdapter.ts`, `src/personality/index.ts`  
Related roadmap item: Library extraction — Iteration 4

### Context

The package-like core surface was clean, but `src/personality/offlineStorage.ts` still exported browser `localStorage` helpers through the legacy personality module. Backend replay and storage/sync services also imported command types and command execution through `../personality`, which kept infrastructure close to core internals.

### Decision

Move offline storage helpers to `src/api/offlineStorage.ts`, remove storage from `src/personality/index.ts`, and keep storage/sync/backend replay adapters app-side. App infrastructure now imports command/result/version types through `packages/personality-core/src`.

`BackendReplayServerApi` now uses the public app engine path:

```text
app Pet -> toPersonalityState() -> appPersonalityEngine.applyCommand() -> fromPersonalityState()
```

### Why

The future core package must be storage-agnostic and browser-agnostic. Keeping `localStorage`, local save, sync queue, explainability persistence, and backend replay under `src/api` makes the separation explicit without changing gameplay behavior.

### Alternatives

- Export storage helpers from core: rejected, because browser/local storage is infrastructure, not pure engine behavior.
- Keep backend replay calling `applyPersonalityCommand()` directly: rejected, because it bypasses the public engine/preset boundary.
- Move storage to a published package now: rejected, because package API/versioning is not stable yet.

### Consequences

Core/preset package-like surfaces can be imported without storage/sync/backend modules. The app still has offline-first flow through `LocalSave`, `SyncQueue`, `ExplainabilityLog`, and `BackendReplayServerApi`.

### Verification

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`
- Boundary `rg` checks confirm storage/browser symbols are absent from `src/personality` and package-like core/preset surfaces.

### Next

Add schema versioning, migration entrypoint, public quickstart, and replay guarantee docs so the clean core boundary becomes a stable external consumer contract.

---

## DEC-0008: Version state snapshots before physical package extraction

Status: accepted  
Date: 2026-05-13  
Related files: `src/personality/engineVersion.ts`, `src/personality/stateMigration.ts`, `src/personality/commands.ts`, `src/personality/engineFactory.ts`, `packages/personality-core/src/index.ts`, `docs/personality-library/api.md`, `docs/personality-library/quickstart.md`, `docs/personality-library/replay-guarantee.md`  
Related roadmap item: Library extraction — Iteration 5

### Context

The core and preset package-like boundaries existed, and app storage/sync adapters were separated. External consumers still lacked a stable serialized state contract: saved states could be replayed only by convention, not through an explicit schema version and migration entrypoint.

### Decision

Add `PERSONALITY_STATE_SCHEMA_VERSION`, include schema version metadata in state snapshots, command results, replay results, and offline saves, and expose `migratePersonalityState(raw)` from the core package-like entrypoint. Add public quickstart/API/replay docs plus a runnable demo that imports only package-like core and preset entrypoints.

### Why

Package extraction needs a durable serialized boundary before implementation files move. A versioned state contract lets future consumers load legacy snapshots intentionally, reject unsupported future snapshots, and persist replay metadata without depending on app `Pet` types.

### Alternatives

- Move implementation files first: rejected, because consumers would still not have a stable save/replay contract.
- Keep migration app-side: rejected, because external consumers need migration before app adapters exist.
- Treat missing or malformed schema versions as legacy forever: rejected, because malformed snapshots should fail fast instead of silently mutating.

### Consequences

The package-like core API now has explicit version/migration semantics and a runnable consumer proof. `PersonalityState.schemaVersion` remains optional at the type level to allow legacy snapshots to enter migration, but current adapters and engine results write the current version.

### Verification

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`
- Boundary `rg` checks for storage/browser symbols and app API imports.

### Next

Move implementation ownership toward packages while keeping the existing public API and verification suite unchanged.

---

## DEC-0009: Move foundational core contracts before command execution ownership

Status: accepted  
Date: 2026-05-13  
Related files: `packages/personality-core/src/types.ts`, `packages/personality-core/src/coreState.ts`, `packages/personality-core/src/engineVersion.ts`, `packages/personality-core/src/stateMigration.ts`, `src/personality/types.ts`, `src/personality/coreState.ts`, `src/personality/engineVersion.ts`, `src/personality/stateMigration.ts`  
Related roadmap item: Physical source ownership / package readiness

### Context

After versioning/docs, the package-like API was usable, but many exports still physically came from `src/personality`. Moving command execution first would touch high-risk behavior paths. The low-risk base layer is the type/state/version/migration contract because it does not change gameplay formulas or registry data.

### Decision

Move `types.ts`, `coreState.ts`, `engineVersion.ts`, and `stateMigration.ts` into `packages/personality-core/src`. Keep same-name `src/personality` files as compatibility shims that re-export the package-owned modules.

### Why

This proves physical package ownership incrementally while preserving all existing imports. It also gives future command/factory moves a package-local contract to import from instead of continuing to depend on legacy `src/personality` files.

### Alternatives

- Move all command execution files at once: rejected, because it would be a larger behavioral-risk refactor.
- Leave package entrypoint as re-exports only: rejected, because package readiness would remain unproven.
- Delete legacy `src/personality` files immediately: rejected, because the app and internal implementation still import those paths.

### Consequences

The foundational core contract now lives in the package boundary. Legacy paths still work, but they are no longer authoritative. The next package-readiness step can focus on commands/factory/facade without also moving state/type contracts.

### Verification

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`
- Boundary `rg` checks for app API imports, storage/browser symbols, and foundational package imports routing back through `src/personality`.

### Next

Move command/result and engine factory/facade ownership behind `packages/personality-core/src` while keeping behavior and public API stable.

---

## DEC-0010: Move public command and engine API before gameplay internals

Status: accepted  
Date: 2026-05-13  
Related files: `packages/personality-core/src/commands.ts`, `packages/personality-core/src/commandHandlers.ts`, `packages/personality-core/src/engineFacade.ts`, `packages/personality-core/src/engineFactory.ts`, `src/personality/commands.ts`, `src/personality/commandHandlers.ts`, `src/personality/engineFacade.ts`, `src/personality/engineFactory.ts`  
Related roadmap item: Physical source ownership / package readiness

### Context

The foundational contracts moved into `packages/personality-core/src`, but the package entrypoint still exported command/result and engine construction through legacy `src/personality` files. Moving all gameplay internals at once would be risky because command execution coordinates action rules, pattern rules, state layers, trait evolution, memory generation and personality registries.

### Decision

Move `commands.ts`, `commandHandlers.ts`, `engineFacade.ts`, and `engineFactory.ts` into `packages/personality-core/src`. Keep same-name `src/personality` files as compatibility shims. Allow package-owned `commandHandlers` to temporarily import legacy gameplay implementation dependencies until those are moved in separate slices.

### Why

This makes the public command and engine API physically package-owned without changing gameplay behavior. It also exposes the remaining extraction work clearly: package command execution now depends on a finite set of legacy implementation modules instead of hiding behind legacy public files.

### Alternatives

- Move all gameplay internals together with `commandHandlers`: rejected, because it would be a broad behavioral-risk refactor.
- Keep `engineFacade` importing legacy `commandHandlers`: rejected after review, because public package ownership would still be routed through a legacy command bridge.
- Delete compatibility shims now: rejected, because existing app/tests still import `src/personality`.

### Consequences

External-style imports now resolve public command/result/engine API from package-local files. The package is still not standalone because command execution depends on legacy implementation modules. That dependency is explicit and is the next extraction target.

### Verification

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`
- Boundary `rg` checks for app API imports, storage/browser symbols, same-name shim imports, and app adapters bypassing public engine APIs.

### Next

Move or isolate the gameplay implementation dependencies used by package-owned `commandHandlers`, starting with pure data/rule modules before stateful orchestration modules.

---

## DEC-0011: Move generic gameplay implementation before Zdesagochi defaults

Status: accepted  
Date: 2026-05-13  
Related files: `packages/personality-core/src/PersonalityEngine.ts`, `packages/personality-core/src/TraitEvolutionEngine.ts`, `packages/personality-core/src/actionRules.ts`, `packages/personality-core/src/patternRules.ts`, `packages/personality-core/src/passiveRules.ts`, `packages/personality-core/src/decayRules.ts`, `packages/personality-core/src/gameplayStateRules.ts`, `packages/personality-core/src/emergentStates.ts`, `packages/personality-core/src/stateLayers.ts`, `packages/personality-core/src/personalityTraitMap.ts`, `src/personality/*` shims  
Related roadmap item: Physical source ownership / package readiness

### Context

Public command and engine API files were package-owned, but `commandHandlers` still imported legacy implementation modules. Some of those modules are generic gameplay/core logic, while others are Zdesagochi defaults or runtime adapters. Moving them together would blur the core/preset boundary.

### Decision

Move generic gameplay implementation modules into `packages/personality-core/src` first:

- action/passive/decay/pattern/gameplay-state rules;
- emergent state definitions;
- state layer helpers;
- deterministic clone/random helpers;
- `PersonalityEngine`;
- `TraitEvolutionEngine`;
- `personalityTraitMap`.

Keep legacy `src/personality` paths as shims. Leave `personalities`, `influenceRegistry`, and `memoryTextGenerator` as explicit remaining dependencies for the next preset/runtime defaults slice.

### Why

This reduces package command execution dependency on legacy source layout while avoiding the wrong architectural move of putting Zdesagochi preset data and browser-aware memory generation into generic core by accident.

### Alternatives

- Move `personalities` and `influenceRegistry` into core immediately: rejected, because those are Zdesagochi preset/default data, not generic core.
- Move `memoryTextGenerator` into core unchanged: rejected for now, because it includes browser/device capability probing and needs a cleaner runtime boundary.
- Stop after public API ownership: rejected, because command execution would still be mostly legacy-owned.

### Consequences

Generic gameplay execution is now mostly package-owned. The package is still not standalone, but the remaining imports are narrower and semantically meaningful: preset/default registry and memory text generation.

### Verification

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`
- Boundary `rg` checks for app API imports, storage/browser symbols, app adapter bypasses, and remaining `src/personality` imports from package core.

### Next

Extract Zdesagochi preset/default dependencies by moving or injecting `personalities`, `influenceRegistry`, and `memoryTextGenerator` through preset/runtime boundaries.

---

## DEC-0012: Inject preset/runtime defaults into core instead of importing them

Status: accepted  
Date: 2026-05-14  
Related files: `packages/personality-core/src/coreState.ts`, `packages/personality-core/src/engineFactory.ts`, `packages/personality-core/src/commandHandlers.ts`, `packages/personality-core/src/TraitEvolutionEngine.ts`, `src/personality/commandHandlers.ts`, `src/personality/engineFacade.ts`, `src/personality/TraitEvolutionEngine.ts`, `src/personality/zdesagochiPetPreset.ts`  
Related roadmap item: Physical source ownership / package readiness

### Context

After generic gameplay implementation moved into `packages/personality-core/src`, the core package still imported legacy Zdesagochi defaults: personality definitions, influence registry, and browser-aware memory text generation. Moving those into core would make the package less reusable and violate the core/preset split.

### Decision

Make preset/runtime defaults injectable:

- add `personalities` to `PersonalityRuntime` and `PersonalityEngineConfig`;
- require `personalities` and `influenceRegistry` for core command execution;
- add `personalities` to `TraitEvolutionContext`;
- keep core fallback memory text generation minimal and storage/browser-free;
- update `zdesagochiPetPreset` to provide `PERSONALITIES`;
- keep legacy `src/personality` wrappers that inject Zdesagochi defaults for old imports.

### Why

Generic core should not import Zdesagochi preset data or browser-aware runtime adapters. Injection makes the reusable boundary explicit while preserving current app behavior through compatibility wrappers.

### Alternatives

- Move `personalities` and `influenceRegistry` into core: rejected, because they are Zdesagochi defaults.
- Leave core importing `src/personality`: rejected, because package core would not be standalone.
- Break legacy `src/personality` callers immediately: rejected, because the app and existing tests still use those paths.

### Consequences

`packages/personality-core/src` no longer imports `src/personality`. Consumers using core directly must provide preset/runtime data through config or runtime. Existing app paths keep working through wrappers that inject Zdesagochi defaults.

### Verification

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`
- `rg "../../../src/personality" packages/personality-core/src` returns no matches.
- Boundary checks confirm no app API imports or storage/browser symbols in package core.

### Next

Move Zdesagochi preset ownership into `packages/personality-pet-preset/src`, including personality data/default registry wrappers, while keeping app-facing legacy imports as compatibility shims.

---

## DEC-0013: Make Zdesagochi preset package the physical owner of preset defaults

Status: accepted  
Date: 2026-05-14  
Related files: `packages/personality-pet-preset/src/personalities.ts`, `packages/personality-pet-preset/src/influenceRegistry.ts`, `packages/personality-pet-preset/src/memoryTextGenerator.ts`, `packages/personality-pet-preset/src/zdesagochiPetPreset.ts`, `packages/personality-pet-preset/src/index.ts`, `src/personality/personalities.ts`, `src/personality/influenceRegistry.ts`, `src/personality/memoryTextGenerator.ts`, `src/personality/zdesagochiPetPreset.ts`  
Related roadmap item: Physical source ownership / package readiness

### Context

After core stopped importing Zdesagochi defaults, the preset package still re-exported legacy `src/personality/zdesagochiPetPreset`. That meant package boundaries were clean in the generic core, but the Zdesagochi preset package did not yet own its own data/defaults.

### Decision

Move Zdesagochi preset defaults into `packages/personality-pet-preset/src`:

- personality registry and lookup helpers;
- static/remote influence registry helpers;
- memory text generator runtime default;
- `zdesagochiPetPreset`;
- package-local preset entrypoint exports.

Keep old `src/personality/*` files as compatibility shims that re-export package-owned modules.

### Why

This preserves the strangler path: package code becomes the real source owner first, while app/UI imports continue working through stable legacy paths until they are migrated deliberately.

### Alternatives

- Migrate every app/UI import in the same step: rejected, because it would mix source ownership with app integration churn.
- Put Zdesagochi data in `personality-core`: rejected, because those defaults are product preset data, not reusable generic core.
- Leave preset as a re-export of `src/personality`: rejected, because it hides the remaining physical ownership problem.

### Consequences

`packages/personality-pet-preset/src` no longer imports `src/personality`. Existing compatibility paths in `src/personality/*` still work, but those paths are now shims over preset-owned files. App/UI consumers that need Zdesagochi defaults now import the preset package entrypoint directly. The preset package still includes browser-aware runtime defaults such as on-device memory generation and remote influence fetching; those remain outside generic core.

### Verification

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`
- Boundary `rg` checks for legacy `src/personality` imports from packages, app API type imports, storage symbols, and remaining legacy default imports from app/UI.

### Next

Harden package build/export boundaries and reduce the remaining broad `src/personality/index.ts` compatibility surface.

---

## DEC-0014: Enforce package boundaries in the test flow

Status: accepted  
Date: 2026-05-14  
Related files: `tsconfig.packages.json`, `scripts/check-personality-package-boundaries.mjs`, `package.json`  
Related roadmap item: Package hardening / library extraction

### Context

Core and preset source ownership had moved under `packages/`, but boundary validation still depended on manual `rg` checks. The root app typecheck includes `src` and only checks package files that are reached from app imports, so package regressions could be missed until later extraction work.

### Decision

Add automated package hardening checks:

- `tsconfig.packages.json` typechecks `packages/**/*.ts` directly;
- `npm run typecheck:packages` runs that package-only typecheck;
- `scripts/check-personality-package-boundaries.mjs` enforces forbidden package dependencies and legacy default import rules;
- `npm test` runs both checks before the personality tests and quickstart demo.

### Why

The project can stay in a strangler layout while still getting feedback close to a real library boundary. This catches accidental app/storage/legacy imports in package code before package publishing exists.

### Alternatives

- Create full npm package manifests and builds immediately: deferred, because the repo is not publishing packages yet and runtime imports still intentionally point at source entrypoints.
- Keep manual `rg` checks only: rejected, because they are easy to forget and do not protect future changes.
- Remove `src/personality/index.ts` now: rejected, because it still provides compatibility exports and default-injecting wrappers used by legacy tests/callers.

### Consequences

`npm test` is slightly longer but now validates package boundaries by default. The remaining broad `src/personality/index.ts` compatibility surface is explicit technical debt for the next slice, not an untracked risk.

### Verification

- `npm run check:personality-boundaries`
- `npm run typecheck:packages`
- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`

### Next

Reduce `src/personality/index.ts` compatibility surface by moving remaining tests/callers to package entrypoints or explicit legacy wrapper modules.

---

## DEC-0015: Forbid broad src/personality imports from app and tests

Status: accepted  
Date: 2026-05-14  
Related files: `tests/balanceSimulationReport.ts`, `tests/e2eSimulation.test.ts`, `tests/personalityEvolution.test.ts`, `src/api/mockApi.ts`, `scripts/check-personality-package-boundaries.mjs`  
Related roadmap item: Compatibility surface reduction / library extraction

### Context

After package boundaries were automated, app/tests still imported the broad `src/personality` compatibility index. That index mixes generic core exports, Zdesagochi default-injecting wrappers, and legacy compatibility shims, making it hard to see what each caller actually depends on.

### Decision

Move broad-index callers to explicit imports:

- generic public command/storage/version types from `packages/personality-core/src`;
- Zdesagochi default-injecting command/evolution behavior from explicit `src/personality/commandHandlers`, `engineFacade`, or `TraitEvolutionEngine` wrappers;
- state-layer helpers from explicit modules.

Update the package boundary check to fail on new broad `src/personality` imports from app/tests.

### Why

The broad index is useful as temporary compatibility surface, but it should not be a normal integration path. Explicit imports make the remaining legacy behavior visible and keep package public API usage honest.

### Alternatives

- Delete `src/personality/index.ts`: deferred, because keeping it avoids a risky compatibility break while extraction is still in progress.
- Move every caller directly to `personality-core`: rejected, because some callers intentionally need Zdesagochi default injection from legacy wrappers.
- Leave broad imports and rely on discipline: rejected, because the boundary check can enforce the rule automatically.

### Consequences

App/tests no longer import the broad compatibility index. Remaining legacy wrappers are explicit and purposeful. The next extraction step can focus on formal package metadata/export maps instead of untangling mixed import intent.

### Verification

- `npm run check:personality-boundaries`
- `npm run typecheck:packages`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `npm run simulate:balance`

### Next

Add explicit package manifests/export maps or document a package entrypoint policy for `personality-core` and `personality-pet-preset` without publishing.

---

## DEC-0016: Add private source-only package manifests

Status: accepted  
Date: 2026-05-14  
Related files: `packages/personality-core/package.json`, `packages/personality-pet-preset/package.json`, `docs/personality_engine_package_entrypoints.md`, `scripts/check-personality-package-boundaries.mjs`  
Related roadmap item: Package manifest/export hardening / library extraction

### Context

Core and preset code had package source ownership, package-only typecheck, and guarded imports, but package identity and entrypoint policy were still implicit. The repo is not ready to publish packages or switch app runtime imports to package names yet.

### Decision

Add private source-only manifests for the two package units:

- `@zdesagochi/personality-core`;
- `@zdesagochi/personality-pet-preset`.

Both manifests are intentionally private, use `0.0.0-private`, and expose only `./src/index.ts` as the current source entrypoint. Add `docs/personality_engine_package_entrypoints.md` to document the import policy and pre-publish requirements. Extend the boundary check to validate the manifest policy.

### Why

This creates explicit package identity and public entrypoint metadata without pretending the packages are publishable artifacts. It preserves the current source-import workflow while making the next library extraction step concrete.

### Alternatives

- Publish or prepare full build artifacts now: rejected, because declaration generation, package-name resolution, and package integration tests are not ready.
- Skip manifests until the final publish step: rejected, because entrypoint policy would remain implicit and easy to drift.
- Switch app imports to package names immediately: deferred, because local resolver configuration should be proven in a controlled non-runtime path first.

### Consequences

Package boundaries are now represented in source layout, tests, docs, and package metadata. The manifests are private and guarded, so this does not publish packages or change runtime behavior.

### Verification

- `npm run check:personality-boundaries`
- `npm run typecheck:packages`
- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`

### Next

Pilot package-name imports in one non-runtime demo/test path or add local resolver config, without replacing app runtime relative source imports yet.

---

## DEC-0017: Prove package-name imports in a non-runtime demo first

Status: accepted  
Date: 2026-05-14  
Related files: `scripts/personality-package-name-import-demo.mjs`, `package.json`  
Related roadmap item: Package-name import pilot / library extraction

### Context

Private source-only manifests introduced future package names, but app/runtime imports still use relative source paths. Switching runtime imports to package names before resolver/build policy is settled would be a risky integration change.

### Decision

Add a controlled non-runtime demo that imports:

- `@zdesagochi/personality-core`;
- `@zdesagochi/personality-pet-preset`.

The demo uses an esbuild resolver plugin to map package names to the current source entrypoints, then validates that the public entrypoints can create a Zdesagochi personality engine. Include the demo in `npm test`.

### Why

This proves package-name consumption and entrypoint shape without changing app runtime imports or pretending packages are published/build-output artifacts.

### Alternatives

- Add Vite/TypeScript aliases and migrate app imports immediately: deferred, because runtime import migration should be a separate decision.
- Use Node package resolution directly: not available yet because the repo has not configured workspaces/install-time linking for these private packages.
- Skip the pilot: rejected, because package names would remain metadata only.

### Consequences

`npm test` now proves package-name imports in a controlled path. App runtime imports remain unchanged until an explicit resolver/build decision is made.

### Verification

- `npm run demo:personality-package-imports`
- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run simulate:balance`

### Next

Decide whether to add app/runtime resolver aliases for package names now, or keep relative source imports until generated package build output exists.
