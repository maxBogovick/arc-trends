import assert from 'node:assert/strict';
import type { Pet, PetMood, PetStage } from '../src/api/types';
import { applyPersonalityCommand } from '../src/personality/commandHandlers';
import { createDefaultCounters } from '../src/personality/PersonalityEngine';
import {
  STABILITY_SYNCS,
  FORMATION_THRESHOLD,
  createInitialTraitVector,
  depthOfImmersion,
  recordDailyTraitSnapshot,
} from '../src/personality/TraitEvolutionEngine';
import { PERSONALITY_TRAIT_MAP } from '../src/personality/personalityTraitMap';
import type { BehavioralCounters, MoodSnapshot, PersonalityId, StatKey, TraitKey, TraitVector } from '../src/personality/types';
import type { PetCommand } from '@zdesagochi/personality-core';
import { PERSONALITIES } from '@zdesagochi/personality-pet-preset';

const START = new Date('2026-05-20T00:00:00.000Z');
const TRAIT_KEYS: TraitKey[] = ['vitality', 'sociality', 'order', 'appetite', 'caution', 'curiosity'];
const STABLE_STATS: Record<StatKey, number> = {
  hunger: 80,
  happiness: 80,
  energy: 80,
  health: 80,
  cleanliness: 80,
  bond: 80,
};

