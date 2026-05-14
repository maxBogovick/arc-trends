import type { PersonalityDefinition, PersonalityId, StatKey } from './types';

export type PassiveRuleCondition =
  | { type: 'personality_is'; personalityId: PersonalityId }
  | { type: 'special_rule_enabled'; key: 'passiveStatBonusWhenFull' }
  | { type: 'stat_above'; stat: StatKey; value: number }
  | { type: 'stat_below'; stat: StatKey; value: number }
  | { type: 'personality_field_above'; field: 'naturalHealthRegen'; value: number };

export interface PassiveRule {
  id: string;
  conditions: PassiveRuleCondition[];
  statDeltas: Partial<Record<StatKey, number>>;
  statDeltasFromPersonality?: Partial<Record<StatKey, 'naturalHealthRegen'>>;
}

export const PASSIVE_RULES: PassiveRule[] = [
  {
    id: 'foodie:full_bonus',
    conditions: [
      { type: 'personality_is', personalityId: 'foodie' },
      { type: 'special_rule_enabled', key: 'passiveStatBonusWhenFull' },
      { type: 'stat_above', stat: 'hunger', value: 80 },
    ],
    statDeltas: { happiness: 3, energy: 3, health: 3, cleanliness: 3, bond: 3 },
  },
  {
    id: 'pristine:clean_bonus',
    conditions: [
      { type: 'personality_is', personalityId: 'pristine' },
      { type: 'stat_above', stat: 'cleanliness', value: 85 },
    ],
    statDeltas: { hunger: 10, happiness: 10, energy: 10, health: 10, bond: 10 },
  },
  {
    id: 'empath:bond_happiness',
    conditions: [
      { type: 'personality_is', personalityId: 'empath' },
      { type: 'stat_above', stat: 'bond', value: 80 },
    ],
    statDeltas: { happiness: 10 },
  },
  {
    id: 'personality:natural_health_regen',
    conditions: [
      { type: 'personality_field_above', field: 'naturalHealthRegen', value: 0 },
      { type: 'stat_below', stat: 'health', value: 70 },
    ],
    statDeltas: {},
    statDeltasFromPersonality: { health: 'naturalHealthRegen' },
  },
];

export function applyPassiveRules(
  stats: Record<StatKey, number>,
  personality: PersonalityDefinition,
  rules: PassiveRule[] = PASSIVE_RULES,
): Partial<Record<StatKey, number>> {
  const bonuses: Partial<Record<StatKey, number>> = {};

  for (const rule of rules) {
    if (!rule.conditions.every(condition => matchesPassiveCondition(condition, stats, personality))) continue;
    for (const [stat, value] of Object.entries(rule.statDeltas)) {
      const key = stat as StatKey;
      bonuses[key] = (bonuses[key] ?? 0) + (value ?? 0);
    }
    for (const [stat, field] of Object.entries(rule.statDeltasFromPersonality ?? {})) {
      const key = stat as StatKey;
      bonuses[key] = (bonuses[key] ?? 0) + personality[field as 'naturalHealthRegen'];
    }
  }

  return bonuses;
}

export function validatePassiveRules(rules: PassiveRule[] = PASSIVE_RULES): void {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) throw new Error(`${rule.id}: duplicate passive rule id`);
    seen.add(rule.id);
    if (rule.conditions.length === 0) throw new Error(`${rule.id}: conditions must not be empty`);
    for (const [stat, value] of Object.entries(rule.statDeltas)) {
      if (!Number.isFinite(value)) throw new Error(`${rule.id}.statDeltas.${stat} must be finite`);
    }
  }
}

function matchesPassiveCondition(
  condition: PassiveRuleCondition,
  stats: Record<StatKey, number>,
  personality: PersonalityDefinition,
): boolean {
  switch (condition.type) {
    case 'personality_is':
      return personality.id === condition.personalityId;
    case 'special_rule_enabled':
      return Boolean(personality.specialRules?.[condition.key]);
    case 'stat_above':
      return stats[condition.stat] > condition.value;
    case 'stat_below':
      return stats[condition.stat] < condition.value;
    case 'personality_field_above':
      return personality[condition.field] > condition.value;
  }
}

