# Полный код-ревью: `Zdesagochi/src/personality`

> Статус после cleanup: 2026-05-12  
> Исправлено из этого аудита:
> - `clonePet` / backend clone больше не используют прямой JSON round-trip, добавлен `cloneData()` со `structuredClone` fallback.
> - `getPlayScore()` для `play` fallback считается один раз и используется и для `meta.score`, и для rewards.
> - `rare` CoreMemories ограничены cap 50; `common` cap 20 сохранён.
> - `rollingFoodCounts()` считает 7-дневное окно от текущего `now`, а не от последнего bucket.
> - Убрана сортировка rolling buckets на каждой вставке.
> - Дублированный `seededRandom` вынесен в shared utility.
> - Добавлен `getPersonalityStrict()` для явного fail-fast lookup; compatibility `getPersonality()` пока сохраняет fallback для старых saves.
> - `FLAG_RESTORE_EFFECTS` и base action effects вынесены в `actionRules` registry с validator.
> - Passive effects вынесены в `passiveRules` registry с validator; `computeNaturalPassives()` теперь executor.
> - Decay rules вынесены в `decayRules` registry с validator; `applyDecay()` теперь executor.
> - Добавлены regression tests на stale food buckets, play score consistency, memory caps, strict personality lookup.
>
> Всё ещё актуально как архитектурный долг:
> - `BehavioralCounters` остаётся монолитным объектом.
> - `applyGameplayCommand()` всё ещё слишком крупная orchestration-функция.
> - `random` / `rng` в `TraitEvolutionContext` ещё не объединены.
> - legacy `emergentState` и layered state всё ещё синхронизируются двусторонне.
> - `influenceRegistry` всё ещё использует module-level mutable cache для remote registry/balance patches.

---

## 1. Что делает этот код

Это **движок личности виртуального питомца** (тамагочи). Система решает три задачи одновременно:

1. **Геймплей** — симуляция статов (hunger, energy, health…), действий (feed, play, sleep…), эмерджентных состояний (tantrum, breakdown…) и экономики (XP, coins).
2. **Эволюция личности** — трекинг вектора из 6 черт (`vitality`, `sociality`, `order`, `appetite`, `caution`, `curiosity`). Питомец «дрейфует» к одной из 16 личностей и может эволюционировать.
3. **Поведенческая память** — накапливаются флаги (trauma, trust), скользящие счётчики паттернов поведения игрока, ключевые воспоминания (CoreMemory).

Архитектурно код **data-driven**: характеры, правила Pattern Engine, эмерджентные состояния и влияния описаны как декларативные данные; движок читает эти данные и не знает о конкретных характерах. Это хорошая идея, но реализована непоследовательно.

---

## 2. Сильные стороны

- **Разделение данных и логики**: `personalities.ts`, `patternRules.ts`, `emergentStates.ts` — чистые данные. Добавить новый характер или правило можно без правки движка.
- **Чистые функции в `PersonalityEngine.ts`**: нет глобального состояния, легко тестировать.
- **MODIFIER_CAPS**: защита экономики от взрывного стекинга модификаторов.
- **Rolling windows**: правильный подход — скользящие бакеты вместо event log.
- **Детерминированный RNG**: `createDeterministicRng` из `commandId+at+type` — правильно для реплея.
- **`validatePatternRules` и `validatePersonalitySpecialRules`**: попытки валидации данных при старте.
- **`OfflineKeyValueStorage` как интерфейс**: хорошая изоляция от `localStorage`.

---

## 3. Критические баги и логические ошибки

### 3.1 `clonePet` через JSON round-trip — O(N²) при реплее
**Файл**: `commandHandlers.ts:888`  
**Риск**: КРИТИЧЕСКИЙ

```ts
function clonePet(pet: Pet): Pet {
  return JSON.parse(JSON.stringify(pet)) as Pet;
}
```

При каждом вызове `applyPersonalityCommand` клонируется весь объект `Pet` через полный JSON round-trip. `Pet` содержит `coreMemories[]`, `dailyTraitSnapshots[]`, `moodHistory[]`, `behavioralCounters` с `rollingWindows.dailyBuckets[]`. При 30 снапшотах и 168 mood-записях это ~50–100 KB на каждый тик. В `replayPersonalityCommands` это вызывается на каждую команду в цикле — **O(N²) по памяти и времени** при реплее длинного лога.

**Fix**: `structuredClone(pet)` или ручное клонирование только изменяемых частей.

---

### 3.2 Сортировка бакетов при каждом инкременте
**Файл**: `PersonalityEngine.ts:831, 843`

```ts
counters.rollingWindows.dailyBuckets.sort((a, b) => a.date.localeCompare(b.date));
```

