import type {
  BehavioralCounters,
  BehavioralFlag,
  BehavioralFlagType,
  EmergentStateType,
  PersonalityDefinition,
  PersonalityId,
  PersonalityRuntimeContext,
  StatKey,
  SyncContext,
} from './types';
import { seededRandom } from './random';
import { EMERGENT_STATE_MAP } from './emergentStates';

const FEAST_FRENZY_FEED_WINDOW_MS = 60 * 60 * 1000;
const CHAOS_SURGE_INTERVAL_MINUTES = 3 * 60;
const CHAOS_SURGE_MIN_DURATION_MINUTES = 30;
const CHAOS_SURGE_MAX_DURATION_MINUTES = 60;

export interface GameplayStateRuleContext {
  stats: Record<StatKey, number>;
  personality: PersonalityDefinition;
  flags: BehavioralFlag[];
  counters: BehavioralCounters;
  syncContext: SyncContext;
  currentState: EmergentStateType | null;
  enteredAt: string | undefined;
  now: Date;
  avgStats: number;
}

export interface GameplayStateRule {
  stateType: EmergentStateType;
  personalityIds?: PersonalityId[];
  priority?: number;
  isActive(ctx: GameplayStateRuleContext): boolean;
  shouldRetain?: (ctx: GameplayStateRuleContext) => boolean;
  onExit?: (ctx: GameplayStateRuleContext) => void;
  onEnter?: (ctx: GameplayStateRuleContext) => void;
}

export interface GameplayStateCandidate {
  type: EmergentStateType;
  priority: number;
}

export const GAMEPLAY_STATE_RULES: GameplayStateRule[] = [
  {
    stateType: 'stoic_peak',
    personalityIds: ['stoic'],
    isActive: ({ counters }) => !counters.stoicPeakUsed && counters.consecutiveGoodSyncs >= 10,
    shouldRetain: ({ currentState, enteredAt, now }) =>
      currentState === 'stoic_peak' && Boolean(enteredAt) && elapsedHours(now, enteredAt) < 2,
    onEnter: ({ counters }) => {
      counters.stoicPeakUsed = true;
    },
  },
  {
    stateType: 'enlightenment',
    personalityIds: ['sage'],
    isActive: ({ counters }) => !counters.enlightenmentActive && counters.consecutiveGoodSyncs >= 7 * 24,
    shouldRetain: ({ currentState, enteredAt, now, avgStats }) =>
      currentState === 'enlightenment' && Boolean(enteredAt) && elapsedHours(now, enteredAt) < 24 && avgStats >= 50,
    onExit: ({ counters }) => {
      counters.enlightenmentActive = false;
    },
    onEnter: ({ counters, now }) => {
      counters.enlightenmentActive = true;
      counters.enlightenmentStart ??= now.toISOString();
    },
  },
  {
    stateType: 'feast_frenzy',
    personalityIds: ['foodie'],
    isActive: ({ counters, now, stats }) => recentFeedCount(counters, now.getTime()) >= 3 && stats.happiness > 90,
  },
  {
    stateType: 'deep_melancholy',
    personalityIds: ['melancholic'],
    isActive: ({ counters }) => counters.consecutiveBadMoodSyncs >= 5,
  },
  {
    stateType: 'wanderlust',
    personalityIds: ['adventurer'],
    isActive: ({ counters }) => counters.sameRoomHours >= 48,
  },
  {
    stateType: 'midnight_zoomies',
    personalityIds: ['feral'],
    isActive: ({ personality, syncContext }) =>
      isNightHour(syncContext.clientLocalHour, personality.specialRules?.nighttimeHours),
  },
  {
    stateType: 'coin_obsession',
    personalityIds: ['greedy'],
    isActive: ({ counters, syncContext }) => syncContext.coinBalance < 50 && counters.playCountToday < 5,
  },
  {
    stateType: 'food_panic',
    isActive: ({ flags, stats }) => hasFlag(flags, 'food_anxiety') && stats.hunger < 50,
  },
  {
    stateType: 'trust_collapse',
    personalityIds: ['paranoid'],
    isActive: ({ counters }) => counters.paranoidPhase === 'collapsed',
  },
  {
    stateType: 'apathy',
    personalityIds: ['empath'],
    isActive: ({ syncContext }) => syncContext.sessionGapHours >= 48,
  },
  {
    stateType: 'tantrum',
    personalityIds: ['bold', 'playful'],
    isActive: ({ stats }) => stats.energy < 15,
  },
  {
    stateType: 'contamination_crisis',
    personalityIds: ['pristine'],
    isActive: ({ stats }) => stats.cleanliness < 20,
  },
  {
    stateType: 'breakdown',
    personalityIds: ['anxious'],
    isActive: ({ stats }) =>
      (['hunger', 'happiness', 'energy', 'health', 'cleanliness', 'bond'] as StatKey[])
        .filter(stat => stats[stat] < 30).length >= 3,
  },
  {
    stateType: 'chaos_surge',
    personalityIds: ['chaotic'],
    isActive: ({ personality, counters, syncContext }) => isChaosSurgeActive(personality, counters, syncContext),
  },
];

