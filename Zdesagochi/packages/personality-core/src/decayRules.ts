import type { BehavioralCounters, PersonalityDefinition, PersonalityId, StatKey, SyncContext } from './types';
import { MODIFIER_CAPS } from './types';

export const BASE_DECAY_PER_MINUTE: Record<StatKey, number> = {
  hunger: 2.0 / 60,
  happiness: 1.5 / 60,
  energy: 1.0 / 60,
  health: 0.5 / 60,
  cleanliness: 1.0 / 60,
  bond: 0.75 / 60,
};

export type DecayRuleCondition =
  | { type: 'personality_is'; personalityId: PersonalityId }
  | { type: 'stat_below'; stat: StatKey; value: number }
  | { type: 'special_rule_enabled'; key: 'nightEnergyDecayDisabled' }
  | { type: 'night_hour' };

export interface DecayRule {
  id: string;
  stat?: StatKey;
  conditions: DecayRuleCondition[];
  multiplier: number;
}

export const DECAY_RULES: DecayRule[] = [
  {
    id: 'empath:low_bond_decay',
    conditions: [
      { type: 'personality_is', personalityId: 'empath' },
      { type: 'stat_below', stat: 'bond', value: 30 },
    ],
    multiplier: 1.3,
  },
  {
    id: 'feral:night_energy_decay_disabled',
    stat: 'energy',
    conditions: [
      { type: 'personality_is', personalityId: 'feral' },
      { type: 'special_rule_enabled', key: 'nightEnergyDecayDisabled' },
      { type: 'night_hour' },
    ],
    multiplier: 0,
  },
];

export function getDecayMultiplier(
  stat: StatKey,
  currentStats: Record<StatKey, number>,
  personality: PersonalityDefinition,
  _counters: BehavioralCounters,
  context: SyncContext,
  rules: DecayRule[] = DECAY_RULES,
): number {
  const multipliers = [personality.decayRates[stat] ?? 1.0];

  for (const rule of rules) {
    if (rule.stat !== undefined && rule.stat !== stat) continue;
    if (!rule.conditions.every(condition => matchesDecayCondition(condition, currentStats, personality, context))) continue;
    multipliers.push(rule.multiplier);
  }

  return clamp(multiplyAll(multipliers), MODIFIER_CAPS.DECAY_MULT_MIN, MODIFIER_CAPS.DECAY_MULT_MAX);
}

export function validateDecayRules(rules: DecayRule[] = DECAY_RULES): void {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) throw new Error(`${rule.id}: duplicate decay rule id`);
    seen.add(rule.id);
    if (rule.conditions.length === 0) throw new Error(`${rule.id}: conditions must not be empty`);
    if (!Number.isFinite(rule.multiplier)) throw new Error(`${rule.id}.multiplier must be finite`);
  }
  for (const [stat, value] of Object.entries(BASE_DECAY_PER_MINUTE)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`BASE_DECAY_PER_MINUTE.${stat} must be finite and >= 0`);
  }
}

function matchesDecayCondition(
  condition: DecayRuleCondition,
  currentStats: Record<StatKey, number>,
  personality: PersonalityDefinition,
  context: SyncContext,
): boolean {
  switch (condition.type) {
    case 'personality_is':
      return personality.id === condition.personalityId;
    case 'stat_below':
      return currentStats[condition.stat] < condition.value;
    case 'special_rule_enabled':
      return Boolean(personality.specialRules?.[condition.key]);
    case 'night_hour':
      return isNightHour(context.clientLocalHour, personality.specialRules?.nighttimeHours);
  }
}

function isNightHour(hour: number, range?: [number, number]): boolean {
  const [start, end] = range ?? [22, 6];
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

function multiplyAll(mults: number[]): number {
  return mults.reduce((acc, mult) => acc * mult, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
