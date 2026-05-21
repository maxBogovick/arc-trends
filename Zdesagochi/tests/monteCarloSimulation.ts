import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Pet, PetMood, PetStage } from '../src/api/types';
import type { BehavioralCounters, BehaviorAxis, BehaviorVector, MoodSnapshot } from '../src/personality/types';
import type { PetCommand } from '@zdesagochi/personality-core';
import { applyPersonalityCommand } from '../src/personality/commandHandlers';
import { createDefaultCounters } from '../src/personality/PersonalityEngine';
import {
  createInitialBehaviorProfile,
  createInitialTraitVector,
  addCatharsisProgress,
  FORMATION_THRESHOLD,
} from '../src/personality/TraitEvolutionEngine';
import { PERSONALITY_TRAIT_MAP } from '../src/personality/personalityTraitMap';
import { PERSONALITIES } from '@zdesagochi/personality-pet-preset';

const REPORT_PATH = resolve('docs/reports/monte_carlo_report.md');
const SIM_DAYS = 120;
const RUNS_PER_STYLE = 20;

const PERSONALITY_IDS = PERSONALITIES.map(p => p.id);
const BEHAVIOR_AXES: BehaviorAxis[] = ['care', 'play', 'social', 'order', 'exploration', 'disruption', 'recovery'];
const POST_FORMATION_STYLES = new Set<PlayStyle>([
  'post_adventure_shift',
  'post_food_shift',
  'post_social_shift',
  'post_clean_order_shift',
  'post_disruption_shift',
  'post_recovery_shift',
]);

// ─── Pet factory ─────────────────────────────────────────────────────────────

function makePet(personalityId: string, overrides: Partial<Pet> = {}): Pet {
  const now = new Date().toISOString();
  return {
    id: 'mc-pet',
    name: 'MC',
    stage: 'baby' as PetStage,
    mood: 'happy' as PetMood,
    stats: { hunger: 70, happiness: 70, energy: 70, health: 70, cleanliness: 70, bond: 70 },
    ageHours: 3,
    level: 1,
    xp: 0,
    xpToNext: 100,
    isAsleep: false,
    color: '#fff',
    equippedRoomId: 'default',
    createdAt: now,
    lastUpdated: now,
    personality: personalityId,
    behavioralFlags: [],
    emergentState: null,
    emergentStateEnteredAt: undefined,
    stateLayers: {},
    behavioralCounters: createDefaultCounters() as BehavioralCounters,
    behaviorProfile: createInitialBehaviorProfile(),
    moodHistory: [] as MoodSnapshot[],
    traitVector: createInitialTraitVector(),
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
    catharsisXpBurstExpiresAt: null,
    traumaCooldownUntil: null,
    dailyVectorVariance: 0,
    confusedState: false,
    sleepStartedAt: null,
    lastSleepTimestamp: null,
    ticksInSingularity: 0,
    singularityZones: [],
    ...overrides,
  };
}

// ─── RNG ─────────────────────────────────────────────────────────────────────

function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    return ((s >>> 0) / 4294967296);
  };
}

// ─── Command builders ────────────────────────────────────────────────────────

let cmdIdx = 0;

function cmd(type: PetCommand['type'], timestamp: string, extra: Record<string, unknown> = {}): PetCommand {
  const commandId = `mc-${type}-${++cmdIdx}`;
  if (type === 'feed') {
    return { type, foodId: `food-${cmdIdx % 8}`, foodEffect: { hungerRestore: 25, happinessBonus: 5, healthBonus: 3 }, at: timestamp, commandId, ...extra } as PetCommand;
  }
  if (type === 'play') {
    return { type, scoreSeed: String(80 + (cmdIdx % 60)), at: timestamp, commandId, ...extra } as PetCommand;
  }
  return { type, at: timestamp, commandId, ...extra } as PetCommand;
}

function ts(base: Date, offsetHours: number): string {
  return new Date(base.getTime() + offsetHours * 3_600_000).toISOString();
}

// ─── Play styles ─────────────────────────────────────────────────────────────

type PlayStyle =
  | 'common'
  | 'random_noise'
  | 'neglect'
  | 'heavy'
  | 'food_only'
  | 'balanced'
  | 'shadow_recovery'
  | 'singularity_hunt'
  | 'post_adventure_shift'
  | 'post_food_shift'
  | 'post_social_shift'
  | 'post_clean_order_shift'
  | 'post_disruption_shift'
  | 'post_recovery_shift';

