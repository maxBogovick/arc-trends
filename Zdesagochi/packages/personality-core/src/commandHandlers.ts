import type { AppliedModifier, DomainEvent, InfluenceCooldownState, PetCommand, PetCommandResult } from './commands';
import type { PersonalityMemoryTextGenerator, PersonalityMood, PersonalityState } from './coreState';
import { EVOLUTION_LEGACY } from './personalityTraitMap';
import { PERSONALITY_ENGINE_VERSION, PERSONALITY_STATE_SCHEMA_VERSION, STATIC_REGISTRY_VERSION } from './engineVersion';
import { BASE_ACTION_RULES } from './actionRules';
import { cloneData } from './clone';
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
import { clearEmergentStateLayer, getActiveEmergentStates, getActiveEmergentStateTypes, setLayeredEmergentState, syncLayeredStatesFromLegacy } from './stateLayers';
import {
  applyInfluence,
  applyItemBehaviorStyle,
  applyRegression,
  acceptEvolution,
  checkEvolution,
  checkThresholdCrossings,
  checkVarianceHardReset,
  checkWeeklyDrift,
  canApplyInfluenceAtSync,
  addCatharsisProgress,
  createInitialBehaviorProfile,
  onStartSleep,
  onWakeFromSleep,
  rejectEvolution,
  recordDailyTraitSnapshot,
  updateBehaviorProfile,
  CATHARSIS_XP_BURST_MULTIPLIER,
} from './TraitEvolutionEngine';
import type { ActionContext, ActionType, BehaviorProfile, BlockedAction, PersonalityDefinition, RegisteredInfluence, StatKey, SyncContext, TraitVector } from './types';

export interface PersonalityCommandHandlerOptions {
  personalities?: PersonalityDefinition[];
  influenceRegistry?: RegisteredInfluence[];
  influenceCooldowns?: InfluenceCooldownState;
  currentSync?: number;
  getIntensityMultiplier?: (influenceId: string) => number;
  memoryTextGenerator?: PersonalityMemoryTextGenerator;
  rng?: () => number;
  coinBalance?: number;
  engineVersion?: string;
  registryVersion?: string;
}

export interface PersonalityCommandReplayOptions extends Omit<PersonalityCommandHandlerOptions, 'currentSync'> {
  initialSync?: number;
}

export interface PersonalityCommandReplayResult<TState extends PersonalityState = PersonalityState> {
  pet: TState;
  events: DomainEvent[];
  commandResults: PetCommandResult<TState>[];
  influenceCooldowns: InfluenceCooldownState;
  currentSync: number;
  engineVersion: string;
  registryVersion: string;
  schemaVersion: number;
}

export async function replayPersonalityCommands<TState extends PersonalityState>(
  pet: TState,
  commands: PetCommand[],
  options: PersonalityCommandReplayOptions = {},
): Promise<PersonalityCommandReplayResult<TState>> {
  let currentPet = clonePet(pet);
  let currentSync = options.initialSync ?? 0;
  let influenceCooldowns = { ...(options.influenceCooldowns ?? {}) };
  const commandResults: PetCommandResult<TState>[] = [];
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
    schemaVersion: PERSONALITY_STATE_SCHEMA_VERSION,
    engineVersion: options.engineVersion ?? PERSONALITY_ENGINE_VERSION,
    registryVersion: options.registryVersion ?? STATIC_REGISTRY_VERSION,
  };
}

