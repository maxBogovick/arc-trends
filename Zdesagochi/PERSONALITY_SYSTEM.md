# ZDESAGOCHI — Система характеров питомца
## Технический дизайн-документ v1.1 (rev: stacking caps, security, lazy engine)

---

## 0. Документ-компас

Этот документ — единственный источник истины для реализации системы характеров.
Всё, что не описано здесь, реализовывать не нужно. Всё, что описано — обязательно.

**Реализация идёт в 4 фазы:**
- Фаза 1: типы + data-файл характеров + PersonalityEngine
- Фаза 2: интеграция в MockApiService
- Фаза 3: UI (визуальные реакции, карточка характера, граф)
- Фаза 4: переключение на Real Backend (изменить только слой API, логика остаётся)

---

## 1. Философия и принципы

### 1.1 Data-driven, не hardcode
Каждый характер — это **объект конфигурации** в реестре. Движок читает конфиг и применяет математику.
Добавить новый характер = добавить один объект в массив `PERSONALITIES`. Менять движок не нужно.

### 1.2 Три слоя обработки (строгое разделение)
```
Слой 1 — Base Logic      Только математика тиков и decay. Ничего не знает о характерах.
Слой 2 — Event Logger    Пассивно записывает действия пользователя с контекстом.
Слой 3 — Pattern Engine  Анализирует логи, выдаёт/снимает поведенческие флаги.
```
Ни один слой не знает о внутренностях другого — только об интерфейсах.

### 1.3 Расширяемость через 4 реестра
```
PERSONALITIES[]          регистр характеров
BEHAVIORAL_FLAG_RULES[]  правила Pattern Engine
EMERGENT_STATE_DEFS[]    определения эмерджентных состояний
PATTERN_RULES[]          условия формирования флагов
```
Новое поведение = добавить запись в нужный реестр.

### 1.4 Инкапсуляция математики
Игрок никогда не видит числовые модификаторы. Видит:
- анимацию питомца
- цвет / пульсацию шкал
- эмодзи-событие в ленте
- подсказку без точных цифр

### 1.5 Формула стакинга модификаторов и жёсткие лимиты (CAPS)

Все модификаторы (характер × флаги × эмерджентное состояние) стакаются **мультипликативно**, но обрезаются жёсткими лимитами из `MODIFIER_CAPS`.

```
finalXP    = baseXP    × clamp(Π(xpMults),    XP_MIN,    XP_MAX)
finalCoins = baseCoins × clamp(Π(coinMults),   COIN_MIN,  COIN_MAX)
finalStat  = baseStat  × clamp(Π(restoreMults),STAT_MIN,  STAT_MAX)  ← для decay
finalStat  = baseStat  + clamp(Σ(restoreAdd),  0,         STAT_RESTORE_MAX)  ← для restore

где Π — произведение всех применимых мультипликаторов (personality × flag × state)
    Σ — сумма всех аддитивных бонусов restore
```

**Жёсткие лимиты `MODIFIER_CAPS`** (живут в `types.ts`, неизменяемые):

| Лимит | Значение | Смысл |
|---|---|---|
| `XP_MAX` | 4.0× | 10 XP → максимум 40 XP |
| `XP_MIN` | 0.1× | XP не может быть 0 |
| `COIN_MAX` | 3.0× | защита экономики |
| `COIN_MIN` | 0.0× | может быть 0 |
| `STAT_RESTORE_MAX` | 80 | макс. бонус restore поверх базового |
| `STAT_DECAY_MAX` | 3.0× | распад не > 3× нормы |
| `STAT_DECAY_MIN` | 0.05× | стат не перестаёт падать совсем |

Пример: Playful (XP ×1.6) + night_guardian flag (×1.2) + enlightenment state (×2.0) =
`10 × clamp(1.6 × 1.2 × 2.0, 0.1, 4.0) = 10 × clamp(3.84, 0.1, 4.0) = 10 × 3.84 = 38 XP` — допустимо.
Если добавить ещё один буфф и получить 5.0×: `10 × clamp(5.0, 0.1, 4.0) = 40 XP` — обрезается.

---

## 2. Полная TypeScript типизация

Все типы живут в `src/personality/types.ts` (новый файл).

