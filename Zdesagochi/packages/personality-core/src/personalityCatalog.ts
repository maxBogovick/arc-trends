export const PERSONALITY_IDS = [
  'playful',
  'drowsy',
  'foodie',
  'bold',
  'zen',
  'anxious',
  'feral',
  'sage',
  'pristine',
  'empath',
  'greedy',
  'melancholic',
  'chaotic',
  'stoic',
  'adventurer',
  'paranoid',
  'curious',
] as const;

export const PERSONALITY_TRAIT_HOMES = {
  playful: {
    position: { vitality: 90, sociality: 60, order: 20, appetite: 40, caution: 20, curiosity: 60 },
    radiusBase: 25,
  },
  drowsy: {
    position: { vitality: 10, sociality: 40, order: 55, appetite: 35, caution: 40, curiosity: 15 },
    radiusBase: 25,
  },
  foodie: {
    position: { vitality: 55, sociality: 50, order: 50, appetite: 95, caution: 30, curiosity: 45 },
    radiusBase: 25,
  },
  bold: {
    position: { vitality: 80, sociality: 40, order: 35, appetite: 45, caution: 5, curiosity: 55 },
    radiusBase: 22,
  },
  zen: {
    position: { vitality: 30, sociality: 75, order: 85, appetite: 30, caution: 25, curiosity: 45 },
    radiusBase: 22,
  },
  anxious: {
    position: { vitality: 60, sociality: 50, order: 40, appetite: 55, caution: 90, curiosity: 50 },
    radiusBase: 22,
  },
  feral: {
    position: { vitality: 75, sociality: 10, order: 15, appetite: 60, caution: 15, curiosity: 55 },
    radiusBase: 20,
  },
  sage: {
    position: { vitality: 35, sociality: 65, order: 70, appetite: 40, caution: 45, curiosity: 90 },
    radiusBase: 22,
  },
  pristine: {
    position: { vitality: 50, sociality: 55, order: 80, appetite: 40, caution: 65, curiosity: 40 },
    radiusBase: 22,
  },
  empath: {
    position: { vitality: 45, sociality: 95, order: 55, appetite: 40, caution: 55, curiosity: 50 },
    radiusBase: 20,
  },
  greedy: {
    position: { vitality: 70, sociality: 30, order: 55, appetite: 85, caution: 35, curiosity: 60 },
    radiusBase: 20,
  },
  melancholic: {
    position: { vitality: 20, sociality: 55, order: 60, appetite: 35, caution: 60, curiosity: 65 },
    radiusBase: 22,
  },
  chaotic: {
    position: { vitality: 70, sociality: 40, order: 5, appetite: 50, caution: 20, curiosity: 80 },
    radiusBase: 20,
  },
  stoic: {
    position: { vitality: 15, sociality: 35, order: 95, appetite: 20, caution: 30, curiosity: 20 },
    radiusBase: 22,
  },
  adventurer: {
    position: { vitality: 75, sociality: 55, order: 25, appetite: 45, caution: 10, curiosity: 95 },
    radiusBase: 20,
  },
  paranoid: {
    position: { vitality: 40, sociality: 20, order: 65, appetite: 35, caution: 95, curiosity: 55 },
    radiusBase: 18,
  },
  curious: {
    position: { vitality: 65, sociality: 45, order: 60, appetite: 30, caution: 55, curiosity: 95 },
    radiusBase: 22,
  },
} as const;

export const PERSONALITY_BEHAVIOR_EVIDENCE = {
  playful: { axes: { play: 1, exploration: 0.4 } },
  drowsy: { axes: { disruption: 1 }, lowAxes: { play: { below: 25, weight: 0.5 } } },
  foodie: { axes: { care: 1, social: 0.25 } },
  bold: { axes: { play: 1, exploration: 0.6, disruption: 0.2 } },
  zen: { axes: { order: 1, care: 0.5, disruption: -0.6 } },
  anxious: { axes: { disruption: 1, recovery: 0.5 } },
  feral: { axes: { play: 1, disruption: 0.8 }, lowAxes: { social: { below: 30, weight: 0.3 } } },
  sage: { axes: { exploration: 1, order: 0.7, social: 0.3 } },
  pristine: { axes: { order: 1, care: 0.4 } },
  empath: { axes: { social: 1, care: 0.5, recovery: 0.3 } },
  greedy: { axes: { care: 1, exploration: 0.5 } },
  melancholic: { axes: { disruption: 1, social: 0.2 } },
  chaotic: { axes: { disruption: 1, play: 0.7, exploration: 0.7 } },
  stoic: { axes: { order: 1 }, lowAxes: { social: { below: 25, weight: 0.4 } } },
  adventurer: { axes: { exploration: 1, play: 0.6, care: 0.2 } },
  paranoid: { axes: { disruption: 1, order: 0.4 } },
  curious: { axes: { exploration: 1, order: 0.45, social: 0.25, disruption: -0.3 } },
} as const;