Вызывается в `incrementRollingCounter` и `incrementRollingFood` — при каждом action. Сортировка массива при каждой вставке — O(N log N) там, где нужен O(1). Массив уже отсортирован при pruning — достаточно просто push.

---

### 3.3 `getPersonality` с silent fallback
**Файл**: `personalities.ts:853`

```ts
export const getPersonality = (id: string): PersonalityDefinition =>
  PERSONALITIES_MAP.get(id as any) ?? PERSONALITIES[0];
```

Неизвестный `id` возвращает `playful` **без ошибки и без лога**. Если питомец сохранён с удалённым характером — он молча станет Playful. Скрытое повреждение данных.

---

### 3.4 `addCoreMemory` — unbounded `rare`, квадратичная фильтрация
**Файл**: `TraitEvolutionEngine.ts:700–703`

```ts
pet.coreMemories.unshift(coreMemory);
const rare = pet.coreMemories.filter(m => m.tier === 'rare');   // нет slice!
const common = pet.coreMemories.filter(m => m.tier === 'common').slice(0, 20);
pet.coreMemories = [...rare, ...common].sort(...);
```

- `rare` ограничены — нет. `common` ограничены 20. При многих эволюциях массив `rare` растёт бесконечно.
- 2× filter + sort при каждом добавлении воспоминания — O(N) на каждый вызов.

---

### 3.5 Hardcoded пороги параноика вместо `specialRules`
**Файл**: `PersonalityEngine.ts:575–587`

```ts
if (c.paranoidPhase === 'untrusted' && c.bondActionsInPhase >= 10) { // hardcode
if (c.paranoidPhase === 'collapsed' && c.bondActionsInPhase >= 20) { // hardcode
```

`specialRules.trustThresholdBonds = 10` объявлен в данных, но движок его **игнорирует**. `personalities.ts` сам помечает это как `status: 'deferred'`. То же для `untrustedPhaseDays`.

---

### 3.6 `rollingFoodCounts` использует `latestDate` вместо `now`
**Файл**: `PersonalityEngine.ts:923–935`

```ts
const latestDate = buckets[buckets.length - 1]?.date ?? counters.lastDayReset;
```

Окно 7 дней считается не от текущей даты, а от последнего бакета. Если пользователь не играл 10 дней — окно сдвигается в прошлое, старые данные ошибочно попадают в «7 дней».

---

### 3.7 `trust_bond_deactivate` без grace period
**Файл**: `patternRules.ts:150–161`

Флаг `trust_bond` деактивируется при `consecutiveGoodSyncs < 336`. Но `consecutiveGoodSyncs` сбрасывается при **любом** не-хорошем синке. Флаг будет выдан и моментально снят в следующем плохом синке.

---

## 4. Архитектурные проблемы

### 4.1 `BehavioralCounters` — монструозный объект на 30+ полей
`BehavioralCounters` хранится внутри `Pet` и содержит 30+ полей разной природы: скользящие счётчики, одноразовые флаги, seed хаотика, параноик-фаза, комната, timestamp'ы. Нарушение SRP.

**Проблема масштабируемости**: каждый новый характер добавляет 2–5 полей сюда. При 30 характерах станет неуправляемым.  
**Fix**: `extensionCounters: Record<string, unknown>` с типизированными accessor'ами на уровне характера.

---

### 4.2 Дублирование `seededRandom` в двух файлах
`PersonalityEngine.ts:56–62` и `gameplayStateRules.ts:230–236` — **идентичная** реализация. При изменении алгоритма нужно менять в двух местах.

---

### 4.3 `applyGameplayCommand` — God Function
**Файл**: `commandHandlers.ts:265–406`  
140 строк, делает: decay, sleep restore, passives, auto-sleep, action outcome, counter update, mood calculation, pattern engine, emergent state computation. Невозможно тестировать отдельные шаги.

---

### 4.4 `FLAG_RESTORE_EFFECTS` захардкожен в движке
**Файл**: `PersonalityEngine.ts:982–1007`

```ts
const FLAG_RESTORE_EFFECTS = {
  food_anxiety: { feed: { happiness: 5 } },
  ...
}
```

Эффекты флагов — **данные**, не логика. Должны быть в `patternRules.ts`. Добавить новый флаг = правки в 3 местах: `BehavioralFlagType`, `patternRules`, `FLAG_RESTORE_EFFECTS`.

---

### 4.5 Два RNG в `TraitEvolutionContext`
**Файл**: `TraitEvolutionEngine.ts:72–73`

```ts
random?: () => number;
rng?: () => number;
```

Два одинаковых поля. `getRandom` использует оба:
```ts
return ctx.rng ?? ctx.random ?? Math.random;
```

