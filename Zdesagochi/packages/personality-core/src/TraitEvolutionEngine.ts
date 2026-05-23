import type { PersonalityAccount, PersonalityMemoryTextGenerator, PersonalityNamedState, PersonalityState } from './coreState';
import { EVOLUTION_LEGACY, PERSONALITY_TRAIT_MAP } from './personalityTraitMap';
import { PERSONALITY_BEHAVIOR_EVIDENCE } from './personalityCatalog';
import { rollingItemCounts } from './PersonalityEngine';
import { clearLayeredEmergentState, setLayeredEmergentState } from './stateLayers';
import type {
  BehaviorProfile,
  BehaviorVector,
  CoreMemory,
  InfluenceCategory,
  InfluenceCondition,
  PersonalityDefinition,
  PersonalityId,
  RegisteredInfluence,
  StatKey,
  TraitKey,
  TraitVector,
} from './types';
import { BEHAVIOR_AXES, TRAIT_KEYS } from './types';

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
export const RARE_CORE_MEMORY_CAP = 50;
export const COMMON_CORE_MEMORY_CAP = 20;
export const CONFUSED_VARIANCE_THRESHOLD = 25;
export const MINIMUM_RESET_SLEEP_HOURS = 4;
export const VARIANCE_HARD_RESET_HOURS = 48;
export const SINGULARITY_EPSILON = 0.15;
export const SINGULARITY_THRESHOLD_SYNCS = 48;
export const SHADOW_FORM_TRAUMA_THRESHOLD = 75;
export const SHADOW_FORM_COOLDOWN_DAYS = 14;
export const CATHARSIS_THRESHOLD = 100;
export const LEGACY_BLEND_RATIO = 0.70;
export const PRE_FORMATION_SENSITIVITY_MULTIPLIER = 5.0;
export const POST_FORMATION_ADAPTATION_MULTIPLIER = 4.0;
export const BEHAVIOR_PROFILE_DECAY_PER_DAY = 0.96;
export const BEHAVIOR_PROFILE_EVOLUTION_MIN_SAMPLES = 24;
export const BEHAVIOR_PROFILE_EVOLUTION_THRESHOLD = 28;
export const EVOLUTION_READINESS_THRESHOLD = 100;
export const EVOLUTION_READINESS_GAIN_PER_CONFIRMED_SYNC = 35;
export const EVOLUTION_READINESS_DECAY_PER_SYNC = 2;
export const NEAR_TARGET_READINESS_MARGIN = 0.25;
export const NEAR_TARGET_READINESS_GAIN_MULTIPLIER = 0.60;
export const BEHAVIOR_TARGET_DEPTH_BONUS = 0.45;

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
  memoryTextGenerator?: PersonalityMemoryTextGenerator;
  personalities?: PersonalityDefinition[];
  dominantInfluences?: string[];
  sensitivityStats?: Partial<Record<StatKey, number>>;
  enableContextSensitivity?: boolean;
  enablePreFormationSensitivity?: boolean;
  random?: () => number;
  rng?: () => number;
}

