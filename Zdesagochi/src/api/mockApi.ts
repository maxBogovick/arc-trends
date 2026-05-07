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
  StatKey, BehavioralFlag, BehavioralCounters, MoodSnapshot,
  TraitVector,
} from '../personality/types';
import type { InfluenceCooldownState, OfflineKeyValueStorage, PetCommand } from '../personality';
import {
  applyDecay, applyActionModifiers, isActionBlocked,
  computeEmergentState, runPatternEngine, updateCounters,
  computeNaturalPassives, calcMoodWithBias, getPeakPerformanceMult,
  getParanoidRestoreMult, createDefaultCounters,
} from '../personality/PersonalityEngine';
import {
  applyRegression,
  acceptEvolution,
  canApplyInfluenceAtSync,
  applyInfluence,
  addCatharsisProgress,
  checkEvolution,
  checkVarianceHardReset,
  checkThresholdCrossings,
  checkWeeklyDrift,
  recordLegacy,
  rejectEvolution,
  onStartSleep,
  onWakeFromSleep,
  recordDailyTraitSnapshot,
  createInitialTraitVector,
} from '../personality/TraitEvolutionEngine';
import {
  getInfluenceRegistry,
  getIntensityMultiplier,
} from '../personality/influenceRegistry';
import { createMemoryTextGenerator } from '../personality/memoryTextGenerator';
import { getPersonality, getPersonalityBySkin } from '../personality/personalities';
import {
  createBrowserOfflineStorage,
  createOfflinePetSave,
  loadOfflinePetSave,
  saveOfflinePetSave,
} from '../personality';

// ─── Утилиты ─────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
// Счётчик действий Меланхолика (чётные/нечётные)
let melancholicActionCount = 0;
let traitSyncCounter = 0;
const influenceCooldowns = new Map<string, number>();
let offlineCommandCounter = 0;
let offlineCommandLog: PetCommand[] = [];
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

type OfflineCommandDraft = PetCommand extends infer Command
  ? Command extends PetCommand
    ? Omit<Command, 'commandId'> & { commandId?: string }
    : never
  : never;

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
  offlineCommandLog = [];
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
    behavioralCounters: createDefaultCounters() as BehavioralCounters,
    moodHistory: [] as MoodSnapshot[],
    traitVector: createInitialTraitVector(account.legacyVector, account.legacyCoefficient),
    dailyTraitBudget: {},
    currentTargetZone: null,
    ticksInTargetZone: 0,
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

function ensureOfflineHydrated(): void {
  if (offlineHydrated) return;
  offlineHydrated = true;

  const storage = getMockOfflineStorage();
  if (!storage) return;

  const loaded = loadOfflinePetSave(storage);
  if (!loaded.ok) return;

  S.pet = normalizePetEvolutionFields(loaded.save.petSnapshot);
  offlineCommandLog = [...loaded.save.commandLog];
  restoreCooldowns(loaded.save.influenceCooldowns);
}

function persistOfflineState(): void {
  const storage = getMockOfflineStorage();
  if (!storage) return;

  saveOfflinePetSave(
    storage,
    createOfflinePetSave(S.pet, currentMockIso(), {
      commandLog: offlineCommandLog,
      influenceCooldowns: cooldownMapToRecord(),
    }),
  );
}

function nextOfflineCommandId(type: PetCommand['type']): string {
  offlineCommandCounter++;
  return `mock-${offlineCommandCounter}-${type}-${currentMockIso()}`;
}

function recordOfflineCommand(command: OfflineCommandDraft): void {
  offlineCommandLog.push({
    ...command,
    commandId: command.commandId ?? nextOfflineCommandId(command.type),
  } as PetCommand);
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
  p.currentTargetZone ??= null;
  p.ticksInTargetZone ??= 0;
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
  p.traumaCooldownUntil ??= null;
  p.dailyVectorVariance ??= 0;
  p.confusedState ??= false;
  p.sleepStartedAt ??= null;
  p.lastSleepTimestamp ??= null;
  p.ticksInSingularity ??= 0;
  p.singularityZones ??= [];

  if (p.evolutionProposal && !p.evolutionProposal.coreMemoryIds) {
    p.evolutionProposal.coreMemoryIds = [];
  }

  return p;
}

