/**
 * Real API — HTTP запросы к серверу студентов.
 * Студент реализует все эти же эндпоинты на своём сервере.
 */

import type {
  ApiService, Pet, FoodItem, PlayResult, ShopItem, InventoryItem, BuyResult,
  Achievement, ClaimResult, DailyQuest, QuestClaimResult, Room, LeaderboardEntry, PetEvent,
  NewLifeResult,
} from './types';

interface PetActionResult {
  pet: Pet;
  xpGained: number;
  coinsGained: number;
  events: string[];
}

export class RealApiService implements ApiService {
  private readonly base: string;

  constructor(baseUrl: string) {
    this.base = baseUrl.replace(/\/$/, '');
  }

  private async req<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
      ...opts,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}: ${path}`);
    }
    return res.json() as Promise<T>;
  }

  private post<T>(path: string, body?: unknown)  { return this.req<T>(path, { method: 'POST',  body: body ? JSON.stringify(body) : undefined }); }
  private patch<T>(path: string, body?: unknown) { return this.req<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }); }
  private async postPetAction(path: string, body?: unknown): Promise<Pet> {
    const result = await this.post<PetActionResult>(path, body);
    return result.pet;
  }

  // Питомец
  getPet()                  { return this.req<Pet>('/api/pet'); }
  feedPet(foodId: string)   { return this.postPetAction('/api/pet/feed', { foodId }); }
  playWithPet()             { return this.post<PlayResult>('/api/pet/play'); }
  sleepPet()                { return this.postPetAction('/api/pet/sleep'); }
  wakePet()                 { return this.postPetAction('/api/pet/wake'); }
  bathePet()                { return this.postPetAction('/api/pet/bathe'); }
  healPet()                 { return this.postPetAction('/api/pet/heal'); }
  bondWithPet()             { return this.postPetAction('/api/pet/bond'); }
  syncPet()                 { return this.post<Pet>('/api/pet/sync'); }
  acceptEvolution()         { return this.post<Pet>('/api/pet/evolution/accept'); }
  rejectEvolution()         { return this.post<Pet>('/api/pet/evolution/reject'); }
  beginNewLife()            { return this.post<NewLifeResult>('/api/pet/new-life'); }
  updatePetName(name: string) { return this.patch<Pet>('/api/pet/name', { name }); }
  getPetEvents()            { return this.req<PetEvent[]>('/api/pet/events'); }

  // Экономика
  getCoins()                { return this.req<{ coins: number }>('/api/coins'); }
  getShop()                 { return this.req<ShopItem[]>('/api/shop'); }
  buyItem(itemId: string)   { return this.post<BuyResult>('/api/shop/buy', { itemId }); }
  getInventory()            { return this.req<InventoryItem[]>('/api/inventory'); }
  useInventoryItem(itemId: string) { return this.post<Pet>('/api/inventory/use', { itemId }); }

  // Прогресс
  getAchievements()         { return this.req<Achievement[]>('/api/achievements'); }
  claimAchievement(achievementId: string) { return this.post<ClaimResult>('/api/achievements/claim', { achievementId }); }
  getQuests()               { return this.req<DailyQuest[]>('/api/quests'); }
  claimQuestReward(questId: string)       { return this.post<QuestClaimResult>('/api/quests/claim', { questId }); }

  // Комнаты
  getRooms()                { return this.req<Room[]>('/api/rooms'); }
  buyRoom(roomId: string)   { return this.post<Room[]>('/api/rooms/buy', { roomId }); }
  equipRoom(roomId: string) { return this.post<{ roomId: string }>('/api/rooms/equip', { roomId }); }

  // Рейтинг / Еда
  getLeaderboard()          { return this.req<LeaderboardEntry[]>('/api/leaderboard'); }
  getFoods()                { return this.req<FoodItem[]>('/api/foods'); }
}
