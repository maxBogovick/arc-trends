import type { ExplainabilityRecord } from '../api/explainability';
import type { InventoryItem, Pet, Room, ShopItem } from '../api/types';
import { getPersonality } from '@zdesagochi/personality-pet-preset';
import { getRecommendedPetActions, type ActionRecommendation } from './guidanceSelectors';
import { isSupportedPetActionId, type SupportedPetActionId } from './petActionIds';
import {
  getTimeOfDayActivitySuggestion,
  type ActivityTarget,
  type DismissedActivityState,
  type PendingActivityState,
  type QuietHoursConfig,
  type TimeOfDaySuggestionDebug,
  type TimeOfDayTuningConfig,
} from './timeOfDayActivities';
import type { TimeOfDayActivityConfigPatch } from './timeOfDayActivityConfig';

export interface ProactivePetSuggestion {
  id: string;
  message: string;
  actionId?: SupportedPetActionId;
  activityId?: string;
  target?: ActivityTarget;
  ctaLabel?: string;
  debug?: TimeOfDaySuggestionDebug;
  reason: string;
  priority: number;
  source: 'need' | 'personality' | 'evolution' | 'recovery' | 'after_action' | 'time_of_day' | 'mood';
  tone: 'urgent' | 'gentle' | 'playful' | 'proud' | 'neutral';
}

export interface ProactiveSuggestionInput {
  pet: Pet;
  latestRecord?: ExplainabilityRecord | null;
  recommendations?: ActionRecommendation[];
  now?: Date;
  inventory?: InventoryItem[];
  rooms?: Room[];
  shopItems?: ShopItem[];
  dismissedActivities?: DismissedActivityState[];
  pendingActivities?: PendingActivityState[];
  scheduleOffsetHours?: number;
  lastRoutineSuggestionAt?: string | null;
  tuningConfig?: TimeOfDayTuningConfig;
  quietHours?: QuietHoursConfig;
  includeDebug?: boolean;
  abCohort?: string;
  copyVariantSeed?: string;
  configPatch?: TimeOfDayActivityConfigPatch;
}

const ACTION_REQUESTS: Record<SupportedPetActionId, string> = {
  feed: 'Покорми меня сейчас, так мне будет спокойнее.',
  bathe: 'Давай помоемся, мне нужен порядок.',
  heal: 'Мне нужна помощь со здоровьем.',
  play: 'Давай сыграем, у меня есть силы.',
  play_puzzle: 'Хочу пазл, мне интересно подумать.',
  play_social: 'Давай поиграем вместе, так теплее.',
  bond: 'Обними меня немного.',
  bond_listen: 'Побудь рядом и выслушай меня.',
  bond_praise: 'Похвали меня, я стараюсь.',
  sleep: 'Давай со сном аккуратно.',
  sleep_nap: 'Мне нужен короткий отдых.',
  sleep_ritual: 'Давай сделаем спокойный ритуал.',
};

const PERSONALITY_TONE: Partial<Record<string, Partial<Record<SupportedPetActionId, string>>>> = {
  bold: {
    sleep_nap: 'Короткий отдых, и я снова в деле.',
    play: 'Давай игру, я готов проверить себя.',
    play_puzzle: 'Дай задачу посложнее.',
  },
  zen: {
    sleep_ritual: 'Давай ровный ритуал, мне нужен ритм.',
    bond: 'Посиди рядом, этого достаточно.',
    bathe: 'Чистота поможет сохранить равновесие.',
  },
  anxious: {
    bond_listen: 'Пожалуйста, просто выслушай меня.',
    sleep_ritual: 'Мне нужен тихий ритуал без суеты.',
    heal: 'Проверь здоровье, так будет спокойнее.',
  },
  empath: {
    bond: 'Хочу немного тепла рядом с тобой.',
    bond_praise: 'Скажи, что я справляюсь.',
    play_social: 'Давай сделаем что-то вместе.',
  },
  curious: {
    play_puzzle: 'Хочу разобраться в новой загадке.',
    play: 'Давай исследовать через игру.',
  },
};

