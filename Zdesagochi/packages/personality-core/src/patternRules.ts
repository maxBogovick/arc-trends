import type { PatternCondition, PatternRule } from './types';

// ════════════════════════════════════════════════════════════════════════════
//  PATTERN_RULES — массив правил Pattern Engine.
//  Добавить новое правило = добавить объект сюда. PersonalityEngine не трогать.
//
//  Условия маппируются на BehavioralCounters (lazy evaluation, O(1) per action):
//    action_in_stat_zone     → feedInRedZone7d, feedInGreenZone7d, etc.
//    action_frequency        → maxConsecHighPlayDays, playCountToday
//    stat_below_threshold    → consecutiveLowHealthSyncs, filthCrisisCount30d
//    session_gap_hours       → sessionGapsOver48h_30d, sessionGapHours
//    time_of_day_action      → nightWakeCount7d, nightSingleInteractionDays7d
//    consecutive_syncs_cond  → consecutiveGoodSyncs
//    same_food_ratio         → rolling 7d foodCounts ratio
//    unique_items_used       → uniqueFoodsTried.length
// ════════════════════════════════════════════════════════════════════════════

export const PATTERN_RULES: PatternRule[] = [

  // ══ Негативные флаги — активация ════════════════════════════════════════

  {
    id: 'food_anxiety_activate',
    description: 'Кормили только при hunger < 20 (≥5 раз за 7 дней)',
    conditions: [
      { type: 'action_in_stat_zone', params: { action: 'feed', zone: 'red', threshold: 5 } },
    ],
    effect: { flagType: 'food_anxiety', action: 'activate', severity: 1 },
    severityThresholds: [5, 10, 20],
  },

  {
    id: 'abandonment_fear_activate',
    description: 'Разрыв > 48ч случался ≥3 раза за 30 дней',
    conditions: [
      { type: 'session_gap_hours', params: { threshold: 3 } },
    ],
    effect: { flagType: 'abandonment_fear', action: 'activate', severity: 1 },
    severityThresholds: [3, 6, 10],
  },

  {
    id: 'overtreated_activate',
    description: 'Лечение при health > 90 — ≥5 раз за 7 дней',
    conditions: [
      { type: 'action_in_stat_zone', params: { action: 'heal', zone: 'high', threshold: 5 } },
    ],
    effect: { flagType: 'overtreated', action: 'activate', severity: 1 },
  },

  {
    id: 'night_disruption_activate',
    description: 'Будили в 0–2ч ночи ≥3 раза за 7 дней',
    conditions: [
      { type: 'time_of_day_action', params: { action: 'wake', threshold: 3 } },
    ],
    effect: { flagType: 'night_disruption', action: 'activate', severity: 1 },
  },

  {
    id: 'play_burnout_activate',
    description: '> 8 игр в день ≥3 дня подряд',
    conditions: [
      { type: 'action_frequency', params: { action: 'play', countPerDay: 8, threshold: 3 } },
    ],
    effect: { flagType: 'play_burnout', action: 'activate', severity: 1 },
    severityThresholds: [3, 5, 7],
  },

  {
    id: 'filth_trauma_activate',
    description: 'cleanliness < 10 случалось ≥3 раза за 30 дней',
    conditions: [
      { type: 'stat_below_threshold', params: { statKey: 'cleanliness', threshold: 3 } },
    ],
    effect: { flagType: 'filth_trauma', action: 'activate', severity: 1 },
  },

  {
    id: 'forced_sleep_activate',
    description: 'Укладывали при energy > 70 — ≥5 раз за 7 дней',
    conditions: [
      { type: 'action_in_stat_zone', params: { action: 'sleep', zone: 'high', threshold: 5 } },
    ],
    effect: { flagType: 'forced_sleep', action: 'activate', severity: 1 },
  },

  {
    id: 'health_neglect_activate',
    description: 'health < 20 на протяжении ≥5 синков подряд',
    conditions: [
      { type: 'stat_below_threshold', params: { statKey: 'health', threshold: 5 } },
    ],
    effect: { flagType: 'health_neglect', action: 'activate', severity: 1 },
    severityThresholds: [5, 10, 20],
  },

  {
    id: 'food_monotony_activate',
    description: 'Одна и та же еда > 80% кормлений (мин. 5 кормлений)',
    conditions: [
      { type: 'same_food_ratio', params: { ratio: 0.8, minFeeds: 5 } },
    ],
    effect: { flagType: 'food_monotony', action: 'activate', severity: 1 },
    // Иммунитет у foodie обрабатывается в движке через personalityId: undefined
    // (движок проверяет possibleFlags и personalityId===undefined = universal,
    //  foodie не имеет food_monotony в possibleFlags → правило не применяется)
  },

  // ══ Позитивные флаги — активация ════════════════════════════════════════

  {
    id: 'trust_bond_activate',
    description: '14 дней без критических провалов (avg > 70 каждый sync)',
    conditions: [
      { type: 'consecutive_syncs_cond', params: { minAvg: 70, threshold: 336 } }, // 14d × 24h
    ],
    effect: { flagType: 'trust_bond', action: 'activate', severity: 1 },
  },

  {
    id: 'culinary_explorer_activate',
    description: 'Попробованы все 8 базовых + 3 магазинных блюда (11 уникальных)',
    conditions: [
      { type: 'unique_items_used', params: { minUnique: 11 } },
    ],
    effect: { flagType: 'culinary_explorer', action: 'activate', severity: 1 },
  },

  {
    id: 'perfect_balance_activate',
    description: 'Все статы > 70 одновременно в ≥10 синках подряд',
    conditions: [
      { type: 'consecutive_syncs_cond', params: { allStatsAbove: 70, threshold: 10 } },
    ],
    effect: { flagType: 'perfect_balance', action: 'activate', severity: 1 },
  },

  {
    id: 'night_guardian_activate',
    description: '7 ночей подряд — ровно одно взаимодействие за ночь',
    conditions: [
      { type: 'time_of_day_action', params: { action: 'night_single', threshold: 7 } },
    ],
    effect: { flagType: 'night_guardian', action: 'activate', severity: 1 },
  },

  // ══ Деактивация позитивных флагов при деградации ════════════════════════

  {
    id: 'trust_bond_deactivate',
    description: 'Снять trust_bond если серия хороших синков прервалась',
    conditions: [
      {
        type: 'consecutive_syncs_cond',
        params: { minAvg: 70, threshold: 336 },
        op: '<',
      },
    ],
    effect: { flagType: 'trust_bond', action: 'deactivate' },
  },

  // ══ Лечение негативных флагов ════════════════════════════════════════════

  {
    id: 'food_anxiety_heal',
    description: 'Кормление при hunger > 60 лечит food_anxiety (+15 за кормление)',
    conditions: [
      { type: 'action_in_stat_zone', params: { action: 'feed', zone: 'green', threshold: 1 } },
    ],
    effect: { flagType: 'food_anxiety', action: 'add_heal_progress', healProgressDelta: 15 },
  },

  {
    id: 'health_neglect_heal',
    description: 'health_neglect лечится когда health держится выше 20',
    conditions: [
      {
        type: 'stat_below_threshold',
        params: { statKey: 'health', threshold: 1 },
        op: '<',
      },
    ],
    effect: { flagType: 'health_neglect', action: 'add_heal_progress', healProgressDelta: 20 },
  },

  {
    id: 'abandonment_fear_heal',
    description: 'abandonment_fear лечится при регулярных коротких сессиях',
    conditions: [
      { type: 'session_gap_hours', params: { threshold: 24 }, op: '<' },
    ],
    effect: { flagType: 'abandonment_fear', action: 'add_heal_progress', healProgressDelta: 5 },
  },

  {
    id: 'forced_sleep_heal',
    description: 'forced_sleep лечится когда прекратили укладывать принудительно',
    conditions: [
      {
        type: 'action_in_stat_zone',
        params: { action: 'sleep', zone: 'high', threshold: 1 },
        op: '<',
      },
    ],
    effect: { flagType: 'forced_sleep', action: 'add_heal_progress', healProgressDelta: 25 },
  },
];

