import type {
  PersonalityDefinition,
  StatKey, ActionType, StatAdditives,
  BehavioralFlag, BehavioralFlagType,
  BehavioralCounters, ConditionOp, PatternCondition,
  EmergentStateType, BlockedAction,
  ActionContext, SyncContext,
} from './types';
import { MODIFIER_CAPS } from './types';
import { EMERGENT_STATE_MAP } from './emergentStates';
import { PATTERN_RULES } from './patternRules';

// ════════════════════════════════════════════════════════════════════════════
//  PersonalityEngine — чистый, без состояния, только функции.
//  Принимает данные, возвращает результаты. Легко тестируется.
//
//  Стакинг модификаторов (из документа v1.1):
//    XP:      base × clamp(Π xpMults,       XP_MIN,    XP_MAX)
//    Coins:   base × clamp(Π coinMults,      COIN_MIN,  COIN_MAX)
//    Restore: base + clamp(Σ addBonuses,     0,         STAT_RESTORE_ADD_MAX)
//    Decay:   base × clamp(Π decayMults,     DECAY_MIN, DECAY_MAX)
// ════════════════════════════════════════════════════════════════════════════

// ── Базовые тики decay (процентов в минуту) ──────────────────────────────────
const BASE_DECAY_PER_MINUTE: Record<StatKey, number> = {
  hunger:      0.083,  // ~5/ч → 0 за 20ч
  happiness:   0.083,
  energy:      0.100,  // ~6/ч → 0 за 16ч
  health:      0.033,  // ~2/ч
  cleanliness: 0.067,  // ~4/ч
  bond:        0.050,  // ~3/ч
};

// Flat XP за игру при flat-режиме (stoic)
const STOIC_FLAT_PLAY_XP = 15;

// ── Вспомогательные утилиты ──────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clampStat = (v: number) => clamp(v, 0, 100);

function multiplyAll(mults: number[]): number {
  return mults.reduce((acc, m) => acc * m, 1);
}

// ── Хаотик: суточный seed ────────────────────────────────────────────────────

