# Personality Engine Coding Rules

> Дата: 2026-05-09  
> Назначение: правила для кодера, чтобы не сбиться с целевой архитектуры движка характера.  
> Использовать вместе с `docs/personality_engine_progress.md`, `PERSONALITY_EVOLUTION_SYSTEM.md`, `docs/personality_engine_v5_gap_analysis.md`, `docs/personality_engine_next_steps.md`.

> Обязательное правило: перед любой задачей по движку характера сначала читать `docs/personality_engine_progress.md`.

---

## 1. North Star

Движок характера считается правильным, если:

> История ухода за питомцем воспроизводимо меняет его характер, изменения объяснимы через events/memories, а новые характеры/правила добавляются как data, не как новые `if personality.id === ...`.

Любая правка должна двигать систему хотя бы к одной из целей:

1. меньше hardcoded personality logic;
2. больше logic в data registry;
3. больше command pipeline ownership;
4. лучше replay/explainability;
5. меньше adapter/domain смешивания;
6. лучше tests/simulation coverage;
7. меньше расхождений с `PERSONALITY_EVOLUTION_SYSTEM.md`.

Если правка не двигает ни одну цель, её не делать в рамках personality engine refactor.

---

## 2. Главные запреты

### R-1. Не добавлять новые `personality.id === ...` в engine

Запрещено добавлять personality-specific ветки в:

- `src/personality/PersonalityEngine.ts`
- `src/personality/commandHandlers.ts`
- `src/api/mockApi.ts`

Плохо:

```ts
if (personality.id === 'new_personality') {
  // special behavior
}
```

Правильно:

```ts
// Добавить rule/effect в registry, а engine должен generic evaluate it.
```

Исключение:

- временный compatibility shim;
- рядом должен быть TODO с phase/removal condition;
- должен быть тест, который фиксирует поведение до миграции.

Проверка:

```bash
rg "personality\\.id ===|personality\\.id !==" src/personality/PersonalityEngine.ts src/personality/commandHandlers.ts src/api/mockApi.ts
```

Количество совпадений должно только уменьшаться.

---

### R-2. Не класть domain logic в `mockApi`

`mockApi` — adapter, не движок.

Можно:

- inventory;
- shop;
- achievements;
- quests;
- local persistence;
- UI events;
- calling `applyPersonalityCommand()`.

Нельзя:

- напрямую применять influences;
- пересчитывать counters;
- вычислять emergent states;
- запускать decay/passives;
- решать personality-specific behavior;
- дублировать command pipeline.

Проверка:

```bash
rg "applyInfluence|canApplyInfluenceAtSync|checkThresholdCrossings|updateCounters|runPatternEngine|computeEmergentState|applyDecay|computeNaturalPassives|getInfluenceRegistry" src/api/mockApi.ts
```

Ожидание:

- нет прямых personality internals;
- допустимы только imports/selectors, явно нужные для UI adapter, пока они не перенесены.

---

### R-3. Не добавлять поведение без events

Если действие меняет важное состояние, оно должно создавать domain event.

Важное состояние:

- trait vector;
- stats;
- XP/coins;
- influence applied/skipped;
- counters;
- flags;
- emergent states;
- memories;
- evolution proposal;
- evolution accept/reject;
- sleep lifecycle;
- catharsis;
- legacy/new life.

Правило:

> Нет event — нет объяснимости. Нет объяснимости — движок не соответствует v5.

---

### R-4. Не добавлять обещания в docs без реализации или roadmap item

Если в документах появляется mechanic, она должна иметь одно из:

- реализацию;
- тест;
- явный roadmap item;
- explicit “not implemented / deferred”.

Запрещено оставлять комментарии вида:

- “обрабатывается снаружи” без указания где;
- “будет применено server/mockApi” без задачи;
- “passive bonus” без фактического effect.

---

## 3. Source of Truth Rules

### R-5. `applyPersonalityCommand()` должен становиться главным entrypoint

Все personality/gameplay domain changes должны постепенно сходиться в:

```ts
applyPersonalityCommand(pet, command, options)
```

Целевой результат команды:

- new pet snapshot;
- domain events;
- influence cooldowns;
- stat deltas;
- XP delta;
- coin delta;
- blocked action result;
- applied modifiers.

Если новая логика нужна для действия питомца, сначала спросить:

> Может ли это жить в command pipeline?

Если да — класть туда, не в UI/store/mock adapter.

---

### R-6. `stateLayers` — source of truth для active states

Целевое состояние:

- `pet.stateLayers` хранит active states;
- `pet.emergentState` только legacy primary projection;
- UI должен получать `activeEmergentStates`.

Запрещено:

- вручную выставлять `pet.emergentState` без синхронизации layers;
- делать новую механику, которая читает только primary `emergentState`, если важны multiple states.

Правильно:

- использовать `setLayeredEmergentState()`;
- использовать `clearLayeredEmergentState()`;
- использовать `getActiveEmergentStates()` / `getActiveEmergentStateTypes()`.

---

### R-7. Registry first

При добавлении поведения выбрать ближайший data owner:

| Поведение | Где должно жить |
|---|---|
| Trait vector deltas от действия/предмета/события | `influenceRegistry.ts` |
| Global balance multiplier | `GlobalBalancePatch` |
| Pattern flag condition | `patternRules.ts` |
| Emergent state definition | `emergentStates.ts` |
| Personality identity/data | `personalities.ts` / trait map |
| Gameplay condition/effect | будущий gameplay rule registry |
| Cross-command orchestration | `commandHandlers.ts` |
| UI rendering | `components/pages` |
| Adapter persistence/economy shell | `mockApi.ts` |

