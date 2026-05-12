# Personality Engine — актуальный план работ

> Дата: 2026-05-09  
> Основано на: `docs/personality_engine_progress.md`, `docs/personality_engine_decisions.md`, `docs/personality_engine_audit.md`, `docs/personality_engine_v5_gap_analysis.md`, `docs/personality_engine_coding_rules.md`, текущем коде `src/personality/`, `src/api/mockApi.ts`, тестах `tests/personalityEvolution.test.ts`  
> Назначение: рабочий backlog по движку характера с учетом уже закрытого прогресса.

> Перед выполнением любой задачи сначала читать `docs/personality_engine_progress.md`.
> Архитектурные решения фиксировать в `docs/personality_engine_decisions.md`.
> Каноничный gap-analysis относительно `PERSONALITY_EVOLUTION_SYSTEM.md`: `docs/personality_engine_v5_gap_analysis.md`.
> Инженерные правила движения по roadmap: `docs/personality_engine_coding_rules.md`.
> Полный master backlog: `docs/personality_engine_master_backlog.md`.

---

## 1. Текущее состояние

Движок характера сейчас состоит из двух связанных частей:

- `PersonalityEngine.ts` — gameplay-характер: decay, action modifiers, mood, behavioral counters, pattern flags, gameplay emergent states.
- `TraitEvolutionEngine.ts` — долгосрочная эволюция: 6D trait vector, formation, evolution proposal, singularity, shadow form, legacy, memories.

Связующий слой:

- `commandHandlers.ts` — главный доменный orchestrator для `PetCommand`.
- `stateLayers.ts` — общий источник активных emergent states по слоям `gameplay`, `evolution`, `cognitive`.
- `PetService` / `LocalSave` / `SyncQueue` / `ServerApi` — offline shell и будущий online command contract.
- `mockApi.ts` — UI/mock compatibility adapter: economy/inventory/achievements/quests/events shell.

Ключевой прогресс:

- P0-баги из аудита закрыты.
- `applyPersonalityCommand()` уже вызывает gameplay pipeline: counters, flags, mood, decay, passives, gameplay state layers.
- `mockApi` delegates основную command path в `PetService`.
- `stateLayers` уже предотвращает перетирание gameplay/evolution/cognitive states.
- Offline shell работает через `LocalSave` + `SyncQueue`, а legacy command log/replay остаются для personality-side helpers/tests.
- Explainability history сохраняет command/result/events.
- Есть deterministic balance report.

Текущая проверка:

- `npm test` проходит.
- `npx tsc --noEmit` проходит.
- `npm run build` проходит.
- `npm run simulate:balance` проходит.
- Есть Vite warning про chunk > 500 kB. Это не ошибка personality engine.

---

## 2. Что уже закрыто

### P0 Bugs — закрыто

| ID | Статус | Что сделано |
|---|---|---|
| BUG-1 | done | `enlightenmentActive` выставляется при входе в `enlightenment` |
| BUG-2 | done | `stoicPeakUsed` выставляется при входе в `stoic_peak` |
| BUG-3 | done | `allStatsAbove` учитывается в `consecutive_syncs_cond` |
| BUG-4 | done | `shadow_form` / `identity_crisis` разведены по priority, добавлен deterministic tie-breaker |
| CONTRA-2 | done | `feast_frenzy` считает 3 кормления за последний час, а не `playCountToday` |

Доказательные тесты:

- `perfect_balance requires every stat above threshold, not only average streak`
- `stoic_peak and enlightenment set one-shot guards when entered`
- `feast_frenzy uses three feedings in the last hour, not play count`

### CRIT-1 — закрыто

Было: `commandHandlers` не вызывал `PersonalityEngine`, поэтому backend/replay могли терять gameplay-характер.

Сейчас:

- `applyPersonalityCommand()` вызывает `updateCounters()`.
- `applyPersonalityCommand()` вызывает `runPatternEngine()`.
- `applyPersonalityCommand()` вызывает `computeEmergentState()` и пишет результат через `stateLayers`.
- `applyPersonalityCommand()` на `sync` вызывает `applyDecay()` и `computeNaturalPassives()`.
- `applyPersonalityCommand()` обновляет `mood`.
- `moodHistory` и `consecutive*Syncs` обновляются только на `sync`.
- `mockApi` вызывает `applyPersonalityCommand()` для основных команд.
- `mockApi.finalizePet()` больше не пересчитывает gameplay state и не двигает `lastUpdated`.