function isDifferentDay(isoA: string, isoB: string): boolean {
  return isoA.slice(0, 10) !== isoB.slice(0, 10);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getChaosMultipliers(counters: BehavioralCounters): {
  decayMult: number; restoreMult: number; xpMult: number; coinMult: number; negResist: number;
} {
  const now = new Date().toISOString();
  const seed = isDifferentDay(counters.chaosSeedDate, now)
    ? Math.floor(Math.random() * 1e9)
    : counters.chaosDailySeed;

  const rng = seededRandom(seed);
  return {
    decayMult:   0.5 + rng() * 2.0,   // 0.5–2.5
    restoreMult: 0.5 + rng() * 2.0,
    xpMult:      0.5 + rng() * 2.0,
    coinMult:    0.5 + rng() * 2.0,
    negResist:   rng() * 0.8,
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  applyDecay — применить распад статов с модификаторами характера
// ────────────────────────────────────────────────────────────────────────────

export function applyDecay(
  currentStats: Record<StatKey, number>,
  personality: PersonalityDefinition,
  elapsedMinutes: number,
  counters: BehavioralCounters,
  context: SyncContext,
): Record<StatKey, number> {
  const result = { ...currentStats };
  const keys: StatKey[] = ['hunger', 'happiness', 'energy', 'health', 'cleanliness', 'bond'];

  // Хаотик: рандомные модификаторы из суточного seed
  const chaosMult = personality.id === 'chaotic'
    ? getChaosMultipliers(counters).decayMult
    : 1.0;

  for (const stat of keys) {
    const base = BASE_DECAY_PER_MINUTE[stat] * elapsedMinutes;
    const persDecay = personality.decayRates[stat] ?? 1.0;

    // Эмпат: при низком bond весь decay ×1.3
    const empathDecayMult = (personality.id === 'empath' && currentStats.bond < 30) ? 1.3 : 1.0;

    // Нервный: пиковое состояние снимает штраф decay
    const anxiousMult = (personality.id === 'anxious') ? 1.0 : 1.0; // базовый — уже в decayRates

    // Дикий: ночью energy не падает
    const feralNightMult = (
      personality.id === 'feral' &&
      personality.specialRules?.nightEnergyDecayDisabled &&
      stat === 'energy' &&
      isNightHour(context.clientLocalHour, personality.specialRules?.nighttimeHours)
    ) ? 0.0 : 1.0;

    const totalMult = clamp(
      multiplyAll([persDecay, chaosMult, empathDecayMult, anxiousMult, feralNightMult]),
      MODIFIER_CAPS.DECAY_MULT_MIN,
      MODIFIER_CAPS.DECAY_MULT_MAX,
    );

    result[stat] = clampStat(currentStats[stat] - base * totalMult);
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
//  applyActionModifiers — применить модификаторы характера к результату действия
// ────────────────────────────────────────────────────────────────────────────

export interface ActionResult {
  statDeltas: Partial<Record<StatKey, number>>;
  xp: number;
  coins: number;
}

export function applyActionModifiers(
  base: ActionResult,
  action: ActionType,
  personality: PersonalityDefinition,
  flags: BehavioralFlag[],
  emergentState: EmergentStateType | null,
  counters: BehavioralCounters,
  context: ActionContext,
): ActionResult {
  const result: ActionResult = {
    statDeltas: { ...base.statDeltas },
    xp: base.xp,
    coins: base.coins,
  };

  const chaos = personality.id === 'chaotic' ? getChaosMultipliers(counters) : null;

  // ── 1. Restore: аддитивные бонусы ─────────────────────────────────────────
  const restoreBonus = personality.restoreBonus[action] ?? {};
  const chaosBonusMult = chaos?.restoreMult ?? 1.0;

  for (const [statRaw, bonus] of Object.entries(restoreBonus)) {
    const stat = statRaw as StatKey;
    const existing = result.statDeltas[stat] ?? 0;
    result.statDeltas[stat] = existing + (bonus ?? 0) * chaosBonusMult;
  }

  // ── 2. Еда: loved/hated бонусы ────────────────────────────────────────────
  if (action === 'feed' && context.foodId) {
    const { lovedIds, hatedIds, loveBonus, hatePenalty, universalFeedBonus } = personality.foodPreferences;

    if (universalFeedBonus) {
      for (const [s, v] of Object.entries(universalFeedBonus)) {
        const stat = s as StatKey;
        result.statDeltas[stat] = (result.statDeltas[stat] ?? 0) + (v ?? 0);
      }
    }

    // Авантюрист: первый раз = loveBonus, повторно = hatePenalty
    if (personality.specialRules?.foodBoredomEnabled) {
      const countToday = counters.dailyFoodLog[context.foodId] ?? 0;
      const source = countToday === 0 ? loveBonus : countToday === 1 ? {} : hatePenalty;
      for (const [s, v] of Object.entries(source)) {
        const stat = s as StatKey;
        result.statDeltas[stat] = (result.statDeltas[stat] ?? 0) + (v ?? 0);
      }
    } else if (lovedIds.includes(context.foodId)) {
      for (const [s, v] of Object.entries(loveBonus)) {
        const stat = s as StatKey;
        result.statDeltas[stat] = (result.statDeltas[stat] ?? 0) + (v ?? 0);
      }
    } else if (hatedIds.includes(context.foodId)) {
      for (const [s, v] of Object.entries(hatePenalty)) {
        const stat = s as StatKey;
        result.statDeltas[stat] = (result.statDeltas[stat] ?? 0) + (v ?? 0);
      }
    }
  }

  // ── 3. Флаги: аддитивные эффекты на restore ───────────────────────────────
  for (const flag of flags) {
    const flagAdditives = FLAG_RESTORE_EFFECTS[flag.type]?.[action];
    if (flagAdditives) {
      for (const [s, v] of Object.entries(flagAdditives)) {
        const stat = s as StatKey;
        result.statDeltas[stat] = (result.statDeltas[stat] ?? 0) + (v ?? 0) * flag.severity;
      }
    }
  }

  // ── 4. Эмерджентное состояние: аддитивные модификаторы ────────────────────
  if (emergentState) {
    const stateDef = EMERGENT_STATE_MAP.get(emergentState);
    const stateModified = stateDef?.modifiedActions.find(m => m.actionType === action);
    if (stateModified) {
      for (const [s, v] of Object.entries(stateModified.statAdditives)) {
        const stat = s as StatKey;
        result.statDeltas[stat] = (result.statDeltas[stat] ?? 0) + (v ?? 0);
      }
    }
  }

  // ── 5. Clamp суммарных stat restore deltas ────────────────────────────────
  for (const [s, v] of Object.entries(result.statDeltas)) {
    const stat = s as StatKey;
    if ((v ?? 0) > 0) {
      result.statDeltas[stat] = clamp(v ?? 0, 0, MODIFIER_CAPS.STAT_RESTORE_ADD_MAX + (base.statDeltas[stat] ?? 0));
    }
  }

  // ── 6. XP мультипликаторы ─────────────────────────────────────────────────
  const xpMults: number[] = [
    personality.xpMultipliers[action] ?? 1.0,
    chaos?.xpMult ?? 1.0,
    getStateXpMult(emergentState, action),
    getFlagXpMult(flags, action),
  ];

  // Стоик: XP от игры всегда фиксированный
  if (personality.specialRules?.flatXpFromPlay && action === 'play') {
    result.xp = STOIC_FLAT_PLAY_XP;
  } else {
    // Нервный: пиковое состояние — XP бонус
    let xpBase = result.xp;
    if (personality.id === 'anxious' && personality.specialRules?.peakPerformanceThreshold) {
      // пиковый бонус будет применён в computeNaturalPassives — здесь только mult
    }
    result.xp = Math.round(xpBase * clamp(multiplyAll(xpMults), MODIFIER_CAPS.XP_MIN, MODIFIER_CAPS.XP_MAX));
  }

  // Меланхолик: XP только на чётных действиях (счётчик в store)
  // Признак обрабатывается снаружи (mockApi), здесь только флаг
  if (personality.specialRules?.xpEveryOtherAction) {
    result.xp = result.xp; // mockApi пропускает каждое второе
  }

  // ── 7. Coin мультипликаторы ───────────────────────────────────────────────
  const coinMults: number[] = [
    personality.coinMultipliers[action] ?? 1.0,
    chaos?.coinMult ?? 1.0,
    getStateCoinMult(emergentState, action),
    getFlagCoinMult(flags, action),
  ];
  result.coins = Math.round(result.coins * clamp(multiplyAll(coinMults), MODIFIER_CAPS.COIN_MIN, MODIFIER_CAPS.COIN_MAX));

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
//  isActionBlocked — проверить заблокировано ли действие эмерджентным состоянием
// ────────────────────────────────────────────────────────────────────────────

export function isActionBlocked(
  action: ActionType,
  emergentState: EmergentStateType | null,
): BlockedAction | null {
  if (!emergentState) return null;
  const def = EMERGENT_STATE_MAP.get(emergentState);
  if (!def) return null;
  return def.blockedActions.find(b => b.actionType === action) ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
//  computeEmergentState — вычислить эмерджентное состояние из текущего стейта
// ────────────────────────────────────────────────────────────────────────────

export function computeEmergentState(
  stats: Record<StatKey, number>,
  personality: PersonalityDefinition,
  flags: BehavioralFlag[],
  counters: BehavioralCounters,
  context: SyncContext,
  currentState: EmergentStateType | null,
  enteredAt: string | undefined,
): EmergentStateType | null {
  const candidates: { type: EmergentStateType; priority: number }[] = [];
  const avg = avgStats(stats);
  const now = Date.now();

  const hasFlag = (f: BehavioralFlagType) => flags.some(fl => fl.type === f);

  // stoic_peak — одноразовый
  if (personality.id === 'stoic' && !counters.stoicPeakUsed) {
    if (counters.consecutiveGoodSyncs >= 10) {
      candidates.push({ type: 'stoic_peak', priority: 12 });
    }
  }

  // stoic_peak истекает через 2ч
  if (currentState === 'stoic_peak' && enteredAt) {
    const elapsed = (now - new Date(enteredAt).getTime()) / 3600000;
    if (elapsed >= 2) return null;
  }

  // enlightenment — sage, 7 дней avg > 70
  if (personality.id === 'sage' && !counters.enlightenmentActive) {
    if (counters.consecutiveGoodSyncs >= 7 * 24) {
      candidates.push({ type: 'enlightenment', priority: 11 });
    }
  }
  // enlightenment истекает через 24ч или при avg < 50
  if (currentState === 'enlightenment' && enteredAt) {
    const elapsed = (now - new Date(enteredAt).getTime()) / 3600000;
    if (elapsed >= 24 || avg < 50) return null;
  }

  // feast_frenzy — foodie
  if (personality.id === 'foodie' && counters.playCountToday >= 3 && stats.happiness > 90) {
    candidates.push({ type: 'feast_frenzy', priority: 14 });
  }

  // deep_melancholy — melancholic
  if (personality.id === 'melancholic' && counters.consecutiveBadMoodSyncs >= 5) {
    candidates.push({ type: 'deep_melancholy', priority: 9 });
  }

  // wanderlust — adventurer
  if (personality.id === 'adventurer' && counters.sameRoomHours >= 48) {
    candidates.push({ type: 'wanderlust', priority: 10 });
  }

  // midnight_zoomies — feral
  if (personality.id === 'feral' &&
      isNightHour(context.clientLocalHour, personality.specialRules?.nighttimeHours)) {
    candidates.push({ type: 'midnight_zoomies', priority: 8 });
  }

  // coin_obsession — greedy
  if (personality.id === 'greedy' && context.coinBalance < 50 && counters.playCountToday < 5) {
    candidates.push({ type: 'coin_obsession', priority: 7 });
  }

  // food_panic — при флаге food_anxiety
  if (hasFlag('food_anxiety') && stats.hunger < 50) {
    candidates.push({ type: 'food_panic', priority: 6 });
  }

  // trust_collapse — paranoid
  if (personality.id === 'paranoid' &&
      counters.paranoidPhase === 'collapsed') {
    candidates.push({ type: 'trust_collapse', priority: 5 });
  }

  // apathy — empath
  if (personality.id === 'empath' && context.sessionGapHours >= 48) {
    candidates.push({ type: 'apathy', priority: 4 });
  }

  // tantrum — bold или playful + energy < 15
  if ((personality.id === 'bold' || personality.id === 'playful') && stats.energy < 15) {
    candidates.push({ type: 'tantrum', priority: 3 });
  }

  // contamination_crisis — pristine
  if (personality.id === 'pristine' && stats.cleanliness < 20) {
    candidates.push({ type: 'contamination_crisis', priority: 2 });
  }

  // breakdown — anxious + 3 стата < 30
  if (personality.id === 'anxious') {
    const lowStats = (['hunger', 'happiness', 'energy', 'health', 'cleanliness', 'bond'] as StatKey[])
      .filter(s => stats[s] < 30).length;
    if (lowStats >= 3) {
      candidates.push({ type: 'breakdown', priority: 1 });
    }
  }

  // chaos_surge — автоматически каждые 3ч (проверяется снаружи по времени)
  // Не вычисляется здесь — управляется mockApi/server

  if (candidates.length === 0) return null;

  // Победитель — с наименьшим priority числом (1 = наивысший)
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0].type;
}

// ────────────────────────────────────────────────────────────────────────────
//  runPatternEngine — data-driven: итерирует PATTERN_RULES, оценивает условия
//  через счётчики (O(rules_count), константа). Добавить правило = добавить
//  объект в patternRules.ts. Сюда не заходить.
// ────────────────────────────────────────────────────────────────────────────

export function runPatternEngine(
  counters: BehavioralCounters,
  currentFlags: BehavioralFlag[],
  personality: PersonalityDefinition,
): BehavioralFlag[] {
  let flags = [...currentFlags];
  const now = new Date().toISOString();

  const canSetFlag = (type: BehavioralFlagType) =>
    personality.possibleFlags.includes(type) || UNIVERSAL_FLAGS.includes(type);

  const setFlag = (type: BehavioralFlagType, severity: 1 | 2 | 3 = 1) => {
    if (!canSetFlag(type)) return;
    const existing = flags.find(f => f.type === type);
    if (!existing) {
      flags.push({ type, severity, activatedAt: now, healProgress: 0 });
    } else if (existing.severity < severity) {
      existing.severity = severity;
    }
  };

  const healFlag = (type: BehavioralFlagType, delta: number) => {
    const f = flags.find(fl => fl.type === type);
    if (!f) return;
    f.healProgress = clamp(f.healProgress + delta, 0, 100);
    f.lastHealAction = now;
    if (f.healProgress >= 100) flags = flags.filter(fl => fl.type !== type);
  };

  const removeFlag = (type: BehavioralFlagType) => {
    flags = flags.filter(f => f.type !== type);
  };

  for (const rule of PATTERN_RULES) {
    // Пропустить если правило привязано к другому характеру
    if (rule.personalityId !== undefined && rule.personalityId !== personality.id) continue;

    // Проверить все условия (AND)
    if (!rule.conditions.every(cond => evalCondition(cond, counters))) continue;

    const { flagType, action, severity = 1, healProgressDelta = 0 } = rule.effect;

    switch (action) {
      case 'activate': {
        const sev = rule.severityThresholds
          ? dynamicSeverity(counterForRule(rule, counters), rule.severityThresholds)
          : severity;
        setFlag(flagType, sev);
        break;
      }
      case 'increment_severity': {
        const f = flags.find(fl => fl.type === flagType);
        if (f && f.severity < 3) { f.severity = Math.min(3, f.severity + 1) as 1 | 2 | 3; }
        break;
      }
      case 'add_heal_progress':
        healFlag(flagType, healProgressDelta);
        break;
      case 'deactivate':
        removeFlag(flagType);
        break;
    }
  }

  return flags;
}

// ── Оценка одного условия PatternCondition по счётчикам ──────────────────────

function evalCondition(cond: PatternCondition, c: BehavioralCounters): boolean {
  const op: ConditionOp = cond.op ?? '>=';

  switch (cond.type) {
    case 'action_in_stat_zone': {
      const { action, zone, threshold } = cond.params as Record<string, string | number>;
      const value = actionZoneCounter(String(action), String(zone), c);
      return compare(value, Number(threshold), op);
    }
    case 'action_frequency': {
      const { threshold } = cond.params as Record<string, number>;
      return compare(c.maxConsecHighPlayDays, threshold, op);
    }
    case 'stat_below_threshold': {
      const { statKey, threshold } = cond.params as Record<string, string | number>;
      const value = statThresholdCounter(String(statKey), c);
      return compare(value, Number(threshold), op);
    }
    case 'session_gap_hours': {
      const { threshold } = cond.params as Record<string, number>;
      // op '<' → sessionGapHours < threshold (регулярный пользователь)
      // op '>=' → sessionGapsOver48h_30d >= threshold (были пропуски)
      const value = op === '<' ? c.sessionGapHours : c.sessionGapsOver48h_30d;
      return compare(value, threshold, op);
    }
    case 'time_of_day_action': {
      const { threshold } = cond.params as Record<string, number>;
      return compare(c.nightWakeCount7d, threshold, op);
    }
    case 'consecutive_syncs_cond': {
      const { threshold } = cond.params as Record<string, number>;
      return compare(c.consecutiveGoodSyncs, threshold, op);
    }
    case 'same_food_ratio': {
      const { ratio, minFeeds = 5 } = cond.params as Record<string, number>;
      const totalFeeds = Object.values(c.dailyFoodLog).reduce((a, b) => a + b, 0);
      if (totalFeeds < minFeeds) return false;
      const maxCount = Math.max(...Object.values(c.dailyFoodLog), 0);
      return (maxCount / totalFeeds) > ratio;
    }
    case 'unique_items_used': {
      const { minUnique } = cond.params as Record<string, number>;
      return c.uniqueFoodsTried.length >= minUnique;
    }
    default:
      return false;
  }
}

function compare(value: number, threshold: number, op: ConditionOp): boolean {
  switch (op) {
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '>':  return value > threshold;
    case '<':  return value < threshold;
    case '==': return value === threshold;
  }
}

function actionZoneCounter(action: string, zone: string, c: BehavioralCounters): number {
  if (action === 'feed' && zone === 'red')   return c.feedInRedZone7d;
  if (action === 'feed' && zone === 'green') return c.feedInGreenZone7d;
  if (action === 'sleep' && zone === 'high') return c.forcedSleepCount7d;
  if (action === 'heal'  && zone === 'high') return c.healWhenHealthy7d;
  return 0;
}

function statThresholdCounter(statKey: string, c: BehavioralCounters): number {
  if (statKey === 'health')      return c.consecutiveLowHealthSyncs;
  if (statKey === 'cleanliness') return c.filthCrisisCount30d;
  return 0;
}

// Возвращает основной счётчик первого условия правила (для dynamicSeverity)
function counterForRule(rule: typeof PATTERN_RULES[number], c: BehavioralCounters): number {
  const cond = rule.conditions[0];
  if (!cond) return 0;
  const { action, zone, statKey } = cond.params as Record<string, string>;
  switch (cond.type) {
    case 'action_in_stat_zone':    return actionZoneCounter(action, zone, c);
    case 'stat_below_threshold':   return statThresholdCounter(statKey, c);
    case 'session_gap_hours':      return c.sessionGapsOver48h_30d;
    case 'action_frequency':       return c.maxConsecHighPlayDays;
    case 'consecutive_syncs_cond': return c.consecutiveGoodSyncs;
    default: return 0;
  }
}

function dynamicSeverity(value: number, thresholds: [number, number, number]): 1 | 2 | 3 {
  if (value >= thresholds[2]) return 3;
  if (value >= thresholds[1]) return 2;
  return 1;
}

// ────────────────────────────────────────────────────────────────────────────
//  updateCounters — инкрементально обновить счётчики после действия (O(1))
// ────────────────────────────────────────────────────────────────────────────

export function updateCounters(
  counters: BehavioralCounters,
  action: ActionType,
  stats: Record<StatKey, number>,
  context: ActionContext,
): BehavioralCounters {
  const c = { ...counters };
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Сессия: gap
  c.sessionGapHours = context.clientLocalHour >= 0
    ? (new Date(now).getTime() - new Date(c.lastActionTimestamp).getTime()) / 3600000
    : 0;
  c.lastActionTimestamp = now;

  if (c.sessionGapHours >= 48) {
    c.sessionGapsOver48h_30d = Math.min(c.sessionGapsOver48h_30d + 1, 100);
  }

  // Сброс дневных счётчиков в новый день
  if (c.lastDayReset !== today) {
    c.playCountToday = 0;
    c.dailyFoodLog = {};
    c.lastDayReset = today;
  }

  // Специфичные для действий
  if (action === 'feed') {
    if (context.foodId) {
      c.dailyFoodLog = { ...c.dailyFoodLog, [context.foodId]: (c.dailyFoodLog[context.foodId] ?? 0) + 1 };
      if (!c.uniqueFoodsTried.includes(context.foodId)) {
        c.uniqueFoodsTried = [...c.uniqueFoodsTried, context.foodId];
      }
    }
    if (stats.hunger < 20) c.feedInRedZone7d++;
    if (stats.hunger > 60) c.feedInGreenZone7d++;
  }

  if (action === 'play') {
    c.playCountToday++;
    if (c.playCountToday > 8) {
      c.currentHighPlayDays = Math.max(c.currentHighPlayDays, 1);
      c.maxConsecHighPlayDays = Math.max(c.maxConsecHighPlayDays, c.currentHighPlayDays);
    }
  }

  if (action === 'sleep' && stats.energy > 70) c.forcedSleepCount7d++;
  if (action === 'wake') {
    // Упрощённо: считаем за ночное пробуждение если час 0–2
    if (context.clientLocalHour >= 0 && context.clientLocalHour <= 2) c.nightWakeCount7d++;
  }
  if (action === 'heal' && stats.health > 90) c.healWhenHealthy7d++;
  if (action === 'bond') {
    c.totalBondActions++;
    c.bondActionsInPhase++;
  }

  // filth crisis
  if (stats.cleanliness < 10 && action === 'sync') c.filthCrisisCount30d++;

  // health neglect streak
  if (stats.health < 20 && action === 'sync') {
    c.consecutiveLowHealthSyncs++;
  } else if (action === 'heal' || (action === 'sync' && stats.health >= 20)) {
    c.consecutiveLowHealthSyncs = 0;
  }

  // bad mood streak
  // обновляется вызывающим кодом с текущим mood

  // Параноик: смена фазы
  if (c.paranoidPhase === 'untrusted' && c.bondActionsInPhase >= 10) {
    c.paranoidPhase = 'trusted';
    c.bondActionsInPhase = 0;
    c.trustedSince = now;
  }
  if (c.paranoidPhase === 'trusted' && c.sessionGapHours >= 24) {
    c.paranoidPhase = 'collapsed';
  }
  if (c.paranoidPhase === 'collapsed' && c.bondActionsInPhase >= 20) {
    c.paranoidPhase = 'trusted';
    c.bondActionsInPhase = 0;
    c.trustedSince = now;
  }

  // Комната (авантюрист/wanderlust)
  if (context.itemId === undefined && action === 'sync') {
    const elapsed = (new Date(now).getTime() - new Date(c.lastRoomCheckTs).getTime()) / 3600000;
    c.sameRoomHours += elapsed;
    c.lastRoomCheckTs = now;
  }

  // Chaotic: seed
  if (isDifferentDay(c.chaosSeedDate, now)) {
    c.chaosDailySeed = Math.random();
    c.chaosSeedDate = today;
  }

  return c;
}

// ────────────────────────────────────────────────────────────────────────────
//  computeNaturalPassives — пассивные эффекты характера за sync-тик
// ────────────────────────────────────────────────────────────────────────────

export function computeNaturalPassives(
  stats: Record<StatKey, number>,
  personality: PersonalityDefinition,
  _counters: BehavioralCounters,
): Partial<Record<StatKey, number>> {
  const bonuses: Partial<Record<StatKey, number>> = {};

  // Гурман: при hunger > 80 все статы +3
  if (personality.id === 'foodie' && personality.specialRules?.passiveStatBonusWhenFull && stats.hunger > 80) {
    (['happiness', 'energy', 'health', 'cleanliness', 'bond'] as StatKey[]).forEach(s => {
      bonuses[s] = (bonuses[s] ?? 0) + 3;
    });
  }

  // Чистюля: при cleanliness > 85 все статы +10
  if (personality.id === 'pristine' && stats.cleanliness > 85) {
    (['hunger', 'happiness', 'energy', 'health', 'bond'] as StatKey[]).forEach(s => {
      bonuses[s] = (bonuses[s] ?? 0) + 10;
    });
  }
  // Чистюля: при cleanliness < 40 все действия −30% (обрабатывается в applyActionModifiers через flag)

  // Эмпат: при bond > 80 happiness +10
  if (personality.id === 'empath' && stats.bond > 80) {
    bonuses.happiness = (bonuses.happiness ?? 0) + 10;
  }

  // Натуральная регенерация health
  if (personality.naturalHealthRegen > 0 && stats.health < 70) {
    bonuses.health = (bonuses.health ?? 0) + personality.naturalHealthRegen;
  }

  // Нервный: пик-перфоманс XP (сигнал — не стат-бонус, управляется снаружи)

  return bonuses;
}

// ────────────────────────────────────────────────────────────────────────────
//  calcMood — вычислить mood с учётом moodBias характера
// ────────────────────────────────────────────────────────────────────────────

export function calcMoodWithBias(
  stats: Record<StatKey, number>,
  personality: PersonalityDefinition,
  isAsleep: boolean,
): string {
  if (isAsleep) return 'sleeping';
  const { hunger, happiness, energy, health } = stats;
  if (health < 25) return 'sick';
  if (energy < 20) return 'tired';

  // Нервный: при любом стате < 40 → sad
  if (personality.id === 'anxious') {
    const allStats = Object.values(stats) as number[];
    if (allStats.some(v => v < 40)) return 'sad';
  }

  const avg = (hunger + happiness + energy + health) / 4;
  const bias = personality.moodBias;
  if (avg >= bias.ecstaticMinAvg) return 'ecstatic';
  if (avg >= bias.happyMinAvg)    return 'happy';
  if (avg >= bias.contentMinAvg)  return 'content';
  return 'sad';
}

// ────────────────────────────────────────────────────────────────────────────
//  getParanoidRestoreMult — специальный множитель для параноика
// ────────────────────────────────────────────────────────────────────────────

export function getParanoidRestoreMult(counters: BehavioralCounters): number {
  switch (counters.paranoidPhase) {
    case 'untrusted':  return 0.4;
    case 'trusted':    return 1.8;
    case 'collapsed':  return 0.2;
    default: return 1.0;
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  getPeakPerformanceMult — Нервный: все XP/coins ×2.5 при avg > threshold
// ────────────────────────────────────────────────────────────────────────────

export function getPeakPerformanceMult(
  stats: Record<StatKey, number>,
  personality: PersonalityDefinition,
): { xpMult: number; coinMult: number } {
  if (personality.id !== 'anxious' || !personality.specialRules?.peakPerformanceThreshold) {
    return { xpMult: 1.0, coinMult: 1.0 };
  }
  const threshold = personality.specialRules.peakPerformanceThreshold;
  if (avgStats(stats) >= threshold) {
    return { xpMult: 2.5, coinMult: 2.0 };
  }
  return { xpMult: 1.0, coinMult: 1.0 };
}

// ────────────────────────────────────────────────────────────────────────────
//  createDefaultCounters — начальное состояние счётчиков
// ────────────────────────────────────────────────────────────────────────────

export function createDefaultCounters(): BehavioralCounters {
  const now = new Date().toISOString();
  return {
    sessionGapHours: 0,
    lastActionTimestamp: now,
    feedInRedZone7d: 0,
    feedInGreenZone7d: 0,
    forcedSleepCount7d: 0,
    healWhenHealthy7d: 0,
    nightWakeCount7d: 0,
    sessionGapsOver48h_30d: 0,
    filthCrisisCount30d: 0,
    consecutiveLowHealthSyncs: 0,
    consecutiveGoodSyncs: 0,
    consecutiveBadMoodSyncs: 0,
    maxConsecHighPlayDays: 0,
    currentHighPlayDays: 0,
    playCountToday: 0,
    lastDayReset: now.slice(0, 10),
    dailyFoodLog: {},
    uniqueFoodsTried: [],
    totalBondActions: 0,
    sameRoomHours: 0,
    lastEquippedRoomId: 'default',
    lastRoomCheckTs: now,
    paranoidPhase: 'untrusted',
    bondActionsInPhase: 0,
    stoicPeakUsed: false,
    enlightenmentActive: false,
    chaosDailySeed: Math.random(),
    chaosSeedDate: now.slice(0, 10),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  Внутренние вспомогательные функции
// ════════════════════════════════════════════════════════════════════════════

function avgStats(stats: Record<StatKey, number>): number {
  const vals = Object.values(stats) as number[];
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function isNightHour(hour: number, range?: [number, number]): boolean {
  const [start, end] = range ?? [22, 6];
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
}


function getStateXpMult(state: EmergentStateType | null, action: ActionType): number {
  if (!state) return 1.0;
  const def = EMERGENT_STATE_MAP.get(state);
  return def?.modifiedActions.find(m => m.actionType === action)?.xpMultiplier ?? 1.0;
}

function getStateCoinMult(state: EmergentStateType | null, action: ActionType): number {
  if (!state) return 1.0;
  const def = EMERGENT_STATE_MAP.get(state);
  return def?.modifiedActions.find(m => m.actionType === action)?.coinMultiplier ?? 1.0;
}

// Эффекты флагов на restore (аддитивные)
const FLAG_RESTORE_EFFECTS: Partial<Record<BehavioralFlagType, Partial<Record<ActionType, StatAdditives>>>> = {
  food_anxiety: {
    feed: { happiness: 5 },  // еда успокаивает при тревоге
  },
  abandonment_fear: {
    bond: { happiness: -10, bond: 5 }, // первый bond после разлуки болезненный
  },
  overtreated: {
    heal: { health: -10 },  // сниженная эффективность лечения
  },
  night_disruption: {
    sleep: { energy: -10 }, // плохой сон
  },
  play_burnout: {
    play: { happiness: -5 }, // burnout
  },
  trust_bond: {
    feed:  { bond: 2 },
    play:  { bond: 2 },
    bathe: { bond: 2 },
  },
  culinary_explorer: {
    feed: { happiness: 5, health: 3 },
  },
  perfect_balance: {
    // пассивный бонус — обрабатывается в computeNaturalPassives
  },
};

function getFlagXpMult(flags: BehavioralFlag[], action: ActionType): number {
  let mult = 1.0;
  for (const flag of flags) {
    if (flag.type === 'culinary_explorer' && action === 'feed') mult *= 1.1;
    if (flag.type === 'play_burnout'      && action === 'play') mult *= 0.5;
    if (flag.type === 'night_guardian'    && action === 'play') mult *= 1.2;
    if (flag.type === 'perfect_balance')                         mult *= 1.15;
  }
  return mult;
}

function getFlagCoinMult(flags: BehavioralFlag[], action: ActionType): number {
  let mult = 1.0;
  for (const flag of flags) {
    if (flag.type === 'play_burnout' && action === 'play') mult *= 0.7;
  }
  return mult;
}

// Набор флагов, доступных всем характерам (независимо от possibleFlags)
const UNIVERSAL_FLAGS: BehavioralFlagType[] = ['health_neglect', 'abandonment_fear'];
