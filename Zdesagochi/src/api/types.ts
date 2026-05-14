/**
 * ================================================================
 *  API CONTRACT v2 — ЧИТАЙ ВНИМАТЕЛЬНО!
 * ================================================================
 *
 *  Этот файл — единственный источник истины для контракта между
 *  фронтендом и сервером. Твоя задача — реализовать все эти эндпоинты.
 *
 *  🟡 Mock Mode   → MockApiService (данные в памяти браузера)
 *  🟢 Live Mode   → RealApiService (HTTP к твоему серверу)
 *
 *  ЭНДПОИНТЫ СЕРВЕРА:
 *  ─── Питомец ────────────────────────────────────────────────
 *  GET    /api/pet                  → Pet
 *  POST   /api/pet/feed             → Pet         body: { foodId }
 *  POST   /api/pet/play             → PlayResult
 *  POST   /api/pet/sleep            → Pet
 *  POST   /api/pet/wake             → Pet
 *  POST   /api/pet/bathe            → Pet
 *  POST   /api/pet/heal             → Pet
 *  POST   /api/pet/bond             → Pet
 *  POST   /api/pet/sync             → Pet
 *  POST   /api/pet/evolution/accept → Pet
 *  POST   /api/pet/evolution/reject → Pet
 *  POST   /api/pet/new-life        → NewLifeResult
 *  PATCH  /api/pet/name             → Pet         body: { name }
 *  GET    /api/pet/events           → PetEvent[]
 *  ─── Экономика ──────────────────────────────────────────────
 *  GET    /api/coins                → { coins: number }
 *  GET    /api/shop                 → ShopItem[]
 *  POST   /api/shop/buy             → BuyResult   body: { itemId }
 *  GET    /api/inventory            → InventoryItem[]
 *  POST   /api/inventory/use        → Pet         body: { itemId }
 *  ─── Прогресс ───────────────────────────────────────────────
 *  GET    /api/achievements         → Achievement[]
 *  POST   /api/achievements/claim   → ClaimResult body: { achievementId }
 *  GET    /api/quests               → DailyQuest[]
 *  POST   /api/quests/claim         → QuestClaimResult body: { questId }
 *  ─── Комнаты ────────────────────────────────────────────────
 *  GET    /api/rooms                → Room[]
 *  POST   /api/rooms/buy            → Room[]      body: { roomId }
 *  POST   /api/rooms/equip          → { roomId }  body: { roomId }
 *  ─── Рейтинг ────────────────────────────────────────────────
 *  GET    /api/leaderboard          → LeaderboardEntry[]
 * ================================================================
 */

// ─── Питомец ─────────────────────────────────────────────────────────────────

export type PetMood =
  | 'ecstatic' | 'happy' | 'content' | 'sad' | 'tired' | 'sick' | 'sleeping';

export type PetStage =
  | 'egg' | 'baby' | 'child' | 'teen' | 'adult' | 'elder';

export interface PetStats {
  hunger: number;      // 0-100 (100 = сыт)
  happiness: number;
  energy: number;
  health: number;
  cleanliness: number;
  bond: number;
}

export interface Pet {
  id: string;
  name: string;
  stage: PetStage;
  mood: PetMood;
  stats: PetStats;
  ageHours: number;
  level: number;
  xp: number;
  xpToNext: number;
  isAsleep: boolean;
  color: string;
  equippedRoomId: string;
  createdAt: string;
  lastUpdated: string;

  // ── Система характеров ──────────────────────────────────────────
  personality: string;                          // PersonalityId
  behavioralFlags: import('../personality/types').BehavioralFlag[];
  /** @deprecated Use stateLayers or activeEmergentStates from PetCommandResult for full multi-layer state. */
  emergentState: import('../personality/types').EmergentStateType | null;
  emergentStateEnteredAt?: string;
  stateLayers?: import('../personality/types').PetStateLayers;
  behavioralCounters: import('../personality/types').BehavioralCounters;
  moodHistory: import('../personality/types').MoodSnapshot[];

  // ── Trait Evolution System v5.0 (§13 field checklist) ───────────
  // Trait space: traitVector, dailyTraitBudget
  traitVector: import('../personality/types').TraitVector;
  dailyTraitBudget: Partial<Record<import('../personality/types').TraitKey, number>>;
  // O(1) evolution counters: currentTargetZone, ticksInTargetZone, voidSyncs
  currentTargetZone: import('../personality/types').PersonalityId | null;
  ticksInTargetZone: number;
  voidSyncs: number;
  // UI snapshots: dailyTraitSnapshots
  dailyTraitSnapshots: import('../personality/types').TraitSnapshot[];
  // Core Memories: coreMemories, lastMemoryTimestamp, visitedZones
  coreMemories: import('../personality/types').CoreMemory[];
  lastMemoryTimestamp: Partial<Record<`${import('../personality/types').TraitKey}_${'up' | 'down'}`, string>>;
  visitedZones: import('../personality/types').PersonalityId[];
  // Evolution: evolutionProposal, evolutionHistory
  evolutionProposal?: import('../personality/types').EvolutionProposal;
  evolutionHistory: import('../personality/types').EvolutionRecord[];
  // Formation: formationComplete, formationProgress
  formationComplete: boolean;
  formationProgress: number;
  // Trauma / Catharsis
  traumaLevel: number;
  catharsisProgress: number;
  catharsisAchieved: boolean;
  catharsisXpBurstExpiresAt?: string | null;
  traumaCooldownUntil: string | null;
  // Cognitive dissonance / sleep lifecycle
  dailyVectorVariance: number;
  confusedState: boolean;
  sleepStartedAt: string | null;
  lastSleepTimestamp: string | null;
  // Singularity
  ticksInSingularity: number;
  singularityZones: import('../personality/types').PersonalityId[];
}

