import type {
  PersonalityDefinition,
  StatKey, ActionType,
  BehavioralFlag, BehavioralFlagType,
  BehavioralCounters, ConditionOp, PatternCondition,
  EmergentStateType, BlockedAction,
  ActionContext, SyncContext, PersonalityRuntimeContext, RollingCounterKey, RollingDailyBucket,
} from './types';
import { MODIFIER_CAPS } from './types';
import { EMERGENT_STATE_MAP } from './emergentStates';
import { applyGameplayStateEnterEffects, getGameplayStateCandidates } from './gameplayStateRules';
import { PATTERN_RULES } from './patternRules';
import { seededRandom } from './random';
import { FLAG_RESTORE_EFFECTS } from './actionRules';
import { applyPassiveRules } from './passiveRules';
import { BASE_DECAY_PER_MINUTE, getDecayMultiplier } from './decayRules';

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

// Flat XP за игру при flat-режиме (stoic)
const STOIC_FLAT_PLAY_XP = 15;
const ROLLING_WINDOW_DAYS = 30;
const HIGH_PLAY_THRESHOLD = 8;
const FEAST_FRENZY_FEED_WINDOW_MS = 60 * 60 * 1000;

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

function getChaosMultipliers(counters: BehavioralCounters, context: PersonalityRuntimeContext = {}): {
  decayMult: number; restoreMult: number; xpMult: number; coinMult: number; negResist: number;
} {
  const now = getContextNow(context).toISOString();
  const seed = isDifferentDay(counters.chaosSeedDate, now)
    ? Math.floor(getContextRng(context)() * 1e9)
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

  // Хаотик: рандомные модификаторы из суточного seed (data-driven: randomizeDailySeed)
  const chaosMult = personality.specialRules?.randomizeDailySeed
    ? getChaosMultipliers(counters, context).decayMult
    : 1.0;

  for (const stat of keys) {
    const base = BASE_DECAY_PER_MINUTE[stat] * elapsedMinutes;
    const totalMult = clamp(
      getDecayMultiplier(stat, currentStats, personality, counters, context) * chaosMult,
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
  emergentState: EmergentStateType | EmergentStateType[] | null,
  counters: BehavioralCounters,
  context: ActionContext,
): ActionResult {
  const result: ActionResult = {
    statDeltas: { ...base.statDeltas },
    xp: base.xp,
    coins: base.coins,
  };

  const chaos = personality.specialRules?.randomizeDailySeed ? getChaosMultipliers(counters, context) : null;

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

  const activeStates = normalizeEmergentStates(emergentState);

  // ── 4. Эмерджентные состояния: аддитивные модификаторы ────────────────────
  for (const state of activeStates) {
    const stateDef = EMERGENT_STATE_MAP.get(state);
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
    getStateXpMult(activeStates, action),
    getFlagXpMult(flags, action),
  ];

  // Стоик: XP от игры всегда фиксированный
  if (personality.specialRules?.flatXpFromPlay && action === 'play') {
    result.xp = STOIC_FLAT_PLAY_XP;
  } else {
    // Нервный: пиковое состояние — XP бонус (data-driven: peakPerformanceThreshold)
    // Пиковый бонус применяется в computeNaturalPassives — здесь только mult
    const xpBase = result.xp;
    result.xp = Math.round(xpBase * clamp(multiplyAll(xpMults), MODIFIER_CAPS.XP_MIN, MODIFIER_CAPS.XP_MAX));
  }

  // ── 7. Coin мультипликаторы ───────────────────────────────────────────────
  const coinMults: number[] = [
    personality.coinMultipliers[action] ?? 1.0,
    chaos?.coinMult ?? 1.0,
    getStateCoinMult(activeStates, action),
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
  emergentState: EmergentStateType | EmergentStateType[] | null,
): BlockedAction | null {
  const states = normalizeEmergentStates(emergentState);
  for (const state of states) {
    const def = EMERGENT_STATE_MAP.get(state);
    const blocked = def?.blockedActions.find(b => b.actionType === action);
    if (blocked) return blocked;
  }
  return null;
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
  const ruleContext = {
    stats,
    personality,
    flags,
    counters,
    syncContext: context,
    currentState,
    enteredAt,
    now: getContextNow(context),
    avgStats: avgStats(stats),
  };
  const candidates = getGameplayStateCandidates(ruleContext);

  if (candidates.length === 0) return null;

  // Победитель — с наименьшим priority числом (1 = наивысший)
  candidates.sort((a, b) => a.priority - b.priority || a.type.localeCompare(b.type));
  const winner = candidates[0].type;
  applyGameplayStateEnterEffects(winner, ruleContext);
  return winner;
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
  context: PersonalityRuntimeContext = {},
): BehavioralFlag[] {
  normalizeRollingCounters(counters, getContextNow(context));
  let flags = [...currentFlags];
  const now = getContextNow(context).toISOString();

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
    if (!rule.conditions.every(cond => evalCondition(cond, counters, getContextNow(context)))) continue;

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

function evalCondition(cond: PatternCondition, c: BehavioralCounters, now = getContextNow({})): boolean {
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
      const { action, threshold } = cond.params as Record<string, string | number>;
      const value = action === 'night_single'
        ? c.nightSingleInteractionDays7d ?? 0
        : c.nightWakeCount7d;
      return compare(value, Number(threshold), op);
    }
    case 'consecutive_syncs_cond': {
      const { threshold, allStatsAbove } = cond.params as Record<string, number>;
      if (allStatsAbove !== undefined) {
        const stats = c.lastStatsSnapshot ?? {};
        const keys: StatKey[] = ['hunger', 'happiness', 'energy', 'health', 'cleanliness', 'bond'];
        if (!keys.every(stat => (stats[stat] ?? -Infinity) > allStatsAbove)) return false;
      }
      return compare(c.consecutiveGoodSyncs, threshold, op);
    }
    case 'same_food_ratio': {
      const { ratio, minFeeds = 5 } = cond.params as Record<string, number>;
      const rollingFoodLog = rollingFoodCounts(c, 7, now);
      const totalFeeds = Object.values(rollingFoodLog).reduce((a, b) => a + b, 0);
      if (totalFeeds < minFeeds) return false;
      const maxCount = Math.max(...Object.values(rollingFoodLog), 0);
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
  personality?: PersonalityDefinition,
): BehavioralCounters {
  const c = normalizeRollingCounters(cloneCounters(counters), getContextNow(context));
  const now = getContextNow(context).toISOString();
  const today = now.slice(0, 10);
  c.lastStatsSnapshot = { ...stats };
  c.recentFeedTimestamps = pruneRecentFeeds(c.recentFeedTimestamps ?? [], new Date(now).getTime());

  // Сессия: gap
  c.sessionGapHours = context.clientLocalHour >= 0
    ? (new Date(now).getTime() - new Date(c.lastActionTimestamp).getTime()) / 3600000
    : 0;
  c.lastActionTimestamp = now;

  if (c.sessionGapHours >= 48) {
    incrementRollingCounter(c, today, 'session_gap_48h');
  }

  if (action !== 'sync' && context.clientLocalHour >= 0 && context.clientLocalHour <= 5) {
    incrementRollingCounter(c, today, 'night_interaction');
  }

  // Сброс дневных счётчиков в новый день
  if (c.lastDayReset !== today) {
    c.playCountToday = 0;
    c.dailyFoodLog = {};
    c.dailyItemAddLog = {};
    c.dailyItemUseLog = {};
    c.lastDayReset = today;
  }

  // Специфичные для действий
  if (action === 'feed') {
    c.recentFeedTimestamps = [...(c.recentFeedTimestamps ?? []), now];
    if (context.foodId) {
      c.dailyFoodLog = { ...c.dailyFoodLog, [context.foodId]: (c.dailyFoodLog[context.foodId] ?? 0) + 1 };
      incrementRollingFood(c, today, context.foodId);
      if (!c.uniqueFoodsTried.includes(context.foodId)) {
        c.uniqueFoodsTried = [...c.uniqueFoodsTried, context.foodId];
      }
    }
    if (stats.hunger < 20) incrementRollingCounter(c, today, 'feed_red');
    if (stats.hunger > 60) incrementRollingCounter(c, today, 'feed_green');
  }

  if (action === 'play') {
    c.playCountToday++;
    incrementRollingCounter(c, today, 'play');
  }

  if ((action === 'add_item' || action === 'use_item') && context.itemId) {
    const uniqueKey = action === 'add_item' ? 'uniqueItemsAdded' : 'uniqueItemsUsed';
    const logKey = action === 'add_item' ? 'dailyItemAddLog' : 'dailyItemUseLog';
    c[uniqueKey] ??= [];
    c[logKey] ??= {};
    c[logKey] = { ...c[logKey], [context.itemId]: (c[logKey]?.[context.itemId] ?? 0) + 1 };
    if (!c[uniqueKey].includes(context.itemId)) {
      c[uniqueKey] = [...c[uniqueKey], context.itemId];
    }
    incrementRollingCounter(c, today, action === 'add_item' ? 'item_add' : 'item_use');
    incrementRollingItem(c, today, context.itemId, action === 'add_item' ? 'add' : 'use');
  }

  if (action === 'sleep' && stats.energy > 70) incrementRollingCounter(c, today, 'sleep_forced');
  if (action === 'wake') {
    // Упрощённо: считаем за ночное пробуждение если час 0–2
    if (context.clientLocalHour >= 0 && context.clientLocalHour <= 2) incrementRollingCounter(c, today, 'night_wake');
  }
  if (action === 'heal' && stats.health > 90) incrementRollingCounter(c, today, 'heal_healthy');
  if (action === 'bond') {
    c.totalBondActions++;
    c.bondActionsInPhase++;
  }

  // filth crisis
  if (stats.cleanliness < 10 && action === 'sync') incrementRollingCounter(c, today, 'filth_crisis');

  // health neglect streak
  if (stats.health < 20 && action === 'sync') {
    c.consecutiveLowHealthSyncs++;
  } else if (action === 'heal' || (action === 'sync' && stats.health >= 20)) {
    c.consecutiveLowHealthSyncs = 0;
  }

  // bad mood streak
  // обновляется вызывающим кодом с текущим mood

  // Параноик: смена фазы
  const trustThreshold = personality?.specialRules?.trustThresholdBonds ?? 10;
  if (c.paranoidPhase === 'untrusted' && c.bondActionsInPhase >= trustThreshold) {
    c.paranoidPhase = 'trusted';
    c.bondActionsInPhase = 0;
    c.trustedSince = now;
  }
  if (c.paranoidPhase === 'trusted' && c.sessionGapHours >= 24) {
    c.paranoidPhase = 'collapsed';
  }
  if (c.paranoidPhase === 'collapsed' && c.bondActionsInPhase >= trustThreshold * 2) {
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
    c.chaosDailySeed = getContextRng(context)();
    c.chaosSeedDate = today;
  }

  materializeRollingCounters(c, getContextNow(context));
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
  return applyPassiveRules(stats, personality);
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

  // Нервный: при любом стате ниже anxiousStatSadThreshold → sad (data-driven)
  if (personality.specialRules?.anxiousStatSadThreshold !== undefined) {
    const threshold = personality.specialRules.anxiousStatSadThreshold;
    const allStats = Object.values(stats) as number[];
    if (allStats.some(v => v < threshold)) return 'sad';
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
  // Data-driven: peakPerformanceThreshold in specialRules (no personality.id check needed)
  if (!personality.specialRules?.peakPerformanceThreshold) {
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

export function createDefaultCounters(context: PersonalityRuntimeContext = {}): BehavioralCounters {
  const now = getContextNow(context).toISOString();
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
    nightSingleInteractionDays7d: 0,
    lastStatsSnapshot: {},
    playCountToday: 0,
    lastDayReset: now.slice(0, 10),
    dailyFoodLog: {},
    dailyItemAddLog: {},
    dailyItemUseLog: {},
    recentFeedTimestamps: [],
    uniqueFoodsTried: [],
    uniqueItemsAdded: [],
    uniqueItemsUsed: [],
    itemAdds7d: 0,
    itemUses7d: 0,
    repeatedItemUse7d: 0,
    totalBondActions: 0,
    sameRoomHours: 0,
    lastEquippedRoomId: 'default',
    lastRoomCheckTs: now,
    paranoidPhase: 'untrusted',
    bondActionsInPhase: 0,
    stoicPeakUsed: false,
    enlightenmentActive: false,
    chaosDailySeed: getContextRng(context)(),
    chaosSeedDate: now.slice(0, 10),
    melancholicActionCount: 0,
    rollingWindows: { dailyBuckets: [] },
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  Внутренние вспомогательные функции
// ════════════════════════════════════════════════════════════════════════════

function avgStats(stats: Record<StatKey, number>): number {
  const vals = Object.values(stats) as number[];
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getContextNow(context: PersonalityRuntimeContext): Date {
  return context.now ?? new Date();
}

function getContextRng(context: PersonalityRuntimeContext): () => number {
  return context.rng ?? Math.random;
}

function normalizeRollingCounters(counters: BehavioralCounters, now: Date): BehavioralCounters {
  if (!counters.rollingWindows) {
    counters.rollingWindows = { dailyBuckets: [] };
    seedRollingBucketsFromLegacyCounters(counters, now);
  }

  counters.rollingWindows.dailyBuckets = pruneDailyBuckets(counters.rollingWindows.dailyBuckets, now);
  materializeRollingCounters(counters, now);
  return counters;
}

function cloneCounters(counters: BehavioralCounters): BehavioralCounters {
  return {
    ...counters,
    dailyFoodLog: { ...counters.dailyFoodLog },
    recentFeedTimestamps: [...(counters.recentFeedTimestamps ?? [])],
    lastStatsSnapshot: { ...(counters.lastStatsSnapshot ?? {}) },
    uniqueFoodsTried: [...counters.uniqueFoodsTried],
    uniqueItemsAdded: [...(counters.uniqueItemsAdded ?? [])],
    uniqueItemsUsed: [...(counters.uniqueItemsUsed ?? [])],
    dailyItemAddLog: { ...(counters.dailyItemAddLog ?? {}) },
    dailyItemUseLog: { ...(counters.dailyItemUseLog ?? {}) },
    rollingWindows: counters.rollingWindows
      ? {
          dailyBuckets: counters.rollingWindows.dailyBuckets.map(bucket => ({
            date: bucket.date,
            counts: { ...bucket.counts },
            foodCounts: bucket.foodCounts ? { ...bucket.foodCounts } : undefined,
            itemAddCounts: bucket.itemAddCounts ? { ...bucket.itemAddCounts } : undefined,
            itemUseCounts: bucket.itemUseCounts ? { ...bucket.itemUseCounts } : undefined,
          })),
        }
      : undefined,
  };
}

function seedRollingBucketsFromLegacyCounters(counters: BehavioralCounters, now: Date): void {
  const counts: Partial<Record<RollingCounterKey, number>> = {};
  if (counters.feedInRedZone7d > 0) counts.feed_red = counters.feedInRedZone7d;
  if (counters.feedInGreenZone7d > 0) counts.feed_green = counters.feedInGreenZone7d;
  if (counters.forcedSleepCount7d > 0) counts.sleep_forced = counters.forcedSleepCount7d;
  if (counters.healWhenHealthy7d > 0) counts.heal_healthy = counters.healWhenHealthy7d;
  if (counters.nightWakeCount7d > 0) counts.night_wake = counters.nightWakeCount7d;
  if (counters.sessionGapsOver48h_30d > 0) counts.session_gap_48h = counters.sessionGapsOver48h_30d;
  if (counters.filthCrisisCount30d > 0) counts.filth_crisis = counters.filthCrisisCount30d;
  if ((counters.nightSingleInteractionDays7d ?? 0) > 0) {
    counts.night_interaction = counters.nightSingleInteractionDays7d;
  }
  if (counters.playCountToday > 0) counts.play = counters.playCountToday;

  if (Object.keys(counts).length === 0) return;
  counters.rollingWindows = {
    dailyBuckets: [{
      date: toDateOnly(now),
      counts,
    }],
  };
}

function incrementRollingCounter(counters: BehavioralCounters, date: string, key: RollingCounterKey, amount = 1): void {
  counters.rollingWindows ??= { dailyBuckets: [] };
  let bucket = counters.rollingWindows.dailyBuckets.find(entry => entry.date === date);
  if (!bucket) {
    bucket = { date, counts: {} };
    counters.rollingWindows.dailyBuckets.push(bucket);
  }

  bucket.counts[key] = (bucket.counts[key] ?? 0) + amount;
}

function incrementRollingFood(counters: BehavioralCounters, date: string, foodId: string): void {
  counters.rollingWindows ??= { dailyBuckets: [] };
  let bucket = counters.rollingWindows.dailyBuckets.find(entry => entry.date === date);
  if (!bucket) {
    bucket = { date, counts: {}, foodCounts: {} };
    counters.rollingWindows.dailyBuckets.push(bucket);
  }

  bucket.foodCounts ??= {};
  bucket.foodCounts[foodId] = (bucket.foodCounts[foodId] ?? 0) + 1;
}

function incrementRollingItem(counters: BehavioralCounters, date: string, itemId: string, mode: 'add' | 'use'): void {
  counters.rollingWindows ??= { dailyBuckets: [] };
  let bucket = counters.rollingWindows.dailyBuckets.find(entry => entry.date === date);
  if (!bucket) {
    bucket = { date, counts: {} };
    counters.rollingWindows.dailyBuckets.push(bucket);
  }

  const key = mode === 'add' ? 'itemAddCounts' : 'itemUseCounts';
  bucket[key] ??= {};
  bucket[key][itemId] = (bucket[key][itemId] ?? 0) + 1;
}

function materializeRollingCounters(counters: BehavioralCounters, now: Date): void {
  counters.rollingWindows ??= { dailyBuckets: [] };
  counters.rollingWindows.dailyBuckets = pruneDailyBuckets(counters.rollingWindows.dailyBuckets, now);

  counters.feedInRedZone7d = rollingCount(counters, 'feed_red', 7, now);
  counters.feedInGreenZone7d = rollingCount(counters, 'feed_green', 7, now);
  counters.forcedSleepCount7d = rollingCount(counters, 'sleep_forced', 7, now);
  counters.healWhenHealthy7d = rollingCount(counters, 'heal_healthy', 7, now);
  counters.nightWakeCount7d = rollingCount(counters, 'night_wake', 7, now);
  counters.sessionGapsOver48h_30d = rollingCount(counters, 'session_gap_48h', 30, now);
  counters.filthCrisisCount30d = rollingCount(counters, 'filth_crisis', 30, now);
  counters.currentHighPlayDays = consecutiveHighPlayDays(counters, now);
  counters.maxConsecHighPlayDays = maxHighPlayStreak(counters, now);
  counters.nightSingleInteractionDays7d = consecutiveSingleNightInteractionDays(counters, now);
  counters.itemAdds7d = rollingCount(counters, 'item_add', 7, now);
  counters.itemUses7d = rollingCount(counters, 'item_use', 7, now);
  counters.repeatedItemUse7d = Math.max(0, ...Object.values(rollingItemCounts(counters, 'use', 7, now)));
}

function rollingCount(counters: BehavioralCounters, key: RollingCounterKey, days: number, now: Date): number {
  const today = toDateOnly(now);
  return (counters.rollingWindows?.dailyBuckets ?? [])
    .filter(bucket => daysBetween(bucket.date, today) < days)
    .reduce((sum, bucket) => sum + (bucket.counts[key] ?? 0), 0);
}

function pruneDailyBuckets(buckets: RollingDailyBucket[], now: Date): RollingDailyBucket[] {
  const today = toDateOnly(now);
  return buckets.filter(bucket => daysBetween(bucket.date, today) < ROLLING_WINDOW_DAYS);
}

function consecutiveHighPlayDays(counters: BehavioralCounters, now: Date): number {
  const byDate = new Map((counters.rollingWindows?.dailyBuckets ?? []).map(bucket => [bucket.date, bucket]));
  let streak = 0;
  let cursor = toDateOnly(now);

  while ((byDate.get(cursor)?.counts.play ?? 0) > HIGH_PLAY_THRESHOLD) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}

function maxHighPlayStreak(counters: BehavioralCounters, now: Date): number {
  const today = toDateOnly(now);
  const days = Array.from({ length: 7 }, (_, idx) => shiftDate(today, -idx)).reverse();
  const byDate = new Map((counters.rollingWindows?.dailyBuckets ?? []).map(bucket => [bucket.date, bucket]));
  let best = 0;
  let current = 0;

  for (const date of days) {
    if ((byDate.get(date)?.counts.play ?? 0) > HIGH_PLAY_THRESHOLD) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

function consecutiveSingleNightInteractionDays(counters: BehavioralCounters, now: Date): number {
  const byDate = new Map((counters.rollingWindows?.dailyBuckets ?? []).map(bucket => [bucket.date, bucket]));
  let streak = 0;
  let cursor = toDateOnly(now);

  while ((byDate.get(cursor)?.counts.night_interaction ?? 0) === 1) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}

function rollingFoodCounts(counters: BehavioralCounters, days: number, now: Date): Record<string, number> {
  const buckets = counters.rollingWindows?.dailyBuckets ?? [];
  const currentDate = toDateOnly(now);
  const result: Record<string, number> = {};

  for (const bucket of buckets) {
    if (daysBetween(bucket.date, currentDate) >= days) continue;
    for (const [foodId, count] of Object.entries(bucket.foodCounts ?? {})) {
      result[foodId] = (result[foodId] ?? 0) + count;
    }
  }

  return result;
}

export function rollingItemCounts(counters: BehavioralCounters, mode: 'add' | 'use' | 'both', days: number, now: Date): Record<string, number> {
  const buckets = counters.rollingWindows?.dailyBuckets ?? [];
  const currentDate = toDateOnly(now);
  const result: Record<string, number> = {};

  for (const bucket of buckets) {
    if (daysBetween(bucket.date, currentDate) >= days) continue;
    const sources = [
      mode !== 'use' ? bucket.itemAddCounts : undefined,
      mode !== 'add' ? bucket.itemUseCounts : undefined,
    ];
    for (const source of sources) {
      for (const [itemId, count] of Object.entries(source ?? {})) {
        result[itemId] = (result[itemId] ?? 0) + count;
      }
    }
  }

  return result;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date: string, deltaDays: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + deltaDays);
  return toDateOnly(shifted);
}

function daysBetween(date: string, today: string): number {
  const start = new Date(`${date}T00:00:00.000Z`).getTime();
  const end = new Date(`${today}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / 86_400_000);
}

function normalizeEmergentStates(state: EmergentStateType | EmergentStateType[] | null): EmergentStateType[] {
  if (!state) return [];
  const states = Array.isArray(state) ? state : [state];
  return [...new Set(states)].sort((a, b) => getStatePriority(a) - getStatePriority(b));
}

function getStateXpMult(states: EmergentStateType[], action: ActionType): number {
  return states.reduce((mult, state) => {
    const def = EMERGENT_STATE_MAP.get(state);
    return mult * (def?.modifiedActions.find(m => m.actionType === action)?.xpMultiplier ?? 1.0);
  }, 1.0);
}

function getStateCoinMult(states: EmergentStateType[], action: ActionType): number {
  return states.reduce((mult, state) => {
    const def = EMERGENT_STATE_MAP.get(state);
    return mult * (def?.modifiedActions.find(m => m.actionType === action)?.coinMultiplier ?? 1.0);
  }, 1.0);
}

function getStatePriority(state: EmergentStateType): number {
  return EMERGENT_STATE_MAP.get(state)?.priority ?? 999;
}

function pruneRecentFeeds(timestamps: string[], nowMs: number): string[] {
  return timestamps.filter(timestamp => nowMs - new Date(timestamp).getTime() <= FEAST_FRENZY_FEED_WINDOW_MS);
}

function getFlagXpMult(flags: BehavioralFlag[], action: ActionType): number {
  let mult = 1.0;
  for (const flag of flags) {
    if (flag.type === 'culinary_explorer' && action === 'feed') mult *= 1.1;
    if (flag.type === 'play_burnout'      && action === 'play') mult *= 0.5;
    if (flag.type === 'night_guardian'    && action === 'play') mult *= 1.2;
    // perfect_balance пока только XP-бонус; stat passive намеренно нет.
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