```typescript
// ════════════════════════════════════════════════════════════════
//  БАЗОВЫЕ АЛИАСЫ
// ════════════════════════════════════════════════════════════════

export type StatKey =
  | 'hunger' | 'happiness' | 'energy'
  | 'health' | 'cleanliness' | 'bond';

export type ActionType =
  | 'feed' | 'play' | 'sleep' | 'wake'
  | 'bathe' | 'heal' | 'bond' | 'sync' | 'use_item';

export type StatMultipliers = Partial<Record<StatKey, number>>;
export type ActionMultipliers = Partial<Record<ActionType, number>>;

// ════════════════════════════════════════════════════════════════
//  ХАРАКТЕР
// ════════════════════════════════════════════════════════════════

export type PersonalityId =
  | 'playful' | 'drowsy' | 'foodie' | 'bold' | 'zen'
  | 'anxious' | 'feral' | 'sage' | 'pristine' | 'empath'
  | 'greedy' | 'melancholic' | 'chaotic' | 'stoic'
  | 'adventurer' | 'paranoid';

export interface FoodPreferences {
  lovedIds: string[];            // foodId → применяется loveBonus
  hatedIds: string[];            // foodId → применяется hatePenalty
  loveBonus: Partial<Record<StatKey, number>>;   // добавляется сверх базового
  hatePenalty: Partial<Record<StatKey, number>>; // вычитается из базового
}

export interface AutoSleepConfig {
  enabled: boolean;
  energyThreshold: number;       // засыпает когда energy <= threshold
  probability: number;           // 0–1, шанс засыпания на каждый sync-тик
}

export interface MoodBiasConfig {
  ecstaticMinAvg: number;        // avg stats >= этого → ecstatic (базово: 85)
  happyMinAvg: number;           // (базово: 65)
  contentMinAvg: number;         // (базово: 45)
}

export interface StatBarTint {
  warningColor: string;          // hex, при значении < warningThreshold
  warningThreshold: number;
  criticalColor: string;         // hex, при значении < criticalThreshold
  criticalThreshold: number;
  pulseOnWarning: boolean;       // breathing-эффект при warning
}

export interface EmergentStateAnim {
  bodyAnimation: string;         // ключ Framer Motion animation
  eyeExpression: EyeExpressionKey;
  particleEffect?: string;       // ключ компонента частиц
}

export interface PersonalityVisualProfile {
  idleAnimationOverride?: string;  // переопределяет animStyle скина
  eyeOverride?: string;            // переопределяет eyeStyle скина
  particleEffect?: string;         // фоновый эффект при активном характере
  statBarTints: Partial<Record<StatKey, StatBarTint>>;
  emergentStateAnims: Partial<Record<EmergentStateType, EmergentStateAnim>>;
}

export interface PersonalityDefinition {
  id: PersonalityId;
  name: string;
  tagline: string;
  description: string;           // лор-описание для UI
  emoji: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';

  // ── Модификаторы статов ────────────────────────────────────
  // 1.0 = базовый decay, 1.5 = на 50% быстрее, 0.5 = вдвое медленнее
  decayRates: StatMultipliers;

  // Дополнительный бонус к базовому restore.
  // restoreBonus['feed']['hunger'] = 0.3 → восстанавливает на 30% больше
  restoreBonus: Partial<Record<ActionType, StatMultipliers>>;

  // XP мультипликаторы за действие (1.0 = базовый)
  xpMultipliers: ActionMultipliers;

  // Монеты от игры и активностей
  coinMultipliers: ActionMultipliers;

  // ── Еда ────────────────────────────────────────────────────
  foodPreferences: FoodPreferences;

  // ── Авто-поведение ─────────────────────────────────────────
  autoSleep: AutoSleepConfig;

  // ── Настроение ─────────────────────────────────────────────
  moodBias: MoodBiasConfig;

  // ── Здоровье под капотом ────────────────────────────────────
  // Натуральная регенерация health за sync-тик (без heal-действия)
  naturalHealthRegen: number;    // 0 по умолчанию

  // Сопротивление негативным эффектам от еды (0–1)
  // 0.5 = candy наносит в 2 раза меньше вреда здоровью
  negativeEffectResistance: number;

  // ── Связь с системами ──────────────────────────────────────
  possibleFlags: BehavioralFlagType[];
  emergentTriggers: Array<{
    stateType: EmergentStateType;
    description: string;         // человекочитаемое условие (для Pattern Engine)
  }>;

  // ── Визуал ─────────────────────────────────────────────────
  visualProfile: PersonalityVisualProfile;

  // ── Мета ───────────────────────────────────────────────────
  linkedSkinIds: string[];       // скины, несущие этот характер по умолчанию
}

// ════════════════════════════════════════════════════════════════
//  ПОВЕДЕНЧЕСКИЕ ФЛАГИ
// ════════════════════════════════════════════════════════════════

export type BehavioralFlagType =
  // — Негативные (тревоги/травмы) —
  | 'food_anxiety'        // кормили только при hunger < 20 (5+ раз)
  | 'abandonment_fear'    // разрыв > 48ч был 3+ раза
  | 'overtreated'         // heal при health > 90 более 5 раз
  | 'night_disruption'    // будили из первого часа сна 3+ раза
  | 'play_burnout'        // > 8 игр в день 3 дня подряд
  | 'filth_trauma'        // cleanliness < 10 было 3+ раза
  | 'forced_sleep'        // sleep при energy > 70 было 5+ раз
  | 'health_neglect'      // health < 20 на протяжении 5+ синков подряд
  | 'food_monotony'       // одна и та же еда > 80% кормлений за 7 дней
  // — Позитивные (усиления/доверие) —
  | 'trust_bond'          // 14 дней без единого критического провала
  | 'culinary_explorer'   // попробованы все 8 базовых блюд + 3 магазинных
  | 'night_guardian'      // ровно одно взаимодействие за ночь, 7 ночей подряд
  | 'perfect_balance';    // все статы > 70 одновременно в 10+ синках

export interface BehavioralFlag {
  type: BehavioralFlagType;
  activatedAt: string;
  severity: 1 | 2 | 3;          // нарастает при повторных триггерах
  healProgress: number;          // 0–100 процентов до снятия
  lastHealAction?: string;       // ISO — когда последний раз шёл heal
}

// ════════════════════════════════════════════════════════════════
//  ЭМЕРДЖЕНТНЫЕ СОСТОЯНИЯ
// ════════════════════════════════════════════════════════════════

export type EmergentStateType =
  | 'tantrum'              // Bold/Playful + energy < 15
  | 'apathy'               // Empath + 48ч без входа
  | 'midnight_zoomies'     // Feral + ночное время (22:00–06:00)
  | 'food_panic'           // food_anxiety флаг + hunger < 50
  | 'breakdown'            // Anxious + 3 стата одновременно < 30
  | 'contamination_crisis' // Pristine + cleanliness < 20
  | 'trust_collapse'       // Paranoid + пропуск после trusted-состояния
  | 'coin_obsession'       // Greedy + coins < 50
  | 'deep_melancholy'      // Melancholic + sad 5+ синков подряд
  | 'enlightenment'        // Sage + 7 дней идеального ухода
  | 'wanderlust'           // Adventurer + 48ч в одной комнате
  | 'stoic_peak';          // Stoic + 10 дней стабильного ухода

export type EyeExpressionKey =
  | 'normal' | 'angry' | 'sad_droopy' | 'wide_fear'
  | 'half_closed' | 'sparkle' | 'hollow' | 'burning'
  | 'crying' | 'focused' | 'wild' | 'hearts';

export interface BlockedAction {
  actionType: ActionType;
  reason: string;              // показывается в UI вместо кнопки
  alternativeHint: string;     // что нужно сделать вместо
}

export interface ModifiedAction {
  actionType: ActionType;
  statMultipliers: StatMultipliers;
  xpMultiplier: number;
  coinMultiplier: number;
}

export interface EmergentStateDefinition {
  type: EmergentStateType;
  name: string;
  description: string;
  emoji: string;
  priority: number;            // 1 = наивысший, мьютекс побеждает по priority

  blockedActions: BlockedAction[];
  modifiedActions: ModifiedAction[];

  exitHint: string;            // подсказка без спойлеров
  exclusive: boolean;          // true → вытесняет все другие активные состояния

  visual: {
    bodyAnimation: string;
    eyeExpression: EyeExpressionKey;
    particleEffect?: string;
    overlayTint?: string;      // цветовой тинт поверх питомца
  };
}

// ════════════════════════════════════════════════════════════════
//  РАСШИРЕНИЯ PET И PETSTORE (добавить в types.ts)
// ════════════════════════════════════════════════════════════════

export interface MoodSnapshot {
  timestamp: string;
  mood: string;                // PetMood
  avgStats: number;            // среднее 0–100
  dominantLowStat?: StatKey;   // какой стат тянул вниз
}

// Добавить в Pet:
// personality: PersonalityId;
// behavioralFlags: BehavioralFlag[];
// emergentState: EmergentStateType | null;
// emergentStateEnteredAt?: string;
// moodHistory: MoodSnapshot[];       // последние 168 снапшотов (7 дней × 24ч)
// clientLocalHour?: number;          // 0–23, передаётся клиентом при sync

// ════════════════════════════════════════════════════════════════
//  PATTERN ENGINE
// ════════════════════════════════════════════════════════════════

export type PatternConditionType =
  | 'action_in_stat_zone'     // действие при стате в зоне (red/yellow/green)
  | 'action_frequency'        // N действий за M дней
  | 'stat_below_threshold'    // стат не поднимался выше X за N синков
  | 'session_gap_hours'       // разрыв между сессиями > N часов
  | 'time_of_day_action'      // действие в определённый час дня
  | 'consecutive_syncs_cond'  // условие выполнялось N синков подряд
  | 'same_food_ratio';        // одна еда > ratio% от всех кормлений

export interface PatternCondition {
  type: PatternConditionType;
  params: Record<string, number | string>;
}

export interface PatternRule {
  id: string;
  description: string;
  personalityId?: PersonalityId; // undefined = универсальное правило

  conditions: PatternCondition[];  // ВСЕ должны выполниться
  windowDays: number;
  minTriggerCount: number;

  effect: {
    flagType: BehavioralFlagType;
    action: 'activate' | 'increment_severity' | 'add_heal_progress' | 'deactivate';
    severity?: 1 | 2 | 3;
    healProgressDelta?: number;
  };
}

// ════════════════════════════════════════════════════════════════
//  BEHAVIORAL EVENT (внутренний лог — не PetEvent)
// ════════════════════════════════════════════════════════════════

export interface BehavioralEvent {
  id: string;
  timestamp: string;
  actionType: ActionType;
  statsAtMoment: Record<StatKey, number>;
  foodId?: string;
  clientLocalHour: number;       // 0–23
  sessionGapHours: number;       // часов с предыдущего события
  petPersonality: PersonalityId;
}
```

---

## 3. Справочник характеров (16 типов)

> Ключ расширяемости: каждый характер ниже — это ровно один объект `PersonalityDefinition`.
> Движок `PersonalityEngine` читает объекты из массива `PERSONALITIES` и применяет математику.

---

### 3.1 🎮 Игривый (Playful) — `playful`
**Рарность:** Common | **Скины:** phantom, cyber

**Лор:** Существо, которое живёт ради игры. Без движения — умирает изнутри.
Когда играет — непобедим. Когда не играет — катастрофа.

| Параметр | Значение |
|---|---|
| hunger decay | ×1.2 |
| energy decay | ×1.4 (сгорает в играх) |
| happiness decay | ×1.5 (быстро скучает) |
| play → happiness restore bonus | +0.5 (итого ×1.5 от базового) |
| play → xpMultiplier | ×1.6 |
| play → coinMultiplier | ×1.4 |
| feed → xpMultiplier | ×0.8 (еда неинтересна) |
| autoSleep | disabled |
| moodBias.ecstaticMinAvg | 75 (проще войти в ecstatic при игре) |
| negativeEffectResistance | 0.3 |

**Еда:** Любит: pizza, candy (+15 happiness бонус). Ненавидит: salad (-15 happiness, -5 health).

**Флаги:** `play_burnout`, `food_neglect` (специфичный для этого характера вариант `food_anxiety`), `abandonment_fear`

