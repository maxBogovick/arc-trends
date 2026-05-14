import type { PetCommand, PetCommandResult } from '@zdesagochi/personality-core';

export interface ServerCommandBatch {
  clientId: string;
  commands: PetCommand[];
  baseCommandId?: string | null;
}

export type ServerCommandRejectReason =
  | 'duplicate_in_batch'
  | 'invalid_command'
  | 'stale_base'
  | 'replay_failed';

export interface ServerRejectedCommand {
  commandId: string;
  reason: ServerCommandRejectReason;
  message: string;
}

export interface ServerCommandAck {
  acceptedCommandIds: string[];
  rejectedCommandIds: string[];
  rejectedCommands: ServerRejectedCommand[];
  lastAcceptedCommandId: string | null;
}

export interface ServerApi {
  submitCommands(batch: ServerCommandBatch): Promise<ServerCommandAck>;
  fetchCommandResults(sinceCommandId: string | null): Promise<PetCommandResult[]>;
}
