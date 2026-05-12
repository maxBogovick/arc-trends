import type { Account, Pet } from './types';
import type {
  ServerApi,
  ServerCommandAck,
  ServerCommandBatch,
  ServerCommandRejectReason,
  ServerRejectedCommand,
} from './serverApi';
import type { InfluenceCooldownState, PetCommand, PetCommandResult } from '../personality';
import type { PersonalityCommandHandlerOptions } from '../personality/commandHandlers';
import { applyPersonalityCommand } from '../personality';
import { cloneData } from '../personality/clone';

export interface BackendReplayServerState {
  pet: Pet;
  account: Account;
  coins: number;
  influenceCooldowns: InfluenceCooldownState;
  currentSync: number;
  lastAcceptedCommandId: string | null;
}

export interface BackendReplayServerOptions {
  initialState: BackendReplayServerState;
  normalizePet?: (pet: Pet) => Pet;
  getIntensityMultiplier?: PersonalityCommandHandlerOptions['getIntensityMultiplier'];
  memoryTextGenerator?: PersonalityCommandHandlerOptions['memoryTextGenerator'];
  rng?: PersonalityCommandHandlerOptions['rng'];
}

export class BackendReplayServerApi implements ServerApi {
  private pet: Pet;
  private account: Account;
  private coins: number;
  private influenceCooldowns: InfluenceCooldownState;
  private currentSync: number;
  private lastAcceptedCommandId: string | null;
  private readonly acceptedCommandIds = new Set<string>();
  private readonly results: PetCommandResult[] = [];

  constructor(private readonly options: BackendReplayServerOptions) {
    this.pet = clonePet(options.initialState.pet);
    this.account = cloneAccount(options.initialState.account);
    this.coins = options.initialState.coins;
    this.influenceCooldowns = { ...options.initialState.influenceCooldowns };
    this.currentSync = options.initialState.currentSync;
    this.lastAcceptedCommandId = options.initialState.lastAcceptedCommandId;
    if (this.lastAcceptedCommandId) this.acceptedCommandIds.add(this.lastAcceptedCommandId);
  }

  async submitCommands(batch: ServerCommandBatch): Promise<ServerCommandAck> {
    const acceptedCommandIds: string[] = [];
    const rejectedCommands: ServerRejectedCommand[] = [];

    if (batch.baseCommandId !== undefined && batch.baseCommandId !== this.lastAcceptedCommandId) {
      return {
        acceptedCommandIds,
        rejectedCommandIds: batch.commands.map((command, index) => getRejectedCommandId(command, index)),
        rejectedCommands: batch.commands.map((command, index) => ({
          commandId: getRejectedCommandId(command, index),
          reason: 'stale_base',
          message: 'Batch base command does not match server cursor.',
        })),
        lastAcceptedCommandId: this.lastAcceptedCommandId,
      };
    }

    const seenInBatch = new Set<string>();
    for (let index = 0; index < batch.commands.length; index++) {
      const command = batch.commands[index];
      if (!isPetCommandShape(command)) {
        rejectedCommands.push({
          commandId: getRejectedCommandId(command, index),
          reason: 'invalid_command',
          message: 'Command shape is invalid.',
        });
        continue;
      }
      if (seenInBatch.has(command.commandId)) {
        rejectedCommands.push(createRejected(command, 'duplicate_in_batch', 'CommandId appears more than once in this batch.'));
        continue;
      }
      seenInBatch.add(command.commandId);

      if (this.acceptedCommandIds.has(command.commandId)) {
        acceptedCommandIds.push(command.commandId);
        continue;
      }

      try {
        if (command.type === 'sync') this.currentSync++;
        const result = await applyPersonalityCommand(this.pet, command, {
          currentSync: this.currentSync,
          influenceCooldowns: this.influenceCooldowns,
          coinBalance: this.coins,
          getIntensityMultiplier: this.options.getIntensityMultiplier,
          memoryTextGenerator: this.options.memoryTextGenerator,
          rng: this.options.rng,
        });

        this.pet = this.normalizePet(result.pet);
        this.coins += result.coinDelta;
        this.influenceCooldowns = result.influenceCooldowns;
        this.lastAcceptedCommandId = command.commandId;
        this.acceptedCommandIds.add(command.commandId);
        this.results.push(result);
        acceptedCommandIds.push(command.commandId);
      } catch (error) {
        rejectedCommands.push(createRejected(command, 'replay_failed', error instanceof Error ? error.message : String(error)));
      }
    }

    return {
      acceptedCommandIds,
      rejectedCommandIds: rejectedCommands.map(command => command.commandId),
      rejectedCommands,
      lastAcceptedCommandId: this.lastAcceptedCommandId,
    };
  }

  async fetchCommandResults(sinceCommandId: string | null): Promise<PetCommandResult[]> {
    if (!sinceCommandId) return [...this.results];

    const index = this.results.findIndex(result => result.command.commandId === sinceCommandId);
    if (index < 0) return [...this.results];
    return this.results.slice(index + 1);
  }

  getState(): BackendReplayServerState {
    return {
      pet: clonePet(this.pet),
      account: cloneAccount(this.account),
      coins: this.coins,
      influenceCooldowns: { ...this.influenceCooldowns },
      currentSync: this.currentSync,
      lastAcceptedCommandId: this.lastAcceptedCommandId,
    };
  }

  private normalizePet(pet: Pet): Pet {
    return this.options.normalizePet ? this.options.normalizePet(pet) : pet;
  }
}

function createRejected(
  command: Pick<PetCommand, 'commandId'>,
  reason: ServerCommandRejectReason,
  message: string,
): ServerRejectedCommand {
  return {
    commandId: command.commandId,
    reason,
    message,
  };
}

function isPetCommandShape(value: unknown): value is PetCommand {
  if (!isObject(value)) return false;
  if (typeof value.type !== 'string' || typeof value.at !== 'string' || typeof value.commandId !== 'string') {
    return false;
  }
  if (!SUPPORTED_COMMAND_TYPES.has(value.type)) return false;
  return Number.isFinite(Date.parse(value.at));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRejectedCommandId(command: unknown, index: number): string {
  if (isObject(command) && typeof command.commandId === 'string' && command.commandId.length > 0) {
    return command.commandId;
  }
  return `invalid:${index}`;
}

const SUPPORTED_COMMAND_TYPES = new Set<string>([
  'feed',
  'play',
  'sleep',
  'wake',
  'bathe',
  'heal',
  'bond',
  'use_item',
  'equip_room',
  'npc_visit',
  'accept_evolution',
  'reject_evolution',
  'sync',
]);

function clonePet(pet: Pet): Pet {
  return cloneData(pet);
}

function cloneAccount(account: Account): Account {
  return cloneData(account);
}