- `useInventoryItem()` больше не вызывает `applyPetInfluence('action:feed')`.
- Food-item без собственного `item:*` influence обрабатывается в command layer через `itemKind: 'food'`.
- `mockApi.ts` больше не содержит прямых вызовов `applyInfluence`, `canApplyInfluenceAtSync`, `checkThresholdCrossings`, `getInfluenceRegistry`.
- Добавлены regression tests на food fallback, item influence precedence, offline `use_item` log и `MockApi.getPet()` без mutation.

---

## 3. Главные нерешенные проблемы

### P1. Cleanup before data-driven refactor

Цель: убрать ложные сигналы и мёртвый код перед переносом gameplay logic в data registry.

Задачи:

1. Удалить `anxiousMult`.
   - Сейчас `const anxiousMult = personality.id === 'anxious' ? 1.0 : 1.0`.
   - Это noop.

2. Убрать XP noop для melancholic.
   - Сейчас `result.xp = result.xp`.
   - Нужно либо перенести `xpEveryOtherAction` в command/economy pipeline, либо явно оставить это в mock economy и удалить engine noop.

3. Разобраться с `perfect_balance`.
   - Done: оставлена фактическая XP-only семантика.
   - Удален ложный restore/passive placeholder из `FLAG_RESTORE_EFFECTS`.
   - Добавлен regression test: `perfect_balance is XP-only and does not add hidden stat passives`.

4. Решить `chaos_surge`.
   - Done: реализована deterministic activation в `computeEmergentState()`.
   - Activation gated через `emergentTriggers` + `specialRules.randomizeDailySeed`, без новой `personality.id === 'chaotic'` ветки.
   - Добавлен regression test: `chaos_surge activates in deterministic three hour windows only for configured personalities`.

5. Добавить validator для unsupported `specialRules`.
   - Done: добавлен `validatePersonalitySpecialRules()`.
   - Validator возвращает errors для неизвестных runtime keys и warnings для deferred/adapter-owned правил.
   - Добавлены regression tests на текущие warnings и unknown key rejection.

Критерий готовности:

- Нет noop-кода в `PersonalityEngine`.
- Комментарии соответствуют фактическому поведению.
- Для каждого specialRules поля есть реализация или validator warning/error.
- `npm test` и `npm run build` проходят.

---

### P2. Command result owns full gameplay outcome — DONE

Цель: сделать `applyPersonalityCommand()` единым доменным source of truth для результата действия.

Почему теперь раньше data-driven conditions:

- замена `mockApi` блокируется тем, что stats/XP/coins сейчас считаются в adapter layer;
- offline replay не может восстановить полный gameplay/economy outcome;
- будущий backend должен принимать тот же command outcome, а не копировать mock logic.

Статус на 2026-05-10: выполнено.

Закрыто:

1. Расширить `PetCommandResult`.
   - `statDeltas`
   - `xpDelta`
   - `coinDelta`
   - `blockedAction`
   - `appliedModifiers`

2. Перенести base action result calculation из `mockApi` в command/gameplay layer.

3. Оставить в `mockApi` только временный adapter shell:
   - inventory;
   - achievements;
   - quests;
   - persistence;
   - UI events.

Доказательства:

- `personality command MVP actions expose integrated gameplay outcomes`;
- `personality command replay preserves full gameplay outcome`;
- targeted `rg` по `src/api/mockApi.ts` не находит старые gameplay outcome calculators;
- `npm test` и `npm run build` проходят.

Следующий шаг: backend replay/validation adapter поверх уже готовых PetService, LocalSave, SyncQueue и ServerApi contract.

---

### P3. Data-driven refactor для gameplay conditions

Цель: убрать hardcoded `personality.id === ...` из `PersonalityEngine`.

Полный контекст и phased roadmap: `docs/personality_engine_v5_gap_analysis.md`.

Проблема:

- Сейчас `PersonalityEngine.ts` содержит прямые проверки почти всех personality IDs.
- Это мешает добавлять новые характеры без правки engine.
- Комментарий в `personalities.ts` обещает data-driven подход, но engine все еще знает конкретные характеры.

Задачи:

