import type { Pet, PetMood } from '../api/types';
import type { AppliedModifier, DomainEvent, InfluenceCooldownState, PetCommand, PetCommandResult } from './commands';
import { PERSONALITY_ENGINE_VERSION, STATIC_REGISTRY_VERSION } from './engineVersion';
import { getInfluenceRegistry, getIntensityMultiplier as getGlobalIntensityMultiplier } from './influenceRegistry';
import { createMemoryTextGenerator, type MemoryTextGenerator } from './memoryTextGenerator';
import {
  applyDecay,
  applyActionModifiers,
  calcMoodWithBias,
  computeEmergentState,
  computeNaturalPassives,
  createDefaultCounters,
  getParanoidRestoreMult,
  getPeakPerformanceMult,
  isActionBlocked,
  runPatternEngine,
  updateCounters,
} from './PersonalityEngine';
import { getPersonality } from './personalities';
import { clearEmergentStateLayer, getActiveEmergentStateTypes, setLayeredEmergentState, syncLayeredStatesFromLegacy } from './stateLayers';
import {
  applyInfluence,
  applyRegression,
  acceptEvolution,
  checkEvolution,
  checkThresholdCrossings,
  checkVarianceHardReset,
  checkWeeklyDrift,
  canApplyInfluenceAtSync,
  onStartSleep,
  onWakeFromSleep,
  rejectEvolution,
  recordDailyTraitSnapshot,
} from './TraitEvolutionEngine';
import type { ActionContext, ActionType, BlockedAction, RegisteredInfluence, StatKey, SyncContext, TraitVector } from './types';

export interface PersonalityCommandHandlerOptions {
  influenceRegistry?: RegisteredInfluence[];
  influenceCooldowns?: InfluenceCooldownState;
  currentSync?: number;
  getIntensityMultiplier?: (influenceId: string) => number;
  memoryTextGenerator?: MemoryTextGenerator;
  rng?: () => number;
  coinBalance?: number;
  engineVersion?: string;
  registryVersion?: string;
}

export interface PersonalityCommandReplayOptions extends Omit<PersonalityCommandHandlerOptions, 'currentSync'> {
  initialSync?: number;
}

export interface PersonalityCommandReplayResult {
  pet: Pet;
  events: DomainEvent[];
  commandResults: PetCommandResult[];
  influenceCooldowns: InfluenceCooldownState;
  currentSync: number;
  engineVersion: string;
  registryVersion: string;
}

export async function replayPersonalityCommands(
  pet: Pet,
  commands: PetCommand[],
  options: PersonalityCommandReplayOptions = {},
): Promise<PersonalityCommandReplayResult> {
  let currentPet = clonePet(pet);
  let currentSync = options.initialSync ?? 0;
  let influenceCooldowns = { ...(options.influenceCooldowns ?? {}) };
  const commandResults: PetCommandResult[] = [];
  const events: DomainEvent[] = [];

  for (const command of commands) {
    if (command.type === 'sync') currentSync++;

    const result = await applyPersonalityCommand(currentPet, command, {
      ...options,
      currentSync,
      influenceCooldowns,
    });

    currentPet = result.pet;
    influenceCooldowns = result.influenceCooldowns;
    commandResults.push(result);
    events.push(...result.events);
  }

  return {
    pet: currentPet,
    events,
    commandResults,
    influenceCooldowns,
    currentSync,
    engineVersion: options.engineVersion ?? PERSONALITY_ENGINE_VERSION,
    registryVersion: options.registryVersion ?? STATIC_REGISTRY_VERSION,
  };
}

