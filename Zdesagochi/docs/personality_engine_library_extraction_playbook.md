# Personality Engine Library Extraction Playbook

> Date: 2026-05-13  
> Audience: Codex working on this repository.  
> Purpose: operational plan for extracting the current personality engine into a reusable library with minimum iterations, maximum safety, and no big-bang rewrite.

---

## 0. Current Decision

Do **not** rewrite the engine from scratch.

Use **strangler extraction**:

1. Keep the current app working.
2. Introduce a clean library boundary inside the repo.
3. Move pure engine code behind that boundary.
4. Keep Zdesagochi-specific rules as a preset.
5. Move storage/sync/backend adapters only after core is pure.

The target is a library for **virtual pet / companion personality engines**, not a generic AI/NPC framework.

---

## 0.1. Review Notes

This document was reviewed against the current code on 2026-05-13.

Important current facts:

- `src/personality/commands.ts` imports app `Pet` from `../api/types`.
- `src/personality/commandHandlers.ts` imports app `Pet` / `PetMood` from `../api/types`.
- `src/personality/TraitEvolutionEngine.ts` imports app `Account` / `Pet` from `../api/types`.
- `src/personality/stateLayers.ts` imports app `Pet` from `../api/types`.
- `src/personality/offlineStorage.ts` contains browser/localStorage adapter logic.
- Storage/sync classes already live in `src/api`, which is the right side of the future boundary.

Correction from the first draft:

- Do **not** put an app `Pet` adapter in `src/personality`.
- The adapter that imports app `Pet` must live in `src/api/personalityPetAdapter.ts` or another app-side folder.
- Core may define `PersonalityState`, but app-specific conversion must stay outside core.

---

## 1. North Star

The extraction is done when another project can use the engine like this:

```ts
import { createPersonalityEngine } from '@zdesagochi/personality-core';
import { zdesagochiPetPreset } from '@zdesagochi/personality-pet-preset';

const engine = createPersonalityEngine(zdesagochiPetPreset);
const result = await engine.applyCommand(state, command);
```

Without importing:

- `mockApi`;
- React/UI code;
- app `Pet` from `src/api/types`;
- `localStorage`;
- `PetService`;
- Zdesagochi app services.

---

## 2. Hard Constraints

- Do not rewrite from scratch.
- Do not change gameplay balance during extraction.
- Do not publish an npm package until API boundaries are stable.
- Do not move `mockApi` into core.
- Do not move `PetService`, `LocalSave`, `SyncQueue`, or `BackendReplayServerApi` into core.
- Do not expose internal helpers as public API unless a consuming project truly needs them.
- Do not make the engine generic beyond virtual pet / companion use cases.
- Do not delete current app fields until adapters and migrations exist.
- Do not add tests automatically. Add tests only for new contracts, validators, or uncovered risks.

---

## 3. Must Have

The library core must be:

- pure: state in, command in, result out;
- deterministic when given the same command ids, timestamps, config, and RNG;
- storage-agnostic;
- UI-agnostic;
- backend-agnostic;
- config-driven;
- replayable;
- serializable;
- versioned;
- validated.

Public library concepts:

- `PersonalityState`
- `PersonalityCommand`
- `PersonalityCommandResult`
- `PersonalityEvent`
- `PersonalityEngineConfig`
- `PersonalityPreset`
- `createPersonalityEngine(config)`

---

## 4. Must Not Have

Core library must not contain:

- app `Pet` as its public state;
- `Account` from app API as a required concept;
- `mockApi`;
- browser storage;
- local save implementation;
- sync queue implementation;
- server replay adapter;
- React components;
- app routes;
- shop/quest/achievement implementation;
- hard dependency on Zdesagochi-specific skins/UI.

Economy (`xp`, `coins`) may exist in the Zdesagochi pet preset, but the core API should make economy optional/configured, not universal.

---

## 5. Minimal Iteration Plan

### Iteration 1 — State Boundary

Goal: break the direct conceptual dependency between personality core and app `Pet`.

Deliverables:

- Add `PersonalityState`.
- Add `PersonalityRuntime`.
- Add adapter:
  - `toPersonalityState(appPet, account?, coins?)`
  - `fromPersonalityState(personalityState, appPet)`
- Add wrapper:
  - `applyPersonalityStateCommand(state, command, runtime?)`
- Keep current `applyPersonalityCommand(pet, command, options)` as compatibility wrapper.

Required file placement:

- `PersonalityState` may live in `src/personality/coreState.ts`.
- App `Pet` adapter must live outside core, preferably `src/api/personalityPetAdapter.ts`.
- Any file importing `src/api/types` is not core.

Done when:

- app still works;
- current tests pass;
- `PetService` can use the adapter path;
- new boundary contract test proves app `Pet -> PersonalityState -> app Pet` roundtrip preserves required personality fields.

Do not:

- move files to `packages/` yet;
- rename every type;
- remove app `Pet` fields.

---

### Iteration 2 — Engine Factory