export function validatePatternRules(rules: PatternRule[] = PATTERN_RULES): void {
  const ids = new Set<string>();

  for (const rule of rules) {
    if (ids.has(rule.id)) throw new Error(`${rule.id}: duplicate PatternRule id`);
    ids.add(rule.id);

    if (rule.conditions.length === 0) throw new Error(`${rule.id}: conditions must not be empty`);
    for (const condition of rule.conditions) validatePatternCondition(rule.id, condition);

    if (rule.severityThresholds) {
      const [low, medium, high] = rule.severityThresholds;
      if (!(low <= medium && medium <= high)) {
        throw new Error(`${rule.id}: severityThresholds must be ascending`);
      }
    }
  }
}

function validatePatternCondition(ruleId: string, condition: PatternCondition): void {
  const params = condition.params;

  switch (condition.type) {
    case 'action_in_stat_zone':
      if (!isOneOf(params.action, ['feed', 'sleep', 'heal'])) {
        throw new Error(`${ruleId}: action_in_stat_zone.action is unsupported`);
      }
      if (!isOneOf(params.zone, ['red', 'green', 'high'])) {
        throw new Error(`${ruleId}: action_in_stat_zone.zone is unsupported`);
      }
      requireNumber(ruleId, params.threshold, 'threshold');
      return;
    case 'action_frequency':
      if (params.action !== 'play') throw new Error(`${ruleId}: action_frequency.action is unsupported`);
      requireNumber(ruleId, params.threshold, 'threshold');
      requireNumber(ruleId, params.countPerDay, 'countPerDay');
      return;
    case 'stat_below_threshold':
      if (!isOneOf(params.statKey, ['health', 'cleanliness'])) {
        throw new Error(`${ruleId}: stat_below_threshold.statKey is unsupported`);
      }
      requireNumber(ruleId, params.threshold, 'threshold');
      return;
    case 'session_gap_hours':
      requireNumber(ruleId, params.threshold, 'threshold');
      return;
    case 'time_of_day_action':
      if (!isOneOf(params.action, ['wake', 'night_single'])) {
        throw new Error(`${ruleId}: time_of_day_action.action is unsupported`);
      }
      requireNumber(ruleId, params.threshold, 'threshold');
      return;
    case 'consecutive_syncs_cond':
      requireNumber(ruleId, params.threshold, 'threshold');
      if (params.allStatsAbove !== undefined) requireNumber(ruleId, params.allStatsAbove, 'allStatsAbove');
      return;
    case 'same_food_ratio':
      requireNumber(ruleId, params.ratio, 'ratio');
      requireNumber(ruleId, params.minFeeds, 'minFeeds');
      return;
    case 'unique_items_used':
      requireNumber(ruleId, params.minUnique, 'minUnique');
      return;
  }
}

function isOneOf(value: unknown, allowed: string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

function requireNumber(ruleId: string, value: unknown, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${ruleId}: ${field} must be a finite number`);
  }
}