export async function applyPersonalityCommand(
  pet: Pet,
  command: PetCommand,
  options: PersonalityCommandHandlerOptions = {},
): Promise<PetCommandResult> {
  const nextPet = clonePet(pet);
  const now = new Date(command.at);
  const events: DomainEvent[] = [];
  const influenceCooldowns = { ...(options.influenceCooldowns ?? {}) };
  const currentSync = options.currentSync ?? 0;
  const beforeVector = cloneTraitVector(nextPet.traitVector);
  const beforeMemoryIds = new Set(nextPet.coreMemories.map(memory => memory.id));
  const beforeEmergentState = nextPet.emergentState;
  const beforeProposal = nextPet.evolutionProposal;
  let gameplayOutcome = createEmptyGameplayOutcome();
  const memoryTextGenerator = options.memoryTextGenerator ?? createMemoryTextGenerator();
  const rng = options.rng ?? createDeterministicRng(`${command.commandId}:${command.at}:${command.type}`);
  const ctx = {
    now,
    clientLocalHour: now.getHours(),
    getIntensityMultiplier: options.getIntensityMultiplier ?? getGlobalIntensityMultiplier,
    memoryTextGenerator,
    dominantInfluences: [command.type],
    rng,
  };

  if (command.type === 'sync') {
    gameplayOutcome = applyGameplayCommand(nextPet, command, {
      now,
      rng,
      coinBalance: options.coinBalance ?? 0,
      applySyncDecay: true,
    });
    const prevVector = cloneTraitVector(nextPet.traitVector);
    applyRegression(nextPet);
    recordDailyTraitSnapshot(nextPet, now);
    checkVarianceHardReset(nextPet, ctx);
    checkEvolution(nextPet, ctx);
    await checkThresholdCrossings(nextPet, prevVector, ctx);
    await checkWeeklyDrift(nextPet, ctx);
  } else if (command.type === 'sleep') {
    gameplayOutcome = applyGameplayCommand(nextPet, command, {
      now,
      rng,
      coinBalance: options.coinBalance ?? 0,
    });
    if (!gameplayOutcome.blockedAction) {
      events.push({ type: 'sleep_started', at: command.at, commandId: command.commandId });
      await applyCommandInfluence(nextPet, command, options, ctx, events, influenceCooldowns, currentSync);
    }
  } else if (command.type === 'wake') {
    gameplayOutcome = applyGameplayCommand(nextPet, command, {
      now,
      rng,
      coinBalance: options.coinBalance ?? 0,
    });
    const sleptHours = typeof gameplayOutcome.meta.sleptHours === 'number' ? gameplayOutcome.meta.sleptHours : 0;
    const naturalWake = Boolean(gameplayOutcome.meta.naturalWake);
    events.push({
      type: 'sleep_finished',
      at: command.at,
      commandId: command.commandId,
      naturalWake,
      sleptHours,
    });
    if (sleptHours < 1) {
      await applyRegisteredInfluence(
        nextPet,
        'action:wake_early',
        command,
        options,
        ctx,
        events,
        influenceCooldowns,
        currentSync,
      );
    }
  } else if (command.type === 'accept_evolution') {
    const accepted = acceptEvolution(nextPet, ctx);
    const record = nextPet.evolutionHistory[nextPet.evolutionHistory.length - 1];
    if (accepted && record) {
      events.push({
        type: 'evolution_recorded',
        at: command.at,
        commandId: command.commandId,
        record,
      });
    }
  } else if (command.type === 'reject_evolution') {
    rejectEvolution(nextPet);
  } else {
    gameplayOutcome = applyGameplayCommand(nextPet, command, {
      now,
      rng,
      coinBalance: options.coinBalance ?? 0,
    });
    if (!gameplayOutcome.blockedAction) {
      await applyCommandInfluence(nextPet, command, options, ctx, events, influenceCooldowns, currentSync);
    }
  }

  if (gameplayOutcome.actionType) {
    events.push({
      type: 'gameplay_outcome_applied',
      at: command.at,
      commandId: command.commandId,
      actionType: gameplayOutcome.actionType,
      statDeltas: gameplayOutcome.statDeltas,
      xpDelta: gameplayOutcome.xpDelta,
      coinDelta: gameplayOutcome.coinDelta,
      blockedAction: gameplayOutcome.blockedAction,
    });
  }

  collectStateEvents({
    events,
    command,
    pet: nextPet,
    beforeVector,
    beforeMemoryIds,
    beforeEmergentState,
    beforeProposal,
  });

  return {
    pet: nextPet,
    events,
    command,
    influenceCooldowns,
    statDeltas: gameplayOutcome.statDeltas,
    xpDelta: gameplayOutcome.xpDelta,
    coinDelta: gameplayOutcome.coinDelta,
    blockedAction: gameplayOutcome.blockedAction,
    appliedModifiers: gameplayOutcome.appliedModifiers,
    meta: gameplayOutcome.meta,
    engineVersion: options.engineVersion ?? PERSONALITY_ENGINE_VERSION,
    registryVersion: options.registryVersion ?? STATIC_REGISTRY_VERSION,
  };
}

