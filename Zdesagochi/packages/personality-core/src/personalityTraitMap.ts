import type { EvolutionBonus, PersonalityId, TraitVector } from './types';

export interface PersonalityTraitHome {
  id: PersonalityId;
  position: TraitVector;
  radiusBase: number;
}

export const PERSONALITY_TRAIT_MAP: Record<PersonalityId, PersonalityTraitHome> = {
  playful: {
    id: 'playful',
    position: { vitality: 90, sociality: 60, order: 20, appetite: 40, caution: 20, curiosity: 60 },
    radiusBase: 25,
  },
  drowsy: {
    id: 'drowsy',
    position: { vitality: 10, sociality: 40, order: 55, appetite: 35, caution: 40, curiosity: 15 },
    radiusBase: 25,
  },
  foodie: {
    id: 'foodie',
    position: { vitality: 55, sociality: 50, order: 50, appetite: 95, caution: 30, curiosity: 45 },
    radiusBase: 25,
  },
  bold: {
    id: 'bold',
    position: { vitality: 80, sociality: 40, order: 35, appetite: 45, caution: 5, curiosity: 55 },
    radiusBase: 22,
  },
  zen: {
    id: 'zen',
    position: { vitality: 30, sociality: 75, order: 85, appetite: 30, caution: 25, curiosity: 45 },
    radiusBase: 22,
  },
  anxious: {
    id: 'anxious',
    position: { vitality: 60, sociality: 50, order: 40, appetite: 55, caution: 90, curiosity: 50 },
    radiusBase: 22,
  },
  feral: {
    id: 'feral',
    position: { vitality: 75, sociality: 10, order: 15, appetite: 60, caution: 15, curiosity: 55 },
    radiusBase: 20,
  },
  sage: {
    id: 'sage',
    position: { vitality: 35, sociality: 65, order: 70, appetite: 40, caution: 45, curiosity: 90 },
    radiusBase: 22,
  },
  pristine: {
    id: 'pristine',
    position: { vitality: 50, sociality: 55, order: 80, appetite: 40, caution: 65, curiosity: 40 },
    radiusBase: 22,
  },
  empath: {
    id: 'empath',
    position: { vitality: 45, sociality: 95, order: 55, appetite: 40, caution: 55, curiosity: 50 },
    radiusBase: 20,
  },
  greedy: {
    id: 'greedy',
    position: { vitality: 70, sociality: 30, order: 55, appetite: 85, caution: 35, curiosity: 60 },
    radiusBase: 20,
  },
  melancholic: {
    id: 'melancholic',
    position: { vitality: 20, sociality: 55, order: 60, appetite: 35, caution: 60, curiosity: 65 },
    radiusBase: 22,
  },
  chaotic: {
    id: 'chaotic',
    position: { vitality: 70, sociality: 40, order: 5, appetite: 50, caution: 20, curiosity: 80 },
    radiusBase: 20,
  },
  stoic: {
    id: 'stoic',
    position: { vitality: 15, sociality: 35, order: 95, appetite: 20, caution: 30, curiosity: 20 },
    radiusBase: 22,
  },
  adventurer: {
    id: 'adventurer',
    position: { vitality: 75, sociality: 55, order: 25, appetite: 45, caution: 10, curiosity: 95 },
    radiusBase: 20,
  },
  paranoid: {
    id: 'paranoid',
    position: { vitality: 40, sociality: 20, order: 65, appetite: 35, caution: 95, curiosity: 55 },
    radiusBase: 18,
  },
};

export const EVOLUTION_LEGACY: Partial<Record<PersonalityId, EvolutionBonus>> = {
  feral: {
    description: 'Следы дикой природы',
    xpMultiplierBonus: 0.05,
    uniqueTrait: 'Ночные действия +5% XP навсегда',
  },
  empath: {
    description: 'Эмпатический след',
    xpMultiplierBonus: 0.08,
    uniqueTrait: 'bond-действия всегда +5 happiness',
  },
  chaotic: {
    description: 'Хаотический осколок',
    xpMultiplierBonus: 0.10,
    uniqueTrait: '10% шанс ×2 XP на любое действие',
  },
  greedy: {
    description: 'Жадное наследие',
    coinMultiplierBonus: 0.03,
    uniqueTrait: '+3% монет к каждой игре навсегда',
  },
  adventurer: {
    description: 'Дух авантюры',
    xpMultiplierBonus: 0.06,
    uniqueTrait: 'Первая еда дня всегда +5 curiosity',
  },
  paranoid: {
    description: 'Параноидальная бдительность',
    xpMultiplierBonus: 0.12,
    uniqueTrait: 'Если все статы > 80: +15% к XP',
  },
};
