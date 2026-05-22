/**
 * Mock API v2 — симулирует полноценный сервер для обучения.
 * Хранит всё состояние в памяти. Имитирует задержки (150-500ms).
 * Интегрирован PersonalityEngine v1.1.
 */

import type {
  Account, ApiService, Pet, FoodItem, PlayResult, ShopItem, InventoryItem, BuyResult,
  Achievement, ClaimResult, DailyQuest, QuestClaimResult, Room, LeaderboardEntry,
  PetEvent, PetMood, PetStage, NewLifeResult,
} from './types';
import type {
  BehavioralFlag, BehavioralCounters, MoodSnapshot,
  TraitVector,
} from '../personality/types';
import type { InfluenceCooldownState, PetCommand } from '@zdesagochi/personality-core';
import type { OfflineKeyValueStorage } from './offlineStorage';
import { PetService, type PetCommandDraft } from './petService';
import { calcMoodWithBias, createDefaultCounters } from '../personality/PersonalityEngine';
import {
  recordLegacy,
  createInitialBehaviorProfile,
  createInitialTraitVector,
} from '../personality/TraitEvolutionEngine';
import {
  createMemoryTextGenerator,
  getPersonality,
  getPersonalityBySkin,
  getIntensityMultiplier,
} from '@zdesagochi/personality-pet-preset';
import {
  syncLayeredStatesFromLegacy,
} from '../personality/stateLayers';
import { createBrowserOfflineStorage } from './offlineStorage';

// ─── Утилиты ─────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const mockRng = () => Math.random();
const rand = (min: number, max: number) => mockRng() * (max - min) + min;
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
let traitSyncCounter = 0;
const influenceCooldowns = new Map<string, number>();
let offlineCommandCounter = 0;
let offlineHydrated = false;
let offlineStorageOverride: OfflineKeyValueStorage | null | undefined;
const memoryTextGenerator = createMemoryTextGenerator();
let mockTimeScale = 1;
let mockVirtualNowMs = Date.now();
let mockRealAnchorMs = Date.now();

const NEUTRAL_TRAIT_VECTOR: TraitVector = {
  vitality: 50,
  sociality: 50,
  order: 50,
  appetite: 50,
  caution: 50,
  curiosity: 50,
};

function mockNow(): Date {
  const realNowMs = Date.now();
  const realElapsedMs = Math.max(0, realNowMs - mockRealAnchorMs);
  mockVirtualNowMs += realElapsedMs * mockTimeScale;
  mockRealAnchorMs = realNowMs;
  return new Date(mockVirtualNowMs);
}

export function setMockTimeScale(scale: number): number {
  mockNow();
  mockTimeScale = clamp(scale, 1, 240);
  return mockTimeScale;
}

export function getMockTimeScale(): number {
  return mockTimeScale;
}

export function advanceMockTime(hours: number): Date {
  mockNow();
  mockVirtualNowMs += Math.max(0, hours) * 3_600_000;
  return new Date(mockVirtualNowMs);
}

export function setMockOfflineStorage(storage: OfflineKeyValueStorage | null): void {
  offlineStorageOverride = storage;
  offlineHydrated = false;
}

export function clearMockOfflineRuntimeState(): void {
  offlineCommandCounter = 0;
  offlineHydrated = false;
  influenceCooldowns.clear();
}

// ─── Справочники ──────────────────────────────────────────────────────────────

export const FOODS: FoodItem[] = [
  { id: 'apple', name: 'Яблоко', emoji: '🍎', hungerRestore: 20, happinessBonus: 5, healthBonus: 10, description: 'Витаминное и полезное' },
  { id: 'pizza', name: 'Пицца', emoji: '🍕', hungerRestore: 40, happinessBonus: 20, healthBonus: -5, description: 'Вкусно, но немного вредно' },
  { id: 'sushi', name: 'Суши', emoji: '🍣', hungerRestore: 30, happinessBonus: 15, healthBonus: 5, description: 'Экзотика и польза' },
  { id: 'candy', name: 'Конфета', emoji: '🍬', hungerRestore: 10, happinessBonus: 30, healthBonus: -10, description: 'Сладко, но много нельзя!' },
  { id: 'salad', name: 'Салат', emoji: '🥗', hungerRestore: 25, happinessBonus: 5, healthBonus: 20, description: 'Очень полезно' },
  { id: 'ramen', name: 'Рамен', emoji: '🍜', hungerRestore: 45, happinessBonus: 25, healthBonus: 0, description: 'Сытно и вкусно' },
  { id: 'milk', name: 'Молоко', emoji: '🥛', hungerRestore: 15, happinessBonus: 8, healthBonus: 15, description: 'Кальций для роста' },
  { id: 'cake', name: 'Торт', emoji: '🎂', hungerRestore: 35, happinessBonus: 35, healthBonus: -8, description: 'Праздник для питомца!' },
];

