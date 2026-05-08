# Personality Engine Audit

Дата аудита: 2026-05-07

Цель: зафиксировать текущее состояние движка характера, его реальные возможности, слабые места, противоречия и риски, которые могут помешать дальнейшему обучению, эволюции и развитию характера.

## 1. Текущая архитектура

Сейчас система характера состоит из двух основных слоёв.

### Gameplay Personality Engine

Файл: `src/personality/PersonalityEngine.ts`

Отвечает за:

- decay gameplay-статов;
- restore/XP/coins modifiers;
- mood;
- behavioral flags;
- Pattern Engine;
- gameplay emergent states (`tantrum`, `apathy`, `food_panic`, `breakdown`, etc.).

### Trait Evolution Engine

Файл: `src/personality/TraitEvolutionEngine.ts`

Отвечает за:

- `traitVector`;
- influence registry effects;
- formation;
- zone detection;
- evolution proposal;
- `acceptEvolution()` / `rejectEvolution()`;
- `singularity`;
- `shadow_form` / catharsis;
- `confusedState` sleep lifecycle;
- Core Memories;
- legacy echo vector;
- New Life / Memory Guardian.

Разделение в целом правильное, но orchestration сейчас частично находится в `MockApiService`, поэтому система ещё не является единым чистым domain engine.

## 2. Что уже умеет движок

### Trait evolution

- Применяет влияния через `applyInfluence()`.
- Ограничивает изменения через `DAILY_BUDGET`.
- Сглаживает изменения через `SMOOTHING_ALPHA`.
- Копит `dailyVectorVariance` и включает `confusedState`.
- Копит/снижает `traumaLevel`.
- Запускает `shadow_form` при пороге травмы и cooldown guard.
- Копит `catharsisProgress` и выводит из `shadow_form`.
- Формирует стартовый характер через `formationProgress`.
- Делает регрессию к home текущего характера.
- Определяет глубину в personality zones.
- Создаёт `evolutionProposal`.
- Позволяет принять или отложить proposal.
- Обрабатывает `singularity` как первый gate в `checkEvolution()`.
- Создаёт rare/common Core Memories.
- Делает New Life с echo-вектором и Memory Guardian.

### Gameplay personality

- Применяет decay gameplay-статов с модификаторами характера.
- Применяет restore/XP/coins modifiers.
- Учитывает food preferences.
- Учитывает behavioral flags.
- Учитывает emergent state modifiers.
- Считает mood с personality bias.
- Обновляет behavioral counters.
- Запускает Pattern Engine по data-driven rules.
- Поддерживает unique behavior отдельных характеров: paranoid phases, chaotic seed, anxious peak performance, feral night behavior, etc.

### Offline / command layer

- Есть `PetCommand`.
- Есть command log.
- Есть replay helper.
- Есть serializable `influenceCooldowns`.
- Есть personality-side command handler для trait/sleep/sync/evolution accept/reject.
- Mock runtime сохраняет pet snapshot + command log.

## 3. Главные слабые места

### 3.1 Два источника времени

`TraitEvolutionEngine` в основном принимает `ctx.now`, но `PersonalityEngine` использует `new Date()` / `Date.now()` напрямую.

Проблемные места:

- chaos seed;
- state expiry;
- `updateCounters()`;
- `runPatternEngine()`;
- default counters.

Риск:

- command replay может дать другой результат;
- backend validation будет расходиться с frontend;
- тесты не смогут стабильно покрывать long-term поведение;
- offline-first модель будет ненадёжной.

Нужный фикс:

- ввести единый `ClockContext`;
- передавать `now` во все чистые функции;
- убрать прямые `Date.now()` / `new Date()` из pure/domain logic.

### 3.2 Случайность не централизована

`Math.random()` используется в нескольких местах:

- chaos seed;
- auto-sleep;
- game score;
- singularity collapse fallback;
- memory templates fallback.

Риск:

- replay не deterministic;
- невозможно объяснить причинность;
- backend и frontend могут расходиться.

Нужный фикс:

- ввести seeded/domain random через context;
- фиксировать random seed в command/event;
- убрать случайность из replay без seed.

### 3.3 Pattern Engine не является настоящим rolling window

В правилах указаны периоды 7d/30d, но counters в основном накопительные.

Примеры:

- `feedInRedZone7d`;
- `forcedSleepCount7d`;
- `healWhenHealthy7d`;
- `nightWakeCount7d`;
- `sessionGapsOver48h_30d`;
- `filthCrisisCount30d`.

Риск:

- флаги могут срабатывать по старому поведению, которое уже давно исправлено;
- healing может выглядеть несправедливым;
- характер “плохо забывает” старое.

Нужный фикс:

- заменить простые counters на rolling buckets;
- хранить day buckets или compact event summaries;
- ввести expiry/decay для негативных следов.

### 3.4 Некоторые Pattern Rules не соответствуют evaluator semantics

Примеры:

- `night_guardian` использует `time_of_day_action` с `action: night_single`, но evaluator смотрит только `nightWakeCount7d`;
- `consecutive_syncs_cond` игнорирует параметры вроде `allStatsAbove`;
- `action_frequency` фактически смотрит `maxConsecHighPlayDays`, а не универсальную частоту.

