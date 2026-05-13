export type PetArchetype = 'animal' | 'humanoid' | 'creature';

export interface ArchetypeInput {
  equippedTailId: string;
  equippedLegsId: string;
  equippedArmsId: string;
  equippedOutfitId: string;
}

const ANIMAL_LEGS = new Set(['paws', 'hooves', 'claw_feet', 'flippers']);

export function getPetArchetype({ equippedTailId, equippedLegsId, equippedArmsId, equippedOutfitId }: ArchetypeInput): PetArchetype {
  if (equippedTailId !== 'none' || ANIMAL_LEGS.has(equippedLegsId)) return 'animal';
  if (equippedArmsId === 'long_arms' || equippedOutfitId !== 'none') return 'humanoid';
  return 'creature';
}