interface GameplayOutcome {
  actionType: ActionType | null;
  statDeltas: Partial<Record<StatKey, number>>;
  xpDelta: number;
  coinDelta: number;
  blockedAction: BlockedAction | null;
  appliedModifiers: AppliedModifier[];
  meta: Record<string, unknown>;
}

function createEmptyGameplayOutcome(): GameplayOutcome {
  return {
    actionType: null,
    statDeltas: {},
    xpDelta: 0,
    coinDelta: 0,
    blockedAction: null,
    appliedModifiers: [],
    meta: {},
  };
}

function applyGameplayCommand(
  pet: Pet,
  command: PetCommand,
  context: {
    now: Date;
    rng: () => number;
    coinBalance: number;
    applySyncDecay?: boolean;
  },
): GameplayOutcome {
  const outcome = createEmptyGameplayOutcome();
  pet.behavioralCounters ??= createDefaultCounters({ now: context.now, rng: context.rng });
  pet.behavioralFlags ??= [];
  pet.moodHistory ??= [];

  const personality = getPersonality(pet.personality);
  const actionType = toGameplayAction(command);
  outcome.actionType = actionType;
  const syncContext: SyncContext = {
    clientLocalHour: context.now.getHours(),
    sessionGapHours: pet.behavioralCounters.sessionGapHours,
    coinBalance: context.coinBalance,
    now: context.now,
    rng: context.rng,
  };

  if (context.applySyncDecay) {
    const lastUpdated = new Date(pet.lastUpdated);
    const elapsedMinutes = Math.max(0, (context.now.getTime() - lastUpdated.getTime()) / 60_000);

    if (!pet.isAsleep) {
      const decayed = applyDecay(
        pet.stats as Record<StatKey, number>,
        personality,
        elapsedMinutes,
        pet.behavioralCounters,
        syncContext,
      );
      if (pet.stats.cleanliness < 30) {
        decayed.health = clampStat(decayed.health - 0.5 * elapsedMinutes);
      }
      pet.stats = decayed as Pet['stats'];
    } else {
      const restoreBonus = personality.restoreBonus.sleep?.energy ?? 0;
      pet.stats.energy = clampStat(pet.stats.energy + (5 + restoreBonus) * (elapsedMinutes / 15));
      pet.stats.hunger = clampStat(pet.stats.hunger - 0.8 * (elapsedMinutes / 15));
      pet.stats.health = clampStat(pet.stats.health + 0.5 * (elapsedMinutes / 15));
    }

    const passives = computeNaturalPassives(
      pet.stats as Record<StatKey, number>,
      personality,
      pet.behavioralCounters,
    );
    for (const [stat, value] of Object.entries(passives)) {
      const key = stat as StatKey;
      pet.stats[key] = clampStat(pet.stats[key] + (value ?? 0));
    }
  }

  if (actionType) {
    const actionOutcome = applyActionOutcome(pet, command, actionType, {
      now: context.now,
      rng: context.rng,
      coinBalance: context.coinBalance,
    });
    Object.assign(outcome, actionOutcome);
    if (outcome.blockedAction) {
      return outcome;
    }

    const actionContext: ActionContext = {
      clientLocalHour: context.now.getHours(),
      coinBalance: context.coinBalance,
      now: context.now,
      rng: context.rng,
      foodId: command.type === 'feed' ? command.foodId : undefined,
      itemId: command.type === 'use_item' ? command.itemId : undefined,
    };
    pet.behavioralCounters = updateCounters(
      pet.behavioralCounters,
      actionType,
      pet.stats as Record<StatKey, number>,
      actionContext,
    );
  }

  const currentMood = calcMoodWithBias(
    pet.stats as Record<StatKey, number>,
    personality,
    pet.isAsleep,
  ) as PetMood;
  pet.mood = currentMood;
  if (actionType === 'sync') {
    updateMoodStreaks(pet, currentMood);
    pet.moodHistory.unshift({
      timestamp: context.now.toISOString(),
      mood: currentMood,
      avgStats: avgStats(pet.stats as Record<StatKey, number>),
    });
    if (pet.moodHistory.length > 168) pet.moodHistory.pop();
  }

  pet.behavioralFlags = runPatternEngine(
    pet.behavioralCounters,
    pet.behavioralFlags,
    personality,
    { now: context.now, rng: context.rng },
  );

  const currentGameplayState = pet.stateLayers?.gameplay?.[0]?.type ?? null;
  const computedState = computeEmergentState(
    pet.stats as Record<StatKey, number>,
    personality,
    pet.behavioralFlags,
    pet.behavioralCounters,
    syncContext,
    currentGameplayState,
    pet.stateLayers?.gameplay?.[0]?.enteredAt,
  );
  if (computedState) {
    setLayeredEmergentState(pet, computedState, context.now.toISOString());
  } else {
    clearEmergentStateLayer(pet, 'gameplay');
  }
  syncLayeredStatesFromLegacy(pet);
  pet.lastUpdated = context.now.toISOString();
  return outcome;
}

