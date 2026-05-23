import type { BehaviorAxis, PersonalityId, TraitKey } from './types';
import type { Pet } from '../api/types';
import { getPersonalityGuidance } from '@zdesagochi/personality-pet-preset';

const TRAIT_NAMES: Record<TraitKey, string> = {
  vitality: 'активность',
  sociality: 'социальность',
  order: 'порядок',
  appetite: 'аппетит',
  caution: 'осторожность',
  curiosity: 'любопытство',
};

const AXIS_NAMES: Record<BehaviorAxis, string> = {
  care: 'забота',
  play: 'игра',
  social: 'связь',
  order: 'режим',
  exploration: 'исследование',
  disruption: 'срывы',
  recovery: 'восстановление',
};

export interface PersonalityHint {
  title: string;
  body: string;
  tone: 'good' | 'warn' | 'neutral';
}

export function getCurrentPersonalityHints(pet: Pet): PersonalityHint[] {
  const hints: PersonalityHint[] = [];
  const guidance = getPersonalityGuidance(pet.personality as PersonalityId);
  const dominantTrait = strongestEntry(pet.traitVector as Partial<Record<TraitKey, number>>, 50);
  const dominantAxis = strongestEntry(pet.behaviorProfile?.axes as Partial<Record<BehaviorAxis, number>> | undefined, 0);

  hints.push({
    title: pet.formationComplete ? 'Текущий стиль' : 'Формирование',
    body: pet.formationComplete
      ? guidance.summary
      : 'Характер ещё формируется: повторяемые действия сейчас особенно важны.',
    tone: 'neutral',
  });

  if (pet.evolutionReadinessTarget) {
    const target = getPersonalityGuidance(pet.evolutionReadinessTarget);
    hints.push({
      title: 'Куда движется',
      body: `Поведение уже тянет питомца к "${target.personalityId}". Поддерживай: ${target.aimFor[0]}`,
      tone: 'good',
    });
  } else if (dominantAxis) {
    hints.push({
      title: 'Главная привычка',
      body: `Сильнее всего накоплен профиль "${AXIS_NAMES[dominantAxis.key]}".`,
      tone: dominantAxis.key === 'disruption' ? 'warn' : 'neutral',
    });
  }

  if (dominantTrait) {
    hints.push({
      title: 'Сильная черта',
      body: `Сейчас заметнее всего выделяется "${TRAIT_NAMES[dominantTrait.key]}".`,
      tone: dominantTrait.key === 'caution' && dominantTrait.value > 65 ? 'warn' : 'neutral',
    });
  }

  if ((pet.behavioralCounters.repeatedItemUse7d ?? 0) >= 4) {
    hints.push({
      title: 'Предметная привычка',
      body: 'Один предмет повторяется часто: это усиливает осторожность и ритуальность.',
      tone: 'warn',
    });
  } else if ((pet.behavioralCounters.uniqueItemsUsed?.length ?? 0) + (pet.behavioralCounters.uniqueItemsAdded?.length ?? 0) >= 3) {
    hints.push({
      title: 'Предметное исследование',
      body: 'Разные предметы поддерживают любопытство и исследовательский стиль.',
      tone: 'good',
    });
  }

  return hints.slice(0, 4);
}

export function getActionTrainingHint(actionId: string): string {
  switch (actionId) {
    case 'feed':
      return 'Регулярное кормление усиливает care/appetite; поздний голод может закрепить тревогу.';
    case 'play':
      return 'Игра двигает к active/playful/bold стилям, если хватает энергии.';
    case 'sleep':
      return 'Естественный сон поддерживает order/recovery; раннее пробуждение добавляет disruption.';
    case 'bathe':
      return 'Купание усиливает порядок и аккуратность, особенно если чистота уже просела.';
    case 'heal':
      return 'Лечение помогает recovery, но без нужды может выглядеть как тревожный уход.';
    case 'bond':
      return 'Объятия усиливают social/care и помогают уходить от paranoid/shadow паттернов.';
    default:
      return '';
  }
}

export function getItemTrainingHint(mode: 'buy' | 'use', itemId?: string): string {
  if (mode === 'buy') {
    return itemId
      ? 'Покупка тоже считается добавлением предмета: разные покупки поддерживают curiosity/exploration.'
      : 'Добавление разных предметов учит питомца исследовать; однотипные покупки дают более привычный стиль.';
  }
  return itemId
    ? 'Использование разных предметов ведёт к curious/adventurer; повтор одного itemId усиливает caution/order.'
    : 'Предметы влияют долгосрочно: частота, разнообразие и повторы меняют характер.';
}

function strongestEntry<T extends string>(
  values: Partial<Record<T, number>> | undefined,
  neutral: number,
): { key: T; value: number } | null {
  if (!values) return null;
  let best: { key: T; value: number } | null = null;
  for (const [key, raw] of Object.entries(values) as Array<[T, number]>) {
    const value = raw ?? neutral;
    const score = Math.abs(value - neutral);
    if (!best || score > Math.abs(best.value - neutral)) best = { key, value };
  }
  return best;
}