Goal: stop core logic from importing default registries directly.

Deliverables:

- Add `createPersonalityEngine(config)`.
- Engine instance exposes:
  - `applyCommand(state, command, runtime?)`
  - `replay(state, commands, runtime?)`
  - `explain(result)`
  - `validateConfig()`
- Move default imports behind a `zdesagochiPetPreset`.

Done when:

- current app creates an engine from preset;
- tests pass using engine instance;
- one test creates a tiny custom preset and applies one command.

Do not:

- support every possible external game shape;
- introduce plugin systems;
- publish package.

---

### Iteration 3 — Package-Like Boundary

Goal: create a physical import boundary without full npm publishing.

Deliverables:

```text
packages/personality-core/src/
packages/personality-pet-preset/src/
```

Move or re-export only pure code:

- commands;
- result/events;
- state;
- engine factory;
- replay;
- registries;
- validators;
- explainability core;
- deterministic helpers.

Keep adapters outside core:

- current app adapter;
- storage;
- sync;
- backend replay.

Done when:

- app imports through package boundary;
- `rg "../api/types" packages/personality-core src/personality` shows no core dependency on app API types;
- tests/build/simulation pass.

---

### Iteration 4 — Storage and Sync Adapters

Goal: separate infrastructure from core.

Deliverables:

- `personality-storage` or app-local adapter module:
  - `LocalSave`
  - `SyncQueue`
  - `ExplainabilityLog` persistence
- `personality-sync` or app-local adapter module:
  - `BackendReplayServerApi`
  - server command ack types

Done when:

- core package can be imported and used without storage/sync modules;
- app still has offline-first flow;
- backend replay adapter uses public core API, not internals.

---

### Iteration 5 — Versioning and Docs

Goal: make the library safe for external consumers.

Deliverables:

- `schemaVersion`;
- `engineVersion`;
- `registryVersion`;
- `migratePersonalityState()`;
- public API docs;
- quickstart;
- replay guarantee docs;
- package exports policy.

Done when:

- a small demo script can import core + preset and run command/replay without app imports.

---

## 6. First Slice To Implement

Start with:

```text
Introduce PersonalityState boundary
```

Files likely needed:

- `src/personality/coreState.ts`
- `src/api/personalityPetAdapter.ts`
- `src/personality/engineFacade.ts`
- tests in `tests/personalityEvolution.test.ts`

Expected implementation:

1. Define `PersonalityState` with only engine-required fields.
2. Copy the current personality-relevant fields from app `Pet`.
3. Include `coins` and `influenceCooldowns` only if required by command execution.
4. Add adapters between app `Pet` and `PersonalityState`.
5. Add a state-command wrapper that converts state to current internal shape, calls existing command engine, and converts back.
6. Keep existing public behavior unchanged.

Boundary checks for this slice:

```bash
rg -n "from '../api/types'|from './types'" src/personality
rg -n "mockApi|localStorage|PetService|LocalSave|SyncQueue|BackendReplayServerApi" src/personality
```

The first command is expected to still find legacy compatibility imports after Iteration 1. It must **not** find app imports in newly created core-state files.

The second command must not find new app infrastructure dependencies in core files.

Minimum verification:

```bash
npm test
npx tsc --noEmit
npm run build
npm run simulate:balance
```

---

## 7. Stop Conditions

Stop and reassess if:

- extraction requires changing gameplay numbers;
- test expected values need broad rewrites;
- adapter starts copying UI/shop/quest/achievement fields;
- any new core file imports `src/api/types`;
- core needs `mockApi`;
- core needs browser APIs;
- public API starts exposing more than 10-15 top-level exports;
- `PersonalityState` becomes identical to app `Pet`.

If any stop condition triggers, narrow the slice.

---

## 8. Public API Draft

```ts
export interface PersonalityEngine {
  applyCommand(
    state: PersonalityState,
    command: PersonalityCommand,
    runtime?: PersonalityRuntime,
  ): Promise<PersonalityCommandResult>;

  replay(
    state: PersonalityState,
    commands: PersonalityCommand[],
    runtime?: PersonalityRuntime,
  ): Promise<PersonalityReplayResult>;

  explain(result: PersonalityCommandResult): CommandExplanation;

  validateConfig(): void;
}

export function createPersonalityEngine(config: PersonalityEngineConfig): PersonalityEngine;
```

Do not expose individual internal evaluators by default.

Allowed public exports:

- types;
- engine factory;
- validators;
- preset;
- test helpers only under `/testing`.

---

## 9. Questions The User Did Not Ask

### Q1. Should this be a generic personality framework?

Best answer: no. Make it a virtual pet / companion engine first.

Reason: the current model is built around care loops, stats, sleep, memories, and evolution. Generalizing now would slow extraction and weaken API clarity.

### Q2. Should current 16 personalities live in core?

Best answer: no. They should live in `personality-pet-preset`.

Core should know how to execute a preset, not own Zdesagochi content.

