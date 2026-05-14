# Library Extraction Handoff

> Date: 2026-05-14  
> Purpose: start the next Codex session directly on the current library extraction work.

## Start Here

Read these files in order:

1. `docs/personality_engine_library_extraction_playbook.md`
2. `docs/personality_engine_progress.md`
3. `docs/personality_engine_next_steps.md`

Current active goal:

```text
Library extraction — app runtime resolver decision
```

Do not rewrite gameplay. Do not change balance constants. Do not publish packages.

## First Task

Implement:

```text
Decide whether to add app/runtime resolver aliases for package names now, or keep relative source imports until generated package build output exists.
```

Expected files:

- TypeScript/Vite resolver config if choosing source alias migration;
- package build/declaration config if choosing build-output first;
- package entrypoint docs if policy changes;
- boundary check updates if app runtime package-name imports become allowed.

Important placement rule:

- `packages/personality-core/src` must not import `src/personality`, app API, storage, UI, or browser persistence.
- `packages/personality-pet-preset/src` must not import legacy `src/personality` or app API types.
- `src/personality/*` compatibility shims may remain during migration.

## Current Known Boundary Problems

Current expected state:

```text
packages/personality-core/src owns generic engine/state/command implementation
packages/personality-pet-preset/src owns Zdesagochi personalities, influence registry, memory generator, and zdesagochiPetPreset
app/UI consumers of Zdesagochi defaults import packages/personality-pet-preset/src directly
npm test runs package boundary checks and package-only typecheck
app/tests no longer import the broad src/personality index
packages have private source-only manifests with `./src/index.ts` exports
`npm test` proves package-name imports in `scripts/personality-package-name-import-demo.mjs`
src/personality/* still contains explicit compatibility shims/wrappers
```

Do not publish packages. If changing app runtime imports to package names, configure and verify TypeScript and Vite resolution in the same slice.

## Required Guardrails

- No gameplay balance changes.
- No broad expected-value test rewrites.
- No package publishing.
- No `mockApi` in core.
- No storage/sync/backend adapter in core.
- No core or preset file may import `src/api/types`.
- Existing app must keep working.

## Boundary Checks

Run before and after the slice:

```bash
rg -n "from '../api/types'|from '../../api/types'|src/api/types" src/personality
rg -n "mockApi|PetService|LocalSave|SyncQueue|BackendReplayServerApi|createBrowserOfflineStorage|localStorage" src/personality
rg -n "../../../src/personality|../../src/personality|src/personality" packages/personality-core/src packages/personality-pet-preset/src
rg -n "from ['\"](?:\\.\\./)+(?:src/)?personality['\"]" src tests packages
npm run check:personality-boundaries
npm run typecheck:packages
```

Expected:

- no `src/api/types` imports from core/preset/personality modules;
- no `src/personality` imports from package modules;
- app adapters may import app API types because they live outside core.

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

Next slice is done when:

- resolver direction is explicit: source aliases now, or build output first;
- if source aliases are added, TypeScript and Vite both resolve package names and full verification passes;
- if build output is chosen first, the blocker and concrete build-output plan are documented;
- private package manifest policy remains enforced;
- full verification passes;
- no gameplay numbers changed.

## Copy-Paste Prompt For New Session

```text
Продолжи library extraction.

Сначала прочитай:
1. docs/personality_engine_library_extraction_playbook.md
2. docs/personality_engine_progress.md
3. docs/personality_engine_library_extraction_handoff.md

Задача: app runtime resolver decision: решить, добавлять ли TypeScript/Vite aliases для package-name imports сейчас или сначала делать build output/declaration pipeline. Если меняешь runtime imports, настрой resolver и прогони все проверки. Не публиковать packages.

Соблюдай ограничения:
- не менять gameplay balance;
- не делать rewrite;
- не публиковать packages;
- core/preset не должны импортировать src/api/types;
- core/preset не должны импортировать legacy src/personality.

После изменений запусти:
npm test
npx tsc --noEmit
npm run build
npm run simulate:balance
```