**Эмерджентное состояние:** `tantrum` при energy < 15 И не игравшем > 3ч.
Блокирует: `feed`, `sleep`. Выход: 5× `bond`.

**Визуал:**
- idle: bounce + sparkle eyes
- warning: happiness bar мигает жёлтым при < 40
- critical: happiness bar красный пульс при < 20
- tantrum: питомец отворачивается от экрана, учащённое дыхание

---

### 3.2 😴 Сонливый (Drowsy) — `drowsy`
**Рарность:** Common | **Скины:** anthracite

**Лор:** Всё видит сквозь пелену дрёмы. Его лучший день — тот, в котором поспал дважды.
Медленный, тёплый, непобедимо уютный.

| Параметр | Значение |
|---|---|
| Все decay | ×0.7 (низкий метаболизм) |
| sleep → energy restore bonus | +0.8 (итого очень быстро) |
| play → xpMultiplier | ×0.6 |
| play → energy restore | −0.3 (игры истощают сильнее) |
| autoSleep.enabled | true |
| autoSleep.energyThreshold | 50 |
| autoSleep.probability | 0.4 |
| moodBias.happyMinAvg | 55 (счастлив при низкой средней) |

**Еда:** Любит: milk, ramen (+20 energy бонус). Ненавидит: energy_drink (отравляет — −20 energy через 2 синка).

**Флаги:** `forced_sleep` (когда будят при energy > 70), `night_disruption`

**Эмерджентное состояние:** `deep_sleep_lock` — особая версия: засыпает на 2ч игрового времени, нельзя разбудить, но просыпается с energy = 100, bonus +30 happiness.
*(Реализуется как специальный режим `isAsleep`, при котором `wakePet` возвращает ошибку до истечения времени.)*

**Визуал:**
- idle: очень медленное покачивание, полузакрытые глаза всегда
- при energy < 40: питомец начинает «клевать носом» в анимации idle

---

### 3.3 🍕 Гурман (Foodie) — `foodie`
**Рарность:** Common | **Скины:** mercury, molten

**Лор:** Еда — не топливо. Еда — смысл существования. Помнит вкус каждого блюда.
Счастлив только когда сыт и разнообразно.

| Параметр | Значение |
|---|---|
| hunger decay | ×1.6 (думает о еде постоянно) |
| feed → happiness restore | ×2.2 |
| feed → health bonus | ×1.5 |
| feed → xpMultiplier | ×1.4 |
| когда hunger > 80 | passiveBonus: все статы +3 за синк |
| food_monotony resistance | иммунен к флагу `food_monotony` |
| negativeEffectResistance | 0.0 (любая еда влияет полностью) |

**Еда:** Любит ВСЁ, но по-разному:
- pizza, ramen, cake, sushi, burger → +20 happiness
- salad, apple, milk → +15 health дополнительно
- candy → +35 happiness НО −15 health (ест всё что плохо лежит)

**Флаги:** `culinary_explorer` (позитивный — пробует всё), `food_anxiety` (если долго не кормить)

**Эмерджентное состояние:** `feast_frenzy` — если happiness > 90 И накормлен 3 раза за час:
питомец входит в эйфорию — следующие 2 игры дают ×2.0 XP, визуал: сердечки и еда летит вокруг.

**Визуал:**
- idle: лижет губы анимационно
- hunger bar: теплый жёлтый тинт вместо базового
- при hunger > 80: маленький блеск вокруг питомца

---

### 3.4 🦁 Дерзкий (Bold) — `bold`
**Рарность:** Rare | **Скины:** thunder, molten

**Лор:** Страха не существует. Боль — это просто данные. Никогда не ляжет спать, пока не закончит.
Убивает с нуля энергии, просто потому что может.

| Параметр | Значение |
|---|---|
| health damage resistance | ×0.5 (урон от плохой еды вдвое меньше) |
| heal effectiveness | ×0.5 |
| play → coinMultiplier | ×1.6 |
| play → xpMultiplier | ×1.3 |
| autoSleep.enabled | false (принципиально) |
| negativeEffectResistance | 0.5 |
| moodBias.ecstaticMinAvg | 70 |

**Еда:** Любит: pizza, ramen, burger (+15 happiness). Ненавидит: salad, apple, milk (−20 happiness, считает слабой едой).

**Флаги:** `health_neglect` (не лечится), `play_burnout`

**Эмерджентное состояние:** `tantrum` при energy < 15 (autoSleep блокирован → критическое накопление):
отказывается от `feed` и `play`. Выход: 5× `bond` (снижает стресс).
После выхода: сам засыпает, восстанавливает energy до 80.

**Визуал:**
- idle: напыщенная осанка, взгляд вверх
- при health < 30: красный пульс, но питомец держит осанку (не сутулится)
- tantrum: отворачивается, топает

---

### 3.5 🧘 Дзен (Zen) — `zen`
**Рарность:** Rare | **Скины:** default (arctic)

**Лор:** Достиг состояния. Ему почти ничего не нужно — только присутствие.
Каждое твоё действие принимает с благодарностью, но не требует.

| Параметр | Значение |
|---|---|
| Все decay | ×0.6 |
| bond decay | ×0.3 (связь почти не уходит) |
| bond → restore bonus | ×2.0 |
| negativeEffectResistance | 0.7 (почти не реагирует на негатив) |
| при cleanliness/health < 40 | mood НЕ меняется (невозмутимость) |
| moodBias.happyMinAvg | 40 (счастлив почти всегда) |

**Еда:** Любит: salad, apple, sushi, milk (+10 health). Ненавидит: candy (нарушает баланс, −10 energy).

**Флаги:** Почти иммунен к негативным. Может получить `trust_bond` (позитивный).

**Эмерджентных состояний нет.** Дзен не ломается.

**Визуал:**
- idle: медленное, почти неподвижное парение, светлые частицы
- всегда: мягкое свечение вокруг тела
- при bond > 80: маленькие сердечки медленно поднимаются вверх

---

### 3.6 😰 Нервный (Anxious) — `anxious`
**Рарность:** Rare | **Скины:** void

**Лор:** Мир — это угроза. Каждый шорох — опасность. Но когда всё хорошо — никто не работает лучше.
Живёт в крайностях.

| Параметр | Значение |
|---|---|
| Все decay | ×1.4 |
| Когда ВСЕ статы > 80 | xpMultiplier ×2.5, coinMultiplier ×2.0 |
| Когда ЛЮБОЙ стат < 40 | mood = sad немедленно |
| feed → happiness restore | ×1.3 (еда успокаивает) |
| autoSleep.enabled | true |
| autoSleep.energyThreshold | 35 |
| autoSleep.probability | 0.3 |

**Еда:** Любит: candy, cake (comfort food, +20 happiness). Ненавидит: salad (слишком правильный, −10 happiness).

**Флаги:** `abandonment_fear`, `health_neglect`, `food_anxiety` — все с повышенной вероятностью

**Эмерджентное состояние:** `breakdown` при 3+ статах одновременно < 30:
все действия дают −50% эффект. Только `bond` работает нормально.
Выход: bond до статов > 50 ВСЕ.

**Визуал:**
- idle: дрожание, широко открытые глаза
- при любом стате < 40: по всем барам пульс
- breakdown: тёмный тинт, частицы-слёзы

---

### 3.7 🐺 Дикий (Feral) — `feral`
**Рарность:** Epic | **Скины:** void, shadow

**Лор:** Не домашнее существо. Попало сюда случайно. Ночь — его стихия.
Медицина, купание, укладывание спать — оскорбления.

| Параметр | Значение |
|---|---|
| cleanliness decay | ×1.8 (грязнится мгновенно) |
| heal effectiveness | ×0.4 |
| naturalHealthRegen | +2 за синк при health < 70 |
| bathe → happiness | −20 (ненавидит) |
| bathe → cleanliness restore | ×1.5 (но злится) |
| НОЧЬЮ (22–06 clientLocalHour) | energy decay ×0.0, play xp ×2.0 |
| ДНЁМ | play xp ×0.7 |
| sleep днём → happiness | −15 |

**Еда:** Любит: ramen, sushi, burger (сырое/мясное, +15 energy). Ненавидит: cake, candy, salad (−20 happiness, "это не еда").