---

### 4.6 Двусторонняя синхронизация legcy ↔ layers
**Файл**: `stateLayers.ts`

Поддерживаются ДВА способа хранения состояния: `pet.emergentState` (legacy string) и `pet.stateLayers` (новая система слоёв). Каждое изменение требует двойной синхронизации. `syncLegacyEmergentState` и `syncLayeredStatesFromLegacy` вызываются в нескольких местах — риск рассинхронизации.

---

### 4.7 Глобальное мутируемое состояние в `influenceRegistry`
**Файл**: `influenceRegistry.ts:12–14`

```ts
let remoteRegistry: RegisteredInfluence[] = [];
let globalBalancePatches: GlobalBalancePatch[] = [];
let remoteRegistryFetchedAt: number | null = null;
```

Модульные переменные — неявный singleton. Нельзя тестировать в изоляции. Side-effect `validateInfluenceRegistry(STATIC_INFLUENCE_REGISTRY)` при импорте — скрытая точка отказа.

---

## 5. Проблемы масштабируемости

### 5.1 Добавление нового характера требует правок в 5–7 местах
1. `personalities.ts` — определение
2. `personalityTraitMap.ts` — позиция в пространстве черт
3. `types.ts` — `PersonalityId` union
4. Возможно `patternRules.ts` — новые правила
5. Возможно `PersonalitySpecialRules` — новые поля
6. Возможно `BehavioralCounters` — новые поля
7. Возможно `EVOLUTION_LEGACY` — legacy бонус

Нет единой точки регистрации характера.

---

### 5.2 `PatternConditionType` — жёсткий union + giant switch

```ts
export type PatternConditionType =
  | 'action_in_stat_zone' | 'action_frequency' | 'stat_below_threshold' ...
```

Добавить новый тип = изменить union + добавить ветку в `evalCondition`. Switch будет расти бесконечно.

**Fix**: зарегистрированные evaluators:
```ts
const conditionEvaluators: Record<PatternConditionType, (cond, counters) => boolean> = {...}
```

---

### 5.3 `actionZoneCounter` поддерживает только 3 комбинации
**Файл**: `PersonalityEngine.ts:459–465`

```ts
function actionZoneCounter(action: string, zone: string, c: BehavioralCounters): number {
  if (action === 'feed' && zone === 'red')   return c.feedInRedZone7d;
  if (action === 'feed' && zone === 'green') return c.feedInGreenZone7d;
  if (action === 'sleep' && zone === 'high') return c.forcedSleepCount7d;
  ...
  return 0;  // все остальные комбинации → 0
}
```

Невозможно добавить правило `action_in_stat_zone` для нового действия без правки движка. Полное нарушение data-driven принципа.

---

### 5.4 Базовые эффекты действий захардкожены
**Файл**: `commandHandlers.ts:500–548`

```ts
case 'play':
  return { statDeltas: { happiness: 20, energy: -15, bond: 8 }, xp: ... };
case 'bathe':
  return { statDeltas: { cleanliness: 40, happiness: ..., health: 5 }, xp: 12 };
```

Базовые эффекты действий — данные. Сложно балансировать, невозможно A/B тестировать без деплоя.

---

### 5.5 Трейт-влияния неполны для большинства характеров
В `influenceRegistry.ts` нет специфических intensityRules для `pristine`, `melancholic`, `stoic` и других. Их трейт-вектор двигается теми же силами, что и у всех остальных, что делает эволюцию к ним менее детерминированной.

---

## 6. Проблемы поддержки

### 6.1 `DEFERRED` specialRules — незаконченная функциональность в продакшне
`SPECIAL_RULE_SUPPORT` явно помечает как `'deferred'`:
- `playThirstEnabled` (Игривый) — объявлен, **не работает**
- `stoicPeakOnceOnly` — захардкожен через counter, игнорирует флаг
- `newRoomBonusEnabled` (Авантюрист) — объявлен, **не работает**
- `untrustedPhaseDays` / `trustThresholdBonds` (Параноик) — данные игнорируются движком

`validatePersonalitySpecialRules` выдаёт warnings, но они нигде не блокируют.

---

### 6.2 Нарушение инкапсуляции счётчиков
**Файл**: `PersonalityEngine.ts:572`

```ts
// bad mood streak
// обновляется вызывающим кодом с текущим mood
```

`updateCounters` — функция обновления счётчиков, но часть счётчиков обновляется снаружи. Нет гарантии, что вызывающий код это сделает.

---

