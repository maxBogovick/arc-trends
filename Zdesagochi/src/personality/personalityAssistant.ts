import {
  BEHAVIOR_AXES,
  PERSONALITY_TRAIT_HOMES,
  TRAIT_KEYS,
  type BehaviorAxis,
  type PersonalityId,
  type TraitKey,
} from '@zdesagochi/personality-core';
import { getPersonalityGuidance } from '@zdesagochi/personality-pet-preset';
import type { ExplainabilityRecord, PersonalityTelemetrySample } from '../api/explainability';
import type { Pet, PetEvent } from '../api/types';

export const TRAIT_LABELS: Record<TraitKey, string> = {
  vitality: 'активность',
  sociality: 'социальность',
  order: 'порядок',
  appetite: 'аппетит',
  caution: 'осторожность',
  curiosity: 'любопытство',
};

export const BEHAVIOR_LABELS: Record<BehaviorAxis, string> = {
  care: 'забота',
  play: 'игра',
  social: 'связь',
  order: 'режим',
  exploration: 'исследование',
  disruption: 'срывы',
  recovery: 'восстановление',
};

const COMMAND_LABELS: Record<string, string> = {
  feed: 'Кормление',
  play: 'Игра',
  sleep: 'Сон',
  wake: 'Пробуждение',
  bathe: 'Купание',
  heal: 'Лечение',
  bond: 'Связь',
  sync: 'Синхронизация',
  use_item: 'Использование предмета',
  add_item: 'Добавление предмета',
  'play:active': 'Активная игра',
  'play:puzzle': 'Головоломка',
  'play:social': 'Совместная игра',
  'bond:listen': 'Выслушать',
  'bond:praise': 'Похвалить',
  'sleep:nap': 'Короткий отдых',
  'sleep:ritual': 'Ритуал сна',
  'wake:gentle': 'Мягкое пробуждение',
};

export interface PersonalityAssistantInput {
  pet: Pet;
  records?: ExplainabilityRecord[];
  telemetry?: PersonalityTelemetrySample[];
  events?: PetEvent[];
  targetPersonalityId?: PersonalityId;
}

export interface WeightedInsight<T extends string = string> {
  key: T;
  label: string;
  value: number;
  direction?: 'up' | 'down' | 'neutral';
  explanation: string;
}

export interface NearestPersonalityInsight {
  personalityId: PersonalityId;
  label: string;
  distance: number;
  closeness: number;
  summary: string;
}

export interface TimelineEntry {
  id: string;
  at: string;
  phase: 'early' | 'habit' | 'formation' | 'formed' | 'evolution';
  title: string;
  summary: string;
  traitImpacts: WeightedInsight<TraitKey>[];
  behaviorImpacts: WeightedInsight<BehaviorAxis>[];
  confidence: number;
}

export interface ActionContribution {
  commandType: string;
  label: string;
  count: number;
  traitImpacts: WeightedInsight<TraitKey>[];
  behaviorImpacts: WeightedInsight<BehaviorAxis>[];
  explanation: string;
}

export interface ItemContribution {
  totalAdds: number;
  totalUses: number;
  uniqueItems: number;
  repeatedItemId: string | null;
  repeatedCount: number;
  style: 'none' | 'diverse' | 'repeated' | 'frequent';
  explanation: string;
}

export interface PersonalityAssistantReport {
  currentPersonality: PersonalityId;
  targetPersonality: PersonalityId;
  formationStatus: {
    complete: boolean;
    progress: number;
    label: string;
    explanation: string;
  };
  confidence: {
    score: number;
    label: 'низкая' | 'средняя' | 'высокая';
    explanation: string;
  };
  dominantTraits: WeightedInsight<TraitKey>[];
  dominantBehaviors: WeightedInsight<BehaviorAxis>[];
  nearestPersonalities: NearestPersonalityInsight[];
  actionContributions: ActionContribution[];
  itemContribution: ItemContribution;
  formationTimeline: TimelineEntry[];
  nextBestActions: string[];
  avoidActions: string[];
  summary: string;
}