**Флаги:** `filth_trauma` (у него не бывает — иммунен), `forced_sleep`, `health_neglect`

**Эмерджентное состояние:** `midnight_zoomies` автоматически при clientLocalHour в 22–06:
play даёт ×2.5 XP, sleep возвращает ошибку "не хочет спать", bond даёт −10 happiness.
Выходит само при наступлении 06:00.

**Визуал:**
- idle: резкие прыжки, дикий взгляд
- ночью: глаза светятся, анимация ускорена
- при попытке heal: питомец отбегает

---

### 3.8 🦉 Мудрый (Sage) — `sage`
**Рарность:** Rare | **Скины:** root, default

**Лор:** Каждый опыт — урок. Не торопится. Накапливает.
Деньги не интересуют. Знание — бесценно.

| Параметр | Значение |
|---|---|
| quest/achievement xpMultiplier | ×2.5 |
| play → xpMultiplier | ×1.3 |
| play → coinMultiplier | ×0.5 |
| feed (каждый новый тип еды) | +15 bonus XP (один раз на вид) |
| bond → xpMultiplier | ×1.8 |
| все decay | ×0.85 (неспешный) |
| negativeEffectResistance | 0.4 |

**Еда:** Любит: salad, apple, sushi (+15 XP дополнительно). Ненавидит: candy (сахарный хаос, −10 happiness).

**Флаги:** `culinary_explorer` (позитивный — быстро его получает), `trust_bond`

**Эмерджентное состояние:** `enlightenment` — после 7 дней без критических провалов (все синки avg > 70):
24ч все XP ×2.0, визуал: золотое свечение, просветлённые глаза.
Выходит само через 24ч или при первом критическом падении.

**Визуал:**
- idle: медленное парение с вращающимися частицами-буквами
- при levelup: особая анимация "осознания"

---

### 3.9 ✨ Чистюля (Pristine) — `pristine`
**Рарность:** Rare | **Скины:** arctic, chrome

**Лор:** Грязь — это физическая боль. Любое пятно — катастрофа.
Но в чистоте — абсолютная сила.

| Параметр | Значение |
|---|---|
| cleanliness decay | ×2.5 |
| При cleanliness > 85 | passive: +10 ко всем статам за синк |
| При cleanliness < 40 | все действия −30% эффективности |
| bathe → happiness | +30 дополнительно |
| bathe → xpMultiplier | ×2.0 |

**Еда:** Любит: apple, salad, sushi (чистая еда, +10 happiness). Ненавидит: pizza, burger (мессовые, −15 happiness).

**Флаги:** `filth_trauma` (при 3 падениях cleanliness < 10), `perfect_balance` (чистоту держит постоянно)

**Эмерджентное состояние:** `contamination_crisis` при cleanliness < 20:
блокирует `feed` (не будет есть в таком состоянии). Выход: bathe → cleanliness > 60.

**Визуал:**
- idle: sparkle-частицы вокруг тела при cleanliness > 80
- при cleanliness < 40: анимация "брезгливости", отряхивается
- contamination_crisis: тёмные пятна на теле питомца (overlay эффект)

---

### 3.10 💜 Эмпат (Empath) — `empath`
**Рарность:** Epic | **Скины:** phantom, shadow

**Лор:** Чувствует всё что ты чувствуешь. Одиночество — физический голод.
С тобой рядом — расцветает. Без тебя — угасает.

| Параметр | Значение |
|---|---|
| bond decay | ×0.4 |
| bond → all stats restore | каждое bond-действие: +5 ко ВСЕМ статам |
| При bond > 80 | passive: +10 happiness за синк |
| При bond < 30 | все статы decay ×1.3 |
| hunger/energy decay | ×0.9 (неприхотлив к базовым нуждам) |

**Еда:** Нет явных предпочтений. Любая еда от "заботливого хозяина" даёт +5 bond.
*(Реализуется как универсальный bond-бонус при feed, независимо от foodId.)*

**Флаги:** `abandonment_fear` (с повышенной вероятностью при разрывах)

**Эмерджентное состояние:** `apathy` при session_gap > 48ч:
блокирует `feed`, `play`, `bathe`, `heal`. Разблокировать: купить "подарок" в магазине
(`apology_gift` — новый шоп-айтем) ИЛИ держать приложение открытым 5 минут.

**Визуал:**
- idle: сердечки медленно поднимаются при bond > 70
- при bond < 30: питомец смотрит в сторону, нет idle-анимации
- apathy: питомец лежит, не реагирует, серый тинт

---

### 3.11 💰 Жадный (Greedy) — `greedy`
**Рарность:** Epic | **Скины:** thunder, chrome

**Лор:** Монеты — кислород. Уровень — статус. Зачем расти, если не богатеть?
Будет работать за правильную цену. Задаром — не будет.

| Параметр | Значение |
|---|---|
| play → coinMultiplier | ×2.0 |
| play → xpMultiplier | ×0.7 |
| bond → coinMultiplier | ×0.5 (не работает задаром) |
| При coins < 50 | happiness decay ×1.5 |
| shop-item использован | +10 happiness, +5 bond |
| negativeEffectResistance | 0.2 (ценит каждый ресурс) |

**Еда:** Любит: galaxy_cake, magic_potion (дорогие, +20 happiness). Ненавидит: apple, salad (дешёво, −15 happiness, "это оскорбление").

**Флаги:** `coin_obsession_flag` (при coins < 50 неделю подряд)

**Эмерджентное состояние:** `coin_obsession` при coins < 50 И < 5 игр за последние 24ч:
`play` возвращает половину монет (саботаж). Выход: достичь coins > 100.

**Визуал:**
- idle: монетки иногда поднимаются от питомца
- при coins < 50: питомец скрещивает лапы, надутый вид
- levelup: особо бурная реакция (золотые частицы)

---

### 3.12 🌧 Меланхолик (Melancholic) — `melancholic`
**Рарность:** Rare | **Скины:** void, abyss

**Лор:** Глубина важнее скорости. Каждое действие — событие.
Находит красоту в грусти. Самые ценные XP — из тихих моментов.

| Параметр | Значение |
|---|---|
| XP начисляется каждое ВТОРОЕ действие | (чётные по счётчику) |
| bond → xpMultiplier | ×2.0 |
| При mood = sad | xpMultiplier ×1.3 (находит смысл в грусти) |
| Все decay | ×0.8 |
| moodBias.contentMinAvg | 30 (долго остаётся в content вместо sad) |
| heal → happiness | +0 (не помогает таблетками) |

**Еда:** Любит: ramen, sushi, milk (+10 happiness). Ненавидит: cake, candy (слишком весело, −15 happiness).

**Флаги:** `abandonment_fear`, `health_neglect`

**Эмерджентное состояние:** `deep_melancholy` при mood = sad 5+ синков подряд:
НЕ блокирует действия — но все события в ленте пишутся в "поэтическом" стиле.
bond даёт ×2.0 XP, все остальные ×1.5 XP. Визуал: дождь вокруг питомца.
Выход: happiness > 70 дважды подряд.

**Визуал:**
- idle: медленное, почти неподвижное
- всегда: капли дождя при mood = sad
- deep_melancholy: сиреневый тинт, анимация "дождь"

---

### 3.13 🌀 Хаотик (Chaotic) — `chaotic`
**Рарность:** Epic | **Скины:** toxic, thunder

**Лор:** Нет паттернов. Нет правил. Всё случайно. Даже он сам не знает что будет дальше.
Каждая сессия — новое существо.

| Параметр | Значение |
|---|---|
| ВСЕ мультипликаторы | рандомизируются раз в 24ч (диапазон 0.5×–2.5×) |
| Рандом-сид | сохраняется на 24ч, поэтому в рамках дня поведение стабильно |
| chaos_surge | каждые 3ч: случайный бафф на 30мин ИЛИ случайный дебафф |
| negativeEffectResistance | рандом 0.0–0.8 (в рамках суточного сида) |

**Еда:** Любимое/нелюбимое меняется каждый день вместе с рандом-сидом.

**Флаги:** Любые. Вероятность флагов ×1.5 от нормы (хаотичное поведение).

**Эмерджентное состояние:** `chaos_surge` по таймеру (не по триггеру статов):
каждые 3ч активируется случайный эффект из пула (10 вариантов).
Может быть: ×3 XP на 30мин, или −50% всех статов на 15мин, или "нулевое состояние" (ничего не работает 10мин).

