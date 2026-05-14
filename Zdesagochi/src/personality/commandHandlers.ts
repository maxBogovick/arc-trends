import {
  applyPersonalityCommand as applyCorePersonalityCommand,
  replayPersonalityCommands as replayCorePersonalityCommands,
  type PersonalityCommandHandlerOptions,
  type PersonalityCommandReplayOptions,
} from '../../packages/personality-core/src/commandHandlers';
import type { PersonalityState } from '../../packages/personality-core/src/coreState';
import type { PetCommand } from '../../packages/personality-core/src/commands';
import { getInfluenceRegistry, getIntensityMultiplier } from './influenceRegistry';
import { createMemoryTextGenerator } from './memoryTextGenerator';
import { PERSONALITIES } from './personalities';

export type {
  PersonalityCommandHandlerOptions,
  PersonalityCommandReplayOptions,
  PersonalityCommandReplayResult,
} from '../../packages/personality-core/src/commandHandlers';

export function applyPersonalityCommand<TState extends PersonalityState>(
  pet: TState,
  command: PetCommand,
  options: PersonalityCommandHandlerOptions = {},
) {
  return applyCorePersonalityCommand(pet, command, withZdesagochiDefaults(options));
}

export function replayPersonalityCommands<TState extends PersonalityState>(
  pet: TState,
  commands: PetCommand[],
  options: PersonalityCommandReplayOptions = {},
) {
  return replayCorePersonalityCommands(pet, commands, withZdesagochiDefaults(options));
}

function withZdesagochiDefaults<TOptions extends PersonalityCommandHandlerOptions>(
  options: TOptions,
): TOptions {
  return {
    ...options,
    personalities: options.personalities ?? PERSONALITIES,
    influenceRegistry: options.influenceRegistry ?? getInfluenceRegistry(),
    getIntensityMultiplier: options.getIntensityMultiplier ?? getIntensityMultiplier,
    memoryTextGenerator: options.memoryTextGenerator ?? createMemoryTextGenerator(),
  };
}
