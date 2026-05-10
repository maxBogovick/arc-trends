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
| Current Goal | Довести движок до usable offline-first MVP |
| Current Step | MVP-2 — Offline Shell Without Gameplay Logic |
| Why This Step | MVP-1 закрыл единый command outcome; следующий blocker — заменить `mockApi` как псевдо-сервер на offline-first service layers |
| Current Vector | Правильный: делаем `applyPersonalityCommand()` единым источником результата действия |
| Next Step | MVP-2.1 — создать `PetService` поверх command engine |
| Why Next | UI должен зависеть от service contract, а не от `mockApi`; это первый шаг к LocalSave + SyncQueue + ServerApi |
| Required Verification | `npm test`, `npm run build`, targeted `rg` checks when relevant |

---

## 6. Last Completed Step

### What

Закрыт MVP-1 — Full Command Outcome.

### Why

До этого `mockApi` сам считал stats/XP/coins/blockers для основных действий. Это делало невозможной честную offline/backend/replay parity: разные слои могли получить разный результат одной команды.

### Impact

`applyPersonalityCommand()` теперь возвращает full outcome для `feed/play/bathe/heal/bond/sleep/wake/use_item`: `statDeltas`, `xpDelta`, `coinDelta`, `blockedAction`, `appliedModifiers`, `meta`, `events`, `pet`.

`mockApi` для основных действий больше не считает base stats/XP/coins/personality modifiers сам. Он вызывает command engine, применяет `coinDelta`, сохраняет offline command log и оставляет за собой adapter-shell: inventory, achievements, quests, UI events.

Special rules `rejectSleepWhenEnergized`, `peakPerformanceThreshold`, `xpEveryOtherAction` переведены в engine-owned metadata.

### Verification

- `npm test` — passed.
- `npm run build` — passed.
- `rg "baseResult|modified = applyActionModifiers|xpEveryOtherAction|rejectSleepWhenEnergized|getPeakPerformanceMult|getParanoidRestoreMult|applyActionModifiers|isActionBlocked" src/api/mockApi.ts` — no gameplay outcome calculators remain in `mockApi`.
- Integration test: `personality command MVP actions expose integrated gameplay outcomes`.

### Next

MVP-2.1 — создать `PetService`.

### Why Next

Теперь command engine умеет считать результат действия. Следующий blocker — убрать прямую зависимость UI от `mockApi` и ввести service layer, который будет одинаково работать offline и позже online через sync queue.

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

### Current Step

MVP-1 — Full Command Outcome.

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

### Next Step

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
npm run build
```

Status:

- passed after adding `validatePersonalitySpecialRules()`;
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

1. `PersonalityEngine.ts` still has hardcoded personality IDs.
2. `mockApi.ts` still calculates full gameplay/economy outcome.
3. `PetCommandResult` does not yet own full stat/xp/coin outcome.
4. System influences in registry are not applied by a generic sync pass.
5. Domain events are not durable/complete enough for explainability.
6. UI/product layer does not yet expose the full evolution system.
7. Simulation reports do not exist yet.

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