Если нет подходящего registry, не добавлять hardcoded branch. Сначала добавить registry schema или roadmap item.

---

## 4. Порядок работ

### Step 0. Read progress file

Перед любой задачей по personality engine:

1. Прочитать `docs/personality_engine_progress.md`.
2. Прочитать этот файл.
3. Прочитать `docs/personality_engine_next_steps.md`.
4. Назвать пользователю:
   - текущий шаг;
   - почему он следующий;
   - какие проверки будут выполнены;
   - как шаг помогает конечной цели.

В конце каждой задачи обновить `docs/personality_engine_progress.md`.

### Step 1. Cleanup first

Перед большим refactor убрать ложные сигналы:

1. удалить noop code;
2. исправить устаревшие комментарии;
3. валидировать unsupported `specialRules`;
4. не менять архитектуру вместе с большим количеством behavior changes.

Цель:

- перед миграцией должно быть понятно, какое поведение реально существует.

---

### Step 2. Data-driven gameplay conditions

Сначала переносить conditions, потому что это главный архитектурный долг.

Порядок:

1. спроектировать минимальную schema condition/effect;
2. добавить validator;
3. перенести 2-3 состояния как pilot;
4. добавить synthetic personality test;
5. перенести остальные states;
6. удалить hardcoded branches.

Не начинать с полного action/economy rewrite, пока conditions не вынесены.

---

### Step 3. Data-driven passives/action/decay

После conditions переносить:

- passive effects;
- decay rules;
- action modifiers;
- mood rules;
- special gates.

Каждый перенос должен сохранять существующее поведение тестами.

---

### Step 4. Command outcome ownership

После того как gameplay rules стали data-driven, переносить gameplay outcome из `mockApi` в command layer.

Порядок:

1. расширить `PetCommandResult`;
2. добавить stat/xp/coin outcome;
3. перенести один action как pilot;
4. перенести остальные care/play actions;
5. оставить achievements/quests/inventory в adapter.

---

### Step 5. System influences and hooks

После command ownership:

1. реализовать `applyEligibleSystemInfluences()` на `sync`;
2. подключить `system:*` и `env:*`;
3. реализовать generic `onApply`;
4. добавить events for applied/skipped.

---

### Step 6. Explainability

После стабилизации command/events:

1. durable event history;
2. memory source event ids;
3. memory features;
4. explain helpers.

---

### Step 7. Product/UI

UI делать после того, как domain model стабилизирована:

- active states;
- memories;
- evolution proposal;
- shadow/catharsis;
- singularity;
- legacy/new life.

Исключение:

- debug UI можно делать раньше, если он помогает тестировать domain behavior.

---

### Step 8. Simulation and balance

Финальный этап перед “готово”:

- formation speed;
- evolution speed;
- state frequency;
- recovery paths;
- personality distribution.

Баланс менять только после repeatable simulation reports.

---

## 5. Decision Checklist для каждой задачи

Перед кодом ответить и явно сверить с `docs/personality_engine_progress.md`:

1. Это domain logic или adapter/UI logic?
2. Есть ли подходящий registry для этого поведения?
3. Нужно ли расширить registry вместо `if`?
4. Должно ли это проходить через `applyPersonalityCommand()`?
5. Какие domain events должны появиться?
6. Нужно ли это replay/backend?
7. Какой тест докажет, что поведение не сломалось?
8. Как это влияет на `PERSONALITY_EVOLUTION_SYSTEM.md`?

Если на пункты 2-5 нет ответа, сначала уточнить design, потом писать код.

---

## 6. Acceptance Checklist для PR/изменения

Изменение считается хорошим, если:

- уменьшает или не увеличивает hardcoded personality logic;
- не добавляет domain logic в `mockApi`;
- проходит через command pipeline, если это gameplay/personality behavior;
- имеет domain events для важных изменений;
- покрыто regression tests;
- не ломает replay assumptions;
- обновляет docs, если меняет контракт или обещание;
- обновляет `docs/personality_engine_progress.md`;
- `npm test` проходит;
- `npm run build` проходит.

---

## 7. Stop Conditions

Остановиться и не продолжать “быстро чинить”, если:

- нужно добавить новый `personality.id === ...`;
- нужно продублировать logic между mock/backend/replay;
- непонятно, где source of truth;
- изменение требует одновременно менять engine, mock, UI и docs без тестового pilot;
- поведение не может быть объяснено через event/memory;
- спецификация обещает одно, а код делает другое.

В таком случае сначала обновить design или разбить задачу на phases.

---

## 8. Definition of Done для всего движка

Движок готов, когда:

1. Новый характер добавляется через data без правки `PersonalityEngine`.
2. `applyPersonalityCommand()` является authoritative domain entrypoint.
3. Mock/backend/replay используют один command outcome.
4. `mockApi` не содержит personality/gameplay internals.
5. `stateLayers` являются public source of truth для active states.
6. `emergentState` остаётся только legacy projection.
7. Каждое важное изменение имеет domain event.
8. Core Memories связаны с causes/source events/features.
9. System influences применяются через registry.
10. Legacy/catharsis/singularity promises либо реализованы, либо удалены из docs.
11. Есть simulation reports по скорости и балансу.
12. `npm test` и `npm run build` стабильно проходят.