async function runOneDayCommon(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  const actions: PetCommand[] = [
    cmd('feed', ts(base, day * 24 + 1)),
  ];
  if (rng() < 0.8) actions.push(cmd('play', ts(base, day * 24 + 3)));
  if (rng() < 0.55) actions.push(cmd('bathe', ts(base, day * 24 + 5)));
  if (rng() < 0.7) actions.push(cmd('bond', ts(base, day * 24 + 7)));
  if (rng() < 0.25) {
    actions.push({ type: 'equip_room', roomId: `room-${day % 4}`, at: ts(base, day * 24 + 10), commandId: `mc-common-room-${day}` });
  }
  if (rng() < 0.2) {
    actions.push({
      type: 'use_item',
      itemId: 'magic_wand',
      itemKind: 'toy',
      itemEffect: { happiness: 10, xp: 5 },
      at: ts(base, day * 24 + 12),
      commandId: `mc-common-wand-${day}`,
    });
  }
  if (rng() < 0.65) {
    actions.push(cmd('sleep', ts(base, day * 24 + 20)));
    actions.push({ type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-common` });
    actions.push(cmd('wake', ts(base, day * 24 + 28)));
  } else {
    actions.push({ type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-common` });
  }
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayNeglect(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  const actions: PetCommand[] = [
    cmd('feed', ts(base, day * 24 + 12)),
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-neglect` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayRandomNoise(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  const possible: PetCommand[] = [
    cmd('feed', ts(base, day * 24 + 1)),
    cmd('play', ts(base, day * 24 + 3)),
    cmd('bathe', ts(base, day * 24 + 5)),
    cmd('bond', ts(base, day * 24 + 7)),
    cmd('heal', ts(base, day * 24 + 9)),
    { type: 'equip_room', roomId: `noise-${day % 5}`, at: ts(base, day * 24 + 11), commandId: `mc-noise-room-${day}` },
    {
      type: 'use_item',
      itemId: rng() < 0.5 ? 'magic_wand' : 'crystal_ball',
      itemKind: 'toy',
      itemEffect: { happiness: 5, xp: 5 },
      at: ts(base, day * 24 + 13),
      commandId: `mc-noise-item-${day}`,
    },
  ];
  const actions = possible.filter(() => rng() < 0.35);
  actions.push({ type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-noise` });
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayHeavy(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  const actions: PetCommand[] = [];
  for (let h = 0; h < 24; h += 2) {
    const t = ts(base, day * 24 + h);
    if (h % 4 === 0) actions.push(cmd('feed', t));
    else if (h % 4 === 2) actions.push(cmd('play', t));
    else actions.push(cmd('bond', t));
  }
  actions.push({ type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-heavy` });
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayFoodOnly(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  const actions: PetCommand[] = [
    cmd('feed', ts(base, day * 24 + 6)),
    cmd('feed', ts(base, day * 24 + 12)),
    cmd('feed', ts(base, day * 24 + 18)),
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-food` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayBalanced(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  const actions: PetCommand[] = [
    cmd('feed', ts(base, day * 24 + 1)),
    cmd('play', ts(base, day * 24 + 2)),
    cmd('bathe', ts(base, day * 24 + 3)),
    cmd('heal', ts(base, day * 24 + 4)),
    cmd('bond', ts(base, day * 24 + 5)),
    cmd('sleep', ts(base, day * 24 + 21)),
    cmd('wake', ts(base, day * 24 + 29)),
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-balanced` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayShadowRecovery(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  // Alternate stress (neglect) and recovery (bond/heal) to drive shadow entry and recovery
  const stressed = day % 3 !== 0;
  const actions: PetCommand[] = stressed
    ? [{ type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-shadow-stress` }]
    : [
        cmd('feed', ts(base, day * 24 + 2)),
        cmd('bond', ts(base, day * 24 + 4)),
        cmd('heal', ts(base, day * 24 + 6)),
        { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-shadow-recover` },
      ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDaySingularity(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  // Maximize diversity: use all action types to drive trait vector toward multiple zones
  const actions: PetCommand[] = [
    cmd('feed', ts(base, day * 24 + 1)),
    cmd('play', ts(base, day * 24 + 2)),
    cmd('bathe', ts(base, day * 24 + 3)),
    cmd('heal', ts(base, day * 24 + 4)),
    cmd('bond', ts(base, day * 24 + 5)),
    { type: 'equip_room', roomId: `room-${day % 4}`, at: ts(base, day * 24 + 10), commandId: `mc-room-${day}` },
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-singularity` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayPostAdventureShift(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  pet = {
    ...pet,
    stats: { ...pet.stats, hunger: 20, happiness: 35, energy: 80 },
  };
  const actions: PetCommand[] = [
    { type: 'equip_room', roomId: `adventure-${day % 4}`, at: ts(base, day * 24 + 1), commandId: `mc-adventure-room-${day}` },
    {
      type: 'use_item',
      itemId: 'magic_wand',
      itemKind: 'toy',
      itemEffect: { happiness: 10, xp: 5 },
      at: ts(base, day * 24 + 3),
      commandId: `mc-adventure-wand-${day}`,
    },
    cmd('play', ts(base, day * 24 + 5)),
    cmd('feed', ts(base, day * 24 + 7)),
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-adventure-shift` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayPostFoodShift(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  pet = { ...pet, stats: { ...pet.stats, hunger: 20 } };
  const actions: PetCommand[] = [
    cmd('feed', ts(base, day * 24 + 4)),
    cmd('feed', ts(base, day * 24 + 10)),
    {
      type: 'use_item',
      itemId: 'magic_potion',
      itemKind: 'food',
      itemEffect: { hunger: 20, happiness: 8, xp: 5 },
      at: ts(base, day * 24 + 15),
      commandId: `mc-food-potion-${day}`,
    },
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-food-shift` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayPostSocialShift(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  pet = { ...pet, stats: { ...pet.stats, bond: 25 } };
  const actions: PetCommand[] = [
    cmd('bond', ts(base, day * 24 + 4)),
    {
      type: 'use_item',
      itemId: 'music_box',
      itemKind: 'toy',
      itemEffect: { happiness: 6, xp: 5 },
      at: ts(base, day * 24 + 10),
      commandId: `mc-social-music-${day}`,
    },
    cmd('bond', ts(base, day * 24 + 16)),
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-social-shift` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayPostCleanOrderShift(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  pet = { ...pet, stats: { ...pet.stats, cleanliness: 20 } };
  const actions: PetCommand[] = [
    cmd('bathe', ts(base, day * 24 + 4)),
    { type: 'use_item', itemId: 'puzzle', itemKind: 'toy', itemEffect: { happiness: 4, xp: 5 }, at: ts(base, day * 24 + 10), commandId: `mc-order-puzzle-${day}` },
    cmd('bathe', ts(base, day * 24 + 16)),
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-order-shift` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayPostDisruptionShift(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  pet = { ...pet, stats: { ...pet.stats, energy: 85 }, isAsleep: false };
  const actions: PetCommand[] = [
    cmd('sleep', ts(base, day * 24 + 2)),
    cmd('wake', ts(base, day * 24 + 2.4)),
    cmd('sleep', ts(base, day * 24 + 14)),
    cmd('wake', ts(base, day * 24 + 14.4)),
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-disruption-shift` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayPostRecoveryShift(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  pet = { ...pet, stats: { ...pet.stats, health: 35, bond: 35 }, traumaLevel: Math.max(pet.traumaLevel, 20) };
  const actions: PetCommand[] = [
    cmd('heal', ts(base, day * 24 + 4)),
    {
      type: 'use_item',
      itemId: 'magic_potion',
      itemKind: 'food',
      itemEffect: { health: 12, happiness: 4, xp: 5 },
      at: ts(base, day * 24 + 12),
      commandId: `mc-recovery-potion-${day}`,
    },
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-recovery-shift` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runActions(
  pet: Pet,
  actions: PetCommand[],
  cooldowns: Record<string, number>,
  sync: number,
  rng: () => number,
): Promise<{
  pet: Pet;
  cooldowns: Record<string, number>;
  sync: number;
  behaviorBlockedEvolutionWindows: number;
  targetZoneSyncs: number;
}> {
  let behaviorBlockedEvolutionWindows = 0;
  let targetZoneSyncs = 0;
  for (const action of actions) {
    try {
      const result = await applyPersonalityCommand(pet, action, {
        currentSync: sync,
        influenceCooldowns: cooldowns,
        rng,
      });
      pet = result.pet;
      cooldowns = result.influenceCooldowns;
      if (action.type === 'sync') {
        if (pet.formationComplete && pet.currentTargetZone) {
          targetZoneSyncs++;
        }
        if (
          pet.formationComplete &&
          pet.currentTargetZone &&
          pet.ticksInTargetZone === 0 &&
          (pet.evolutionReadiness ?? 0) === 0 &&
          !pet.evolutionProposal &&
          (pet.behaviorProfile?.sampleCount ?? 0) >= 24
        ) {
          behaviorBlockedEvolutionWindows++;
        }
        sync++;
      }

      // Auto-accept evolution proposals immediately
      if (pet.evolutionProposal) {
        const accept = await applyPersonalityCommand(pet, {
          type: 'accept_evolution',
          at: action.at,
          commandId: `mc-accept-${cmdIdx++}`,
        }, { currentSync: sync, influenceCooldowns: cooldowns, rng });
        pet = accept.pet;
        cooldowns = accept.influenceCooldowns;
      }

      // Catharsis: if in shadow_form, nudge catharsis progress
      if (pet.emergentState === 'shadow_form') {
        addCatharsisProgress(pet as any, 5);
      }
    } catch {
      // ignore blocked actions
    }
  }
  return { pet, cooldowns, sync, behaviorBlockedEvolutionWindows, targetZoneSyncs };
}

// ─── Single run ───────────────────────────────────────────────────────────────

interface RunResult {
  formedPersonality: string | null;
  formationDay: number | null;
  evolved: boolean;
  firstEvolutionDay: number | null;
  shadowEntered: boolean;
  shadowRecovered: boolean;
  confusedEvents: number;
  singularityTriggered: boolean;
  behaviorBlockedEvolutionWindows: number;
  targetZoneSyncs: number;
  finalBehaviorAxes: BehaviorVector;
  dominantBehaviorAxis: BehaviorAxis;
  totalMemories: number;
  rareMemories: number;
  finalPersonality: string;
}

async function runSimulation(personalityId: string, style: PlayStyle, seed: number): Promise<RunResult> {
  let pet = makePet(personalityId);
  if (POST_FORMATION_STYLES.has(style)) {
    pet = {
      ...pet,
      ageHours: 30 * 24,
      formationComplete: true,
      formationProgress: FORMATION_THRESHOLD,
      traitVector: { ...PERSONALITY_TRAIT_MAP[personalityId as keyof typeof PERSONALITY_TRAIT_MAP].position },
    };
  }
  let cooldowns: Record<string, number> = {};
  let sync = 0;
  const rng = makeRng(seed);
  const base = new Date('2026-01-01T00:00:00.000Z');

  let formedPersonality: string | null = null;
  let formationDay: number | null = null;
  let evolved = false;
  let firstEvolutionDay: number | null = null;
  let shadowEntered = false;
  let shadowRecovered = false;
  let confusedEvents = 0;
  let singularityTriggered = false;
  let behaviorBlockedEvolutionWindows = 0;
  let targetZoneSyncs = 0;

  const prevConfused = false;

  for (let day = 0; day < SIM_DAYS; day++) {
    let state: {
      pet: Pet;
      cooldowns: Record<string, number>;
      sync: number;
      behaviorBlockedEvolutionWindows: number;
      targetZoneSyncs: number;
    };

    switch (style) {
      case 'common': state = await runOneDayCommon(pet, base, day, cooldowns, sync, rng); break;
      case 'random_noise': state = await runOneDayRandomNoise(pet, base, day, cooldowns, sync, rng); break;
      case 'neglect': state = await runOneDayNeglect(pet, base, day, cooldowns, sync, rng); break;
      case 'heavy': state = await runOneDayHeavy(pet, base, day, cooldowns, sync, rng); break;
      case 'food_only': state = await runOneDayFoodOnly(pet, base, day, cooldowns, sync, rng); break;
      case 'balanced': state = await runOneDayBalanced(pet, base, day, cooldowns, sync, rng); break;
      case 'shadow_recovery': state = await runOneDayShadowRecovery(pet, base, day, cooldowns, sync, rng); break;
      case 'singularity_hunt': state = await runOneDaySingularity(pet, base, day, cooldowns, sync, rng); break;
      case 'post_adventure_shift': state = await runOneDayPostAdventureShift(pet, base, day, cooldowns, sync, rng); break;
      case 'post_food_shift': state = await runOneDayPostFoodShift(pet, base, day, cooldowns, sync, rng); break;
      case 'post_social_shift': state = await runOneDayPostSocialShift(pet, base, day, cooldowns, sync, rng); break;
      case 'post_clean_order_shift': state = await runOneDayPostCleanOrderShift(pet, base, day, cooldowns, sync, rng); break;
      case 'post_disruption_shift': state = await runOneDayPostDisruptionShift(pet, base, day, cooldowns, sync, rng); break;
      case 'post_recovery_shift': state = await runOneDayPostRecoveryShift(pet, base, day, cooldowns, sync, rng); break;
    }

    pet = state.pet;
    cooldowns = state.cooldowns;
    sync = state.sync;
    behaviorBlockedEvolutionWindows += state.behaviorBlockedEvolutionWindows;
    targetZoneSyncs += state.targetZoneSyncs;

    if (!formedPersonality && pet.formationComplete) {
      formedPersonality = pet.personality;
      formationDay = day;
    }

    if (pet.evolutionHistory.length > 0) {
      evolved = true;
      firstEvolutionDay ??= day;
    }

    if (pet.emergentState === 'shadow_form' || pet.stateLayers?.evolution?.some?.((s: any) => s.type === 'shadow_form')) {
      shadowEntered = true;
    }
    if (shadowEntered && pet.catharsisAchieved) shadowRecovered = true;

    if (pet.confusedState && !prevConfused) confusedEvents++;

    if (pet.stateLayers?.evolution?.some?.((s: any) => s.type === 'singularity') || pet.emergentState === 'singularity') {
      singularityTriggered = true;
    }
  }
  const finalBehaviorAxes = normalizeBehaviorAxes(pet.behaviorProfile?.axes);

  return {
    formedPersonality,
    formationDay,
    evolved,
    firstEvolutionDay,
    shadowEntered,
    shadowRecovered,
    confusedEvents,
    singularityTriggered,
    behaviorBlockedEvolutionWindows,
    targetZoneSyncs,
    finalBehaviorAxes,
    dominantBehaviorAxis: dominantBehaviorAxis(finalBehaviorAxes),
    totalMemories: pet.coreMemories.length,
    rareMemories: pet.coreMemories.filter(m => m.tier === 'rare').length,
    finalPersonality: pet.personality,
  };
}

// ─── Aggregate across runs ────────────────────────────────────────────────────

interface StyleStats {
  style: PlayStyle;
  personalityId: string;
  formationRate: number;
  avgFormationDay: number;
  evolutionRate: number;
  avgFirstEvolutionDay: number;
  avgBehaviorBlockedEvolutionWindows: number;
  avgTargetZoneSyncs: number;
  shadowEntryRate: number;
  shadowRecoveryRate: number;
  avgConfusedEvents: number;
  singularityRate: number;
  avgMemories: number;
  avgRareMemories: number;
  avgBehaviorAxes: BehaviorVector;
  dominantBehaviorAxisDistribution: Record<BehaviorAxis, number>;
  finalPersonalityDistribution: Record<string, number>;
}

async function runStyleForPersonality(personalityId: string, style: PlayStyle): Promise<StyleStats> {
  const results: RunResult[] = [];
  for (let i = 0; i < RUNS_PER_STYLE; i++) {
    results.push(await runSimulation(personalityId, style, i * 31337 + personalityId.charCodeAt(0) * 137));
  }

  const formed = results.filter(r => r.formedPersonality !== null);
  const evolved = results.filter(r => r.firstEvolutionDay !== null);
  const finalDist: Record<string, number> = {};
  const axisDist = Object.fromEntries(BEHAVIOR_AXES.map(axis => [axis, 0])) as Record<BehaviorAxis, number>;
  for (const r of results) {
    finalDist[r.finalPersonality] = (finalDist[r.finalPersonality] ?? 0) + 1;
    axisDist[r.dominantBehaviorAxis] += 1;
  }
  for (const key of Object.keys(finalDist)) finalDist[key] = finalDist[key] / results.length;
  for (const axis of BEHAVIOR_AXES) axisDist[axis] = axisDist[axis] / results.length;

  return {
    style,
    personalityId,
    formationRate: formed.length / results.length,
    avgFormationDay: formed.length > 0 ? formed.reduce((s, r) => s + (r.formationDay ?? 0), 0) / formed.length : -1,
    evolutionRate: results.filter(r => r.evolved).length / results.length,
    avgFirstEvolutionDay: evolved.length > 0 ? evolved.reduce((s, r) => s + (r.firstEvolutionDay ?? 0), 0) / evolved.length : -1,
    avgBehaviorBlockedEvolutionWindows: results.reduce((s, r) => s + r.behaviorBlockedEvolutionWindows, 0) / results.length,
    avgTargetZoneSyncs: results.reduce((s, r) => s + r.targetZoneSyncs, 0) / results.length,
    shadowEntryRate: results.filter(r => r.shadowEntered).length / results.length,
    shadowRecoveryRate: results.filter(r => r.shadowRecovered).length / results.length,
    avgConfusedEvents: results.reduce((s, r) => s + r.confusedEvents, 0) / results.length,
    singularityRate: results.filter(r => r.singularityTriggered).length / results.length,
    avgMemories: results.reduce((s, r) => s + r.totalMemories, 0) / results.length,
    avgRareMemories: results.reduce((s, r) => s + r.rareMemories, 0) / results.length,
    avgBehaviorAxes: averageBehaviorAxes(results),
    dominantBehaviorAxisDistribution: axisDist,
    finalPersonalityDistribution: finalDist,
  };
}

function normalizeBehaviorAxes(value: Partial<BehaviorVector> | undefined): BehaviorVector {
  return Object.fromEntries(BEHAVIOR_AXES.map(axis => [axis, value?.[axis] ?? 0])) as BehaviorVector;
}

function averageBehaviorAxes(results: RunResult[]): BehaviorVector {
  const axes = normalizeBehaviorAxes(undefined);
  for (const result of results) {
    for (const axis of BEHAVIOR_AXES) axes[axis] += result.finalBehaviorAxes[axis];
  }
  for (const axis of BEHAVIOR_AXES) axes[axis] /= Math.max(1, results.length);
  return axes;
}

function dominantBehaviorAxis(axes: BehaviorVector): BehaviorAxis {
  return BEHAVIOR_AXES.reduce((best, axis) => axes[axis] > axes[best] ? axis : best, BEHAVIOR_AXES[0]);
}

// ─── Report renderer ──────────────────────────────────────────────────────────

function pct(v: number): string { return `${(v * 100).toFixed(0)}%`; }
function dec(v: number): string { return v.toFixed(1); }
function row(cells: Array<string | number>): string { return `| ${cells.join(' | ')} |`; }
function axisSummary(axes: BehaviorVector): string {
  return BEHAVIOR_AXES
    .map(axis => `${axis}:${axes[axis].toFixed(0)}`)
    .join(', ');
}

function renderReport(allStats: StyleStats[]): string {
  const generatedAt = new Date().toISOString();
  const STYLES: PlayStyle[] = [
    'common',
    'random_noise',
    'neglect',
    'heavy',
    'food_only',
    'balanced',
    'shadow_recovery',
    'singularity_hunt',
    'post_adventure_shift',
    'post_food_shift',
    'post_social_shift',
    'post_clean_order_shift',
    'post_disruption_shift',
    'post_recovery_shift',
  ];

  const lines: string[] = [
    '# Personality Engine Monte Carlo Report',
    '',
    `Generated at: ${generatedAt}  `,
    `Runs per personality/style: ${RUNS_PER_STYLE}  `,
    `Simulation days: ${SIM_DAYS}`,
    '',
    '## Summary by style (averaged across all personalities)',
    '',
    '| Style | Formation% | Avg Formation Day | Evolution% | Avg Evolution Day | Target-zone syncs/run | Target stalls/run | Shadow Entry% | Shadow Recovery% | Singularity% | Avg Memories |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];

  for (const style of STYLES) {
    const rows = allStats.filter(s => s.style === style);
    const avg = (fn: (s: StyleStats) => number) => rows.reduce((a, r) => a + fn(r), 0) / rows.length;
    lines.push(row([
      style,
      pct(avg(s => s.formationRate)),
      dec(avg(s => s.avgFormationDay)),
      pct(avg(s => s.evolutionRate)),
      dec(avg(s => s.avgFirstEvolutionDay)),
      dec(avg(s => s.avgTargetZoneSyncs)),
      dec(avg(s => s.avgBehaviorBlockedEvolutionWindows)),
      pct(avg(s => s.shadowEntryRate)),
      pct(avg(s => s.shadowRecoveryRate)),
      pct(avg(s => s.singularityRate)),
      dec(avg(s => s.avgMemories)),
    ]));
  }

  lines.push('', '## Behavior profile by style', '');
  lines.push('| Style | Dominant Axis | Avg Behavior Axes |');
  lines.push('|---|---|---|');
  for (const style of STYLES) {
    const rows = allStats.filter(s => s.style === style);
    const axes = normalizeBehaviorAxes(undefined);
    const dominant: Record<BehaviorAxis, number> = Object.fromEntries(BEHAVIOR_AXES.map(axis => [axis, 0])) as Record<BehaviorAxis, number>;
    for (const row of rows) {
      for (const axis of BEHAVIOR_AXES) {
        axes[axis] += row.avgBehaviorAxes[axis] / rows.length;
        dominant[axis] += row.dominantBehaviorAxisDistribution[axis] / rows.length;
      }
    }
    const dominantAxis = BEHAVIOR_AXES.reduce((best, axis) => dominant[axis] > dominant[best] ? axis : best, BEHAVIOR_AXES[0]);
    lines.push(row([style, `${dominantAxis} (${pct(dominant[dominantAxis])})`, axisSummary(axes)]));
  }

  lines.push('', '## Acceptance matrix', '');
  const acceptance = buildAcceptanceMatrix(allStats);
  lines.push('| Check | Styles | Expected | Observed | Result |');
  lines.push('|---|---|---|---|---|');
  for (const check of acceptance.checks) {
    lines.push(row([check.name, check.styles.join(', '), check.expected, check.observed, check.passed ? 'PASS' : 'FAIL']));
  }
  lines.push('', `Product readiness gate: **${acceptance.passed ? 'PASS' : 'FAIL'}**`);

  const postShiftStyles = STYLES.filter(style => POST_FORMATION_STYLES.has(style));
  lines.push('', '## Calibration readout', '');
  for (const style of postShiftStyles) {
    const rows = allStats.filter(s => s.style === style);
    const avg = (fn: (s: StyleStats) => number) => rows.reduce((a, r) => a + fn(r), 0) / rows.length;
    lines.push(`- ${style}: evolution ${pct(avg(s => s.evolutionRate))}, target-zone syncs/run ${dec(avg(s => s.avgTargetZoneSyncs))}, target stalls/run ${dec(avg(s => s.avgBehaviorBlockedEvolutionWindows))}, behavior axes ${axisSummary(averageStyleAxes(rows))}.`);
  }

  lines.push('', '## Per-personality detail (common play style)', '');
  lines.push('| Personality | Formation% | Avg Day | Evolution% | Avg Evolution Day | Target-zone syncs/run | Target stalls/run | Dominant Behavior | Confused/120d | Memories |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');

  for (const stat of allStats.filter(s => s.style === 'common')) {
    const dominantAxis = BEHAVIOR_AXES.reduce(
      (best, axis) => stat.dominantBehaviorAxisDistribution[axis] > stat.dominantBehaviorAxisDistribution[best] ? axis : best,
      BEHAVIOR_AXES[0],
    );
    lines.push(row([
      stat.personalityId,
      pct(stat.formationRate),
      dec(stat.avgFormationDay),
      pct(stat.evolutionRate),
      dec(stat.avgFirstEvolutionDay),
      dec(stat.avgTargetZoneSyncs),
      dec(stat.avgBehaviorBlockedEvolutionWindows),
      `${dominantAxis} (${pct(stat.dominantBehaviorAxisDistribution[dominantAxis])})`,
      dec(stat.avgConfusedEvents),
      dec(stat.avgMemories),
    ]));
  }

  lines.push('', '## Final personality distribution (common play style, % of runs ending as each personality)', '');
  const allPersonalities = new Set<string>();
  for (const s of allStats.filter(st => st.style === 'common')) {
    for (const k of Object.keys(s.finalPersonalityDistribution)) allPersonalities.add(k);
  }
  const header = `| Start \\ End | ${[...allPersonalities].join(' | ')} |`;
  lines.push(header);
  lines.push(`|${Array.from({ length: allPersonalities.size + 1 }, () => '---').join('|')}|`);
  for (const stat of allStats.filter(s => s.style === 'common')) {
    const row = [...allPersonalities].map(p => pct(stat.finalPersonalityDistribution[p] ?? 0)).join(' | ');
    lines.push(`| ${stat.personalityId} | ${row} |`);
  }

  return lines.join('\n') + '\n';
}

function averageStyleAxes(rows: StyleStats[]): BehaviorVector {
  const axes = normalizeBehaviorAxes(undefined);
  for (const row of rows) {
    for (const axis of BEHAVIOR_AXES) axes[axis] += row.avgBehaviorAxes[axis] / Math.max(1, rows.length);
  }
  return axes;
}

interface AcceptanceCheck {
  name: string;
  styles: PlayStyle[];
  expected: string;
  observed: string;
  passed: boolean;
}

function buildAcceptanceMatrix(allStats: StyleStats[]): { passed: boolean; checks: AcceptanceCheck[] } {
  const byStyle = (styles: PlayStyle[]) => allStats.filter(s => styles.includes(s.style));
  const avg = (rows: StyleStats[], fn: (s: StyleStats) => number) => rows.reduce((a, r) => a + fn(r), 0) / Math.max(1, rows.length);
  const max = (rows: StyleStats[], fn: (s: StyleStats) => number) => rows.reduce((m, r) => Math.max(m, fn(r)), 0);

  const stableStyles: PlayStyle[] = ['common', 'balanced', 'random_noise'];
  const evolutionShiftStyles: PlayStyle[] = [
    'post_adventure_shift',
    'post_food_shift',
    'post_social_shift',
    'post_clean_order_shift',
  ];
  const stableRows = byStyle(stableStyles);
  const evolutionShiftRows = byStyle(evolutionShiftStyles);

  const checks: AcceptanceCheck[] = [];
  const stableEvolution = max(stableRows, s => s.evolutionRate);
  checks.push({
    name: 'Stable everyday play does not churn formed character',
    styles: stableStyles,
    expected: 'max evolution <= 5%',
    observed: `max evolution ${pct(stableEvolution)}`,
    passed: stableEvolution <= 0.05,
  });

  const averagePostEvolution = avg(evolutionShiftRows, s => s.evolutionRate);
  checks.push({
    name: 'Sustained post-formation behavior can change character',
    styles: evolutionShiftStyles,
    expected: 'average evolution >= 10%',
    observed: `average evolution ${pct(averagePostEvolution)}`,
    passed: averagePostEvolution >= 0.10,
  });

  const behaviorProfiles = [
    { style: 'post_adventure_shift' as PlayStyle, axis: 'exploration' as BehaviorAxis },
    { style: 'post_food_shift' as PlayStyle, axis: 'care' as BehaviorAxis },
    { style: 'post_social_shift' as PlayStyle, axis: 'social' as BehaviorAxis },
    { style: 'post_clean_order_shift' as PlayStyle, axis: 'order' as BehaviorAxis },
    { style: 'post_disruption_shift' as PlayStyle, axis: 'disruption' as BehaviorAxis },
    { style: 'post_recovery_shift' as PlayStyle, axis: 'recovery' as BehaviorAxis },
  ];
  for (const { style, axis } of behaviorProfiles) {
    const rows = byStyle([style]);
    const axes = averageStyleAxes(rows);
    const dominant = dominantBehaviorAxis(axes);
    checks.push({
      name: `${style} records expected behavior profile`,
      styles: [style],
      expected: `dominant axis ${axis}`,
      observed: `dominant axis ${dominant}; ${axis}:${axes[axis].toFixed(0)}`,
      passed: dominant === axis,
    });
  }

  return { passed: checks.every(check => check.passed), checks };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const STYLES: PlayStyle[] = [
  'common',
  'random_noise',
  'neglect',
  'heavy',
  'food_only',
  'balanced',
  'shadow_recovery',
  'singularity_hunt',
  'post_adventure_shift',
  'post_food_shift',
  'post_social_shift',
  'post_clean_order_shift',
  'post_disruption_shift',
  'post_recovery_shift',
];

console.log(`Monte Carlo: ${PERSONALITY_IDS.length} personalities × ${STYLES.length} styles × ${RUNS_PER_STYLE} runs = ${PERSONALITY_IDS.length * STYLES.length * RUNS_PER_STYLE} total simulations`);

const allStats: StyleStats[] = [];

for (const personalityId of PERSONALITY_IDS) {
  process.stdout.write(`  ${personalityId}... `);
  for (const style of STYLES) {
    allStats.push(await runStyleForPersonality(personalityId, style));
  }
  process.stdout.write('done\n');
}

await mkdir(dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, renderReport(allStats), 'utf8');

console.log(`\nMonte Carlo report written to ${REPORT_PATH}`);

// Print summary
const commonStats = allStats.filter(s => s.style === 'common');
const avg = (fn: (s: StyleStats) => number) => commonStats.reduce((a, r) => a + fn(r), 0) / commonStats.length;
console.log(`Formation rate (common): ${(avg(s => s.formationRate) * 100).toFixed(0)}%`);
console.log(`Evolution rate (common): ${(avg(s => s.evolutionRate) * 100).toFixed(0)}%`);
console.log(`Target-zone syncs/run (common): ${avg(s => s.avgTargetZoneSyncs).toFixed(1)}`);
console.log(`Behavior-blocked windows/run (common): ${avg(s => s.avgBehaviorBlockedEvolutionWindows).toFixed(1)}`);
console.log(`Shadow entry rate (common): ${(avg(s => s.shadowEntryRate) * 100).toFixed(0)}%`);
console.log(`Singularity rate (common): ${(avg(s => s.singularityRate) * 100).toFixed(0)}%`);
