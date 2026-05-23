// ════════════════════════════════════════════════════════════════════════════
//  PERSONALITY SYSTEM — Core Types
//  Единственный источник типов для всей системы характеров.
//  Меняй только здесь — всё остальное подхватывает автоматически.
// ════════════════════════════════════════════════════════════════════════════

import { PERSONALITY_IDS } from './personalityCatalog';

// ── Базовые алиасы ───────────────────────────────────────────────────────────

export type StatKey =
  | 'hunger' | 'happiness' | 'energy'
  | 'health' | 'cleanliness' | 'bond';

export type ActionType =
  | 'feed' | 'play' | 'sleep' | 'wake'
  | 'bathe' | 'heal' | 'bond' | 'sync' | 'use_item' | 'add_item';

export type StatMultipliers = Partial<Record<StatKey, number>>;
export type StatAdditives  = Partial<Record<StatKey, number>>;
export type ActionMultipliers = Partial<Record<ActionType, number>>;

// ── Жёсткие лимиты экономики ─────────────────────────────────────────────────
// Все модификаторы стакаются мультипликативно, затем обрезаются этими лимитами.
// finalXP    = baseXP    × clamp(Π xpMults,      XP_MIN,           XP_MAX)
// finalCoins = baseCoins × clamp(Π coinMults,     COIN_MIN,         COIN_MAX)
// finalDecay = baseDelta × clamp(Π decayMults,    DECAY_MULT_MIN,   DECAY_MULT_MAX)
// restoreAdd = clamp(Σ restoreAdditives,           0,                STAT_RESTORE_ADD_MAX)

export const MODIFIER_CAPS = {
  XP_MAX:              4.0,   // 4× base XP — потолок независимо от числа баффов
  XP_MIN:              0.1,   // XP никогда не 0
  COIN_MAX:            3.0,   // защита экономики
  COIN_MIN:            0.0,
  STAT_RESTORE_ADD_MAX: 80,   // максимальный аддитивный бонус restore поверх базового
  DECAY_MULT_MAX:      3.0,   // распад не более 3× нормы
  DECAY_MULT_MIN:      0.05,  // стат продолжает медленно падать всегда
} as const;

// ── Идентификаторы характеров ────────────────────────────────────────────────

export type PersonalityId = typeof PERSONALITY_IDS[number];

// ── Trait Evolution System — пространство черт ─────────────────────────────

export const TRAIT_KEYS = [
  'vitality',
  'sociality',
  'order',
  'appetite',
  'caution',
  'curiosity',
] as const;

export type TraitKey = typeof TRAIT_KEYS[number];

export type TraitVector = Record<TraitKey, number>;

export const BEHAVIOR_AXES = [
  'care',
  'play',
  'social',
  'order',
  'exploration',
  'disruption',
  'recovery',
] as const;

export type BehaviorAxis = typeof BEHAVIOR_AXES[number];

export type BehaviorVector = Record<BehaviorAxis, number>;

export interface BehaviorProfile {
  axes: BehaviorVector;
  sampleCount: number;
  lastUpdatedAt?: string;
}

export type InfluenceCategory =
  | 'action'
  | 'item'
  | 'training'
  | 'discipline'
  | 'cosmetic'
  | 'environment'
  | 'social'
  | 'system';

export interface TraitSnapshot {
  date: string;
  vector: TraitVector;
}

export interface CoreMemory {
  id: string;
  timestamp: string;
  tier: 'rare' | 'common';
  emoji: string;
  text: string;
  category: InfluenceCategory;
  traitKey: TraitKey;
  direction: 'up' | 'down' | 'origin';
  personalityHint?: PersonalityId;
}

export interface EvolutionProposal {
  targetPersonalityId: PersonalityId;
  readiness: number;
  depth: number;
  proposedAt: string;
  coreMemoryIds: string[];
  narrativeText?: string;
}

export interface EvolutionRecord {
  fromPersonalityId: PersonalityId;
  toPersonalityId: PersonalityId;
  evolvedAt: string;
  trigger: 'formation' | 'stability' | 'singularity' | 'manual';
  coreMemoryIds?: string[];
}

export type InfluenceConditionType =
  | 'time_of_day'
  | 'flag_active'
  | 'personality_is'
  | 'trait_above'
  | 'trait_below'
  | 'stat_below'
  | 'session_gap_hours'
  | 'same_room_hours'
  | 'streak_days'
  | 'formation_period';

export interface InfluenceCondition {
  type: InfluenceConditionType;
  params: Record<string, number | string | boolean>;
}

