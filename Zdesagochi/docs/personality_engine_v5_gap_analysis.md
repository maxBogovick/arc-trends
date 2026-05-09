# Personality Engine v5 Gap Analysis

> Дата: 2026-05-09  
> Основано на: `PERSONALITY_EVOLUTION_SYSTEM.md`, `src/personality/`, `src/api/mockApi.ts`, `tests/personalityEvolution.test.ts`  
> Назначение: рабочий документ для возврата движка характера к целевой архитектуре v5.0.
> Инженерные правила для выполнения этого плана: `docs/personality_engine_coding_rules.md`.

---

## 1. Короткий вердикт

Мы не сделали систему "полностью неправильно". Ядро долгосрочной эволюции характера близко к документу v5.0:

- 6D trait vector;
- daily trait budget;
- smoothing;
- regression к текущему характеру;
- formation;
- stability-based evolution proposal;
- singularity;
- shadow form;
- confused state;
- Core Memories;
- legacy/new life.

Главный отход от цели не в математике `TraitEvolutionEngine`, а в архитектуре вокруг него:

> Документ требует: **"Data-driven до конца. Новая функция = добавить запись в реестр. Движок не трогать."**  
> Фактически: `PersonalityEngine` и часть `mockApi` всё ещё содержат ручные `personality.id === ...` и gameplay-specific исключения.

Итоговая оценка соответствия:

| Область | Соответствие v5.0 | Комментарий |
|---|---:|---|
| Trait evolution core | 75-85% | Основная математика и состояния реализованы близко к документу |
| Data-driven архитектура | 45-55% | `PersonalityEngine` знает конкретные personality IDs |
| Replay/backend пригодность | 60% | Personality-side replay есть, полный gameplay/economy replay неполный |
| UI/product слой | 30-40% | Есть инспектор/тестовая страница, но не весь UX из документа |
| LiveOps/balance/telemetry | 35-45% | Registry/validators есть, runtime/backend loop неполный |

---

## 2. Что сделано правильно

### 2.1 Trait vector и математика влияний

Файл: `src/personality/TraitEvolutionEngine.ts`

Реализовано:

- `DAILY_BUDGET`;
- `SMOOTHING_ALPHA = 0.08`;
- global intensity multiplier;
- per-axis budget clamp;
- `dailyVectorVariance`;
- formation progress;
- regression к home personality;
- depth-of-immersion;
- dynamic radius by age.

Вывод: core math в целом соответствует `PERSONALITY_EVOLUTION_SYSTEM.md`.

### 2.2 Formation и evolution proposal

Реализовано:

- `FORMATION_THRESHOLD = 200`;
- `FORMATION_WEIGHTS`;
- `completeFormation()`;
- `STABILITY_SYNCS = 72`;
- `HYSTERESIS = 8`;
- proposal с `coreMemoryIds` и `narrativeText`;
- accept/reject evolution.

Вывод: долгосрочная эволюция работает по правильной модели.

### 2.3 Core Memories

Реализовано:

- rare memories на first threshold crossing;
- `visitedZones` как защита от ghost memories;
- common memories на weekly drift;
- cooldown per `(trait, direction)`;
- FIFO cap для common memories;
- `MemoryTextGenerator` abstraction.

Вывод: memory subsystem близка к документу, но ей не хватает richer event/cause features.

### 2.4 Critical emergent states v5

Реализовано:

- `singularity`;
- `identity_crisis`;
- `shadow_form`;
- `confused`;
- sleep exploit fix: confused сбрасывается только после natural wake >= 4h;
- shadow cooldown;
- state layers.

Вывод: v5 critical states реализованы, но часть reward/economy эффектов не подключена.

### 2.5 State layers

Файл: `src/personality/stateLayers.ts`

Это сильнее исходного документа: вместо single `pet.emergentState` есть слои:

- `gameplay`;
- `evolution`;
- `cognitive`.

Вывод: направление правильное. Нужно завершить миграцию UI/API с legacy single state на public active states.

---

## 3. Главный архитектурный разрыв

Сейчас движок фактически состоит из двух связанных подсистем:

1. `TraitEvolutionEngine.ts`
   - отвечает за v5 trait evolution;
   - относительно близок к документу;
   - почти pure domain logic.

2. `PersonalityEngine.ts`
   - отвечает за gameplay-характер: decay, action modifiers, mood, counters, flags, gameplay emergent states;
   - содержит hardcoded personality logic;
   - не соответствует принципу "data-driven до конца".

