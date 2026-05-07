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

import type { ApiService } from './types';
import { MockApiService } from './mockApi';
import { RealApiService } from './realApi';

export type ApiMode = 'mock' | 'real';

export function createApiService(mode: ApiMode, baseUrl = 'http://localhost:3000'): ApiService {
  return mode === 'mock' ? new MockApiService() : new RealApiService(baseUrl);
}
