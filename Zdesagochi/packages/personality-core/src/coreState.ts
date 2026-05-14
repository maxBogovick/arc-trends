import type {
  BehavioralCounters,
  BehavioralFlag,
  CoreMemory,
  EmergentStateType,
  EvolutionProposal,
  EvolutionRecord,
  InfluenceCategory,
  MoodSnapshot,
  PersonalityDefinition,
  PersonalityId,
  PetStateLayers,
  RegisteredInfluence,
  StatKey,
  TraitKey,
  TraitSnapshot,
  TraitVector,
} from './types';

export type PersonalityMood =
  | 'ecstatic'
  | 'happy'
  | 'content'
  | 'sad'
  | 'tired'
  | 'sick'
  | 'sleeping';

export type PersonalityStats = Record<StatKey, number>;
export type PersonalityInfluenceCooldownState = Record<string, number>;

export interface PersonalityLegacyState {
  legacyVector?: TraitVector;
  legacyCoefficient?: number;
  legacyGeneration?: number;
}

export interface PersonalityMemoryGuardian {
  name: string;
  personalityId: PersonalityId;
  archivedMemories: Array<{
    emoji: string;
    text: string;
    tier: 'rare' | 'common';
    traitKey: TraitKey;
    personalityHint?: PersonalityId;
  }>;
  guidance: string[];
  updatedAt: string;
}

export interface PersonalityAccount {
  legacyVector?: TraitVector;
  legacyCoefficient?: number;
  legacyGeneration?: number;
  legacyDescription?: string;
  memoryGuardian?: PersonalityMemoryGuardian;
}

export interface PersonalityState {
  schemaVersion?: number;
  mood: PersonalityMood;
  stats: PersonalityStats;
  ageHours: number;
  level: number;
  xp: number;
  xpToNext: number;
  isAsleep: boolean;
  equippedRoomId: string;
  lastUpdated: string;
  personality: string;
  behavioralFlags: BehavioralFlag[];
  emergentState: EmergentStateType | null;
  emergentStateEnteredAt?: string;
  stateLayers?: PetStateLayers;
  behavioralCounters: BehavioralCounters;
  moodHistory: MoodSnapshot[];
  traitVector: TraitVector;
  dailyTraitBudget: Partial<Record<TraitKey, number>>;
  currentTargetZone: PersonalityId | null;
  ticksInTargetZone: number;
  voidSyncs: number;
  dailyTraitSnapshots: TraitSnapshot[];
  coreMemories: CoreMemory[];
  lastMemoryTimestamp: Partial<Record<`${TraitKey}_${'up' | 'down'}`, string>>;
  visitedZones: PersonalityId[];
  evolutionProposal?: EvolutionProposal;
  evolutionHistory: EvolutionRecord[];
  formationComplete: boolean;
  formationProgress: number;
  traumaLevel: number;
  catharsisProgress: number;
  catharsisAchieved: boolean;
  catharsisXpBurstExpiresAt?: string | null;
  traumaCooldownUntil: string | null;
  dailyVectorVariance: number;
  confusedState: boolean;
  sleepStartedAt: string | null;
  lastSleepTimestamp: string | null;
  ticksInSingularity: number;
  singularityZones: PersonalityId[];
  coinBalance?: number;
  legacy?: PersonalityLegacyState;
}

export type PersonalityNamedState = PersonalityState & { name: string };

export interface PersonalityMemoryTextGenerator {
  generate(ctx: {
    personality: PersonalityDefinition;
    ageHours: number;
    traitKey: TraitKey;
    direction: 'up' | 'down' | 'origin';
    category: InfluenceCategory;
    emergentState: EmergentStateType | null;
    dominantInfluences: string[];
  }): Promise<string>;
}

export interface PersonalityRuntime {
  personalities?: PersonalityDefinition[];
  influenceRegistry?: RegisteredInfluence[];
  influenceCooldowns?: PersonalityInfluenceCooldownState;
  currentSync?: number;
  getIntensityMultiplier?: (influenceId: string) => number;
  memoryTextGenerator?: PersonalityMemoryTextGenerator;
  rng?: () => number;
  engineVersion?: string;
  registryVersion?: string;
}