Проблема не в самом разделении на два слоя. Проблема в том, что gameplay layer не является data-driven и частично размазан между:

- `PersonalityEngine.ts`;
- `commandHandlers.ts`;
- `mockApi.ts`;
- `personalities.ts`;
- `patternRules.ts`;
- `emergentStates.ts`.

Практическое последствие:

- добавить 17-й характер без изменения engine нельзя;
- replay не является полным источником gameplay truth;
- backend и mock могут разойтись;
- часть правил невозможно безопасно балансировать через registry;
- объяснимость "почему питомец стал таким" неполная.

---

## 4. Что сделано неправильно или не до конца

### GAP-1. `PersonalityEngine` не data-driven

Проблема:

- `PersonalityEngine.ts` прямо проверяет конкретные personality IDs:
  - `chaotic`;
  - `empath`;
  - `anxious`;
  - `feral`;
  - `foodie`;
  - `stoic`;
  - `sage`;
  - `pristine`;
  - `greedy`;
  - `paranoid`;
  - `bold`;
  - `playful`;
  - `melancholic`;
  - `adventurer`.

Почему это плохо:

- нарушает главный принцип v5;
- усложняет добавление новых характеров;
- special behavior нельзя валидировать как данные;
- баланс и LiveOps не могут управлять этими условиями.

Что нужно сделать:

- добавить data-driven registry для gameplay rules;
- перенести туда:
  - emergent state conditions;
  - passive effects;
  - decay conditions;
  - action modifiers;
  - mood rules;
  - special action gates.

Критерий готовности:

```bash
rg "personality\\.id ===|personality\\.id !==" src/personality/PersonalityEngine.ts
```

В идеале команда ничего не находит, кроме временно разрешенного compatibility shim.

---

### GAP-2. `mockApi` всё ещё содержит domain/gameplay semantics

Текущий прогресс:

- прямые personality influence internals из `mockApi` уже убраны;
- `use_item` item-as-food fallback перенесён в command layer.

Оставшаяся проблема:

`mockApi` всё ещё сам решает gameplay outcome:

- base stat deltas;
- XP;
- coins;
- action-specific checks;
- часть special cases:
  - paranoid restore multiplier;
  - feral bath penalty;
  - paranoid heal refusal;
  - melancholic every-other-action XP;
  - anxious peak performance.

Почему это плохо:

- backend должен будет повторить эту логику отдельно;
- replay через `applyPersonalityCommand()` не воспроизводит полный gameplay result;
- mock adapter остаётся не thin-wrapper, а частичным gameplay engine.

Что нужно сделать:

- расширить `PetCommandResult`;
- возвращать из command layer:
  - `statDeltas`;
  - `xpDelta`;
  - `coinDelta`;
  - `blockedAction`;
  - applied modifiers;
  - action events;
- оставить `mockApi` только для persistence, inventory, achievements, quests и UI events.

Критерий готовности:

- `mockApi` не вызывает personality/gameplay calculators напрямую для care/play actions;
- backend сможет вызвать один command handler и получить тот же gameplay outcome.

---

### GAP-3. System influences существуют, но почти не применяются

В `influenceRegistry.ts` есть:

- `system:inactivity_long`;
- `system:consistent_week`;
- `system:starvation`;
- `env:same_room_48h`.

Проблема:

- command layer не имеет generic sync-pass, который выбирает и применяет подходящие system influences;
- часть условий есть в registry, но фактически не участвует в поведении.

Что нужно сделать:

- на `sync` запускать `applyEligibleSystemInfluences()`;
- использовать `conditions`;
- учитывать cooldowns;
- логировать applied/skipped events.

Критерий готовности:

- тесты доказывают, что inactivity/starvation/consistent_week меняют trait vector только через registry;
- нет ручных hardcoded system effects вне registry.

---

### GAP-4. `onApply` в `RegisteredInfluence` не стал generic hook

В типах есть:

- `sleep_start`;
- `sleep_wake_natural`;
- `sleep_wake_early`.

Проблема:

- sleep/wake lifecycle реализован вручную в `commandHandlers.ts`;
- registry поле `onApply` не является настоящим generic extension point.

Что нужно сделать:

- реализовать `runInfluenceLifecycleHook(influence.onApply, pet, command, ctx)`;
- оставить прямую sleep/wake ветку только как command semantics;
- lifecycle side effects привязать к influence application.

Критерий готовности:

- добавление нового `onApply` hook не требует изменения `applyPersonalityCommand()` по всей ветке.

---

### GAP-5. Domain events неполные

Сейчас есть часть событий:

- trait vector changed;
- memory added;
- evolution proposed/recorded;
- emergent state changed;
- sleep started/finished;
- cooldown skipped.

Не хватает:

- command accepted;
- influence applied;
- influence skipped by condition;
- counters changed;
- flag activated;
- flag healed;
- flag deactivated;
- state entered/exited по слоям;
- stat deltas;
- XP/coin deltas;
- system influence applied;
- catharsis progress changed;
- legacy recorded.

Почему это плохо:

- нельзя объяснить игроку цепочку причин;
- нельзя обучать/balance-симулировать на events;
- replay не является единым источником truth.

Что нужно сделать:

- добавить durable `PersonalityEvent[]` / расширенный `DomainEvent[]`;
- хранить последние N событий в pet/offline save;
- старую историю агрегировать в snapshots;
- добавить explanation helpers:
  - `explainCurrentPersonality(pet)`;
  - `explainFlag(flag)`;
  - `explainEvolutionProposal(proposal)`.

---

### GAP-6. `stateLayers` ещё не public source of truth

Сейчас:

- `stateLayers` уже работает;
- `pet.emergentState` остаётся legacy projection;
- UI в основном использует primary state.

Проблема:

- UI не показывает все активные состояния;
- API contract не даёт удобный public selector;
- `pet.emergentState` выглядит как главный state, хотя это legacy поле.

Что нужно сделать:

- добавить public field/selector `activeEmergentStates`;
- пометить `pet.emergentState` как legacy в типах/доках;
- обновить UI banners/inspector;
- сохранить backward compatibility.

---

### GAP-7. `EVOLUTION_LEGACY` не подключен к gameplay economy

В `personalityTraitMap.ts` есть legacy bonuses:

- XP multiplier bonus;
- coin multiplier bonus;
- unique trait.

Сейчас:

- legacy влияет на `legacyCoefficient`;
- `memoryGuardian` создаётся;
- но XP/coin/uniqueTrait бонусы не применяются в gameplay.

Что нужно сделать:

- добавить account-level legacy modifiers в command context;
- применять их в action outcome;
- покрыть тестами:
  - chaotic legacy chance;
  - greedy coin bonus;
  - empath bond unique trait;
  - paranoid all-stats-high XP bonus.

---

### GAP-8. Catharsis reward не реализован полностью

Документ обещает:

- первый catharsis даёт XP x5 на 2 часа;
- повторные catharsis дают только memory;
- 14-дневный cooldown защищает от фарма.

Сейчас:

- `catharsisAchieved`;
- memory;
- cooldown;
- progress.

Не хватает:

- временного XP burst;
- storage поля для burst window;
- action modifier, который применяет burst;
- тестов на first-only reward.

Решение:

- либо реализовать burst;
- либо убрать обещание из спецификации, если это не нужно продукту.

---

### GAP-9. Singularity item cooldown bypass не реализован

Документ обещает:

- в `singularity` кулдауны всех предметов обходятся.

Сейчас:

- `singularity` даёт XP/coin modifiers;
- collapse реализован;
- bypass item cooldowns не реализован.

Решение:

- либо реализовать rule в cooldown gate;
- либо убрать обещание из спецификации.

---

### GAP-10. UI/product слой неполный

Документ предполагает:

- `TraitRadar`;
- `EvolutionBanner`;
- `CoreMemoryCard`;
- `EvolutionHistory`;
- `SingularityBanner`;
- `NpcVisitPanel`;
- `CatharsisProgress`;
- `DynastyLegacyBadge`.

Сейчас есть:

- `EvolutionInspector`;
- `PersonalityTestPage`;
- частичное отображение memories/vector.

Что нужно сделать:

- выбрать production UX для evolution system;
- не оставлять важную механику только в debug/test page;
- вывести:
  - active states;
  - proposal;
  - memories;
  - shadow/catharsis progress;
  - legacy/new life memory guardian.

---

## 5. Что нужно убрать

### REMOVE-1. Noop `anxiousMult`

Удалить:

```ts
const anxiousMult = personality.id === 'anxious' ? 1.0 : 1.0;
```

Причина:

- всегда `1.0`;
- создаёт ложное впечатление, что anxious decay logic реализована отдельным правилом.

---

### REMOVE-2. Noop `result.xp = result.xp`

