import type { ActionType, BehavioralFlagType, PersonalityId, StatAdditives, StatKey } from './types';

export interface BaseActionRule {
  statDeltas: Partial<Record<StatKey, number>>;
  xp: number;
  coins: number;
  scoreScaling?: {
    xpMultiplier: number;
    coinMultiplier: number;
    coinFlat: number;
  };
  personalityOverrides?: Partial<Record<PersonalityId, Partial<Record<StatKey, number>>>>;
}

export const BASE_ACTION_RULES: Partial<Record<ActionType, BaseActionRule>> = {
  play: {
    statDeltas: { happiness: 20, energy: -15, bond: 8 },
    xp: 0,
    coins: 0,
    scoreScaling: {
      xpMultiplier: 0.5,
      coinMultiplier: 0.1,
      coinFlat: 2,
    },
  },
  feed: {
    statDeltas: {},
    xp: 8,
    coins: 0,
  },
  bathe: {
    statDeltas: { cleanliness: 40, happiness: 5, health: 5 },
    xp: 12,
    coins: 0,
    personalityOverrides: {
      feral: { happiness: -20 },
    },
  },
  heal: {
    statDeltas: { health: 35, happiness: -5 },
    xp: 18,
    coins: 0,
  },
  bond: {
    statDeltas: { happiness: 15, bond: 20 },
    xp: 6,
    coins: 0,
  },
  use_item: {
    statDeltas: {},
    xp: 0,
    coins: 0,
  },
};

export const FLAG_RESTORE_EFFECTS: Partial<Record<BehavioralFlagType, Partial<Record<ActionType, StatAdditives>>>> = {
  food_anxiety: {
    feed: { happiness: 5 },
  },
  abandonment_fear: {
    bond: { happiness: -10, bond: 5 },
  },
  overtreated: {
    heal: { health: -10 },
  },
  night_disruption: {
    sleep: { energy: -10 },
  },
  play_burnout: {
    play: { happiness: -5 },
  },
  trust_bond: {
    feed: { bond: 2 },
    play: { bond: 2 },
    bathe: { bond: 2 },
  },
  culinary_explorer: {
    feed: { happiness: 5, health: 3 },
  },
};

export function validateActionRules(rules: Partial<Record<ActionType, BaseActionRule>> = BASE_ACTION_RULES): void {
  for (const [action, rule] of Object.entries(rules)) {
    if (!rule) throw new Error(`${action}: action rule is missing`);
    validateStatDeltas(`${action}.statDeltas`, rule.statDeltas);
    if (!Number.isFinite(rule.xp)) throw new Error(`${action}.xp must be finite`);
    if (!Number.isFinite(rule.coins)) throw new Error(`${action}.coins must be finite`);

    if (rule.scoreScaling) {
      if (!Number.isFinite(rule.scoreScaling.xpMultiplier)) throw new Error(`${action}.scoreScaling.xpMultiplier must be finite`);
      if (!Number.isFinite(rule.scoreScaling.coinMultiplier)) throw new Error(`${action}.scoreScaling.coinMultiplier must be finite`);
      if (!Number.isFinite(rule.scoreScaling.coinFlat)) throw new Error(`${action}.scoreScaling.coinFlat must be finite`);
    }

    for (const [personalityId, statDeltas] of Object.entries(rule.personalityOverrides ?? {})) {
      validateStatDeltas(`${action}.personalityOverrides.${personalityId}`, statDeltas);
    }
  }
}

function validateStatDeltas(label: string, statDeltas: Partial<Record<StatKey, number>>): void {
  for (const [stat, value] of Object.entries(statDeltas)) {
    if (!Number.isFinite(value)) throw new Error(`${label}.${stat} must be finite`);
  }
}