1. Добавить gameplay rule registry.
   - `emergentConditions`
   - `passiveEffects`
   - `decayRules`
   - `actionRules`
   - `moodRules`

2. Перенести gameplay emergent state условия в registry.
   - `stoic_peak`
   - `enlightenment`
   - `feast_frenzy`
   - `deep_melancholy`
   - `wanderlust`
   - `midnight_zoomies`
   - `coin_obsession`
   - `food_panic`
   - `trust_collapse`
   - `apathy`
   - `tantrum`
   - `contamination_crisis`
   - `breakdown`

3. Перенести passive effects в data.
   - foodie full passive
   - pristine cleanliness passive
   - empath bond passive
   - natural health regen

4. Оставить в engine только generic evaluator.

Критерий готовности:

- В `PersonalityEngine.ts` нет прямых `personality.id ===`, кроме временно допустимого compatibility shim.
- Добавление 17-го характера возможно через data registry и тест.
- Есть validator для новых condition/effect definitions.
- Есть тест, который добавляет synthetic personality через data и получает emergent state без правки engine.

---

### P4. Split `mockApi` into offline-first services — DONE

Цель: заменить `mockApi` как псевдо-server на понятные слои.

Задачи:

1. `PetService` — принимает UI action и вызывает command engine. Done.
2. `LocalSave` — хранит pet/account/inventory локально. Done.
3. `SyncQueue` — хранит pending commands offline. Done.
4. `ServerApi` — command contract для будущей отправки на backend. Done.
5. `mockApi` оставить как compatibility shell для текущего UI/dev runtime. Done.

Критерий готовности:

- игра работает offline через LocalSave + SyncQueue;
- gameplay logic не живет в persistence/sync слоях;
- backend submit/confirm остается следующим server-side этапом.

---

### P5. System influences and lifecycle hooks

Цель: сделать influence registry реально управляющим system behavior.

Задачи:

1. На `sync` запускать `applyEligibleSystemInfluences()`.
2. Подключить:
   - `system:inactivity_long`
   - `system:consistent_week`
   - `system:starvation`
   - `env:same_room_48h`
3. Реализовать generic `onApply` lifecycle hook.

Критерий готовности:

- system/environment influences меняют trait vector через registry.
- sleep/wake lifecycle hooks не размазаны по ручным веткам.

---

### P5. State layers как окончательный source of truth

Цель: завершить миграцию от single `pet.emergentState` к layered state model.

Текущее состояние:

- `stateLayers` уже основной механизм для активных состояний.
- `pet.emergentState` остается legacy primary state для UI/API совместимости.
- `applyActionModifiers()` и `isActionBlocked()` уже умеют работать с массивом состояний.

Задачи:

1. Добавить публичный selector/API field.
   - Например `activeEmergentStates`.

2. Обновить UI/API, где нужно показывать несколько активных состояний.

3. Пометить `pet.emergentState` как legacy projection.

Критерий готовности:

- UI может показывать несколько states без ручного чтения internal `stateLayers`.
- State conflict resolution покрыт тестами.

---

### P6. Event history для обучения и объяснимости

Цель: перейти от агрегированных counters к истории причин.

Проблема:

- `BehavioralCounters` хорошо подходят для правил, но не для обучения.
- `commandLog` хранит команды, но это не полноценный domain event history с результатами.
- Нельзя надежно объяснить: “почему характер стал таким”.

Задачи:

1. Добавить durable `DomainEvent[]` или `PersonalityEvent[]` в pet/account/offline save.
   - command accepted
   - influence applied/skipped
   - counters changed
   - flag activated/healed/deactivated
   - emergent state entered/exited
   - stat/xp/coin deltas
   - trait vector changed
   - memory added
   - evolution proposed/accepted/rejected

2. Добавить retention policy.
   - Например последние 500 событий локально.
   - Aggregate snapshots для старой истории.

3. Добавить explanation helpers.
   - `explainCurrentPersonality(pet)`
   - `explainFlag(flag)`
   - `explainEvolutionProposal(proposal)`

Критерий готовности:

- Можно восстановить цепочку причины для текущего personality state.
- Replay и explanation используют одни и те же события.
- Тест проверяет, что действие создает ожидаемые domain events.

---

### P7. Legacy / Catharsis / Singularity promises

Цель: закрыть расхождения с `PERSONALITY_EVOLUTION_SYSTEM.md`.