export interface IntensityRule {
  condition: InfluenceCondition;
  multiplier: number;
}

export interface RegisteredInfluence {
  id: string;
  category: InfluenceCategory;
  label: string;
  traitDeltas: Partial<Record<TraitKey, number>>;
  behaviorDeltas?: Partial<Record<BehaviorAxis, number>>;
  traumaDelta?: number;
  cooldownSyncs?: number;
  conditions?: InfluenceCondition[];
  intensityRules?: IntensityRule[];
  onApply?: 'sleep_start' | 'sleep_wake_natural' | 'sleep_wake_early';
}

export interface GlobalBalancePatch {
  influenceId: string;
  intensityMultiplier: number;
  reason: 'meta_balance';
  appliedAt: string;
}

export interface EvolutionBonus {
  description: string;
  xpMultiplierBonus?: number;
  coinMultiplierBonus?: number;
  uniqueTrait: string;
}

// ── Предпочтения в еде ───────────────────────────────────────────────────────

export interface FoodPreferences {
  lovedIds: string[];                       // foodId → применяется loveBonus
  hatedIds: string[];                       // foodId → применяется hatePenalty
  loveBonus:   StatAdditives;              // добавляется сверх базового restore
  hatePenalty: StatAdditives;              // вычитается из базового restore
  universalFeedBonus?: StatAdditives;      // бонус при любой еде (для empath)
}

// ── Авто-засыпание ───────────────────────────────────────────────────────────

export interface AutoSleepConfig {
  enabled: boolean;
  energyThreshold: number;    // засыпает когда energy <= этого значения
  probability: number;        // 0–1, шанс засыпания при каждом sync-тике
}

// ── Смещение настроения ──────────────────────────────────────────────────────

export interface MoodBiasConfig {
  ecstaticMinAvg: number;     // avg stats >= этого → ecstatic   (дефолт: 85)
  happyMinAvg:    number;     // avg stats >= этого → happy      (дефолт: 65)
  contentMinAvg:  number;     // avg stats >= этого → content    (дефолт: 45)
}

// ── Визуальная реакция шкалы стата ──────────────────────────────────────────

export interface StatBarTint {
  warningColor:    string;    // hex, применяется когда value < warningThreshold
  warningThreshold: number;
  criticalColor:   string;    // hex, применяется когда value < criticalThreshold
  criticalThreshold: number;
  pulseOnWarning:  boolean;   // breathing-анимация при warning
}

// ── Анимация при эмерджентном состоянии ─────────────────────────────────────

export type EyeExpressionKey =
  | 'normal' | 'angry' | 'sad_droopy' | 'wide_fear' | 'half_closed'
  | 'sparkle' | 'hollow' | 'burning' | 'crying' | 'focused'
  | 'wild' | 'hearts' | 'suspicious' | 'glowing';

export interface EmergentStateAnim {
  bodyAnimation:  string;            // ключ Framer Motion variant
  eyeExpression:  EyeExpressionKey;
  particleEffect?: string;           // ключ компонента частиц
  overlayTint?:   string;            // цветовой тинт поверх тела питомца (hex + alpha)
}

// ── Визуальный профиль характера ────────────────────────────────────────────

export interface PersonalityVisualProfile {
  idleAnimationOverride?: string;    // переопределяет animStyle скина
  eyeOverride?:           string;    // переопределяет eyeStyle скина
  particleEffect?:        string;    // постоянный фоновый эффект этого характера
  statBarTints: Partial<Record<StatKey, StatBarTint>>;
  emergentStateAnims: Partial<Record<EmergentStateType, EmergentStateAnim>>;
}

// ── Определение характера ────────────────────────────────────────────────────
// Каждый характер — ровно один объект этого типа в массиве PERSONALITIES[].
// Движок читает объекты, не знает о конкретных характерах.

export interface PersonalityDefinition {
  id:          PersonalityId;
  name:        string;
  tagline:     string;
  description: string;          // лор для UI
  emoji:       string;
  rarity:      'common' | 'rare' | 'epic' | 'legendary';

  // ── Распад статов ─────────────────────────────────────────────
  // 1.0 = норма, 1.5 = на 50% быстрее, 0.5 = вдвое медленнее
  // Обрезается: [DECAY_MULT_MIN, DECAY_MULT_MAX]
  decayRates: StatMultipliers;

  // ── Аддитивный бонус к restore ────────────────────────────────
  // restoreBonus['feed']['hunger'] = 15 → +15 к базовому restore от кормёжки
  // Суммарный Σ обрезается: [0, STAT_RESTORE_ADD_MAX]
  restoreBonus: Partial<Record<ActionType, StatAdditives>>;

