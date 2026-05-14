import type { DomainEvent, PetCommand } from './commands';
import type {
  PersonalityInfluenceCooldownState,
  PersonalityRuntime,
  PersonalityState,
} from './coreState';
import { PERSONALITY_STATE_SCHEMA_VERSION } from './engineVersion';
import { applyPersonalityStateCommand, type PersonalityStateCommandResult } from './engineFacade';

export interface PersonalityEngineValidationIssue {
  severity: 'warning' | 'error';
  message: string;
}

export interface PersonalityEngineConfig {
  id: string;
  name?: string;
  personalities?: PersonalityRuntime['personalities'];
  influenceRegistry?: PersonalityRuntime['influenceRegistry'];
  getIntensityMultiplier?: PersonalityRuntime['getIntensityMultiplier'];
  memoryTextGenerator?: PersonalityRuntime['memoryTextGenerator'];
  engineVersion?: string;
  registryVersion?: string;
  validate?: () => PersonalityEngineValidationIssue[] | void;
}

export interface PersonalityPreset extends PersonalityEngineConfig {
  name: string;
}

export interface PersonalityReplayResult {
  pet: PersonalityState;
  events: DomainEvent[];
  commandResults: PersonalityStateCommandResult[];
  influenceCooldowns: PersonalityInfluenceCooldownState;
  currentSync: number;
  schemaVersion: number;
  engineVersion?: string;
  registryVersion?: string;
}

export interface PersonalityEngine {
  readonly config: PersonalityEngineConfig;
  applyCommand(
    state: PersonalityState,
    command: PetCommand,
    runtime?: PersonalityRuntime,
  ): Promise<PersonalityStateCommandResult>;
  replay(
    state: PersonalityState,
    commands: PetCommand[],
    runtime?: PersonalityRuntime,
  ): Promise<PersonalityReplayResult>;
  explain(result: PersonalityStateCommandResult): string[];
  validateConfig(): PersonalityEngineValidationIssue[];
}

export function createPersonalityEngine(config: PersonalityEngineConfig): PersonalityEngine {
  const engineConfig: PersonalityEngineConfig = {
    ...config,
    influenceRegistry: config.influenceRegistry ? [...config.influenceRegistry] : undefined,
  };

  const applyCommand: PersonalityEngine['applyCommand'] = (state, command, runtime = {}) => {
    return applyPersonalityStateCommand(state, command, mergeRuntime(engineConfig, runtime));
  };

  const replay: PersonalityEngine['replay'] = async (state, commands, runtime = {}) => {
    const replayRuntime = mergeRuntime(engineConfig, runtime);
    let currentState = state;
    let currentSync = replayRuntime.currentSync ?? 0;
    let influenceCooldowns = { ...(replayRuntime.influenceCooldowns ?? {}) };
    const events: DomainEvent[] = [];
    const commandResults: PersonalityStateCommandResult[] = [];

    for (const command of commands) {
      if (command.type === 'sync') currentSync++;
      const result = await applyCommand(currentState, command, {
        ...replayRuntime,
        currentSync,
        influenceCooldowns,
      });
      currentState = result.pet;
      influenceCooldowns = result.influenceCooldowns;
      events.push(...result.events);
      commandResults.push(result);
    }

    return {
      pet: currentState,
      events,
      commandResults,
      influenceCooldowns,
      currentSync,
      schemaVersion: currentState.schemaVersion ?? PERSONALITY_STATE_SCHEMA_VERSION,
      engineVersion: replayRuntime.engineVersion,
      registryVersion: replayRuntime.registryVersion,
    };
  };

  return {
    config: engineConfig,
    applyCommand,
    replay,
    explain(result) {
      return explainCommandResult(result);
    },
    validateConfig() {
      return validateEngineConfig(engineConfig);
    },
  };
}

function mergeRuntime(
  config: PersonalityEngineConfig,
  runtime: PersonalityRuntime,
): PersonalityRuntime {
  return {
    ...runtime,
    personalities: runtime.personalities ?? config.personalities,
    influenceRegistry: runtime.influenceRegistry ?? config.influenceRegistry,
    getIntensityMultiplier: runtime.getIntensityMultiplier ?? config.getIntensityMultiplier,
    memoryTextGenerator: runtime.memoryTextGenerator ?? config.memoryTextGenerator,
    engineVersion: runtime.engineVersion ?? config.engineVersion,
    registryVersion: runtime.registryVersion ?? config.registryVersion,
  };
}

function validateEngineConfig(config: PersonalityEngineConfig): PersonalityEngineValidationIssue[] {
  const issues: PersonalityEngineValidationIssue[] = [];
  if (!config.id.trim()) {
    issues.push({ severity: 'error', message: 'PersonalityEngineConfig.id must not be empty.' });
  }

  try {
    issues.push(...(config.validate?.() ?? []));
  } catch (error) {
    issues.push({
      severity: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return issues;
}

function explainCommandResult(result: PersonalityStateCommandResult): string[] {
  const lines = result.events.map(event => explainEvent(event));
  if (result.blockedAction) {
    lines.push(`Blocked ${result.blockedAction.actionType}: ${result.blockedAction.reason}`);
  }
  if (result.appliedModifiers.length > 0) {
    lines.push(`Applied modifiers: ${result.appliedModifiers.map(modifier => modifier.id).join(', ')}`);
  }
  return lines;
}

function explainEvent(event: DomainEvent): string {
  switch (event.type) {
    case 'trait_vector_changed':
      return 'Trait vector changed.';
    case 'gameplay_outcome_applied':
      return `${event.actionType} outcome applied: xp ${event.xpDelta}, coins ${event.coinDelta}.`;
    case 'core_memory_added':
      return `Core memory added: ${event.memory.id}.`;
    case 'evolution_proposed':
      return `Evolution proposed: ${event.proposal.targetPersonalityId}.`;
    case 'evolution_recorded':
      return `Evolution recorded: ${event.record.fromPersonalityId} -> ${event.record.toPersonalityId}.`;
    case 'emergent_state_changed':
      return `Emergent state changed: ${event.from ?? 'none'} -> ${event.to ?? 'none'}.`;
    case 'sleep_started':
      return 'Sleep started.';
    case 'sleep_finished':
      return `Sleep finished after ${event.sleptHours.toFixed(2)}h.`;
    case 'influence_applied':
      return `Influence applied: ${event.influenceId}.`;
    case 'influence_condition_skipped':
      return `Influence skipped by conditions: ${event.influenceId}.`;
    case 'influence_cooldown_skipped':
      return `Influence skipped by cooldown: ${event.influenceId}.`;
    case 'offline_sync_capped':
      return `Offline sync capped: ${event.reason}.`;
  }
}
