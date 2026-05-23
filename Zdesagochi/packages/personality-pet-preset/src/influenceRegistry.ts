import type {
  GlobalBalancePatch,
  InfluenceCategory,
  RegisteredInfluence,
  TraitKey,
} from '../../personality-core/src/types';
import { TRAIT_KEYS } from '../../personality-core/src/types';

const ALLOWED_REMOTE_CATEGORIES = new Set<InfluenceCategory>(['system', 'environment', 'item']);
const REMOTE_TTL_MS = 60 * 60 * 1000;

let remoteRegistry: RegisteredInfluence[] = [];
let globalBalancePatches: GlobalBalancePatch[] = [];
let remoteRegistryFetchedAt: number | null = null;

export const STATIC_INFLUENCE_REGISTRY: RegisteredInfluence[] = [
  {
    id: 'action:play',
    category: 'action',
    label: 'Игра',
    traitDeltas: { vitality: 2, curiosity: 1, order: -1 },
    behaviorDeltas: { play: 2, exploration: 1 },
    cooldownSyncs: 0,
    intensityRules: [
      { condition: { type: 'time_of_day', params: { from: 22, to: 6 } }, multiplier: 1.5 },
      { condition: { type: 'flag_active', params: { flag: 'play_burnout' } }, multiplier: 0.3 },
    ],
  },
  {
    id: 'action:play:active',
    category: 'action',
    label: 'Активная игра',
    traitDeltas: { vitality: 2.4, curiosity: 0.8, order: -1.1 },
    behaviorDeltas: { play: 2.2, disruption: 0.45 },
    cooldownSyncs: 0,
  },
  {
    id: 'action:play:puzzle',
    category: 'action',
    label: 'Головоломка',
    traitDeltas: { curiosity: 2.2, order: 1.3, vitality: -0.4 },
    behaviorDeltas: { play: 1.1, exploration: 1.8, order: 1.2 },
    cooldownSyncs: 0,
  },
  {
    id: 'action:play:social',
    category: 'action',
    label: 'Совместная игра',
    traitDeltas: { sociality: 1.8, vitality: 1.2, curiosity: 0.5 },
    behaviorDeltas: { play: 1.5, social: 1.6, care: 0.3 },
    cooldownSyncs: 0,
  },
  {
    id: 'action:feed',
    category: 'action',
    label: 'Кормление',
    traitDeltas: { appetite: 2, sociality: 0.5 },
    behaviorDeltas: { care: 2, social: 0.5 },
    cooldownSyncs: 0,
  },
  {
    id: 'action:bond',
    category: 'action',
    label: 'Bond',
    traitDeltas: { sociality: 2, caution: -1 },
    behaviorDeltas: { social: 2, care: 0.5 },
    traumaDelta: -3,
    cooldownSyncs: 1,
    intensityRules: [
      { condition: { type: 'personality_is', params: { id: 'empath' } }, multiplier: 1.5 },
      { condition: { type: 'trait_above', params: { key: 'caution', value: 80 } }, multiplier: 0.5 },
    ],
  },
  {
    id: 'action:bond:listen',
    category: 'action',
    label: 'Выслушать',
    traitDeltas: { sociality: 1.4, caution: -1.6 },
    behaviorDeltas: { recovery: 2.2, social: 1.2 },
    traumaDelta: -4,
    cooldownSyncs: 1,
  },
  {
    id: 'action:bond:praise',
    category: 'action',
    label: 'Похвалить',
    traitDeltas: { sociality: 1.6, vitality: 0.7, caution: -0.8 },
    behaviorDeltas: { social: 1.7, care: 0.7 },
    traumaDelta: -2,
    cooldownSyncs: 1,
  },
  {
    id: 'action:sleep_natural',
    category: 'action',
    label: 'Естественный сон',
    traitDeltas: { vitality: -1, order: 1.5 },
    behaviorDeltas: { order: 1.2, care: 0.6 },
    cooldownSyncs: 12,
    onApply: 'sleep_start',
  },
  {
    id: 'action:sleep:ritual',
    category: 'action',
    label: 'Ритуал перед сном',
    traitDeltas: { order: 1.8, caution: -0.9, sociality: 0.4 },
    behaviorDeltas: { order: 1.8, recovery: 1.4, care: 0.8 },
    traumaDelta: -1,
    cooldownSyncs: 4,
    onApply: 'sleep_start',
  },
  {
    id: 'action:sleep:nap',
    category: 'action',
    label: 'Короткий отдых',
    traitDeltas: { vitality: 0.6, caution: -0.4, order: 0.5 },
    behaviorDeltas: { recovery: 1.4, care: 0.5 },
    traumaDelta: -0.5,
    cooldownSyncs: 3,
    onApply: 'sleep_start',
  },
  {
    id: 'action:wake_early',
    category: 'action',
    label: 'Разбудили в первый час сна',
    traitDeltas: { order: -2, caution: 2, vitality: 1 },
    behaviorDeltas: { disruption: 2, order: -1 },
    traumaDelta: 2,
    cooldownSyncs: 2,
    onApply: 'sleep_wake_early',
  },
  {
    id: 'action:wake_natural',
    category: 'action',
    label: 'Естественное пробуждение',
    traitDeltas: {},
    behaviorDeltas: { recovery: 1, order: 0.4 },
    traumaDelta: -1,
    cooldownSyncs: 6,
    onApply: 'sleep_wake_natural',
  },
  {
    id: 'action:wake:gentle',
    category: 'action',
    label: 'Мягко разбудить',
    traitDeltas: { sociality: 0.7, caution: -0.8, order: 0.4 },
    behaviorDeltas: { recovery: 0.8, social: 0.5, care: 0.4 },
    traumaDelta: -1,
    cooldownSyncs: 2,
  },
  {
    id: 'action:sleep_forced',
    category: 'action',
    label: 'Принудительный сон',
    traitDeltas: { vitality: -2, order: -1, caution: 1 },
    behaviorDeltas: { disruption: 2, order: -0.5 },
    traumaDelta: 1,
    cooldownSyncs: 6,
    onApply: 'sleep_start',
  },
  {
    id: 'action:bathe',
    category: 'action',
    label: 'Купание',
    traitDeltas: { order: 2, caution: -0.5 },
    behaviorDeltas: { order: 2, care: 0.5 },
    intensityRules: [
      { condition: { type: 'personality_is', params: { id: 'feral' } }, multiplier: -2 },
    ],
  },
  {
    id: 'action:heal',
    category: 'action',
    label: 'Лечение',
    traitDeltas: { caution: 1, sociality: 0.5 },
    behaviorDeltas: { recovery: 2, care: 1 },
    traumaDelta: -2,
    cooldownSyncs: 3,
  },
  {
    id: 'system:inactivity_long',
    category: 'system',
    label: 'Перерыв > 48ч',
    traitDeltas: { sociality: -3, caution: 3, order: -1 },
    traumaDelta: 3,
    cooldownSyncs: 48,
    conditions: [{ type: 'session_gap_hours', params: { min: 48 } }],
  },
  {
    id: 'system:consistent_week',
    category: 'system',
    label: '7 дней подряд',
    traitDeltas: { order: 3, sociality: 2, caution: -2 },
    traumaDelta: -5,
    cooldownSyncs: 168,
    conditions: [{ type: 'streak_days', params: { action: 'any', days: 7 } }],
  },
  {
    id: 'system:starvation',
    category: 'system',
    label: 'Голод < 5',
    traitDeltas: { caution: 3, sociality: -2 },
    traumaDelta: 5,
    cooldownSyncs: 6,
    conditions: [{ type: 'stat_below', params: { stat: 'hunger', value: 5 } }],
  },
  { id: 'item:puzzle', category: 'item', label: 'Головоломка', traitDeltas: { curiosity: 4, order: 2, vitality: -1 }, cooldownSyncs: 6 },
  { id: 'item:music_box', category: 'item', label: 'Музыкальная шкатулка', traitDeltas: { sociality: 3, caution: -2, order: 1 }, traumaDelta: -4, cooldownSyncs: 8 },
  { id: 'item:magic_potion', category: 'item', label: 'Магическое зелье', traitDeltas: { curiosity: 3, appetite: 2 }, traumaDelta: -8, cooldownSyncs: 24 },
  { id: 'item:magic_wand', category: 'item', label: 'Волшебная палочка', traitDeltas: { curiosity: 5, vitality: 3, caution: -2 }, cooldownSyncs: 12 },
  { id: 'item:crystal_ball', category: 'item', label: 'Хрустальный шар', traitDeltas: { curiosity: 4, caution: -1, sociality: 2 }, traumaDelta: -3, cooldownSyncs: 24 },
  { id: 'env:new_room', category: 'environment', label: 'Новая комната', traitDeltas: { curiosity: 4, vitality: 2, caution: -1 }, cooldownSyncs: 0 },
  {
    id: 'env:same_room_48h',
    category: 'environment',
    label: '48ч в одной комнате',
    traitDeltas: { curiosity: -2, order: 1 },
    cooldownSyncs: 48,
    conditions: [{ type: 'same_room_hours', params: { min: 48 } }],
  },
  {
    id: 'social:visit_feral',
    category: 'social',
    label: 'С Диким',
    traitDeltas: { vitality: 1, order: -1, caution: -0.5 },
    cooldownSyncs: 12,
    conditions: [{ type: 'formation_period', params: { active: false } }],
  },
  {
    id: 'social:visit_sage',
    category: 'social',
    label: 'С Мудрым',
    traitDeltas: { curiosity: 2, order: 1 },
    cooldownSyncs: 8,
    conditions: [{ type: 'formation_period', params: { active: false } }],
  },
  {
    id: 'social:visit_paranoid',
    category: 'social',
    label: 'С Параноиком',
    traitDeltas: { caution: 2, sociality: -1 },
    cooldownSyncs: 12,
    conditions: [{ type: 'formation_period', params: { active: false } }],
  },
  {
    id: 'social:visit_empath',
    category: 'social',
    label: 'С Эмпатом',
    traitDeltas: { sociality: 2, caution: -1 },
    cooldownSyncs: 8,
    conditions: [{ type: 'formation_period', params: { active: false } }],
  },
  {
    id: 'social:visit_chaotic',
    category: 'social',
    label: 'С Хаотиком',
    traitDeltas: { curiosity: 2, order: -1.5, vitality: 1 },
    cooldownSyncs: 12,
    conditions: [{ type: 'formation_period', params: { active: false } }],
  },
  {
    id: 'social:visit_playful',
    category: 'social',
    label: 'С Игривым',
    traitDeltas: { vitality: 1, curiosity: 1, order: -0.5 },
    cooldownSyncs: 12,
    conditions: [{ type: 'formation_period', params: { active: false } }],
  },
];