Удалить или заменить реальной логикой:

```ts
if (personality.specialRules?.xpEveryOtherAction) {
  result.xp = result.xp;
}
```

Решение:

- либо перенести melancholic XP rule в command/gameplay outcome;
- либо явно оставить в mock economy и удалить noop из engine.

---

### REMOVE-3. Комментарии, которые обещают несуществующее поведение

Примеры:

- `perfect_balance` passive bonus "обрабатывается в computeNaturalPassives", но stat passive не реализован;
- `chaos_surge` "проверяется снаружи", но явной реализации нет;
- anxious peak comment говорит одно, фактическая логика живёт отдельно.

Решение:

- комментарии должны соответствовать факту;
- unsupported specialRules должны валидироваться.

---

### REMOVE-4. Hardcoded personality checks из engine

Целевое состояние:

- `PersonalityEngine` содержит generic evaluators;
- personality-specific behavior живёт в data registry.

---

## 6. Что нужно добавить

### ADD-1. Gameplay rule registry

Нужны data blocks:

```ts
interface GameplayRuleRegistry {
  emergentConditions: GameplayEmergentCondition[];
  passiveEffects: PassiveEffectDefinition[];
  decayRules: DecayRuleDefinition[];
  actionRules: ActionRuleDefinition[];
  moodRules: MoodRuleDefinition[];
}
```

Минимально можно начать с:

- `emergentConditions`;
- `passiveEffects`.

---

### ADD-2. Generic condition/effect evaluator

Condition primitives:

- `personality_is`;
- `stat_below`;
- `stat_above`;
- `avg_stats_above`;
- `counter_above`;
- `flag_active`;
- `time_of_day`;
- `session_gap_above`;
- `coin_balance_below`;
- `recent_action_count`;
- `current_state`;
- `elapsed_since_state_entered`.

Effect primitives:

- enter state;
- clear state;
- set one-shot guard;
- add passive stat delta;
- multiply XP;
- multiply coins;
- block action;
- alter decay;
- heal flag;
- set mood bias override.

---

### ADD-3. Full command outcome

`PetCommandResult` должен стать пригодным для backend/mock/replay:

```ts
interface PetCommandResult {
  pet: Pet;
  command: PetCommand;
  events: DomainEvent[];
  gameplay?: {
    blocked?: BlockedAction;
    statDeltas: Partial<Record<StatKey, number>>;
    xpDelta: number;
    coinDelta: number;
    appliedModifiers: string[];
  };
  influenceCooldowns: InfluenceCooldownState;
  engineVersion: string;
  registryVersion: string;
}
```

---

### ADD-4. Durable event history

Add to pet/offline save:

```ts
personalityEvents: DomainEvent[];
```

Retention:

- keep last 500 detailed events;
- aggregate older data into snapshots.

---

### ADD-5. Public active states

Add selector/API field:

```ts
activeEmergentStates: ActiveEmergentState[];
```

Keep:

```ts
emergentState: EmergentStateType | null; // legacy primary projection
```

---

### ADD-6. System influence sync pass

На `sync`:

1. собрать eligible system/environment influences;
2. проверить conditions;
3. проверить cooldown;
4. применить;
5. записать events.

---

### ADD-7. Simulation reports

Нужны scripts/tests для баланса:

- formation speed;
- evolution speed;
- shadow entry/recovery;
- confused frequency;
- singularity rarity;
- memory generation rate;
- personality distribution under common play styles.

---

## 7. Приоритетный план исправлений

### Phase 0. Зафиксировать текущее состояние

Статус: mostly done.

Проверки:

```bash
npm test
npm run build
```

Дополнительно:

```bash
rg "applyPetInfluence|applyInfluence|canApplyInfluenceAtSync|checkThresholdCrossings|getInfluenceRegistry" src/api/mockApi.ts
```

Ожидание:

- `mockApi.ts` не содержит direct influence internals.

---

### Phase 1. Cleanup before refactor

Цель: убрать ложные сигналы и мёртвый код перед data-driven refactor.

Задачи:

1. Удалить `anxiousMult`.
2. Удалить melancholic XP noop.
3. Решить `perfect_balance`:
   - либо только XP multiplier и поправить комментарии;
   - либо реальный passive stat bonus.
4. Решить `chaos_surge`:
   - реализовать;
   - или удалить/отложить из active docs.
5. Добавить validator для unsupported `specialRules`.

Критерий готовности:

