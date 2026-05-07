import type { Account, Pet } from '../api/types';
import { getIntensityMultiplier } from './influenceRegistry';
import { TemplateGenerator, type MemoryTextGenerator } from './memoryTextGenerator';
import { PERSONALITIES } from './personalities';
import { EVOLUTION_LEGACY, PERSONALITY_TRAIT_MAP } from './personalityTraitMap';
import type {
  CoreMemory,
  InfluenceCategory,
  InfluenceCondition,
  PersonalityDefinition,
  PersonalityId,
  RegisteredInfluence,
  TraitKey,
  TraitVector,
} from './types';
import { TRAIT_KEYS } from './types';

export const DAILY_BUDGET: Record<TraitKey, number> = {
  vitality: 12,
  sociality: 8,
  order: 6,
  appetite: 10,
  caution: 8,
  curiosity: 10,
};

export const SMOOTHING_ALPHA = 0.08;
export const REGRESSION_RATE = 0.02;
export const FORMATION_THRESHOLD = 200;
export const HYSTERESIS = 8;
export const STABILITY_SYNCS = 72;
export const VOID_THRESHOLD_SYNCS = 7 * 24;
export const WEEKLY_DRIFT_THRESHOLD = 6;
export const MEMORY_COOLDOWN_MS = 72 * 60 * 60 * 1000;
export const CONFUSED_VARIANCE_THRESHOLD = 25;
export const MINIMUM_RESET_SLEEP_HOURS = 4;
export const VARIANCE_HARD_RESET_HOURS = 48;
export const SINGULARITY_EPSILON = 0.15;
export const SINGULARITY_THRESHOLD_SYNCS = 48;
export const SHADOW_FORM_TRAUMA_THRESHOLD = 75;
export const SHADOW_FORM_COOLDOWN_DAYS = 14;
export const CATHARSIS_THRESHOLD = 100;
export const LEGACY_BLEND_RATIO = 0.70;

export const FORMATION_WEIGHTS: Record<InfluenceCategory, number> = {
  action: 1.0,
  item: 1.5,
  training: 2.0,
  discipline: 1.5,
  cosmetic: 1.2,
  environment: 0.8,
  social: 2.0,
  system: 0.0,
};

const NEUTRAL_TRAIT_VECTOR: TraitVector = {
  vitality: 50,
  sociality: 50,
  order: 50,
  appetite: 50,
  caution: 50,
  curiosity: 50,
};

export interface TraitEvolutionContext {
  now?: Date;
  clientLocalHour?: number;
  getIntensityMultiplier?: (influenceId: string) => number;
  memoryTextGenerator?: MemoryTextGenerator;
  dominantInfluences?: string[];
  random?: () => number;
}

export interface ApplyInfluenceResult {
  prevVector: TraitVector;
  budgetedDelta: Partial<TraitVector>;
}