function applyActionOutcome(
  pet: Pet,
  command: PetCommand,
  actionType: ActionType,
  context: { now: Date; rng: () => number; coinBalance: number },
): GameplayOutcome {
  const outcome = createEmptyGameplayOutcome();
  outcome.actionType = actionType;
  if (actionType === 'sync') return outcome;

  const personality = getPersonality(pet.personality);
  const activeStates = getActiveEmergentStateTypes(pet);
  const blockedByState = isActionBlocked(actionType, activeStates);
  if (blockedByState) {
    outcome.blockedAction = blockedByState;
    return outcome;
  }

  const specialBlock = getSpecialBlockedAction(pet, command, actionType);
  if (specialBlock) {
    outcome.blockedAction = specialBlock;
    return outcome;
  }

  if (command.type === 'sleep') {
    pet.isAsleep = true;
    onStartSleep(pet, { now: context.now, rng: context.rng });
    outcome.appliedModifiers.push({ source: 'base', id: 'sleep:start', description: 'Sleep lifecycle started' });
    return outcome;
  }

  if (command.type === 'wake') {
    const sleptHours = pet.sleepStartedAt
      ? Math.max(0, (context.now.getTime() - new Date(pet.sleepStartedAt).getTime()) / 3_600_000)
      : 0;
    const naturalWake = sleptHours >= 4;
    pet.isAsleep = false;
    onWakeFromSleep(pet, naturalWake, { now: context.now, rng: context.rng });
    outcome.meta.sleptHours = sleptHours;
    outcome.meta.naturalWake = naturalWake;
    outcome.appliedModifiers.push({ source: 'base', id: 'wake:finish', description: 'Sleep lifecycle finished' });
    return outcome;
  }

  const base = getBaseActionResult(pet, command, actionType, context);
  if (!base) return outcome;
  if (command.type === 'play') {
    outcome.meta.score = getPlayScore(command, context.rng);
  }

  const actionContext: ActionContext = {
    clientLocalHour: context.now.getHours(),
    coinBalance: context.coinBalance,
    now: context.now,
    rng: context.rng,
    foodId: command.type === 'feed' ? command.foodId : undefined,
    itemId: command.type === 'use_item' ? command.itemId : undefined,
  };
  const modified = applyActionModifiers(
    base,
    actionType,
    personality,
    pet.behavioralFlags,
    activeStates,
    pet.behavioralCounters,
    actionContext,
  );

  outcome.statDeltas = { ...modified.statDeltas };
  outcome.xpDelta = modified.xp;
  outcome.coinDelta = modified.coins;
  outcome.appliedModifiers.push({ source: 'base', id: `${actionType}:base`, description: `Base ${actionType} outcome` });
  if (pet.behavioralFlags.length > 0) {
    outcome.appliedModifiers.push({ source: 'flag', id: 'behavioral_flags', description: 'Behavioral flags evaluated' });
  }
  if (activeStates.length > 0) {
    outcome.appliedModifiers.push({ source: 'state', id: activeStates.join(','), description: 'Active emergent states evaluated' });
  }

  applySpecialOutcomeModifiers(pet, command, actionType, outcome);
  applyStatDeltas(pet, outcome.statDeltas);
  outcome.coinDelta += applyXp(pet, outcome.xpDelta);
  return outcome;
}