async function applyPetInfluence(influenceId: string): Promise<void> {
  normalizePetEvolutionFields(S.pet);
  const influence = getInfluenceRegistry().find(inf => inf.id === influenceId);
  if (!influence) return;

  const lastAppliedAt = influenceCooldowns.get(influence.id);
  if (!canApplyInfluenceAtSync(lastAppliedAt, traitSyncCounter, influence.cooldownSyncs ?? 0)) return;

  const { prevVector } = applyInfluence(S.pet, influence, {
    clientLocalHour: mockNow().getHours(),
    getIntensityMultiplier,
    memoryTextGenerator,
    dominantInfluences: [influence.label],
  });
  influenceCooldowns.set(influence.id, traitSyncCounter);

  await checkThresholdCrossings(S.pet, prevVector, {
    memoryTextGenerator,
    dominantInfluences: [influence.label],
  });
}

function updateDailyTraitSnapshot(now: Date): void {
  normalizePetEvolutionFields(S.pet);
  recordDailyTraitSnapshot(S.pet, now);
}

function isTraitEvolutionManagedState(state: string | null): boolean {
  return state === 'identity_crisis' || state === 'singularity' || state === 'shadow_form';
}

function finalizePet(): Pet {
  ensureOfflineHydrated();
  normalizePetEvolutionFields(S.pet);
  const personality = getPersonality(S.pet.personality);
  const now = mockNow();
  // Обновить mood с учётом moodBias характера
  S.pet.mood = calcMood(S.pet);
  S.pet.stage = calcStage(S.pet.ageHours);
  S.pet.lastUpdated = now.toISOString();

  // Обновить emergentState
  if (!isTraitEvolutionManagedState(S.pet.emergentState)) {
    const computedState = computeEmergentState(
      S.pet.stats as any,
      personality,
      S.pet.behavioralFlags,
      S.pet.behavioralCounters,
      { clientLocalHour: now.getHours(), sessionGapHours: S.pet.behavioralCounters.sessionGapHours, coinBalance: S.coins },
      S.pet.emergentState === 'confused' && !S.pet.confusedState ? null : S.pet.emergentState as any,
      S.pet.emergentStateEnteredAt,
    );
    const newState = computedState ?? (S.pet.confusedState ? 'confused' : null);
    if (newState !== S.pet.emergentState) {
      S.pet.emergentState = newState;
      S.pet.emergentStateEnteredAt = newState ? now.toISOString() : undefined;
    }
  }

  // Обновить флаги (lazy Pattern Engine)
  S.pet.behavioralFlags = runPatternEngine(S.pet.behavioralCounters, S.pet.behavioralFlags, personality);

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
  S.pet.behavioralCounters = createDefaultCounters();
  S.pet.emergentState = null;
  S.pet.emergentStateEnteredAt = undefined;
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
    if (S.pet.isAsleep) throw new Error('Питомец спит!');
    if (S.pet.stats.hunger > 90) throw new Error('Питомец и так сыт!');

    const personality = getPersonality(S.pet.personality);
    const ctx = { foodId, clientLocalHour: mockNow().getHours(), coinBalance: S.coins };

    // Проверить блокировку эмерджентного состояния
    const blocked = isActionBlocked('feed', S.pet.emergentState as any);
    if (blocked) throw new Error(blocked.reason);

    // Базовый результат
    const baseResult = { statDeltas: { hunger: food.hungerRestore, happiness: food.happinessBonus, health: food.healthBonus }, xp: 8, coins: 0 };

    // Применить модификаторы характера
    const modified = applyActionModifiers(baseResult, 'feed', personality, S.pet.behavioralFlags, S.pet.emergentState as any, S.pet.behavioralCounters, ctx);

    // Параноик: множитель restore
    const paranoidMult = personality.id === 'paranoid' ? getParanoidRestoreMult(S.pet.behavioralCounters) : 1.0;

    for (const [s, v] of Object.entries(modified.statDeltas)) {
      const stat = s as StatKey;
      (S.pet.stats as any)[stat] = clamp((S.pet.stats as any)[stat] + (v ?? 0) * (stat !== 'health' ? paranoidMult : 1.0));
    }
    gainXp(modified.xp);

    // Обновить счётчики
    S.pet.behavioralCounters = updateCounters(S.pet.behavioralCounters, 'feed', S.pet.stats as any, ctx);
    await applyPetInfluence('action:feed');

    S.feedCount++;
    S.foodsTried.add(foodId);
    addEvent('feed', `Съел ${food.name}`, food.emoji);
    tickQuest('q_feed3');
    checkAchievement('first_meal', S.feedCount);
    checkAchievement('food_lover', S.feedCount);
    checkAchievement('full_menu', S.foodsTried.size);
    recordOfflineCommand({ type: 'feed', foodId, at: currentMockIso() });
    return finalizePet();
  }

  async playWithPet(): Promise<PlayResult> {
    await delay(rand(200, 380));
    if (S.pet.isAsleep) throw new Error('Питомец спит!');
    if (S.pet.stats.energy < 10) throw new Error('Питомец слишком устал для игр');

    const personality = getPersonality(S.pet.personality);
    const ctx = { clientLocalHour: mockNow().getHours(), coinBalance: S.coins };

    const blocked = isActionBlocked('play', S.pet.emergentState as any);
    if (blocked) throw new Error(blocked.reason);

    const score = Math.floor(rand(40, 220));
    const baseXp = Math.floor(score * 0.5);
    const baseCoins = Math.floor(score * 0.1) + 2;

    const baseResult = { statDeltas: { happiness: 20, energy: -15, bond: 8 }, xp: baseXp, coins: baseCoins };
    const modified = applyActionModifiers(baseResult, 'play', personality, S.pet.behavioralFlags, S.pet.emergentState as any, S.pet.behavioralCounters, ctx);

    // Нервный пик-перфоманс
    const peak = getPeakPerformanceMult(S.pet.stats as any, personality);

    // Меланхолик: XP только на чётных действиях
    let finalXp = modified.xp;
    if (personality.specialRules?.xpEveryOtherAction) {
      melancholicActionCount++;
      if (melancholicActionCount % 2 !== 0) finalXp = 0;
    }
    finalXp = Math.round(finalXp * peak.xpMult);
    const finalCoins = Math.round(modified.coins * peak.coinMult);

    for (const [s, v] of Object.entries(modified.statDeltas)) {
      if (s !== 'energy') (S.pet.stats as any)[s] = clamp((S.pet.stats as any)[s] + (v ?? 0));
    }
    // energy отдельно — может быть отрицательным
    S.pet.stats.energy = clamp(S.pet.stats.energy + (modified.statDeltas.energy ?? -15));

    gainXp(finalXp);
    S.coins += finalCoins;

    S.pet.behavioralCounters = updateCounters(S.pet.behavioralCounters, 'play', S.pet.stats as any, ctx);
    await applyPetInfluence('action:play');

    S.playCount++;
    if (score > S.maxStarScore) S.maxStarScore = score;
    addEvent('play', `Сыграл в игру (счёт: ${score})`, '🎮', { xpGained: finalXp, coinsGained: finalCoins });
    tickQuest('q_play2');
    checkAchievement('playful', S.playCount);
    checkAchievement('star_catcher', S.maxStarScore);

    const message = score >= 180 ? 'Феноменально! 🌟' : score >= 130 ? 'Невероятно! ✨' : score >= 80 ? 'Отлично! 🎉' : 'Хорошо! 👏';
    recordOfflineCommand({ type: 'play', scoreSeed: String(score), at: currentMockIso() });
    return { pet: finalizePet(), score, xpGained: finalXp, coinsGained: finalCoins, message };
  }

  async sleepPet() {
    await delay(rand(200, 350));
    if (S.pet.isAsleep) throw new Error('Уже спит!');
    const blocked = isActionBlocked('sleep', S.pet.emergentState as any);
    if (blocked) throw new Error(blocked.reason);
    // Дерзкий: не ляжет при energy > 30
    const personality = getPersonality(S.pet.personality);
    if (personality.specialRules?.rejectSleepWhenEnergized && S.pet.stats.energy > 30) {
      throw new Error('Слишком бодрый чтобы спать!');
    }
    const sleepInfluenceId = S.pet.stats.energy > 70 ? 'action:sleep_forced' : 'action:sleep_natural';
    S.pet.stats.energy = clamp(S.pet.stats.energy > 70 ? S.pet.stats.energy : S.pet.stats.energy);
    S.pet.behavioralCounters = updateCounters(S.pet.behavioralCounters, 'sleep', S.pet.stats as any, { clientLocalHour: mockNow().getHours(), coinBalance: S.coins });
    onStartSleep(S.pet);
    await applyPetInfluence(sleepInfluenceId);
    S.pet.isAsleep = true;
    S.sleepCount++;
    addEvent('sleep', 'Пошёл спать', '😴');
    checkAchievement('sweet_dreams', S.sleepCount);
    recordOfflineCommand({ type: 'sleep', at: currentMockIso() });
    return finalizePet();
  }

  async wakePet() {
    await delay(rand(200, 350));
    if (!S.pet.isAsleep) throw new Error('Питомец и так не спит!');
    const now = mockNow();
    const sleptHours = S.pet.sleepStartedAt
      ? (now.getTime() - new Date(S.pet.sleepStartedAt).getTime()) / 3_600_000
      : 0;
    const naturalWake = sleptHours >= 4;
    onWakeFromSleep(S.pet, naturalWake, { now });
    if (sleptHours < 1) {
      await applyPetInfluence('action:wake_early');
    }
    S.pet.isAsleep = false;
    S.pet.behavioralCounters = updateCounters(S.pet.behavioralCounters, 'wake', S.pet.stats as any, { clientLocalHour: now.getHours(), coinBalance: S.coins });
    addEvent('wake', 'Проснулся', '☀️');
    recordOfflineCommand({ type: 'wake', at: now.toISOString() });
    return finalizePet();
  }

  async bathePet() {
    await delay(rand(350, 520));
    if (S.pet.isAsleep) throw new Error('Питомец спит!');
    if (S.pet.stats.cleanliness > 90) throw new Error('Питомец уже чистый!');

    const personality = getPersonality(S.pet.personality);
    const ctx = { clientLocalHour: mockNow().getHours(), coinBalance: S.coins };
    const blocked = isActionBlocked('bathe', S.pet.emergentState as any);
    if (blocked) throw new Error(blocked.reason);

    // Дикий: ненавидит купание
    const isFeral = personality.id === 'feral';
    const baseResult = { statDeltas: { cleanliness: 40, happiness: isFeral ? -20 : 5, health: 5 }, xp: 12, coins: 0 };
    const modified = applyActionModifiers(baseResult, 'bathe', personality, S.pet.behavioralFlags, S.pet.emergentState as any, S.pet.behavioralCounters, ctx);

    for (const [s, v] of Object.entries(modified.statDeltas)) {
      (S.pet.stats as any)[s] = clamp((S.pet.stats as any)[s] + (v ?? 0));
    }
    gainXp(modified.xp);
    S.pet.behavioralCounters = updateCounters(S.pet.behavioralCounters, 'bathe', S.pet.stats as any, ctx);
    await applyPetInfluence('action:bathe');
    S.batheCount++;
    addEvent('bathe', isFeral ? 'Купался против воли 😤' : 'Принял ванну', '🛁');
    tickQuest('q_bathe');
    checkAchievement('clean_freak', S.batheCount);
    recordOfflineCommand({ type: 'bathe', at: currentMockIso() });
    return finalizePet();
  }

  async healPet() {
    await delay(rand(300, 480));
    const personality = getPersonality(S.pet.personality);
    // Параноик: отказывается лечиться при health > 50
    if (personality.id === 'paranoid' && S.pet.stats.health > 50) {
      throw new Error('Не верит что болен!');
    }
    if (S.pet.stats.health >= 90) throw new Error('Питомец уже здоров!');

    const ctx = { clientLocalHour: mockNow().getHours(), coinBalance: S.coins };
    const blocked = isActionBlocked('heal', S.pet.emergentState as any);
    if (blocked) throw new Error(blocked.reason);

    const baseResult = { statDeltas: { health: 35, happiness: -5 }, xp: 18, coins: 0 };
    const modified = applyActionModifiers(baseResult, 'heal', personality, S.pet.behavioralFlags, S.pet.emergentState as any, S.pet.behavioralCounters, ctx);

    for (const [s, v] of Object.entries(modified.statDeltas)) {
      (S.pet.stats as any)[s] = clamp((S.pet.stats as any)[s] + (v ?? 0));
    }
    gainXp(modified.xp);
    S.pet.behavioralCounters = updateCounters(S.pet.behavioralCounters, 'heal', S.pet.stats as any, ctx);
    await applyPetInfluence('action:heal');
    addCatharsisProgress(S.pet, 20, { now: mockNow(), memoryTextGenerator });
    S.healCount++;
    addEvent('heal', 'Получил лечение', '💊');
    tickQuest('q_heal');
    checkAchievement('good_doctor', S.healCount);
    recordOfflineCommand({ type: 'heal', at: currentMockIso() });
    return finalizePet();
  }

  async bondWithPet() {
    await delay(rand(180, 320));
    if (S.pet.isAsleep) throw new Error('Питомец спит!');

    const personality = getPersonality(S.pet.personality);
    const ctx = { clientLocalHour: mockNow().getHours(), coinBalance: S.coins };
    const blocked = isActionBlocked('bond', S.pet.emergentState as any);
    if (blocked) throw new Error(blocked.reason);

    // Для Эмпата bond восстанавливает все статы (+5 каждый)
    const baseResult = { statDeltas: { happiness: 15, bond: 20 }, xp: 6, coins: 0 };
    const modified = applyActionModifiers(baseResult, 'bond', personality, S.pet.behavioralFlags, S.pet.emergentState as any, S.pet.behavioralCounters, ctx);

    for (const [s, v] of Object.entries(modified.statDeltas)) {
      (S.pet.stats as any)[s] = clamp((S.pet.stats as any)[s] + (v ?? 0));
    }
    gainXp(modified.xp);
    S.pet.behavioralCounters = updateCounters(S.pet.behavioralCounters, 'bond', S.pet.stats as any, ctx);
    await applyPetInfluence('action:bond');
    addCatharsisProgress(S.pet, 25, { now: mockNow(), memoryTextGenerator });
    S.bondCount++;
    addEvent('bond', 'Получил объятия', '🤗');
    tickQuest('q_bond3');
    checkAchievement('best_friends', S.bondCount);
    checkAchievement('max_bond', S.pet.stats.bond);
    recordOfflineCommand({ type: 'bond', at: currentMockIso() });
    return finalizePet();
  }

  async syncPet() {
    await delay(rand(80, 160));
    traitSyncCounter++;
    const personality = getPersonality(S.pet.personality);
    const now = mockNow();
    const lastUpdated = new Date(S.pet.lastUpdated);
    const elapsedMinutes = Math.max(0, (now.getTime() - lastUpdated.getTime()) / 60000);
    const ctx = { clientLocalHour: now.getHours(), sessionGapHours: S.pet.behavioralCounters.sessionGapHours, coinBalance: S.coins };

    if (!S.pet.isAsleep) {
      // Decay с модификаторами характера
      const decayed = applyDecay(S.pet.stats as any, personality, elapsedMinutes, S.pet.behavioralCounters, ctx);
      // Дополнительный урон здоровью при грязи
      if (S.pet.stats.cleanliness < 30) {
        (decayed as any).health = clamp((decayed as any).health - 0.5 * elapsedMinutes);
      }
      S.pet.stats = decayed as any;

      // Авто-сон
      if (personality.autoSleep.enabled && S.pet.stats.energy <= personality.autoSleep.energyThreshold) {
        if (Math.random() < personality.autoSleep.probability) {
          S.pet.isAsleep = true;
          onStartSleep(S.pet, { now });
          addEvent('sleep', 'Задремал сам', '😴');
        }
      }
    } else {
      // Пока спит: energy восстанавливается (с бонусом Сонливого)
      const restoreBonus = personality.restoreBonus['sleep']?.energy ?? 0;
      const energyGain = (5 + restoreBonus) * (elapsedMinutes / 15);
      S.pet.stats.energy = clamp(S.pet.stats.energy + energyGain);
      S.pet.stats.hunger = clamp(S.pet.stats.hunger - 0.8 * (elapsedMinutes / 15));
      S.pet.stats.health = clamp(S.pet.stats.health + 0.5 * (elapsedMinutes / 15));
    }

    // Пассивные эффекты характера (Гурман, Чистюля, Эмпат, натуральная регенерация)
    const passives = computeNaturalPassives(S.pet.stats as any, personality, S.pet.behavioralCounters);
    for (const [s, v] of Object.entries(passives)) {
      (S.pet.stats as any)[s] = clamp((S.pet.stats as any)[s] + (v ?? 0));
    }

    // Обновить счётчики и снапшот настроения
    S.pet.behavioralCounters = updateCounters(S.pet.behavioralCounters, 'sync', S.pet.stats as any, { clientLocalHour: now.getHours(), coinBalance: S.coins });

    // Bad mood streak
    const currentMood = calcMoodWithBias(S.pet.stats as any, personality, S.pet.isAsleep);
    if (currentMood === 'sad') {
      S.pet.behavioralCounters.consecutiveBadMoodSyncs++;
    } else {
      S.pet.behavioralCounters.consecutiveBadMoodSyncs = 0;
    }
    // Good sync streak
    const statsArr = Object.values(S.pet.stats) as number[];
    const avg = statsArr.reduce((a, b) => a + b, 0) / statsArr.length;
    if (avg > 70) {
      S.pet.behavioralCounters.consecutiveGoodSyncs++;
    } else {
      S.pet.behavioralCounters.consecutiveGoodSyncs = 0;
    }

    // Снапшот настроения
    const snapshot: MoodSnapshot = {
      timestamp: now.toISOString(),
      mood: currentMood,
      avgStats: avg,
    };
    S.pet.moodHistory.unshift(snapshot);
    if (S.pet.moodHistory.length > 168) S.pet.moodHistory.pop();

    S.pet.ageHours += elapsedMinutes / 60;

    const prevTraitVector = { ...S.pet.traitVector };
    applyRegression(S.pet);
    updateDailyTraitSnapshot(now);
    checkVarianceHardReset(S.pet, { now });
    checkEvolution(S.pet, { now });
    await checkThresholdCrossings(S.pet, prevTraitVector, {
      now,
      memoryTextGenerator,
      dominantInfluences: ['Синхронизация'],
    });
    await checkWeeklyDrift(S.pet, {
      now,
      memoryTextGenerator,
      dominantInfluences: ['Синхронизация'],
    });

    if (S.pet.stats.health > 80) {
      S.healthySyncs++;
      checkAchievement('healthy_streak', S.healthySyncs);
    }

    const prevStage = S.pet.stage;
    const newStage = calcStage(S.pet.ageHours);
    if (newStage !== prevStage) {
      addEvent('evolve', `Питомец вырос! ${newStage}`, '🌟', { coinsGained: 30 });
      S.coins += 30;
      if (newStage === 'teen') checkAchievement('growing_up', 1);
    }
    recordOfflineCommand({ type: 'sync', at: now.toISOString() });
    return finalizePet();
  }

  async acceptEvolution(): Promise<Pet> {
    await delay(rand(180, 300));
    const proposal = S.pet.evolutionProposal;
    if (!proposal) throw new Error('Нет активного предложения эволюции');
    const accepted = acceptEvolution(S.pet, { now: mockNow(), memoryTextGenerator });
    if (!accepted) throw new Error('Нет активного предложения эволюции');
    const target = getPersonality(proposal.targetPersonalityId);
    addEvent('evolve', `Выбран путь: ${target.name}`, target.emoji);
    recordOfflineCommand({ type: 'accept_evolution', proposalId: proposal.proposedAt, at: currentMockIso() });
    return finalizePet();
  }

  async rejectEvolution(): Promise<Pet> {
    await delay(rand(160, 260));
    const proposal = S.pet.evolutionProposal;
    if (!proposal) throw new Error('Нет активного предложения эволюции');
    rejectEvolution(S.pet);
    const target = getPersonality(proposal.targetPersonalityId);
    addEvent('evolve', `Путь ${target.name} отложен`, '🌙');
    recordOfflineCommand({ type: 'reject_evolution', proposalId: proposal.proposedAt, at: currentMockIso() });
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
    recordOfflineCommand({ type: 'sync', at: currentMockIso() });
    persistOfflineState();
    return { pet: finalizePet(), account: { ...S.account } };
  }

  async updatePetName(name: string) {
    await delay(rand(180, 280));
    if (!name.trim()) throw new Error('Имя не может быть пустым');
    S.pet.name = name.trim();
    return finalizePet();
  }

  async getPetEvents() {
    await delay(rand(100, 200));
    return [...S.events];
  }

  // ─── Экономика ─────────────────────────────────────────────────────────────

  async getCoins() { await delay(rand(80, 150)); return { coins: S.coins }; }

  async getShop() { await delay(rand(150, 280)); return [...SHOP_ITEMS]; }

  async buyItem(itemId: string): Promise<BuyResult> {
    await delay(rand(300, 500));
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) throw new Error(`Предмет "${itemId}" не найден`);
    if (S.coins < item.price) throw new Error(`Недостаточно монет! Нужно ${item.price}, есть ${S.coins}`);

    S.coins -= item.price;
    const qty = (S.inventory.get(itemId) ?? 0) + 1;
    S.inventory.set(itemId, qty);
    S.shopBuyCount++;
    addEvent('buy', `Купил «${item.name}»`, item.emoji, { coinsGained: -item.price });
    tickQuest('q_buy');
    checkAchievement('shopaholic', S.shopBuyCount);
    checkAchievement('collector', S.shopBuyCount);

    return { coins: S.coins, item, inventory: this._buildInventory() };
  }

  async getInventory() {
    await delay(rand(120, 220));
    return this._buildInventory();
  }

  async useInventoryItem(itemId: string): Promise<Pet> {
    await delay(rand(250, 420));
    const qty = S.inventory.get(itemId) ?? 0;
    if (qty <= 0) throw new Error('Этого предмета нет в инвентаре');
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) throw new Error('Неизвестный предмет');

    S.inventory.set(itemId, qty - 1);
    if (qty - 1 === 0) S.inventory.delete(itemId);

    const { effect } = item;
    if (effect.hunger) S.pet.stats.hunger = clamp(S.pet.stats.hunger + effect.hunger);
    if (effect.happiness) S.pet.stats.happiness = clamp(S.pet.stats.happiness + effect.happiness);
    if (effect.energy) S.pet.stats.energy = clamp(S.pet.stats.energy + effect.energy);
    if (effect.health) S.pet.stats.health = clamp(S.pet.stats.health + effect.health);
    if (effect.cleanliness) S.pet.stats.cleanliness = clamp(S.pet.stats.cleanliness + effect.cleanliness);
    if (effect.bond) S.pet.stats.bond = clamp(S.pet.stats.bond + effect.bond);
    if (effect.xp) gainXp(effect.xp);

    const itemInfluenceId = `item:${itemId}`;
    const hasItemInfluence = getInfluenceRegistry().some(inf => inf.id === itemInfluenceId);
    if (hasItemInfluence) {
      await applyPetInfluence(itemInfluenceId);
    } else if (item.type === 'food') {
      await applyPetInfluence('action:feed');
    }

    addEvent('feed', `Использовал «${item.name}»`, item.emoji);
    if (item.type === 'medicine') { tickQuest('q_heal'); S.healCount++; }
    recordOfflineCommand({ type: 'use_item', itemId, at: currentMockIso() });
    return finalizePet();
  }

  // ─── Достижения ────────────────────────────────────────────────────────────

  async getAchievements() { await delay(rand(120, 220)); return S.achievements.map(a => ({ ...a })); }

  async claimAchievement(achievementId: string): Promise<ClaimResult> {
    await delay(rand(200, 350));
    const a = S.achievements.find(x => x.id === achievementId);
    if (!a) throw new Error('Достижение не найдено');
    if (!a.unlocked) throw new Error('Достижение ещё не разблокировано');
    if (a.claimed) throw new Error('Награда уже получена');
    a.claimed = true;
    S.coins += a.reward;
    return { achievement: { ...a }, coins: a.reward, newBalance: S.coins };
  }

  // ─── Квесты ────────────────────────────────────────────────────────────────

  async getQuests() { await delay(rand(120, 220)); return S.quests.map(q => ({ ...q })); }

  async claimQuestReward(questId: string): Promise<QuestClaimResult> {
    await delay(rand(200, 350));
    const q = S.quests.find(x => x.id === questId);
    if (!q) throw new Error('Задание не найдено');
    if (!q.completed) throw new Error('Задание ещё не выполнено');
    if (q.claimed) throw new Error('Награда уже получена');
    q.claimed = true;
    S.coins += q.reward.coins;
    gainXp(q.reward.xp);
    addEvent('quest', `Выполнено: «${q.name}»`, q.emoji, { coinsGained: q.reward.coins, xpGained: q.reward.xp });
    return { quest: { ...q }, coins: q.reward.coins, xp: q.reward.xp, newBalance: S.coins };
  }

  // ─── Комнаты ───────────────────────────────────────────────────────────────

  async getRooms() {
    await delay(rand(120, 220));
    return ROOMS.map(r => ({ ...r, unlocked: S.purchasedRooms.has(r.id) }));
  }

  async buyRoom(roomId: string): Promise<Room[]> {
    await delay(rand(300, 500));
    const room = ROOMS.find(r => r.id === roomId);
    if (!room) throw new Error('Комната не найдена');
    if (S.purchasedRooms.has(roomId)) throw new Error('Комната уже куплена');
    if (S.coins < room.price) throw new Error(`Недостаточно монет! Нужно ${room.price}`);
    S.coins -= room.price;
    S.purchasedRooms.add(roomId);
    S.roomBuyCount++;
    addEvent('buy', `Куплена комната «${room.name}»`, room.emoji, { coinsGained: -room.price });
    checkAchievement('room_owner', S.roomBuyCount);
    return ROOMS.map(r => ({ ...r, unlocked: S.purchasedRooms.has(r.id) }));
  }

  async equipRoom(roomId: string): Promise<{ roomId: string }> {
    await delay(rand(150, 280));
    if (!S.purchasedRooms.has(roomId)) throw new Error('Комната не куплена');
    S.pet.equippedRoomId = roomId;
    await applyPetInfluence('env:new_room');
    recordOfflineCommand({ type: 'equip_room', roomId, at: currentMockIso() });
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
