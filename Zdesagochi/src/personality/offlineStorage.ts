import type { OfflinePetSave } from './commands';

export const DEFAULT_OFFLINE_PET_SAVE_KEY = 'zdesagochi:offline-pet-save:v1';

export interface OfflineKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type OfflinePetSaveLoadResult =
  | { ok: true; save: OfflinePetSave }
  | { ok: false; reason: 'missing' | 'invalid_json' | 'invalid_shape' };

export type OfflinePetSaveResult =
  | { ok: true }
  | { ok: false; reason: 'quota_exceeded' | 'write_failed'; error: unknown };

export function saveOfflinePetSave(
  storage: OfflineKeyValueStorage,
  save: OfflinePetSave,
  key = DEFAULT_OFFLINE_PET_SAVE_KEY,
): void {
  storage.setItem(key, JSON.stringify(save));
}

export function trySaveOfflinePetSave(
  storage: OfflineKeyValueStorage,
  save: OfflinePetSave,
  key = DEFAULT_OFFLINE_PET_SAVE_KEY,
): OfflinePetSaveResult {
  try {
    saveOfflinePetSave(storage, save, key);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: isQuotaExceededError(error) ? 'quota_exceeded' : 'write_failed',
      error,
    };
  }
}

export function loadOfflinePetSave(
  storage: OfflineKeyValueStorage,
  key = DEFAULT_OFFLINE_PET_SAVE_KEY,
): OfflinePetSaveLoadResult {
  const raw = storage.getItem(key);
  if (raw === null) return { ok: false, reason: 'missing' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  if (!isOfflinePetSave(parsed)) return { ok: false, reason: 'invalid_shape' };
  return { ok: true, save: parsed };
}

export function deleteOfflinePetSave(
  storage: OfflineKeyValueStorage,
  key = DEFAULT_OFFLINE_PET_SAVE_KEY,
): void {
  storage.removeItem(key);
}

export function createBrowserOfflineStorage(): OfflineKeyValueStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isOfflinePetSave(value: unknown): value is OfflinePetSave {
  if (!isObject(value)) return false;
  if (!isObject(value.petSnapshot)) return false;
  if (!Array.isArray(value.commandLog)) return false;
  if (value.lastSyncedCommandId !== null && typeof value.lastSyncedCommandId !== 'string') return false;
  if (!isNumberRecord(value.influenceCooldowns)) return false;
  if (typeof value.engineVersion !== 'string') return false;
  if (typeof value.registryVersion !== 'string') return false;
  if (typeof value.savedAt !== 'string') return false;
  return true;
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!isObject(value)) return false;
  return Object.values(value).every(entry => typeof entry === 'number');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}