export interface Account {
  legacyVector?: import('../personality/types').TraitVector;
  legacyCoefficient?: number;
  legacyGeneration?: number;
  legacyDescription?: string;
  memoryGuardian?: MemoryGuardian;
}

export interface MemoryGuardian {
  name: string;
  personalityId: import('../personality/types').PersonalityId;
  archivedMemories: Array<{
    emoji: string;
    text: string;
    tier: 'rare' | 'common';
    traitKey: import('../personality/types').TraitKey;
    personalityHint?: import('../personality/types').PersonalityId;
  }>;
  guidance: string[];
  updatedAt: string;
}

export interface NewLifeResult {
  pet: Pet;
  account: Account;
}

export interface PetEvent {
  id: string;
  timestamp: string;
  type: 'feed' | 'play' | 'sleep' | 'wake' | 'bathe' | 'heal' | 'bond' | 'levelup' | 'evolve' | 'buy' | 'quest' | 'achieve';
  description: string;
  emoji: string;
  xpGained?: number;
  coinsGained?: number;
}

// ─── Еда ─────────────────────────────────────────────────────────────────────

export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  hungerRestore: number;
  happinessBonus: number;
  healthBonus: number;
  description: string;
}

// ─── Игра ────────────────────────────────────────────────────────────────────

export interface PlayResult {
  pet: Pet;
  xpGained: number;
  coinsGained: number;
  score: number;
  message: string;
}

// ─── Магазин ─────────────────────────────────────────────────────────────────

export type ItemType = 'food' | 'toy' | 'medicine' | 'decoration';
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  type: ItemType;
  rarity: ItemRarity;
  /** Немедленный эффект при использовании из инвентаря */
  effect: {
    hunger?: number;
    happiness?: number;
    energy?: number;
    health?: number;
    cleanliness?: number;
    bond?: number;
    xp?: number;
  };
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
  item: ShopItem;
}

export interface BuyResult {
  coins: number;
  inventory: InventoryItem[];
  item: ShopItem;
}

// ─── Достижения ──────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: 'care' | 'social' | 'play' | 'progress' | 'shop';
  progress: number;
  target: number;
  unlocked: boolean;
  unlockedAt?: string;
  claimed: boolean;
  reward: number; // монеты
}

export interface ClaimResult {
  achievement: Achievement;
  coins: number;
  newBalance: number;
}

// ─── Квесты ──────────────────────────────────────────────────────────────────

export interface DailyQuest {
  id: string;
  name: string;
  description: string;
  emoji: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  reward: { coins: number; xp: number };
  expiresAt: string; // ISO — конец дня
}

export interface QuestClaimResult {
  quest: DailyQuest;
  coins: number;
  xp: number;
  newBalance: number;
}

// ─── Комнаты ─────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  unlocked: boolean;
  /** CSS градиент для фона комнаты */
  gradient: string;
  floorGradient: string;
  /** Декоративные элементы (emoji + позиция) */
  decorations: Array<{ emoji: string; x: number; y: number; size: number }>;
}

// ─── Рейтинг ─────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  ownerName: string;
  petName: string;
  petStage: PetStage;
  level: number;
  score: number;
}

// ─── Контракт API ─────────────────────────────────────────────────────────────

export interface ApiService {
  // Питомец
  getPet(): Promise<Pet>;
  feedPet(foodId: string): Promise<Pet>;
  playWithPet(): Promise<PlayResult>;
  sleepPet(): Promise<Pet>;
  wakePet(): Promise<Pet>;
  bathePet(): Promise<Pet>;
  healPet(): Promise<Pet>;
  bondWithPet(): Promise<Pet>;
  syncPet(): Promise<Pet>;
  acceptEvolution(): Promise<Pet>;
  rejectEvolution(): Promise<Pet>;
  beginNewLife(): Promise<NewLifeResult>;
  updatePetName(name: string): Promise<Pet>;
  getPetEvents(): Promise<PetEvent[]>;

  // Магазин / Инвентарь
  getCoins(): Promise<{ coins: number }>;
  getShop(): Promise<ShopItem[]>;
  buyItem(itemId: string): Promise<BuyResult>;
  getInventory(): Promise<InventoryItem[]>;
  useInventoryItem(itemId: string): Promise<Pet>;

  // Прогресс
  getAchievements(): Promise<Achievement[]>;
  claimAchievement(achievementId: string): Promise<ClaimResult>;
  getQuests(): Promise<DailyQuest[]>;
  claimQuestReward(questId: string): Promise<QuestClaimResult>;

  // Комнаты
  getRooms(): Promise<Room[]>;
  buyRoom(roomId: string): Promise<Room[]>;
  equipRoom(roomId: string): Promise<{ roomId: string }>;

  // Рейтинг
  getLeaderboard(): Promise<LeaderboardEntry[]>;

  // Еда (справочник)
  getFoods(): Promise<FoodItem[]>;
}
