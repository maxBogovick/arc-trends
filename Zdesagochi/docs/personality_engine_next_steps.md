# Personality Engine — актуальный план работ

> Дата: 2026-05-08  
> Основано на: `docs/personality_engine_audit.md`, текущем коде `src/personality/`, `src/api/mockApi.ts`, тестах `tests/personalityEvolution.test.ts`  
> Назначение: рабочий backlog по движку характера с учетом уже закрытого прогресса.

---

## 1. Текущее состояние

Движок характера сейчас состоит из двух связанных частей:

- `PersonalityEngine.ts` — gameplay-характер: decay, action modifiers, mood, behavioral counters, pattern flags, gameplay emergent states.
- `TraitEvolutionEngine.ts` — долгосрочная эволюция: 6D trait vector, formation, evolution proposal, singularity, shadow form, legacy, memories.

Связующий слой:

- `commandHandlers.ts` — главный доменный orchestrator для `PetCommand`.
- `stateLayers.ts` — общий источник активных emergent states по слоям `gameplay`, `evolution`, `cognitive`.
- `mockApi.ts` — UI/mock adapter: экономика, XP, inventory, achievements, quests, local persistence.

Ключевой прогресс:

- P0-баги из аудита закрыты.
- `applyPersonalityCommand()` уже вызывает gameplay pipeline: counters, flags, mood, decay, passives, gameplay state layers.
- `mockApi` переведен на thin-wrapper подход для основных personality-команд.
- `stateLayers` уже предотвращает перетирание gameplay/evolution/cognitive states.
- Offline command log и replay уже работают для personality-side логики.

Текущая проверка:

- `npm test` проходит.
- `npm run build` проходит.
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

### CRIT-1 — почти закрыто

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

Остаток:

- В `useInventoryItem()` еще есть fallback `applyPetInfluence('action:feed')` для food-item без собственного `item:*` influence.
- Нужны отдельные regression tests на отсутствие двойного применения counters в `MockApi.feedPet()` и `MockApi.useInventoryItem()`.

---

## 3. Главные нерешенные проблемы

### P1. Закрыть хвосты CRIT-1

Цель: сделать `mockApi` настоящим adapter layer без скрытой personality-логики.

Задачи:

1. Добавить явную семантику item-as-food в command layer.
   - Сейчас `use_item` применяет `item:${itemId}`, если influence существует.
   - Если food item не имеет собственного influence, `mockApi` вручную вызывает `action:feed`.
   - Нужно решить на уровне `applyPersonalityCommand`, как `use_item` с food-effect влияет на trait vector.

2. Убрать `applyPetInfluence()` из `mockApi`.
   - После переноса item fallback эта функция должна стать не нужна.
   - `mockApi` не должен напрямую вызывать `applyInfluence()`.

3. Добавить regression tests.
   - `MockApi.feedPet()` увеличивает feed counters ровно один раз.
   - `MockApi.useInventoryItem(food)` не применяет trait influence дважды.
   - `MockApi.getPet()` не меняет `lastUpdated`, counters, flags, state.

Критерий готовности:

- В `mockApi.ts` нет прямых вызовов `applyInfluence`, `canApplyInfluenceAtSync`, `checkThresholdCrossings` для обычных gameplay-команд.
- `rg "applyPetInfluence|applyInfluence|updateCounters|runPatternEngine|computeEmergentState|applyDecay|computeNaturalPassives" src/api/mockApi.ts` не находит доменных дублей, кроме допустимых imports для UI modifiers.
- `npm test` и `npm run build` проходят.

---

### P2. Data-driven refactor для gameplay conditions

Цель: убрать hardcoded `personality.id === ...` из `PersonalityEngine`.

Проблема:

- Сейчас `PersonalityEngine.ts` содержит прямые проверки почти всех personality IDs.
- Это мешает добавлять новые характеры без правки engine.
- Комментарий в `personalities.ts` обещает data-driven подход, но engine все еще знает конкретные характеры.

Задачи:

1. Добавить в `PersonalityDefinition` data-driven блоки:
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

### P3. Убрать мертвый и вводящий в заблуждение код

Цель: убрать ложные сигналы, что логика реализована внутри engine, когда она фактически живет снаружи или не работает.

Задачи:

1. Удалить `anxiousMult`.
   - Сейчас `const anxiousMult = personality.id === 'anxious' ? 1.0 : 1.0`.
   - Это noop.

2. Убрать XP noop для melancholic.
   - Сейчас `result.xp = result.xp`.
   - Нужно либо перенести `xpEveryOtherAction` в command/economy pipeline, либо явно оставить это в mock economy и удалить engine noop.

3. Разобраться с `perfect_balance`.
   - Сейчас есть XP multiplier.
   - Комментарий говорит про passive bonus в `computeNaturalPassives`, но stat passive не реализован.
   - Нужно выбрать одно:
     - оставить только XP multiplier и поправить описание;
     - или добавить stat passive.

