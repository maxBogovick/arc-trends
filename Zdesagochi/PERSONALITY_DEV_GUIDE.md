# Система характеров — руководство разработчика

## Архитектура

Система построена на принципе **data-driven**: логика движка не знает о конкретных характерах.
Добавить новый характер = добавить один объект в массив. Движок не трогать.

```
src/personality/
  types.ts               ← все TypeScript типы
  personalities.ts       ← массив PERSONALITIES (16 объектов)
  patternRules.ts        ← массив PATTERN_RULES (правила флагов)
  emergentStates.ts      ← массив EMERGENT_STATE_DEFS (особые состояния)
  PersonalityEngine.ts   ← чистые функции (без состояния)
  index.ts               ← re-export всего публичного API

src/components/personality/
  PersonalityCard.tsx    ← карточка + кнопка «Сменить»
  PersonalityCatalog.tsx ← каталог всех характеров + смена
  MoodGraph.tsx          ← график настроения 7 дней
  StatBar.tsx            ← шкала стата с цветами характера
  EmergentStateBanner.tsx← баннер активного особого состояния
```

### Три слоя обработки

```
Слой 1 — Base Logic       mockApi.ts — базовая математика тиков
Слой 2 — PatternEngine    PersonalityEngine.ts — применяет характер
Слой 3 — Pattern Rules    patternRules.ts — данные правил флагов
```

Ни один слой не знает о внутренностях другого — только об интерфейсах.

---

## Как добавить новый характер (5 шагов)

### Шаг 1 — Добавить id в тип

Файл: `src/personality/types.ts`

```typescript
export type PersonalityId =
  | 'playful' | 'drowsy' | /* ... существующие */ 
  | 'cozy';   // ← добавить сюда
```

### Шаг 2 — Создать объект PersonalityDefinition

Файл: `src/personality/personalities.ts` — добавить в массив `PERSONALITIES`.

**Минимальный пример:**

```typescript
{
  id: 'cozy',
  name: 'Уютный',
  tagline: 'Домашний уют превыше всего',
  description: 'Любит тепло, еду и покой. Никаких приключений.',
  emoji: '🧸',
  rarity: 'common',      // 'common' | 'rare' | 'epic' | 'legendary'
  linkedSkinIds: [],     // ['skin_id'] — скины, автоматически дающие этот характер

  // ── Decay: 1.0 = норма, 1.5 = на 50% быстрее, 0.5 = вдвое медленнее
  decayRates: {
    hunger:      0.9,    // чуть медленнее
    happiness:   0.7,    // сильно медленнее
    energy:      1.0,
    health:      0.8,
    cleanliness: 1.0,
    bond:        0.8,
  },

  // ── Restore bonus: аддитив поверх базового (число, не множитель)
  // feed: { hunger: 10 } → кормление восстанавливает на 10 больше
  restoreBonus: {
    feed:  { happiness: 15 },
    sleep: { energy: 20 },
    bond:  { happiness: 10 },
  },

  // ── XP / Coins множители (1.0 = базовый)
  xpMultipliers:  { play: 1.0, feed: 1.2, bond: 1.5 },
  coinMultipliers: { play: 0.8 },

  // ── Еда
  foodPreferences: {
    lovedIds:    ['ramen', 'milk'],          // +loveBonus
    hatedIds:    ['candy'],                  // +hatePenalty
    loveBonus:   { happiness: 20 },
    hatePenalty: { happiness: -10 },
  },

  // ── Авто-сон
  autoSleep: { enabled: true, energyThreshold: 40, probability: 0.3 },

  // ── Настроение (пороги avg stats)
  moodBias: { ecstaticMinAvg: 80, happyMinAvg: 60, contentMinAvg: 40 },

  // ── Здоровье
  naturalHealthRegen: 0,         // +N health за sync-тик
  negativeEffectResistance: 0.3, // 0 = уязвим, 1 = иммунен

  // ── Флаги и состояния, которые может получить этот характер
  possibleFlags:     ['trust_bond', 'food_anxiety'],
  emergentTriggers:  [],  // [] если нет особых состояний

  // ── Визуал
  visualProfile: {
    statBarTints: {
      happiness: {
        warningColor: '#FACC15', warningThreshold: 35,
        criticalColor: '#EF4444', criticalThreshold: 15,
        pulseOnWarning: true,
      },
    },
    emergentStateAnims: {},
  },
}
```

> После добавления объекта в массив — характер уже доступен в каталоге и работает с движком.

### Шаг 3 — Привязать скин (опционально)

