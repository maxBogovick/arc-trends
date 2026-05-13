# Library Extraction Handoff

> Date: 2026-05-13  
> Purpose: start the next Codex session directly on library extraction work.

## Start Here

Read these files in order:

1. `docs/personality_engine_library_extraction_playbook.md`
2. `docs/personality_engine_progress.md`
3. `docs/personality_engine_next_steps.md`

Current active goal:

```text
Library extraction — Iteration 1: PersonalityState boundary
```

Do not start with package moves. Do not create `packages/` yet.

## First Task

Implement:

```text
Create PersonalityState and app Pet adapter without moving packages yet.
```

Expected files:

- `src/personality/coreState.ts`
- `src/api/personalityPetAdapter.ts`
- optional `src/personality/engineFacade.ts`
- targeted tests in `tests/personalityEvolution.test.ts`

Important placement rule:

- `PersonalityState` can live in `src/personality`.
- Any adapter importing app `Pet` from `src/api/types` must live outside future core, preferably `src/api/personalityPetAdapter.ts`.
- Do not create `src/personality/appPetAdapter.ts`.

## Current Known Boundary Problems

These are expected at the start of Iteration 1:

```text
src/personality/commandHandlers.ts imports app Pet/PetMood from ../api/types
src/personality/commands.ts imports app Pet from ../api/types
src/personality/TraitEvolutionEngine.ts imports app Account/Pet from ../api/types
src/personality/stateLayers.ts imports app Pet from ../api/types
src/personality/offlineStorage.ts contains browser/localStorage adapter
```

Do not try to remove all of them in one slice.

Iteration 1 should only introduce the boundary and adapter.

## Required Guardrails

- No gameplay balance changes.
- No broad expected-value test rewrites.
- No package publishing.
- No `mockApi` in core.
- No storage/sync/backend adapter in core.
- No new core file may import `src/api/types`.
- Existing app must keep working.

## Boundary Checks

Run before and after the slice:

```bash
rg -n "from '../api/types'|from '../../api/types'|src/api/types" src/personality
rg -n "mockApi|PetService|LocalSave|SyncQueue|BackendReplayServerApi|createBrowserOfflineStorage|localStorage" src/personality
```

Expected after Iteration 1:

- Existing legacy matches may remain.
- New `coreState.ts` must not import app API types.
- App adapter may import app API types because it lives outside core.

## Verification

Run:

```bash
npm test
npx tsc --noEmit
npm run build
npm run simulate:balance
```

Build may keep the existing Vite chunk-size warning.

## Minimal Success Criteria

Iteration 1 is done when:

- `PersonalityState` exists.
- App `Pet -> PersonalityState -> app Pet` adapter exists.
- A contract test proves the roundtrip preserves required personality fields.
- Existing command path still passes tests.
- No gameplay numbers changed.

## Suggested First Test

Add one boundary contract test, not many behavior tests:

```text
personality pet adapter roundtrips engine-owned fields
```

It should verify:

- stats;
- personality;
- traitVector;
- behavioralCounters;
- behavioralFlags;
- stateLayers/emergentState;
- evolution fields;
- memories;
- sleep fields.

Do not include shop, quests, achievements, UI events, or inventory unless the command runtime truly needs them.

## Copy-Paste Prompt For New Session

```text
Начни Iteration 1 из docs/personality_engine_library_extraction_playbook.md.

Задача: создать PersonalityState boundary и app-side Pet adapter без переноса в packages.

Сначала прочитай:
1. docs/personality_engine_library_extraction_playbook.md
2. docs/personality_engine_progress.md
3. docs/personality_engine_library_extraction_handoff.md

Соблюдай ограничения:
- не менять gameplay balance;
- не делать rewrite;
- не создавать packages пока;
- app Pet adapter не класть в src/personality;
- новый core файл не должен импортировать src/api/types.

После изменений запусти:
npm test
npx tsc --noEmit
npm run build
npm run simulate:balance
```

