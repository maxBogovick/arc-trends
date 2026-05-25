import type { FoodItem, Pet } from '../../api';
import { isSupportedPetActionId as isKnownPetActionId, type SupportedPetActionId } from '../../personality/petActionIds';
export type { SupportedPetActionId } from '../../personality/petActionIds';

export interface PetActionConfig {
  id: SupportedPetActionId;
  disabled?: (pet: Pet, food: FoodItem | null) => boolean;
  tooltip?: (pet: Pet, food: FoodItem | null) => string;
}

export interface PetActionRunner {
  pet: Pet;
  foods: FoodItem[];
  onPlayGame: () => void;
  onOpenFoodPicker?: () => void;
  feedPet: (foodId: string) => Promise<void>;
  playWithPet: (variant?: 'classic' | 'active' | 'puzzle' | 'social') => Promise<unknown>;
  sleepPet: (variant?: 'night' | 'nap' | 'ritual') => Promise<void>;
  wakePet: (variant?: 'normal' | 'gentle') => Promise<void>;
  bathePet: () => Promise<void>;
  healPet: () => Promise<void>;
  bondWithPet: (variant?: 'hug' | 'listen' | 'praise') => Promise<void>;
  notify: (message: string, type: 'success' | 'error' | 'info' | 'xp' | 'coins') => void;
}

export const PET_ACTIONS: PetActionConfig[] = [
  {
    id: 'feed',
    disabled: (p, food) => p.isAsleep || p.stats.hunger > 90 || !food,
    tooltip: (p, food) => {
      if (p.isAsleep) return 'Питомец спит';
      if (!food) return 'Еда не загружена';
      if (p.stats.hunger > 90) return 'Питомец уже сыт';
      return `${food.emoji} ${food.name}`;
    },
  },
  {
    id: 'bathe',
    disabled: p => p.isAsleep || p.stats.cleanliness > 90,
    tooltip: p => p.isAsleep ? 'Питомец спит' : p.stats.cleanliness > 90 ? 'Питомец чистый' : 'Восстановить чистоту',
  },
  {
    id: 'heal',
    disabled: p => p.isAsleep || (p.stats.health > 85 && p.traumaLevel < 40 && p.emergentState !== 'shadow_form'),
    tooltip: p => p.isAsleep ? 'Питомец спит' : p.stats.health > 85 ? 'Лечение не нужно' : 'Поддержать здоровье',
  },
  {
    id: 'play',
    disabled: p => p.isAsleep || p.stats.energy < 10,
    tooltip: p => p.isAsleep ? 'Питомец спит' : p.stats.energy < 10 ? 'Нет энергии' : 'Классическая игра',
  },
  {
    id: 'play_puzzle',
    disabled: p => p.isAsleep || p.stats.energy < 8,
    tooltip: p => p.isAsleep ? 'Питомец спит' : p.stats.energy < 8 ? 'Нет энергии' : 'Любопытство и порядок',
  },
  {
    id: 'play_social',
    disabled: p => p.isAsleep || p.stats.energy < 10,
    tooltip: p => p.isAsleep ? 'Питомец спит' : p.stats.energy < 10 ? 'Нет энергии' : 'Социальность через игру',
  },
  {
    id: 'bond',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец спит' : 'Теплый контакт',
  },
  {
    id: 'bond_listen',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец спит' : 'Снижает тревожность',
  },
  {
    id: 'bond_praise',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец спит' : 'Учит уверенности',
  },
  {
    id: 'sleep',
    tooltip: p => p.isAsleep ? 'Мягко разбудить' : 'Уложить спать',
  },
  {
    id: 'sleep_nap',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Уже спит' : 'Короткое восстановление',
  },
  {
    id: 'sleep_ritual',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Уже спит' : 'Спокойный режим',
  },
];

export const PET_ACTION_BY_ID = new Map(PET_ACTIONS.map(action => [action.id, action]));

export const PET_ACTION_META: Record<SupportedPetActionId, {
  emoji: (pet: Pet, food: FoodItem | null) => string;
  label: string;
}> = {
  feed: { emoji: (_p, f) => f?.emoji ?? '🍔', label: 'Еда' },
  bathe: { emoji: () => '🛁', label: 'Мыть' },
  heal: { emoji: () => '💊', label: 'Лечить' },
  play: { emoji: () => '🎮', label: 'Игра' },
  play_puzzle: { emoji: () => '🧩', label: 'Пазл' },
  play_social: { emoji: () => '🫶', label: 'Вместе' },
  bond: { emoji: () => '🤗', label: 'Обнять' },
  bond_listen: { emoji: () => '👂', label: 'Слушать' },
  bond_praise: { emoji: () => '✨', label: 'Похвала' },
  sleep: { emoji: p => p.isAsleep ? '☀️' : '😴', label: 'Сон' },
  sleep_nap: { emoji: () => '💤', label: 'Дрема' },
  sleep_ritual: { emoji: () => '🌙', label: 'Ритуал' },
};

export function loadingKey(id: SupportedPetActionId): string {
  return id === 'play' ? 'play_classic' : id;
}

export function bestFoodForPet(pet: Pet, foods: FoodItem[]): FoodItem | null {
  if (!foods.length) return null;
  if (pet.stats.hunger <= 25) {
    return [...foods].sort((a, b) => b.hungerRestore - a.hungerRestore)[0];
  }
  if (pet.stats.health <= 70) {
    return [...foods].sort((a, b) => (b.healthBonus - a.healthBonus) || (b.hungerRestore - a.hungerRestore))[0];
  }
  const gentle = ['apple', 'milk', 'salad'];
  return (
    foods.find(food => gentle.includes(food.id)) ??
    [...foods].sort((a, b) => (b.healthBonus - a.healthBonus) || (a.hungerRestore - b.hungerRestore))[0]
  );
}

export function isSupportedPetActionId(actionId: string): actionId is SupportedPetActionId {
  return isKnownPetActionId(actionId) && PET_ACTION_BY_ID.has(actionId);
}

export function isPetActionDisabled(actionId: SupportedPetActionId, pet: Pet, food: FoodItem | null): boolean {
  return PET_ACTION_BY_ID.get(actionId)?.disabled?.(pet, food) ?? false;
}

export async function runSupportedPetAction(actionId: SupportedPetActionId, runner: PetActionRunner): Promise<void> {
  if (actionId === 'feed') {
    if (runner.onOpenFoodPicker) {
      runner.onOpenFoodPicker();
      return;
    }
    const food = bestFoodForPet(runner.pet, runner.foods);
    if (!food) {
      runner.notify('Еда пока не загружена', 'error');
      return;
    }
    await runner.feedPet(food.id);
    return;
  }

  switch (actionId) {
    case 'play':
      runner.onPlayGame();
      break;
    case 'play_puzzle':
      await runner.playWithPet('puzzle');
      break;
    case 'play_social':
      await runner.playWithPet('social');
      break;
    case 'sleep':
      if (runner.pet.isAsleep) await runner.wakePet('gentle');
      else await runner.sleepPet();
      break;
    case 'sleep_nap':
      await runner.sleepPet('nap');
      break;
    case 'sleep_ritual':
      await runner.sleepPet('ritual');
      break;
    case 'bathe':
      await runner.bathePet();
      break;
    case 'heal':
      await runner.healPet();
      break;
    case 'bond':
      await runner.bondWithPet();
      break;
    case 'bond_listen':
      await runner.bondWithPet('listen');
      break;
    case 'bond_praise':
      await runner.bondWithPet('praise');
      break;
  }
}