  // ── XP мультипликаторы ────────────────────────────────────────
  // Обрезается: [XP_MIN, XP_MAX]
  xpMultipliers: ActionMultipliers;

  // ── Монеты от действий ────────────────────────────────────────
  // Обрезается: [COIN_MIN, COIN_MAX]
  coinMultipliers: ActionMultipliers;

  // ── Еда ───────────────────────────────────────────────────────
  foodPreferences: FoodPreferences;

  // ── Авто-поведение ────────────────────────────────────────────
  autoSleep: AutoSleepConfig;

  // ── Настроение ────────────────────────────────────────────────
  moodBias: MoodBiasConfig;

  // ── Натуральная регенерация ───────────────────────────────────
  naturalHealthRegen: number;   // +N health за sync-тик (без heal-действия)

  // ── Сопротивление негативным эффектам ─────────────────────────
  // 0.0 = полная уязвимость, 1.0 = полный иммунитет
  negativeEffectResistance: number;

  // ── Связь с системами флагов и состояний ──────────────────────
  possibleFlags:      BehavioralFlagType[];
  emergentTriggers:   Array<{ stateType: EmergentStateType; description: string }>;

  // ── Специальные условия ───────────────────────────────────────
  // Любые параметры характера, не укладывающиеся в стандартные поля.
  // Движок проверяет их в applySpecialRules().
  specialRules?: PersonalitySpecialRules;

  // ── Визуал ────────────────────────────────────────────────────
  visualProfile: PersonalityVisualProfile;

  // ── Связанные скины ───────────────────────────────────────────
  linkedSkinIds: string[];
}

// Специальные правила — расширяемый объект для уникальной механики характеров.
// Добавить новое специальное правило = добавить поле сюда + обработку в engine.
export interface PersonalitySpecialRules {
  // Foodie
  passiveStatBonusWhenFull?: boolean;   // все статы +3/тик при hunger > 80

  // Bold
  rejectSleepWhenEnergized?: boolean;   // не засыпает авто при energy > 30

  // Anxious
  peakPerformanceThreshold?: number;    // avg stats > этого → XP/coins бонус
  anxiousStatSadThreshold?: number;     // если любой стат < этого значения → mood = sad

  // Feral
  nighttimeHours?: [number, number];    // [22, 6] — диапазон "ночи"
  nightEnergyDecayDisabled?: boolean;
  resistsBathing?: boolean;             // событие купания = "против воли"

  // Melancholic
  xpEveryOtherAction?: boolean;         // XP начисляется только на чётные действия

  // Chaotic
  randomizeDailySeed?: boolean;         // перерандомизация модификаторов раз в 24ч

  // Stoic
  flatXpFromPlay?: boolean;             // XP от игры всегда = константа, независимо от score

  // Adventurer
  foodBoredomEnabled?: boolean;         // -% happiness за повторную еду

  // Paranoid
  healRefuseHealthThreshold?: number;   // heal заблокирован если health > этого значения
  feedRestoreByPhase?: boolean;         // множитель восстановления зависит от paranoidPhase
  trustThresholdBonds?: number;         // bond-действий до перехода в trusted (дефолт: 10)
}

// ── Pattern Engine — типы правил ────────────────────────────────────────────
// Правила живут в patternRules.ts как данные. Движок только читает массив.
// Добавить новое правило = добавить объект PatternRule. Движок не трогать.

export type PatternConditionType =
  | 'action_in_stat_zone'     // действие при стате в зоне (red/green/high)
  | 'action_frequency'        // N действий за M дней подряд
  | 'stat_below_threshold'    // стат не поднимался выше X за N синков
  | 'session_gap_hours'       // разрыв между сессиями >/< N часов
  | 'time_of_day_action'      // действие в определённый час (ночное пробуждение)
  | 'consecutive_syncs_cond'  // условие выполнялось N синков подряд
  | 'same_food_ratio'         // одна еда > ratio% от всех кормлений
  | 'unique_items_used';      // уникальных видов еды >= minUnique

// Оператор сравнения (по умолчанию '>=')
export type ConditionOp = '>=' | '<=' | '==' | '>' | '<';

export interface PatternCondition {
  type: PatternConditionType;
  params: Record<string, number | string>;
  // op применяется к основному счётчику условия (дефолт '>=')
  op?: ConditionOp;
}

export interface PatternRule {
  id:           string;
  description:  string;
  // undefined = применяется ко всем характерам (универсальное правило)
  personalityId?: PersonalityId;