function getBaseActionResult(
  pet: Pet,
  command: PetCommand,
  actionType: ActionType,
  context: { rng: () => number },
): { statDeltas: Partial<Record<StatKey, number>>; xp: number; coins: number } | null {
  switch (command.type) {
    case 'play': {
      const score = getPlayScore(command, context.rng);
      return {
        statDeltas: { happiness: 20, energy: -15, bond: 8 },
        xp: Math.floor(score * 0.5),
        coins: Math.floor(score * 0.1) + 2,
      };
    }
    case 'feed': {
      const effect = command.foodEffect ?? getFallbackFoodEffect(command.foodId);
      return {
        statDeltas: {
          hunger: effect.hungerRestore,
          happiness: effect.happinessBonus,
          health: effect.healthBonus,
        },
        xp: 8,
        coins: 0,
      };
    }
    case 'bathe':
      return {
        statDeltas: { cleanliness: 40, happiness: pet.personality === 'feral' ? -20 : 5, health: 5 },
        xp: 12,
        coins: 0,
      };
    case 'heal':
      return { statDeltas: { health: 35, happiness: -5 }, xp: 18, coins: 0 };
    case 'bond':
      return { statDeltas: { happiness: 15, bond: 20 }, xp: 6, coins: 0 };
    case 'use_item': {
      const effect = command.itemEffect ?? {};
      return {
        statDeltas: {
          hunger: effect.hunger,
          happiness: effect.happiness,
          energy: effect.energy,
          health: effect.health,
          cleanliness: effect.cleanliness,
          bond: effect.bond,
        },
        xp: effect.xp ?? 0,
        coins: effect.coins ?? 0,
      };
    }
    default:
      return actionType ? { statDeltas: {}, xp: 0, coins: 0 } : null;
  }
}

function getPlayScore(command: Extract<PetCommand, { type: 'play' }>, rng: () => number): number {
  const parsedScore = Number(command.scoreSeed);
  return Number.isFinite(parsedScore)
    ? Math.max(0, Math.floor(parsedScore))
    : Math.floor(40 + rng() * 180);
}

