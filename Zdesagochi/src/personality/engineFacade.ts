import {
  applyPersonalityStateCommand as applyCorePersonalityStateCommand,
  type PersonalityStateCommandResult,
} from '../../packages/personality-core/src/engineFacade';
import type { PersonalityRuntime, PersonalityState } from '../../packages/personality-core/src/coreState';
import type { PetCommand } from '../../packages/personality-core/src/commands';
import {
  PERSONALITIES,
  createMemoryTextGenerator,
  getInfluenceRegistry,
  getIntensityMultiplier,
} from '../../packages/personality-pet-preset/src';

export type { PersonalityStateCommandResult } from '../../packages/personality-core/src/engineFacade';

export function applyPersonalityStateCommand(
  state: PersonalityState,
  command: PetCommand,
  runtime: PersonalityRuntime = {},
): Promise<PersonalityStateCommandResult> {
  return applyCorePersonalityStateCommand(state, command, {
    ...runtime,
    personalities: runtime.personalities ?? PERSONALITIES,
    influenceRegistry: runtime.influenceRegistry ?? getInfluenceRegistry(),
    getIntensityMultiplier: runtime.getIntensityMultiplier ?? getIntensityMultiplier,
    memoryTextGenerator: runtime.memoryTextGenerator ?? createMemoryTextGenerator(),
  });
}