export function buildPersonalityAssistantReport(input: PersonalityAssistantInput): PersonalityAssistantReport {
  const records = [...(input.records ?? [])].sort((a, b) => a.command.at.localeCompare(b.command.at));
  const telemetry = input.telemetry ?? records.map(record => record.personalityTelemetry).filter(Boolean) as PersonalityTelemetrySample[];
  const currentPersonality = normalizePersonalityId(input.pet.personality);
  const targetPersonality = input.targetPersonalityId ?? currentPersonality;
  const targetGuidance = getPersonalityGuidance(targetPersonality);

  const dominantTraits = buildDominantTraits(input.pet, targetPersonality);
  const dominantBehaviors = buildDominantBehaviors(input.pet);
  const nearestPersonalities = buildNearestPersonalities(input.pet).slice(0, 5);
  const actionContributions = buildActionContributions(records, telemetry);
  const itemContribution = buildItemContribution(input.pet, records);
  const formationTimeline = buildTimeline(input.pet, records, telemetry, input.events ?? []);
  const confidence = buildConfidence(input.pet, records, telemetry);
  const formationStatus = buildFormationStatus(input.pet);

  const topFactor = dominantTraits[0]?.label ?? dominantBehaviors[0]?.label ?? 'накопленные привычки';
  const summary = input.pet.formationComplete
    ? `Характер "${currentPersonality}" закреплён сильнее всего через ${topFactor}.`
    : `Характер ещё формируется: главный видимый сигнал сейчас — ${topFactor}.`;

  return {
    currentPersonality,
    targetPersonality,
    formationStatus,
    confidence,
    dominantTraits,
    dominantBehaviors,
    nearestPersonalities,
    actionContributions,
    itemContribution,
    formationTimeline,
    nextBestActions: targetGuidance.aimFor.slice(0, 4),
    avoidActions: targetGuidance.avoid.slice(0, 4),
    summary,
  };
}

function buildDominantTraits(pet: Pet, targetPersonality: PersonalityId): WeightedInsight<TraitKey>[] {
  const home = PERSONALITY_TRAIT_HOMES[targetPersonality].position;
  return TRAIT_KEYS
    .map(key => {
      const value = pet.traitVector[key] ?? 50;
      const homeValue = home[key];
      const direction: WeightedInsight<TraitKey>['direction'] = value > 55 ? 'up' : value < 45 ? 'down' : 'neutral';
      const towardTarget = 100 - Math.abs(value - homeValue);
      return {
        key,
        label: TRAIT_LABELS[key],
        value: round1(value),
        direction,
        score: Math.max(Math.abs(value - 50), towardTarget * 0.15),
        explanation: `${TRAIT_LABELS[key]} сейчас ${round1(value)}; цель "${targetPersonality}" ожидает около ${homeValue}.`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score: _score, ...insight }) => insight);
}