В объекте характера: `linkedSkinIds: ['my_skin_id']`

Когда пользователь надевает `my_skin_id`, характер применяется автоматически через `syncPersonalityFromSkin()`.

### Шаг 4 — Добавить особое состояние (если нужно)

Если характер должен входить в уникальное состояние, которого ещё нет:

1. Добавить тип в `EmergentStateType` в `types.ts`
2. Создать `EmergentStateDefinition` в `emergentStates.ts`
3. Добавить условие входа в `computeEmergentState()` в `PersonalityEngine.ts`
4. Добавить в `emergentTriggers` характера

**Пример состояния:**
```typescript
// emergentStates.ts
{
  type: 'cozy_nest',
  name: 'Уютное гнёздышко',
  description: 'Питомец свернулся и не хочет двигаться',
  emoji: '🪹',
  priority: 10,
  exclusive: false,
  blockedActions: [
    { actionType: 'play', reason: 'Слишком уютно', alternativeHint: 'Подожди пока сам захочет' },
  ],
  modifiedActions: [
    { actionType: 'sleep', statAdditives: { energy: 10 }, xpMultiplier: 1.0, coinMultiplier: 1.0 },
  ],
  exitHint: 'Покорми или поиграй в другой раз',
  visual: {
    bodyAnimation: 'curled',
    eyeExpression: 'half_closed',
    particleEffect: 'warmth',
    overlayTint: 'rgba(251,191,36,0.12)',
  },
},
```

```typescript
// PersonalityEngine.ts — в computeEmergentState()
if (personality.id === 'cozy' && stats.energy > 80 && stats.happiness > 80) {
  candidates.push({ type: 'cozy_nest', priority: 10 });
}
```

### Шаг 5 — Добавить правило флага (если нужно)

Файл: `src/personality/patternRules.ts`

```typescript
{
  id: 'cozy_comfort_activate',
  description: 'Уютный: bond > 70 неделю подряд → флаг доверия',
  personalityId: 'cozy',        // или undefined для универсального
  conditions: [
    { type: 'consecutive_syncs_cond', params: { minAvg: 70, threshold: 7 * 24 } },
  ],
  effect: { flagType: 'trust_bond', action: 'activate', severity: 1 },
},
```

Всё. Движок подхватит правило автоматически на следующем `runPatternEngine()`.

---

## Модификаторы: как работает стакинг

Все модификаторы стакаются **мультипликативно** и обрезаются жёсткими лимитами:

```
finalXP    = baseXP    × clamp(Π xpMults,         XP_MIN=0.1,   XP_MAX=4.0)
finalCoins = baseCoins × clamp(Π coinMults,        COIN_MIN=0.0, COIN_MAX=3.0)
finalDecay = baseDelta × clamp(Π decayMults,       0.05,         3.0)
restoreAdd = base      + clamp(Σ restoreBonuses,   0,            80)
```

Источники мультипликаторов при каждом действии:
1. `personality.xpMultipliers[action]`
2. Активный флаг (через `getFlagXpMult`)
3. Активное особое состояние (через `getStateXpMult`)
4. Специальные правила характера (`specialRules`)

---

## Поток выполнения каждого action в MockApi

```
feedPet(foodId):
  1. getPersonality(pet.personality)        → PersonalityDefinition
  2. isActionBlocked(action, emergentState) → 403 если заблокировано
  3. Базовая логика (еда, HP, etc.)
  4. applyActionModifiers(base, personality, flags, state, counters, ctx)
  5. Применить результат к S.pet.stats
  6. updateCounters(counters, action, stats, ctx)   ← O(1)
  7. runPatternEngine(counters, flags, personality)  ← O(правил)
  8. computeEmergentState(stats, personality, ...)   ← O(характеров)
  9. calcMoodWithBias(stats, personality, isAsleep)
  10. finalizePet()                                  → Pet
```

---

## Специальные правила (`specialRules`)

Поле `specialRules?: PersonalitySpecialRules` — расширяемый объект для механик, которые не укладываются в стандартные поля.

**Добавить новую специальную механику:**

1. Добавить поле в интерфейс `PersonalitySpecialRules` в `types.ts`:
```typescript
export interface PersonalitySpecialRules {
  // ... существующие
  myNewRule?: boolean;   // ← добавить
}
```

2. Установить в объекте характера:
```typescript
specialRules: { myNewRule: true }
```

3. Добавить обработку в `PersonalityEngine.ts` (там где логика нужна):
```typescript
if (personality.specialRules?.myNewRule && someCondition) {
  // твоя логика
}
```