function getSpecialBlockedAction(pet: Pet, command: PetCommand, actionType: ActionType): BlockedAction | null {
  const personality = getPersonality(pet.personality);
  if (command.type !== 'wake' && command.type !== 'sync' && pet.isAsleep) {
    return { actionType, reason: 'Питомец спит!', alternativeHint: 'Разбуди питомца' };
  }
  if (command.type === 'wake' && !pet.isAsleep) {
    return { actionType, reason: 'Питомец и так не спит!', alternativeHint: 'Выбери другое действие' };
  }
  if (command.type === 'feed' && pet.stats.hunger > 90) {
    return { actionType, reason: 'Питомец и так сыт!', alternativeHint: 'Покорми позже' };
  }
  if (command.type === 'play' && pet.stats.energy < 10) {
    return { actionType, reason: 'Питомец слишком устал для игр', alternativeHint: 'Дай питомцу поспать' };
  }
  if (command.type === 'sleep' && personality.specialRules?.rejectSleepWhenEnergized && pet.stats.energy > 30) {
    return { actionType, reason: 'Слишком бодрый чтобы спать!', alternativeHint: 'Сначала потрать энергию' };
  }
  if (command.type === 'bathe' && pet.stats.cleanliness > 90) {
    return { actionType, reason: 'Питомец уже чистый!', alternativeHint: 'Выбери другое действие' };
  }
  if (command.type === 'heal' && pet.stats.health >= 90) {
    return { actionType, reason: 'Питомец уже здоров!', alternativeHint: 'Выбери другое действие' };
  }
  if (command.type === 'heal' && pet.personality === 'paranoid' && pet.stats.health > 50) {
    return { actionType, reason: 'Не верит что болен!', alternativeHint: 'Сначала укрепи доверие' };
  }
  return null;
}

function applySpecialOutcomeModifiers(
  pet: Pet,
  command: PetCommand,
  actionType: ActionType,
  outcome: GameplayOutcome,
): void {
  const personality = getPersonality(pet.personality);
  if (command.type === 'feed' && pet.personality === 'paranoid') {
    const paranoidMult = getParanoidRestoreMult(pet.behavioralCounters);
    for (const [stat, value] of Object.entries(outcome.statDeltas)) {
      if (stat !== 'health') {
        const key = stat as StatKey;
        outcome.statDeltas[key] = (value ?? 0) * paranoidMult;
      }
    }
    outcome.appliedModifiers.push({ source: 'special_rule', id: 'paranoid_restore_mult', description: 'Paranoid restore multiplier applied' });
  }

  if (command.type === 'play') {
    const peak = getPeakPerformanceMult(pet.stats as Record<StatKey, number>, personality);
    if (peak.xpMult !== 1.0 || peak.coinMult !== 1.0) {
      outcome.xpDelta = Math.round(outcome.xpDelta * peak.xpMult);
      outcome.coinDelta = Math.round(outcome.coinDelta * peak.coinMult);
      outcome.appliedModifiers.push({ source: 'special_rule', id: 'peakPerformanceThreshold', description: 'Peak performance multiplier applied' });
    }

    if (personality.specialRules?.xpEveryOtherAction) {
      pet.behavioralCounters.melancholicActionCount = (pet.behavioralCounters.melancholicActionCount ?? 0) + 1;
      if (pet.behavioralCounters.melancholicActionCount % 2 !== 0) {
        outcome.xpDelta = 0;
      }
      outcome.appliedModifiers.push({ source: 'special_rule', id: 'xpEveryOtherAction', description: 'Melancholic XP cadence applied' });
    }
  }

  if (actionType) {
    outcome.xpDelta = Math.max(0, Math.round(outcome.xpDelta));
    outcome.coinDelta = Math.round(outcome.coinDelta);
  }
}

function applyStatDeltas(pet: Pet, statDeltas: Partial<Record<StatKey, number>>): void {
  for (const [stat, value] of Object.entries(statDeltas)) {
    const key = stat as StatKey;
    pet.stats[key] = clampStat(pet.stats[key] + (value ?? 0));
  }
}