function buildDominantBehaviors(pet: Pet): WeightedInsight<BehaviorAxis>[] {
  const axes = pet.behaviorProfile?.axes;
  if (!axes) return [];
  return BEHAVIOR_AXES
    .map(key => ({
      key,
      label: BEHAVIOR_LABELS[key],
      value: round1(axes[key] ?? 0),
      direction: (axes[key] ?? 0) > 0 ? 'up' as const : 'neutral' as const,
      explanation: `Профиль "${BEHAVIOR_LABELS[key]}" накоплен до ${round1(axes[key] ?? 0)}.`,
    }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
}

function buildNearestPersonalities(pet: Pet): NearestPersonalityInsight[] {
  return (Object.keys(PERSONALITY_TRAIT_HOMES) as PersonalityId[])
    .map(personalityId => {
      const home = PERSONALITY_TRAIT_HOMES[personalityId].position;
      const distance = Math.sqrt(TRAIT_KEYS.reduce((sum, key) => {
        const diff = (pet.traitVector[key] ?? 50) - home[key];
        return sum + diff * diff;
      }, 0));
      const closeness = Math.max(0, Math.min(100, 100 - distance));
      return {
        personalityId,
        label: personalityId,
        distance: round1(distance),
        closeness: round1(closeness),
        summary: getPersonalityGuidance(personalityId).summary,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

function buildActionContributions(
  records: ExplainabilityRecord[],
  telemetry: PersonalityTelemetrySample[],
): ActionContribution[] {
  const grouped = new Map<string, {
    count: number;
    trait: Partial<Record<TraitKey, number>>;
    behavior: Partial<Record<BehaviorAxis, number>>;
  }>();

  for (const sample of telemetry) {
    const key = sample.commandVariant ? `${sample.commandType}:${sample.commandVariant}` : sample.commandType;
    const group = grouped.get(key) ?? { count: 0, trait: {}, behavior: {} };
    group.count += 1;
    for (const [key, value] of Object.entries(sample.traitDrift) as Array<[TraitKey, number]>) {
      group.trait[key] = round2((group.trait[key] ?? 0) + value);
    }
    for (const [key, value] of Object.entries(sample.behaviorDrift) as Array<[BehaviorAxis, number]>) {
      group.behavior[key] = round2((group.behavior[key] ?? 0) + value);
    }
    grouped.set(key, group);
  }

  for (const record of records) {
    const key = 'variant' in record.command && record.command.variant ? `${record.command.type}:${record.command.variant}` : record.command.type;
    if (!grouped.has(key)) {
      grouped.set(key, { count: 1, trait: {}, behavior: {} });
    }
  }

  return [...grouped.entries()]
    .map(([commandType, group]) => {
      const traitImpacts = impactsFromMap(group.trait, TRAIT_LABELS);
      const behaviorImpacts = impactsFromMap(group.behavior, BEHAVIOR_LABELS);
      const strongest = traitImpacts[0] ?? behaviorImpacts[0];
      return {
        commandType,
        label: COMMAND_LABELS[commandType] ?? commandType,
        count: group.count,
        traitImpacts,
        behaviorImpacts,
        explanation: strongest
          ? `${COMMAND_LABELS[commandType] ?? commandType} чаще всего двигало "${strongest.label}" (${formatSigned(strongest.value)}).`
          : `${COMMAND_LABELS[commandType] ?? commandType} пока накоплено без заметного drift-сигнала.`,
      };
    })
    .sort((a, b) => b.count - a.count || strongestImpact(b) - strongestImpact(a))
    .slice(0, 8);
}

function buildItemContribution(pet: Pet, records: ExplainabilityRecord[]): ItemContribution {
  const itemCounts = new Map<string, number>();
  let totalAdds = 0;
  let totalUses = 0;

  for (const record of records) {
    if (record.command.type !== 'add_item' && record.command.type !== 'use_item') continue;
    const itemId = 'itemId' in record.command ? String(record.command.itemId) : 'unknown';
    itemCounts.set(itemId, (itemCounts.get(itemId) ?? 0) + 1);
    if (record.command.type === 'add_item') totalAdds += 1;
    if (record.command.type === 'use_item') totalUses += 1;
  }

  const uniqueFromCounters = new Set([
    ...(pet.behavioralCounters.uniqueItemsAdded ?? []),
    ...(pet.behavioralCounters.uniqueItemsUsed ?? []),
  ]);
  for (const item of uniqueFromCounters) itemCounts.set(item, itemCounts.get(item) ?? 1);

  const repeated = [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const uniqueItems = itemCounts.size;
  const repeatedCount = repeated?.[1] ?? pet.behavioralCounters.repeatedItemUse7d ?? 0;
  const itemSignals = totalAdds + totalUses + (pet.behavioralCounters.itemAdds7d ?? 0) + (pet.behavioralCounters.itemUses7d ?? 0);
  const style: ItemContribution['style'] = itemSignals === 0 && uniqueItems === 0
    ? 'none'
    : repeatedCount >= 4
      ? 'repeated'
      : uniqueItems >= 3
        ? 'diverse'
        : itemSignals >= 5
          ? 'frequent'
          : 'frequent';

  const explanation = style === 'diverse'
    ? 'Разные предметы поддерживают любопытство, exploration и движение к curious/adventurer.'
    : style === 'repeated'
      ? 'Повтор одного предмета закрепляет ритуальность, осторожность и order/caution стиль.'
      : style === 'frequent'
        ? 'Частое добавление или применение предметов стало отдельной привычкой характера.'
        : 'Предметы пока почти не влияли на формирование характера.';

  return {
    totalAdds,
    totalUses,
    uniqueItems,
    repeatedItemId: repeated?.[0] ?? null,
    repeatedCount,
    style,
    explanation,
  };
}

function buildTimeline(
  pet: Pet,
  records: ExplainabilityRecord[],
  telemetry: PersonalityTelemetrySample[],
  events: PetEvent[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const telemetryByCommand = new Map(telemetry.map(sample => [sample.commandId, sample]));

  for (const record of records.slice(-40)) {
    const sample = telemetryByCommand.get(record.command.commandId);
    const traitImpacts = impactsFromMap(sample?.traitDrift ?? {}, TRAIT_LABELS).slice(0, 3);
    const behaviorImpacts = impactsFromMap(sample?.behaviorDrift ?? {}, BEHAVIOR_LABELS).slice(0, 3);
    const strongest = traitImpacts[0] ?? behaviorImpacts[0];
    entries.push({
      id: record.command.commandId,
      at: record.command.at,
      phase: phaseForPet(pet, sample?.formationComplete ?? pet.formationComplete),
      title: COMMAND_LABELS[record.command.type] ?? record.command.type,
      summary: strongest
        ? `Главный вклад: ${strongest.label} ${formatSigned(strongest.value)}.`
        : record.blockedAction
          ? `Действие заблокировано: ${record.blockedAction.reason}.`
          : 'Действие прошло без заметного изменения character-сигналов.',
      traitImpacts,
      behaviorImpacts,
      confidence: sample ? 85 : 45,
    });
  }

  for (const event of events.slice(-12)) {
    entries.push({
      id: `event-${event.id}`,
      at: event.timestamp,
      phase: event.type === 'evolve' ? 'evolution' : pet.formationComplete ? 'formed' : 'habit',
      title: event.description,
      summary: `Событие журнала: ${event.type}.`,
      traitImpacts: [],
      behaviorImpacts: [],
      confidence: 35,
    });
  }

  if (entries.length === 0 && pet.dailyTraitSnapshots.length > 0) {
    for (const snapshot of pet.dailyTraitSnapshots.slice(-7)) {
      entries.push({
        id: `snapshot-${snapshot.date}`,
        at: snapshot.date,
        phase: pet.formationComplete ? 'formed' : 'formation',
        title: 'Дневной снимок черт',
        summary: 'Engine сохранил дневное состояние trait vector.',
        traitImpacts: TRAIT_KEYS
          .map(key => ({
            key,
            label: TRAIT_LABELS[key],
            value: round1(snapshot.vector[key]),
            direction: snapshot.vector[key] > 55 ? 'up' as const : snapshot.vector[key] < 45 ? 'down' as const : 'neutral' as const,
            explanation: `${TRAIT_LABELS[key]}: ${round1(snapshot.vector[key])}.`,
          }))
          .sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50))
          .slice(0, 2),
        behaviorImpacts: [],
        confidence: 50,
      });
    }
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
}

function buildFormationStatus(pet: Pet): PersonalityAssistantReport['formationStatus'] {
  const progress = Math.max(0, Math.min(100, pet.formationProgress ?? 0));
  if (pet.formationComplete) {
    return {
      complete: true,
      progress: 100,
      label: 'Характер сформирован',
      explanation: `Текущий характер "${pet.personality}" уже выбран engine на основе trait vector и поведения.`,
    };
  }
  return {
    complete: false,
    progress: round1(progress),
    label: 'Характер формируется',
    explanation: `До формирования накоплено ${round1(progress)}%. На этом этапе каждое повторяемое действие влияет сильнее.`,
  };
}

function buildConfidence(
  pet: Pet,
  records: ExplainabilityRecord[],
  telemetry: PersonalityTelemetrySample[],
): PersonalityAssistantReport['confidence'] {
  const sampleCount = pet.behaviorProfile?.sampleCount ?? 0;
  const score = Math.max(10, Math.min(100,
    records.length * 4 + telemetry.length * 5 + sampleCount * 2 + pet.dailyTraitSnapshots.length * 4,
  ));
  const label = score >= 70 ? 'высокая' : score >= 35 ? 'средняя' : 'низкая';
  return {
    score: Math.round(score),
    label,
    explanation: label === 'высокая'
      ? 'Достаточно command/telemetry данных для объяснения.'
      : label === 'средняя'
        ? 'Есть часть истории, но некоторые причины восстановлены по текущему состоянию.'
        : 'Истории мало: помощник показывает тенденции, а не полный причинный разбор.',
  };
}

function impactsFromMap<T extends string>(
  values: Partial<Record<T, number>>,
  labels: Record<T, string>,
): WeightedInsight<T>[] {
  return (Object.entries(values) as Array<[T, number]>)
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => ({
      key,
      label: labels[key],
      value: round2(value),
      direction: value > 0 ? 'up' as const : value < 0 ? 'down' as const : 'neutral' as const,
      explanation: `${labels[key]} ${formatSigned(value)}.`,
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function strongestImpact(contribution: ActionContribution): number {
  return Math.max(
    Math.abs(contribution.traitImpacts[0]?.value ?? 0),
    Math.abs(contribution.behaviorImpacts[0]?.value ?? 0),
  );
}

function phaseForPet(pet: Pet, formationComplete: boolean): TimelineEntry['phase'] {
  if (pet.evolutionProposal || (pet.evolutionHistory?.length ?? 0) > 0) return 'evolution';
  if (formationComplete) return 'formed';
  if ((pet.formationProgress ?? 0) >= 60) return 'formation';
  if ((pet.behaviorProfile?.sampleCount ?? 0) >= 6) return 'habit';
  return 'early';
}

function normalizePersonalityId(value: string): PersonalityId {
  return (Object.keys(PERSONALITY_TRAIT_HOMES) as PersonalityId[]).includes(value as PersonalityId)
    ? value as PersonalityId
    : 'playful';
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${round2(value)}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