export function getProactivePetSuggestion(input: ProactiveSuggestionInput): ProactivePetSuggestion {
  const critical = getCriticalStateSuggestion(input.pet);
  if (critical) return critical;

  const blockedAction = getBlockedActionSuggestion(input.pet, input.latestRecord);
  if (blockedAction) return blockedAction;

  const afterAction = getImportantAfterActionSuggestion(input.pet, input.latestRecord);
  if (afterAction) return afterAction;

  const stateSuggestion = getStateSuggestion(input.pet);
  if (stateSuggestion) return stateSuggestion;

  const recommendations = input.recommendations ?? getRecommendedPetActions(input.pet);
  const evolutionRecommendation = recommendations.find(
    (item): item is ActionRecommendation & { actionId: SupportedPetActionId } =>
      item.evidence === 'assistant_guidance' && isSupportedPetActionId(item.actionId),
  );
  if (evolutionRecommendation) {
    const actionId = evolutionRecommendation.actionId;
    return {
      id: `recommendation:${actionId}`,
      message: phraseForAction(input.pet, actionId),
      actionId,
      reason: evolutionRecommendation.reason,
      priority: evolutionRecommendation.score,
      source: 'evolution',
      tone: toneForAction(actionId),
    };
  }

  const timeSuggestion = getTimeOfDayActivitySuggestion({
    pet: input.pet,
    now: input.now,
    inventory: input.inventory,
    rooms: input.rooms,
    shopItems: input.shopItems,
    dismissedActivities: input.dismissedActivities,
    pendingActivities: input.pendingActivities,
    scheduleOffsetHours: input.scheduleOffsetHours,
    lastRoutineSuggestionAt: input.lastRoutineSuggestionAt,
    tuningConfig: input.tuningConfig,
    quietHours: input.quietHours,
    includeDebug: input.includeDebug,
    abCohort: input.abCohort,
    copyVariantSeed: input.copyVariantSeed,
    configPatch: input.configPatch,
  });
  if (timeSuggestion.score > 1 || timeSuggestion.target) {
    return {
      id: timeSuggestion.id,
      activityId: timeSuggestion.activityId,
      message: timeSuggestion.message,
      actionId: timeSuggestion.actionId,
      target: timeSuggestion.target,
      ctaLabel: timeSuggestion.ctaLabel,
      debug: timeSuggestion.debug,
      reason: timeSuggestion.reason,
      priority: timeSuggestion.score,
      source: 'time_of_day',
      tone: timeSuggestion.actionId?.startsWith('play') ? 'playful' : 'gentle',
    };
  }

  const recommendation = recommendations.find(
    (item): item is ActionRecommendation & { actionId: SupportedPetActionId } =>
      isSupportedPetActionId(item.actionId),
  );
  if (recommendation) {
    const actionId = recommendation.actionId;
    return {
      id: `recommendation:${actionId}`,
      message: phraseForAction(input.pet, actionId),
      actionId,
      reason: recommendation.reason,
      priority: recommendation.score,
      source: recommendation.evidence === 'engine_evidence'
        ? 'personality'
        : recommendation.evidence === 'assistant_guidance'
          ? 'evolution'
          : 'need',
      tone: toneForAction(actionId),
    };
  }

  return {
    id: `mood:${input.pet.mood}`,
    message: fallbackMoodMessage(input.pet),
    reason: 'Нет сильного сигнала для предложения действия.',
    priority: 1,
    source: 'mood',
    tone: 'neutral',
  };
}

function getBlockedActionSuggestion(_pet: Pet, record?: ExplainabilityRecord | null): ProactivePetSuggestion | null {
  if (!record || record.command.type === 'sync') return null;
  if (!isFreshRecord(record)) return null;

  if (record.blockedAction) {
    return {
      id: `after:block:${record.command.commandId}`,
      message: record.blockedAction.alternativeHint ?? 'Давай выберем другое действие.',
      reason: record.blockedAction.reason,
      priority: 110,
      source: 'after_action',
      tone: 'gentle',
    };
  }

  return null;
}

function getImportantAfterActionSuggestion(pet: Pet, record?: ExplainabilityRecord | null): ProactivePetSuggestion | null {
  if (!record || record.command.type === 'sync') return null;
  if (!isFreshRecord(record, pet)) return null;

  const proposal = record.events.find(event => event.type === 'evolution_proposed');
  if (proposal?.type === 'evolution_proposed') {
    const target = getPersonality(proposal.proposal.targetPersonalityId);
    return {
      id: `after:evolution:${record.command.commandId}`,
      message: `Я чувствую новый путь: ${target?.name ?? proposal.proposal.targetPersonalityId}.`,
      reason: 'Появилось предложение эволюции характера.',
      priority: 105,
      source: 'after_action',
      tone: 'proud',
    };
  }

  const readiness = record.events.find(event => event.type === 'evolution_readiness_changed');
  if (readiness?.type === 'evolution_readiness_changed' && readiness.to > readiness.from) {
    return {
      id: `after:readiness:${record.command.commandId}`,
      message: 'Это действие двинуло мой характер вперед.',
      reason: 'Готовность к смене характера выросла.',
      priority: 95,
      source: 'after_action',
      tone: 'proud',
    };
  }

  if (record.events.some(event => event.type === 'behavior_profile_changed')) {
    return {
      id: `after:behavior:${record.command.commandId}`,
      message: 'Я запоминаю такие привычки.',
      reason: 'Поведенческий профиль изменился.',
      priority: 85,
      source: 'after_action',
      tone: 'neutral',
    };
  }

  if (record.events.some(event => event.type === 'trait_vector_changed')) {
    return {
      id: `after:traits:${record.command.commandId}`,
      message: 'Я немного меняюсь от таких действий.',
      reason: 'Черты характера сдвинулись.',
      priority: 80,
      source: 'after_action',
      tone: 'neutral',
    };
  }

  return null;
}

