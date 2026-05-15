import assert from 'node:assert/strict';
import type { Pet, PetMood, PetStage } from '../src/api/types';
import type { BehavioralCounters, MoodSnapshot, TraitVector } from '../src/personality/types';
import type { PetCommand } from '@zdesagochi/personality-core';
import { applyPersonalityCommand } from '../src/personality/commandHandlers';
import { createDefaultCounters } from '../src/personality/PersonalityEngine';
import {
  createInitialTraitVector,
  FORMATION_THRESHOLD,
} from '../src/personality/TraitEvolutionEngine';
import { PERSONALITIES } from '@zdesagochi/personality-pet-preset';

const START = '2026-05-04T00:00:00.000Z';
const TRAIT_KEYS = ['vitality', 'sociality', 'order', 'appetite', 'caution', 'curiosity'] as const;

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: 'invariant-pet',
    name: 'Invariant',
    stage: 'baby' as PetStage,
    mood: 'happy' as PetMood,
    stats: { hunger: 80, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
    ageHours: 3,
    level: 1,
    xp: 0,
    xpToNext: 100,
    isAsleep: false,
    color: '#fff',
    equippedRoomId: 'default',
    createdAt: START,
    lastUpdated: START,
    personality: 'playful',
    behavioralFlags: [],
    emergentState: null,
    emergentStateEnteredAt: undefined,
    stateLayers: {},
    behavioralCounters: createDefaultCounters({ now: new Date(START), rng: () => 0.42 }) as BehavioralCounters,
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
    console.log(`ok - invariant: ${name}`);
  } catch (error) {
    console.error(`not ok - invariant: ${name}`);
    throw error;
  }
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`ok - invariant: ${name}`);
  } catch (error) {
    console.error(`not ok - invariant: ${name}`);
    throw error;
  }
}

function at(hours: number): string {
  return new Date(new Date(START).getTime() + hours * 3_600_000).toISOString();
}

function buildFormationCommand(type: PetCommand['type'], index: number, timestamp: string): PetCommand {
  const commandId = `invariant-${type}-${index}`;
  switch (type) {
    case 'feed':
      return { type, foodId: 'apple', foodEffect: { hungerRestore: 20, happinessBonus: 5, healthBonus: 10 }, at: timestamp, commandId };
    case 'play':
      return { type, scoreSeed: '150', at: timestamp, commandId };
    case 'use_item':
      return { type, itemId: index % 2 === 0 ? 'magic_wand' : 'puzzle', itemKind: 'toy', itemEffect: { happiness: 5, xp: 5 }, at: timestamp, commandId };
    case 'sleep':
    case 'wake':
    case 'bathe':
    case 'heal':
    case 'bond':
    case 'sync':
      return { type, at: timestamp, commandId } as PetCommand;
    default:
      throw new Error(`Unsupported invariant command: ${type}`);
  }
}

function buildFormationHistory(days = 30): PetCommand[] {
  const commands: PetCommand[] = [];
  let index = 0;
  for (let day = 0; day < days; day++) {
    const base = day * 24;
    commands.push(buildFormationCommand('feed', index++, at(base + 1)));
    commands.push(buildFormationCommand('play', index++, at(base + 2)));
    commands.push(buildFormationCommand('bathe', index++, at(base + 3)));
    commands.push(buildFormationCommand('heal', index++, at(base + 4)));
    commands.push(buildFormationCommand('bond', index++, at(base + 5)));
    commands.push(buildFormationCommand('use_item', index++, at(base + 6)));
    commands.push(buildFormationCommand('sync', index++, at(base + 23)));
  }
  return commands;
}

async function runHistory(initialPersonality: string, commands: PetCommand[]): Promise<Pet> {
  let pet = makePet({ personality: initialPersonality });
  let influenceCooldowns = {};
  let currentSync = 0;

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

  return pet;
}

function roundedVector(vector: TraitVector): string {
  return TRAIT_KEYS.map(key => `${key}:${vector[key].toFixed(8)}`).join('|');
}

test('skin ids map to at most one personality', () => {
  const owners = new Map<string, string>();
  const duplicates: string[] = [];

  for (const personality of PERSONALITIES) {
    for (const skinId of personality.linkedSkinIds) {
      const owner = owners.get(skinId);
      if (owner) {
        duplicates.push(`${skinId}: ${owner}, ${personality.id}`);
      } else {
        owners.set(skinId, personality.id);
      }
    }
  }

  assert.deepEqual(duplicates, []);
});

await testAsync('pre-formation sync is label-invariant for every personality id', async () => {
  const initialVector = createInitialTraitVector();
  for (const personality of PERSONALITIES) {
    const pet = makePet({
      personality: personality.id,
      formationComplete: false,
      traitVector: { ...initialVector },
      lastUpdated: '2026-05-04T00:00:00.000Z',
    });
    const result = await applyPersonalityCommand(pet, {
      type: 'sync',
      at: '2026-05-04T01:00:00.000Z',
      commandId: `invariant-preformation-sync-${personality.id}`,
    }, {
      currentSync: 1,
      rng: () => 0.42,
    });

    assert.deepEqual(result.pet.traitVector, initialVector, personality.id);
    assert.equal(result.pet.evolutionProposal, undefined, personality.id);
    assert.equal(result.pet.currentTargetZone, null, personality.id);
  }
});

await testAsync('pre-formation personality_is intensity rules are ignored', async () => {
  const command: PetCommand = {
    type: 'bond',
    at: '2026-05-04T01:00:00.000Z',
    commandId: 'invariant-bond-preformation',
  };

  const playful = await applyPersonalityCommand(makePet({ personality: 'playful' }), command, {
    currentSync: 1,
    rng: () => 0.42,
  });
  const empath = await applyPersonalityCommand(makePet({ personality: 'empath' }), command, {
    currentSync: 1,
    rng: () => 0.42,
  });

  assert.equal(roundedVector(empath.pet.traitVector), roundedVector(playful.pet.traitVector));
});

await testAsync('same formation history forms the same personality regardless of placeholder label', async () => {
  const history = buildFormationHistory();
  const results = await Promise.all(PERSONALITIES.map(personality => runHistory(personality.id, history)));
  const formed = results.map((pet, index) => ({
    initial: PERSONALITIES[index].id,
    formed: pet.personality,
    complete: pet.formationComplete,
    progress: pet.formationProgress,
    vector: roundedVector(pet.traitVector),
  }));

  assert.equal(formed.every(result => result.complete), true, JSON.stringify(formed, null, 2));
  assert.equal(new Set(formed.map(result => result.formed)).size, 1, JSON.stringify(formed, null, 2));
  assert.equal(new Set(formed.map(result => result.vector)).size, 1, JSON.stringify(formed, null, 2));
});

await testAsync('formation progress never exceeds configured threshold', async () => {
  const pet = await runHistory('playful', buildFormationHistory(60));
  assert.equal(pet.formationComplete, true);
  assert.equal(pet.formationProgress, FORMATION_THRESHOLD);
});