  // ВСЕ условия должны выполниться одновременно
  conditions:   PatternCondition[];

  effect: {
    flagType:          BehavioralFlagType;
    action:            'activate' | 'increment_severity' | 'add_heal_progress' | 'deactivate';
    severity?:         1 | 2 | 3;
    healProgressDelta?: number;
  };

  // Динамическая severity по значению счётчика: [сev1_threshold, sev2_threshold, sev3_threshold]
  // Пример: [5, 10, 20] → counter < 10 → sev1, < 20 → sev2, >= 20 → sev3
  severityThresholds?: [number, number, number];
}

// ── Поведенческие флаги ──────────────────────────────────────────────────────

export type BehavioralFlagType =
  // — Негативные (тревоги / травмы) —
  | 'food_anxiety'        // кормили только при hunger < 20 (≥5 раз за 7д)
  | 'abandonment_fear'    // пропуск > 48ч был ≥3 раза за 30д
  | 'overtreated'         // heal при health > 90 более 5 раз за 7д
  | 'night_disruption'    // будили из первого часа сна ≥3 раза за 7д
  | 'play_burnout'        // > 8 игр в день ≥3 дня подряд
  | 'filth_trauma'        // cleanliness < 10 было ≥3 раза за 30д
  | 'forced_sleep'        // sleep при energy > 70 было ≥5 раз за 7д
  | 'health_neglect'      // health < 20 на протяжении ≥5 синков подряд
  | 'food_monotony'       // одна и та же еда > 80% кормлений за 7д
  // — Позитивные (усиления / доверие) —
  | 'trust_bond'          // ≥14 дней без критических провалов
  | 'culinary_explorer'   // попробованы все 8 базовых + 3 магазинных блюда
  | 'night_guardian'      // ровно 1 взаимодействие за ночь, 7 ночей подряд
  | 'perfect_balance';    // все статы > 70 в ≥10 синках подряд

export interface BehavioralFlag {
  type:           BehavioralFlagType;
  activatedAt:    string;           // ISO
  severity:       1 | 2 | 3;       // нарастает при повторных триггерах
  healProgress:   number;           // 0–100, процент до снятия флага
  lastHealAction?: string;          // ISO — последнее целебное действие
}

export type RollingCounterKey =
  | 'feed_red'
  | 'feed_green'
  | 'sleep_forced'
  | 'heal_healthy'
  | 'night_wake'
  | 'night_interaction'
  | 'session_gap_48h'
  | 'filth_crisis'
  | 'play'
  | 'item_add'
  | 'item_use';

export interface RollingDailyBucket {
  date: string;
  counts: Partial<Record<RollingCounterKey, number>>;
  foodCounts?: Record<string, number>;
  itemAddCounts?: Record<string, number>;
  itemUseCounts?: Record<string, number>;
}

export interface BehavioralRollingWindows {
  dailyBuckets: RollingDailyBucket[];
}

// ── Эмерджентные состояния ───────────────────────────────────────────────────

export type EmergentStateType =
  | 'tantrum'              | 'apathy'            | 'midnight_zoomies'
  | 'food_panic'           | 'breakdown'         | 'contamination_crisis'
  | 'trust_collapse'       | 'coin_obsession'    | 'deep_melancholy'
  | 'enlightenment'        | 'wanderlust'        | 'stoic_peak'
  | 'chaos_surge'          | 'feast_frenzy'
  | 'singularity'          | 'identity_crisis'   | 'shadow_form'
  | 'confused';

export interface BlockedAction {
  actionType:       ActionType;
  reason:           string;          // показывается в UI
  alternativeHint:  string;          // что делать вместо
}

export interface ModifiedAction {
  actionType:       ActionType;
  statAdditives:    StatAdditives;   // дополнительный аддитивный бонус/штраф
  xpMultiplier:     number;
  coinMultiplier:   number;
}

export interface EmergentStateDefinition {
  type:        EmergentStateType;
  name:        string;
  description: string;
  emoji:       string;
  priority:    number;               // 1 = наивысший, мьютекс по priority

  blockedActions:  BlockedAction[];
  modifiedActions: ModifiedAction[];

  exitHint:  string;                 // подсказка без спойлеров
  exclusive: boolean;                // true → вытесняет другие active states

  visual: {
    bodyAnimation: string;
    eyeExpression: EyeExpressionKey;
    particleEffect?: string;
    overlayTint?:   string;
  };
}

export type EmergentStateLayer = 'gameplay' | 'evolution' | 'cognitive';