function getCriticalStateSuggestion(pet: Pet): ProactivePetSuggestion | null {
  if (pet.confusedState) {
    return {
      id: 'state:confused',
      message: 'Слишком много впечатлений. Нужен ритуал.',
      actionId: 'sleep_ritual',
      reason: 'Confused state активен.',
      priority: 98,
      source: 'recovery',
      tone: 'gentle',
    };
  }

  if (pet.emergentState === 'shadow_form' || pet.traumaLevel >= 40) {
    return {
      id: 'state:recovery',
      message: 'Побудь рядом и выслушай меня.',
      actionId: 'bond_listen',
      reason: 'Высокое напряжение требует recovery/social действия.',
      priority: 97,
      source: 'recovery',
      tone: 'gentle',
    };
  }

  const { hunger, health, energy, cleanliness, bond } = pet.stats;
  if (hunger < 25) return need('need:hunger', 'Я очень голоден. Покорми меня.', 'feed', 'Сытость критически низкая.', 96, 'urgent');
  if (health < 45) return need('need:health', 'Мне правда нужна помощь со здоровьем.', 'heal', 'Здоровье критически низкое.', 94, 'urgent');
  if (energy < 18) return need('need:energy', 'Сил почти нет. Давай короткий отдых.', 'sleep_nap', 'Энергия критически низкая.', 92, 'gentle');
  if (cleanliness < 25) return need('need:cleanliness', 'Мне некомфортно грязным. Помоемся?', 'bathe', 'Чистота критически низкая.', 90, 'gentle');
  if (bond < 25) return need('need:bond', 'Мне нужно немного твоего внимания.', 'bond', 'Связь критически низкая.', 88, 'gentle');

  return null;
}

function getStateSuggestion(pet: Pet): ProactivePetSuggestion | null {
  if (pet.isAsleep) {
    return {
      id: 'state:sleeping',
      message: pet.stats.energy >= 85 ? 'Я выспался, разбуди меня мягко.' : 'Я еще сплю, дай мне восстановиться.',
      actionId: pet.stats.energy >= 85 ? 'sleep' : undefined,
      target: pet.stats.energy >= 85 ? { kind: 'action', actionId: 'sleep' } : undefined,
      reason: 'Питомец спит.',
      priority: pet.stats.energy >= 85 ? 100 : 70,
      source: 'need',
      tone: 'gentle',
    };
  }

  if (pet.evolutionProposal) {
    const target = getPersonality(pet.evolutionProposal.targetPersonalityId);
    return {
      id: 'state:evolution_proposal',
      message: `Я готов к новому пути: ${target?.name ?? pet.evolutionProposal.targetPersonalityId}.`,
      reason: 'Есть активное предложение эволюции.',
      priority: 86,
      source: 'evolution',
      tone: 'proud',
    };
  }

  return null;
}

function isFreshRecord(record: ExplainabilityRecord, pet?: Pet): boolean {
  const reference = pet?.lastUpdated ?? record.recordedAt;
  const ageMs = Math.abs(new Date(reference).getTime() - new Date(record.recordedAt).getTime());
  return Number.isFinite(ageMs) && ageMs <= 30_000;
}

function need(
  id: string,
  message: string,
  actionId: SupportedPetActionId,
  reason: string,
  priority: number,
  tone: ProactivePetSuggestion['tone'],
): ProactivePetSuggestion {
  return { id, message, actionId, reason, priority, source: 'need', tone };
}

function phraseForAction(pet: Pet, actionId: SupportedPetActionId): string {
  const personalityPhrase = PERSONALITY_TONE[pet.personality]?.[actionId];
  return personalityPhrase ?? ACTION_REQUESTS[actionId];
}

function toneForAction(actionId: SupportedPetActionId): ProactivePetSuggestion['tone'] {
  if (actionId.startsWith('play')) return 'playful';
  if (actionId.startsWith('bond') || actionId.startsWith('sleep')) return 'gentle';
  if (actionId === 'heal' || actionId === 'feed') return 'urgent';
  return 'neutral';
}

function fallbackMoodMessage(pet: Pet): string {
  if (pet.mood === 'ecstatic') return 'Мне очень хорошо с тобой.';
  if (pet.mood === 'happy') return 'Сегодня хороший день.';
  if (pet.mood === 'sad') return 'Мне грустно, побудь рядом.';
  if (pet.mood === 'tired') return 'Я устал и хочу тише.';
  if (pet.mood === 'sick') return 'Мне нехорошо.';
  return 'Все спокойно.';
}