4. Обработать `newRoomBonusEnabled`.
   - Сейчас special rule есть у adventurer, но engine не имеет общей обработки.
   - Нужно связать с `equip_room` / `env:new_room` через command layer или registry.

Критерий готовности:

- Нет noop-кода в `PersonalityEngine`.
- Комментарии соответствуют фактическому поведению.
- Для каждого specialRules поля есть либо реализация, либо validator предупреждает, что поле не поддержано.

---

### P4. State layers как окончательный source of truth

Цель: завершить миграцию от single `pet.emergentState` к layered state model.

Текущее состояние:

- `stateLayers` уже основной механизм для активных состояний.
- `pet.emergentState` остается legacy primary state для UI/API совместимости.
- `applyActionModifiers()` и `isActionBlocked()` уже умеют работать с массивом состояний.

Задачи:

1. Обновить UI/API, где нужно показывать несколько активных состояний.
   - Сейчас `pet.emergentState` показывает только highest-priority state.
   - Для richer UX нужны все active states: gameplay + evolution + cognitive.

2. Добавить публичный selector/API field.
   - Например `activeEmergentStates`.
   - Не обязательно ломать старое `emergentState`.

3. Уточнить priority model.
   - Сейчас priority может быть дробным (`0.5`, `1.5`).
   - Нужно решить, это официальный подход или временный workaround.
   - Лучше завести `priority` + `tieBreaker` или layer-aware priority.

Критерий готовности:

- `pet.emergentState` помечен как legacy в типах/доках.
- UI может показывать несколько states без ручного чтения internal `stateLayers`.
- State conflict resolution покрыт тестами.

---

### P5. Event history для обучения и объяснимости

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

### P6. CoreMemory features для causal learning

Цель: сделать memories не только текстом и простыми полями, а обучающим материалом.

Текущее состояние:

- `CoreMemory` уже имеет machine-readable поля:
  - `traitKey`
  - `direction`
  - `category`
  - `personalityHint`
  - `tier`

Недостаток:

- Нет causal features.
- Нет связи с command/event ids.
- Нет hash/group key.
- Нет compact numeric vector для future ML/similarity.

Задачи:

1. Расширить `CoreMemory`.
   - `sourceEventIds?: string[]`
   - `features?: Record<string, number>`
   - `cause?: string`
   - `effect?: string`
   - `hash?: string`

2. Заполнять features при создании memory.
   - influence category
   - trait delta magnitude
   - state before/after
   - relevant counters
   - active flags

3. Добавить tests на deterministic memory features.

Критерий готовности:

- По memory можно машинно понять, какое поведение к ней привело.
- Несколько похожих memories можно группировать без чтения текста.

---

### P7. Emergent states должны влиять на trait vector

Цель: сделать сильные состояния частью развития характера, а не только временным gameplay-модификатором.

Проблема:

- `shadow_form`, `tantrum`, `enlightenment`, `breakdown` влияют на actions, но не сдвигают trait vector напрямую.
- Травматический опыт частично идет через `traumaDelta`, но state-level effects не участвуют в долгосрочном характере.

Задачи:

1. Добавить в `EmergentStateDefinition` поле:
   - `traitDeltasOnEnter?`
   - `traitDeltasPerSync?`
   - `traitDeltasOnExit?`

2. Применять эти deltas через тот же budget/smoothing механизм, что influences.

3. Ограничить силу эффектов.
   - state deltas не должны ломать daily budget.
   - legendary/evolution states могут иметь отдельный cap.

Критерий готовности:

- Вход в `shadow_form` или длительное пребывание в нем оставляет измеримый след.
- `enlightenment` может закреплять позитивный паттерн.
- Есть тесты на state trait effects и budget caps.

---

### P8. Legacy economy bonuses

Цель: сделать “Новая жизнь в новом теле” ощутимой не только через стартовый trait vector.

Текущее состояние:

- `recordLegacy()` сохраняет `legacyVector`, `legacyCoefficient`, `legacyGeneration`, `memoryGuardian`.
- `createInitialTraitVector()` использует legacy echo-vector.
- `EVOLUTION_LEGACY` содержит `xpMultiplierBonus`, `coinMultiplierBonus`, `uniqueTrait`, но gameplay/economy их не использует.

Задачи:

1. Решить, где живут account-wide bonuses.
   - `Account.legacyBonuses`
   - или computed selector из `legacyVector` / `evolutionHistory`

2. Подключить bonuses к economy pipeline.
   - XP multiplier
   - coin multiplier
   - unique trait hints

3. Не превращать legacy в pay-to-win/overpower.
   - Нужны caps.
   - Нужна UI-подача как “память помогает”, а не “старый питомец умер и дал буст”.

