# Personality Engine Progress Log

> Дата создания: 2026-05-09  
> Назначение: единый файл процесса. Перед любой работой по движку характера сначала читать этот файл, затем `docs/personality_engine_coding_rules.md`, затем `docs/personality_engine_next_steps.md`.
> Архитектурные решения фиксировать в `docs/personality_engine_decisions.md`.
> MVP backlog и текущий источник задач: `docs/personality_engine_master_backlog.md`.

---

## 1. Обязательная команда для Codex

Перед началом любой задачи по personality engine:

```text
Сначала прочитай docs/personality_engine_progress.md, docs/personality_engine_coding_rules.md, docs/personality_engine_next_steps.md и при архитектурных изменениях docs/personality_engine_decisions.md. После этого скажи, какой текущий шаг, почему он следующий, какие проверки будут выполнены и как этот шаг двигает нас к конечной цели.
```

Эта команда является рабочим правилом для всех следующих сессий.

Для выбора задач использовать `docs/personality_engine_master_backlog.md` как полный backlog.

---

## 2. Конечная цель

Движок характера готов, когда:

1. История ухода за питомцем воспроизводимо меняет его характер.
2. Изменения объяснимы через domain events и Core Memories.
3. Новый характер/состояние/правило добавляется как data, без новых `if personality.id === ...`.
4. `applyPersonalityCommand()` является authoritative domain entrypoint.
5. Mock/backend/replay используют один command outcome.
6. `mockApi` не содержит personality/gameplay internals.
7. `stateLayers` являются public source of truth для active states.
8. Все обещания `PERSONALITY_EVOLUTION_SYSTEM.md` либо реализованы, либо явно удалены из docs.
9. Есть simulation reports по скорости и балансу.
10. `npm test` и `npm run build` стабильно проходят.

---

## 3. Текущий вектор

Текущий правильный вектор:

> Уменьшать hardcoded personality/gameplay logic, переносить поведение в data registry, расширять command pipeline как единый source of truth, добавлять events/explainability и проверять всё тестами.

Если задача требует:

- добавить новый `personality.id === ...`;
- продублировать логику в `mockApi`;
- изменить поведение без events/tests;
- оставить обещание в docs без реализации/roadmap;

то это отклонение от вектора. Нужно сразу сообщить пользователю и предложить data-driven/command-layer альтернативу.

---

## 4. Обязательный цикл работы

Каждая задача выполняется только через этот цикл.

### Step A. Read

Прочитать:

1. `docs/personality_engine_progress.md`
2. `docs/personality_engine_coding_rules.md`
3. `docs/personality_engine_next_steps.md`
4. релевантные файлы кода

Выход:

- назвать текущий roadmap step;
- назвать ближайшую concrete task;
- сказать, почему она следующая;
- сказать, как она помогает конечной цели.

### Step B. Check Vector

Перед кодом ответить:

1. Это уменьшает hardcoded logic?
2. Это переносит behavior в registry/data?
3. Это усиливает `applyPersonalityCommand()`?
4. Это убирает domain logic из adapter?
5. Это добавляет explainability/events?
6. Это закрывает расхождение с `PERSONALITY_EVOLUTION_SYSTEM.md`?

Выход:

- если вектор правильный: явно сказать “вектор правильный” и почему;
- если есть отклонение: сразу сказать, где отклонение, и не продолжать без корректировки.

### Step C. Plan

Сформулировать короткий план:

1. какие файлы будут изменены;
2. какие tests/commands будут запущены;
3. какой acceptance criterion.

### Step D. Implement

Делать изменения маленькими шагами.

После каждого завершенного подшага сообщать пользователю:

- что сделано;
- какую цель это приближает;
- есть ли риск отклонения;
- какой следующий подшаг.

### Step E. Verify

Минимальные проверки:

```bash
npm test
npm run build
```

Дополнительные проверки по типу задачи:

```bash
rg "personality\\.id ===|personality\\.id !==" src/personality/PersonalityEngine.ts src/personality/commandHandlers.ts src/api/mockApi.ts
rg "applyInfluence|canApplyInfluenceAtSync|checkThresholdCrossings|updateCounters|runPatternEngine|computeEmergentState|applyDecay|computeNaturalPassives|getInfluenceRegistry" src/api/mockApi.ts
```

Правило:

- если проверка не запускалась, в финальном ответе явно сказать почему;
- если проверка упала, не скрывать, а описать причину и следующий fix.

### Step F. Update Progress

В конце каждой задачи обновить этот файл:

- `Completed`;
- `Current Step`;
- `Next Step`;
- `Open Risks`;
- `Verification Log`.

### Step G. Final Report

В финальном ответе всегда указать:

1. что сделано;
2. чем это помогло конечной цели;
3. подтверждение вектора:
   - “Идем по правильному вектору”;
   - или “Есть отклонение: ...”;