const SHOP_ITEMS: ShopItem[] = [
  // Еда
  { id: 'premium_burger', name: 'Премиум-бургер', emoji: '🍔', description: 'Огромная и очень сытная', price: 25, type: 'food', rarity: 'rare', effect: { hunger: 55, happiness: 20 } },
  { id: 'dragon_fruit', name: 'Питайя', emoji: '🐉', description: 'Мистический фрукт силы', price: 35, type: 'food', rarity: 'epic', effect: { hunger: 30, health: 35, xp: 20 } },
  { id: 'magic_potion', name: 'Магическое зелье', emoji: '🧪', description: 'Восстанавливает всё!', price: 60, type: 'food', rarity: 'epic', effect: { hunger: 40, happiness: 40, health: 40 } },
  { id: 'galaxy_cake', name: 'Галактический торт', emoji: '🎂', description: 'Легендарная сладость', price: 80, type: 'food', rarity: 'legendary', effect: { hunger: 50, happiness: 60, xp: 50 } },
  { id: 'star_smoothie', name: 'Звёздный смузи', emoji: '🥤', description: 'Даёт энергию на весь день', price: 30, type: 'food', rarity: 'common', effect: { energy: 60, health: 10 } },
  // Игрушки
  { id: 'rubber_ball', name: 'Резиновый мяч', emoji: '🔴', description: '+15 радости и +5 XP', price: 20, type: 'toy', rarity: 'common', effect: { happiness: 15, xp: 5 } },
  { id: 'frisbee', name: 'Фрисби', emoji: '🥏', description: '+25 радости', price: 35, type: 'toy', rarity: 'rare', effect: { happiness: 25, bond: 10 } },
  { id: 'puzzle', name: 'Головоломка', emoji: '🧩', description: 'Умная игра за +30 XP', price: 50, type: 'toy', rarity: 'rare', effect: { happiness: 20, xp: 30 } },
  { id: 'music_box', name: 'Музыкальная шкатулка', emoji: '🎵', description: 'Расслабляет и радует', price: 70, type: 'toy', rarity: 'epic', effect: { happiness: 35, energy: 20, bond: 15 } },
  { id: 'magic_wand', name: 'Волшебная палочка', emoji: '🪄', description: 'Легендарная игрушка', price: 150, type: 'toy', rarity: 'legendary', effect: { happiness: 50, xp: 80, bond: 20 } },
  // Медицина
  { id: 'vitamin', name: 'Витамин C', emoji: '💊', description: '+20 здоровья', price: 15, type: 'medicine', rarity: 'common', effect: { health: 20 } },
  { id: 'energy_drink', name: 'Энергетик', emoji: '⚡', description: '+50 энергии моментально', price: 25, type: 'medicine', rarity: 'common', effect: { energy: 50 } },
  { id: 'super_heal', name: 'Супер-лечение', emoji: '💉', description: '+60 здоровья', price: 80, type: 'medicine', rarity: 'epic', effect: { health: 60, happiness: 10 } },
  { id: 'elixir', name: 'Элексир жизни', emoji: '✨', description: 'Восстанавливает всё здоровье', price: 120, type: 'medicine', rarity: 'legendary', effect: { health: 100, energy: 50 } },
  // Декорации (дают бонус к связи при использовании)
  { id: 'plant', name: 'Растение', emoji: '🌿', description: 'Украшает комнату +15 связи', price: 30, type: 'decoration', rarity: 'common', effect: { bond: 15 } },
  { id: 'fairy_lights', name: 'Гирлянда', emoji: '✨', description: 'Создаёт уют +20 связи', price: 45, type: 'decoration', rarity: 'rare', effect: { bond: 20, happiness: 10 } },
  { id: 'crystal_ball', name: 'Хрустальный шар', emoji: '🔮', description: 'Мистическое украшение', price: 100, type: 'decoration', rarity: 'epic', effect: { bond: 30, xp: 40 } },
];

const ROOMS: Room[] = [
  {
    id: 'default',
    name: 'Уютная комната',
    emoji: '🏠',
    description: 'Стандартная комната',
    price: 0,
    unlocked: true,
    gradient: 'linear-gradient(180deg, #E0E7FF 0%, #F0FDFB 60%, #D1FAE5 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(167,139,250,0.1))',
    decorations: [
      { emoji: '🪴', x: 8, y: 70, size: 28 },
      { emoji: '⭐', x: 85, y: 12, size: 18 },
    ],
  },
  {
    id: 'forest',
    name: 'Лесная поляна',
    emoji: '🌲',
    description: 'Живая природа вокруг',
    price: 150,
    unlocked: false,
    gradient: 'linear-gradient(180deg, #BBF7D0 0%, #D1FAE5 50%, #86EFAC 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(34,197,94,0.15))',
    decorations: [
      { emoji: '🌳', x: 5, y: 55, size: 40 },
      { emoji: '🌲', x: 78, y: 60, size: 35 },
      { emoji: '🦋', x: 72, y: 20, size: 22 },
      { emoji: '🌸', x: 50, y: 72, size: 20 },
    ],
  },
  {
    id: 'space',
    name: 'Открытый космос',
    emoji: '🚀',
    description: 'Среди звёзд и галактик',
    price: 200,
    unlocked: false,
    gradient: 'linear-gradient(180deg, #1E1B4B 0%, #312E81 50%, #2E1065 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(99,102,241,0.2))',
    decorations: [
      { emoji: '🌙', x: 15, y: 10, size: 28 },
      { emoji: '🪐', x: 75, y: 15, size: 30 },
      { emoji: '⭐', x: 40, y: 8, size: 16 },
      { emoji: '🛸', x: 60, y: 5, size: 24 },
    ],
  },
  {
    id: 'beach',
    name: 'Тропический пляж',
    emoji: '🏖',
    description: 'Солнце, море, волны',
    price: 175,
    unlocked: false,
    gradient: 'linear-gradient(180deg, #BAE6FD 0%, #FEF3C7 55%, #FDE68A 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(234,179,8,0.2))',
    decorations: [
      { emoji: '🌴', x: 5, y: 55, size: 38 },
      { emoji: '🌊', x: 78, y: 68, size: 28 },
      { emoji: '☀️', x: 80, y: 8, size: 30 },
      { emoji: '🐚', x: 50, y: 76, size: 18 },
    ],
  },
  {
    id: 'candy',
    name: 'Конфетная страна',
    emoji: '🍭',
    description: 'Сладкий сказочный мир',
    price: 250,
    unlocked: false,
    gradient: 'linear-gradient(180deg, #FCE7F3 0%, #FDF2F8 50%, #FECDD3 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(236,72,153,0.12))',
    decorations: [
      { emoji: '🍭', x: 5, y: 58, size: 32 },
      { emoji: '🍬', x: 80, y: 60, size: 26 },
      { emoji: '🎀', x: 75, y: 12, size: 24 },
      { emoji: '🍰', x: 48, y: 72, size: 22 },
    ],
  },
];