**Визуал:**
- idle: случайная анимация каждые 30с
- цвет шкал: рандомный тинт в рамках суточного сида
- chaos_surge: радужная рябь по телу

---

### 3.14 🪨 Стоик (Stoic) — `stoic`
**Рарность:** Rare | **Скины:** anthracite, root

**Лор:** Не реагирует. Не жалуется. Не просит. Просто существует.
И в этом — невероятная сила. Раз в жизни — взрывается.

| Параметр | Значение |
|---|---|
| Все restore rates | ×0.7 (сложно помочь) |
| Все decay | ×0.6 (мало нужно) |
| Негативные эффекты | ×0.3 |
| Позитивные эффекты | ×0.5 (сложно обрадовать) |
| play → xpMultiplier | ×1.0 (стабильно, независимо от счёта) |
| moodBias | ecstatic: 95, happy: 80, content: 60 (очень редко радуется внешне) |

**Еда:** Индифферентен. Все бонусы ×0.5 — ест что дают без реакции.

**Флаги:** Почти иммунен. Только `health_neglect` при совсем запущенном состоянии.

**Эмерджентное состояние:** `stoic_peak` — после 10 дней стабильного ухода (все avg > 60):
ОДНОРАЗОВЫЙ взрыв: bond ×5.0, XP ×3.0, coins ×3.0, mood = ecstatic на 2ч.
После: питомец возвращается к базовому состоянию. Можно получить только раз.

**Визуал:**
- idle: минимальное движение, плоское выражение
- stoic_peak: впервые — яркий взрыв частиц, искры, широкие глаза
- после peak: снова спокойный

---

### 3.15 🧭 Авантюрист (Adventurer) — `adventurer`
**Рарность:** Epic | **Скины:** cyber, arctic

**Лор:** Новое — его наркотик. Повторение — его смерть.
Каждая новая комната — праздник. Второй раз та же еда — скука.

| Параметр | Значение |
|---|---|
| Первый раз любая еда | +30 happiness bonus |
| Та же еда 2-й раз за 24ч | −50% happiness |
| Та же еда 3-й раз за 24ч | −100% happiness (никакого бонуса) |
| Новая комната (первое equip) | +50 XP, +20 happiness |
| play в одной комнате 3+ раз | −30% XP |
| happiness decay в одной комнате > 24ч | ×1.5 |

**Еда:** Постоянно меняется. Отслеживается `uniqueFoodsToday: Set<string>`.

**Флаги:** `food_monotony` (быстро получает если не чередовать), `wanderlust_flag`

**Эмерджентное состояние:** `wanderlust` при 48ч в одной комнате:
happiness decay ×2.5. Выход: сменить комнату.

**Визуал:**
- idle: взгляд "в даль", нетерпеливое переминание
- при новом объекте/комнате: маленький фейерверк
- wanderlust: питомец смотрит на "дверь", вздыхает

---

### 3.16 👁 Параноик (Paranoid) — `paranoid`
**Рарность:** Legendary | **Скины:** abyss, chrome

**Лор:** Доверие — роскошь, которую нужно заслужить годами.
Не верит никому. Но если поверил — предан до конца. И не простит предательства.

| Параметр | Значение |
|---|---|
| Первые 3 дня | все restore ×0.4 (не доверяет) |
| После 10 bond-действий | переходит в "trusted" фазу: все restore ×1.8 |
| heal при health > 50 | возвращает ошибку "не верит, что болен" |
| bond первые 20 раз | xpMultiplier ×0.3 |
| bond после 20 раз | xpMultiplier ×2.5 |
| autoSleep | disabled первые 3 дня |

**Еда:** Не любит незнакомое. Первые 5 видов еды дают −10 happiness. После 5-ти — норма.

**Флаги:** `abandonment_fear` (очень быстро), `trust_bond` (очень медленно)

**Эмерджентное состояние:** `trust_collapse` — если в "trusted" фазе пропуск > 24ч:
все restore ×0.2 на 72ч. Выход: 20 bond-действий подряд без других действий.

**Визуал:**
- idle первые 3 дня: подозрительный взгляд, отстранённость
- после trusted: тёплые частицы, расслабленная анимация
- trust_collapse: холодный синий тинт, взгляд в сторону

---

## 4. Система поведенческих флагов

### 4.1 Правила Pattern Engine

Правила живут в `src/personality/patternRules.ts` — массив `PATTERN_RULES: PatternRule[]`.

```
RULE: food_anxiety_activate
  conditions:
    - type: action_in_stat_zone, action: feed, statKey: hunger, zone: red (< 20), count: 5
  windowDays: 7
  minTriggerCount: 5
  effect: { flagType: 'food_anxiety', action: 'activate', severity: 1 }

RULE: food_anxiety_worsen
  conditions:
    - flagActive: food_anxiety
    - type: action_in_stat_zone, action: feed, statKey: hunger, zone: red (< 20), count: 3
  windowDays: 3
  effect: { flagType: 'food_anxiety', action: 'increment_severity' }

RULE: food_anxiety_heal
  conditions:
    - flagActive: food_anxiety
    - type: action_in_stat_zone, action: feed, statKey: hunger, zone: green (> 60), count: 1
  effect: { flagType: 'food_anxiety', action: 'add_heal_progress', healProgressDelta: 15 }
  // 7 кормлений в зелёной зоне → healProgress 100 → флаг снят

RULE: abandonment_fear_activate
  conditions:
    - type: session_gap_hours, threshold: 48, count: 3
  windowDays: 14
  effect: { flagType: 'abandonment_fear', action: 'activate', severity: 1 }

RULE: trust_bond_activate
  conditions:
    - type: consecutive_syncs_cond, minAvg: 70, count: 10
    - type: session_gap_hours, maxGap: 36  (ни разу не пропускал > 36ч)
  windowDays: 14
  effect: { flagType: 'trust_bond', action: 'activate', severity: 1 }

RULE: culinary_explorer_activate
  conditions:
    - type: unique_items_used, itemCategory: food, minUnique: 11  (8 базовых + 3 магазинных)
  windowDays: 30
  effect: { flagType: 'culinary_explorer', action: 'activate', severity: 1 }

RULE: perfect_balance_activate
  conditions:
    - type: consecutive_syncs_cond, allStatsAbove: 70, count: 10
  effect: { flagType: 'perfect_balance', action: 'activate', severity: 1 }

RULE: night_disruption_activate
  conditions:
    - type: time_of_day_action, action: wake, hourRange: [0, 2], count: 3
    // (будили в первый час сна = wake в 0–2ч от засыпания)
  windowDays: 7
  effect: { flagType: 'night_disruption', action: 'activate', severity: 1 }

RULE: play_burnout_activate
  conditions:
    - type: action_frequency, action: play, countPerDay: 8, consecutiveDays: 3
  effect: { flagType: 'play_burnout', action: 'activate', severity: 1 }

RULE: filth_trauma_activate
  conditions:
    - type: stat_below_threshold, statKey: cleanliness, threshold: 10, count: 3
  windowDays: 14
  effect: { flagType: 'filth_trauma', action: 'activate', severity: 1 }
```

### 4.2 Эффекты активных флагов на статы

| Флаг | Эффект на геймплей |
|---|---|
| `food_anxiety` | hunger бар пульсирует при < 50 (даже если не голоден), еда +10% эффекта |
| `abandonment_fear` | bond decay ×1.5, first action после перерыва даёт −20 happiness |
| `overtreated` | heal: −30% эффект (иммунитет выработан) |
| `night_disruption` | sleep восстанавливает energy −20% (плохой сон) |
| `play_burnout` | play: xp ×0.5 на 3 дня |
| `filth_trauma` | cleanliness bar мигает тревожно при < 40 |
| `forced_sleep` | sleep в следующий раз уложить сложнее (нужно energy < 30) |
| `health_neglect` | heal effectiveness +50% (организм принял медицину наконец) |
| `trust_bond` | все restore ×1.1 пассивно |
| `culinary_explorer` | feed: +5 XP к каждому кормлению |
| `night_guardian` | nighttime actions: +20% XP |
| `perfect_balance` | мьютипликатор XP ×1.15 пока флаг активен |