### 6.3 Магические числа без объяснения
- `STOIC_FLAT_PLAY_XP = 15` — почему 15?
- `LEGACY_BLEND_RATIO = 0.70` — без комментария
- `levelBonusCoins += level * 5` — формула захардкожена
- Park-Miller PRNG без документирования (`s * 16807 % 2147483647`)
- FNV-1a hash без комментария (`Math.imul(seed, 16777619)`)

---

### 6.4 Async в неожиданных местах
`checkThresholdCrossings` и `checkWeeklyDrift` — `async` из-за `memoryTextGenerator.generate()`. При дефолтном `TemplateGenerator` — всегда синхронные, но обёрнуты в Promise. Усложняет тестирование.

---

## 7. Проблемы безопасности и надёжности

### 7.1 `uniqueFoodsTried` — unbounded array

```ts
uniqueFoodsTried: string[];
```

Растёт бесконечно за всё время жизни питомца. Нет TTL, нет cap. При расширении магазина — большой JSON при каждом сохранении.

### 7.2 Remote influence без защиты traumaDelta
Remote патч может изменить intensity влияния с `traumaDelta`, обнуляя его эффект. Нет server-side проверки, клиентская валидация это не покрывает.

### 7.3 `applyActionOutcome` вызывает `getPlayScore` дважды
**Файл**: `commandHandlers.ts:454–456, 500–505`

```ts
if (command.type === 'play') {
  outcome.meta.score = getPlayScore(command, context.rng);  // 1й вызов
}
...
case 'play': {
  const score = getPlayScore(command, context.rng);  // 2й вызов
```

Если `scoreSeed` отсутствует, вызывается `rng()` — два разных вызова RNG дают два разных результата. `meta.score` и `xp` основаны на **разных** значениях score.

---

## 8. Таблица рисков по файлам

| Файл | Критичность | Основные проблемы |
|------|-------------|-------------------|
| `commandHandlers.ts` | 🔴 Высокая | `clonePet` O(N²), God function, `getPlayScore` вызван дважды |
| `PersonalityEngine.ts` | 🟠 Средняя | Сортировка на каждой вставке, `rollingFoodCounts` баг даты, hardcoded паттерны |
| `TraitEvolutionEngine.ts` | 🟠 Средняя | Unbounded `rare` memories, двойной RNG |
| `personalities.ts` | 🟠 Средняя | 5+ deferred rules, `getPersonality` silent fallback |
| `influenceRegistry.ts` | 🟠 Средняя | Глобальный mutable state, side-effect при импорте |
| `types.ts` | 🟡 Низкая | `BehavioralCounters` монолит, legacy + новые поля вперемешку |
| `stateLayers.ts` | 🟡 Низкая | Двойная синхронизация legacy↔layers |
| `patternRules.ts` | 🟡 Низкая | `trust_bond_deactivate` без grace period |
| `gameplayStateRules.ts` | 🟡 Низкая | Дублирование `seededRandom`, hardcoded sets слоёв |
| `memoryTextGenerator.ts` | 🟢 Нормально | Чистая структура, хороший fallback |
| `offlineStorage.ts` | 🟢 Нормально | Чистый код, хорошая изоляция |

---

## 9. Приоритетный план исправлений

### Срочно (баги с влиянием на данные/производительность)
1. **Заменить `clonePet`** на `structuredClone()`.
2. **Ограничить `rare` CoreMemories** (например, 50 штук, удалять самые старые).
3. **Убрать сортировку** из `incrementRollingCounter` / `incrementRollingFood`.
4. **Исправить `rollingFoodCounts`** — использовать `now` из контекста вместо `latestDate`.
5. **Исправить двойной вызов `getPlayScore`** — вычислять один раз, передавать в оба места.
6. **Сделать `getPersonality` явно бросающим** при неизвестном id (или хотя бы логировать).

### Среднесрочно (архитектура)
7. **Вынести `FLAG_RESTORE_EFFECTS`** из движка в данные рядом с определениями флагов.
8. **Вынести базовые эффекты действий** из `getBaseActionResult` в конфигурационный объект.
9. **Изолировать глобальное состояние** `influenceRegistry` — фабрика или DI.
10. **Объединить `random`/`rng`** в `TraitEvolutionContext` в одно поле.
11. **Реализовать deferred specialRules** или удалить до реализации.
12. **Вынести `seededRandom`** в shared utility.

### Долгосрочно (масштабируемость)
13. **Вынести характер-специфичные счётчики** из `BehavioralCounters` в `extensionCounters`.
14. **Зарегистрированные evaluators** для `PatternConditionType` вместо switch.
15. **Декларативный lifecycle** EmergentState (enter/exit условия в данных).
16. **Перенести `EmergentStateLayer`** в определение состояния (`EmergentStateDefinition`).
17. **Расширить `actionZoneCounter`** через registry вместо hardcoded if-chain.