function makePet(overrides: Partial<Pet> = {}): Pet {
  const now = START.toISOString();
  return {
    id: 'semantic-pet',
    name: 'Semantic',
    stage: 'baby' as PetStage,
    mood: 'happy' as PetMood,
    stats: { ...STABLE_STATS },
    ageHours: 3,
    level: 1,
    xp: 0,
    xpToNext: 100,
    isAsleep: false,
    color: '#fff',
    equippedRoomId: 'default',
    createdAt: now,
    lastUpdated: now,
    personality: 'playful',
    behavioralFlags: [],
    emergentState: null,
    emergentStateEnteredAt: undefined,
    stateLayers: {},
    behavioralCounters: createDefaultCounters({ now: START, rng: () => 0.42 }) as BehavioralCounters,
    moodHistory: [] as MoodSnapshot[],
    traitVector: createInitialTraitVector(),
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

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - behavior semantics: ${name}`);
  } catch (error) {
    console.error(`not ok - behavior semantics: ${name}`);
    throw error;
  }
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`ok - behavior semantics: ${name}`);
  } catch (error) {
    console.error(`not ok - behavior semantics: ${name}`);
    throw error;
  }
}

function at(day: number, hour: number): string {
  return new Date(START.getTime() + (day * 24 + hour) * 3_600_000).toISOString();
}

function rankedPersonalities(vector: TraitVector, ageHours: number): Array<{ id: PersonalityId; depth: number }> {
  return PERSONALITIES
    .map(personality => ({
      id: personality.id,
      depth: depthOfImmersion(vector, personality.id, ageHours),
    }))
    .sort((a, b) => b.depth - a.depth);
}

function dominantTrait(vector: TraitVector): TraitKey {
  return TRAIT_KEYS
    .map(key => ({ key, drift: Math.abs(vector[key] - 50) }))
    .sort((a, b) => b.drift - a.drift)[0].key;
}

function drift(vector: TraitVector, key: TraitKey): number {
  return vector[key] - 50;
}

type ScenarioStep =
  | { type: 'feed'; stats: Partial<Record<StatKey, number>> }
  | { type: 'play'; stats: Partial<Record<StatKey, number>> }
  | { type: 'bond'; stats: Partial<Record<StatKey, number>> }
  | { type: 'bathe'; stats: Partial<Record<StatKey, number>> }
  | { type: 'heal'; stats: Partial<Record<StatKey, number>> }
  | { type: 'sleep_early_wake'; stats: Partial<Record<StatKey, number>> }
  | { type: 'item'; itemId: 'puzzle' | 'magic_potion' | 'magic_wand' | 'crystal_ball' }
  | { type: 'equip_room'; roomId: string };

type LifecycleStyle = 'common' | 'no_bathe' | 'play_heavy' | 'food_only' | 'balanced' | 'adventure';

interface ScenarioResult {
  name: string;
  pet: Pet;
  top: Array<{ id: PersonalityId; depth: number }>;
  dominant: TraitKey;
}

function describeScenario(result: ScenarioResult): string {
  return JSON.stringify({
    name: result.name,
    personality: result.pet.personality,
    formationComplete: result.pet.formationComplete,
    formationProgress: result.pet.formationProgress,
    dominant: result.dominant,
    top: result.top.slice(0, 5),
    vector: result.pet.traitVector,
  }, null, 2);
}

async function runScenario(
  name: string,
  steps: ScenarioStep[],
  days = 70,
): Promise<ScenarioResult> {
  let pet = makePet();
  let currentSync = 0;
  let influenceCooldowns: Record<string, number> = {};
  let commandIndex = 0;

  for (let day = 0; day < days && !pet.formationComplete; day++) {
    for (let index = 0; index < steps.length && !pet.formationComplete; index++) {
      const step = steps[index];
      pet = {
        ...pet,
        isAsleep: step.type === 'sleep_early_wake' ? pet.isAsleep : false,
        stats: { ...STABLE_STATS, ...('stats' in step ? step.stats : {}) },
        lastUpdated: at(day, Math.max(0, index * 2 - 1)),
      };

      const timestamp = at(day, index * 2 + 1);
      let command: PetCommand;
      if (step.type === 'feed') {
        command = {
          type: 'feed',
          foodId: 'apple',
          foodEffect: { hungerRestore: 20, happinessBonus: 5, healthBonus: 10 },
          at: timestamp,
          commandId: `${name}-feed-${commandIndex++}`,
        };
      } else if (step.type === 'play') {
        command = {
          type: 'play',
          scoreSeed: '160',
          at: timestamp,
          commandId: `${name}-play-${commandIndex++}`,
        };
      } else if (step.type === 'bond') {
        command = {
          type: 'bond',
          at: timestamp,
          commandId: `${name}-bond-${commandIndex++}`,
        };
      } else if (step.type === 'bathe') {
        command = {
          type: 'bathe',
          at: timestamp,
          commandId: `${name}-bathe-${commandIndex++}`,
        };
      } else if (step.type === 'heal') {
        command = {
          type: 'heal',
          at: timestamp,
          commandId: `${name}-heal-${commandIndex++}`,
        };
      } else if (step.type === 'item') {
        command = {
          type: 'use_item',
          itemId: step.itemId,
          itemKind: 'toy',
          itemEffect: { happiness: 5, xp: 5 },
          at: timestamp,
          commandId: `${name}-item-${step.itemId}-${commandIndex++}`,
        };
      } else if (step.type === 'equip_room') {
        command = {
          type: 'equip_room',
          roomId: step.roomId,
          at: timestamp,
          commandId: `${name}-room-${step.roomId}-${commandIndex++}`,
        };
      } else {
        const sleep = await applyPersonalityCommand({
          ...pet,
          isAsleep: false,
          stats: { ...pet.stats, ...step.stats },
        }, {
          type: 'sleep',
          at: timestamp,
          commandId: `${name}-sleep-${commandIndex++}`,
        }, {
          currentSync,
          influenceCooldowns,
          rng: () => 0.42,
        });
        pet = sleep.pet;
        influenceCooldowns = sleep.influenceCooldowns;
        command = {
          type: 'wake',
          at: at(day, index * 2 + 1.5),
          commandId: `${name}-wake-${commandIndex++}`,
        };
      }

      const result = await applyPersonalityCommand(pet, command, {
        currentSync,
        influenceCooldowns,
        rng: () => 0.42,
      });
      pet = result.pet;
      influenceCooldowns = result.influenceCooldowns;
    }

    recordDailyTraitSnapshot(pet, new Date(at(day, 23)));
    currentSync++;
  }

  const top = rankedPersonalities(pet.traitVector, pet.ageHours);
  return { name, pet, top, dominant: dominantTrait(pet.traitVector) };
}

function lifecycleCommand(
  type: PetCommand['type'],
  day: number,
  hour: number,
  index: number,
  extra: Partial<PetCommand> = {},
): PetCommand {
  const timestamp = at(day, hour);
  const commandId = `lifecycle-${type}-${day}-${index}`;
  if (type === 'feed') {
    return {
      type,
      foodId: `food-${index % 8}`,
      foodEffect: { hungerRestore: 25, happinessBonus: 5, healthBonus: 3 },
      at: timestamp,
      commandId,
      ...extra,
    } as PetCommand;
  }
  if (type === 'play') {
    return {
      type,
      scoreSeed: String(120 + index),
      at: timestamp,
      commandId,
      ...extra,
    } as PetCommand;
  }
  return { type, at: timestamp, commandId, ...extra } as PetCommand;
}

function lifecycleCommands(style: LifecycleStyle, day: number): PetCommand[] {
  switch (style) {
    case 'common':
      return [
        lifecycleCommand('feed', day, 1, 0),
        lifecycleCommand('play', day, 3, 1),
        lifecycleCommand('bathe', day, 5, 2),
        lifecycleCommand('bond', day, 7, 3),
        lifecycleCommand('sleep', day, 20, 4),
        lifecycleCommand('wake', day + 1, 4, 5),
        lifecycleCommand('sync', day, 23, 6),
      ];
    case 'no_bathe':
      return [
        lifecycleCommand('feed', day, 1, 0),
        lifecycleCommand('play', day, 3, 1),
        lifecycleCommand('bond', day, 7, 2),
        lifecycleCommand('sleep', day, 20, 3),
        lifecycleCommand('wake', day + 1, 4, 4),
        lifecycleCommand('sync', day, 23, 5),
      ];
    case 'play_heavy':
      return [
        lifecycleCommand('play', day, 1, 0),
        lifecycleCommand('play', day, 5, 1),
        lifecycleCommand('feed', day, 8, 2),
        lifecycleCommand('bond', day, 10, 3),
        lifecycleCommand('sleep', day, 20, 4),
        lifecycleCommand('wake', day + 1, 4, 5),
        lifecycleCommand('sync', day, 23, 6),
      ];
    case 'food_only':
      return [
        lifecycleCommand('feed', day, 6, 0),
        lifecycleCommand('feed', day, 12, 1),
        lifecycleCommand('feed', day, 18, 2),
        lifecycleCommand('sync', day, 23, 3),
      ];
    case 'balanced':
      return [
        lifecycleCommand('feed', day, 1, 0),
        lifecycleCommand('play', day, 2, 1),
        lifecycleCommand('bathe', day, 3, 2),
        lifecycleCommand('heal', day, 4, 3),
        lifecycleCommand('bond', day, 5, 4),
        lifecycleCommand('sleep', day, 21, 5),
        lifecycleCommand('wake', day + 1, 5, 6),
        lifecycleCommand('sync', day, 23, 7),
      ];
    case 'adventure':
      return [
        {
          type: 'equip_room',
          roomId: `room-${day % 4}`,
          at: at(day, 1),
          commandId: `lifecycle-room-${day}-0`,
        },
        lifecycleCommand('play', day, 3, 1),
        {
          type: 'use_item',
          itemId: 'magic_wand',
          itemKind: 'toy',
          itemEffect: { happiness: 5, xp: 5 },
          at: at(day, 5),
          commandId: `lifecycle-wand-${day}-2`,
        },
        lifecycleCommand('feed', day, 8, 3),
        lifecycleCommand('sync', day, 23, 4),
      ];
  }
}

async function runLifecycleStyle(style: LifecycleStyle, days = 45): Promise<ScenarioResult> {
  let pet = makePet({
    stats: { hunger: 70, happiness: 70, energy: 70, health: 70, cleanliness: 70, bond: 70 },
  });
  let currentSync = 0;
  let influenceCooldowns: Record<string, number> = {};

  for (let day = 0; day < days; day++) {
    const commands = lifecycleCommands(style, day);
    for (const command of commands) {
      const result = await applyPersonalityCommand(pet, command, {
        currentSync,
        influenceCooldowns,
        rng: () => 0.42,
      });
      pet = result.pet;
      influenceCooldowns = result.influenceCooldowns;
      if (command.type === 'sync') currentSync++;
      if (pet.formationComplete) break;
    }
    if (pet.formationComplete) break;
  }

  const top = rankedPersonalities(pet.traitVector, pet.ageHours);
  return { name: style, pet, top, dominant: dominantTrait(pet.traitVector) };
}

async function runPostFormationEvolutionScenario(
  name: string,
  initialPersonality: PersonalityId,
  steps: ScenarioStep[],
  maxDays = 180,
): Promise<ScenarioResult> {
  let pet = makePet({
    personality: initialPersonality,
    formationComplete: true,
    formationProgress: FORMATION_THRESHOLD,
    ageHours: 30 * 24,
    traitVector: { ...PERSONALITY_TRAIT_MAP[initialPersonality].position },
  });
  let currentSync = 0;
  let influenceCooldowns: Record<string, number> = {};
  let commandIndex = 0;

  for (let day = 0; day < maxDays && pet.evolutionHistory.length === 0; day++) {
    for (let index = 0; index < steps.length; index++) {
      const step = steps[index];
      pet = {
        ...pet,
        isAsleep: false,
        stats: { ...STABLE_STATS, ...('stats' in step ? step.stats : {}) },
        lastUpdated: at(day, Math.max(0, index * 2 - 1)),
      };

      const timestamp = at(day, index * 2 + 1);
      let command: PetCommand;
      if (step.type === 'play') {
        command = {
          type: 'play',
          scoreSeed: '180',
          at: timestamp,
          commandId: `${name}-play-${commandIndex++}`,
        };
      } else if (step.type === 'bond') {
        command = { type: 'bond', at: timestamp, commandId: `${name}-bond-${commandIndex++}` };
      } else if (step.type === 'bathe') {
        command = { type: 'bathe', at: timestamp, commandId: `${name}-bathe-${commandIndex++}` };
      } else if (step.type === 'heal') {
        command = { type: 'heal', at: timestamp, commandId: `${name}-heal-${commandIndex++}` };
      } else if (step.type === 'feed') {
        command = {
          type: 'feed',
          foodId: 'apple',
          foodEffect: { hungerRestore: 20, happinessBonus: 5, healthBonus: 10 },
          at: timestamp,
          commandId: `${name}-feed-${commandIndex++}`,
        };
      } else if (step.type === 'item') {
        command = {
          type: 'use_item',
          itemId: step.itemId,
          itemKind: 'toy',
          itemEffect: { happiness: 5, xp: 5 },
          at: timestamp,
          commandId: `${name}-item-${step.itemId}-${commandIndex++}`,
        };
      } else if (step.type === 'equip_room') {
        command = {
          type: 'equip_room',
          roomId: step.roomId,
          at: timestamp,
          commandId: `${name}-room-${step.roomId}-${commandIndex++}`,
        };
      } else {
        continue;
      }

      const result = await applyPersonalityCommand(pet, command, {
        currentSync,
        influenceCooldowns,
        rng: () => 0.42,
      });
      pet = result.pet;
      influenceCooldowns = result.influenceCooldowns;
    }

    currentSync++;
    const sync = await applyPersonalityCommand(pet, {
      type: 'sync',
      at: at(day, 23),
      commandId: `${name}-sync-${day}`,
    }, {
      currentSync,
      influenceCooldowns,
      rng: () => 0.42,
    });
    pet = sync.pet;
    influenceCooldowns = sync.influenceCooldowns;

    if (pet.evolutionProposal) {
      const accepted = await applyPersonalityCommand(pet, {
        type: 'accept_evolution',
        at: at(day, 23.5),
        commandId: `${name}-accept-${day}`,
      }, {
        currentSync,
        influenceCooldowns,
        rng: () => 0.42,
      });
      pet = accepted.pet;
      influenceCooldowns = accepted.influenceCooldowns;
    }
  }

  const top = rankedPersonalities(pet.traitVector, pet.ageHours);
  return { name, pet, top, dominant: dominantTrait(pet.traitVector) };
}

test('nearest-personality ranking is a semantic signal, not a fixture echo', () => {
  const foodRank = rankedPersonalities({
    vitality: 50,
    sociality: 50,
    order: 50,
    appetite: 90,
    caution: 35,
    curiosity: 45,
  }, 30 * 24);
  const playRank = rankedPersonalities({
    vitality: 82,
    sociality: 50,
    order: 25,
    appetite: 45,
    caution: 15,
    curiosity: 70,
  }, 30 * 24);

  assert.equal(foodRank[0].id, 'foodie');
  assert.equal(['playful', 'bold', 'adventurer'].includes(playRank[0].id), true);
});

await testAsync('food-heavy behavior forms from appetite drift, not pristine/order drift', async () => {
  const result = await runScenario('food-heavy', [
    { type: 'feed', stats: { hunger: 20 } },
    { type: 'item', itemId: 'magic_potion' },
    { type: 'feed', stats: { hunger: 20 } },
  ]);

  assert.equal(result.pet.formationComplete, true, describeScenario(result));
  assert.equal(result.pet.formationProgress, FORMATION_THRESHOLD, describeScenario(result));
  assert.equal(result.dominant, 'appetite', describeScenario(result));
  assert.equal(drift(result.pet.traitVector, 'appetite') > 0, true, describeScenario(result));
  assert.equal(
    result.top.slice(0, 3).some(candidate => candidate.id === 'foodie' || candidate.id === 'greedy'),
    true,
    describeScenario(result),
  );
  assert.notEqual(result.pet.personality, 'pristine');
});

await testAsync('play-heavy behavior moves toward energetic exploratory zones', async () => {
  const result = await runScenario('play-heavy', [
    { type: 'play', stats: { happiness: 35, energy: 80 } },
    { type: 'item', itemId: 'magic_wand' },
    { type: 'play', stats: { happiness: 35, energy: 80 } },
  ]);

  assert.equal(result.pet.formationComplete, true);
  assert.equal(drift(result.pet.traitVector, 'vitality') > 0, true);
  assert.equal(drift(result.pet.traitVector, 'curiosity') > 0, true);
  assert.equal(drift(result.pet.traitVector, 'order') < 0, true);
  assert.equal(
    result.top.slice(0, 4).some(candidate => ['playful', 'bold', 'adventurer', 'chaotic'].includes(candidate.id)),
    true,
  );
  assert.notEqual(result.pet.personality, 'drowsy');
});

await testAsync('bond-heavy behavior moves toward social low-caution zones', async () => {
  const result = await runScenario('bond-heavy', [
    { type: 'bond', stats: { bond: 25 } },
    { type: 'item', itemId: 'magic_potion' },
    { type: 'bond', stats: { bond: 25 } },
  ]);

  assert.equal(result.pet.formationComplete, true);
  assert.equal(drift(result.pet.traitVector, 'sociality') > 0, true);
  assert.equal(drift(result.pet.traitVector, 'caution') < 0, true);
  assert.equal(result.top.slice(0, 3).some(candidate => candidate.id === 'empath'), true);
  assert.notEqual(result.pet.personality, 'drowsy');
});

await testAsync('clean-orderly behavior is allowed to form pristine, but not every behavior does', async () => {
  const clean = await runScenario('clean-orderly', [
    { type: 'bathe', stats: { cleanliness: 20 } },
    { type: 'bond', stats: { bond: 70 } },
    { type: 'bathe', stats: { cleanliness: 20 } },
  ]);
  const food = await runScenario('clean-control-food-heavy', [
    { type: 'feed', stats: { hunger: 20 } },
    { type: 'item', itemId: 'magic_potion' },
    { type: 'feed', stats: { hunger: 20 } },
  ]);

  assert.equal(clean.pet.formationComplete, true);
  assert.equal(drift(clean.pet.traitVector, 'order') > 0, true);
  assert.equal(clean.top.slice(0, 3).some(candidate => ['pristine', 'zen', 'stoic'].includes(candidate.id)), true);
  assert.notEqual(clean.pet.personality, food.pet.personality);
});

await testAsync('forced-sleep disruption does not masquerade as calm orderly care', async () => {
  const result = await runScenario('forced-sleep', [
    { type: 'sleep_early_wake', stats: { energy: 90 } },
    { type: 'sleep_early_wake', stats: { energy: 90 } },
  ]);

  assert.equal(result.pet.formationComplete, true);
  assert.equal(drift(result.pet.traitVector, 'caution') > 0, true);
  assert.equal(drift(result.pet.traitVector, 'order') < 0, true);
  assert.notEqual(result.pet.personality, 'pristine');
});

await testAsync('different behavior styles do not collapse into one final personality', async () => {
  const results = await Promise.all([
    runScenario('diversity-food', [
      { type: 'feed', stats: { hunger: 20 } },
      { type: 'item', itemId: 'magic_potion' },
      { type: 'feed', stats: { hunger: 20 } },
    ]),
    runScenario('diversity-play', [
      { type: 'play', stats: { happiness: 35, energy: 80 } },
      { type: 'item', itemId: 'magic_wand' },
      { type: 'play', stats: { happiness: 35, energy: 80 } },
    ]),
    runScenario('diversity-bond', [
      { type: 'bond', stats: { bond: 25 } },
      { type: 'item', itemId: 'magic_potion' },
      { type: 'bond', stats: { bond: 25 } },
    ]),
    runScenario('diversity-clean', [
      { type: 'bathe', stats: { cleanliness: 20 } },
      { type: 'bond', stats: { bond: 70 } },
      { type: 'bathe', stats: { cleanliness: 20 } },
    ]),
    runScenario('diversity-forced-sleep', [
      { type: 'sleep_early_wake', stats: { energy: 90 } },
      { type: 'sleep_early_wake', stats: { energy: 90 } },
    ]),
  ]);

  assert.equal(results.every(result => result.pet.formationComplete), true);
  assert.equal(new Set(results.map(result => result.pet.personality)).size >= 3, true, JSON.stringify(
    results.map(result => ({
      name: result.name,
      personality: result.pet.personality,
      top: result.top.slice(0, 3).map(candidate => candidate.id),
      vector: result.pet.traitVector,
    })),
    null,
    2,
  ));
  assert.equal(results.filter(result => result.pet.personality === 'pristine').length < results.length, true);
});

await testAsync('full lifecycle styles form and stay behavior-sensitive through sync decay', async () => {
  const results = await Promise.all([
    runLifecycleStyle('common'),
    runLifecycleStyle('no_bathe'),
    runLifecycleStyle('play_heavy'),
    runLifecycleStyle('balanced'),
    runLifecycleStyle('adventure'),
  ]);

  assert.equal(results.every(result => result.pet.formationComplete), true, JSON.stringify(
    results.map(result => ({
      name: result.name,
      complete: result.pet.formationComplete,
      progress: result.pet.formationProgress,
      personality: result.pet.personality,
      top: result.top.slice(0, 3).map(candidate => candidate.id),
      vector: result.pet.traitVector,
      stats: result.pet.stats,
    })),
    null,
    2,
  ));

  const formed = new Set(results.map(result => result.pet.personality));
  assert.equal(formed.size >= 3, true, JSON.stringify(
    results.map(result => ({
      name: result.name,
      personality: result.pet.personality,
      top: result.top.slice(0, 3).map(candidate => candidate.id),
      vector: result.pet.traitVector,
    })),
    null,
    2,
  ));
});

type ArchetypeExpectation = {
  name: string;
  steps: ScenarioStep[];
  candidates: PersonalityId[];
  traits: Array<{ key: TraitKey; direction: 'up' | 'down'; minDrift?: number }>;
};

const ARCHETYPE_MATRIX: ArchetypeExpectation[] = [
  {
    name: 'food-focused care',
    steps: [
      { type: 'feed', stats: { hunger: 20 } },
      { type: 'item', itemId: 'magic_potion' },
      { type: 'feed', stats: { hunger: 20 } },
    ],
    candidates: ['foodie', 'greedy'],
    traits: [{ key: 'appetite', direction: 'up', minDrift: 8 }],
  },
  {
    name: 'energetic play',
    steps: [
      { type: 'play', stats: { happiness: 35, energy: 80 } },
      { type: 'item', itemId: 'magic_wand' },
      { type: 'play', stats: { happiness: 35, energy: 80 } },
    ],
    candidates: ['playful', 'bold', 'adventurer', 'chaotic'],
    traits: [
      { key: 'vitality', direction: 'up', minDrift: 8 },
      { key: 'curiosity', direction: 'up', minDrift: 4 },
      { key: 'order', direction: 'down', minDrift: 4 },
    ],
  },
  {
    name: 'social bonding',
    steps: [
      { type: 'bond', stats: { bond: 25 } },
      { type: 'item', itemId: 'crystal_ball' },
      { type: 'bond', stats: { bond: 25 } },
    ],
    candidates: ['empath', 'sage'],
    traits: [
      { key: 'sociality', direction: 'up', minDrift: 8 },
      { key: 'caution', direction: 'down', minDrift: 4 },
    ],
  },
  {
    name: 'clean orderly care',
    steps: [
      { type: 'bathe', stats: { cleanliness: 20 } },
      { type: 'heal', stats: { health: 35 } },
      { type: 'bathe', stats: { cleanliness: 20 } },
    ],
    candidates: ['pristine', 'zen', 'stoic'],
    traits: [{ key: 'order', direction: 'up', minDrift: 8 }],
  },
  {
    name: 'exploration and novelty',
    steps: [
      { type: 'equip_room', roomId: 'garden' },
      { type: 'item', itemId: 'magic_wand' },
      { type: 'play', stats: { happiness: 35, energy: 80 } },
    ],
    candidates: ['adventurer', 'sage', 'playful', 'chaotic'],
    traits: [
      { key: 'curiosity', direction: 'up', minDrift: 10 },
      { key: 'vitality', direction: 'up', minDrift: 5 },
      { key: 'caution', direction: 'down', minDrift: 4 },
    ],
  },
  {
    name: 'puzzle scholar',
    steps: [
      { type: 'item', itemId: 'puzzle' },
      { type: 'equip_room', roomId: 'library' },
      { type: 'item', itemId: 'puzzle' },
    ],
    candidates: ['sage', 'pristine', 'zen'],
    traits: [
      { key: 'curiosity', direction: 'up', minDrift: 8 },
      { key: 'order', direction: 'up', minDrift: 4 },
    ],
  },
  {
    name: 'sleep disruption',
    steps: [
      { type: 'sleep_early_wake', stats: { energy: 90 } },
      { type: 'sleep_early_wake', stats: { energy: 90 } },
    ],
    candidates: ['anxious', 'paranoid', 'bold'],
    traits: [
      { key: 'caution', direction: 'up', minDrift: 4 },
      { key: 'order', direction: 'down', minDrift: 4 },
    ],
  },
  {
    name: 'recovery care',
    steps: [
      { type: 'heal', stats: { health: 35 } },
      { type: 'bond', stats: { bond: 25 } },
      { type: 'bathe', stats: { cleanliness: 25 } },
    ],
    candidates: ['empath', 'pristine', 'anxious'],
    traits: [
      { key: 'sociality', direction: 'up', minDrift: 4 },
      { key: 'order', direction: 'up', minDrift: 4 },
    ],
  },
];

await testAsync('archetype matrix maps user styles to semantic personality zones', async () => {
  const results = await Promise.all(
    ARCHETYPE_MATRIX.map(async archetype => ({
      archetype,
      result: await runScenario(`archetype-${archetype.name.replaceAll(' ', '-')}`, archetype.steps, 90),
    })),
  );

  for (const { archetype, result } of results) {
    assert.equal(result.pet.formationComplete, true, `${archetype.name}: ${describeScenario(result)}`);
    assert.equal(
      result.top.slice(0, 4).some(candidate => archetype.candidates.includes(candidate.id)),
      true,
      `${archetype.name}: expected one of ${archetype.candidates.join(', ')} in top 4\n${describeScenario(result)}`,
    );

    for (const expectation of archetype.traits) {
      const actualDrift = drift(result.pet.traitVector, expectation.key);
      const minDrift = expectation.minDrift ?? 0;
      const passed = expectation.direction === 'up'
        ? actualDrift + 1e-9 >= minDrift
        : actualDrift - 1e-9 <= -minDrift;
      assert.equal(
        passed,
        true,
        `${archetype.name}: expected ${expectation.key} ${expectation.direction} by at least ${minDrift}, got ${actualDrift}\n${describeScenario(result)}`,
      );
    }
  }

  const formed = new Set(results.map(({ result }) => result.pet.personality));
  assert.equal(formed.size >= 5, true, JSON.stringify(
    results.map(({ archetype, result }) => ({
      archetype: archetype.name,
      personality: result.pet.personality,
      top: result.top.slice(0, 4).map(candidate => candidate.id),
      vector: result.pet.traitVector,
    })),
    null,
    2,
  ));
});

await testAsync('post-formation behavior can trigger and accept stable evolution', async () => {
  const result = await runPostFormationEvolutionScenario('evolve-drowsy-to-adventure', 'drowsy', [
    { type: 'equip_room', roomId: 'garden' },
    { type: 'item', itemId: 'magic_wand' },
    { type: 'play', stats: { happiness: 35, energy: 80 } },
    { type: 'feed', stats: { hunger: 20 } },
  ]);

  assert.equal(
    result.pet.evolutionHistory.length > 0,
    true,
    `expected accepted evolution after stable post-formation behavior\n${describeScenario(result)}`,
  );
  const evolution = result.pet.evolutionHistory.at(-1);
  assert.equal(evolution?.fromPersonalityId, 'drowsy');
  assert.equal(['adventurer', 'sage', 'chaotic', 'bold'].includes(evolution?.toPersonalityId ?? ''), true, JSON.stringify({
    evolution,
    top: result.top.slice(0, 5).map(candidate => candidate.id),
    vector: result.pet.traitVector,
  }, null, 2));
  assert.equal(result.pet.personality, evolution?.toPersonalityId);
  assert.equal(result.pet.evolutionProposal, undefined);
  assert.equal(result.pet.ticksInTargetZone, 0);
});

await testAsync('stable evolution window is reachable in long-running command lifecycle', async () => {
  const result = await runPostFormationEvolutionScenario('stable-window-drowsy-to-adventure', 'drowsy', [
    { type: 'equip_room', roomId: 'garden' },
    { type: 'item', itemId: 'magic_wand' },
    { type: 'play', stats: { happiness: 35, energy: 80 } },
    { type: 'feed', stats: { hunger: 20 } },
  ]);

  const evolution = result.pet.evolutionHistory.at(-1);
  assert.equal(evolution?.fromPersonalityId, 'drowsy', JSON.stringify({
    history: result.pet.evolutionHistory,
    top: result.top.slice(0, 5).map(candidate => candidate.id),
    vector: result.pet.traitVector,
    targetTicksBeforeAccept: STABILITY_SYNCS,
  }, null, 2));
  assert.equal(['adventurer', 'sage', 'chaotic', 'bold'].includes(evolution?.toPersonalityId ?? ''), true);
});