Риск:

- система выглядит data-driven, но правила не полностью исполняются как написано;
- новые правила будут давать неожиданные результаты;
- баланс станет трудно поддерживать.

Нужный фикс:

- сделать typed evaluator для каждого condition type;
- валидировать rule params на старте;
- покрыть каждый rule тестом “может сработать” и “не срабатывает при недоборе”.

### 3.5 `RegisteredInfluence.conditions` почти не исполняются

`applyInfluence()` учитывает `intensityRules`, но не отсекает influence по `conditions`.

Примеры риска:

- social влияния имеют `formation_period`, но сам generic engine их не блокирует;
- будущие `training:*`, `discipline:*`, `cosmetic:*` будут выглядеть ограниченными, но применяться без gate;
- remote registry может декларировать conditions, которые не работают.

Нужный фикс:

- добавить `canApplyInfluence()` / `matchesInfluenceConditions()`;
- проверять `conditions` до применения deltas;
- возвращать structured result: applied/skipped/reason.

### 3.6 MockApi является orchestration god-object

`MockApiService` сейчас совмещает:

- gameplay stats;
- XP/coins;
- quests;
- achievements;
- inventory;
- events;
- trait evolution;
- sleep lifecycle;
- offline command log;
- new life.

Риск:

- сложно вынести на backend;
- сложно сделать canonical replay;
- сложно тестировать domain behavior отдельно;
- новые системы будут добавляться в MockApi, усиливая связанность.

Нужный фикс:

- выделить `PetDomainEngine` / `applyPetCommandFull()`;
- MockApi оставить адаптером;
- domain engine должен возвращать state patch + domain events.

### 3.7 Replay не равен Mock runtime

`applyPersonalityCommand()` умеет trait/sleep/sync/evolution layer, но не воспроизводит:

- gameplay stat deltas;
- XP;
- coins;
- quests;
- achievements;
- inventory;
- shop economy.

Риск:

- offline-first модель не сможет стать источником истины;
- backend replay/validation будет частичным;
- пользователь может видеть локально одно, сервер подтвердит другое.

Нужный фикс:

- либо расширить command handler до full gameplay command replay;
- либо явно разделить personal progression и server-authoritative economy;
- зафиксировать boundary в ADR.

### 3.8 Evolution может быть слишком инертной

Текущие параметры:

- `SMOOTHING_ALPHA = 0.08`;
- `REGRESSION_RATE = 0.02`;
- daily budgets;
- regression к текущему personality home на каждом sync.

Риск:

- умеренные действия могут не пробивать regression;
- питомец может слишком долго оставаться в старом характере;
- пользователь не увидит причинную связь между уходом и развитием.

Нужный фикс:

- прогнать simulation tests;
- проверить time-to-proposal для реалистичных сценариев;
- возможно уменьшить regression во время active drift;
- после `acceptEvolution()` закреплять новый путь.

### 3.9 Formation использует ageHours = 0

`completeFormation()` считает depth с возрастом `0`, а не с текущим возрастом питомца.

Риск:

- конфликт с dynamic radius;
- formation может выбрать не тот personality при более позднем завершении.

Нужный фикс:

- использовать `pet.ageHours`;
- добавить regression тест.

### 3.10 Core Memory IDs потенциально нестабильны

ID строится из timestamp + `coreMemories.length + 1`.

Риск:

- коллизии при одинаковом timestamp;
- разные IDs при разном порядке replay;
- сложно ссылаться на memories в evolution proposals.

Нужный фикс:

- использовать deterministic commandId + sequence;
- либо UUID на adapter layer;
- для replay лучше `mem-${commandId}-${sequence}`.

## 4. Противоречия в текущей логике

### 4.1 Одно поле `emergentState` для разных типов состояний

Сейчас одно поле хранит:

- gameplay states;
- trait states;
- exclusive states;
- non-exclusive states;
- UI-derived states.

Проблема:

- `confused` не может честно сосуществовать с `food_panic`;
- `shadow_form` вытесняет gameplay states;
- priority/exclusive semantics не полностью реализованы.

Нужный фикс:

- разделить:
  - `traitEmergentState`;
  - `gameplayEmergentState`;
  - `activeStateEffects`;
- UI может показывать несколько состояний одновременно.

### 4.2 Legacy bonuses объявлены, но не применяются

`EVOLUTION_LEGACY` содержит XP/coin bonuses и unique traits, но gameplay почти не использует их.

Риск:

- New Life ощущается только как стартовый echo-vector;
- обещанные unique traits не работают;
- future balance будет путаться между account legacy и current pet state.

Нужный фикс:

- решить, нужны ли legacy bonuses вообще;
- если да, добавить `accountModifiers` в gameplay layer;
- если нет, удалить/переименовать `EVOLUTION_LEGACY` как narrative-only.

### 4.3 Influence `conditions` создают ложную безопасность

В registry условия есть, но generic application их не enforcing.

Риск:

- дизайнер добавит condition и будет думать, что оно работает;
- social/remote/training могут применяться в запрещённых ситуациях.

