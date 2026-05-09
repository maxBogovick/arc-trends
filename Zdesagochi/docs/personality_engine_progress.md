# Personality Engine Progress Log

> Дата создания: 2026-05-09  
> Назначение: единый файл процесса. Перед любой работой по движку характера сначала читать этот файл, затем `docs/personality_engine_coding_rules.md`, затем `docs/personality_engine_next_steps.md`.

---

## 1. Обязательная команда для Codex

Перед началом любой задачи по personality engine:

```text
Сначала прочитай docs/personality_engine_progress.md, docs/personality_engine_coding_rules.md и docs/personality_engine_next_steps.md. После этого скажи, какой текущий шаг, почему он следующий, какие проверки будут выполнены и как этот шаг двигает нас к конечной цели.
```

Эта команда является рабочим правилом для всех следующих сессий.

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
5. какой следующий шаг.

---

## 5. Roadmap Status

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
  - this progress log.

### Current Step

Sprint 1 — Cleanup before refactor.

Goal:

- remove misleading/noop code;
- make actual behavior clear before data-driven migration;
- prevent false assumptions during refactor.

Concrete tasks:

1. Remove `anxiousMult` noop.
2. Remove melancholic XP noop or move semantics into command/gameplay outcome.
3. Resolve `perfect_balance` mismatch.
4. Decide/handle `chaos_surge`.
5. Add validator for unsupported `specialRules`.

### Next Step

Start with:

> Remove `anxiousMult` noop and update/comment tests if needed.

Why first:

- it is low-risk;
- it removes misleading logic;
- it prepares `PersonalityEngine` for data-driven migration.

---

## 6. Verification Log

Latest known verification:

```bash
npm test
npm run build
```

Status:

- passed after CRIT-1 closure;
- Vite chunk size warning remains non-blocking.

Latest domain-internal check:

```bash
rg "applyPetInfluence|applyInfluence|canApplyInfluenceAtSync|checkThresholdCrossings|getInfluenceRegistry|updateCounters|runPatternEngine|computeEmergentState|applyDecay|computeNaturalPassives" src/api/mockApi.ts
```

Status:

- no matches for direct personality internals after CRIT-1 closure.

---

## 7. Open Risks

1. `PersonalityEngine.ts` still has hardcoded personality IDs.
2. `mockApi.ts` still calculates full gameplay/economy outcome.
3. `PetCommandResult` does not yet own full stat/xp/coin outcome.
4. System influences in registry are not applied by a generic sync pass.
5. Domain events are not durable/complete enough for explainability.
6. UI/product layer does not yet expose the full evolution system.
7. Simulation reports do not exist yet.

---

## 8. How To Update This File

At the end of each personality-engine task:

1. Add completed work to `Completed`.
2. Move `Current Step` if the sprint changes.
3. Update `Next Step`.
4. Add or remove `Open Risks`.
5. Update `Verification Log`.

Keep this file factual. Do not use it for speculative ideas; put those in `docs/personality_engine_v5_gap_analysis.md` or `docs/personality_engine_next_steps.md`.

