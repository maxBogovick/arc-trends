import type { PetCommand, PetCommandResult } from '../personality';

export interface ServerCommandBatch {
  clientId: string;
  commands: PetCommand[];
}

export interface ServerCommandAck {
  acceptedCommandIds: string[];
  rejectedCommandIds: string[];
  lastAcceptedCommandId: string | null;
}

export interface ServerApi {
  submitCommands(batch: ServerCommandBatch): Promise<ServerCommandAck>;
  fetchCommandResults(sinceCommandId: string | null): Promise<PetCommandResult[]>;
}