const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, ownerName: 'Алиса', petName: 'Звёздочка', petStage: 'elder', level: 42, score: 98500 },
  { rank: 2, ownerName: 'Максим', petName: 'Люмио', petStage: 'adult', level: 35, score: 87200 },
  { rank: 3, ownerName: 'Соня', petName: 'Пузырик', petStage: 'adult', level: 31, score: 74100 },
  { rank: 4, ownerName: 'Рустам', petName: 'Глоубик', petStage: 'teen', level: 24, score: 61800 },
  { rank: 5, ownerName: 'Лена', petName: 'Нуби', petStage: 'teen', level: 21, score: 53400 },
  { rank: 6, ownerName: 'Дима', petName: 'Блобик', petStage: 'child', level: 15, score: 38900 },
  { rank: 7, ownerName: 'Катя', petName: 'Флаффи', petStage: 'child', level: 12, score: 29300 },
  { rank: 8, ownerName: 'Ваня', petName: 'Глим', petStage: 'baby', level: 8, score: 18700 },
  { rank: 9, ownerName: 'Настя', petName: 'Бипик', petStage: 'baby', level: 5, score: 9800 },
  { rank: 10, ownerName: 'Тёма', petName: 'Эгги', petStage: 'egg', level: 2, score: 3200 },
];

// ─── Определение достижений ───────────────────────────────────────────────────

type AchievementDef = Omit<Achievement, 'progress' | 'unlocked' | 'unlockedAt' | 'claimed'>;

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first_meal', name: 'Первая трапеза', emoji: '🍽', category: 'care', description: 'Покорми питомца в первый раз', target: 1, reward: 15 },
  { id: 'food_lover', name: 'Любитель поесть', emoji: '🍴', category: 'care', description: 'Покорми питомца 25 раз', target: 25, reward: 40 },
  { id: 'full_menu', name: 'Полное меню', emoji: '📋', category: 'care', description: 'Попробуй все 8 видов еды', target: 8, reward: 55 },
  { id: 'clean_freak', name: 'Чистюля', emoji: '🛁', category: 'care', description: 'Помой питомца 5 раз', target: 5, reward: 25 },
  { id: 'good_doctor', name: 'Добрый доктор', emoji: '💊', category: 'care', description: 'Вылечи питомца 3 раза', target: 3, reward: 20 },
  { id: 'sweet_dreams', name: 'Сладких снов', emoji: '😴', category: 'care', description: 'Уложи питомца спать 5 раз', target: 5, reward: 20 },
  { id: 'best_friends', name: 'Лучшие друзья', emoji: '💜', category: 'social', description: 'Обними питомца 20 раз', target: 20, reward: 45 },
  { id: 'max_bond', name: 'Нераздельные', emoji: '💞', category: 'social', description: 'Доведи Связь до максимума (100)', target: 100, reward: 70 },
  { id: 'playful', name: 'Игривый', emoji: '🎮', category: 'play', description: 'Поиграй с питомцем 10 раз', target: 10, reward: 30 },
  { id: 'star_catcher', name: 'Ловец звёзд', emoji: '⭐', category: 'play', description: 'Набери 150 очков в игре со звёздами', target: 150, reward: 40 },
  { id: 'memory_master', name: 'Мастер памяти', emoji: '🧠', category: 'play', description: 'Пройди игру "Память" без ошибок', target: 1, reward: 50 },
  { id: 'level_5', name: 'Новичок', emoji: '⭐', category: 'progress', description: 'Достигни 5 уровня', target: 5, reward: 50 },
  { id: 'level_10', name: 'Опытный', emoji: '🌟', category: 'progress', description: 'Достигни 10 уровня', target: 10, reward: 100 },
  { id: 'growing_up', name: 'Взросление', emoji: '🌱', category: 'progress', description: 'Питомец стал Подростком', target: 1, reward: 75 },
  { id: 'healthy_streak', name: 'Здоровяк', emoji: '💪', category: 'progress', description: 'Держи Здоровье > 80 в 10 синхронизациях', target: 10, reward: 45 },
  { id: 'shopaholic', name: 'Шопоголик', emoji: '🛒', category: 'shop', description: 'Купи 5 предметов в магазине', target: 5, reward: 30 },
  { id: 'collector', name: 'Коллекционер', emoji: '🏅', category: 'shop', description: 'Купи 15 предметов в магазине', target: 15, reward: 75 },
  { id: 'room_owner', name: 'Домовладелец', emoji: '🏠', category: 'shop', description: 'Купи любую новую комнату', target: 1, reward: 40 },
];