export async function applyPersonalityCommand<TState extends PersonalityState>(
  pet: TState,
  command: PetCommand,
  options: PersonalityCommandHandlerOptions = {},
): Promise<PetCommandResult<TState>> {
  const nextPet = clonePet(pet);
  const now = new Date(command.at);
  const events: DomainEvent[] = [];
  const influenceCooldowns = { ...(options.influenceCooldowns ?? {}) };
  const currentSync = options.currentSync ?? 0;
  const beforeVector = cloneTraitVector(nextPet.traitVector);
  const beforeBehaviorProfile = cloneBehaviorProfile(nextPet.behaviorProfile ?? createInitialBehaviorProfile());
  const beforeEvolutionReadiness = nextPet.evolutionReadiness ?? 0;
  const beforeEvolutionReadinessTarget = nextPet.evolutionReadinessTarget ?? null;
  const sensitivityStats = { ...nextPet.stats };
  const beforeMemoryIds = new Set(nextPet.coreMemories.map(memory => memory.id));
  const beforeEmergentState = nextPet.emergentState;
  const beforeProposal = nextPet.evolutionProposal;
  let gameplayOutcome = createEmptyGameplayOutcome();
  const personalities = requirePersonalities(options.personalities);
  const memoryTextGenerator = options.memoryTextGenerator ?? createDefaultMemoryTextGenerator();
  const rng = options.rng ?? createDeterministicRng(`${command.commandId}:${command.at}:${command.type}`);
  const ctx = {
    now,
    clientLocalHour: now.getHours(),
    personalities,
    getIntensityMultiplier: options.getIntensityMultiplier ?? (() => 1),
    memoryTextGenerator,
    dominantInfluences: [command.type],
    sensitivityStats,
    enableContextSensitivity: true,
    enablePreFormationSensitivity: true,
    rng,
  };

  if (command.type === 'sync') {
    gameplayOutcome = applyGameplayCommand(nextPet, command, {
      now,
      rng,
      coinBalance: options.coinBalance ?? 0,
      personalities,
      applySyncDecay: true,
    });
    if (gameplayOutcome.meta.autoSleepStarted) {
      events.push({ type: 'sleep_started', at: command.at, commandId: command.commandId });
    }
    await applyEligibleSystemInfluences(
      nextPet,
      command,
      options,
      ctx,
      events,
      influenceCooldowns,
      currentSync,
      gameplayOutcome,
    );
    const prevVector = cloneTraitVector(nextPet.traitVector);
    if (nextPet.formationComplete) {
      applyRegression(nextPet);
    }
    recordDailyTraitSnapshot(nextPet, now);
    checkVarianceHardReset(nextPet, ctx);
    if (nextPet.formationComplete) {
      checkEvolution(nextPet, ctx);
    }
    await checkThresholdCrossings(nextPet, prevVector, ctx);
    await checkWeeklyDrift(nextPet, ctx);
  } else if (command.type === 'sleep') {
    gameplayOutcome = applyGameplayCommand(nextPet, command, {
      now,
      rng,
      coinBalance: options.coinBalance ?? 0,
      personalities,
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
      personalities,
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
    // Lifecycle hooks: data-driven side effects on wake (early vs natural)
    if (sleptHours < 1) {
      await runInfluenceLifecycleHooks(
        'sleep_wake_early', nextPet, command, options, ctx, events, influenceCooldowns, currentSync,
      );
    } else if (naturalWake) {
      await runInfluenceLifecycleHooks(
        'sleep_wake_natural', nextPet, command, options, ctx, events, influenceCooldowns, currentSync,
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
      personalities,
    });
    if (!gameplayOutcome.blockedAction) {
      const influenceApplied = await applyCommandInfluence(nextPet, command, options, ctx, events, influenceCooldowns, currentSync);
      if (command.type === 'add_item' || command.type === 'use_item') {
        applyItemBehaviorStyle(nextPet, command, ctx);
      }
      applyCareRecoveryForCommand(nextPet, command, influenceApplied, events);
      applyCatharsisForCommand(nextPet, command, ctx, events);
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
    beforeBehaviorProfile,
    beforeEvolutionReadiness,
    beforeEvolutionReadinessTarget,
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
    activeEmergentStates: getActiveEmergentStates(nextPet),
    meta: gameplayOutcome.meta,
    schemaVersion: nextPet.schemaVersion ?? PERSONALITY_STATE_SCHEMA_VERSION,
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
  pet: PersonalityState,
  command: PetCommand,
  context: {
    now: Date;
    rng: () => number;
    coinBalance: number;
    personalities: PersonalityDefinition[];
    applySyncDecay?: boolean;
  },
): GameplayOutcome {
  const outcome = createEmptyGameplayOutcome();
  pet.behavioralCounters ??= createDefaultCounters({ now: context.now, rng: context.rng });
  pet.behaviorProfile ??= createInitialBehaviorProfile();
  pet.behavioralFlags ??= [];
  pet.moodHistory ??= [];

  const personality = getGameplayPersonality(pet, context.personalities);
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
        decayed.health = clampStat(decayed.health - 0.5 * (elapsedMinutes / 60));
      }
      pet.stats = decayed;
    } else {
      const restoreBonus = personality.restoreBonus.sleep?.energy ?? 0;
      pet.stats.energy = clampStat(pet.stats.energy + (2.5 + restoreBonus) * (elapsedMinutes / 15));
      pet.stats.hunger = clampStat(pet.stats.hunger - 0.5 * (elapsedMinutes / 15));
      pet.stats.health = clampStat(pet.stats.health + 0.125 * (elapsedMinutes / 15));
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

    if (!pet.isAsleep && personality.autoSleep.enabled && pet.stats.energy <= personality.autoSleep.energyThreshold) {
      if (context.rng() < personality.autoSleep.probability) {
        pet.isAsleep = true;
        onStartSleep(pet, { now: context.now, rng: context.rng });
        outcome.meta.autoSleepStarted = true;
        outcome.appliedModifiers.push({ source: 'base', id: 'system:auto_sleep', description: 'Auto sleep started during sync' });
      }
    }
  }

  if (actionType) {
    const actionOutcome = applyActionOutcome(pet, command, actionType, {
      now: context.now,
      rng: context.rng,
      coinBalance: context.coinBalance,
      personalities: context.personalities,
    });
    const systemMeta = outcome.meta;
    const systemModifiers = outcome.appliedModifiers;
    Object.assign(outcome, actionOutcome);
    outcome.meta = { ...systemMeta, ...actionOutcome.meta };
    outcome.appliedModifiers = [...systemModifiers, ...actionOutcome.appliedModifiers];
    if (outcome.blockedAction) {
      return outcome;
    }

    const actionContext: ActionContext = {
      clientLocalHour: context.now.getHours(),
      coinBalance: context.coinBalance,
      now: context.now,
      rng: context.rng,
      foodId: command.type === 'feed' ? command.foodId : undefined,
      itemId: command.type === 'use_item' || command.type === 'add_item' ? command.itemId : undefined,
    };
    pet.behavioralCounters = updateCounters(
      pet.behavioralCounters,
      actionType,
      pet.stats as Record<StatKey, number>,
      actionContext,
      personality,
    );
  }

  const currentMood = calcMoodWithBias(
    pet.stats as Record<StatKey, number>,
    personality,
    pet.isAsleep,
  ) as PersonalityMood;
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
  pet: PersonalityState,
  command: PetCommand,
  actionType: ActionType,
  context: { now: Date; rng: () => number; coinBalance: number; personalities: PersonalityDefinition[] },
): GameplayOutcome {
  const outcome = createEmptyGameplayOutcome();
  outcome.actionType = actionType;
  if (actionType === 'sync') return outcome;

  const personality = getGameplayPersonality(pet, context.personalities);
  const activeStates = getActiveEmergentStateTypes(pet);
  const blockedByState = isActionBlocked(actionType, activeStates);
  if (blockedByState) {
    outcome.blockedAction = blockedByState;
    return outcome;
  }

  const specialBlock = getSpecialBlockedAction(pet, command, actionType, context.personalities);
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

  const playScore = command.type === 'play' ? getPlayScore(command, context.rng) : undefined;
  const base = getBaseActionResult(pet, command, actionType, context, playScore);
  if (!base) return outcome;
  if (playScore !== undefined) {
    outcome.meta.score = playScore;
  }

  const actionContext: ActionContext = {
    clientLocalHour: context.now.getHours(),
    coinBalance: context.coinBalance,
    now: context.now,
    rng: context.rng,
    foodId: command.type === 'feed' ? command.foodId : undefined,
    itemId: command.type === 'use_item' || command.type === 'add_item' ? command.itemId : undefined,
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

  applySpecialOutcomeModifiers(pet, command, actionType, outcome, context);
  applyStatDeltas(pet, outcome.statDeltas);
  outcome.coinDelta += applyXp(pet, outcome.xpDelta);
  return outcome;
}

function getBaseActionResult(
  pet: PersonalityState,
  command: PetCommand,
  actionType: ActionType,
  context: { rng: () => number },
  playScore?: number,
): { statDeltas: Partial<Record<StatKey, number>>; xp: number; coins: number } | null {
  const rule = BASE_ACTION_RULES[actionType];
  if (!rule) return actionType ? { statDeltas: {}, xp: 0, coins: 0 } : null;

  switch (command.type) {
    case 'play': {
      const score = playScore ?? getPlayScore(command, context.rng);
      const scaling = rule.scoreScaling;
      return {
        statDeltas: { ...rule.statDeltas },
        xp: scaling ? Math.floor(score * scaling.xpMultiplier) : rule.xp,
        coins: scaling ? Math.floor(score * scaling.coinMultiplier) + scaling.coinFlat : rule.coins,
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
        xp: rule.xp,
        coins: rule.coins,
      };
    }
    case 'bathe': {
      const personalityOverride = pet.formationComplete
        ? rule.personalityOverrides?.[pet.personality as keyof typeof rule.personalityOverrides] ?? {}
        : {};
      return {
        statDeltas: { ...rule.statDeltas, ...personalityOverride },
        xp: rule.xp,
        coins: rule.coins,
      };
    }
    case 'heal':
      return { statDeltas: { ...rule.statDeltas }, xp: rule.xp, coins: rule.coins };
    case 'bond':
      return { statDeltas: { ...rule.statDeltas }, xp: rule.xp, coins: rule.coins };
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
        xp: effect.xp ?? rule.xp,
        coins: effect.coins ?? rule.coins,
      };
    }
    case 'add_item':
      return { statDeltas: {}, xp: 0, coins: 0 };
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

function getSpecialBlockedAction(
  pet: PersonalityState,
  command: PetCommand,
  actionType: ActionType,
  personalities: PersonalityDefinition[],
): BlockedAction | null {
  const personality = getGameplayPersonality(pet, personalities);
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
  if (command.type === 'heal' && pet.stats.health >= 90 && pet.traumaLevel < 40 && pet.emergentState !== 'shadow_form') {
    return { actionType, reason: 'Питомец уже здоров!', alternativeHint: 'Выбери другое действие' };
  }
  if (command.type === 'heal' && personality.specialRules?.healRefuseHealthThreshold !== undefined && pet.stats.health > personality.specialRules.healRefuseHealthThreshold) {
    return { actionType, reason: 'Не верит что болен!', alternativeHint: 'Сначала укрепи доверие' };
  }
  return null;
}

function applySpecialOutcomeModifiers(
  pet: PersonalityState,
  command: PetCommand,
  actionType: ActionType,
  outcome: GameplayOutcome,
  context: { now: Date; personalities: PersonalityDefinition[] },
): void {
  const personality = getGameplayPersonality(pet, context.personalities);
  if (command.type === 'feed' && personality.specialRules?.feedRestoreByPhase) {
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

  // ── Catharsis XP burst (first catharsis only, 2 hours) ─────────────────────
  if (actionType && actionType !== 'sync' && pet.catharsisXpBurstExpiresAt) {
    const burstExpiry = new Date(pet.catharsisXpBurstExpiresAt).getTime();
    const now = context.now.getTime();
    if (now < burstExpiry && outcome.xpDelta > 0) {
      outcome.xpDelta = Math.round(outcome.xpDelta * CATHARSIS_XP_BURST_MULTIPLIER);
      outcome.appliedModifiers.push({ source: 'special_rule', id: 'catharsis_xp_burst', description: 'Catharsis XP burst active' });
    }
  }

  // ── Legacy bonuses from evolution history ──────────────────────────────────
  // Apply EVOLUTION_LEGACY bonuses from previously inhabited personalities.
  // Each evolution record contributes its legacy bonus cumulatively.
  if (pet.evolutionHistory.length > 0 && actionType && actionType !== 'sync') {
    let xpLegacyMult = 1.0;
    let coinLegacyMult = 1.0;
    let legacyApplied = false;
    for (const record of pet.evolutionHistory) {
      const bonus = EVOLUTION_LEGACY[record.fromPersonalityId];
      if (!bonus) continue;
      if (bonus.xpMultiplierBonus) { xpLegacyMult += bonus.xpMultiplierBonus; legacyApplied = true; }
      if (bonus.coinMultiplierBonus) { coinLegacyMult += bonus.coinMultiplierBonus; legacyApplied = true; }
    }
    if (legacyApplied) {
      outcome.xpDelta = Math.round(outcome.xpDelta * xpLegacyMult);
      outcome.coinDelta = Math.round(outcome.coinDelta * coinLegacyMult);
      outcome.appliedModifiers.push({ source: 'special_rule', id: 'evolution_legacy_bonus', description: 'Evolution legacy bonuses applied' });
    }
  }

  if (actionType) {
    outcome.xpDelta = Math.max(0, Math.round(outcome.xpDelta));
    outcome.coinDelta = Math.round(outcome.coinDelta);
  }
}

function applyStatDeltas(pet: PersonalityState, statDeltas: Partial<Record<StatKey, number>>): void {
  for (const [stat, value] of Object.entries(statDeltas)) {
    const key = stat as StatKey;
    pet.stats[key] = clampStat(pet.stats[key] + (value ?? 0));
  }
}

function applyXp(pet: PersonalityState, amount: number): number {
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
    case 'add_item':
    case 'sync':
      return command.type;
    case 'equip_room':
    case 'npc_visit':
    case 'accept_evolution':
    case 'reject_evolution':
      return null;
  }
}

function updateMoodStreaks(pet: PersonalityState, mood: PersonalityMood): void {
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
  pet: PersonalityState,
  command: PetCommand,
  options: PersonalityCommandHandlerOptions,
  ctx: Parameters<typeof applyInfluence>[2],
  events: DomainEvent[],
  influenceCooldowns: InfluenceCooldownState,
  currentSync: number,
): Promise<boolean> {
  const registry = requireInfluenceRegistry(options.influenceRegistry);
  const influenceId = getInfluenceIdForCommand(pet, command, registry);
  if (!influenceId) return false;
  return applyRegisteredInfluence(pet, influenceId, command, options, ctx, events, influenceCooldowns, currentSync);
}

function applyCareRecoveryForCommand(
  pet: PersonalityState,
  command: PetCommand,
  influenceApplied: boolean,
  events: DomainEvent[],
): void {
  if (influenceApplied || pet.emergentState === 'shadow_form') return;

  const amount = getTraumaRecoveryAmountForCommand(command);
  if (amount <= 0 || (pet.traumaLevel ?? 0) <= 0) return;

  const before = pet.traumaLevel ?? 0;
  pet.traumaLevel = Math.max(0, before - amount);
  if (pet.traumaLevel === before) return;

  events.push({
    type: 'trauma_level_changed',
    at: command.at,
    commandId: command.commandId,
    from: before,
    to: pet.traumaLevel,
    reason: 'care_recovery',
  });
}

function applyCatharsisForCommand(
  pet: PersonalityState,
  command: PetCommand,
  ctx: Parameters<typeof applyInfluence>[2],
  events: DomainEvent[],
): void {
  const amount = getCatharsisAmountForCommand(command);
  if (amount <= 0 || pet.emergentState !== 'shadow_form') return;

  const before = pet.catharsisProgress ?? 0;
  const completed = addCatharsisProgress(pet, amount, ctx);
  const after = completed ? 100 : (pet.catharsisProgress ?? before);
  if (after === before && !completed) return;

  events.push({
    type: 'catharsis_progress_changed',
    at: command.at,
    commandId: command.commandId,
    from: before,
    to: after,
    completed,
  });
}

function getCatharsisAmountForCommand(command: PetCommand): number {
  switch (command.type) {
    case 'bond':
      return 25;
    case 'heal':
      return 20;
    default:
      return 0;
  }
}

function getTraumaRecoveryAmountForCommand(command: PetCommand): number {
  switch (command.type) {
    case 'bond':
      return 3;
    case 'heal':
      return 2;
    default:
      return 0;
  }
}

async function applyEligibleSystemInfluences(
  pet: PersonalityState,
  command: PetCommand,
  options: PersonalityCommandHandlerOptions,
  ctx: Parameters<typeof applyInfluence>[2],
  events: DomainEvent[],
  influenceCooldowns: InfluenceCooldownState,
  currentSync: number,
  outcome: GameplayOutcome,
): Promise<void> {
  const registry = requireInfluenceRegistry(options.influenceRegistry);
  const candidates = registry.filter(influence => {
    if (influence.category !== 'system' && influence.category !== 'environment') return false;
    return (influence.conditions?.length ?? 0) > 0;
  });

  for (const influence of candidates) {
    const applied = await applyRegisteredInfluence(
      pet,
      influence.id,
      command,
      options,
      ctx,
      events,
      influenceCooldowns,
      currentSync,
    );
    if (applied) {
      outcome.appliedModifiers.push({
        source: 'base',
        id: influence.id,
        description: `Applied automatic influence: ${influence.label}`,
      });
    }
  }
}

// ── Lifecycle hook runner ────────────────────────────────────────────────────
// Finds all influences with matching onApply hook type and applies them.
// Adding new lifecycle side effects = add influence to registry with onApply set.
// Do not add new branches here.
async function runInfluenceLifecycleHooks(
  hookType: NonNullable<RegisteredInfluence['onApply']>,
  pet: PersonalityState,
  command: PetCommand,
  options: PersonalityCommandHandlerOptions,
  ctx: Parameters<typeof applyInfluence>[2],
  events: DomainEvent[],
  influenceCooldowns: InfluenceCooldownState,
  currentSync: number,
): Promise<void> {
  const registry = requireInfluenceRegistry(options.influenceRegistry);
  const candidates = registry.filter(influence => influence.onApply === hookType);
  for (const influence of candidates) {
    await applyRegisteredInfluence(
      pet, influence.id, command, options, ctx, events, influenceCooldowns, currentSync,
    );
  }
}

async function applyRegisteredInfluence(
  pet: PersonalityState,
  influenceId: string,
  command: PetCommand,
  options: PersonalityCommandHandlerOptions,
  ctx: Parameters<typeof applyInfluence>[2],
  events: DomainEvent[],
  influenceCooldowns: InfluenceCooldownState,
  currentSync: number,
): Promise<boolean> {
  const registry = requireInfluenceRegistry(options.influenceRegistry);
  const influence = registry.find(entry => entry.id === influenceId);
  if (!influence) return false;

  const lastAppliedSync = influenceCooldowns[influence.id];
  const cooldownSyncs = influence.cooldownSyncs ?? 0;
  const inSingularity = command.type === 'use_item' && getActiveEmergentStateTypes(pet).includes('singularity');
  if (!inSingularity && !canApplyInfluenceAtSync(lastAppliedSync, currentSync, cooldownSyncs)) {
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
    return false;
  }

  const { prevVector, applied, blockedConditions = [] } = applyInfluence(pet, influence, {
    ...ctx,
    dominantInfluences: [influence.label],
  });
  if (!applied) {
    if (blockedConditions.length > 0) {
      events.push({
        type: 'influence_condition_skipped',
        at: command.at,
        commandId: command.commandId,
        influenceId: influence.id,
        blockedConditions,
      });
    }
    return false;
  }

  influenceCooldowns[influence.id] = currentSync;
  updateBehaviorProfile(pet, influence.id, ctx);
  events.push({
    type: 'influence_applied',
    at: command.at,
    commandId: command.commandId,
    influenceId: influence.id,
    label: influence.label,
  });
  await checkThresholdCrossings(pet, prevVector, {
    ...ctx,
    dominantInfluences: [influence.label],
  });
  return true;
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
  pet: PersonalityState,
  command: PetCommand,
  registry: RegisteredInfluence[],
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
    case 'add_item':
      return null;
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
  pet: PersonalityState;
  beforeVector: TraitVector;
  beforeBehaviorProfile?: BehaviorProfile;
  beforeEvolutionReadiness: number;
  beforeEvolutionReadinessTarget: PersonalityState['evolutionReadinessTarget'];
  beforeMemoryIds: Set<string>;
  beforeEmergentState: PersonalityState['emergentState'];
  beforeProposal: PersonalityState['evolutionProposal'];
}): void {
  const {
    events,
    command,
    pet,
    beforeVector,
    beforeBehaviorProfile,
    beforeEvolutionReadiness,
    beforeEvolutionReadinessTarget,
    beforeMemoryIds,
    beforeEmergentState,
    beforeProposal,
  } = args;

  if (!sameTraitVector(beforeVector, pet.traitVector)) {
    events.push({
      type: 'trait_vector_changed',
      at: command.at,
      commandId: command.commandId,
      prevVector: beforeVector,
      nextVector: cloneTraitVector(pet.traitVector),
    });
  }

  const nextBehaviorProfile = cloneBehaviorProfile(pet.behaviorProfile);
  if (beforeBehaviorProfile && nextBehaviorProfile && !sameBehaviorProfile(beforeBehaviorProfile, nextBehaviorProfile)) {
    events.push({
      type: 'behavior_profile_changed',
      at: command.at,
      commandId: command.commandId,
      prevProfile: beforeBehaviorProfile,
      nextProfile: nextBehaviorProfile,
    });
  }

  const nextReadiness = pet.evolutionReadiness ?? 0;
  const nextReadinessTarget = pet.evolutionReadinessTarget ?? null;
  if (beforeEvolutionReadiness !== nextReadiness || beforeEvolutionReadinessTarget !== nextReadinessTarget) {
    events.push({
      type: 'evolution_readiness_changed',
      at: command.at,
      commandId: command.commandId,
      from: beforeEvolutionReadiness,
      to: nextReadiness,
      targetFrom: beforeEvolutionReadinessTarget ?? null,
      targetTo: nextReadinessTarget,
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

function cloneBehaviorProfile(profile: BehaviorProfile | undefined): BehaviorProfile | undefined {
  if (!profile) return undefined;
  return {
    axes: { ...profile.axes },
    sampleCount: profile.sampleCount,
    lastUpdatedAt: profile.lastUpdatedAt,
  };
}

function sameBehaviorProfile(a: BehaviorProfile, b: BehaviorProfile): boolean {
  if (a.sampleCount !== b.sampleCount || a.lastUpdatedAt !== b.lastUpdatedAt) return false;
  return (
    a.axes.care === b.axes.care &&
    a.axes.play === b.axes.play &&
    a.axes.social === b.axes.social &&
    a.axes.order === b.axes.order &&
    a.axes.exploration === b.axes.exploration &&
    a.axes.disruption === b.axes.disruption &&
    a.axes.recovery === b.axes.recovery
  );
}

function clonePet<TState extends PersonalityState>(pet: TState): TState {
  return cloneData(pet);
}

function requirePersonalities(personalities: PersonalityDefinition[] | undefined): PersonalityDefinition[] {
  if (personalities && personalities.length > 0) return personalities;
  throw new Error('PersonalityCommandHandlerOptions.personalities must include at least one personality definition.');
}

function requireInfluenceRegistry(registry: RegisteredInfluence[] | undefined): RegisteredInfluence[] {
  if (registry) return registry;
  throw new Error('PersonalityCommandHandlerOptions.influenceRegistry is required for command influence resolution.');
}

function getPersonalityFromRegistry(id: string, personalities: PersonalityDefinition[]): PersonalityDefinition {
  return personalities.find(personality => personality.id === id) ?? personalities[0];
}

function getGameplayPersonality(
  pet: PersonalityState,
  personalities: PersonalityDefinition[],
): PersonalityDefinition {
  if (pet.formationComplete) return getPersonalityFromRegistry(pet.personality, personalities);

  const base = personalities[0];
  return {
    ...base,
    id: base.id,
    name: 'Unformed',
    tagline: '',
    description: '',
    rarity: 'common',
    linkedSkinIds: [],
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
    specialRules: {},
    visualProfile: { statBarTints: {}, emergentStateAnims: {} },
  };
}

function createDefaultMemoryTextGenerator(): PersonalityMemoryTextGenerator {
  return {
    async generate(ctx) {
      return ctx.direction === 'origin' ? 'Что-то важное началось' : 'Что-то изменилось';
    },
  };
}
