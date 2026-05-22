import type { PersonalityState } from './coreState';
import type {
  ActionType,
  ActiveEmergentState,
  BlockedAction,
  BehaviorProfile,
  CoreMemory,
  EmergentStateType,
  EvolutionProposal,
  EvolutionRecord,
  InfluenceCondition,
  PersonalityId,
  StatKey,
  TraitVector,
} from './types';
import { PERSONALITY_ENGINE_VERSION, PERSONALITY_STATE_SCHEMA_VERSION, STATIC_REGISTRY_VERSION } from './engineVersion';

export type PetCommand =
  | { type: 'feed'; foodId: string; foodEffect?: { hungerRestore: number; happinessBonus: number; healthBonus: number }; at: string; commandId: string }
  | { type: 'play'; scoreSeed: string; at: string; commandId: string }
  | { type: 'sleep'; at: string; commandId: string }
  | { type: 'wake'; at: string; commandId: string }
  | { type: 'bathe'; at: string; commandId: string }
  | { type: 'heal'; at: string; commandId: string }
  | { type: 'bond'; at: string; commandId: string }
  | { type: 'use_item'; itemId: string; itemKind?: 'food' | 'toy' | 'medicine' | 'decoration'; itemEffect?: Partial<Record<StatKey | 'xp' | 'coins', number>>; at: string; commandId: string }
  | { type: 'add_item'; itemId: string; itemKind?: 'food' | 'toy' | 'medicine' | 'decoration'; quantity?: number; at: string; commandId: string }
  | { type: 'equip_room'; roomId: string; at: string; commandId: string }
  | { type: 'npc_visit'; npcPersonalityId: PersonalityId; at: string; commandId: string }
  | { type: 'accept_evolution'; proposalId?: string; at: string; commandId: string }
  | { type: 'reject_evolution'; proposalId?: string; at: string; commandId: string }
  | { type: 'sync'; at: string; commandId: string };

export type DomainEvent =
  | { type: 'trait_vector_changed'; at: string; commandId: string; prevVector: TraitVector; nextVector: TraitVector }
  | { type: 'behavior_profile_changed'; at: string; commandId: string; prevProfile: BehaviorProfile; nextProfile: BehaviorProfile }
  | { type: 'evolution_readiness_changed'; at: string; commandId: string; from: number; to: number; targetFrom: PersonalityId | null; targetTo: PersonalityId | null }
  | { type: 'gameplay_outcome_applied'; at: string; commandId: string; actionType: ActionType; statDeltas: Partial<Record<StatKey, number>>; xpDelta: number; coinDelta: number; blockedAction: BlockedAction | null }
  | { type: 'trauma_level_changed'; at: string; commandId: string; from: number; to: number; reason: string }
  | { type: 'catharsis_progress_changed'; at: string; commandId: string; from: number; to: number; completed: boolean }
  | { type: 'core_memory_added'; at: string; commandId: string; memory: CoreMemory }
  | { type: 'evolution_proposed'; at: string; commandId: string; proposal: EvolutionProposal }
  | { type: 'evolution_recorded'; at: string; commandId: string; record: EvolutionRecord }
  | { type: 'emergent_state_changed'; at: string; commandId: string; from: EmergentStateType | null; to: EmergentStateType | null }
  | { type: 'sleep_started'; at: string; commandId: string }
  | { type: 'sleep_finished'; at: string; commandId: string; naturalWake: boolean; sleptHours: number }
  | { type: 'influence_applied'; at: string; commandId: string; influenceId: string; label: string }
  | { type: 'influence_condition_skipped'; at: string; commandId: string; influenceId: string; blockedConditions: InfluenceCondition[] }
  | { type: 'influence_cooldown_skipped'; at: string; commandId: string; influenceId: string; lastAppliedSync: number; currentSync: number; cooldownSyncs: number }
  | { type: 'offline_sync_capped'; at: string; commandId: string; reason: string };

export type InfluenceCooldownState = Record<string, number>;

export interface EngineContext {
  now: Date;
  clientLocalHour?: number;
  engineVersion: string;
  registryVersion: string;
}

export interface AppliedModifier {
  source: 'personality' | 'flag' | 'state' | 'special_rule' | 'base';
  id: string;
  description: string;
}

export interface PetCommandResult<TState extends PersonalityState = PersonalityState> {
  pet: TState;
  events: DomainEvent[];
  command: PetCommand;
  influenceCooldowns: InfluenceCooldownState;
  statDeltas: Partial<Record<StatKey, number>>;
  xpDelta: number;
  coinDelta: number;
  blockedAction: BlockedAction | null;
  appliedModifiers: AppliedModifier[];
  /** All active emergent states from all layers, sorted by priority. */
  activeEmergentStates: ActiveEmergentState[];
  meta?: Record<string, unknown>;
  schemaVersion: number;
  engineVersion: string;
  registryVersion: string;
}

export interface OfflinePetSave {
  petSnapshot: PersonalityState;
  commandLog: PetCommand[];
  lastSyncedCommandId: string | null;
  influenceCooldowns: InfluenceCooldownState;
  schemaVersion?: number;
  engineVersion: string;
  registryVersion: string;
  savedAt: string;
}

export function createOfflinePetSave(
  petSnapshot: PersonalityState,
  savedAt: string,
  options: {
    commandLog?: PetCommand[];
    lastSyncedCommandId?: string | null;
    influenceCooldowns?: InfluenceCooldownState;
    engineVersion?: string;
    registryVersion?: string;
  } = {},
): OfflinePetSave {
  return {
    petSnapshot,
    commandLog: [...(options.commandLog ?? [])],
    lastSyncedCommandId: options.lastSyncedCommandId ?? null,
    influenceCooldowns: { ...(options.influenceCooldowns ?? {}) },
    schemaVersion: petSnapshot.schemaVersion ?? PERSONALITY_STATE_SCHEMA_VERSION,
    engineVersion: options.engineVersion ?? PERSONALITY_ENGINE_VERSION,
    registryVersion: options.registryVersion ?? STATIC_REGISTRY_VERSION,
    savedAt,
  };
}

export function appendOfflineCommand(save: OfflinePetSave, command: PetCommand): OfflinePetSave {
  if (save.commandLog.some(entry => entry.commandId === command.commandId)) return save;

  return {
    ...save,
    commandLog: [...save.commandLog, command],
    savedAt: command.at,
  };
}

export function getUnsyncedCommands(save: OfflinePetSave): PetCommand[] {
  if (!save.lastSyncedCommandId) return [...save.commandLog];

  const lastSyncedIndex = save.commandLog.findIndex(
    command => command.commandId === save.lastSyncedCommandId,
  );
  if (lastSyncedIndex < 0) return [...save.commandLog];

  return save.commandLog.slice(lastSyncedIndex + 1);
}

export function markCommandsSynced(save: OfflinePetSave, lastSyncedCommandId: string): OfflinePetSave {
  if (!save.commandLog.some(command => command.commandId === lastSyncedCommandId)) return save;

  return {
    ...save,
    lastSyncedCommandId,
  };
}