// ─── Определение квестов ──────────────────────────────────────────────────────

type QuestDef = Omit<DailyQuest, 'progress' | 'completed' | 'claimed' | 'expiresAt'>;

const QUEST_DEFS: QuestDef[] = [
  { id: 'q_feed3', name: 'Утренний завтрак', emoji: '🍳', description: 'Покорми питомца 3 раза сегодня', target: 3, reward: { coins: 20, xp: 60 } },
  { id: 'q_play2', name: 'Время игр', emoji: '🎮', description: 'Поиграй 2 раза сегодня', target: 2, reward: { coins: 25, xp: 80 } },
  { id: 'q_bathe', name: 'Банный день', emoji: '🛁', description: 'Помой питомца сегодня', target: 1, reward: { coins: 15, xp: 40 } },
  { id: 'q_bond3', name: 'День объятий', emoji: '🤗', description: 'Обними питомца 3 раза', target: 3, reward: { coins: 20, xp: 55 } },
  { id: 'q_buy', name: 'Поход в магазин', emoji: '🛒', description: 'Купи любой предмет в магазине', target: 1, reward: { coins: 10, xp: 30 } },
  { id: 'q_heal', name: 'Забота о здоровье', emoji: '💊', description: 'Вылечи питомца или дай витамин', target: 1, reward: { coins: 15, xp: 35 } },
];

// ─── Состояние мока ───────────────────────────────────────────────────────────

function makeAchievements(): Achievement[] {
  return ACHIEVEMENT_DEFS.map(d => ({ ...d, progress: 0, unlocked: false, claimed: false }));
}

function makeQuests(): DailyQuest[] {
  const tomorrow = mockNow();
  tomorrow.setHours(23, 59, 59, 999);
  return QUEST_DEFS.map(d => ({ ...d, progress: 0, completed: false, claimed: false, expiresAt: tomorrow.toISOString() }));
}

function calcMood(pet: Pet): PetMood {
  const personality = getPersonality(pet.personality);
  return calcMoodWithBias(pet.stats as any, personality, pet.isAsleep) as PetMood;
}

function calcStage(ageHours: number): PetStage {
  if (ageHours < 2) return 'egg';
  if (ageHours < 12) return 'baby';
  if (ageHours < 48) return 'child';
  if (ageHours < 120) return 'teen';
  if (ageHours < 240) return 'adult';
  return 'elder';
}

function createInitialMockPet(account: Account = {}): Pet {
  const now = mockNow();
  const generation = account.legacyGeneration ?? 0;
  return {
    id: `lumio-${String(generation + 1).padStart(3, '0')}`,
    name: generation > 0 ? `Люмио ${generation + 1}` : 'Люмио',
    stage: 'baby' as PetStage,
    mood: 'happy' as PetMood,
    stats: { hunger: 75, happiness: 80, energy: 70, health: 90, cleanliness: 85, bond: 60 },
    ageHours: 3,
    level: 1,
    xp: 0,
    xpToNext: 150,
    isAsleep: false,
    color: '#818CF8',
    equippedRoomId: 'default',
    createdAt: new Date(now.getTime() - 3 * 3600_000).toISOString(),
    lastUpdated: now.toISOString(),
    personality: 'playful',
    behavioralFlags: [] as BehavioralFlag[],
    emergentState: null,
    emergentStateEnteredAt: undefined,
    stateLayers: {},
    behavioralCounters: createDefaultCounters({ now, rng: mockRng }) as BehavioralCounters,
    behaviorProfile: createInitialBehaviorProfile(),
    moodHistory: [] as MoodSnapshot[],
    traitVector: createInitialTraitVector(account.legacyVector, account.legacyCoefficient),
    dailyTraitBudget: {},
    currentTargetZone: null,
    ticksInTargetZone: 0,
    evolutionReadiness: 0,
    evolutionReadinessTarget: null,
    voidSyncs: 0,
    dailyTraitSnapshots: [],
    coreMemories: [],
    lastMemoryTimestamp: {},
    visitedZones: [],
    evolutionProposal: undefined,
    evolutionHistory: [],
    formationComplete: false,
    formationProgress: 0,
    traumaLevel: 0,
    catharsisProgress: 0,
    catharsisAchieved: false,
    traumaCooldownUntil: null,
    dailyVectorVariance: 0,
    confusedState: false,
    sleepStartedAt: null,
    lastSleepTimestamp: null,
    ticksInSingularity: 0,
    singularityZones: [],
  };
}