Задачи:

1. Подключить `EVOLUTION_LEGACY` XP/coin/uniqueTrait бонусы.
2. Реализовать или удалить catharsis XP x5 burst на 2 часа.
3. Реализовать или удалить singularity item cooldown bypass.
4. Проверить LiveOps runtime path.

Критерий готовности:

- В документе не остаётся обещаний, которых нет в коде.
- Или обещания реализованы и покрыты тестами.

---

### P8. UI/product слой evolution system

Цель: вывести важные mechanics из debug/test views в production UX.

Задачи:

1. Production view для:
   - active states;
   - trait vector;
   - Core Memories;
   - evolution proposal;
   - singularity;
   - shadow/catharsis;
   - legacy/new life.

2. Решить, какие debug элементы остаются только в `PersonalityTestPage`.

Критерий готовности:

- Игрок понимает систему через narrative UI, а не через скрытые числа.

---

### P9. Simulation / balance

Цель: проверить скорость и устойчивость системы.

Reports:

- formation speed;
- evolution speed;
- shadow entry/recovery;
- confused frequency;
- singularity rarity;
- memory generation rate;
- personality distribution under common play styles.

---

## 4. Рекомендуемый порядок работ

### Sprint 1 — Cleanup before refactor

1. Удалить `anxiousMult`.
2. Убрать melancholic XP noop или перенести семантику в command/economy layer.
3. Решить `perfect_balance` passive mismatch. Done: XP-only семантика зафиксирована кодом и тестом.
4. Реализовать или удалить `chaos_surge`. Done: state активируется в deterministic 3-hour windows.
5. Добавить validator для unsupported `specialRules`. Done: validator фиксирует unknown/deferred/adapter-owned rules.

Почему до data-driven:

- Мертвый код мешает корректно выносить правила в data.

### Sprint 2 — Data-driven conditions

1. Спроектировать `emergentConditions` schema. Done: `GAMEPLAY_STATE_RULES`.
2. Добавить validator. Deferred: пока покрыто typed registry + regression tests.
3. Перенести 2-3 состояния как pilot. Done.
4. Перенести остальные состояния. Done.
5. Убрать hardcoded `personality.id ===` из `computeEmergentState`. Done.

Почему не все сразу:

- Это самая рискованная часть. Нужен incremental migration.

### Sprint 3 — Offline shell and system influences

1. Создать PetService поверх command outcome. Done.
2. Создать LocalSave без gameplay logic. Done.
3. Создать SyncQueue для pending commands. Done.
4. Описать ServerApi command contract. Done.
5. После offline shell вернуться к `applyEligibleSystemInfluences()` и generic `onApply` lifecycle hooks. Partial: auto-sleep перенесен в command sync outcome; generic pass еще впереди.

Почему здесь:

- Command layer уже стал source of truth для MVP actions; теперь нужно убрать `mockApi` как псевдо-server, иначе offline/online архитектура останется временной.

### Sprint 4 — Learning foundation

1. Добавить durable event history.
2. Расширить `CoreMemory.features`.
3. Добавить explain helpers.
4. Подключить event history к memories и explanations.

Почему после data-driven:

- Learning будет чище, если причины уже структурированы как data, а не зашиты в if-else.

### Sprint 5 — Balance / backend

1. Simulation reports. Done: `npm run simulate:balance` writes `docs/reports/personality_balance_report.md`.
2. Final audit. Done: `docs/reports/personality_engine_final_audit.md`.
3. Backend replay adapter.
4. Remote registry endpoint.
5. Global balance pipeline.
6. Broader Monte Carlo simulation reports.

---

## 5. Definition of Done для движка характера

Движок можно считать архитектурно готовым, когда:

- `applyPersonalityCommand()` является единственным доменным entrypoint для personality behavior.
- `mockApi` не содержит прямых вызовов gameplay/evolution internals, кроме UI/economy adapter logic.
- Новый характер можно добавить без правки `PersonalityEngine.ts`.
- Active states живут в `stateLayers`, а `emergentState` является только legacy primary projection.
- Каждое важное изменение характера имеет domain event.
- Core memories имеют causal features.
- Evolution speed подтверждена simulation tests.
- Backend replay дает тот же результат, что client replay.
- Все registry/rules валидируются автоматически.