export function getGameplayStateCandidates(ctx: GameplayStateRuleContext): GameplayStateCandidate[] {
  const candidates: GameplayStateCandidate[] = [];

  for (const rule of GAMEPLAY_STATE_RULES) {
    if (rule.personalityIds && !rule.personalityIds.includes(ctx.personality.id)) continue;

    if (ctx.currentState === rule.stateType && rule.shouldRetain) {
      if (rule.shouldRetain(ctx)) {
        candidates.push(toCandidate(rule));
      } else {
        rule.onExit?.(ctx);
      }
    }

    if (rule.isActive(ctx)) {
      candidates.push(toCandidate(rule));
    }
  }

  return dedupeCandidates(candidates);
}

export function applyGameplayStateEnterEffects(state: EmergentStateType, ctx: GameplayStateRuleContext): void {
  for (const rule of GAMEPLAY_STATE_RULES) {
    if (rule.stateType === state) rule.onEnter?.(ctx);
  }
}

function toCandidate(rule: GameplayStateRule): GameplayStateCandidate {
  return {
    type: rule.stateType,
    priority: rule.priority ?? getStatePriority(rule.stateType),
  };
}

function dedupeCandidates(candidates: GameplayStateCandidate[]): GameplayStateCandidate[] {
  const byType = new Map<EmergentStateType, GameplayStateCandidate>();
  for (const candidate of candidates) {
    const existing = byType.get(candidate.type);
    if (!existing || candidate.priority < existing.priority) byType.set(candidate.type, candidate);
  }
  return [...byType.values()];
}

function getStatePriority(state: EmergentStateType): number {
  return EMERGENT_STATE_MAP.get(state)?.priority ?? 999;
}

function hasFlag(flags: BehavioralFlag[], flagType: BehavioralFlagType): boolean {
  return flags.some(flag => flag.type === flagType);
}

function elapsedHours(now: Date, enteredAt: string | undefined): number {
  return enteredAt ? (now.getTime() - new Date(enteredAt).getTime()) / 3_600_000 : Infinity;
}

function recentFeedCount(counters: BehavioralCounters, nowMs: number): number {
  return (counters.recentFeedTimestamps ?? [])
    .filter(timestamp => nowMs - new Date(timestamp).getTime() <= FEAST_FRENZY_FEED_WINDOW_MS)
    .length;
}

function isNightHour(hour: number, range?: [number, number]): boolean {
  const [start, end] = range ?? [22, 6];
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function isChaosSurgeActive(
  personality: PersonalityDefinition,
  counters: BehavioralCounters,
  context: PersonalityRuntimeContext = {},
): boolean {
  if (!personality.specialRules?.randomizeDailySeed) return false;
  if (!personality.emergentTriggers.some(trigger => trigger.stateType === 'chaos_surge')) return false;

  const now = getContextNow(context);
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const bucket = Math.floor(minutesSinceMidnight / CHAOS_SURGE_INTERVAL_MINUTES);
  const minuteInBucket = minutesSinceMidnight % CHAOS_SURGE_INTERVAL_MINUTES;
  const dateKey = Number(now.toISOString().slice(0, 10).replace(/-/g, ''));
  const seed = Math.max(1, Math.floor(counters.chaosDailySeed * 1_000_000_000) + dateKey + bucket);
  const rng = seededRandom(seed);
  const duration =
    CHAOS_SURGE_MIN_DURATION_MINUTES +
    Math.floor(rng() * (CHAOS_SURGE_MAX_DURATION_MINUTES - CHAOS_SURGE_MIN_DURATION_MINUTES + 1));
  const maxStart = CHAOS_SURGE_INTERVAL_MINUTES - duration;
  const start = Math.floor(rng() * (maxStart + 1));

  return minuteInBucket >= start && minuteInBucket < start + duration;
}

function getContextNow(context: PersonalityRuntimeContext): Date {
  return context.now ?? new Date();
}
