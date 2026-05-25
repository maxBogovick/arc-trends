import type { Account, Achievement, DailyQuest, Pet, PetEvent } from './types';
import type { InfluenceCooldownState } from '@zdesagochi/personality-core';
import { PERSONALITY_ENGINE_VERSION, STATIC_REGISTRY_VERSION } from '@zdesagochi/personality-core';
import type { OfflineKeyValueStorage } from './offlineStorage';

export const DEFAULT_LOCAL_SAVE_KEY = 'zdesagochi:local-save:v1';

export interface LocalInventoryEntry {
  itemId: string;
  quantity: number;
}

export interface MockProgressCounters {
  feedCount: number;
  playCount: number;
  bondCount: number;
  batheCount: number;
  healCount: number;
  sleepCount: number;
  maxStarScore: number;
  shopBuyCount: number;
  roomBuyCount: number;
  healthySyncs: number;
  memoryPerfect: number;
}

export interface MockProgressSaveState {
  achievements: Achievement[];
  quests: DailyQuest[];
  events: PetEvent[];
  purchasedRooms: string[];
  foodsTried: string[];
  counters: MockProgressCounters;
  traitSyncCounter: number;
  offlineCommandCounter: number;
  mockTimeScale: number;
  mockVirtualNowMs: number;
}

export interface LocalSaveSnapshot {
  pet: Pet;
  account: Account;
  coins: number;
  inventory: LocalInventoryEntry[];
  influenceCooldowns: InfluenceCooldownState;
  mockProgress?: MockProgressSaveState;
  savedAt: string;
  engineVersion: string;
  registryVersion: string;
}

export type LocalSaveLoadResult =
  | { ok: true; snapshot: LocalSaveSnapshot }
  | { ok: false; reason: 'missing' | 'invalid_json' | 'invalid_shape' };

export interface LocalSaveState {
  pet: Pet;
  account: Account;
  coins: number;
  inventory: Map<string, number>;
  influenceCooldowns: InfluenceCooldownState;
  mockProgress?: MockProgressSaveState;
}

export class LocalSave {
  constructor(
    private readonly storage: OfflineKeyValueStorage,
    private readonly key = DEFAULT_LOCAL_SAVE_KEY,
  ) {}

  load(): LocalSaveLoadResult {
    const raw = this.storage.getItem(this.key);
    if (raw === null) return { ok: false, reason: 'missing' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }

    if (!isLocalSaveSnapshot(parsed)) return { ok: false, reason: 'invalid_shape' };
    return { ok: true, snapshot: parsed };
  }

  save(state: LocalSaveState, savedAt: string): void {
    const snapshot: LocalSaveSnapshot = {
      pet: state.pet,
      account: state.account,
      coins: state.coins,
      inventory: Array.from(state.inventory.entries())
        .filter(([, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity })),
      influenceCooldowns: { ...state.influenceCooldowns },
      mockProgress: state.mockProgress,
      savedAt,
      engineVersion: PERSONALITY_ENGINE_VERSION,
      registryVersion: STATIC_REGISTRY_VERSION,
    };

    this.storage.setItem(this.key, JSON.stringify(snapshot));
  }

  delete(): void {
    this.storage.removeItem(this.key);
  }
}

export function inventoryEntriesToMap(entries: LocalInventoryEntry[]): Map<string, number> {
  return new Map(entries.filter(entry => entry.quantity > 0).map(entry => [entry.itemId, entry.quantity]));
}

function isLocalSaveSnapshot(value: unknown): value is LocalSaveSnapshot {
  if (!isObject(value)) return false;
  if (!isObject(value.pet)) return false;
  if (!isObject(value.account)) return false;
  if (typeof value.coins !== 'number') return false;
  if (!Array.isArray(value.inventory)) return false;
  if (!value.inventory.every(isLocalInventoryEntry)) return false;
  if (!isNumberRecord(value.influenceCooldowns)) return false;
  if (value.mockProgress !== undefined && !isMockProgressSaveState(value.mockProgress)) return false;
  if (typeof value.savedAt !== 'string') return false;
  if (typeof value.engineVersion !== 'string') return false;
  if (typeof value.registryVersion !== 'string') return false;
  return true;
}

function isLocalInventoryEntry(value: unknown): value is LocalInventoryEntry {
  if (!isObject(value)) return false;
  return typeof value.itemId === 'string' && typeof value.quantity === 'number';
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!isObject(value)) return false;
  return Object.values(value).every(entry => typeof entry === 'number');
}

function isMockProgressSaveState(value: unknown): value is MockProgressSaveState {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.achievements)) return false;
  if (!Array.isArray(value.quests)) return false;
  if (!Array.isArray(value.events)) return false;
  if (!Array.isArray(value.purchasedRooms)) return false;
  if (!Array.isArray(value.foodsTried)) return false;
  if (!value.purchasedRooms.every(entry => typeof entry === 'string')) return false;
  if (!value.foodsTried.every(entry => typeof entry === 'string')) return false;
  if (!isObject(value.counters)) return false;
  if (!Object.values(value.counters).every(entry => typeof entry === 'number')) return false;
  if (typeof value.traitSyncCounter !== 'number') return false;
  if (typeof value.offlineCommandCounter !== 'number') return false;
  if (typeof value.mockTimeScale !== 'number') return false;
  if (typeof value.mockVirtualNowMs !== 'number') return false;
  return true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
