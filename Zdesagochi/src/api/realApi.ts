/**
 * Real API — HTTP запросы к серверу студентов.
 * Студент реализует все эти же эндпоинты на своём сервере.
 */

import type {
  ApiService, Pet, FoodItem, PlayResult, ShopItem, InventoryItem, BuyResult,
  Achievement, ClaimResult, DailyQuest, QuestClaimResult, Room, LeaderboardEntry, PetEvent,
  NewLifeResult, PersonalityTelemetrySample,
} from './types';

interface PetActionResult {
  pet: Pet;
  xpGained: number;
  coinsGained: number;
  events: string[];
}

interface AuthResponse {
  token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

interface StoredAuth {
  token: string;
  refreshToken: string;
  email: string;
}

const AUTH_STORAGE_KEY = 'zdesagochi:real-api-auth:v1';
const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const DEV_AUTH = {
  username: viteEnv.VITE_DEV_AUTH_USERNAME ?? 'dev_user',
  email: viteEnv.VITE_DEV_AUTH_EMAIL ?? 'dev_user@zdesagochi.local',
  password: viteEnv.VITE_DEV_AUTH_PASSWORD ?? 'zdesagochi-dev-password',
};

let inMemoryAuth: StoredAuth | null = null;

function readStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined' || !window.localStorage) return inMemoryAuth;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return inMemoryAuth;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (parsed.token && parsed.refreshToken && parsed.email) {
      inMemoryAuth = {
        token: parsed.token,
        refreshToken: parsed.refreshToken,
        email: parsed.email,
      };
      return inMemoryAuth;
    }
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  return inMemoryAuth;
}

function writeStoredAuth(auth: StoredAuth | null): void {
  inMemoryAuth = auth;
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!auth) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export class RealApiService implements ApiService {
  private readonly base: string;
  private authPromise: Promise<StoredAuth> | null = null;

  constructor(baseUrl: string) {
    this.base = baseUrl.replace(/\/$/, '');
  }

  private async unauthenticatedReq<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}: ${path}`);
    }
    return res.json() as Promise<T>;
  }

  private async authenticate(): Promise<StoredAuth> {
    const existing = readStoredAuth();
    if (existing?.token) return existing;
    if (this.authPromise) return this.authPromise;

    this.authPromise = (async () => {
      const credentials = {
        email: DEV_AUTH.email,
        password: DEV_AUTH.password,
      };

      let response: AuthResponse;
      try {
        response = await this.unauthenticatedReq<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
        });
      } catch {
        response = await this.unauthenticatedReq<AuthResponse>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username: DEV_AUTH.username,
            email: DEV_AUTH.email,
            password: DEV_AUTH.password,
          }),
        });
      }

      const auth: StoredAuth = {
        token: response.token,
        refreshToken: response.refresh_token,
        email: response.user.email,
      };
      writeStoredAuth(auth);
      return auth;
    })();

    try {
      return await this.authPromise;
    } finally {
      this.authPromise = null;
    }
  }

  private async req<T>(path: string, opts?: RequestInit, retryOnUnauthorized = true): Promise<T> {
    const auth = await this.authenticate();
    const res = await fetch(`${this.base}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
        ...opts?.headers,
      },
    });

    if (res.status === 401 && retryOnUnauthorized) {
      writeStoredAuth(null);
      return this.req<T>(path, opts, false);
    }

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
  playWithPet(variant?: 'classic' | 'active' | 'puzzle' | 'social') {
    return this.post<PlayResult>('/api/pet/play', variant ? { variant } : undefined);
  }
  sleepPet(variant?: 'night' | 'nap' | 'ritual') {
    return this.postPetAction('/api/pet/sleep', variant ? { variant } : undefined);
  }
  wakePet(variant?: 'normal' | 'gentle') {
    return this.postPetAction('/api/pet/wake', variant ? { variant } : undefined);
  }
  bathePet()                { return this.postPetAction('/api/pet/bathe'); }
  healPet()                 { return this.postPetAction('/api/pet/heal'); }
  bondWithPet(variant?: 'hug' | 'listen' | 'praise') {
    return this.postPetAction('/api/pet/bond', variant ? { variant } : undefined);
  }
  syncPet()                 { return this.post<Pet>('/api/pet/sync'); }
  acceptEvolution()         { return this.post<Pet>('/api/pet/evolution/accept'); }
  rejectEvolution()         { return this.post<Pet>('/api/pet/evolution/reject'); }
  beginNewLife()            { return this.post<NewLifeResult>('/api/pet/new-life'); }
  updatePetName(name: string) { return this.patch<Pet>('/api/pet/name', { name }); }
  getPetEvents()            { return this.req<PetEvent[]>('/api/pet/events'); }
  getPersonalityTelemetry() { return this.req<PersonalityTelemetrySample[]>('/api/pet/personality/telemetry'); }

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