Нужный фикс:

- см. пункт 3.5.

### 4.4 `onApply` в influence registry почти не используется generic way

У influence есть `onApply`, но orchestration делается вручную в MockApi/command handler.

Риск:

- новые effects потребуют ручных правок в нескольких местах;
- registry не является самодостаточным.

Нужный фикс:

- либо удалить `onApply`;
- либо сделать generic dispatcher for influence side effects.

## 5. Что может мешать обучению характера

### 5.1 Нет полноценной модели забывания

Характер копит:

- counters;
- flags;
- trauma;
- memories;
- legacy.

Но забывание/затухание есть только частично.

Риск:

- ранние ошибки игрока слишком долго определяют поведение;
- healing ощущается механическим;
- характер не “переучивается” достаточно хорошо.

Нужный фикс:

- decay для behavioral counters;
- confidence/strength у flags;
- recovery model для trauma;
- memory relevance decay.

### 5.2 Core Memories почти не влияют обратно

Memories сейчас в основном narrative/UI.

Риск:

- “помнит” текстово, но не поведенчески;
- Memory Guardian помогает пользователю, но не влияет на модель характера.

Нужный фикс:

- добавить memory-derived guidance weights;
- использовать rare memories как context для proposal/new-life;
- возможно добавить `memoryTraits` или `memoryBias`.

### 5.3 Нет причинной модели “событие → вывод → привычка”

Сейчас обучение = trait deltas + counters.

Риск:

- трудно объяснить игроку, почему характер изменился;
- трудно строить future AI/personality dialogue;
- сложнее делать personalized care suggestions.

Нужный фикс:

- добавить `DomainEvent`-based learning summaries;
- сохранять strongest causes для flags/proposals/memories;
- показывать explainability в UI.

### 5.4 После `acceptEvolution()` новый путь не закрепляется в traitVector

При принятии меняется `personality`, но `traitVector` остаётся где был.

Риск:

- быстрый повторный drift;
- oscillation между зонами;
- слабое ощущение завершённой метаморфозы.

Нужный фикс:

- после accept сделать мягкий pull к new home;
- ввести evolution cooldown;
- или фиксировать accepted zone как anchor на N syncs.

## 6. Приоритетный порядок исправлений

### P0 — Основание deterministic engine

Статус 2026-05-07: базовый слой выполнен.

1. [x] Ввести общий clock/random context для gameplay и trait paths.
2. [x] Убрать прямой `Date.now()` / `new Date()` из replay-sensitive pure logic.
3. [x] Убрать `Math.random()` из replay-sensitive paths.
4. [x] Проверять `RegisteredInfluence.conditions`.
5. [ ] Убрать оставшиеся fallback `new Date()` / `Math.random()` там, где вызывающий код пока не передает контекст.
6. [ ] Перевести remote registry TTL на тот же server/runtime clock contract.

### P1 — Честный Pattern Engine

Статус 2026-05-07: базовый rolling слой выполнен.

1. [x] Перевести 7d/30d counters на rolling buckets.
2. [x] Валидировать `PatternRule.params`.
3. [x] Покрыть ключевые rolling rules тестами достижимости.
4. [x] Исправить ambiguous condition evaluators (`night_single`, `same_food_ratio` за 7 дней).
5. [ ] Покрыть все rules тестами достижимости.

### P2 — Разделение state layers

Статус 2026-05-07: совместимый state-layer фундамент выполнен.

1. [x] Разделить trait/gameplay/cognitive emergent states.
2. [x] Сохранять legacy `emergentState` как derived primary state для текущего UI/API.
3. [x] Сделать priority semantics явными через derived primary state.
4. [x] Поддержать одновременное применение effects нескольких active states.
5. [x] Blockers выбирают первый блок по priority среди всех active states.
6. [x] Сделать `exclusive` semantics явными внутри каждого layer.

### P3 — Full command replay / domain engine

1. Вынести orchestration из MockApi.
2. Создать full `applyPetCommandFull()`.
3. Разделить personal progression и server-authoritative economy.
4. Подготовить backend replay adapter.

### P4 — Улучшение эволюции и обучения

1. Simulation tests для time-to-formation/evolution.
2. Закрепление нового пути после accept.
3. Забывание/затухание негативных паттернов.
4. Memory-derived behavior/guidance.

### P5 — Feature expansion после стабилизации

1. NPC/social.
2. Training.
3. Discipline.
4. Cosmetic influences.
5. Multiplayer.

## 7. Краткий вывод

Движок уже функционально богатый: он умеет формирование, drift, предложения эволюции, singularity, shadow/catharsis, confused sleep lifecycle, memories, New Life и gameplay modifiers.

Главная проблема не в отсутствии механик, а в целостности исполнения:

- время и случайность не централизованы;
- counters не являются настоящими временными окнами;
- conditions в registry не enforcing;
- replay не равен mock runtime;
- `emergentState` перегружен несколькими слоями смысла.

Если это не исправить до крупных новых функций, NPC/social/training/discipline будут строиться поверх нестрогого основания и быстро усложнят поддержку.