function applyXp(pet: Pet, amount: number): number {
  let xp = pet.xp + Math.max(0, amount);
  let { level, xpToNext } = pet;
  let levelBonusCoins = 0;
  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = level * 100 + 50;
    levelBonusCoins += level * 5;
  }
  pet.xp = xp;
  pet.level = level;
  pet.xpToNext = xpToNext;
  return levelBonusCoins;
}

function getFallbackFoodEffect(foodId: string): { hungerRestore: number; happinessBonus: number; healthBonus: number } {
  const fallback: Record<string, { hungerRestore: number; happinessBonus: number; healthBonus: number }> = {
    apple: { hungerRestore: 20, happinessBonus: 5, healthBonus: 10 },
    pizza: { hungerRestore: 40, happinessBonus: 20, healthBonus: -5 },
    sushi: { hungerRestore: 30, happinessBonus: 15, healthBonus: 5 },
    candy: { hungerRestore: 10, happinessBonus: 30, healthBonus: -10 },
    salad: { hungerRestore: 25, happinessBonus: 5, healthBonus: 20 },
    ramen: { hungerRestore: 45, happinessBonus: 25, healthBonus: 0 },
    milk: { hungerRestore: 15, happinessBonus: 8, healthBonus: 15 },
    cake: { hungerRestore: 35, happinessBonus: 35, healthBonus: -8 },
  };
  return fallback[foodId] ?? { hungerRestore: 0, happinessBonus: 0, healthBonus: 0 };
}

function toGameplayAction(command: PetCommand): ActionType | null {
  switch (command.type) {
    case 'feed':
    case 'play':
    case 'sleep':
    case 'wake':
    case 'bathe':
    case 'heal':
    case 'bond':
    case 'use_item':
    case 'sync':
      return command.type;
    case 'equip_room':
    case 'npc_visit':
    case 'accept_evolution':
    case 'reject_evolution':
      return null;
  }
}

function updateMoodStreaks(pet: Pet, mood: PetMood): void {
  if (mood === 'sad') {
    pet.behavioralCounters.consecutiveBadMoodSyncs++;
  } else {
    pet.behavioralCounters.consecutiveBadMoodSyncs = 0;
  }

  if (avgStats(pet.stats as Record<StatKey, number>) > 70) {
    pet.behavioralCounters.consecutiveGoodSyncs++;
  } else {
    pet.behavioralCounters.consecutiveGoodSyncs = 0;
  }
}

function avgStats(stats: Record<StatKey, number>): number {
  const values = Object.values(stats) as number[];
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, value));
}

async function applyCommandInfluence(
  pet: Pet,
  command: PetCommand,
  options: PersonalityCommandHandlerOptions,
  ctx: Parameters<typeof applyInfluence>[2],
  events: DomainEvent[],
  influenceCooldowns: InfluenceCooldownState,
  currentSync: number,
): Promise<void> {
  const registry = options.influenceRegistry ?? getInfluenceRegistry();
  const influenceId = getInfluenceIdForCommand(pet, command, registry);
  if (!influenceId) return;
  await applyRegisteredInfluence(pet, influenceId, command, options, ctx, events, influenceCooldowns, currentSync);
}

async function applyRegisteredInfluence(
  pet: Pet,
  influenceId: string,
  command: PetCommand,
  options: PersonalityCommandHandlerOptions,
  ctx: Parameters<typeof applyInfluence>[2],
  events: DomainEvent[],
  influenceCooldowns: InfluenceCooldownState,
  currentSync: number,
): Promise<void> {
  const registry = options.influenceRegistry ?? getInfluenceRegistry();
  const influence = registry.find(entry => entry.id === influenceId);
  if (!influence) return;

  const lastAppliedSync = influenceCooldowns[influence.id];
  const cooldownSyncs = influence.cooldownSyncs ?? 0;
  if (!canApplyInfluenceAtSync(lastAppliedSync, currentSync, cooldownSyncs)) {
    const appliedSync = lastAppliedSync ?? currentSync;
    events.push({
      type: 'influence_cooldown_skipped',
      at: command.at,
      commandId: command.commandId,
      influenceId: influence.id,
      lastAppliedSync: appliedSync,
      currentSync,
      cooldownSyncs,
    });
    return;
  }

  const { prevVector, applied } = applyInfluence(pet, influence, {
    ...ctx,
    dominantInfluences: [influence.label],
  });
  if (!applied) return;

  influenceCooldowns[influence.id] = currentSync;
  await checkThresholdCrossings(pet, prevVector, {
    ...ctx,
    dominantInfluences: [influence.label],
  });
}

