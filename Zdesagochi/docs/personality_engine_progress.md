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
| Current Goal | Движок характера готов к production-use: zero hardcoded personality id checks, all rules data-driven |
| Current Step | Catharsis recovery moved into command pipeline; UX now separates trauma risk from recovery |
| Why This Step | Users saw trauma 64 with recovery 0 and no actionable path; mock-only catharsis progress meant backend/replay could not prove recovery worked |
| Current Vector | Правильный: recovery behavior is in `applyPersonalityCommand()`, explainability has a domain event, mock adapter no longer owns the effect |
| Next Step | Production backend transport/storage/auth |
| Why Next | Gameplay engine layer is complete; remaining work is infrastructure (backend sync, server-side economy) |
| Required Verification | `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run simulate:balance`, boundary `rg` checks |

---

## 6. Last Completed Step

### What

Закрыт пользовательский баг катарсиса:

- `bond` и `heal` теперь двигают `catharsisProgress` внутри `applyPersonalityCommand()`.
- Добавлен domain event `catharsis_progress_changed`.
- `mockApi` больше не добавляет катарсис вручную после команды.
- Explainability показывает изменение катарсиса.
- UI в `EvolutionInspector` различает:
  - trauma-риск до входа в `shadow_form`;
  - реальное восстановление внутри `shadow_form`.
- Уведомление о смене скина теперь явно показывает, какой характер применил скин.
- Добавлен regression test `personality commands advance catharsis recovery in shadow form`.
- Повторные `bond`/`heal` теперь снижают trauma даже когда trait-influence на cooldown.
- `heal` доступен для trauma/catharsis recovery при высоком здоровье.
- Уведомления `bond`/`heal` показывают фактическое `trauma -N` или `катарсис +N`.
- `sync` больше не запускает regression/evolution до `formationComplete`; до завершения формирования текущий `pet.personality` больше не тянет trait vector к себе.
- До `formationComplete` command pipeline использует нейтральный gameplay-профиль: текущая техническая метка `pet.personality` больше не включает action modifiers, blockers, autoSleep, passives или `personality_is` intensity.
- `linkedSkinIds` в preset-данных сделаны однозначными: один skin больше не принадлежит нескольким характерам.
- Добавлен отдельный invariant/audit suite `tests/personalityEngineInvariants.test.ts`, подключенный к `npm test`.
- Добавлены regression tests:
  - `repeated care actions reduce trauma even when trait influence is on cooldown`;
  - `heal remains available for trauma recovery when health is already high`;
  - `personality command sync does not regress or evolve before formation completes`.
- Новый invariant suite проверяет:
  - skin ids map to at most one personality;
  - pre-formation sync is label-invariant for every personality id;
  - pre-formation personality_is intensity rules are ignored;
  - same formation history forms the same personality regardless of placeholder label;
  - formation progress never exceeds configured threshold.

### Verification

- `npm run typecheck:packages` — passed.
- `node scripts/run-personality-tests.mjs` — passed.
- `npm test` — passed.
- `npm run build` — passed. Vite сохранил предупреждение про chunk > 500 kB, это не ошибка.

### Previous What

Закрыты 4 задачи: обновлён progress.md; последние hardcoded `personality.id ===` проверки вынесены в specialRules; 5 deferred specialRules реализованы или явно удалены; удалены 3 чистых re-export шима.

### Why

После всех предыдущих сессий в движке оставались:
- два `pet.personality === 'paranoid'` в commandHandlers.ts;
- один `S.pet.personality === 'feral'` в mockApi.ts;
- 5 deferred specialRules без реализации (`playThirstEnabled`, `stoicPeakOnceOnly`, `newRoomBonusEnabled`, `untrustedPhaseDays`, `trustThresholdBonds`);
- 3 файла-шима в `src/personality/` которые только re-export'ировали из preset-пакета.

### Impact

Сделано:

- `PersonalitySpecialRules`: удалены 4 deferred поля (`playThirstEnabled`, `stoicPeakOnceOnly`, `newRoomBonusEnabled`, `untrustedPhaseDays`); добавлены 3 data-driven поля (`healRefuseHealthThreshold`, `feedRestoreByPhase`, `resistsBathing`); `trustThresholdBonds` теперь реализован в engine.
- `commandHandlers.ts`: `pet.personality === 'paranoid'` в heal-блокере → `personality.specialRules?.healRefuseHealthThreshold`; в feed-модификаторе → `personality.specialRules?.feedRestoreByPhase`.
- `PersonalityEngine.ts/updateCounters`: принимает optional `personality`, использует `trustThresholdBonds ?? 10` для paranoid-фазы вместо hardcoded `10` / `20`.
- `mockApi.ts`: `S.pet.personality === 'feral'` в bathePet → `getPersonality(...).specialRules?.resistsBathing`.
- `personalities.ts`: paranoid получил `healRefuseHealthThreshold: 50`, `feedRestoreByPhase: true`; feral получил `resistsBathing: true`; удалены все 4 deferred поля из данных; `SPECIAL_RULE_SUPPORT` обновлён.
- `src/personality/personalities.ts`, `influenceRegistry.ts`, `memoryTextGenerator.ts` удалены.
- `src/personality/index.ts`: вместо 3 шим-файлов — `export * from '@zdesagochi/personality-pet-preset'`.
- Тесты обновлены: импорты из preset-пакета напрямую; тест validator-а переписан под новый набор rules.

Zero hardcoded `personality.id ===` checks остались в gameplay engine и adapter слоях.

### Verification

- `npm test` — passed (все тесты green, boundary check passed).
- `npx tsc --noEmit` — passed.

### Next

Production backend transport/storage/auth.

### Why Next

Gameplay engine полностью data-driven, packages extraction завершена, шимы упрощены. Следующий blocker — серверная инфраструктура (транспорт, хранилище, auth).

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
3. Public schema version and migration entrypoint are not implemented yet.
4. `src/personality/commandHandlers.ts`, `TraitEvolutionEngine.ts`, `engineFacade.ts` are still "withZdesagochiDefaults" wrappers in the app layer rather than living in the preset package — this is acceptable until a real build pipeline exists.

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