export async function fetchRemoteData(now = Date.now()): Promise<void> {
  if (remoteRegistryFetchedAt && now - remoteRegistryFetchedAt < REMOTE_TTL_MS) return;

  try {
    const resp = await fetch('/api/influence-registry');
    const data = await resp.json();
    remoteRegistry = Array.isArray(data?.seasonal)
      ? (data.seasonal as unknown[]).map(validateRemoteInfluence).filter((x): x is RegisteredInfluence => x !== null)
      : [];
    globalBalancePatches = Array.isArray(data?.balance)
      ? (data.balance as unknown[]).map(validateBalancePatch).filter((x): x is GlobalBalancePatch => x !== null)
      : [];
    remoteRegistryFetchedAt = now;
  } catch {
    // Keep the last valid cache. Static registry remains available.
  }
}

export function getInfluenceRegistry(): RegisteredInfluence[] {
  return [...STATIC_INFLUENCE_REGISTRY, ...remoteRegistry];
}

export function getIntensityMultiplier(influenceId: string): number {
  const patch = globalBalancePatches.find(p => p.influenceId === influenceId);
  return patch?.intensityMultiplier ?? 1.0;
}

export function validateInfluenceRegistry(registry: RegisteredInfluence[]): void {
  for (const inf of registry) {
    if (inf.category === 'social' && inf.traumaDelta !== undefined) {
      throw new Error(`${inf.id}: social нельзя с traumaDelta`);
    }

    if (inf.id.startsWith('remote:')) {
      const validRemote = validateRemoteInfluence(inf);
      if (!validRemote) throw new Error(`${inf.id}: invalid remote influence`);
    }
  }
}

