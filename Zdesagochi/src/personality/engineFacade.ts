import type { PersonalityRuntime, PersonalityState } from './coreState';
import type { PetCommand, PetCommandResult } from './commands';
import { applyPersonalityCommand } from './commandHandlers';

export interface PersonalityStateCommandResult extends Omit<PetCommandResult, 'pet'> {
  pet: PersonalityState;
}

export async function applyPersonalityStateCommand(
  state: PersonalityState,
  command: PetCommand,
  runtime: PersonalityRuntime = {},
): Promise<PersonalityStateCommandResult> {
  const result = await applyPersonalityCommand(state, command, {
    ...runtime,
    coinBalance: state.coinBalance,
  });

  return {
    ...result,
    pet: result.pet,
  };
}
