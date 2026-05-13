export type {
  ApiService, Pet, FoodItem, PlayResult, ShopItem, InventoryItem, BuyResult,
  Achievement, ClaimResult, DailyQuest, QuestClaimResult, Room, LeaderboardEntry,
  PetEvent, PetStats, PetMood, PetStage, ItemType, ItemRarity, Account, MemoryGuardian, NewLifeResult,
} from './types';

export {
  MockApiService, FOODS, syncPersonalityFromSkin, setPersonalityDirectly,
  advanceMockTime, getMockTimeScale, setMockTimeScale,
  setMockOfflineStorage, clearMockOfflineRuntimeState,
  completeMockPetLifecycle, getMockAccount,
} from './mockApi';
export { RealApiService } from './realApi';
export { LocalSave, DEFAULT_LOCAL_SAVE_KEY, inventoryEntriesToMap } from './localSave';
export { SyncQueue, DEFAULT_SYNC_QUEUE_KEY } from './syncQueue';
export {
  DEFAULT_OFFLINE_PET_SAVE_KEY,
  createBrowserOfflineStorage,
  deleteOfflinePetSave,
  loadOfflinePetSave,
  saveOfflinePetSave,
  trySaveOfflinePetSave,
} from './offlineStorage';
export {
  ExplainabilityLog,
  DEFAULT_EXPLAINABILITY_LOG_KEY,
  DEFAULT_EXPLAINABILITY_LOG_LIMIT,
  createExplainabilityRecord,
  explainCommandRecord,
} from './explainability';
export { PetService } from './petService';
export { BackendReplayServerApi } from './backendReplayServer';
export { appPersonalityEngine } from './personalityEngineAdapter';
export { fromPersonalityState, toPersonalityState } from './personalityPetAdapter';
export type { LocalInventoryEntry, LocalSaveSnapshot, LocalSaveState, LocalSaveLoadResult } from './localSave';
export type { SyncQueueLoadResult } from './syncQueue';
export type { OfflineKeyValueStorage, OfflinePetSaveLoadResult, OfflinePetSaveResult } from './offlineStorage';
export type { CommandExplanation, ExplainabilityLogLoadResult, ExplainabilityRecord } from './explainability';
export type {
  ServerApi,
  ServerCommandAck,
  ServerCommandBatch,
  ServerCommandRejectReason,
  ServerRejectedCommand,
} from './serverApi';
export type { BackendReplayServerOptions, BackendReplayServerState } from './backendReplayServer';
export type { PetCommandDraft, PetServiceOptions, PetServiceRuntime, PetServiceState } from './petService';

import type { ApiService } from './types';
import { MockApiService } from './mockApi';
import { RealApiService } from './realApi';

export type ApiMode = 'mock' | 'real';

export function createApiService(mode: ApiMode, baseUrl = 'http://localhost:3000'): ApiService {
  return mode === 'mock' ? new MockApiService() : new RealApiService(baseUrl);
}
