import type { Account, Pet } from './types';
import { ExplainabilityLog } from './explainability';
import { LocalSave, inventoryEntriesToMap } from './localSave';
import { SyncQueue } from './syncQueue';
import type { InfluenceCooldownState, PersonalityRuntime, PetCommand, PetCommandResult } from '@zdesagochi/personality-core';
import { createBrowserOfflineStorage, type OfflineKeyValueStorage } from './offlineStorage';
import { appPersonalityEngine } from './personalityEngineAdapter';
import { fromPersonalityState, toPersonalityState } from './personalityPetAdapter';
import type { ServerApi, ServerCommandAck } from './serverApi';

export type PetCommandDraft = PetCommand extends infer Command
  ? Command extends PetCommand
    ? Omit<Command, 'commandId'> & { commandId?: string }
    : never
  : never;

export interface PetServiceState {
  pet: Pet;
  account: Account;
  coins: number;
  inventory: Map<string, number>;
  influenceCooldowns: InfluenceCooldownState;
}

export interface PetServiceRuntime {
  currentSync: number;
  getIntensityMultiplier: NonNullable<PersonalityRuntime['getIntensityMultiplier']>;
  memoryTextGenerator: NonNullable<PersonalityRuntime['memoryTextGenerator']>;
  rng: () => number;
}

export interface PetServiceOptions {
  getState(): PetServiceState;
  setState(patch: Partial<PetServiceState>): void;
  nowIso(): string;
  nextCommandId(type: PetCommand['type']): string;
  normalizePet(pet: Pet): Pet;
  getRuntime(): PetServiceRuntime;
  storage?: OfflineKeyValueStorage | null;
  autoHydrate?: boolean;
}

export class PetService {
  private readonly localSave: LocalSave | null;
  private readonly syncQueue: SyncQueue | null;
  private readonly explainabilityLog: ExplainabilityLog | null;
  private hydrated = false;

  constructor(private readonly options: PetServiceOptions) {
    const storage = options.storage === undefined ? createBrowserOfflineStorage() : options.storage;
    this.localSave = storage ? new LocalSave(storage) : null;
    this.syncQueue = storage ? new SyncQueue(storage) : null;
    this.explainabilityLog = storage ? new ExplainabilityLog(storage) : null;
  }

  hydrate(): void {
    if (this.hydrated) return;
    this.hydrated = true;
    if (!this.localSave) return;

    const loaded = this.localSave.load();
    if (!loaded.ok) return;

    this.options.setState({
      pet: this.options.normalizePet(loaded.snapshot.pet),
      account: loaded.snapshot.account,
      coins: loaded.snapshot.coins,
      inventory: inventoryEntriesToMap(loaded.snapshot.inventory),
      influenceCooldowns: loaded.snapshot.influenceCooldowns,
    });
  }

  async applyCommand(commandDraft: PetCommandDraft): Promise<PetCommandResult<Pet>> {
    if (this.options.autoHydrate !== false) this.hydrate();
    const state = this.options.getState();
    const command = {
      ...commandDraft,
      commandId: commandDraft.commandId ?? this.options.nextCommandId(commandDraft.type),
    } as PetCommand;
    const runtime = this.options.getRuntime();

    const personalityState = toPersonalityState(state.pet, state.account, state.coins);
    const stateResult = await appPersonalityEngine.applyCommand(personalityState, command, {
      currentSync: runtime.currentSync,
      influenceCooldowns: state.influenceCooldowns,
      getIntensityMultiplier: runtime.getIntensityMultiplier,
      memoryTextGenerator: runtime.memoryTextGenerator,
      rng: runtime.rng,
    });

    const pet = this.options.normalizePet(fromPersonalityState(stateResult.pet, state.pet));
    const result: PetCommandResult<Pet> = {
      ...stateResult,
      pet,
    };
    const coins = state.coins + stateResult.coinDelta;
    this.options.setState({
      pet,
      coins,
      influenceCooldowns: result.influenceCooldowns,
    });
    this.syncQueue?.enqueue(command);
    this.explainabilityLog?.appendResult(result, this.options.nowIso());
    this.save();
    return result;
  }

  persist(): void {
    this.save();
  }

  listPendingCommands(): PetCommand[] {
    this.hydrate();
    return this.syncQueue?.listPending() ?? [];
  }

  markCommandSynced(commandId: string): void {
    this.hydrate();
    this.syncQueue?.markSynced(commandId);
  }

  async syncPendingCommands(serverApi: ServerApi, clientId: string): Promise<ServerCommandAck> {
    this.hydrate();
    const commands = this.syncQueue?.listPending() ?? [];
    const ack = await serverApi.submitCommands({ clientId, commands });
    const accepted = new Set(ack.acceptedCommandIds);

    for (const command of commands) {
      if (!accepted.has(command.commandId)) break;
      this.syncQueue?.markSynced(command.commandId);
    }

    return ack;
  }

  listExplainabilityRecords() {
    this.hydrate();
    return this.explainabilityLog?.list() ?? [];
  }

  selectCommandExplanation(commandId?: string) {
    this.hydrate();
    return this.explainabilityLog?.select(commandId) ?? null;
  }

  private save(): void {
    this.localSave?.save(this.options.getState(), this.options.nowIso());
  }
}
