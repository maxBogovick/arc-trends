import type { Account, Pet } from './types';
import type { InfluenceCooldownState } from '../../packages/personality-core/src';
import { PERSONALITY_ENGINE_VERSION, STATIC_REGISTRY_VERSION } from '../../packages/personality-core/src';
import type { OfflineKeyValueStorage } from './offlineStorage';

export const DEFAULT_LOCAL_SAVE_KEY = 'zdesagochi:local-save:v1';

export interface LocalInventoryEntry {
  itemId: string;
  quantity: number;
}

export interface LocalSaveSnapshot {
  pet: Pet;
  account: Account;
  coins: number;
  inventory: LocalInventoryEntry[];
  influenceCooldowns: InfluenceCooldownState;
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
