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

export interface ActionRecommendation {
  actionId: string;
  reason: string;
  evidence: 'pet_state' | 'assistant_guidance' | 'engine_evidence';
  score: number;
}

const ACTION_TRAINING_HINTS: Record<string, string> = {
  feed: 'Регулярное кормление усиливает care/appetite; поздний голод может закрепить тревогу.',
  play: 'Игра двигает к active/playful/bold стилям, если хватает энергии.',
  play_puzzle: 'Головоломка тренирует curiosity/exploration и поддерживает order.',
  play_social: 'Совместная игра добавляет play/social/care evidence.',
  sleep: 'Естественный сон поддерживает order/recovery; раннее пробуждение добавляет disruption.',
  sleep_nap: 'Короткий отдых усиливает recovery/care без сильного сдвига в строгий режим.',
  sleep_ritual: 'Ритуал сна укрепляет order/recovery и мягко снижает тревожность.',
  bathe: 'Купание усиливает порядок и аккуратность, особенно если чистота уже просела.',
  heal: 'Лечение помогает recovery, но без нужды может выглядеть как тревожный уход.',
  bond: 'Объятия усиливают social/care и помогают уходить от paranoid/shadow паттернов.',
  bond_listen: 'Выслушать снижает тревожность и добавляет recovery/social evidence.',
  bond_praise: 'Похвала поддерживает social/vitality и теплый контакт.',
  add_item: 'Добавление разных предметов учит питомца исследовать; однотипные покупки дают более привычный стиль.',
  use_item: 'Предметы влияют долгосрочно: частота, разнообразие и повторы меняют характер.',
};

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
  return ACTION_TRAINING_HINTS[actionId] ?? '';
}