const S = {
  account: {} as Account,
  pet: createInitialMockPet(),
  coins: 200,
  inventory: new Map<string, number>(),
  achievements: makeAchievements(),
  quests: makeQuests(),
  events: [] as PetEvent[],
  purchasedRooms: new Set<string>(['default']),
  // Tracking counters for achievements
  feedCount: 0, playCount: 0, bondCount: 0, batheCount: 0, healCount: 0, sleepCount: 0,
  foodsTried: new Set<string>(),
  maxStarScore: 0,
  shopBuyCount: 0,
  roomBuyCount: 0,
  healthySyncs: 0,
  memoryPerfect: 0,
};

let eventCounter = 0;

function currentMockIso(): string {
  return new Date(mockVirtualNowMs).toISOString();
}

function getMockOfflineStorage(): OfflineKeyValueStorage | null {
  if (offlineStorageOverride !== undefined) return offlineStorageOverride;
  return createBrowserOfflineStorage();
}

function cooldownMapToRecord(): InfluenceCooldownState {
  return Object.fromEntries(influenceCooldowns.entries());
}

function restoreCooldowns(cooldowns: InfluenceCooldownState): void {
  influenceCooldowns.clear();
  for (const [influenceId, sync] of Object.entries(cooldowns)) {
    influenceCooldowns.set(influenceId, sync);
  }
}

function nextOfflineCommandId(type: PetCommand['type']): string {
  offlineCommandCounter++;
  return `mock-${offlineCommandCounter}-${type}-${currentMockIso()}`;
}

function createMockPetService(): PetService {
  return new PetService({
    storage: getMockOfflineStorage(),
    autoHydrate: false,
    getState: () => ({
      pet: S.pet,
      account: S.account,
      coins: S.coins,
      inventory: S.inventory,
      influenceCooldowns: cooldownMapToRecord(),
    }),
    setState: patch => {
      if (patch.pet) S.pet = normalizePetEvolutionFields(patch.pet);
      if (patch.account) S.account = { ...patch.account };
      if (typeof patch.coins === 'number') S.coins = patch.coins;
      if (patch.inventory) S.inventory = patch.inventory;
      if (patch.influenceCooldowns) restoreCooldowns(patch.influenceCooldowns);
    },
    nowIso: currentMockIso,
    nextCommandId: nextOfflineCommandId,
    normalizePet: normalizePetEvolutionFields,
    getRuntime: () => ({
      currentSync: traitSyncCounter,
      getIntensityMultiplier,
      memoryTextGenerator,
      rng: mockRng,
    }),
  });
}

function ensureOfflineHydrated(): void {
  if (offlineHydrated) return;
  offlineHydrated = true;
  createMockPetService().hydrate();
}

function persistOfflineState(): void {
  createMockPetService().persist();
}

async function applyMockPersonalityCommand(command: PetCommandDraft) {
  ensureOfflineHydrated();
  return createMockPetService().applyCommand(command);
}

async function applyMockCommandOrThrow(command: PetCommandDraft) {
  const result = await applyMockPersonalityCommand(command);
  if (result.blockedAction) {
    throw new Error(result.blockedAction.reason);
  }
  return result;
}

function addEvent(type: PetEvent['type'], description: string, emoji: string, extra?: Pick<PetEvent, 'xpGained' | 'coinsGained'>) {
  S.events.unshift({
    id: `evt-${++eventCounter}`,
    timestamp: mockNow().toISOString(),
    type, description, emoji,
    ...extra,
  });
  if (S.events.length > 50) S.events.pop();
}

function gainXp(amount: number) {
  let { xp, xpToNext, level } = S.pet;
  xp += amount;
  let leveledUp = false;
  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = level * 100 + 50;
    leveledUp = true;
  }
  S.pet.xp = xp;
  S.pet.xpToNext = xpToNext;
  S.pet.level = level;
  if (leveledUp) {
    addEvent('levelup', `Уровень ${level}! 🎉`, '⬆️', { coinsGained: level * 5 });
    S.coins += level * 5;
    checkAchievement('level_5', S.pet.level);
    checkAchievement('level_10', S.pet.level);
  }
}

function checkAchievement(id: string, newProgress: number) {
  const a = S.achievements.find(x => x.id === id);
  if (!a || a.unlocked) return;
  a.progress = Math.max(a.progress, Math.min(newProgress, a.target));
  if (a.progress >= a.target && !a.unlocked) {
    a.unlocked = true;
    a.unlockedAt = mockNow().toISOString();
    addEvent('achieve', `Достижение: «${a.name}»!`, a.emoji, { coinsGained: a.reward });
  }
}

function tickQuest(id: string, by = 1) {
  const q = S.quests.find(x => x.id === id);
  if (!q || q.completed) return;
  q.progress = Math.min(q.progress + by, q.target);
  if (q.progress >= q.target) q.completed = true;
}