- нет noop logic;
- комментарии соответствуют поведению;
- unsupported fields явно валидируются.

---

### Phase 2. Data-driven gameplay emergent states

Цель: убрать hardcoded conditions из `computeEmergentState()`.

Перенести в registry:

- `stoic_peak`;
- `enlightenment`;
- `feast_frenzy`;
- `deep_melancholy`;
- `wanderlust`;
- `midnight_zoomies`;
- `coin_obsession`;
- `food_panic`;
- `trust_collapse`;
- `apathy`;
- `tantrum`;
- `contamination_crisis`;
- `breakdown`.

Критерий готовности:

```bash
rg "personality\\.id ===|personality\\.id !==" src/personality/PersonalityEngine.ts
```

Не должно находить personality-specific emergent state logic.

Тест:

- synthetic personality с custom emergent condition входит в state без правки engine.

---

### Phase 3. Data-driven passives / action / decay

Цель: убрать оставшиеся hardcoded gameplay modifiers.

Перенести:

- foodie full passive;
- pristine cleanliness passive;
- empath bond passive;
- feral night energy decay;
- chaotic daily multipliers;
- anxious peak performance;
- paranoid restore phases;
- melancholic every-other-action XP;
- adventurer food boredom/new room bonus.

Критерий готовности:

- engine содержит generic evaluators;
- personality-specific behavior живёт в data;
- validators ловят неподдержанные rule fields.

---

### Phase 4. Command result owns gameplay outcome

Цель: сделать `applyPersonalityCommand()` единым доменным entrypoint.

Задачи:

1. Добавить gameplay outcome в `PetCommandResult`.
2. Перенести base action result calculation из `mockApi` в command/gameplay layer.
3. Вернуть blocked action как typed result.
4. Оставить `mockApi` как adapter:
   - inventory;
   - achievements;
   - quests;
   - persistence;
   - UI events.

Критерий готовности:

- replay может восстановить pet stats/xp/coins для personality/gameplay domain;
- mock/backend используют один outcome.

---

### Phase 5. System influences and lifecycle hooks

Цель: сделать registry реально управляющим system behavior.

Задачи:

1. Реализовать `applyEligibleSystemInfluences()` на `sync`.
2. Реализовать generic `onApply` hooks.
3. Подключить:
   - inactivity;
   - consistent week;
   - starvation;
   - same room 48h.

Критерий готовности:

- system influences меняют trait vector через registry, не через hardcoded code.

---

### Phase 6. Durable event history and explainability

Цель: объяснимость и будущая обучаемость.

Задачи:

1. Расширить `DomainEvent`.
2. Добавить event history в pet/offline save.
3. Добавить retention.
4. Добавить explain helpers.

Критерий готовности:

- можно ответить "почему текущий характер такой";
- replay и explanation используют одни события.

---

### Phase 7. Public state layers and UI

Цель: вывести механику игроку.

Задачи:

1. Добавить public `activeEmergentStates`.
2. Обновить UI components.
3. Добавить production views:
   - memories;
   - evolution proposal;
   - singularity;
   - shadow/catharsis;
   - legacy/new life.

---

### Phase 8. Legacy bonuses and remaining v5 promises

Цель: закрыть расхождения со спецификацией.

Задачи:

1. Подключить `EVOLUTION_LEGACY` XP/coin/uniqueTrait.
2. Реализовать или удалить catharsis XP burst.
3. Реализовать или удалить singularity item cooldown bypass.
4. Проверить LiveOps runtime path.

---

### Phase 9. Simulation and balance

Цель: проверить, что система не только архитектурно правильная, но и играется нормально.

Reports:

- common player path;
- neglect path;
- heavy play path;
- food-only path;
- balanced care path;
- chaotic/random path;
- shadow recovery path;
- singularity rarity path.

---

## 8. Definition of Done для возврата к цели v5

Система считается вернувшейся к цели документа, когда:

1. Новый характер можно добавить через data registry без правки engine.
2. `applyPersonalityCommand()` является главным source of truth для personality/gameplay domain.
3. `mockApi` не содержит personality/gameplay internals.
4. System influences реально применяются через registry.
5. State layers доступны UI/API как public active states.
6. Event history объясняет цепочку причин.
7. Legacy bonuses либо реализованы, либо удалены из обещаний.
8. Catharsis/singularity promises либо реализованы, либо удалены из спецификации.
9. Есть simulation reports для скорости и баланса.
10. `npm test` и `npm run build` проходят.