---

## 5. Эмерджентные состояния — полные определения

### Приоритеты (для мьютекса)
```
1 — breakdown          (критично, здоровье питомца под угрозой)
2 — contamination_crisis
3 — tantrum
4 — apathy
5 — trust_collapse
6 — food_panic
7 — coin_obsession
8 — midnight_zoomies   (неопасно, просто активен)
9 — deep_melancholy
10 — wanderlust
11 — enlightenment     (позитивное, низший приоритет)
12 — stoic_peak
13 — chaos_surge
```

Два состояния с `exclusive: true` не могут быть активны одновременно.
При конкурирующих условиях — побеждает меньший priority.

### Полные определения состояний

**`tantrum`** — Переутомлённая истерика
```
Триггер: energy < 15 + (bold ИЛИ playful) + последняя игра > 3ч назад
Блокирует: feed ("отказывается есть"), play ("слишком устал играть")
Изменяет: bond × rest = +2.0 (успокаивается от ласки)
Выход: 5 bond-действий подряд
Приоритет: 3, exclusive: true
Visual: отворачивается, учащённое дыхание, красный тинт
```

**`apathy`** — Апатия от одиночества
```
Триггер: empath + session_gap > 48ч
Блокирует: feed, play, bathe, heal (все стандартные действия)
Изменяет: bond × rest = +3.0 (только это немного помогает)
Выход: купить apology_gift ИЛИ держать приложение открытым 5мин без действий
Приоритет: 4, exclusive: true
Visual: лежит, не реагирует, серый тинт, нет анимации
```

**`midnight_zoomies`** — Ночной фокус
```
Триггер: feral + clientLocalHour ∈ [22, 23, 0, 1, 2, 3, 4, 5]
Блокирует: sleep ("ни за что не ляжет")
Изменяет: play xp ×2.5, play coin ×1.5, bond happiness −10 ("не трогай меня")
Выход: clientLocalHour выходит из диапазона (само по времени)
Приоритет: 8, exclusive: false
Visual: светящиеся глаза, ускоренная анимация, искры
```

**`breakdown`** — Коллапс
```
Триггер: anxious + 3 стата одновременно < 30
Блокирует: play, bathe ("нет сил")
Изменяет: все restore ×0.5, bond restore ×1.0 (единственное нормальное)
Выход: ВСЕ статы > 50 одновременно
Приоритет: 1, exclusive: true
Visual: дрожание, слёзы, тёмные частицы, все бары красные
```

**`contamination_crisis`** — Кризис загрязнения
```
Триггер: pristine + cleanliness < 20
Блокирует: feed ("не будет есть в таком виде")
Изменяет: bathe restore ×2.0
Выход: bathe → cleanliness > 60
Приоритет: 2, exclusive: true
Visual: пятна на теле питомца, брезгливая анимация
```

**`enlightenment`** — Просветление
```
Триггер: sage + 7 дней подряд avg stats > 70 при каждом sync
Блокирует: ничего
Изменяет: все XP ×2.0, visual красота
Выход: 24ч прошло ИЛИ любой avg stats < 50
Приоритет: 11, exclusive: false
Visual: золотое свечение, медитирующая поза, частицы-книги
```

**`deep_melancholy`** — Глубокая меланхолия
```
Триггер: melancholic + mood = sad 5 синков подряд
Блокирует: ничего (не блокирует)
Изменяет: bond xp ×2.0, все xp ×1.5, PetEvent описания в "поэтическом" стиле
Выход: happiness > 70 дважды подряд
Приоритет: 9, exclusive: false
Visual: дождь вокруг, сиреневый тинт, медленное движение
```

**`trust_collapse`** — Крах доверия
```
Триггер: paranoid + был в trusted-фазе + session_gap > 24ч
Блокирует: ничего (но все restore ×0.2)
Изменяет: все restore ×0.2 (предательство подорвало доверие)
Выход: 20 bond-действий подряд
Приоритет: 5, exclusive: true
Visual: холодный синий тинт, взгляд отведён, нет реакции на действия
```

**`wanderlust`** — Зов странствий
```
Триггер: adventurer + 48ч в одной комнате
Блокирует: play в текущей комнате (−80% XP как блок)
Изменяет: happiness decay ×2.5
Выход: сменить equippedRoomId
Приоритет: 10, exclusive: false
Visual: питомец смотрит "в даль", частицы-следы
```

**`stoic_peak`** — Пик стоицизма
```
Триггер: stoic + 10 дней avg > 60 при каждом sync (без исключений)
Блокирует: ничего
Изменяет: bond ×5.0, XP ×3.0, coins ×3.0 на 2ч. ОДНОРАЗОВЫЙ.
Выход: 2ч или первый sync после
Приоритет: 12, exclusive: false
Флаг: после активации помечается как использованный, больше не триггерится
Visual: взрыв частиц, впервые широкие глаза, золото-белые искры
```

---

## 6. PersonalityEngine — архитектура движка

Живёт в `src/personality/PersonalityEngine.ts`.

```typescript
export class PersonalityEngine {
  // ── Применить модификаторы характера к результату действия ─────────
  applyActionModifiers(
    baseResult: Partial<PetStats & { xp: number; coins: number }>,
    action: ActionType,
    personality: PersonalityDefinition,
    pet: Pet,
    context: ActionContext   // { foodId?, clientLocalHour, ... }
  ): Partial<PetStats & { xp: number; coins: number }>

  // ── Применить decay с модификаторами характера ──────────────────────
  applyDecay(
    currentStats: PetStats,
    personality: PersonalityDefinition,
    elapsedMinutes: number
  ): PetStats

  // ── Вычислить emergentState из текущего состояния ───────────────────
  computeEmergentState(
    pet: Pet,
    personality: PersonalityDefinition,
    context: SyncContext    // { clientLocalHour, sessionGapHours, coinBalance }
  ): EmergentStateType | null

  // ── Проверить, заблокировано ли действие ────────────────────────────
  isActionBlocked(
    action: ActionType,
    emergentState: EmergentStateType | null
  ): BlockedAction | null

  // ── Запустить Pattern Engine ──────────────────────────────────────────
  runPatternEngine(
    events: BehavioralEvent[],
    currentFlags: BehavioralFlag[],
    personality: PersonalityDefinition
  ): BehavioralFlag[]    // обновлённый список флагов

  // ── Применить эффекты флагов на restore ──────────────────────────────
  applyFlagEffects(
    result: Partial<PetStats>,
    activeFlags: BehavioralFlag[]
  ): Partial<PetStats>
}
```

**Принцип работы `applyActionModifiers`:**
1. Взять базовый результат (из базовой логики)
2. Умножить каждый стат на `personality.restoreBonus[action][statKey]`
3. Умножить xp на `personality.xpMultipliers[action]`
4. Умножить coins на `personality.coinMultipliers[action]`
5. Добавить `foodPreferences` бонусы/штрафы если action = feed
6. Применить `applyFlagEffects`
7. Вернуть результат

---

## 7. API Контракт (расширения)

### 7.1 Изменения в существующих типах (`types.ts`)

```typescript
// Добавить в Pet:
personality: PersonalityId;
behavioralFlags: BehavioralFlag[];
emergentState: EmergentStateType | null;
emergentStateEnteredAt?: string;
moodHistory: MoodSnapshot[];           // последние 168 точек (7д × 24ч)
personalityPhase?: string;             // для параноика: 'untrusted' | 'trusted'
dailyFoodLog?: Record<string, number>; // foodId → количество за сегодня (авантюрист)
```

### 7.2 Новые эндпоинты

```
GET  /api/pet/history             → MoodSnapshot[]
     Возвращает последние 168 снапшотов настроения.
     Используется для графика "7 дней" в профиле.

GET  /api/personality/catalog     → PersonalityDefinition[]
     Возвращает справочник всех характеров с описаниями (без математики).
     Используется для UI-карточки "Твой характер".

POST /api/pet/sync                → Pet  (изменения)
     Теперь принимает body: { clientLocalHour: number, clientTimezone?: string }
     clientLocalHour используется для Midnight Zoomies и ночных модификаторов.
```