### Q3. Should storage be part of core?

Best answer: no.

Storage is an adapter. Core must stay pure.

### Q4. Should backend replay be part of core?

Best answer: no.

Backend replay should depend on core. Core should not depend on backend replay.

### Q5. Should economy be required?

Best answer: no for core, yes for Zdesagochi preset.

Core should support optional economy fields because not every companion game uses coins.

### Q6. Should old saves be supported?

Best answer: yes for the app, not necessarily for every external consumer.

Use an app adapter and later a migration layer.

### Q7. What is the biggest extraction risk?

Best answer: accidentally making app `Pet` the public library state.

Avoid this by introducing `PersonalityState` first.

### Q8. What is the second biggest risk?

Best answer: over-exporting internals.

Keep public API narrow and move test-only helpers to `/testing`.

### Q9. Is package extraction more important than production backend?

Best answer: if reuse by other projects matters, yes.

Backend can be an adapter after core boundary exists.

### Q10. What is the fastest useful milestone?

Best answer: app uses `PersonalityState` adapter while all behavior remains unchanged.

That proves the extraction direction without moving the whole codebase.

---

## 10. Execution Rules For Codex

Before coding:

1. Read this file.
2. Read `docs/personality_engine_progress.md`.
3. Check `git status --short`.
4. Identify user changes and do not revert them.

During coding:

1. Prefer adapter/wrapper slices over file moves.
2. Keep behavior-preserving changes separate from behavior changes.
3. Use existing tests as primary safety net.
4. Add tests only for new public contracts or uncovered risks.
5. Do not broaden scope mid-slice.

After coding:

1. Run:

```bash
npm test
npx tsc --noEmit
npm run build
npm run simulate:balance
```

2. Update this playbook only if extraction strategy changes.
3. Update readiness/progress docs if a milestone closes.

---

## 11. Additional Checks The User Did Not Explicitly Ask For

Run these checks when a library-extraction slice claims to improve boundaries.

### Dependency Boundary Check

```bash
rg -n "from '../api/types'|from '../../api/types'|src/api/types" src/personality packages/personality-core
rg -n "mockApi|PetService|LocalSave|SyncQueue|BackendReplayServerApi|createBrowserOfflineStorage|localStorage" src/personality packages/personality-core
```

Expected direction:

- legacy app imports may remain in compatibility wrappers until Iteration 3;
- new core files must not introduce app imports;
- final core package must have zero matches.

### Public Export Check

Before package extraction, inspect:

```bash
sed -n '1,160p' src/personality/index.ts
```

Do not let every internal module become public API. Public exports should be intentionally curated before publishing.

### Consumer Smoke Check

Before saying "library-ready", create a small temporary consumer script that imports only core + preset and runs:

```ts
const engine = createPersonalityEngine(zdesagochiPetPreset);
await engine.applyCommand(state, command);
await engine.replay(state, [command]);
```

This script must not import `src/api`, `mockApi`, React, or storage modules.

### Behavior Preservation Check

For behavior-preserving extraction, expected values should not be rewritten broadly.

Required commands:

```bash
npm test
npx tsc --noEmit
npm run build
npm run simulate:balance
```

If `docs/reports/personality_balance_report.md` changes, inspect whether the metric change is caused by intended logic or by extraction drift.

### API Decision Check

Before adding a new public type or function, answer:

1. Can an external virtual pet project use this without knowing Zdesagochi app internals?
2. Is this stable enough to document?
3. Can it stay internal until a real consumer needs it?

Default answer for helpers: keep internal.

---

## 12. Things The User Forgot To Propose

### Write a Library ADR

Create `docs/adr/0002-personality-library-boundary.md` before physical package extraction.

It should record:

- why strangler extraction was chosen;
- why core targets virtual pet / companion engines;
- what is core vs adapter vs preset;
- public API stability policy.

### Add a Sample Consumer

Eventually add:

```text
examples/personality-core-smoke/
```

This is more valuable than only unit tests because it proves import boundaries.

### Define Semver Policy

Before publishing:

- command schema changes are breaking;
- state schema changes are breaking unless migrated;
- event schema additions are minor;
- preset balance changes are patch/minor depending on product policy.

### Define Error Policy

Decide which library failures throw and which return typed errors.

Recommended:

- config validation throws during setup;
- command application returns typed rejected/blocked results for expected gameplay cases;
- corrupt state/migration failure returns typed error.

### Decide Package Names Early

Working names:

- `@zdesagochi/personality-core`
- `@zdesagochi/personality-pet-preset`
- `@zdesagochi/personality-storage`
- `@zdesagochi/personality-sync`

Names can change before publishing, but code should not assume app paths.

---

## 13. Current Next Action

Implement:

```text
Iteration 1 — State Boundary
```

Concrete next task:

```text
Create PersonalityState and app Pet adapter without moving packages yet.
```

Reason:

This is the smallest step that proves the engine can become a library without freezing the current app-specific `Pet` type into the public API.