---

## Счётчики поведения (`BehavioralCounters`)

Хранятся в `pet.behavioralCounters`. Обновляются при каждом action через `updateCounters()`.

Основные счётчики:

| Счётчик | Что считает |
|---------|-------------|
| `feedInRedZone7d` | Кормлений при hunger < 20 за 7д |
| `feedInGreenZone7d` | Кормлений при hunger > 60 за 7д |
| `sessionGapHours` | Часов с последнего действия |
| `sessionGapsOver48h_30d` | Пропусков > 48ч за 30д |
| `consecutiveGoodSyncs` | Синков подряд с avg > 70 |
| `consecutiveBadMoodSyncs` | Синков подряд с mood = sad |
| `uniqueFoodsTried` | Массив всех попробованных foodId |
| `playCountToday` | Игр за текущий день |
| `paranoidPhase` | 'untrusted' \| 'trusted' \| 'collapsed' |
| `stoicPeakUsed` | Был ли уже использован stoic_peak |

**Добавить новый счётчик:**

1. Добавить поле в `BehavioralCounters` в `types.ts`
2. Инициализировать в `createDefaultCounters()` в `PersonalityEngine.ts`
3. Обновлять в `updateCounters()` в `PersonalityEngine.ts`
4. Использовать в условии правила в `patternRules.ts` или `evalCondition()`

---

## PatternRule — формат условий

Файл: `src/personality/patternRules.ts`

```typescript
{
  id: 'rule_id',
  description: 'Человекочитаемое описание',
  personalityId: 'playful',   // или undefined = для всех

  conditions: [
    {
      type: 'action_in_stat_zone',
      params: { action: 'feed', zone: 'red', threshold: 5 },
      op: '>=',   // дефолт '>='
    },
  ],

  effect: {
    flagType: 'food_anxiety',
    action: 'activate',       // 'activate' | 'increment_severity' | 'add_heal_progress' | 'deactivate'
    severity: 1,
    healProgressDelta: 15,    // только для 'add_heal_progress'
  },

  severityThresholds: [5, 10, 20],  // динамическая severity по значению счётчика
}
```

**Типы условий:**

| type | params | Что проверяет |
|------|--------|---------------|
| `action_in_stat_zone` | action, zone (red/green/high), threshold | feedInRedZone7d, forcedSleepCount7d, etc. |
| `action_frequency` | action, countPerDay, threshold | maxConsecHighPlayDays |
| `stat_below_threshold` | statKey (health/cleanliness), threshold | consecutiveLowHealthSyncs, filthCrisisCount30d |
| `session_gap_hours` | threshold; op='<' для heal | sessionGapsOver48h_30d или sessionGapHours |
| `time_of_day_action` | action, threshold | nightWakeCount7d |
| `consecutive_syncs_cond` | minAvg/allStatsAbove, threshold | consecutiveGoodSyncs |
| `same_food_ratio` | ratio, minFeeds | отношение в dailyFoodLog |
| `unique_items_used` | minUnique | uniqueFoodsTried.length |

---

## Тестирование

Все функции в `PersonalityEngine.ts` — чистые (нет состояния). Тестируются напрямую:

```typescript
import { applyActionModifiers, runPatternEngine, createDefaultCounters } from '../personality/PersonalityEngine';
import { getPersonality } from '../personality/personalities';

const personality = getPersonality('playful');
const counters = createDefaultCounters();

// Тест: Playful получает ×1.6 XP за игру
const result = applyActionModifiers(
  { statDeltas: { happiness: 10 }, xp: 10, coins: 5 },
  'play', personality, [], null, counters, { foodId: undefined, clientLocalHour: 12, coinBalance: 200 }
);
expect(result.xp).toBe(16); // 10 × 1.6
```

---

## Переключение Mock → Real Backend

При переходе на реальный бэкенд меняется только `RealApiService` в `src/api/realApi.ts`.

- `PersonalityEngine.ts` — **не трогать**, используется и на клиенте и на сервере
- `PERSONALITIES` / `PATTERN_RULES` / `EMERGENT_STATES` — **не трогать**
- `BehavioralCounters` → переезжают в колонку `behavioral_counters JSONB` в таблице `pets`
- `moodHistory` → отдельная таблица `mood_history` (rolling window 168 записей)
- `clientLocalHour` → сервер сам вычисляет из `user.timezone` (IANA), не доверять клиенту

Подробнее: `PERSONALITY_SYSTEM.md` §9.