export function getRecommendedPetActions(pet: Pet): ActionRecommendation[] {
  const candidates = new Map<string, ActionRecommendation>();

  const add = (
    actionId: string,
    score: number,
    reason: string,
    evidence: ActionRecommendation['evidence'],
  ) => {
    const existing = candidates.get(actionId);
    if (!existing || score > existing.score) {
      candidates.set(actionId, { actionId, score, reason, evidence });
    }
  };

  if (pet.isAsleep) {
    add('sleep', pet.stats.energy >= 85 ? 80 : 38, pet.stats.energy >= 85 ? 'Энергия восстановлена; лучше будить мягко.' : 'Питомец спит, мягкое пробуждение безопаснее обычного.', 'pet_state');
    add('bond_listen', 20, 'После сна мягкий контакт поддерживает recovery/social.', 'assistant_guidance');
    return [...candidates.values()].sort(sortRecommendation).slice(0, 3);
  }

  if (pet.confusedState) {
    add('sleep_ritual', 95, 'Confused state: engine уже показывает, что нужен спокойный сон.', 'engine_evidence');
  }
  if (pet.emergentState === 'shadow_form' || pet.traumaLevel >= 40) {
    add('bond_listen', 96, 'Высокое напряжение: восстановление и доверие сейчас важнее стимуляции.', 'engine_evidence');
    add('heal', 70, 'Лечение уместно как поддержка, если есть trauma/shadow сигнал.', 'engine_evidence');
  }

  const { hunger, happiness, energy, health, cleanliness, bond } = pet.stats;
  if (hunger < 45) add('feed', 88 + (45 - hunger), 'Сытость просела; care-сигнал сейчас практически полезен.', 'pet_state');
  if (health < 75) add('heal', 84 + (75 - health) * 0.5, 'Здоровье ниже комфортного уровня, recovery действие оправдано.', 'pet_state');
  if (cleanliness < 65) add('bathe', 76 + (65 - cleanliness) * 0.4, 'Чистота просела; купание поддержит порядок и состояние.', 'pet_state');
  if (energy < 35) add('sleep_nap', 82 + (35 - energy) * 0.5, 'Энергии мало; короткий отдых лучше новой активности.', 'pet_state');
  if (bond < 65) add('bond_praise', 70 + (65 - bond) * 0.35, 'Связь ниже устойчивой зоны; теплый контакт поможет.', 'pet_state');
  if (happiness < 65 && energy >= 45) add('play_social', 68 + (65 - happiness) * 0.3, 'Настроение просело, а энергии хватает для мягкой совместной игры.', 'pet_state');

  const traits = pet.traitVector;
  if ((traits.caution ?? 50) > 62) add('bond_listen', 66, 'Trait vector показывает повышенную осторожность; слушание снижает caution.', 'engine_evidence');
  if ((traits.curiosity ?? 50) < 45 && energy >= 30) add('play_puzzle', 62, 'Любопытство ниже нейтрали; головоломка дает curiosity/exploration evidence.', 'engine_evidence');
  if ((traits.order ?? 50) < 45) add('sleep_ritual', 58, 'Order ниже нейтрали; ритуал сна дает понятный режимный сигнал.', 'engine_evidence');

  const axes = pet.behaviorProfile?.axes;
  if (axes) {
    if ((axes.recovery ?? 0) < 1) add('sleep_nap', 52, 'В behavior profile почти нет recovery evidence.', 'engine_evidence');
    if ((axes.social ?? 0) < 1) add('bond_praise', 50, 'В behavior profile мало social evidence.', 'engine_evidence');
    if ((axes.play ?? 0) < 1 && energy >= 45) add('play_social', 48, 'В behavior profile мало play evidence, а энергия позволяет играть.', 'engine_evidence');
    if ((axes.exploration ?? 0) < 1 && energy >= 30) add('play_puzzle', 46, 'В behavior profile мало exploration evidence.', 'engine_evidence');
  }

  const target = pet.evolutionReadinessTarget ?? pet.currentTargetZone ?? null;
  if (target) {
    for (const aim of getPersonalityGuidance(target).aimFor.slice(0, 3)) {
      const mapped = mapGuidanceTextToAction(aim, pet);
      if (mapped) add(mapped.actionId, mapped.score, `Помощник цели "${target}" советует: ${aim}`, 'assistant_guidance');
    }
  }

  if (candidates.size < 3 && energy >= 45) add('play', 35, 'Базовая игра остается полезной, когда состояние стабильное.', 'assistant_guidance');
  if (candidates.size < 3) add('bond', 34, 'Базовый теплый контакт поддерживает social/care.', 'assistant_guidance');
  if (candidates.size < 3) add('sleep_ritual', 33, 'Режимный сон дает стабильный recovery/order сигнал.', 'assistant_guidance');

  return [...candidates.values()].sort(sortRecommendation).slice(0, 5);
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

function sortRecommendation(a: ActionRecommendation, b: ActionRecommendation): number {
  return b.score - a.score || a.actionId.localeCompare(b.actionId);
}

function mapGuidanceTextToAction(aim: string, pet: Pet): { actionId: string; score: number } | null {
  const text = aim.toLowerCase();
  if (text.includes('listen') || text.includes('слуш') || text.includes('trust') || text.includes('recovery')) return { actionId: 'bond_listen', score: 72 };
  if (text.includes('praise') || text.includes('похвал') || text.includes('social')) return { actionId: 'bond_praise', score: 70 };
  if (text.includes('bond') || text.includes('связ') || text.includes('care')) return { actionId: 'bond', score: 62 };
  if (text.includes('puzzle') || text.includes('curiosity') || text.includes('explor')) return pet.stats.energy >= 30 ? { actionId: 'play_puzzle', score: 68 } : { actionId: 'sleep_nap', score: 54 };
  if (text.includes('play') || text.includes('active') || text.includes('vitality')) return pet.stats.energy >= 45 ? { actionId: 'play', score: 66 } : { actionId: 'sleep_nap', score: 56 };
  if (text.includes('sleep') || text.includes('routine') || text.includes('order') || text.includes('режим')) return { actionId: 'sleep_ritual', score: 66 };
  if (text.includes('feed') || text.includes('food') || text.includes('appetite')) return { actionId: 'feed', score: 60 };
  return null;
}