export function canApplyInfluenceAtSync(
  lastAppliedAt: number | undefined,
  currentSync: number,
  cooldownSyncs = 0,
): boolean {
  return lastAppliedAt === undefined || currentSync - lastAppliedAt >= cooldownSyncs;
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function createInitialTraitVector(
  legacyVector?: TraitVector,
  legacyCoefficient = 0.15,
): TraitVector {
  if (!legacyVector) return { ...NEUTRAL_TRAIT_VECTOR };

  return TRAIT_KEYS.reduce((acc, key) => {
    acc[key] = NEUTRAL_TRAIT_VECTOR[key] + (legacyVector[key] - 50) * legacyCoefficient;
    return acc;
  }, {} as TraitVector);
}

export function getDynamicRadius(personality: PersonalityDefinition | PersonalityId, ageHours: number): number {
  const id = typeof personality === 'string' ? personality : personality.id;
  const base = PERSONALITY_TRAIT_MAP[id].radiusBase;
  const ageDays = ageHours / 24;
  if (ageDays < 7) return base - 3;
  if (ageDays < 30) return base;
  if (ageDays < 90) return base + 4;
  return base + 8;
}

export function euclideanDistance(a: TraitVector, b: TraitVector): number {
  const sum = TRAIT_KEYS.reduce((acc, key) => acc + (a[key] - b[key]) ** 2, 0);
  return Math.sqrt(sum / TRAIT_KEYS.length);
}

export function depthOfImmersion(vector: TraitVector, personalityId: PersonalityId, ageHours: number): number {
  const home = PERSONALITY_TRAIT_MAP[personalityId];
  const radius = getDynamicRadius(personalityId, ageHours);
  const distance = euclideanDistance(vector, home.position);
  return (radius - distance) / radius;
}

export function applyInfluence(
  pet: Pet,
  influence: RegisteredInfluence,
  ctx: TraitEvolutionContext = {},
): ApplyInfluenceResult {
  const prevVector = { ...pet.traitVector };
  const budgetedDelta: Partial<TraitVector> = {};
  const intensity = computeIntensity(influence, pet, ctx);
  const multiplier = (ctx.getIntensityMultiplier ?? getIntensityMultiplier)(influence.id);

  for (const key of TRAIT_KEYS) {
    const delta = influence.traitDeltas[key];
    if (delta === undefined) continue;

    const rawDelta = delta * intensity * multiplier;
    const spent = pet.dailyTraitBudget[key] ?? 0;
    const remaining = Math.max(0, DAILY_BUDGET[key] - spent);
    const applied = clamp(rawDelta, -remaining, remaining);

    budgetedDelta[key] = applied;
    pet.dailyTraitBudget[key] = spent + Math.abs(applied);
    pet.traitVector[key] = clamp(pet.traitVector[key] + applied * SMOOTHING_ALPHA, 0, 100);
  }

  const posSum = TRAIT_KEYS.reduce((sum, key) => sum + Math.max(0, budgetedDelta[key] ?? 0), 0);
  const negSum = TRAIT_KEYS.reduce((sum, key) => sum + Math.abs(Math.min(0, budgetedDelta[key] ?? 0)), 0);
  pet.dailyVectorVariance += posSum + negSum;
  updateConfusedState(pet);

  if (influence.traumaDelta !== undefined) {
    pet.traumaLevel = clamp(pet.traumaLevel + influence.traumaDelta, 0, 100);
    checkShadowForm(pet, ctx);
  }

  updateFormationProgress(pet, influence, budgetedDelta, ctx);

  return { prevVector, budgetedDelta };
}

export function applyRegression(pet: Pet): void {
  const home = PERSONALITY_TRAIT_MAP[pet.personality as PersonalityId]?.position;
  if (!home) return;

  for (const key of TRAIT_KEYS) {
    pet.traitVector[key] = clamp(
      pet.traitVector[key] + (home[key] - pet.traitVector[key]) * REGRESSION_RATE,
      0,
      100,
    );
  }
}

export function recordDailyTraitSnapshot(pet: Pet, now: Date, maxSnapshots = 30): boolean {
  const date = now.toISOString().slice(0, 10);
  const lastSnapshot = pet.dailyTraitSnapshots[pet.dailyTraitSnapshots.length - 1];

  if (lastSnapshot?.date === date) {
    lastSnapshot.vector = { ...pet.traitVector };
    return false;
  }

  pet.dailyTraitSnapshots.push({ date, vector: { ...pet.traitVector } });
  if (pet.dailyTraitSnapshots.length > maxSnapshots) pet.dailyTraitSnapshots.shift();
  pet.dailyTraitBudget = {};
  return true;
}

export function updateFormationProgress(
  pet: Pet,
  influence: RegisteredInfluence,
  budgetedDelta: Partial<TraitVector>,
  ctx: TraitEvolutionContext = {},
): void {
  if (pet.formationComplete) return;

  const deltaSum = TRAIT_KEYS.reduce((sum, key) => sum + Math.abs(budgetedDelta[key] ?? 0), 0);
  pet.formationProgress = Math.min(
    FORMATION_THRESHOLD,
    pet.formationProgress + deltaSum * (FORMATION_WEIGHTS[influence.category] ?? 1.0),
  );

  if (pet.formationProgress >= FORMATION_THRESHOLD) {
    completeFormation(pet, ctx);
  }
}

export function completeFormation(pet: Pet, ctx: TraitEvolutionContext = {}): void {
  const starter = PERSONALITIES
    .map(p => ({ id: p.id, depth: depthOfImmersion(pet.traitVector, p.id, 0) }))
    .reduce((best, candidate) => (candidate.depth > best.depth ? candidate : best));

  pet.personality = starter.id;
  pet.formationComplete = true;

  const personality = PERSONALITIES.find(p => p.id === starter.id);
  addCoreMemory(pet, {
    tier: 'rare',
    emoji: '🥚',
    text: `Характер сформировался: ${personality?.name ?? starter.id}`,
    category: 'system',
    traitKey: 'vitality',
    direction: 'origin',
  }, ctx);
}

export function checkEvolution(pet: Pet, ctx: TraitEvolutionContext = {}): void {
  if (checkSingularity(pet, ctx)) return;
  if (checkShadowForm(pet, ctx)) return;

  const currentPersonalityId = pet.personality as PersonalityId;
  const currentHome = PERSONALITY_TRAIT_MAP[currentPersonalityId];
  if (!currentHome) return;

  const currentDepth = depthOfImmersion(pet.traitVector, currentPersonalityId, pet.ageHours);

  if (currentDepth > 0) {
    pet.currentTargetZone = null;
    pet.ticksInTargetZone = 0;
    pet.evolutionProposal = undefined;
    pet.voidSyncs = 0;
    return;
  }

  const best = PERSONALITIES
    .filter(p => p.id !== currentPersonalityId)
    .map(p => ({ id: p.id, depth: depthOfImmersion(pet.traitVector, p.id, pet.ageHours) }))
    .reduce((a, b) => (a.depth > b.depth ? a : b));

  if (best.depth <= 0) {
    handleVoidState(pet, ctx);
    return;
  }

  pet.voidSyncs = 0;

  if (pet.currentTargetZone !== best.id) {
    pet.currentTargetZone = best.id;
    pet.ticksInTargetZone = 0;
  }

  pet.ticksInTargetZone++;

  const currentDepthAbs = Math.abs(currentDepth) * getDynamicRadius(currentPersonalityId, pet.ageHours);
  if (currentDepthAbs < HYSTERESIS) return;
  if (pet.ticksInTargetZone < STABILITY_SYNCS) return;

  pet.evolutionProposal = {
    targetPersonalityId: best.id,
    readiness: Math.min(100, Math.round((pet.ticksInTargetZone / STABILITY_SYNCS) * 100)),
    depth: best.depth,
    proposedAt: getNow(ctx).toISOString(),
    coreMemoryIds: selectRelevantMemories(pet, best.id),
    narrativeText: createEvolutionProposalText(pet, best.id),
  };
}

export function acceptEvolution(pet: Pet, ctx: TraitEvolutionContext = {}): boolean {
  const proposal = pet.evolutionProposal;
  if (!proposal) return false;

  const fromPersonalityId = pet.personality as PersonalityId;
  const targetPersonalityId = proposal.targetPersonalityId;
  const targetPersonality = PERSONALITIES.find(p => p.id === targetPersonalityId);
  const now = getNow(ctx).toISOString();

  pet.personality = targetPersonalityId;
  pet.evolutionHistory.push({
    fromPersonalityId,
    toPersonalityId: targetPersonalityId,
    evolvedAt: now,
    trigger: 'stability',
    coreMemoryIds: proposal.coreMemoryIds,
  });
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  pet.evolutionProposal = undefined;
  pet.voidSyncs = 0;
  if (pet.emergentState === 'identity_crisis' || pet.emergentState === 'confused') {
    pet.emergentState = null;
    pet.emergentStateEnteredAt = undefined;
  }

  addCoreMemory(pet, {
    tier: 'rare',
    emoji: targetPersonality?.emoji ?? '🌟',
    text: `Выбран новый путь: ${targetPersonality?.name ?? targetPersonalityId}`,
    category: 'system',
    traitKey: getDominantDriftAxis(pet.traitVector, targetPersonalityId),
    direction: 'origin',
    personalityHint: targetPersonalityId,
  }, ctx);

  return true;
}

export function rejectEvolution(pet: Pet): boolean {
  if (!pet.evolutionProposal) return false;

  pet.evolutionProposal = undefined;
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  return true;
}

export interface SingularityState {
  zones: PersonalityId[];
}

export function detectSingularity(pet: Pet): SingularityState | null {
  const inside = PERSONALITIES
    .map(p => ({ id: p.id, depth: depthOfImmersion(pet.traitVector, p.id, pet.ageHours) }))
    .filter(x => x.depth > 0)
    .sort((a, b) => b.depth - a.depth);

  if (inside.length < 3) return null;
  if (inside[0].depth - inside[2].depth >= SINGULARITY_EPSILON) return null;

  return { zones: inside.slice(0, 3).map(x => x.id) };
}

export function checkSingularity(pet: Pet, ctx: TraitEvolutionContext = {}): boolean {
  const state = detectSingularity(pet);

  if (!state) {
    if ((pet.ticksInSingularity ?? 0) > 0) collapseSingularity(pet, ctx);
    pet.ticksInSingularity = 0;
    pet.singularityZones = [];
    return false;
  }

  pet.singularityZones = state.zones;
  pet.ticksInSingularity = (pet.ticksInSingularity ?? 0) + 1;
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  pet.evolutionProposal = undefined;
  pet.voidSyncs = 0;

  if (pet.ticksInSingularity >= SINGULARITY_THRESHOLD_SYNCS && pet.emergentState !== 'singularity') {
    pet.emergentState = 'singularity';
    pet.emergentStateEnteredAt = getNow(ctx).toISOString();
    addCoreMemory(pet, {
      tier: 'rare',
      emoji: '✨',
      text: 'Грани характера слились в единое',
      category: 'system',
      traitKey: 'curiosity',
      direction: 'up',
    }, ctx);
  }

  return true;
}

export function collapseSingularity(pet: Pet, ctx: TraitEvolutionContext = {}): void {
  if (!pet.singularityZones.length) return;

  const fromPersonalityId = pet.personality as PersonalityId;
  const random = ctx.random ?? Math.random;
  const target = pet.singularityZones[Math.floor(random() * pet.singularityZones.length)] ?? pet.singularityZones[0];
  const now = getNow(ctx).toISOString();

  pet.personality = target;
  pet.emergentState = null;
  pet.emergentStateEnteredAt = undefined;
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  pet.evolutionProposal = undefined;
  pet.ticksInSingularity = 0;
  pet.singularityZones = [];
  pet.evolutionHistory.push({
    fromPersonalityId,
    toPersonalityId: target,
    evolvedAt: now,
    trigger: 'singularity',
  });

  const targetPersonality = PERSONALITIES.find(p => p.id === target);
  addCoreMemory(pet, {
    tier: 'rare',
    emoji: targetPersonality?.emoji ?? '🌀',
    text: `Схлопнулся в ${targetPersonality?.name ?? target}`,
    category: 'system',
    traitKey: 'vitality',
    direction: 'origin',
    personalityHint: target,
  }, ctx);
}

export function canEnterShadowForm(pet: Pet, ctx: TraitEvolutionContext = {}): boolean {
  const now = getNow(ctx);
  if (pet.traumaCooldownUntil && now < new Date(pet.traumaCooldownUntil)) return false;
  return pet.traumaLevel >= SHADOW_FORM_TRAUMA_THRESHOLD;
}

export function checkShadowForm(pet: Pet, ctx: TraitEvolutionContext = {}): boolean {
  if (pet.emergentState === 'shadow_form') return true;
  if (!canEnterShadowForm(pet, ctx)) return false;

  pet.emergentState = 'shadow_form';
  pet.emergentStateEnteredAt = getNow(ctx).toISOString();
  pet.catharsisProgress = Math.max(0, pet.catharsisProgress ?? 0);
  pet.evolutionProposal = undefined;
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  return true;
}

export function exitShadowForm(pet: Pet, ctx: TraitEvolutionContext = {}): void {
  pet.emergentState = null;
  pet.emergentStateEnteredAt = undefined;
  pet.traumaLevel = 0;
  pet.catharsisProgress = 0;

  const cooldown = new Date(getNow(ctx).getTime());
  cooldown.setDate(cooldown.getDate() + SHADOW_FORM_COOLDOWN_DAYS);
  pet.traumaCooldownUntil = cooldown.toISOString();
}

export function triggerCatharsis(pet: Pet, ctx: TraitEvolutionContext = {}): void {
  const firstCatharsis = !pet.catharsisAchieved;
  exitShadowForm(pet, ctx);
  pet.catharsisAchieved = true;

  addCoreMemory(pet, {
    tier: 'rare',
    emoji: '🌅',
    text: firstCatharsis ? 'Прошли через тьму вместе' : 'Снова нашли путь из тени',
    category: 'system',
    traitKey: 'sociality',
    direction: 'up',
  }, ctx);
}

export function addCatharsisProgress(
  pet: Pet,
  amount: number,
  ctx: TraitEvolutionContext = {},
): boolean {
  if (pet.emergentState !== 'shadow_form') return false;

  pet.catharsisProgress = clamp((pet.catharsisProgress ?? 0) + amount, 0, CATHARSIS_THRESHOLD);
  if (pet.catharsisProgress < CATHARSIS_THRESHOLD) return false;

  triggerCatharsis(pet, ctx);
  return true;
}

export function recordLegacy(
  account: Account,
  pet: Pet,
  ctx: TraitEvolutionContext = {},
): Account {
  const nextVector = account.legacyVector
    ? TRAIT_KEYS.reduce((acc, key) => {
        acc[key] = pet.traitVector[key] * LEGACY_BLEND_RATIO
          + account.legacyVector![key] * (1 - LEGACY_BLEND_RATIO);
        return acc;
      }, {} as TraitVector)
    : { ...pet.traitVector };

  const lastEvolution = pet.evolutionHistory[pet.evolutionHistory.length - 1];
  const hasLegacyRarity = Boolean(lastEvolution && EVOLUTION_LEGACY[lastEvolution.toPersonalityId]);
  const lastName = PERSONALITIES.find(p => p.id === pet.personality)?.name ?? pet.personality;
  const nextGeneration = (account.legacyGeneration ?? 0) + 1;

  account.legacyVector = nextVector;
  account.legacyCoefficient = hasLegacyRarity ? 0.20 : 0.15;
  account.legacyGeneration = nextGeneration;
  account.legacyDescription = nextGeneration === 1
    ? `Память пути ${lastName}`
    : `Путь продолжается: жизнь ${nextGeneration}`;
  account.memoryGuardian = {
    name: pet.name,
    personalityId: pet.personality as PersonalityId,
    archivedMemories: pet.coreMemories
      .filter(memory => memory.tier === 'rare')
      .slice(0, 5)
      .map(memory => ({
        emoji: memory.emoji,
        text: memory.text,
        tier: memory.tier,
        traitKey: memory.traitKey,
        personalityHint: memory.personalityHint,
      })),
    guidance: createGuardianGuidance(pet),
    updatedAt: getNow(ctx).toISOString(),
  };

  return account;
}

function createGuardianGuidance(pet: Pet): string[] {
  const guidance: string[] = [];

  if (pet.traumaLevel >= 50 || pet.catharsisAchieved) {
    guidance.push('Мягкие действия и регулярные объятия лучше всего восстанавливают доверие.');
  }

  if (pet.confusedState || pet.dailyVectorVariance >= CONFUSED_VARIANCE_THRESHOLD) {
    guidance.push('После насыщенного дня помогает непрерывный сон не меньше четырёх часов.');
  }

  if (pet.behavioralFlags.some(flag => flag.type === 'night_disruption')) {
    guidance.push('Ранние пробуждения усиливали тревожность, поэтому сон лучше не прерывать.');
  }

  if (pet.behavioralFlags.some(flag => flag.type === 'food_anxiety')) {
    guidance.push('Кормление до сильного голода помогает держать пищевую тревогу ниже.');
  }

  if (pet.evolutionHistory.some(record => record.trigger === 'singularity')) {
    guidance.push('Баланс между несколькими чертами может открыть редкую быструю метаморфозу.');
  }

  if (guidance.length === 0) {
    guidance.push('Стабильный ритм заботы помогает новой форме расти спокойнее.');
  }

  return guidance.slice(0, 3);
}

export function handleVoidState(pet: Pet, ctx: TraitEvolutionContext = {}): void {
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  pet.evolutionProposal = undefined;
  pet.voidSyncs = (pet.voidSyncs ?? 0) + 1;

  if (pet.voidSyncs >= VOID_THRESHOLD_SYNCS && pet.emergentState !== 'identity_crisis') {
    pet.emergentState = 'identity_crisis';
    pet.emergentStateEnteredAt = getNow(ctx).toISOString();
  }
}

export function updateConfusedState(pet: Pet): void {
  pet.confusedState = pet.dailyVectorVariance >= CONFUSED_VARIANCE_THRESHOLD;
}

export function onStartSleep(pet: Pet, ctx: TraitEvolutionContext = {}): void {
  pet.sleepStartedAt = getNow(ctx).toISOString();
}

export function onWakeFromSleep(
  pet: Pet,
  naturalWake: boolean,
  ctx: TraitEvolutionContext = {},
): void {
  const now = getNow(ctx);

  if (pet.sleepStartedAt) {
    const sleptHours = (now.getTime() - new Date(pet.sleepStartedAt).getTime()) / 3_600_000;
    if (naturalWake && sleptHours >= MINIMUM_RESET_SLEEP_HOURS) {
      pet.dailyVectorVariance = 0;
      pet.confusedState = false;
      pet.lastSleepTimestamp = now.toISOString();
    }
  }

  pet.sleepStartedAt = null;
}

export function checkVarianceHardReset(pet: Pet, ctx: TraitEvolutionContext = {}): void {
  if (!pet.lastSleepTimestamp) return;

  const hoursSinceSleep = (
    getNow(ctx).getTime() - new Date(pet.lastSleepTimestamp).getTime()
  ) / 3_600_000;

  if (hoursSinceSleep >= VARIANCE_HARD_RESET_HOURS) {
    pet.dailyVectorVariance = 0;
    pet.confusedState = false;
  }
}

export async function checkThresholdCrossings(
  pet: Pet,
  prevVector: TraitVector,
  ctx: TraitEvolutionContext = {},
): Promise<void> {
  const generator = getMemoryTextGenerator(ctx);

  for (const personality of PERSONALITIES) {
    if (personality.id === pet.personality) continue;

    const wasOutside = depthOfImmersion(prevVector, personality.id, pet.ageHours) <= 0;
    const isInside = depthOfImmersion(pet.traitVector, personality.id, pet.ageHours) > 0;
    if (!wasOutside || !isInside || pet.visitedZones.includes(personality.id)) continue;

    pet.visitedZones.push(personality.id);
    const traitKey = getDominantDriftAxis(pet.traitVector, personality.id);
    const text = await generator.generate({
      personality,
      ageHours: pet.ageHours,
      traitKey,
      direction: 'up',
      category: 'system',
      emergentState: pet.emergentState,
      dominantInfluences: ctx.dominantInfluences ?? [],
    });

    addCoreMemory(pet, {
      tier: 'rare',
      emoji: personality.emoji,
      text,
      category: 'system',
      traitKey,
      direction: 'up',
      personalityHint: personality.id,
    }, ctx);
  }
}

export async function checkWeeklyDrift(pet: Pet, ctx: TraitEvolutionContext = {}): Promise<void> {
  if (pet.dailyTraitSnapshots.length < 7) return;

  const weekAvg = computeWeeklyAverage(pet.dailyTraitSnapshots.slice(-7).map(snapshot => snapshot.vector));
  const now = getNow(ctx);
  const generator = getMemoryTextGenerator(ctx);
  const personality = PERSONALITIES.find(p => p.id === pet.personality) ?? PERSONALITIES[0];

  for (const key of TRAIT_KEYS) {
    const delta = pet.traitVector[key] - weekAvg[key];
    if (Math.abs(delta) < WEEKLY_DRIFT_THRESHOLD) continue;

    const direction = delta > 0 ? 'up' : 'down';
    const cooldownKey = `${key}_${direction}` as `${TraitKey}_${'up' | 'down'}`;
    const lastTimestamp = pet.lastMemoryTimestamp[cooldownKey];

    if (lastTimestamp && now.getTime() - new Date(lastTimestamp).getTime() < MEMORY_COOLDOWN_MS) {
      continue;
    }

    const text = await generator.generate({
      personality,
      ageHours: pet.ageHours,
      traitKey: key,
      direction,
      category: 'system',
      emergentState: pet.emergentState,
      dominantInfluences: ctx.dominantInfluences ?? [],
    });

    addCoreMemory(pet, {
      tier: 'common',
      emoji: direction === 'up' ? '⬆️' : '⬇️',
      text,
      category: 'system',
      traitKey: key,
      direction,
    }, ctx);
    pet.lastMemoryTimestamp[cooldownKey] = now.toISOString();
    break;
  }
}

export function addCoreMemory(
  pet: Pet,
  memory: Omit<CoreMemory, 'id' | 'timestamp'>,
  ctx: TraitEvolutionContext = {},
): CoreMemory {
  const timestamp = getNow(ctx).toISOString();
  const coreMemory: CoreMemory = {
    id: `mem-${timestamp}-${pet.coreMemories.length + 1}`,
    timestamp,
    ...memory,
  };

  pet.coreMemories.unshift(coreMemory);
  const rare = pet.coreMemories.filter(m => m.tier === 'rare');
  const common = pet.coreMemories.filter(m => m.tier === 'common').slice(0, 20);
  pet.coreMemories = [...rare, ...common].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return coreMemory;
}

export function computeWeeklyAverage(vectors: TraitVector[]): TraitVector {
  const count = Math.max(1, vectors.length);
  return TRAIT_KEYS.reduce((acc, key) => {
    acc[key] = vectors.reduce((sum, vector) => sum + vector[key], 0) / count;
    return acc;
  }, {} as TraitVector);
}

function selectRelevantMemories(pet: Pet, targetPersonalityId: PersonalityId): string[] {
  return pet.coreMemories
    .filter(memory => memory.tier === 'rare' || memory.personalityHint === targetPersonalityId)
    .slice(0, 3)
    .map(memory => memory.id);
}

function createEvolutionProposalText(pet: Pet, targetPersonalityId: PersonalityId): string {
  const target = PERSONALITIES.find(p => p.id === targetPersonalityId);
  const rareCount = pet.coreMemories.filter(memory => memory.tier === 'rare').length;
  const name = target?.name ?? targetPersonalityId;

  if (rareCount > 0) {
    return `Воспоминания складываются в новый устойчивый путь: ${name}.`;
  }

  return `Повседневная забота ведёт характер к новому пути: ${name}.`;
}

function getDominantDriftAxis(vector: TraitVector, personalityId: PersonalityId): TraitKey {
  const target = PERSONALITY_TRAIT_MAP[personalityId].position;
  return TRAIT_KEYS.reduce((best, key) => {
    return Math.abs(vector[key] - target[key]) > Math.abs(vector[best] - target[best]) ? key : best;
  }, TRAIT_KEYS[0]);
}

function getMemoryTextGenerator(ctx: TraitEvolutionContext): MemoryTextGenerator {
  return ctx.memoryTextGenerator ?? new TemplateGenerator();
}

function computeIntensity(
  influence: RegisteredInfluence,
  pet: Pet,
  ctx: TraitEvolutionContext,
): number {
  return (influence.intensityRules ?? []).reduce((value, rule) => {
    return matchesInfluenceCondition(rule.condition, pet, ctx) ? value * rule.multiplier : value;
  }, 1);
}

function matchesInfluenceCondition(
  condition: InfluenceCondition,
  pet: Pet,
  ctx: TraitEvolutionContext,
): boolean {
  const params = condition.params;

  switch (condition.type) {
    case 'time_of_day': {
      const from = Number(params.from);
      const to = Number(params.to);
      const hour = ctx.clientLocalHour ?? getNow(ctx).getHours();
      return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
    }
    case 'flag_active':
      return typeof params.flag === 'string' && pet.behavioralFlags.some(flag => flag.type === params.flag);
    case 'personality_is':
      return params.id === pet.personality;
    case 'trait_above':
      return typeof params.key === 'string' && pet.traitVector[params.key as TraitKey] > Number(params.value);
    case 'trait_below':
      return typeof params.key === 'string' && pet.traitVector[params.key as TraitKey] < Number(params.value);
    case 'formation_period':
      return Boolean(params.active) !== pet.formationComplete;
    case 'streak_days':
      return false;
  }
}

function getNow(ctx: TraitEvolutionContext): Date {
  return ctx.now ?? new Date();
}