export interface ActiveEmergentState {
  type: EmergentStateType;
  layer: EmergentStateLayer;
  enteredAt: string;
}

export type PetStateLayers = Partial<Record<EmergentStateLayer, ActiveEmergentState[]>>;

// ── Накопительные счётчики (lazy Pattern Engine) ─────────────────────────────
// Хранятся прямо в Pet. Обновляются инкрементально при каждом action (O(1)).
// Pattern Engine читает счётчики, а не event log → нет тяжёлых запросов.

export interface BehavioralCounters {
  // Сессия
  sessionGapHours:      number;      // часов с предыдущего запроса
  lastActionTimestamp:  string;      // ISO

  // Скользящие 7-дневные счётчики
  feedInRedZone7d:      number;      // кормлений при hunger < 20
  feedInGreenZone7d:    number;      // кормлений при hunger > 60 (heal food_anxiety)
  forcedSleepCount7d:   number;      // sleep при energy > 70
  healWhenHealthy7d:    number;      // heal при health > 90
  nightWakeCount7d:     number;      // wake в первый час сна

  // Счётчики 30-дневные
  sessionGapsOver48h_30d: number;
  filthCrisisCount30d:    number;    // раз cleanliness < 10

  // Последовательные счётчики (streak)
  consecutiveLowHealthSyncs: number; // синков подряд с health < 20
  consecutiveGoodSyncs:      number; // синков подряд avg > 70
  consecutiveBadMoodSyncs:   number; // синков подряд mood = sad
  maxConsecHighPlayDays:     number; // макс. дней подряд с > 8 играми
  currentHighPlayDays:       number; // текущая streak
  nightSingleInteractionDays7d?: number; // ночей подряд с ровно 1 взаимодействием
  lastStatsSnapshot?: Partial<Record<StatKey, number>>; // последний снимок статов для conditional streak rules

  // Ежедневные (сбрасываются в полночь)
  playCountToday:  number;
  lastDayReset:    string;           // ISO-дата последнего сброса дневных счётчиков
  dailyFoodLog:    Record<string, number>; // foodId → count за сегодня
  recentFeedTimestamps?: string[];   // ISO кормлений за последний час для feast_frenzy

  // Lifetime
  uniqueFoodsTried: string[];        // все уникальные foodId за всё время
  uniqueItemsAdded?: string[];       // все уникальные itemId, добавленные в инвентарь
  uniqueItemsUsed?: string[];        // все уникальные itemId, использованные из инвентаря
  dailyItemAddLog?: Record<string, number>;
  dailyItemUseLog?: Record<string, number>;
  itemAdds7d?: number;
  itemUses7d?: number;
  repeatedItemUse7d?: number;        // максимум повторов одного itemId за 7 дней
  totalBondActions: number;

  // Комната (авантюрист + wanderlust)
  sameRoomHours:       number;
  lastEquippedRoomId:  string;
  lastRoomCheckTs:     string;       // ISO для расчёта прошедших часов

  // Параноик
  paranoidPhase:       'untrusted' | 'trusted' | 'collapsed';
  bondActionsInPhase:  number;
  trustedSince?:       string;       // ISO

  // Одноразовые флаги
  stoicPeakUsed:        boolean;
  enlightenmentActive:  boolean;
  enlightenmentStart?:  string;      // ISO
  chaosDailySeed:       number;      // 0–1, перерандомизируется раз в 24ч
  chaosSeedDate:        string;      // ISO-дата последнего seed
  melancholicActionCount: number;     // счетчик действий для xpEveryOtherAction

  // Rolling source of truth для 7d/30d counters.
  // Старые числовые поля выше остаются materialized summary для совместимости.
  rollingWindows?:      BehavioralRollingWindows;
}

// ── Снапшот настроения (для графика 7 дней) ─────────────────────────────────

export interface MoodSnapshot {
  timestamp:        string;          // ISO
  mood:             string;          // PetMood
  avgStats:         number;          // среднее всех статов 0–100
  dominantLowStat?: StatKey;         // какой стат тянул вниз
}

// ── Контекст для движка ──────────────────────────────────────────────────────

export interface PersonalityRuntimeContext {
  now?: Date;
  rng?: () => number;
  source?: string;
  replayId?: string;
}

export interface ActionContext {
  foodId?:          string;
  clientLocalHour:  number;          // 0–23
  coinBalance:      number;
  itemId?:          string;
  now?:             Date;
  rng?:             () => number;
}

export interface SyncContext {
  clientLocalHour:  number;
  sessionGapHours:  number;
  coinBalance:      number;
  now?:             Date;
  rng?:             () => number;
}