function normalizePetEvolutionFields(pet: Pet): Pet {
  const p = pet as Pet & Partial<Pet>;
  p.traitVector ??= { ...NEUTRAL_TRAIT_VECTOR };
  p.dailyTraitBudget ??= {};
  p.behaviorProfile ??= createInitialBehaviorProfile();
  p.currentTargetZone ??= null;
  p.ticksInTargetZone ??= 0;
  p.evolutionReadiness ??= 0;
  p.evolutionReadinessTarget ??= null;
  p.voidSyncs ??= 0;
  p.dailyTraitSnapshots ??= [];
  p.coreMemories ??= [];
  p.lastMemoryTimestamp ??= {};
  p.visitedZones ??= [];
  p.evolutionHistory ??= [];
  p.formationComplete ??= false;
  p.formationProgress ??= 0;
  p.traumaLevel ??= 0;
  p.catharsisProgress ??= 0;
  p.catharsisAchieved ??= false;
  p.catharsisXpBurstExpiresAt ??= null;
  p.traumaCooldownUntil ??= null;
  p.dailyVectorVariance ??= 0;
  p.confusedState ??= false;
  p.sleepStartedAt ??= null;
  p.lastSleepTimestamp ??= null;
  p.ticksInSingularity ??= 0;
  p.singularityZones ??= [];
  p.stateLayers ??= {};
  syncLayeredStatesFromLegacy(p);

  if (p.evolutionProposal && !p.evolutionProposal.coreMemoryIds) {
    p.evolutionProposal.coreMemoryIds = [];
  }

  return p;
}

function finalizePet(): Pet {
  ensureOfflineHydrated();
  normalizePetEvolutionFields(S.pet);
  S.pet.mood = calcMood(S.pet);
  S.pet.stage = calcStage(S.pet.ageHours);
  syncLayeredStatesFromLegacy(S.pet);

  persistOfflineState();
  return { ...S.pet };
}

// Синхронизировать personality с надетым скином
export function syncPersonalityFromSkin(skinId: string) {
  const p = getPersonalityBySkin(skinId);
  S.pet.personality = p.id;
}

// Напрямую установить характер (для каталога / начального выбора)
export function setPersonalityDirectly(personalityId: string) {
  const p = getPersonality(personalityId as any);
  if (!p) return;
  S.pet.personality = p.id;
  // Сбросить счётчики и флаги — новый характер начинается чисто
  S.pet.behavioralFlags = [];
  S.pet.behavioralCounters = createDefaultCounters({ now: mockNow(), rng: mockRng });
  S.pet.behaviorProfile = createInitialBehaviorProfile();
  S.pet.emergentState = null;
  S.pet.emergentStateEnteredAt = undefined;
  S.pet.stateLayers = {};
}

export function getMockAccount(): Account {
  ensureOfflineHydrated();
  return { ...S.account };
}

export function completeMockPetLifecycle(): Account {
  ensureOfflineHydrated();
  recordLegacy(S.account, S.pet, { now: mockNow() });
  persistOfflineState();
  return { ...S.account };
}

// ─── Класс MockApiService ─────────────────────────────────────────────────────

export class MockApiService implements ApiService {

  async getPet() { await delay(rand(150, 280)); return finalizePet(); }

  async feedPet(foodId: string) {
    await delay(rand(280, 450));
    const food = FOODS.find(f => f.id === foodId);
    if (!food) throw new Error(`Еда "${foodId}" не найдена`);
    const now = mockNow();
    await applyMockCommandOrThrow({
      type: 'feed',
      foodId,
      foodEffect: {
        hungerRestore: food.hungerRestore,
        happinessBonus: food.happinessBonus,
        healthBonus: food.healthBonus,
      },
      at: now.toISOString(),
    });

    S.feedCount++;
    S.foodsTried.add(foodId);
    addEvent('feed', `Съел ${food.name}`, food.emoji);
    tickQuest('q_feed3');
    checkAchievement('first_meal', S.feedCount);
    checkAchievement('food_lover', S.feedCount);
    checkAchievement('full_menu', S.foodsTried.size);
    return finalizePet();
  }

  async playWithPet(): Promise<PlayResult> {
    await delay(rand(200, 380));
    const now = mockNow();
    const score = Math.floor(rand(40, 220));
    const result = await applyMockCommandOrThrow({ type: 'play', scoreSeed: String(score), at: now.toISOString() });
    const finalXp = result.xpDelta;
    const finalCoins = result.coinDelta;

    S.playCount++;
    if (score > S.maxStarScore) S.maxStarScore = score;
    addEvent('play', `Сыграл в игру (счёт: ${score})`, '🎮', { xpGained: finalXp, coinsGained: finalCoins });
    tickQuest('q_play2');
    checkAchievement('playful', S.playCount);
    checkAchievement('star_catcher', S.maxStarScore);

    const message = score >= 180 ? 'Феноменально! 🌟' : score >= 130 ? 'Невероятно! ✨' : score >= 80 ? 'Отлично! 🎉' : 'Хорошо! 👏';
    return { pet: finalizePet(), score, xpGained: finalXp, coinsGained: finalCoins, message };
  }

  async sleepPet() {
    await delay(rand(200, 350));
    const now = mockNow();
    await applyMockCommandOrThrow({ type: 'sleep', at: now.toISOString() });
    S.sleepCount++;
    addEvent('sleep', 'Пошёл спать', '😴');
    checkAchievement('sweet_dreams', S.sleepCount);
    return finalizePet();
  }

  async wakePet() {
    await delay(rand(200, 350));
    const now = mockNow();
    await applyMockCommandOrThrow({ type: 'wake', at: now.toISOString() });
    addEvent('wake', 'Проснулся', '☀️');
    return finalizePet();
  }