export interface ApplyInfluenceResult {
  prevVector: TraitVector;
  budgetedDelta: Partial<TraitVector>;
  applied: boolean;
  blockedConditions?: InfluenceCondition[];
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

export function createInitialBehaviorProfile(overrides: Partial<BehaviorProfile> = {}): BehaviorProfile {
  return {
    axes: {
      care: 0,
      play: 0,
      social: 0,
      order: 0,
      exploration: 0,
      disruption: 0,
      recovery: 0,
      ...(overrides.axes ?? {}),
    },
    sampleCount: overrides.sampleCount ?? 0,
    lastUpdatedAt: overrides.lastUpdatedAt,
  };
}

export function updateBehaviorProfile(
  pet: PersonalityState,
  influenceId: string,
  ctx: TraitEvolutionContext = {},
  behaviorDeltas?: Partial<BehaviorVector>,
): void {
  const signal = behaviorDeltas ?? getBehaviorSignalForInfluence(influenceId);
  if (!signal) return;

  const now = getNow(ctx);
  const profile = normalizeBehaviorProfile(pet.behaviorProfile);
  const axes = decayBehaviorAxes(profile, now);

  for (const axis of BEHAVIOR_AXES) {
    axes[axis] = clamp(axes[axis] + (signal[axis] ?? 0), 0, 100);
  }

  pet.behaviorProfile = {
    axes,
    sampleCount: Math.min(10_000, profile.sampleCount + 1),
    lastUpdatedAt: now.toISOString(),
  };
}

export function applyItemBehaviorStyle(
  pet: PersonalityState,
  command: { type: 'add_item' | 'use_item'; itemId: string; itemKind?: string; quantity?: number },
  ctx: TraitEvolutionContext = {},
): boolean {
  const now = getNow(ctx);
  const itemCounts = rollingItemCounts(pet.behavioralCounters, 'both', 7, now);
  const total7d = Object.values(itemCounts).reduce((sum, count) => sum + count, 0);
  const unique7d = Object.keys(itemCounts).length;
  const maxRepeat7d = Math.max(0, ...Object.values(itemCounts));
  const repeatRatio = total7d > 0 ? maxRepeat7d / total7d : 0;
  const personalityId = pet.formationComplete ? pet.personality as PersonalityId : null;
  const traitDeltas: Partial<Record<TraitKey, number>> = {};
  const behaviorSignal: Partial<BehaviorVector> = {};

  if (command.type === 'add_item') {
    const quantity = clamp(Math.floor(command.quantity ?? 1), 1, 5);
    addTraitDeltas(traitDeltas, { curiosity: 0.45 * quantity, order: 0.35 * quantity });
    addBehaviorSignal(behaviorSignal, { exploration: 0.45 * quantity, order: 0.35 * quantity });
    if (command.itemKind === 'decoration') {
      addTraitDeltas(traitDeltas, { order: 0.35, sociality: 0.2 });
      addBehaviorSignal(behaviorSignal, { order: 0.4, social: 0.2 });
    }
  } else {
    addTraitDeltas(traitDeltas, { curiosity: 0.35, vitality: 0.2, caution: -0.25 });
    addBehaviorSignal(behaviorSignal, { exploration: 0.35, play: command.itemKind === 'toy' ? 0.35 : 0 });
  }

  if (total7d >= 4 && unique7d >= 3) {
    const mult = personalityItemStyleMultiplier(personalityId, 'diverse');
    addTraitDeltas(traitDeltas, {
      curiosity: 1.15 * mult,
      sociality: 0.35 * mult,
      caution: -0.25 * mult,
    });
    addBehaviorSignal(behaviorSignal, {
      exploration: 1.25 * mult,
      play: 0.35 * mult,
      social: 0.25 * mult,
    });
  }

  if (total7d >= 4 && repeatRatio >= 0.65) {
    const mult = personalityItemStyleMultiplier(personalityId, 'repetitive');
    addTraitDeltas(traitDeltas, {
      caution: 0.9 * mult,
      order: 0.5 * mult,
      curiosity: -0.35 * mult,
    });
    addBehaviorSignal(behaviorSignal, {
      order: 0.65 * mult,
      recovery: 0.25 * mult,
      disruption: 0.35 * mult,
    });
  }

  if (total7d >= 6) {
    const mult = personalityItemStyleMultiplier(personalityId, 'frequent');
    addTraitDeltas(traitDeltas, {
      curiosity: 0.45 * mult,
      vitality: 0.35 * mult,
      order: -0.2 * mult,
    });
    addBehaviorSignal(behaviorSignal, {
      exploration: 0.45 * mult,
      play: 0.35 * mult,
    });
  }

  const appliedTraits = applyDirectTraitDeltas(pet, traitDeltas, ctx);
  const appliedBehavior = applyBehaviorSignal(pet, behaviorSignal, ctx);

  if (appliedTraits) {
    updateFormationProgress(pet, {
      id: `item_style:${command.type}`,
      category: 'item',
      label: 'Item behavior style',
      traitDeltas,
    }, traitDeltas as Partial<TraitVector>, ctx);
  }

  return appliedTraits || appliedBehavior;
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
  return Math.sqrt(sum);
}

export function depthOfImmersion(vector: TraitVector, personalityId: PersonalityId, ageHours: number): number {
  const home = PERSONALITY_TRAIT_MAP[personalityId];
  const radius = getDynamicRadius(personalityId, ageHours);
  const distance = euclideanDistance(vector, home.position);
  return (radius - distance) / radius;
}

export function applyInfluence(
  pet: PersonalityState,
  influence: RegisteredInfluence,
  ctx: TraitEvolutionContext = {},
): ApplyInfluenceResult {
  const prevVector = { ...pet.traitVector };
  const budgetedDelta: Partial<TraitVector> = {};
  const blockedConditions = getBlockedInfluenceConditions(pet, influence, ctx);
  if (blockedConditions.length > 0) {
    return { prevVector, budgetedDelta, applied: false, blockedConditions };
  }

  const intensity = computeIntensity(influence, pet, ctx);
  const multiplier = (ctx.getIntensityMultiplier ?? (() => 1))(influence.id);

  for (const key of TRAIT_KEYS) {
    const delta = influence.traitDeltas[key];
    if (delta === undefined) continue;

    const contextMultiplier = ctx.enableContextSensitivity
      ? getContextSensitivityMultiplier(influence.id, ctx.sensitivityStats ?? pet.stats, key)
      : 1;
    const rawDelta = delta * intensity * multiplier * contextMultiplier;
    const spent = pet.dailyTraitBudget[key] ?? 0;
    const remaining = Math.max(0, DAILY_BUDGET[key] - spent);
    const applied = clamp(rawDelta, -remaining, remaining);
    const sensitivityMultiplier = !pet.formationComplete
      ? (ctx.enablePreFormationSensitivity ? PRE_FORMATION_SENSITIVITY_MULTIPLIER : 1)
      : POST_FORMATION_ADAPTATION_MULTIPLIER;

    budgetedDelta[key] = applied;
    pet.dailyTraitBudget[key] = spent + Math.abs(applied);
    pet.traitVector[key] = clamp(
      pet.traitVector[key] + applied * SMOOTHING_ALPHA * sensitivityMultiplier,
      0,
      100,
    );
  }

  const posSum = TRAIT_KEYS.reduce((sum, key) => sum + Math.max(0, budgetedDelta[key] ?? 0), 0);
  const negSum = TRAIT_KEYS.reduce((sum, key) => sum + Math.abs(Math.min(0, budgetedDelta[key] ?? 0)), 0);
  pet.dailyVectorVariance += posSum + negSum;
  updateConfusedState(pet, ctx);

  if (influence.traumaDelta !== undefined) {
    pet.traumaLevel = clamp(pet.traumaLevel + influence.traumaDelta, 0, 100);
    checkShadowForm(pet, ctx);
  }

  updateFormationProgress(pet, influence, budgetedDelta, ctx);

  return { prevVector, budgetedDelta, applied: true };
}

function getContextSensitivityMultiplier(
  influenceId: string,
  stats: Partial<Record<StatKey, number>>,
  traitKey: TraitKey,
): number {
  switch (influenceId) {
    case 'action:feed': {
      const hunger = stats.hunger ?? 50;
      if (hunger <= 30) return traitKey === 'appetite' ? 0.5 : 1.4;
      if (hunger >= 90) return traitKey === 'appetite' ? 1.2 : 0.65;
      return 1;
    }
    case 'action:play': {
      const happiness = stats.happiness ?? 50;
      const energy = stats.energy ?? 50;
      if (energy <= 25) return 0.65;
      if (happiness <= 45 && energy >= 35) return 1.35;
      return 1;
    }
    case 'action:sleep_natural': {
      const energy = stats.energy ?? 50;
      if (energy <= 30) return 1.5;
      return 1;
    }
    case 'action:sleep_forced': {
      const energy = stats.energy ?? 50;
      if (energy >= 80) return 1.35;
      return 1;
    }
    case 'action:bathe': {
      const cleanliness = stats.cleanliness ?? 50;
      if (cleanliness <= 35) return 1.4;
      if (cleanliness >= 90) return 0.7;
      return 1;
    }
    case 'action:heal': {
      const health = stats.health ?? 50;
      if (health <= 45) return 1.4;
      if (health >= 90) return 0.75;
      return 1;
    }
    case 'action:bond': {
      const bond = stats.bond ?? 50;
      if (bond <= 45) return 1.35;
      return 1;
    }
    default:
      return 1;
  }
}

function applyDirectTraitDeltas(
  pet: PersonalityState,
  deltas: Partial<Record<TraitKey, number>>,
  ctx: TraitEvolutionContext,
): boolean {
  let appliedAny = false;

  for (const key of TRAIT_KEYS) {
    const delta = deltas[key];
    if (delta === undefined || delta === 0) continue;

    const spent = pet.dailyTraitBudget[key] ?? 0;
    const remaining = Math.max(0, DAILY_BUDGET[key] - spent);
    const applied = clamp(delta, -remaining, remaining);
    if (applied === 0) continue;

    const sensitivityMultiplier = !pet.formationComplete
      ? (ctx.enablePreFormationSensitivity === false ? 1 : PRE_FORMATION_SENSITIVITY_MULTIPLIER)
      : POST_FORMATION_ADAPTATION_MULTIPLIER;
    pet.dailyTraitBudget[key] = spent + Math.abs(applied);
    pet.traitVector[key] = clamp(
      pet.traitVector[key] + applied * SMOOTHING_ALPHA * sensitivityMultiplier,
      0,
      100,
    );
    pet.dailyVectorVariance += Math.abs(applied);
    appliedAny = true;
  }

  if (appliedAny) updateConfusedState(pet, ctx);
  return appliedAny;
}

function applyBehaviorSignal(
  pet: PersonalityState,
  signal: Partial<BehaviorVector>,
  ctx: TraitEvolutionContext,
): boolean {
  if (!Object.values(signal).some(value => (value ?? 0) !== 0)) return false;

  const now = getNow(ctx);
  const profile = normalizeBehaviorProfile(pet.behaviorProfile);
  const axes = decayBehaviorAxes(profile, now);

  for (const axis of BEHAVIOR_AXES) {
    axes[axis] = clamp(axes[axis] + (signal[axis] ?? 0), 0, 100);
  }

  pet.behaviorProfile = {
    axes,
    sampleCount: Math.min(10_000, profile.sampleCount + 1),
    lastUpdatedAt: now.toISOString(),
  };
  return true;
}

function addTraitDeltas(
  target: Partial<Record<TraitKey, number>>,
  source: Partial<Record<TraitKey, number>>,
): void {
  for (const [key, value] of Object.entries(source)) {
    const trait = key as TraitKey;
    target[trait] = (target[trait] ?? 0) + (value ?? 0);
  }
}

function addBehaviorSignal(
  target: Partial<BehaviorVector>,
  source: Partial<BehaviorVector>,
): void {
  for (const [key, value] of Object.entries(source)) {
    const axis = key as keyof BehaviorVector;
    target[axis] = (target[axis] ?? 0) + (value ?? 0);
  }
}

function personalityItemStyleMultiplier(personalityId: PersonalityId | null, style: 'diverse' | 'repetitive' | 'frequent'): number {
  if (!personalityId) return 1.0;
  if (style === 'diverse' && ['curious', 'adventurer', 'playful', 'chaotic'].includes(personalityId)) return 1.25;
  if (style === 'diverse' && ['stoic', 'pristine'].includes(personalityId)) return 0.9;
  if (style === 'repetitive' && ['paranoid', 'anxious', 'stoic'].includes(personalityId)) return 1.35;
  if (style === 'repetitive' && ['adventurer', 'chaotic', 'playful'].includes(personalityId)) return 0.75;
  if (style === 'frequent' && ['playful', 'bold', 'chaotic'].includes(personalityId)) return 1.2;
  if (style === 'frequent' && ['melancholic', 'drowsy'].includes(personalityId)) return 0.8;
  return 1.0;
}

export function applyRegression(pet: PersonalityState): void {
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

export function recordDailyTraitSnapshot(pet: PersonalityState, now: Date, maxSnapshots = 30): boolean {
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
  pet: PersonalityState,
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

export function completeFormation(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  const starter = getPersonalities(ctx)
    .map(p => ({ id: p.id, depth: depthOfImmersion(pet.traitVector, p.id, pet.ageHours) }))
    .reduce((best, candidate) => (candidate.depth > best.depth ? candidate : best));

  pet.personality = starter.id;
  pet.formationComplete = true;

  const personality = getPersonalities(ctx).find(p => p.id === starter.id);
  addCoreMemory(pet, {
    tier: 'rare',
    emoji: '🥚',
    text: `Характер сформировался: ${personality?.name ?? starter.id}`,
    category: 'system',
    traitKey: 'vitality',
    direction: 'origin',
  }, ctx);
}

export function checkEvolution(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
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
    decayEvolutionReadiness(pet);
    return;
  }

  const candidates = getPersonalities(ctx)
    .filter(p => p.id !== currentPersonalityId)
    .map(p => {
      const depth = depthOfImmersion(pet.traitVector, p.id, pet.ageHours);
      const evidence = getBehaviorEvidenceForPersonality(pet.behaviorProfile, p.id);
      return {
        id: p.id,
        depth,
        adjustedDepth: depth + getBehaviorTargetDepthBonus(evidence),
      };
    })
    .sort((a, b) => b.adjustedDepth - a.adjustedDepth);

  const best = candidates.find(candidate =>
    getNearTargetReadinessRatio(candidate.adjustedDepth) > 0 &&
    hasBehaviorEvidenceForEvolution(pet.behaviorProfile, candidate.id),
  ) ?? candidates[0];
  if (!best) return;

  const readinessRatio = getNearTargetReadinessRatio(best.adjustedDepth);
  if (readinessRatio <= 0) {
    decayEvolutionReadiness(pet);
    handleVoidState(pet, ctx);
    return;
  }

  pet.voidSyncs = 0;

  if (!hasBehaviorEvidenceForEvolution(pet.behaviorProfile, best.id)) {
    pet.currentTargetZone = best.id;
    pet.ticksInTargetZone = 0;
    pet.evolutionProposal = undefined;
    decayEvolutionReadiness(pet, best.id);
    return;
  }

  if (pet.currentTargetZone !== best.id) {
    pet.currentTargetZone = best.id;
    pet.ticksInTargetZone = 0;
    pet.evolutionReadiness = pet.evolutionReadinessTarget === best.id ? (pet.evolutionReadiness ?? 0) : 0;
    pet.evolutionReadinessTarget = best.id;
  }

  if (best.depth > 0) {
    pet.ticksInTargetZone++;
  } else {
    pet.ticksInTargetZone = 0;
  }

  const currentDepthAbs = Math.abs(currentDepth) * getDynamicRadius(currentPersonalityId, pet.ageHours);
  if (currentDepthAbs < HYSTERESIS) return;
  pet.evolutionReadinessTarget = best.id;
  const readinessGain = EVOLUTION_READINESS_GAIN_PER_CONFIRMED_SYNC
    * (best.depth > 0 ? 1 : readinessRatio * NEAR_TARGET_READINESS_GAIN_MULTIPLIER);
  pet.evolutionReadiness = clamp(
    (pet.evolutionReadiness ?? 0) + readinessGain,
    0,
    EVOLUTION_READINESS_THRESHOLD,
  );

  const strictReadiness = Math.min(100, Math.round((pet.ticksInTargetZone / STABILITY_SYNCS) * 100));
  const accumulatedReadiness = Math.round(pet.evolutionReadiness ?? 0);
  if (pet.ticksInTargetZone < STABILITY_SYNCS && (pet.evolutionReadiness ?? 0) < EVOLUTION_READINESS_THRESHOLD) return;

  pet.evolutionProposal = {
    targetPersonalityId: best.id,
    readiness: Math.max(strictReadiness, accumulatedReadiness),
    depth: best.depth,
    proposedAt: getNow(ctx).toISOString(),
    coreMemoryIds: selectRelevantMemories(pet, best.id),
    narrativeText: createEvolutionProposalText(pet, best.id, ctx),
  };
}

export function acceptEvolution(pet: PersonalityState, ctx: TraitEvolutionContext = {}): boolean {
  const proposal = pet.evolutionProposal;
  if (!proposal) return false;

  const fromPersonalityId = pet.personality as PersonalityId;
  const targetPersonalityId = proposal.targetPersonalityId;
  const targetPersonality = getPersonalities(ctx).find(p => p.id === targetPersonalityId);
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
  pet.evolutionReadiness = 0;
  pet.evolutionReadinessTarget = null;
  pet.evolutionProposal = undefined;
  pet.voidSyncs = 0;
  clearLayeredEmergentState(pet, 'identity_crisis');
  clearLayeredEmergentState(pet, 'confused');

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

export function rejectEvolution(pet: PersonalityState): boolean {
  if (!pet.evolutionProposal) return false;

  pet.evolutionProposal = undefined;
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  pet.evolutionReadiness = 0;
  pet.evolutionReadinessTarget = null;
  return true;
}

export interface SingularityState {
  zones: PersonalityId[];
}

export function detectSingularity(pet: PersonalityState, ctx: TraitEvolutionContext = {}): SingularityState | null {
  const inside = getPersonalities(ctx)
    .map(p => ({ id: p.id, depth: depthOfImmersion(pet.traitVector, p.id, pet.ageHours) }))
    .filter(x => x.depth > 0)
    .sort((a, b) => b.depth - a.depth);

  if (inside.length < 3) return null;
  if (inside[0].depth - inside[2].depth >= SINGULARITY_EPSILON) return null;

  return { zones: inside.slice(0, 3).map(x => x.id) };
}

export function checkSingularity(pet: PersonalityState, ctx: TraitEvolutionContext = {}): boolean {
  const state = detectSingularity(pet, ctx);

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
  pet.evolutionReadiness = 0;
  pet.evolutionReadinessTarget = null;
  pet.evolutionProposal = undefined;
  pet.voidSyncs = 0;

  if (pet.ticksInSingularity >= SINGULARITY_THRESHOLD_SYNCS && pet.emergentState !== 'singularity') {
    setLayeredEmergentState(pet, 'singularity', getNow(ctx).toISOString());
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

export function collapseSingularity(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  if (!pet.singularityZones.length) return;

  const fromPersonalityId = pet.personality as PersonalityId;
  const random = getRandom(ctx);
  const target = pet.singularityZones[Math.floor(random() * pet.singularityZones.length)] ?? pet.singularityZones[0];
  const now = getNow(ctx).toISOString();

  pet.personality = target;
  clearLayeredEmergentState(pet, 'singularity');
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  pet.evolutionReadiness = 0;
  pet.evolutionReadinessTarget = null;
  pet.evolutionProposal = undefined;
  pet.ticksInSingularity = 0;
  pet.singularityZones = [];
  pet.evolutionHistory.push({
    fromPersonalityId,
    toPersonalityId: target,
    evolvedAt: now,
    trigger: 'singularity',
  });

  const targetPersonality = getPersonalities(ctx).find(p => p.id === target);
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

export function canEnterShadowForm(pet: PersonalityState, ctx: TraitEvolutionContext = {}): boolean {
  const now = getNow(ctx);
  if (pet.traumaCooldownUntil && now < new Date(pet.traumaCooldownUntil)) return false;
  return pet.traumaLevel >= SHADOW_FORM_TRAUMA_THRESHOLD;
}

export function checkShadowForm(pet: PersonalityState, ctx: TraitEvolutionContext = {}): boolean {
  if (pet.emergentState === 'shadow_form') return true;
  if (!canEnterShadowForm(pet, ctx)) return false;

  setLayeredEmergentState(pet, 'shadow_form', getNow(ctx).toISOString());
  pet.catharsisProgress = Math.max(0, pet.catharsisProgress ?? 0);
  pet.evolutionProposal = undefined;
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  return true;
}

export function exitShadowForm(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  clearLayeredEmergentState(pet, 'shadow_form');
  pet.traumaLevel = 0;
  pet.catharsisProgress = 0;

  const cooldown = new Date(getNow(ctx).getTime());
  cooldown.setDate(cooldown.getDate() + SHADOW_FORM_COOLDOWN_DAYS);
  pet.traumaCooldownUntil = cooldown.toISOString();
}

export const CATHARSIS_XP_BURST_MULTIPLIER = 5;
const CATHARSIS_XP_BURST_HOURS = 2;

export function triggerCatharsis(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  const firstCatharsis = !pet.catharsisAchieved;
  exitShadowForm(pet, ctx);

  if (firstCatharsis) {
    const burstEnd = new Date(getNow(ctx).getTime() + CATHARSIS_XP_BURST_HOURS * 60 * 60 * 1000);
    pet.catharsisXpBurstExpiresAt = burstEnd.toISOString();
  }
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
  pet: PersonalityState,
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
  account: PersonalityAccount,
  pet: PersonalityNamedState,
  ctx: TraitEvolutionContext = {},
): PersonalityAccount {
  const nextVector = account.legacyVector
    ? TRAIT_KEYS.reduce((acc, key) => {
        acc[key] = pet.traitVector[key] * LEGACY_BLEND_RATIO
          + account.legacyVector![key] * (1 - LEGACY_BLEND_RATIO);
        return acc;
      }, {} as TraitVector)
    : { ...pet.traitVector };

  const lastEvolution = pet.evolutionHistory[pet.evolutionHistory.length - 1];
  const hasLegacyRarity = Boolean(lastEvolution && EVOLUTION_LEGACY[lastEvolution.toPersonalityId]);
  const lastName = getPersonalities(ctx).find(p => p.id === pet.personality)?.name ?? pet.personality;
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

function createGuardianGuidance(pet: PersonalityState): string[] {
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

export function handleVoidState(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  pet.evolutionProposal = undefined;
  pet.voidSyncs = (pet.voidSyncs ?? 0) + 1;

  if (pet.voidSyncs >= VOID_THRESHOLD_SYNCS && pet.emergentState !== 'identity_crisis') {
    setLayeredEmergentState(pet, 'identity_crisis', getNow(ctx).toISOString());
  }
}

export function updateConfusedState(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  pet.confusedState = pet.dailyVectorVariance >= CONFUSED_VARIANCE_THRESHOLD;
  if (pet.confusedState) {
    setLayeredEmergentState(pet, 'confused', getNow(ctx).toISOString());
  } else {
    clearLayeredEmergentState(pet, 'confused');
  }
}

export function onStartSleep(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  pet.sleepStartedAt = getNow(ctx).toISOString();
}

export function onWakeFromSleep(
  pet: PersonalityState,
  naturalWake: boolean,
  ctx: TraitEvolutionContext = {},
): void {
  const now = getNow(ctx);

  if (pet.sleepStartedAt) {
    const sleptHours = (now.getTime() - new Date(pet.sleepStartedAt).getTime()) / 3_600_000;
    if (naturalWake && sleptHours >= MINIMUM_RESET_SLEEP_HOURS) {
      pet.dailyVectorVariance = 0;
      pet.confusedState = false;
      clearLayeredEmergentState(pet, 'confused');
      pet.lastSleepTimestamp = now.toISOString();
    }
  }

  pet.sleepStartedAt = null;
}

export function checkVarianceHardReset(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  if (!pet.lastSleepTimestamp) return;

  const hoursSinceSleep = (
    getNow(ctx).getTime() - new Date(pet.lastSleepTimestamp).getTime()
  ) / 3_600_000;

  if (hoursSinceSleep >= VARIANCE_HARD_RESET_HOURS) {
    pet.dailyVectorVariance = 0;
    pet.confusedState = false;
    clearLayeredEmergentState(pet, 'confused');
  }
}

export async function checkThresholdCrossings(
  pet: PersonalityState,
  prevVector: TraitVector,
  ctx: TraitEvolutionContext = {},
): Promise<void> {
  const generator = getMemoryTextGenerator(ctx);

  for (const personality of getPersonalities(ctx)) {
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

export async function checkWeeklyDrift(pet: PersonalityState, ctx: TraitEvolutionContext = {}): Promise<void> {
  if (pet.dailyTraitSnapshots.length < 7) return;

  const weekAvg = computeWeeklyAverage(pet.dailyTraitSnapshots.slice(-7).map(snapshot => snapshot.vector));
  const now = getNow(ctx);
  const generator = getMemoryTextGenerator(ctx);
  const personality = getPersonalities(ctx).find(p => p.id === pet.personality) ?? getPersonalities(ctx)[0];

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
  pet: PersonalityState,
  memory: Omit<CoreMemory, 'id' | 'timestamp'>,
  ctx: TraitEvolutionContext = {},
): CoreMemory {
  const timestamp = getNow(ctx).toISOString();
  const coreMemory: CoreMemory = {
    id: `mem-${timestamp}-${pet.coreMemories.length + 1}`,
    timestamp,
    ...memory,
  };

  const sorted = [coreMemory, ...pet.coreMemories].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const rare = sorted.filter(m => m.tier === 'rare').slice(0, RARE_CORE_MEMORY_CAP);
  const common = sorted.filter(m => m.tier === 'common').slice(0, COMMON_CORE_MEMORY_CAP);
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

function selectRelevantMemories(pet: PersonalityState, targetPersonalityId: PersonalityId): string[] {
  return pet.coreMemories
    .filter(memory => memory.tier === 'rare' || memory.personalityHint === targetPersonalityId)
    .slice(0, 3)
    .map(memory => memory.id);
}

function createEvolutionProposalText(
  pet: PersonalityState,
  targetPersonalityId: PersonalityId,
  ctx: TraitEvolutionContext,
): string {
  const target = getPersonalities(ctx).find(p => p.id === targetPersonalityId);
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

function getMemoryTextGenerator(ctx: TraitEvolutionContext): PersonalityMemoryTextGenerator {
  return ctx.memoryTextGenerator ?? createDefaultMemoryTextGenerator();
}

function getPersonalities(ctx: TraitEvolutionContext): PersonalityDefinition[] {
  return ctx.personalities && ctx.personalities.length > 0
    ? ctx.personalities
    : getFallbackPersonalities();
}

function getFallbackPersonalities(): PersonalityDefinition[] {
  return Object.values(PERSONALITY_TRAIT_MAP).map(home => ({
    id: home.id,
    name: home.id,
    tagline: '',
    description: '',
    emoji: '✨',
    rarity: 'common',
    decayRates: {},
    restoreBonus: {},
    xpMultipliers: {},
    coinMultipliers: {},
    foodPreferences: {
      lovedIds: [],
      hatedIds: [],
      loveBonus: {},
      hatePenalty: {},
    },
    autoSleep: { enabled: false, energyThreshold: 0, probability: 0 },
    moodBias: { ecstaticMinAvg: 85, happyMinAvg: 65, contentMinAvg: 45 },
    naturalHealthRegen: 0,
    negativeEffectResistance: 0,
    possibleFlags: [],
    emergentTriggers: [],
    visualProfile: { statBarTints: {}, emergentStateAnims: {} },
    linkedSkinIds: [],
  }));
}

function createDefaultMemoryTextGenerator(): PersonalityMemoryTextGenerator {
  return {
    async generate(ctx) {
      return ctx.direction === 'origin' ? 'Что-то важное началось' : 'Что-то изменилось';
    },
  };
}

function computeIntensity(
  influence: RegisteredInfluence,
  pet: PersonalityState,
  ctx: TraitEvolutionContext,
): number {
  return (influence.intensityRules ?? []).reduce((value, rule) => {
    return matchesInfluenceCondition(rule.condition, pet, ctx) ? value * rule.multiplier : value;
  }, 1);
}

function normalizeBehaviorProfile(profile: BehaviorProfile | undefined): BehaviorProfile {
  return createInitialBehaviorProfile(profile);
}

function decayBehaviorAxes(profile: BehaviorProfile, now: Date): BehaviorVector {
  const axes = { ...profile.axes };
  if (!profile.lastUpdatedAt) return axes;

  const elapsedDays = Math.max(0, (now.getTime() - new Date(profile.lastUpdatedAt).getTime()) / 86_400_000);
  if (!Number.isFinite(elapsedDays) || elapsedDays <= 0) return axes;

  const multiplier = BEHAVIOR_PROFILE_DECAY_PER_DAY ** elapsedDays;
  for (const axis of BEHAVIOR_AXES) {
    axes[axis] = clamp(axes[axis] * multiplier, 0, 100);
  }
  return axes;
}

function getBehaviorSignalForInfluence(influenceId: string): Partial<BehaviorVector> | null {
  switch (influenceId) {
    case 'action:feed':
      return { care: 2.0, social: 0.5 };
    case 'action:play':
      return { play: 2.0, exploration: 1.0 };
    case 'action:bond':
      return { social: 2.0, care: 0.5 };
    case 'action:bathe':
      return { order: 2.0, care: 0.5 };
    case 'action:heal':
      return { recovery: 2.0, care: 1.0 };
    case 'action:sleep_natural':
      return { order: 1.2, care: 0.6 };
    case 'action:sleep_forced':
      return { disruption: 2.0, order: -0.5 };
    case 'action:wake_early':
      return { disruption: 2.0, order: -1.0 };
    case 'item:puzzle':
      return { exploration: 2.0, order: 1.0 };
    case 'item:magic_potion':
      return { exploration: 1.5, recovery: 0.8 };
    case 'item:music_box':
      return { social: 2.5, recovery: 0.5 };
    case 'item:magic_wand':
      return { exploration: 2.5, play: 1.5 };
    case 'item:crystal_ball':
      return { exploration: 2.0, social: 1.0 };
    case 'env:new_room':
      return { exploration: 2.0, play: 0.5 };
    default:
      if (influenceId.startsWith('social:')) return { social: 1.5, exploration: 0.5 };
      return null;
  }
}

function getBehaviorEvidenceForPersonality(profile: BehaviorProfile | undefined, personalityId: PersonalityId): number {
  const { axes, sampleCount } = normalizeBehaviorProfile(profile);
  if (sampleCount < BEHAVIOR_PROFILE_EVOLUTION_MIN_SAMPLES) return Number.POSITIVE_INFINITY;

  type BehaviorEvidenceConfig = {
    axes: Partial<Record<keyof BehaviorVector, number>>;
    lowAxes?: Partial<Record<keyof BehaviorVector, { below: number; weight: number }>>;
  };

  const evidence = PERSONALITY_BEHAVIOR_EVIDENCE[personalityId] as BehaviorEvidenceConfig;
  let score = 0;

  for (const [axis, weight] of Object.entries(evidence.axes)) {
    score += axes[axis as keyof BehaviorVector] * weight;
  }

  for (const [axis, lowRule] of Object.entries(evidence.lowAxes ?? {})) {
    score += Math.max(0, lowRule.below - axes[axis as keyof BehaviorVector]) * lowRule.weight;
  }

  return score;
}

function hasBehaviorEvidenceForEvolution(profile: BehaviorProfile | undefined, personalityId: PersonalityId): boolean {
  return getBehaviorEvidenceForPersonality(profile, personalityId) >= BEHAVIOR_PROFILE_EVOLUTION_THRESHOLD;
}

function getNearTargetReadinessRatio(depth: number): number {
  if (depth > 0) return 1;
  return clamp((depth + NEAR_TARGET_READINESS_MARGIN) / NEAR_TARGET_READINESS_MARGIN, 0, 1);
}

function getBehaviorTargetDepthBonus(evidence: number): number {
  if (!Number.isFinite(evidence)) return BEHAVIOR_TARGET_DEPTH_BONUS;
  return clamp(
    evidence / Math.max(1, BEHAVIOR_PROFILE_EVOLUTION_THRESHOLD),
    0,
    1,
  ) * BEHAVIOR_TARGET_DEPTH_BONUS;
}

function decayEvolutionReadiness(pet: PersonalityState, target?: PersonalityId): void {
  if (target !== undefined && pet.evolutionReadinessTarget !== target) {
    pet.evolutionReadinessTarget = target;
    pet.evolutionReadiness = 0;
    return;
  }

  pet.evolutionReadiness = Math.max(0, (pet.evolutionReadiness ?? 0) - EVOLUTION_READINESS_DECAY_PER_SYNC);
  if (pet.evolutionReadiness === 0 && target === undefined) {
    pet.evolutionReadinessTarget = null;
  }
}

export function canApplyInfluence(
  pet: PersonalityState,
  influence: RegisteredInfluence,
  ctx: TraitEvolutionContext = {},
): boolean {
  return getBlockedInfluenceConditions(pet, influence, ctx).length === 0;
}

export function getBlockedInfluenceConditions(
  pet: PersonalityState,
  influence: RegisteredInfluence,
  ctx: TraitEvolutionContext = {},
): InfluenceCondition[] {
  return (influence.conditions ?? []).filter(condition => !matchesInfluenceCondition(condition, pet, ctx));
}

export function matchesInfluenceCondition(
  condition: InfluenceCondition,
  pet: PersonalityState,
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
      return pet.formationComplete && params.id === pet.personality;
    case 'trait_above':
      return typeof params.key === 'string' && pet.traitVector[params.key as TraitKey] > Number(params.value);
    case 'trait_below':
      return typeof params.key === 'string' && pet.traitVector[params.key as TraitKey] < Number(params.value);
    case 'stat_below': {
      const stat = params.stat;
      return typeof stat === 'string' && pet.stats[stat as keyof typeof pet.stats] < Number(params.value);
    }
    case 'session_gap_hours':
      return (pet.behavioralCounters?.sessionGapHours ?? 0) >= Number(params.min);
    case 'same_room_hours':
      return (pet.behavioralCounters?.sameRoomHours ?? 0) >= Number(params.min);
    case 'formation_period':
      return Boolean(params.active) !== pet.formationComplete;
    case 'streak_days': {
      const days = Number(params.days);
      if (!Number.isFinite(days) || days <= 0) return false;
      const requiredSyncs = days * 24;
      if (params.action === 'any') {
        return (pet.behavioralCounters?.consecutiveGoodSyncs ?? 0) >= requiredSyncs;
      }
      return false;
    }
  }
}

function getNow(ctx: TraitEvolutionContext): Date {
  return ctx.now ?? new Date();
}

function getRandom(ctx: TraitEvolutionContext): () => number {
  return ctx.rng ?? ctx.random ?? Math.random;
}