4. какие проверки выполнены;
5. какой следующий шаг;
6. почему следующий шаг именно такой;
7. что следующий шаг даст конечной цели;
8. что будет плохо, если следующий шаг пропустить;
9. как проверить, что следующий шаг выполнен правильно.

Запрещено завершать ответ короткой строкой вида:

```text
Следующий шаг: ...
```

Любое упоминание следующего шага должно использовать формат из раздела `Mandatory Next Step Format`.

---

## 5. Control Dashboard

| Field | Current Value |
|---|---|
| Current Goal | Выделить движок характера в переиспользуемую библиотеку |
| Current Step | Package-name import pilot complete; next is app runtime resolver decision |
| Why This Step | A non-runtime demo now consumes `@zdesagochi/personality-core` and `@zdesagochi/personality-pet-preset` through controlled package-name resolution |
| Current Vector | Правильный: strangler extraction без rewrite, без изменения gameplay balance |
| Next Step | Decide whether to add app/runtime resolver aliases for package names or keep relative source imports until real package build output exists |
| Why Next | Package-name consumption is proven in a demo; changing app runtime imports now requires an explicit resolver/build policy decision |
| Required Verification | `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run simulate:balance`, boundary `rg` checks |

---

## 6. Last Completed Step

### What

Закрыт package-name import pilot slice.

### Why

После package manifest/export hardening пакеты получили names and source-only exports, but package-name consumption was still unproven. Следующим шагом было проверить package-name imports в контролируемом non-runtime path без изменения app runtime imports.

### Impact

Сделано:

- `scripts/personality-package-name-import-demo.mjs` imports `@zdesagochi/personality-core` and `@zdesagochi/personality-pet-preset`;
- the demo uses an esbuild resolver plugin that maps those names to current source entrypoints;
- `npm run demo:personality-package-imports` runs the pilot directly;
- `npm test` now includes the package-name import demo after the existing quickstart demo.

Review after implementation:

- app/runtime imports remain relative source imports;
- package-name resolution is proven only in a controlled non-runtime script;
- the pilot validates public entrypoint consumption by creating an engine from package-name imports and checking preset config validation;
- no resolver aliases were added to Vite/TypeScript app runtime yet.

No gameplay constants, registry values, or balance formulas were changed.

### Verification

- `npm test` — passed.
- `npx tsc --noEmit` — passed.
- `npm run build` — passed; existing Vite chunk-size warning remains non-blocking.
- `npm run simulate:balance` — passed and refreshed `docs/reports/personality_balance_report.md`.
- `npm run check:personality-boundaries` — passed and is now part of `npm test`.
- `npm run typecheck:packages` — passed and is now part of `npm test`.
- `npm run demo:personality-package-imports` — passed and is now part of `npm test`.
- Boundary `rg` check:
  - `src/personality`, `packages/personality-core`, and `packages/personality-pet-preset` no longer contain `createBrowserOfflineStorage`, `localStorage`, `OfflineKeyValueStorage`, `saveOfflinePetSave`, or `loadOfflinePetSave`;
  - `packages/personality-core`, `packages/personality-pet-preset`, and `src/personality` do not import `src/api/types`.
  - `packages/personality-core/src` and `packages/personality-pet-preset/src` no longer import `src/personality`.
  - App/UI consumers no longer import legacy `src/personality/personalities`, `src/personality/influenceRegistry`, or `src/personality/memoryTextGenerator`; only compatibility exports and local package internals remain.
  - App/tests no longer import broad `src/personality` compatibility index.
  - Package manifests remain private source-only manifests with `./src/index.ts` exports.

### Next

App runtime resolver decision.

### Why Next

Core and preset package names are proven in a controlled demo, but app/runtime still uses relative source imports. Следующий blocker — deciding whether to add resolver aliases now or wait for generated package build output before runtime migration.

---

## 7. Required Closeout Format

Каждая завершенная задача должна обновлять `Last Completed Step` в этом формате:

```md
### What
Что сделали.

### Why
Почему это нужно было сделать.

### Impact
Как это приблизило конечную цель.

### Verification
Что проверили и какой результат.

### Next
Следующий шаг.

### Why Next
Почему следующий шаг именно такой.
```

Если задача включала архитектурное решение, добавить запись в `docs/personality_engine_decisions.md`.

---

## 8. Mandatory Next Step Format

Каждый финальный ответ и каждое промежуточное сообщение, где называется следующий шаг, обязано содержать:

```md
### Next Step
Что делать следующим.

### Why Next
Почему именно этот шаг следующий, а не другой.

### Expected Impact
Что этот шаг даст конечной цели движка.

### Risk If Skipped
Что будет плохо, если этот шаг пропустить.

### Verification
Как понять, что следующий шаг выполнен правильно.
```

Ответ считается неполным, если после слов “следующий шаг” нет `Why Next`, `Expected Impact`, `Risk If Skipped` и `Verification`.

---

## 9. Roadmap Status

### Completed