  async bathePet() {
    await delay(rand(350, 520));
    const now = mockNow();
    const resistsBathing = getPersonality(S.pet.personality as any)?.specialRules?.resistsBathing;
    await applyMockCommandOrThrow({ type: 'bathe', at: now.toISOString() });
    S.batheCount++;
    addEvent('bathe', resistsBathing ? 'Купался против воли 😤' : 'Принял ванну', '🛁');
    tickQuest('q_bathe');
    checkAchievement('clean_freak', S.batheCount);
    return finalizePet();
  }

  async healPet() {
    await delay(rand(300, 480));
    const now = mockNow();
    await applyMockCommandOrThrow({ type: 'heal', at: now.toISOString() });
    S.healCount++;
    addEvent('heal', 'Получил лечение', '💊');
    tickQuest('q_heal');
    checkAchievement('good_doctor', S.healCount);
    return finalizePet();
  }

  async bondWithPet() {
    await delay(rand(180, 320));
    const now = mockNow();
    await applyMockCommandOrThrow({ type: 'bond', at: now.toISOString() });
    S.bondCount++;
    addEvent('bond', 'Получил объятия', '🤗');
    tickQuest('q_bond3');
    checkAchievement('best_friends', S.bondCount);
    checkAchievement('max_bond', S.pet.stats.bond);
    return finalizePet();
  }

  async syncPet() {
    await delay(rand(80, 160));
    traitSyncCounter++;
    const now = mockNow();
    const lastUpdated = new Date(S.pet.lastUpdated);
    const elapsedMinutes = Math.max(0, (now.getTime() - lastUpdated.getTime()) / 60000);
    const prevStage = S.pet.stage;

    const result = await applyMockPersonalityCommand({ type: 'sync', at: now.toISOString() });
    if (result.meta?.autoSleepStarted) addEvent('sleep', 'Задремал сам', '😴');

    S.pet.ageHours += elapsedMinutes / 60;

    if (S.pet.stats.health > 80) {
      S.healthySyncs++;
      checkAchievement('healthy_streak', S.healthySyncs);
    }

    const newStage = calcStage(S.pet.ageHours);
    if (newStage !== prevStage) {
      addEvent('evolve', `Питомец вырос! ${newStage}`, '🌟', { coinsGained: 30 });
      S.coins += 30;
      if (newStage === 'teen') checkAchievement('growing_up', 1);
    }
    return finalizePet();
  }

  async acceptEvolution(): Promise<Pet> {
    await delay(rand(180, 300));
    const proposal = S.pet.evolutionProposal;
    if (!proposal) throw new Error('Нет активного предложения эволюции');
    const target = getPersonality(proposal.targetPersonalityId);
    await applyMockPersonalityCommand({ type: 'accept_evolution', proposalId: proposal.proposedAt, at: mockNow().toISOString() });
    addEvent('evolve', `Выбран путь: ${target.name}`, target.emoji);
    return finalizePet();
  }

  async rejectEvolution(): Promise<Pet> {
    await delay(rand(160, 260));
    const proposal = S.pet.evolutionProposal;
    if (!proposal) throw new Error('Нет активного предложения эволюции');
    const target = getPersonality(proposal.targetPersonalityId);
    await applyMockPersonalityCommand({ type: 'reject_evolution', proposalId: proposal.proposedAt, at: mockNow().toISOString() });
    addEvent('evolve', `Путь ${target.name} отложен`, '🌙');
    return finalizePet();
  }

  async beginNewLife(): Promise<NewLifeResult> {
    await delay(rand(250, 420));
    const previousName = S.pet.name;
    recordLegacy(S.account, S.pet, { now: mockNow() });
    S.pet = createInitialMockPet(S.account);
    traitSyncCounter = 0;
    influenceCooldowns.clear();
    addEvent('evolve', `${previousName} сохранил память пути и обрёл новое тело.`, '🌱');
    persistOfflineState();
    return { pet: finalizePet(), account: { ...S.account } };
  }

  async updatePetName(name: string) {
    await delay(rand(180, 280));
    ensureOfflineHydrated();
    if (!name.trim()) throw new Error('Имя не может быть пустым');
    S.pet.name = name.trim();
    persistOfflineState();
    return finalizePet();
  }

  async getPetEvents() {
    await delay(rand(100, 200));
    return [...S.events];
  }

  async getPersonalityTelemetry() {
    await delay(rand(80, 150));
    return createMockPetService().listPersonalityTelemetry();
  }

  // ─── Экономика ─────────────────────────────────────────────────────────────

  async getCoins() { await delay(rand(80, 150)); return { coins: S.coins }; }

  async getShop() { await delay(rand(150, 280)); return [...SHOP_ITEMS]; }

  async buyItem(itemId: string): Promise<BuyResult> {
    await delay(rand(300, 500));
    ensureOfflineHydrated();
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) throw new Error(`Предмет "${itemId}" не найден`);
    if (S.coins < item.price) throw new Error(`Недостаточно монет! Нужно ${item.price}, есть ${S.coins}`);