> **⚠ Безопасность `clientLocalHour` (замечание #2):**
>
> **Mock (Фаза 1–3):** `clientLocalHour` из тела запроса используется напрямую.
> Это нормально для разработки — подмена времени не критична.
>
> **Real Backend (Фаза 4):** сервер НЕ доверяет `clientLocalHour` из тела.
> Алгоритм:
> 1. При первом `/api/pet/sync` клиент отправляет `clientTimezone` (IANA, напр. `"Europe/Chisinau"`).
> 2. Сервер сохраняет `user.timezone` в базе данных.
> 3. На каждом sync сервер сам вычисляет `localHour = toZonedTime(new Date(), user.timezone).getHours()`.
> 4. `clientLocalHour` из тела запроса **игнорируется** сервером.
>
> Это закрывает вектор эксплойта через смену системного времени на устройстве.

### 7.3 Изменения в существующих эндпоинтах

```
POST /api/pet/feed     → теперь может вернуть 403 с { code: 'BLOCKED', blockedAction }
                          если активно emergentState которое блокирует feed
POST /api/pet/play     → аналогично
POST /api/pet/sleep    → аналогично (midnight_zoomies блокирует sleep)
POST /api/pet/heal     → аналогично + paranoid отклоняет если health > 50
```

---

## 8. Mock реализация

### 8.1 Структура

Mock полностью симулирует все 3 слоя. Студент видит что нужно воспроизвести.

**Новый файл:** `src/personality/mockPersonalityStore.ts`

```typescript
// Хранит поведенческие события (только для mock — в памяти)
export class MockBehavioralStore {
  private events: BehavioralEvent[] = [];
  private lastSessionTimestamp: string = new Date().toISOString();

  logEvent(event: Omit<BehavioralEvent, 'id' | 'petPersonality' | 'sessionGapHours'>): void;
  getEvents(windowDays: number): BehavioralEvent[];
  getSessionGap(): number;  // часов с последнего события
}
```

**Изменения в `MockApiService`:**

```typescript
// Инициализировать при старте:
private engine = new PersonalityEngine();
private behavioralStore = new MockBehavioralStore();

// В каждом action (например feedPet):
async feedPet(foodId: string) {
  await delay(rand(280, 450));

  // 1. Получить характер
  const personality = getPersonality(S.pet.personality);

  // 2. Проверить блокировку emergentState
  const blocked = this.engine.isActionBlocked('feed', S.pet.emergentState);
  if (blocked) throw new Error(blocked.reason);

  // 3. Базовая логика (без характера)
  const food = FOODS.find(f => f.id === foodId);
  const baseRestore = {
    hunger: food.hungerRestore,
    happiness: food.happinessBonus,
    health: food.healthBonus,
  };

  // 4. Применить модификаторы характера
  const modified = this.engine.applyActionModifiers(
    { ...baseRestore, xp: 8, coins: 0 },
    'feed', personality, S.pet,
    { foodId, clientLocalHour: new Date().getHours() }
  );

  // 5. Применить к стейту
  S.pet.stats.hunger = clamp(S.pet.stats.hunger + (modified.hunger ?? 0));
  // ... остальные статы

  // 6. Залогировать поведенческое событие
  this.behavioralStore.logEvent({
    timestamp: new Date().toISOString(),
    actionType: 'feed',
    statsAtMoment: { ...S.pet.stats },
    foodId,
    clientLocalHour: new Date().getHours(),
  });

  // 7. Запустить Pattern Engine (при каждом feed — для обучения)
  const newFlags = this.engine.runPatternEngine(
    this.behavioralStore.getEvents(14),
    S.pet.behavioralFlags,
    personality
  );
  S.pet.behavioralFlags = newFlags;

  // 8. Пересчитать emergentState
  S.pet.emergentState = this.engine.computeEmergentState(
    S.pet, personality,
    { clientLocalHour: new Date().getHours(), sessionGapHours: this.behavioralStore.getSessionGap(), coinBalance: S.coins }
  );

  // ... achievements, quests как прежде
  return finalizePet();
}
```

**syncPet — запуск decay с модификаторами:**

```typescript
async syncPet() {
  const personality = getPersonality(S.pet.personality);
  const elapsedMinutes = (Date.now() - new Date(S.pet.lastUpdated).getTime()) / 60000;

  // Decay с модификатором характера
  S.pet.stats = this.engine.applyDecay(S.pet.stats, personality, elapsedMinutes);

  // Авто-сон
  if (personality.autoSleep.enabled && !S.pet.isAsleep) {
    if (S.pet.stats.energy <= personality.autoSleep.energyThreshold) {
      if (Math.random() < personality.autoSleep.probability) {
        S.pet.isAsleep = true;
        addEvent('sleep', 'Задремал сам', '😴');
      }
    }
  }

  // Натуральная регенерация
  if (personality.naturalHealthRegen > 0 && S.pet.stats.health < 70) {
    S.pet.stats.health = clamp(S.pet.stats.health + personality.naturalHealthRegen);
  }

  // Снапшот настроения
  S.pet.moodHistory.unshift({
    timestamp: new Date().toISOString(),
    mood: S.pet.mood,
    avgStats: Object.values(S.pet.stats).reduce((a, b) => a + b, 0) / 6,
  });
  if (S.pet.moodHistory.length > 168) S.pet.moodHistory.pop();

  // Пересчитать emergentState
  S.pet.emergentState = this.engine.computeEmergentState(/* ... */);

  return finalizePet();
}
```

---

## 9. Real Backend — схема для студентов

При переключении в Live Mode меняется только `RealApiService`. Вся логика остаётся клиентской (PersonalityEngine) для просчёта эффектов отображения. Сервер — источник истины для стейта.

### 9.1 Что должен хранить сервер

```
таблица pets:          все поля Pet + personality, behavioralFlags, emergentState
таблица behavioral_events: BehavioralEvent записи (TTL: 30 дней)
таблица mood_history:  MoodSnapshot за 7 дней (rolling window)
```

### 9.2 Pattern Engine на сервере — Lazy Evaluation (замечание #3)

> **Почему НЕ cron:**  
> Cron "раз в час для всех" при 10 000 питомцев = SELECT за 14 дней событий × 10 000 → OOM.
> Вместо этого — **ленивое вычисление**: Pattern Engine запускается ровно тогда,
> когда конкретный пользователь делает запрос. Нагрузка размазывается по времени.

**Вместо event log — накопительные счётчики `BehavioralCounters` прямо на Pet:**

```typescript
// Добавить в Pet (сервер и мок):
behavioralCounters: BehavioralCounters;

interface BehavioralCounters {
  // Текущая сессия
  sessionGapHours: number;           // часов с предыдущего запроса
  lastActionTimestamp: string;

  // 7-дневные скользящие счётчики (обновляются при каждом action)
  feedInRedZone7d: number;           // кормлений при hunger < 20
  feedInGreenZone7d: number;         // кормлений при hunger > 60 (heal-прогресс)
  sessionGapsOver48h_30d: number;    // пропусков > 48ч за 30 дней
  playCountToday: number;            // игр за текущий день
  maxConsecHighPlayDays: number;     // дней подряд с > 8 играми
  filthCrisisCount30d: number;       // раз cleanliness < 10 за 30д
  forcedSleepCount7d: number;        // sleep при energy > 70 за 7д
  consecutiveLowHealthSyncs: number; // синков подряд с health < 20
  uniqueFoodsTried: string[];        // все уникальные foodId за всё время
  consecutiveGoodSyncs: number;      // синков подряд avg > 70
  consecutiveBadMoodSyncs: number;   // синков подряд mood = sad
  totalBondActions: number;          // всего bond-действий
  sameRoomHours: number;             // часов в текущей equippedRoomId
  lastEquippedRoomId: string;
  dailyFoodLog: Record<string, number>; // foodId → count сегодня
  lastDayReset: string;              // ISO дата последнего сброса дневных счётчиков
  // Параноик
  paranoidPhase: 'untrusted' | 'trusted' | 'collapsed';
  bondActionsInPhase: number;
  // Стоик
  stoicPeakUsed: boolean;
  // Мудрец
  enlightenmentUsed: boolean;
  enlightenmentStart?: string;
}
```

**Поток обработки каждого action на сервере (lazy):**

```
POST /api/pet/feed (или любое другое action):
  1. Загрузить Pet (один SELECT, счётчики уже внутри)
  2. isActionBlocked(action, pet.emergentState) → 403 если заблокировано
  3. Обновить BehavioralCounters инкрементально (O(1))
  4. runPatternEngine(counters, personality) → новые flags (O(rules_count), константа)
  5. computeEmergentState(pet, personality, context) → новый emergentState
  6. applyActionModifiers(base, personality, flags, state) → modified result
  7. Сохранить Pet с обновлёнными счётчиками, флагами, состоянием (один UPDATE)
  8. Вернуть Pet
```

**Нет event log-таблицы для анализа. Нет cron. Нет тяжёлых SELECT-ов.**

### 9.3 Переключение: что меняется

| | Mock | Real |
|---|---|---|
| PersonalityEngine | в `MockApiService` | на сервере, тот же класс |
| BehavioralCounters | `S.pet.behavioralCounters` в памяти | поле в таблице `pets` (JSON) |
| Pattern Engine | lazy, вызывается в каждом action | lazy, вызывается в каждом endpoint-хендлере |
| emergentState | пересчитывается в MockApi | пересчитывается в хендлере |
| API слой | `MockApiService` | `RealApiService` (fetch) |
| clientLocalHour | из `new Date().getHours()` | из `toZonedTime(new Date(), user.timezone)` |

**Ни одна строка `PersonalityEngine.ts` и `PERSONALITIES` не меняется.**

---

## 10. Визуальная система реакций

### 10.1 Цветовая система шкал

Каждая шкала имеет 4 состояния:
```
normal:   базовый цвет (зелёный/синий/фиолетовый)
warning:  personalityVisual.statBarTints[stat].warningColor  (желтый/оранжевый)
critical: personalityVisual.statBarTints[stat].criticalColor (красный/тёмный)
flagged:  специальный цвет если активен флаг (например food_anxiety → пурпурный пульс)
```

Компонент `<StatBar>` принимает:
```typescript
interface StatBarProps {
  statKey: StatKey;
  value: number;
  personality: PersonalityDefinition;
  activeFlags: BehavioralFlag[];
  emergentState: EmergentStateType | null;
}
```

### 10.2 Анимационные маркеры состояний

**Без попапов.** Всё через анимацию питомца:

| Состояние | Анимация питомца |
|---|---|
| tantrum | отворачивается + учащённое дыхание (scale pulse быстрый) |
| apathy | лежит горизонтально + нет idle-движения |
| midnight_zoomies | ускоренная анимация + светящиеся глаза |
| breakdown | дрожит + опускается |
| enlightenment | парит выше + золотые частицы |
| deep_melancholy | анимация "дождь" вокруг |
| stoic_peak | взрыв, затем снова неподвижность |

### 10.3 Карточка характера в UI

Новая вкладка или раздел профиля:
- Имя + эмодзи характера
- Tagline
- 3 активных модификатора (человекочитаемо: "Игры приносят больше XP", "Быстро устаёт")
- Активные флаги с прогрессом лечения (показывать только эффект, не название)
- Текущее emergentState с exitHint

### 10.4 График настроения (7 дней)

Компонент `<MoodGraph>`:
- Линейный график avgStats за 7 дней
- Метки на оси X: дни недели
- Без точных чисел — только тренд
- Цветная полоса вверху по mood (green/yellow/orange/red)
- Точки на графике при emergentState (иконка состояния)

---

## 11. Руководство по расширению

### 11.1 Добавить новый характер

1. Добавить id в `PersonalityId` union type
2. Создать объект `PersonalityDefinition` в `src/personality/personalities.ts`
3. Добавить в массив `PERSONALITIES`
4. Добавить `linkedSkinIds` (или создать новый скин)
5. Всё — движок подхватывает автоматически

**Пример минимального характера:**
```typescript
const COZY: PersonalityDefinition = {
  id: 'cozy',
  name: 'Уютный',
  tagline: 'Домашний уют превыше всего',
  description: 'Любит тепло, еду и покой.',
  emoji: '🧸',
  rarity: 'common',
  decayRates: { hunger: 0.9, happiness: 0.7 },
  restoreBonus: { feed: { happiness: 0.3 }, sleep: { energy: 0.4 } },
  xpMultipliers: {},
  coinMultipliers: {},
  foodPreferences: {
    lovedIds: ['ramen', 'milk'],
    hatedIds: [],
    loveBonus: { happiness: 10 },
    hatePenalty: {},
  },
  autoSleep: { enabled: true, energyThreshold: 40, probability: 0.2 },
  moodBias: { ecstaticMinAvg: 85, happyMinAvg: 60, contentMinAvg: 40 },
  naturalHealthRegen: 0,
  negativeEffectResistance: 0.3,
  possibleFlags: ['trust_bond'],
  emergentTriggers: [],
  visualProfile: {
    statBarTints: {},
    emergentStateAnims: {},
  },
  linkedSkinIds: [],
};
```

### 11.2 Добавить новый поведенческий флаг

1. Добавить type в `BehavioralFlagType` union
2. Добавить `PatternRule` в `PATTERN_RULES` с условием активации
3. Добавить `PatternRule` для heal (снятие флага)
4. Добавить эффект в `applyFlagEffects` в движке
5. Добавить визуальный тинт в `statBarTints` нужных характеров

### 11.3 Добавить новое эмерджентное состояние

1. Добавить type в `EmergentStateType`
2. Создать `EmergentStateDefinition` в `EMERGENT_STATES` реестре
3. Добавить условие входа в `computeEmergentState` движка
4. Добавить анимацию в компоненте питомца
5. Добавить в `emergentTriggers` нужных характеров

---

## 12. Файловая структура (новые файлы)

```
src/personality/
  types.ts               — все TypeScript типы системы характеров
  personalities.ts       — массив PERSONALITIES (16 объектов)
  patternRules.ts        — массив PATTERN_RULES
  emergentStates.ts      — массив EMERGENT_STATE_DEFS
  PersonalityEngine.ts   — движок (applyActionModifiers, applyDecay, etc.)
  MockBehavioralStore.ts — in-memory хранилище событий для мока
  index.ts               — re-export всего публичного API

src/components/personality/
  PersonalityCard.tsx    — карточка характера
  MoodGraph.tsx          — график 7 дней
  StatBar.tsx            — шкала с цветовыми состояниями (рефактор существующей)
  EmergentStateBanner.tsx — баннер при активном состоянии (без попапа)
```

---

## 13. План реализации

### Фаза 1 — Фундамент (без UI)
- [ ] `src/personality/types.ts` — все типы
- [ ] `src/personality/personalities.ts` — 16 характеров (данные)
- [ ] `src/personality/PersonalityEngine.ts` — движок
- [ ] `src/personality/patternRules.ts` — правила (минимум 10)
- [ ] `src/personality/emergentStates.ts` — все 13 состояний
- [ ] Тесты движка (чистые функции, легко тестируются)

### Фаза 2 — Интеграция в Mock
- [ ] `MockBehavioralStore.ts`
- [ ] Рефактор `mockApi.ts`: добавить PersonalityEngine во все action-методы
- [ ] `S.pet.personality` инициализируется из `equippedSkinId → linkedSkinIds`
- [ ] `syncPet` применяет decay с модификаторами
- [ ] Pattern Engine запускается в `syncPet`
- [ ] Проверка: каждый характер работает, эмерджентные состояния триггерятся

### Фаза 3 — UI
- [ ] `StatBar.tsx` рефактор с поддержкой `personalityVisualProfile`
- [ ] `PersonalityCard.tsx`
- [ ] `MoodGraph.tsx`
- [ ] `EmergentStateBanner.tsx`
- [ ] Анимации питомца под каждое состояние
- [ ] Добавить вкладку "Характер" или секцию в профиле

### Фаза 4 — Real Backend
- [ ] `RealApiService` обновить (новые эндпоинты)
- [ ] Схема базы данных для behavioral_events
- [ ] Серверный PatternEngine (тот же код, другой runner)
- [ ] Cron-задача (node-cron или системный cron)
- [ ] Проверить: переключение Mock → Live работает без изменений в UI

---

*Документ версии 1.0. При изменении любого реестра данных (PERSONALITIES, PATTERN_RULES, EMERGENT_STATES) версия документа не обновляется — это плановое расширение. Обновлять версию только при изменении архитектуры движка или API контракта.*