export function validateBalancePatch(raw: unknown): GlobalBalancePatch | null {
  if (!isObject(raw)) return null;
  if (typeof raw.influenceId !== 'string') return null;
  if (typeof raw.intensityMultiplier !== 'number') return null;
  if (raw.intensityMultiplier < 0.80 || raw.intensityMultiplier > 1.20) return null;
  if (raw.reason !== 'meta_balance') return null;
  if (typeof raw.appliedAt !== 'string') return null;
  return {
    influenceId: raw.influenceId,
    intensityMultiplier: raw.intensityMultiplier,
    reason: 'meta_balance',
    appliedAt: raw.appliedAt,
  };
}

export function validateRemoteInfluence(raw: unknown): RegisteredInfluence | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id.startsWith('remote:')) return null;
  if (!isInfluenceCategory(raw.category)) return null;
  if (!ALLOWED_REMOTE_CATEGORIES.has(raw.category)) return null;
  if (typeof raw.label !== 'string') return null;
  if (!isObject(raw.traitDeltas)) return null;
  if (raw.traumaDelta !== undefined) return null;

  const traitDeltas: Partial<Record<TraitKey, number>> = {};
  for (const key of TRAIT_KEYS) {
    const value = raw.traitDeltas[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || Math.abs(value) > 2) return null;
    traitDeltas[key] = value;
  }

  return {
    id: raw.id,
    category: raw.category,
    label: raw.label,
    traitDeltas,
    cooldownSyncs: typeof raw.cooldownSyncs === 'number' ? raw.cooldownSyncs : undefined,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInfluenceCategory(value: unknown): value is InfluenceCategory {
  return (
    value === 'action' ||
    value === 'item' ||
    value === 'training' ||
    value === 'discipline' ||
    value === 'cosmetic' ||
    value === 'environment' ||
    value === 'social' ||
    value === 'system'
  );
}

validateInfluenceRegistry(STATIC_INFLUENCE_REGISTRY);
