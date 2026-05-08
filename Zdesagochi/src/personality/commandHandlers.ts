import type { Pet } from '../api/types';
import type { DomainEvent, InfluenceCooldownState, PetCommand, PetCommandResult } from './commands';
import { PERSONALITY_ENGINE_VERSION, STATIC_REGISTRY_VERSION } from './engineVersion';
import { getInfluenceRegistry, getIntensityMultiplier as getGlobalIntensityMultiplier } from './influenceRegistry';
import { createMemoryTextGenerator, type MemoryTextGenerator } from './memoryTextGenerator';
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
import type { RegisteredInfluence, TraitVector } from './types';

export interface PersonalityCommandHandlerOptions {
  influenceRegistry?: RegisteredInfluence[];
  influenceCooldowns?: InfluenceCooldownState;
  currentSync?: number;
  getIntensityMultiplier?: (influenceId: string) => number;
  memoryTextGenerator?: MemoryTextGenerator;
  rng?: () => number;
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
    const prevVector = cloneTraitVector(nextPet.traitVector);
    applyRegression(nextPet);
    recordDailyTraitSnapshot(nextPet, now);
    checkVarianceHardReset(nextPet, ctx);
    checkEvolution(nextPet, ctx);
    await checkThresholdCrossings(nextPet, prevVector, ctx);
    await checkWeeklyDrift(nextPet, ctx);
  } else if (command.type === 'sleep') {
    onStartSleep(nextPet, ctx);
    events.push({ type: 'sleep_started', at: command.at, commandId: command.commandId });
    await applyCommandInfluence(nextPet, command, options, ctx, events, influenceCooldowns, currentSync);
  } else if (command.type === 'wake') {
    const sleptHours = nextPet.sleepStartedAt
      ? Math.max(0, (now.getTime() - new Date(nextPet.sleepStartedAt).getTime()) / 3_600_000)
      : 0;
    const naturalWake = sleptHours >= 4;
    onWakeFromSleep(nextPet, naturalWake, ctx);
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
    await applyCommandInfluence(nextPet, command, options, ctx, events, influenceCooldowns, currentSync);
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
    engineVersion: options.engineVersion ?? PERSONALITY_ENGINE_VERSION,
    registryVersion: options.registryVersion ?? STATIC_REGISTRY_VERSION,
  };
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
  const influenceId = getInfluenceIdForCommand(pet, command);
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

function getInfluenceIdForCommand(pet: Pet, command: PetCommand): string | null {
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
    case 'use_item':
      return `item:${command.itemId}`;
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