- P0 audit bugs closed:
  - `enlightenmentActive`;
  - `stoicPeakUsed`;
  - `allStatsAbove`;
  - deterministic state tie-breaker;
  - `feast_frenzy` feed window.
- CRIT-1 closed:
  - `applyPersonalityCommand()` owns personality-side gameplay pipeline;
  - gameplay state writes through `stateLayers`;
  - `mockApi.finalizePet()` no longer mutates gameplay state;
  - `use_item` food fallback moved to command layer;
  - `applyPetInfluence()` removed from `mockApi`;
  - direct influence internals removed from `mockApi`.
- Documentation added:
  - `docs/personality_engine_v5_gap_analysis.md`;
  - `docs/personality_engine_coding_rules.md`;
  - `docs/personality_engine_decisions.md`;
  - this progress log.

### Historical Snapshot

This section is retained as the original MVP-1 work log. The current dashboard in section 5 is the active source of truth.

MVP-1 — Full Command Outcome. Done.

Goal:

- make `applyPersonalityCommand()` return full gameplay outcome;
- move base stat/xp/coin calculation out of `mockApi`;
- keep offline playable through local save + command log;
- make future backend sync use the same command result.

Concrete tasks:

1. Remove `anxiousMult` noop. Done.
2. Remove melancholic XP noop or move semantics into command/gameplay outcome. Done: noop removed; real semantic move remains part of P3 command outcome.
3. Resolve `perfect_balance` mismatch. Done: XP-only semantics documented and tested.
4. Decide/handle `chaos_surge`. Done: deterministic 3-hour activation implemented and tested.
5. Add validator for unsupported `specialRules`. Done: unknown/deferred/adapter-owned rules are validated.

Sprint 1 status: Done.

MVP blocking order:

1. Full Command Outcome first. Blocks replacing `mockApi`, offline/backend parity, full replay.
2. Offline shell second. Blocks usable offline-first sync path.
3. Minimum explainability third. Blocks understandable MVP.
4. Data-driven states, simulations, UI polish after MVP.

MVP-1 concrete tasks:

1. Extend `PetCommandResult` with `statDeltas`, `xpDelta`, `coinDelta`, `blockedAction`, `appliedModifiers`.
2. Move `play` outcome from `mockApi` into command/gameplay layer.
3. Move `feed` outcome.
4. Move `bathe/heal/bond`.
5. Move `sleep/wake`.
6. Move `use_item`.
7. Add replay/full outcome regression tests.

### Historical Next Step

Start with:

> MVP-1.1 — Extend `PetCommandResult` with full gameplay outcome fields.

Why first:

- it is the hard blocker for replacing `mockApi`;
- without it offline can save commands but cannot replay exact stats/XP/coins;
- it creates the contract that LocalSave, SyncQueue and future BackendApi will use.

---

## 10. Verification Log

Latest known verification:

```bash
npm test
npx tsc --noEmit
npm run build
npm run simulate:balance
```

Status:

- passed after Library extraction Iteration 4;
- Vite chunk size warning remains non-blocking.

Latest cleanup check:

```bash
rg "validatePersonalitySpecialRules|SPECIAL_RULE_SUPPORT|unsupportedRule|playThirstEnabled|newRoomBonusEnabled" src/personality/personalities.ts tests/personalityEvolution.test.ts
```

Status:

- validator and tests present.

Latest domain-internal check:

```bash
rg "applyPetInfluence|applyInfluence|canApplyInfluenceAtSync|checkThresholdCrossings|getInfluenceRegistry|updateCounters|runPatternEngine|computeEmergentState|applyDecay|computeNaturalPassives" src/api/mockApi.ts
```

Status:

- no matches for direct personality internals after CRIT-1 closure.

---

## 11. Open Risks

1. Production backend transport/storage/auth is not implemented yet.
2. Server-side economy/inventory/rewards confirmation is not implemented yet.
3. Generic lifecycle `onApply` hooks are not fully data-driven yet.
4. Action/passive/decay rule registries are still partial; some behavior remains hardcoded.
5. UI/product layer does not yet expose the full evolution system.
6. Balance proof is deterministic for core scenarios; broader Monte Carlo/edge-case reports are still needed.
7. Physical implementations still mostly live under `src/personality`; package-like exports are clean but not yet true package source ownership.
8. Public schema version and migration entrypoint are not implemented yet.

---

## 12. How To Update This File

At the end of each personality-engine task:

1. Update `Last Completed Step`.
2. Add completed work to `Completed` if it changed roadmap status.
3. Move `Current Step` if the sprint changes.
4. Update `Next Step`.
5. Add or remove `Open Risks`.
6. Update `Verification Log`.
7. Add a decision to `docs/personality_engine_decisions.md` if the task made an architectural choice.

Keep this file factual. Do not use it for speculative ideas; put those in `docs/personality_engine_v5_gap_analysis.md` or `docs/personality_engine_next_steps.md`.
