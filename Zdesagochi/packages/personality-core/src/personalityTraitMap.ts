import type { EvolutionBonus, PersonalityId, TraitVector } from './types';
import { PERSONALITY_TRAIT_HOMES } from './personalityCatalog';

export interface PersonalityTraitHome {
  id: PersonalityId;
  position: TraitVector;
  radiusBase: number;
}

export const PERSONALITY_TRAIT_MAP: Record<PersonalityId, PersonalityTraitHome> = Object.fromEntries(
  Object.entries(PERSONALITY_TRAIT_HOMES).map(([id, home]) => [
    id,
    {
      id,
      position: { ...home.position },
      radiusBase: home.radiusBase,
    },
  ]),
) as Record<PersonalityId, PersonalityTraitHome>;

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