Критерий готовности:

- New Life дает понятный, ограниченный бонус.
- Бонус виден в UI и покрыт тестом.

---

### P9. Simulation и баланс скорости эволюции

Цель: понять, насколько живым ощущается темп характера.

Проблема:

- `SMOOTHING_ALPHA`, daily budget, thresholds и stability syncs сейчас заданы вручную.
- По расчету большие переходы могут занимать недели.
- Без simulation непонятно, хорошо это или слишком медленно.

Задачи:

1. Написать simulation tests/scripts.
   - стабильная забота 7/14/30 дней
   - хаотичная забота
   - neglect сценарий
   - recovery сценарий
   - mixed behavior

2. Собирать метрики:
   - days to formation
   - days to first evolution proposal
   - number of memories
   - number of flags/states
   - trait vector distance over time

3. Подобрать параметры.
   - `SMOOTHING_ALPHA`
   - daily budgets
   - `STABILITY_SYNCS`
   - hysteresis
   - shadow/void/singularity thresholds

Критерий готовности:

- Есть repeatable simulation report.
- Изменения баланса делаются на основании метрик, а не ощущения.

---

### P10. Backend / LiveOps readiness

Цель: подготовить personality engine к серверному authority и remote balance.

Задачи:

1. Backend replay/validation adapter.
   - Сервер принимает `PetCommand`.
   - Сервер валидирует command order, cooldowns, state shape.
   - Сервер возвращает authoritative pet snapshot + events.

2. Remote influence registry endpoint.
   - `/api/influence-registry`
   - server-side validation
   - versioning
   - rollback

3. GlobalBalancePatch pipeline.
   - 7-day rolling average
   - max ±2% per week
   - audit trail

4. Runtime validation.
   - Pet shape validation before command application.
   - Registry validation on startup.
   - Pattern rules validation on startup or build/test step.

Критерий готовности:

- Client and backend replay produce same result for same command log.
- Remote registry cannot inject unsafe influences.
- Balance patches are capped and auditable.

---

## 4. Рекомендуемый порядок работ

### Sprint 1 — Finish CRIT-1

1. Добавить item-as-food semantics в `applyPersonalityCommand`.
2. Убрать `applyPetInfluence()` из `mockApi`.
3. Добавить regression tests на `MockApi.feedPet()`, `MockApi.useInventoryItem()`, `MockApi.getPet()`.
4. Обновить audit log: `CRIT-1 closed`.

Почему это первое:

- Это завершает разделение domain layer и adapter layer.
- После этого backend/replay путь становится надежной основой.

### Sprint 2 — Cleanup before refactor

1. Удалить `anxiousMult`.
2. Убрать melancholic XP noop или перенести семантику в command/economy layer.
3. Решить `perfect_balance` passive mismatch.
4. Реализовать или удалить `newRoomBonusEnabled`.
5. Убрать `TraitEvolutionContext.random` или `rng`.

Почему до data-driven:

- Мертвый код мешает корректно выносить правила в data.

### Sprint 3 — Data-driven conditions

1. Спроектировать `emergentConditions` schema.
2. Добавить validator.
3. Перенести 2-3 состояния как pilot.
4. Перенести остальные состояния.
5. Убрать hardcoded `personality.id ===` из `computeEmergentState`.

Почему не все сразу:

- Это самая рискованная часть. Нужен incremental migration.

### Sprint 4 — Learning foundation

1. Добавить durable event history.
2. Расширить `CoreMemory.features`.
3. Добавить explain helpers.
4. Добавить state trait deltas.

Почему после data-driven:

- Learning будет чище, если причины уже структурированы как data, а не зашиты в if-else.

### Sprint 5 — Balance / backend

1. Simulation reports.
2. Backend replay adapter.
3. Remote registry endpoint.
4. Global balance pipeline.

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

---

## 6. Ближайшая конкретная задача

Следующая задача должна быть:

**Закрыть остаток CRIT-1: item-as-food semantics + убрать `applyPetInfluence()` из `mockApi`.**

Минимальный план:

1. В `applyPersonalityCommand()` для `use_item` поддержать fallback influence:
   - если есть `item:${itemId}` — применить его;
   - если item помечен как food/food-like — применить `action:feed`;
   - не применять оба без явного правила.

2. Передать в command context достаточно metadata для `use_item`.
   - Сейчас команда знает только `itemId`.
   - Нужно либо registry lookup, либо `itemKind` в command payload.

3. Удалить `applyPetInfluence()` из `mockApi`.

4. Добавить тесты:
   - food item без `item:*` influence применяет `action:feed` один раз;
   - item с `item:*` influence не применяет `action:feed` дополнительно;
   - offline command log сохраняет `use_item`;
   - `getPet()` не мутирует personality state.