function createDeterministicRng(seedText: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  let state = seed >>> 0 || 1;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return ((state >>> 0) / 4294967296);
  };
}

function getInfluenceIdForCommand(
  pet: Pet,
  command: PetCommand,
  registry: RegisteredInfluence[] = getInfluenceRegistry(),
): string | null {
  switch (command.type) {
    case 'feed':
      return 'action:feed';
    case 'play':
      return 'action:play';
    case 'sleep':
      return pet.stats.energy > 70 ? 'action:sleep_forced' : 'action:sleep_natural';
    case 'bathe':
      return 'action:bathe';
    case 'heal':
      return 'action:heal';
    case 'bond':
      return 'action:bond';
    case 'use_item': {
      const itemInfluenceId = `item:${command.itemId}`;
      if (registry.some(influence => influence.id === itemInfluenceId)) return itemInfluenceId;
      return command.itemKind === 'food' ? 'action:feed' : itemInfluenceId;
    }
    case 'equip_room':
      return 'env:new_room';
    case 'npc_visit':
      return `social:visit_${command.npcPersonalityId}`;
    case 'wake':
    case 'sync':
    case 'accept_evolution':
    case 'reject_evolution':
      return null;
  }
}

function collectStateEvents(args: {
  events: DomainEvent[];
  command: PetCommand;
  pet: Pet;
  beforeVector: TraitVector;
  beforeMemoryIds: Set<string>;
  beforeEmergentState: Pet['emergentState'];
  beforeProposal: Pet['evolutionProposal'];
}): void {
  const { events, command, pet, beforeVector, beforeMemoryIds, beforeEmergentState, beforeProposal } = args;

  if (!sameTraitVector(beforeVector, pet.traitVector)) {
    events.push({
      type: 'trait_vector_changed',
      at: command.at,
      commandId: command.commandId,
      prevVector: beforeVector,
      nextVector: cloneTraitVector(pet.traitVector),
    });
  }

  for (const memory of pet.coreMemories) {
    if (!beforeMemoryIds.has(memory.id)) {
      events.push({
        type: 'core_memory_added',
        at: command.at,
        commandId: command.commandId,
        memory,
      });
    }
  }

  if (beforeEmergentState !== pet.emergentState) {
    events.push({
      type: 'emergent_state_changed',
      at: command.at,
      commandId: command.commandId,
      from: beforeEmergentState,
      to: pet.emergentState,
    });
  }

  if (
    pet.evolutionProposal &&
    (
      !beforeProposal ||
      beforeProposal.targetPersonalityId !== pet.evolutionProposal.targetPersonalityId ||
      beforeProposal.proposedAt !== pet.evolutionProposal.proposedAt
    )
  ) {
    events.push({
      type: 'evolution_proposed',
      at: command.at,
      commandId: command.commandId,
      proposal: pet.evolutionProposal,
    });
  }
}

function sameTraitVector(a: TraitVector, b: TraitVector): boolean {
  return (
    a.vitality === b.vitality &&
    a.sociality === b.sociality &&
    a.order === b.order &&
    a.appetite === b.appetite &&
    a.caution === b.caution &&
    a.curiosity === b.curiosity
  );
}

function cloneTraitVector(vector: TraitVector): TraitVector {
  return { ...vector };
}

function clonePet(pet: Pet): Pet {
  return JSON.parse(JSON.stringify(pet)) as Pet;
}