    S.coins -= item.price;
    const qty = (S.inventory.get(itemId) ?? 0) + 1;
    S.inventory.set(itemId, qty);
    await applyMockCommandOrThrow({
      type: 'add_item',
      itemId,
      itemKind: item.type,
      quantity: 1,
      at: mockNow().toISOString(),
    });
    S.shopBuyCount++;
    addEvent('buy', `Купил «${item.name}»`, item.emoji, { coinsGained: -item.price });
    tickQuest('q_buy');
    checkAchievement('shopaholic', S.shopBuyCount);
    checkAchievement('collector', S.shopBuyCount);
    persistOfflineState();

    return { coins: S.coins, item, inventory: this._buildInventory() };
  }

  async getInventory() {
    await delay(rand(120, 220));
    return this._buildInventory();
  }

  async useInventoryItem(itemId: string): Promise<Pet> {
    await delay(rand(250, 420));
    ensureOfflineHydrated();
    const qty = S.inventory.get(itemId) ?? 0;
    if (qty <= 0) throw new Error('Этого предмета нет в инвентаре');
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) throw new Error('Неизвестный предмет');

    S.inventory.set(itemId, qty - 1);
    if (qty - 1 === 0) S.inventory.delete(itemId);

    await applyMockCommandOrThrow({
      type: 'use_item',
      itemId,
      itemKind: item.type,
      itemEffect: item.effect,
      at: mockNow().toISOString(),
    });

    addEvent('feed', `Использовал «${item.name}»`, item.emoji);
    if (item.type === 'medicine') { tickQuest('q_heal'); S.healCount++; }
    return finalizePet();
  }

  // ─── Достижения ────────────────────────────────────────────────────────────

  async getAchievements() { await delay(rand(120, 220)); return S.achievements.map(a => ({ ...a })); }

  async claimAchievement(achievementId: string): Promise<ClaimResult> {
    await delay(rand(200, 350));
    ensureOfflineHydrated();
    const a = S.achievements.find(x => x.id === achievementId);
    if (!a) throw new Error('Достижение не найдено');
    if (!a.unlocked) throw new Error('Достижение ещё не разблокировано');
    if (a.claimed) throw new Error('Награда уже получена');
    a.claimed = true;
    S.coins += a.reward;
    persistOfflineState();
    return { achievement: { ...a }, coins: a.reward, newBalance: S.coins };
  }

  // ─── Квесты ────────────────────────────────────────────────────────────────

  async getQuests() { await delay(rand(120, 220)); return S.quests.map(q => ({ ...q })); }

  async claimQuestReward(questId: string): Promise<QuestClaimResult> {
    await delay(rand(200, 350));
    ensureOfflineHydrated();
    const q = S.quests.find(x => x.id === questId);
    if (!q) throw new Error('Задание не найдено');
    if (!q.completed) throw new Error('Задание ещё не выполнено');
    if (q.claimed) throw new Error('Награда уже получена');
    q.claimed = true;
    S.coins += q.reward.coins;
    gainXp(q.reward.xp);
    addEvent('quest', `Выполнено: «${q.name}»`, q.emoji, { coinsGained: q.reward.coins, xpGained: q.reward.xp });
    persistOfflineState();
    return { quest: { ...q }, coins: q.reward.coins, xp: q.reward.xp, newBalance: S.coins };
  }

  // ─── Комнаты ───────────────────────────────────────────────────────────────

  async getRooms() {
    await delay(rand(120, 220));
    return ROOMS.map(r => ({ ...r, unlocked: S.purchasedRooms.has(r.id) }));
  }

  async buyRoom(roomId: string): Promise<Room[]> {
    await delay(rand(300, 500));
    ensureOfflineHydrated();
    const room = ROOMS.find(r => r.id === roomId);
    if (!room) throw new Error('Комната не найдена');
    if (S.purchasedRooms.has(roomId)) throw new Error('Комната уже куплена');
    if (S.coins < room.price) throw new Error(`Недостаточно монет! Нужно ${room.price}`);
    S.coins -= room.price;
    S.purchasedRooms.add(roomId);
    S.roomBuyCount++;
    addEvent('buy', `Куплена комната «${room.name}»`, room.emoji, { coinsGained: -room.price });
    checkAchievement('room_owner', S.roomBuyCount);
    persistOfflineState();
    return ROOMS.map(r => ({ ...r, unlocked: S.purchasedRooms.has(r.id) }));
  }

  async equipRoom(roomId: string): Promise<{ roomId: string }> {
    await delay(rand(150, 280));
    if (!S.purchasedRooms.has(roomId)) throw new Error('Комната не куплена');
    S.pet.equippedRoomId = roomId;
    await applyMockPersonalityCommand({ type: 'equip_room', roomId, at: mockNow().toISOString() });
    persistOfflineState();
    return { roomId };
  }

  // ─── Рейтинг / Еда ─────────────────────────────────────────────────────────

  async getLeaderboard() { await delay(rand(200, 380)); return [...LEADERBOARD]; }
  async getFoods() { await delay(rand(100, 200)); return [...FOODS]; }

  // ─── Внутренние утилиты ────────────────────────────────────────────────────

  _buildInventory(): InventoryItem[] {
    return Array.from(S.inventory.entries())
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({
        itemId,
        quantity,
        item: SHOP_ITEMS.find(i => i.id === itemId)!,
      }));
  }

  /** Публичный метод для регистрации идеального прохождения Memory */
  registerMemoryPerfect() {
    S.memoryPerfect++;
    checkAchievement('memory_master', S.memoryPerfect);
  }
}
