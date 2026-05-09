import assert from 'node:assert/strict';
import type { Account, Pet, PetStage, PetMood } from '../src/api/types';
import {
  MockApiService,
  advanceMockTime,
  clearMockOfflineRuntimeState,
  getMockTimeScale,
  setMockOfflineStorage,
  setMockTimeScale,
} from '../src/api/mockApi';
import type { BehavioralCounters, MoodSnapshot, TraitVector } from '../src/personality/types';
import {
  applyActionModifiers,
  computeEmergentState,
  createDefaultCounters,
  isActionBlocked,
  runPatternEngine,
  updateCounters,
} from '../src/personality/PersonalityEngine';
import {
  DAILY_BUDGET,
  FORMATION_THRESHOLD,
  HYSTERESIS,
  MEMORY_COOLDOWN_MS,
  MINIMUM_RESET_SLEEP_HOURS,
  REGRESSION_RATE,
  SINGULARITY_THRESHOLD_SYNCS,
  STABILITY_SYNCS,
  VARIANCE_HARD_RESET_HOURS,
  VOID_THRESHOLD_SYNCS,
  acceptEvolution,
  addCoreMemory,
  addCatharsisProgress,
  applyInfluence,
  applyRegression,
  canApplyInfluenceAtSync,
  canApplyInfluence,
  checkShadowForm,
  checkVarianceHardReset,
  checkThresholdCrossings,
  checkEvolution,
  checkWeeklyDrift,
  collapseSingularity,
  createInitialTraitVector,
  detectSingularity,
  depthOfImmersion,
  getDynamicRadius,
  handleVoidState,
  onStartSleep,
  onWakeFromSleep,
  recordDailyTraitSnapshot,
  recordLegacy,
  rejectEvolution,
} from '../src/personality/TraitEvolutionEngine';
import { getEmergentStateDef } from '../src/personality/emergentStates';
import { validateBalancePatch, validateInfluenceRegistry, validateRemoteInfluence } from '../src/personality/influenceRegistry';
import { PATTERN_RULES, validatePatternRules } from '../src/personality/patternRules';
import { getPersonality } from '../src/personality/personalities';
import { setLayeredEmergentState } from '../src/personality/stateLayers';
import { PERSONALITY_TRAIT_MAP } from '../src/personality/personalityTraitMap';
import {
  PERSONALITY_ENGINE_VERSION,
  STATIC_REGISTRY_VERSION,
  applyPersonalityCommand,
  appendOfflineCommand,
  createOfflinePetSave,
  deleteOfflinePetSave,
  getUnsyncedCommands,
  loadOfflinePetSave,
  markCommandsSynced,
  replayPersonalityCommands,
  saveOfflinePetSave,
  trySaveOfflinePetSave,
  type OfflineKeyValueStorage,
  type PetCommand,
} from '../src/personality';

function makePet(overrides: Partial<Pet> = {}): Pet {
  const now = '2026-05-04T00:00:00.000Z';

  return {
    id: 'test-pet',
    name: 'Test',
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
    createdAt: now,
    lastUpdated: now,
    personality: 'playful',
    behavioralFlags: [],
    emergentState: null,
    emergentStateEnteredAt: undefined,
    stateLayers: {},
    behavioralCounters: createDefaultCounters() as BehavioralCounters,
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
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const testMemoryGenerator = {
  async generate(): Promise<string> {
    return 'Тестовая память';
  },
};

function closeTo(actual: number, expected: number, epsilon = 1e-9): void {
  assert.equal(Math.abs(actual - expected) <= epsilon, true, `${actual} !== ${expected}`);
}

function interpolateVector(from: TraitVector, to: TraitVector, t: number): TraitVector {
  return Object.fromEntries(
    Object.keys(from).map(key => {
      const trait = key as keyof TraitVector;
      return [trait, from[trait] + (to[trait] - from[trait]) * t];
    }),
  ) as TraitVector;
}

function makeMemoryStorage(initial: Record<string, string> = {}): OfflineKeyValueStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

test('dynamic radius follows age brackets', () => {
  assert.equal(getDynamicRadius('playful', 0), 22);
  assert.equal(getDynamicRadius('playful', 10 * 24), 25);
  assert.equal(getDynamicRadius('playful', 40 * 24), 29);
  assert.equal(getDynamicRadius('playful', 100 * 24), 33);
});

test('depth of immersion is 1 at personality center', () => {
  const vector = PERSONALITY_TRAIT_MAP.bold.position;
  assert.equal(depthOfImmersion(vector, 'bold', 3), 1);
});

test('offline save captures snapshot with engine and registry versions', () => {
  const pet = makePet();
  const save = createOfflinePetSave(pet, '2026-05-04T00:00:00.000Z');

  assert.equal(save.petSnapshot.id, pet.id);
  assert.deepEqual(save.commandLog, []);
  assert.equal(save.lastSyncedCommandId, null);
  assert.deepEqual(save.influenceCooldowns, {});
  assert.equal(save.engineVersion, PERSONALITY_ENGINE_VERSION);
  assert.equal(save.registryVersion, STATIC_REGISTRY_VERSION);
  assert.equal(save.savedAt, '2026-05-04T00:00:00.000Z');
});

test('offline command log is idempotent by commandId', () => {
  const command: PetCommand = {
    type: 'feed',
    foodId: 'apple',
    at: '2026-05-04T01:00:00.000Z',
    commandId: 'cmd-feed-1',
  };
  const initial = createOfflinePetSave(makePet(), '2026-05-04T00:00:00.000Z');
  const appended = appendOfflineCommand(initial, command);
  const duplicate = appendOfflineCommand(appended, {
    ...command,
    at: '2026-05-04T01:05:00.000Z',
  });

  assert.equal(appended.commandLog.length, 1);
  assert.equal(appended.savedAt, command.at);
  assert.equal(duplicate, appended);
  assert.equal(duplicate.commandLog.length, 1);
});

test('offline sync window returns commands after last synced id', () => {
  const commands: PetCommand[] = [
    { type: 'feed', foodId: 'apple', at: '2026-05-04T01:00:00.000Z', commandId: 'cmd-1' },
    { type: 'play', scoreSeed: 'seed-1', at: '2026-05-04T02:00:00.000Z', commandId: 'cmd-2' },
    { type: 'bond', at: '2026-05-04T03:00:00.000Z', commandId: 'cmd-3' },
  ];
  let save = createOfflinePetSave(makePet(), '2026-05-04T00:00:00.000Z');
  for (const command of commands) save = appendOfflineCommand(save, command);

  assert.deepEqual(getUnsyncedCommands(save).map(command => command.commandId), ['cmd-1', 'cmd-2', 'cmd-3']);

  save = markCommandsSynced(save, 'cmd-2');
  assert.equal(save.lastSyncedCommandId, 'cmd-2');
  assert.deepEqual(getUnsyncedCommands(save).map(command => command.commandId), ['cmd-3']);

  const unchanged = markCommandsSynced(save, 'cmd-missing');
  assert.equal(unchanged, save);
});

test('offline command log can be compacted before persistence', () => {
  let save = createOfflinePetSave(makePet(), '2026-05-04T00:00:00.000Z');
  for (let i = 0; i < 300; i++) {
    save = appendOfflineCommand(save, {
      type: 'sync',
      at: `2026-05-04T00:${String(i % 60).padStart(2, '0')}:00.000Z`,
      commandId: `cmd-${i}`,
    });
  }

  const compacted = createOfflinePetSave(save.petSnapshot, '2026-05-04T01:00:00.000Z', {
    commandLog: save.commandLog.slice(-250),
  });

  assert.equal(compacted.commandLog.length, 250);
  assert.equal(compacted.commandLog[0]?.commandId, 'cmd-50');
  assert.equal(compacted.commandLog.at(-1)?.commandId, 'cmd-299');
});

test('offline storage saves loads and deletes valid saves', () => {
  const storage = makeMemoryStorage();
  const save = createOfflinePetSave(makePet(), '2026-05-04T00:00:00.000Z', {
    influenceCooldowns: { 'action:bond': 7 },
  });

  saveOfflinePetSave(storage, save);
  const loaded = loadOfflinePetSave(storage);

  assert.equal(loaded.ok, true);
  if (loaded.ok) {
    assert.equal(loaded.save.petSnapshot.id, save.petSnapshot.id);
    assert.equal(loaded.save.influenceCooldowns['action:bond'], 7);
    assert.equal(loaded.save.engineVersion, PERSONALITY_ENGINE_VERSION);
  }

  deleteOfflinePetSave(storage);
  assert.deepEqual(loadOfflinePetSave(storage), { ok: false, reason: 'missing' });
});

test('offline storage reports quota exceeded without throwing through safe save', () => {
  const quotaStorage: OfflineKeyValueStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new DOMException('quota', 'QuotaExceededError');
    },
    removeItem() {},
  };

  const result = trySaveOfflinePetSave(
    quotaStorage,
    createOfflinePetSave(makePet(), '2026-05-04T00:00:00.000Z'),
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'quota_exceeded');
});

test('offline storage reports invalid json and invalid shape without throwing', () => {
  const badJsonStorage = makeMemoryStorage({
    'zdesagochi:offline-pet-save:v1': '{bad json',
  });
  assert.deepEqual(loadOfflinePetSave(badJsonStorage), { ok: false, reason: 'invalid_json' });

  const badShapeStorage = makeMemoryStorage({
    'zdesagochi:offline-pet-save:v1': JSON.stringify({
      petSnapshot: {},
      commandLog: [],
      lastSyncedCommandId: null,
      influenceCooldowns: { 'action:bond': 'not-a-number' },
      engineVersion: PERSONALITY_ENGINE_VERSION,
      registryVersion: STATIC_REGISTRY_VERSION,
      savedAt: '2026-05-04T00:00:00.000Z',
    }),
  });
  assert.deepEqual(loadOfflinePetSave(badShapeStorage), { ok: false, reason: 'invalid_shape' });
});

test('pattern rule params validate against supported evaluator semantics', () => {
  validatePatternRules(PATTERN_RULES);
  assert.throws(() => validatePatternRules([{
    id: 'bad_rule',
    description: 'bad',
    conditions: [
      { type: 'action_in_stat_zone', params: { action: 'bond', zone: 'high', threshold: 1 } },
    ],
    effect: { flagType: 'trust_bond', action: 'activate' },
  }]), /unsupported/);
});

test('perfect_balance requires every stat above threshold, not only average streak', () => {
  let counters = createDefaultCounters({
    now: new Date('2026-05-01T10:00:00.000Z'),
    rng: () => 0.1,
  }) as BehavioralCounters;
  counters.consecutiveGoodSyncs = 10;

  counters = updateCounters(
    counters,
    'sync',
    { hunger: 100, happiness: 100, energy: 100, health: 100, cleanliness: 100, bond: 20 },
    { clientLocalHour: 10, coinBalance: 0, now: new Date('2026-05-01T10:00:00.000Z'), rng: () => 0.1 },
  ) as BehavioralCounters;
  counters.consecutiveGoodSyncs = 10;

  let flags = runPatternEngine(
    counters,
    [],
    getPersonality('sage'),
    { now: new Date('2026-05-01T10:00:00.000Z'), rng: () => 0.1 },
  );
  assert.equal(flags.some(flag => flag.type === 'perfect_balance'), false);

  counters = updateCounters(
    counters,
    'sync',
    { hunger: 71, happiness: 72, energy: 73, health: 74, cleanliness: 75, bond: 76 },
    { clientLocalHour: 10, coinBalance: 0, now: new Date('2026-05-01T11:00:00.000Z'), rng: () => 0.1 },
  ) as BehavioralCounters;
  counters.consecutiveGoodSyncs = 10;

  flags = runPatternEngine(
    counters,
    [],
    getPersonality('sage'),
    { now: new Date('2026-05-01T11:00:00.000Z'), rng: () => 0.1 },
  );
  assert.equal(flags.some(flag => flag.type === 'perfect_balance'), true);
});

test('stoic_peak and enlightenment set one-shot guards when entered', () => {
  const stoicCounters = createDefaultCounters({
    now: new Date('2026-05-01T10:00:00.000Z'),
    rng: () => 0.1,
  }) as BehavioralCounters;
  stoicCounters.consecutiveGoodSyncs = 10;
  const stoicState = computeEmergentState(
    { hunger: 80, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
    getPersonality('stoic'),
    [],
    stoicCounters,
    { clientLocalHour: 10, sessionGapHours: 0, coinBalance: 0, now: new Date('2026-05-01T10:00:00.000Z'), rng: () => 0.1 },
    null,
    undefined,
  );
  assert.equal(stoicState, 'stoic_peak');
  assert.equal(stoicCounters.stoicPeakUsed, true);

  const sageCounters = createDefaultCounters({
    now: new Date('2026-05-01T10:00:00.000Z'),
    rng: () => 0.1,
  }) as BehavioralCounters;
  sageCounters.consecutiveGoodSyncs = 7 * 24;
  const sageState = computeEmergentState(
    { hunger: 80, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
    getPersonality('sage'),
    [],
    sageCounters,
    { clientLocalHour: 10, sessionGapHours: 0, coinBalance: 0, now: new Date('2026-05-01T10:00:00.000Z'), rng: () => 0.1 },
    null,
    undefined,
  );
  assert.equal(sageState, 'enlightenment');
  assert.equal(sageCounters.enlightenmentActive, true);
  assert.equal(sageCounters.enlightenmentStart, '2026-05-01T10:00:00.000Z');
});

test('feast_frenzy uses three feedings in the last hour, not play count', () => {
  let counters = createDefaultCounters({
    now: new Date('2026-05-01T10:00:00.000Z'),
    rng: () => 0.1,
  }) as BehavioralCounters;

  for (let play = 0; play < 3; play++) {
    counters = updateCounters(
      counters,
      'play',
      { hunger: 80, happiness: 95, energy: 80, health: 80, cleanliness: 80, bond: 80 },
      { clientLocalHour: 10, coinBalance: 0, now: new Date(`2026-05-01T10:0${play}:00.000Z`), rng: () => 0.1 },
    ) as BehavioralCounters;
  }

  let state = computeEmergentState(
    { hunger: 80, happiness: 95, energy: 80, health: 80, cleanliness: 80, bond: 80 },
    getPersonality('foodie'),
    [],
    counters,
    { clientLocalHour: 10, sessionGapHours: 0, coinBalance: 0, now: new Date('2026-05-01T10:10:00.000Z'), rng: () => 0.1 },
    null,
    undefined,
  );
  assert.equal(state, null);

  for (let feed = 0; feed < 3; feed++) {
    counters = updateCounters(
      counters,
      'feed',
      { hunger: 80, happiness: 95, energy: 80, health: 80, cleanliness: 80, bond: 80 },
      {
        foodId: `food-${feed}`,
        clientLocalHour: 10,
        coinBalance: 0,
        now: new Date(`2026-05-01T10:${20 + feed}:00.000Z`),
        rng: () => 0.1,
      },
    ) as BehavioralCounters;
  }

  state = computeEmergentState(
    { hunger: 80, happiness: 95, energy: 80, health: 80, cleanliness: 80, bond: 80 },
    getPersonality('foodie'),
    [],
    counters,
    { clientLocalHour: 10, sessionGapHours: 0, coinBalance: 0, now: new Date('2026-05-01T10:30:00.000Z'), rng: () => 0.1 },
    null,
    undefined,
  );
  assert.equal(state, 'feast_frenzy');

  state = computeEmergentState(
    { hunger: 80, happiness: 95, energy: 80, health: 80, cleanliness: 80, bond: 80 },
    getPersonality('foodie'),
    [],
    counters,
    { clientLocalHour: 11, sessionGapHours: 0, coinBalance: 0, now: new Date('2026-05-01T11:23:01.000Z'), rng: () => 0.1 },
    null,
    undefined,
  );
  assert.equal(state, null);
});

test('pattern counters materialize seven day rolling action windows', () => {
  let counters = createDefaultCounters({
    now: new Date('2026-05-01T10:00:00.000Z'),
    rng: () => 0.1,
  }) as BehavioralCounters;

  for (let day = 1; day <= 5; day++) {
    counters = updateCounters(
      counters,
      'feed',
      { hunger: 10, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
      {
        foodId: 'apple',
        clientLocalHour: 10,
        coinBalance: 0,
        now: new Date(`2026-05-0${day}T10:00:00.000Z`),
        rng: () => 0.1,
      },
    ) as BehavioralCounters;
  }

  let flags = runPatternEngine(
    counters,
    [],
    getPersonality('playful'),
    { now: new Date('2026-05-05T10:00:00.000Z'), rng: () => 0.1 },
  );
  assert.equal(counters.feedInRedZone7d, 5);
  assert.equal(flags.some(flag => flag.type === 'food_anxiety'), true);

  counters = updateCounters(
    counters,
    'sync',
    { hunger: 80, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
    {
      clientLocalHour: 10,
      coinBalance: 0,
      now: new Date('2026-05-08T10:00:00.000Z'),
      rng: () => 0.1,
    },
  ) as BehavioralCounters;
  flags = runPatternEngine(
    counters,
    [],
    getPersonality('playful'),
    { now: new Date('2026-05-08T10:00:00.000Z'), rng: () => 0.1 },
  );

  assert.equal(counters.feedInRedZone7d, 4);
  assert.equal(flags.some(flag => flag.type === 'food_anxiety'), false);
});

test('pattern counters compute high play streak from rolling day buckets', () => {
  let counters = createDefaultCounters({
    now: new Date('2026-05-01T10:00:00.000Z'),
    rng: () => 0.1,
  }) as BehavioralCounters;

  for (let day = 1; day <= 3; day++) {
    for (let play = 0; play < 9; play++) {
      counters = updateCounters(
        counters,
        'play',
        { hunger: 80, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
        {
          clientLocalHour: 10,
          coinBalance: 0,
          now: new Date(`2026-05-0${day}T10:${String(play).padStart(2, '0')}:00.000Z`),
          rng: () => 0.1,
        },
      ) as BehavioralCounters;
    }
  }

  const flags = runPatternEngine(
    counters,
    [],
    getPersonality('playful'),
    { now: new Date('2026-05-03T23:00:00.000Z'), rng: () => 0.1 },
  );

  assert.equal(counters.currentHighPlayDays, 3);
  assert.equal(counters.maxConsecHighPlayDays, 3);
  assert.equal(flags.some(flag => flag.type === 'play_burnout'), true);
});

test('pattern same_food_ratio uses rolling seven day food buckets', () => {
  let counters = createDefaultCounters({
    now: new Date('2026-05-01T10:00:00.000Z'),
    rng: () => 0.1,
  }) as BehavioralCounters;

  for (let day = 1; day <= 5; day++) {
    counters = updateCounters(
      counters,
      'feed',
      { hunger: 50, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
      {
        foodId: 'apple',
        clientLocalHour: 10,
        coinBalance: 0,
        now: new Date(`2026-05-0${day}T10:00:00.000Z`),
        rng: () => 0.1,
      },
    ) as BehavioralCounters;
  }

  let flags = runPatternEngine(
    counters,
    [],
    getPersonality('adventurer'),
    { now: new Date('2026-05-05T10:00:00.000Z'), rng: () => 0.1 },
  );
  assert.equal(flags.some(flag => flag.type === 'food_monotony'), true);

  counters = updateCounters(
    counters,
    'feed',
    { hunger: 50, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
    {
      foodId: 'salad',
      clientLocalHour: 10,
      coinBalance: 0,
      now: new Date('2026-05-08T10:00:00.000Z'),
      rng: () => 0.1,
    },
  ) as BehavioralCounters;
  flags = runPatternEngine(
    counters,
    [],
    getPersonality('adventurer'),
    { now: new Date('2026-05-08T10:00:00.000Z'), rng: () => 0.1 },
  );

  assert.equal(flags.some(flag => flag.type === 'food_monotony'), false);
});

test('pattern night_single uses consecutive rolling night interaction days', () => {
  let counters = createDefaultCounters({
    now: new Date('2026-05-01T01:00:00.000Z'),
    rng: () => 0.1,
  }) as BehavioralCounters;

  for (let day = 1; day <= 7; day++) {
    counters = updateCounters(
      counters,
      'bond',
      { hunger: 80, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
      {
        clientLocalHour: 1,
        coinBalance: 0,
        now: new Date(`2026-05-0${day}T01:00:00.000Z`),
        rng: () => 0.1,
      },
    ) as BehavioralCounters;
  }

  const nightGuardianPersonality = {
    ...getPersonality('drowsy'),
    possibleFlags: [...getPersonality('drowsy').possibleFlags, 'night_guardian' as const],
  };
  let flags = runPatternEngine(
    counters,
    [],
    nightGuardianPersonality,
    { now: new Date('2026-05-07T23:00:00.000Z'), rng: () => 0.1 },
  );

  assert.equal(counters.nightSingleInteractionDays7d, 7);
  assert.equal(flags.some(flag => flag.type === 'night_guardian'), true);

  counters = updateCounters(
    counters,
    'play',
    { hunger: 80, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
    {
      clientLocalHour: 1,
      coinBalance: 0,
      now: new Date('2026-05-07T01:30:00.000Z'),
      rng: () => 0.1,
    },
  ) as BehavioralCounters;
  flags = runPatternEngine(
    counters,
    [],
    nightGuardianPersonality,
    { now: new Date('2026-05-07T23:00:00.000Z'), rng: () => 0.1 },
  );

  assert.equal(counters.nightSingleInteractionDays7d, 0);
  assert.equal(flags.some(flag => flag.type === 'night_guardian'), false);
});

await testAsync('personality command feed applies exact trait deltas without mutating input pet', async () => {
  const pet = makePet({ formationComplete: true });
  const result = await applyPersonalityCommand(pet, {
    type: 'feed',
    foodId: 'apple',
    at: '2026-05-04T01:00:00.000Z',
    commandId: 'cmd-feed-core',
  });

  assert.equal(pet.traitVector.appetite, 50);
  assert.equal(pet.traitVector.sociality, 50);
  closeTo(result.pet.traitVector.appetite, 50 + 2 * 0.08);
  closeTo(result.pet.traitVector.sociality, 50 + 0.5 * 0.08);
  assert.equal(result.pet.dailyTraitBudget.appetite, 2);
  assert.equal(result.pet.dailyTraitBudget.sociality, 0.5);
  assert.equal(result.pet.dailyVectorVariance, 2.5);
  assert.equal(result.events.some(event => event.type === 'trait_vector_changed'), true);
  assert.equal(result.engineVersion, PERSONALITY_ENGINE_VERSION);
  assert.equal(result.registryVersion, STATIC_REGISTRY_VERSION);
});

await testAsync('personality command use_item food falls back to feed influence when item influence is missing', async () => {
  const pet = makePet({ formationComplete: true });
  const result = await applyPersonalityCommand(pet, {
    type: 'use_item',
    itemId: 'premium_burger',
    itemKind: 'food',
    at: '2026-05-04T01:00:00.000Z',
    commandId: 'cmd-use-food-fallback',
  });

  closeTo(result.pet.traitVector.appetite, 50 + 2 * 0.08);
  closeTo(result.pet.traitVector.sociality, 50 + 0.5 * 0.08);
  closeTo(result.pet.traitVector.curiosity, 50);
  assert.equal(result.influenceCooldowns['action:feed'], 0);
  assert.equal(result.influenceCooldowns['item:premium_burger'], undefined);
  assert.equal(result.events.filter(event => event.type === 'trait_vector_changed').length, 1);
});

await testAsync('personality command use_item prefers item influence over food fallback', async () => {
  const pet = makePet({ formationComplete: true });
  const result = await applyPersonalityCommand(pet, {
    type: 'use_item',
    itemId: 'magic_potion',
    itemKind: 'food',
    at: '2026-05-04T01:00:00.000Z',
    commandId: 'cmd-use-food-item-influence',
  });

  closeTo(result.pet.traitVector.curiosity, 50 + 3 * 0.08);
  closeTo(result.pet.traitVector.appetite, 50 + 2 * 0.08);
  closeTo(result.pet.traitVector.sociality, 50);
  assert.equal(result.influenceCooldowns['item:magic_potion'], 0);
  assert.equal(result.influenceCooldowns['action:feed'], undefined);
  assert.equal(result.events.filter(event => event.type === 'trait_vector_changed').length, 1);
});

await testAsync('personality command handler gates influences with serializable cooldown state', async () => {
  const pet = makePet({ formationComplete: true });
  const first = await applyPersonalityCommand(pet, {
    type: 'bond',
    at: '2026-05-04T01:00:00.000Z',
    commandId: 'cmd-bond-1',
  }, {
    currentSync: 10,
  });

  closeTo(first.pet.traitVector.sociality, 50 + 2 * 0.08);
  closeTo(first.pet.traitVector.caution, 50 - 1 * 0.08);
  assert.equal(first.influenceCooldowns['action:bond'], 10);

  const blocked = await applyPersonalityCommand(first.pet, {
    type: 'bond',
    at: '2026-05-04T01:10:00.000Z',
    commandId: 'cmd-bond-2',
  }, {
    currentSync: 10,
    influenceCooldowns: first.influenceCooldowns,
  });

  closeTo(blocked.pet.traitVector.sociality, first.pet.traitVector.sociality);
  closeTo(blocked.pet.traitVector.caution, first.pet.traitVector.caution);
  assert.equal(blocked.pet.dailyVectorVariance, first.pet.dailyVectorVariance);
  const skipped = blocked.events.find(event => event.type === 'influence_cooldown_skipped');
  assert.equal(skipped?.type, 'influence_cooldown_skipped');
  if (skipped?.type === 'influence_cooldown_skipped') {
    assert.equal(skipped.influenceId, 'action:bond');
    assert.equal(skipped.lastAppliedSync, 10);
    assert.equal(skipped.currentSync, 10);
    assert.equal(skipped.cooldownSyncs, 1);
  }

  const afterCooldown = await applyPersonalityCommand(blocked.pet, {
    type: 'bond',
    at: '2026-05-04T02:00:00.000Z',
    commandId: 'cmd-bond-3',
  }, {
    currentSync: 11,
    influenceCooldowns: blocked.influenceCooldowns,
  });

  closeTo(afterCooldown.pet.traitVector.sociality, first.pet.traitVector.sociality + 2 * 0.08);
  closeTo(afterCooldown.pet.traitVector.caution, first.pet.traitVector.caution - 1 * 0.08);
  assert.equal(afterCooldown.influenceCooldowns['action:bond'], 11);
});

await testAsync('personality replay advances sync buckets and preserves cooldown math', async () => {
  const pet = makePet({
    formationComplete: true,
    personality: 'playful',
  });
  const commands: PetCommand[] = [
    { type: 'bond', at: '2026-05-04T01:00:00.000Z', commandId: 'cmd-replay-bond-1' },
    { type: 'bond', at: '2026-05-04T01:10:00.000Z', commandId: 'cmd-replay-bond-2' },
    { type: 'sync', at: '2026-05-04T02:00:00.000Z', commandId: 'cmd-replay-sync-1' },
    { type: 'bond', at: '2026-05-04T02:05:00.000Z', commandId: 'cmd-replay-bond-3' },
  ];

  const result = await replayPersonalityCommands(pet, commands, { initialSync: 0 });

  const socialityAfterFirstBond = 50 + 2 * 0.08;
  const cautionAfterFirstBond = 50 - 1 * 0.08;
  const socialityAfterSync = socialityAfterFirstBond + (PERSONALITY_TRAIT_MAP.playful.position.sociality - socialityAfterFirstBond) * REGRESSION_RATE;
  const cautionAfterSync = cautionAfterFirstBond + (PERSONALITY_TRAIT_MAP.playful.position.caution - cautionAfterFirstBond) * REGRESSION_RATE;

  assert.equal(result.currentSync, 1);
  assert.equal(result.commandResults.length, 4);
  assert.equal(result.influenceCooldowns['action:bond'], 1);
  closeTo(result.pet.traitVector.sociality, socialityAfterSync + 2 * 0.08);
  closeTo(result.pet.traitVector.caution, cautionAfterSync - 1 * 0.08);
  assert.equal(result.pet.dailyVectorVariance, 6);
  assert.equal(result.pet.dailyTraitBudget.sociality, 2);
  assert.equal(result.pet.dailyTraitBudget.caution, 1);
  assert.equal(result.events.filter(event => event.type === 'influence_cooldown_skipped').length, 1);
  assert.equal(result.commandResults[1]?.events.some(event => event.type === 'trait_vector_changed'), false);
  assert.equal(result.commandResults[3]?.events.some(event => event.type === 'trait_vector_changed'), true);
});

await testAsync('personality command handler owns gameplay counters without inflating sync streaks on actions', async () => {
  const pet = makePet({
    formationComplete: true,
    personality: 'foodie',
    stats: { hunger: 80, happiness: 95, energy: 80, health: 80, cleanliness: 80, bond: 80 },
  });
  const commands: PetCommand[] = [
    { type: 'feed', foodId: 'apple', at: '2026-05-04T01:00:00.000Z', commandId: 'cmd-gameplay-feed-1' },
    { type: 'feed', foodId: 'salad', at: '2026-05-04T01:10:00.000Z', commandId: 'cmd-gameplay-feed-2' },
    { type: 'feed', foodId: 'soup', at: '2026-05-04T01:20:00.000Z', commandId: 'cmd-gameplay-feed-3' },
  ];

  const result = await replayPersonalityCommands(pet, commands, { initialSync: 0 });

  assert.equal(result.pet.behavioralCounters.dailyFoodLog.apple, 1);
  assert.equal(result.pet.behavioralCounters.dailyFoodLog.salad, 1);
  assert.equal(result.pet.behavioralCounters.dailyFoodLog.soup, 1);
  assert.equal(result.pet.behavioralCounters.recentFeedTimestamps?.length, 3);
  assert.equal(result.pet.behavioralCounters.consecutiveGoodSyncs, 0);
  assert.equal(result.pet.moodHistory.length, 0);
  assert.equal(result.pet.stateLayers?.gameplay?.some(state => state.type === 'feast_frenzy'), true);
  assert.equal(result.pet.emergentState, 'feast_frenzy');
});

await testAsync('personality command sync applies gameplay decay mood history and pattern flags', async () => {
  const pet = makePet({
    formationComplete: true,
    personality: 'playful',
    lastUpdated: '2026-05-04T00:00:00.000Z',
    stats: { hunger: 80, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
  });

  const result = await applyPersonalityCommand(pet, {
    type: 'sync',
    at: '2026-05-04T00:10:00.000Z',
    commandId: 'cmd-gameplay-sync',
  });

  assert.equal(result.pet.lastUpdated, '2026-05-04T00:10:00.000Z');
  assert.equal(result.pet.stats.hunger < 80, true);
  assert.equal(result.pet.moodHistory.length, 1);
  assert.equal(result.pet.behavioralCounters.consecutiveGoodSyncs, 1);
  assert.equal(result.pet.behavioralCounters.lastStatsSnapshot?.hunger !== undefined, true);
});

await testAsync('personality command replay uses deterministic rng for singularity collapse', async () => {
  const pet = makePet({
    formationComplete: true,
    personality: 'playful',
    traitVector: {
      vitality: 0,
      sociality: 0,
      order: 0,
      appetite: 0,
      caution: 0,
      curiosity: 0,
    },
    ticksInSingularity: 3,
    singularityZones: ['playful', 'bold', 'sage'],
  });
  const command: PetCommand = {
    type: 'sync',
    at: '2026-05-04T02:00:00.000Z',
    commandId: 'cmd-singularity-collapse',
  };

  const first = await applyPersonalityCommand(pet, command, { currentSync: 1 });
  const second = await applyPersonalityCommand(pet, command, { currentSync: 1 });

  assert.equal(first.pet.personality, second.pet.personality);
  assert.equal(first.pet.evolutionHistory.at(-1)?.trigger, 'singularity');
  assert.equal(second.pet.evolutionHistory.at(-1)?.trigger, 'singularity');
});

await testAsync('personality command forced sleep records sleep start and exact forced sleep influence', async () => {
  const pet = makePet({
    formationComplete: true,
    stats: { hunger: 80, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
  });

  const result = await applyPersonalityCommand(pet, {
    type: 'sleep',
    at: '2026-05-04T02:00:00.000Z',
    commandId: 'cmd-sleep-forced',
  });

  assert.equal(result.pet.sleepStartedAt, '2026-05-04T02:00:00.000Z');
  closeTo(result.pet.traitVector.vitality, 50 - 2 * 0.08);
  closeTo(result.pet.traitVector.order, 50 - 1 * 0.08);
  closeTo(result.pet.traitVector.caution, 50 + 1 * 0.08);
  assert.equal(result.pet.traumaLevel, 1);
  assert.equal(result.pet.dailyVectorVariance, 4);
  assert.equal(result.events.some(event => event.type === 'sleep_started'), true);
  assert.equal(result.events.some(event => event.type === 'trait_vector_changed'), true);
});

await testAsync('personality command natural wake resets confused only after four hours', async () => {
  const pet = makePet({
    formationComplete: true,
    sleepStartedAt: '2026-05-04T02:00:00.000Z',
    dailyVectorVariance: 30,
    confusedState: true,
  });

  const result = await applyPersonalityCommand(pet, {
    type: 'wake',
    at: '2026-05-04T06:00:00.000Z',
    commandId: 'cmd-wake-natural',
  });

  assert.equal(result.pet.sleepStartedAt, null);
  assert.equal(result.pet.dailyVectorVariance, 0);
  assert.equal(result.pet.confusedState, false);
  assert.equal(result.pet.lastSleepTimestamp, '2026-05-04T06:00:00.000Z');
  const sleepEvent = result.events.find(event => event.type === 'sleep_finished');
  assert.equal(sleepEvent?.type, 'sleep_finished');
  if (sleepEvent?.type === 'sleep_finished') {
    assert.equal(sleepEvent.naturalWake, true);
    assert.equal(sleepEvent.sleptHours, 4);
  }
});

await testAsync('personality command early wake keeps confused variance and applies wake trauma', async () => {
  const pet = makePet({
    formationComplete: true,
    sleepStartedAt: '2026-05-04T02:00:00.000Z',
    dailyVectorVariance: 30,
    confusedState: true,
  });

  const result = await applyPersonalityCommand(pet, {
    type: 'wake',
    at: '2026-05-04T02:30:00.000Z',
    commandId: 'cmd-wake-early',
  });

  assert.equal(result.pet.sleepStartedAt, null);
  assert.equal(result.pet.lastSleepTimestamp, null);
  assert.equal(result.pet.confusedState, true);
  assert.equal(result.pet.dailyVectorVariance, 35);
  assert.equal(result.pet.traumaLevel, 2);
  closeTo(result.pet.traitVector.order, 50 - 2 * 0.08);
  closeTo(result.pet.traitVector.caution, 50 + 2 * 0.08);
  closeTo(result.pet.traitVector.vitality, 50 + 1 * 0.08);
  const sleepEvent = result.events.find(event => event.type === 'sleep_finished');
  if (sleepEvent?.type === 'sleep_finished') {
    assert.equal(sleepEvent.naturalWake, false);
    assert.equal(sleepEvent.sleptHours, 0.5);
  } else {
    assert.fail('sleep_finished event missing');
  }
});

await testAsync('personality command sync applies exact regression and daily snapshot', async () => {
  const pet = makePet({
    formationComplete: true,
    personality: 'playful',
    traitVector: createInitialTraitVector(),
    dailyTraitBudget: { vitality: 3 },
  });

  const result = await applyPersonalityCommand(pet, {
    type: 'sync',
    at: '2026-05-04T05:00:00.000Z',
    commandId: 'cmd-sync-core',
  });

  for (const key of Object.keys(result.pet.traitVector) as Array<keyof TraitVector>) {
    const expected = 50 + (PERSONALITY_TRAIT_MAP.playful.position[key] - 50) * REGRESSION_RATE;
    closeTo(result.pet.traitVector[key], expected);
  }
  assert.equal(result.pet.dailyTraitSnapshots.length, 1);
  assert.equal(result.pet.dailyTraitSnapshots[0]?.date, '2026-05-04');
  assert.deepEqual(result.pet.dailyTraitBudget, {});
  assert.equal(result.events.some(event => event.type === 'trait_vector_changed'), true);
});

test('applyInfluence clamps daily budget and smooths vector', () => {
  const pet = makePet({ dailyTraitBudget: { vitality: 11 } });

  const result = applyInfluence(
    pet,
    {
      id: 'test:large',
      category: 'action',
      label: 'Large',
      traitDeltas: { vitality: 20, curiosity: -20 },
    },
    { getIntensityMultiplier: () => 1 },
  );

  assert.equal(result.budgetedDelta.vitality, 1);
  assert.equal(result.budgetedDelta.curiosity, -DAILY_BUDGET.curiosity);
  assert.equal(pet.dailyTraitBudget.vitality, DAILY_BUDGET.vitality);
  assert.equal(pet.dailyTraitBudget.curiosity, DAILY_BUDGET.curiosity);
  assert.equal(pet.traitVector.vitality, 50.08);
  assert.equal(pet.traitVector.curiosity, 49.2);
  assert.equal(pet.dailyVectorVariance, 11);
  assert.equal(pet.formationProgress, 11);
});

test('applyRegression moves exactly 2 percent toward personality home', () => {
  const pet = makePet({
    personality: 'playful',
    traitVector: createInitialTraitVector(),
  });

  applyRegression(pet);

  for (const key of Object.keys(pet.traitVector) as Array<keyof TraitVector>) {
    const expected = 50 + (PERSONALITY_TRAIT_MAP.playful.position[key] - 50) * REGRESSION_RATE;
    closeTo(pet.traitVector[key], expected);
  }
});

test('applyInfluence applies intensity rules only when conditions match', () => {
  const pet = makePet({
    personality: 'empath',
    formationComplete: true,
    traitVector: {
      vitality: 50,
      sociality: 50,
      order: 50,
      appetite: 50,
      caution: 85,
      curiosity: 30,
    },
    behavioralFlags: [{
      type: 'play_burnout',
      severity: 1,
      activatedAt: '2026-05-04T00:00:00.000Z',
      healProgress: 0,
    }],
  });

  const result = applyInfluence(
    pet,
    {
      id: 'test:intensity',
      category: 'action',
      label: 'Intensity',
      traitDeltas: { vitality: 1 },
      intensityRules: [
        { condition: { type: 'time_of_day', params: { from: 22, to: 6 } }, multiplier: 2 },
        { condition: { type: 'flag_active', params: { flag: 'play_burnout' } }, multiplier: 0.5 },
        { condition: { type: 'personality_is', params: { id: 'empath' } }, multiplier: 1.5 },
        { condition: { type: 'trait_above', params: { key: 'caution', value: 80 } }, multiplier: 0.5 },
        { condition: { type: 'trait_below', params: { key: 'curiosity', value: 40 } }, multiplier: 2 },
        { condition: { type: 'trait_above', params: { key: 'order', value: 80 } }, multiplier: 99 },
      ],
    },
    { clientLocalHour: 23, getIntensityMultiplier: () => 1 },
  );

  // 1 * 2 * 0.5 * 1.5 * 0.5 * 2 = 1.5; non-matching order rule is ignored.
  assert.equal(result.budgetedDelta.vitality, 1.5);
  closeTo(pet.traitVector.vitality, 50 + 1.5 * 0.08);
});

test('applyInfluence blocks registered influence when conditions do not match', () => {
  const pet = makePet({
    formationComplete: false,
    traumaLevel: 10,
  });

  const influence = {
    id: 'test:conditioned',
    category: 'social' as const,
    label: 'Conditioned',
    traitDeltas: { sociality: 2 },
    traumaDelta: 5,
    conditions: [{ type: 'formation_period' as const, params: { active: false } }],
  };

  assert.equal(canApplyInfluence(pet, influence), false);
  const result = applyInfluence(pet, influence, { getIntensityMultiplier: () => 1 });

  assert.equal(result.applied, false);
  assert.equal(result.blockedConditions?.length, 1);
  assert.deepEqual(result.budgetedDelta, {});
  closeTo(pet.traitVector.sociality, 50);
  assert.equal(pet.dailyVectorVariance, 0);
  assert.equal(pet.traumaLevel, 10);
  assert.equal(pet.formationProgress, 0);
});

test('global intensity multiplier scales raw influence before smoothing', () => {
  const pet = makePet({ formationComplete: true });

  const result = applyInfluence(
    pet,
    {
      id: 'test:global',
      category: 'action',
      label: 'Global',
      traitDeltas: { appetite: 4 },
    },
    { getIntensityMultiplier: () => 1.2 },
  );

  assert.equal(result.budgetedDelta.appetite, 4.8);
  closeTo(pet.traitVector.appetite, 50 + 4.8 * 0.08);
});

test('system influence does not advance formation', () => {
  const pet = makePet();

  applyInfluence(
    pet,
    {
      id: 'system:test',
      category: 'system',
      label: 'System',
      traitDeltas: { order: 3 },
    },
    { getIntensityMultiplier: () => 1 },
  );

  assert.equal(pet.formationProgress, 0);
});

test('formation completes at threshold and selects nearest personality', () => {
  const pet = makePet({
    traitVector: { ...PERSONALITY_TRAIT_MAP.bold.position },
    formationProgress: FORMATION_THRESHOLD - 1,
  });

  applyInfluence(
    pet,
    {
      id: 'action:test',
      category: 'action',
      label: 'Action',
      traitDeltas: { vitality: 2 },
    },
    { now: new Date('2026-05-04T01:00:00.000Z'), getIntensityMultiplier: () => 1 },
  );

  assert.equal(pet.formationComplete, true);
  assert.equal(pet.personality, 'bold');
  assert.equal(pet.coreMemories[0]?.tier, 'rare');
});

test('checkEvolution creates proposal after stable target zone', () => {
  const pet = makePet({
    traitVector: { ...PERSONALITY_TRAIT_MAP.paranoid.position },
    formationComplete: true,
  });

  for (let i = 0; i < STABILITY_SYNCS; i++) {
    checkEvolution(pet, { now: new Date('2026-05-04T00:00:00.000Z') });
  }

  assert.equal(pet.currentTargetZone, 'paranoid');
  assert.equal(pet.ticksInTargetZone, STABILITY_SYNCS);
  assert.equal(pet.evolutionProposal?.targetPersonalityId, 'paranoid');
  assert.equal(pet.evolutionProposal?.readiness, 100);
});

test('checkEvolution respects hysteresis boundary before proposing', () => {
  const belowHysteresisVector = interpolateVector(
    PERSONALITY_TRAIT_MAP.playful.position,
    PERSONALITY_TRAIT_MAP.paranoid.position,
    0.67,
  );
  const aboveHysteresisVector = interpolateVector(
    PERSONALITY_TRAIT_MAP.playful.position,
    PERSONALITY_TRAIT_MAP.paranoid.position,
    0.68,
  );
  const pet = makePet({
    traitVector: belowHysteresisVector,
    formationComplete: true,
  });

  for (let i = 0; i < STABILITY_SYNCS; i++) {
    checkEvolution(pet, { now: new Date('2026-05-04T00:00:00.000Z') });
  }

  const targetZone = pet.currentTargetZone;
  assert.notEqual(targetZone, null);
  assert.equal(pet.ticksInTargetZone, STABILITY_SYNCS);
  assert.equal(pet.evolutionProposal, undefined);

  pet.traitVector = aboveHysteresisVector;
  checkEvolution(pet, { now: new Date('2026-05-04T00:00:00.000Z') });

  assert.equal(pet.evolutionProposal?.targetPersonalityId, targetZone);
});

test('checkEvolution clears target when pet returns to current zone', () => {
  const pet = makePet({
    traitVector: { ...PERSONALITY_TRAIT_MAP.playful.position },
    currentTargetZone: 'bold',
    ticksInTargetZone: 10,
    evolutionProposal: {
      targetPersonalityId: 'bold',
      readiness: 100,
      depth: 1,
      proposedAt: '2026-05-04T00:00:00.000Z',
      coreMemoryIds: [],
    },
  });

  checkEvolution(pet);

  assert.equal(pet.currentTargetZone, null);
  assert.equal(pet.ticksInTargetZone, 0);
  assert.equal(pet.evolutionProposal, undefined);
});

test('void state enters identity_crisis after threshold', () => {
  const pet = makePet({
    traitVector: {
      vitality: 100,
      sociality: 100,
      order: 100,
      appetite: 100,
      caution: 100,
      curiosity: 100,
    } as TraitVector,
  });

  for (let i = 0; i < VOID_THRESHOLD_SYNCS; i++) {
    handleVoidState(pet, { now: new Date('2026-05-04T00:00:00.000Z') });
  }

  assert.equal(pet.voidSyncs, VOID_THRESHOLD_SYNCS);
  assert.equal(pet.emergentState, 'identity_crisis');
});

test('acceptEvolution records stable evolution and rare memory', () => {
  const pet = makePet({
    personality: 'playful',
    evolutionProposal: {
      targetPersonalityId: 'paranoid',
      readiness: 100,
      depth: 1,
      proposedAt: '2026-05-04T00:00:00.000Z',
      coreMemoryIds: ['mem-a'],
      narrativeText: 'Тестовое предложение',
    },
    currentTargetZone: 'paranoid',
    ticksInTargetZone: STABILITY_SYNCS,
  });

  assert.equal(acceptEvolution(pet, { now: new Date('2026-05-04T01:00:00.000Z') }), true);
  assert.equal(pet.personality, 'paranoid');
  assert.equal(pet.evolutionProposal, undefined);
  assert.equal(pet.currentTargetZone, null);
  assert.equal(pet.evolutionHistory.at(-1)?.fromPersonalityId, 'playful');
  assert.equal(pet.evolutionHistory.at(-1)?.toPersonalityId, 'paranoid');
  assert.equal(pet.evolutionHistory.at(-1)?.trigger, 'stability');
  assert.deepEqual(pet.evolutionHistory.at(-1)?.coreMemoryIds, ['mem-a']);
  assert.equal(pet.coreMemories[0]?.personalityHint, 'paranoid');
});

test('rejectEvolution clears proposal without changing personality', () => {
  const pet = makePet({
    personality: 'playful',
    currentTargetZone: 'paranoid',
    ticksInTargetZone: STABILITY_SYNCS,
    evolutionProposal: {
      targetPersonalityId: 'paranoid',
      readiness: 100,
      depth: 1,
      proposedAt: '2026-05-04T00:00:00.000Z',
      coreMemoryIds: [],
    },
  });

  assert.equal(rejectEvolution(pet), true);
  assert.equal(pet.personality, 'playful');
  assert.equal(pet.evolutionProposal, undefined);
  assert.equal(pet.currentTargetZone, null);
  assert.equal(pet.ticksInTargetZone, 0);
  assert.equal(pet.evolutionHistory.length, 0);
});

test('checkEvolution proposal includes narrative text', () => {
  const pet = makePet({
    traitVector: { ...PERSONALITY_TRAIT_MAP.paranoid.position },
    formationComplete: true,
  });

  for (let i = 0; i < STABILITY_SYNCS; i++) {
    checkEvolution(pet, { now: new Date('2026-05-04T00:00:00.000Z') });
  }

  assert.equal(typeof pet.evolutionProposal?.narrativeText, 'string');
  assert.equal(pet.evolutionProposal!.narrativeText!.includes('Параноик'), true);
});

test('singularity intercepts checkEvolution and collapses into one active zone', () => {
  const singularityVector = {
    vitality: 78.33333333333333,
    sociality: 51.666666666666664,
    order: 16.666666666666668,
    appetite: 45,
    caution: 16.666666666666668,
    curiosity: 78.33333333333333,
  } as TraitVector;
  const pet = makePet({
    ageHours: 2400,
    formationComplete: true,
    traitVector: singularityVector,
    currentTargetZone: 'paranoid',
    ticksInTargetZone: 40,
  });

  assert.notEqual(detectSingularity(pet), null);
  for (let i = 0; i < SINGULARITY_THRESHOLD_SYNCS; i++) {
    checkEvolution(pet, { now: new Date('2026-05-04T00:00:00.000Z') });
  }

  assert.equal(pet.emergentState, 'singularity');
  assert.equal(pet.currentTargetZone, null);
  assert.equal(pet.ticksInTargetZone, 0);
  assert.equal(pet.singularityZones.length, 3);

  pet.traitVector = { ...PERSONALITY_TRAIT_MAP.paranoid.position };
  collapseSingularity(pet, {
    now: new Date('2026-05-04T01:00:00.000Z'),
    random: () => 0,
  });

  assert.equal(pet.emergentState, null);
  assert.equal(pet.personality, 'chaotic');
  assert.equal(pet.evolutionHistory.at(-1)?.fromPersonalityId, 'playful');
  assert.equal(pet.evolutionHistory.at(-1)?.trigger, 'singularity');
});

test('shadow form enters from trauma and exits through catharsis cooldown', () => {
  const pet = makePet({
    traumaLevel: 75,
  });

  assert.equal(checkShadowForm(pet, { now: new Date('2026-05-04T00:00:00.000Z') }), true);
  assert.equal(pet.emergentState, 'shadow_form');
  assert.equal(getEmergentStateDef('shadow_form')?.type, 'shadow_form');

  assert.equal(addCatharsisProgress(pet, 99, { now: new Date('2026-05-04T01:00:00.000Z') }), false);
  assert.equal(pet.emergentState, 'shadow_form');
  assert.equal(addCatharsisProgress(pet, 1, { now: new Date('2026-05-04T01:10:00.000Z') }), true);

  assert.equal(pet.emergentState, null);
  assert.equal(pet.traumaLevel, 0);
  assert.equal(pet.catharsisAchieved, true);
  assert.equal(pet.traumaCooldownUntil, '2026-05-18T01:10:00.000Z');
  assert.equal(pet.coreMemories[0]?.emoji, '🌅');
});

test('state layers keep cognitive and evolution states from overwriting each other', () => {
  const pet = makePet({
    dailyVectorVariance: 30,
    traumaLevel: 75,
  });

  applyInfluence(
    pet,
    {
      id: 'test:layered-trauma',
      category: 'action',
      label: 'Layered Trauma',
      traitDeltas: { curiosity: 1 },
      traumaDelta: 1,
    },
    { now: new Date('2026-05-04T00:00:00.000Z'), getIntensityMultiplier: () => 1 },
  );

  assert.equal(pet.confusedState, true);
  assert.equal(pet.stateLayers?.cognitive?.[0]?.type, 'confused');
  assert.equal(pet.stateLayers?.evolution?.[0]?.type, 'shadow_form');
  assert.equal(pet.emergentState, 'shadow_form');

  onStartSleep(pet, { now: new Date('2026-05-04T01:00:00.000Z') });
  onWakeFromSleep(pet, true, { now: new Date('2026-05-04T06:00:00.000Z') });

  assert.equal(pet.confusedState, false);
  assert.equal(pet.stateLayers?.cognitive, undefined);
  assert.equal(pet.stateLayers?.evolution?.[0]?.type, 'shadow_form');
  assert.equal(pet.emergentState, 'shadow_form');
});

test('legacy emergentState is derived from layered state priority', () => {
  const pet = makePet();

  setLayeredEmergentState(pet, 'tantrum', '2026-05-04T00:00:00.000Z');
  setLayeredEmergentState(pet, 'confused', '2026-05-04T00:10:00.000Z');
  assert.equal(pet.emergentState, 'tantrum');

  setLayeredEmergentState(pet, 'shadow_form', '2026-05-04T00:20:00.000Z');
  assert.equal(pet.stateLayers?.gameplay?.[0]?.type, 'tantrum');
  assert.equal(pet.stateLayers?.cognitive?.[0]?.type, 'confused');
  assert.equal(pet.stateLayers?.evolution?.[0]?.type, 'shadow_form');
  assert.equal(pet.emergentState, 'shadow_form');
});

test('exclusive state semantics are explicit within a layer', () => {
  const pet = makePet();

  setLayeredEmergentState(pet, 'confused', '2026-05-04T00:00:00.000Z');
  setLayeredEmergentState(pet, 'feast_frenzy', '2026-05-04T00:05:00.000Z');
  setLayeredEmergentState(pet, 'enlightenment', '2026-05-04T00:10:00.000Z');

  assert.deepEqual(
    pet.stateLayers?.gameplay?.map(state => state.type),
    ['feast_frenzy', 'enlightenment'],
  );
  assert.equal(pet.stateLayers?.cognitive?.[0]?.type, 'confused');

  setLayeredEmergentState(pet, 'tantrum', '2026-05-04T00:20:00.000Z');

  assert.deepEqual(pet.stateLayers?.gameplay?.map(state => state.type), ['tantrum']);
  assert.equal(pet.stateLayers?.cognitive?.[0]?.type, 'confused');
  assert.equal(pet.emergentState, 'tantrum');
});

test('action modifiers stack effects from all active state layers', () => {
  const counters = createDefaultCounters({
    now: new Date('2026-05-04T00:00:00.000Z'),
    rng: () => 0.1,
  }) as BehavioralCounters;

  const result = applyActionModifiers(
    { statDeltas: { happiness: 0, bond: 0 }, xp: 10, coins: 10 },
    'bond',
    getPersonality('playful'),
    [],
    ['shadow_form', 'confused'],
    counters,
    { clientLocalHour: 12, coinBalance: 0, now: new Date('2026-05-04T00:00:00.000Z'), rng: () => 0.1 },
  );

  assert.equal(result.statDeltas.happiness, 15);
  assert.equal(result.statDeltas.bond, 15);
  assert.equal(result.xp, 20);
  assert.equal(result.coins, 5);
});

test('action blockers scan all active state layers by priority', () => {
  const blocked = isActionBlocked('play', ['confused', 'shadow_form', 'tantrum']);

  assert.equal(blocked?.reason, 'Сейчас игры ранят сильнее');
});

test('recordLegacy blends account lineage from completed pet lifecycle', () => {
  const account: Account = {
    legacyVector: { ...PERSONALITY_TRAIT_MAP.playful.position },
    legacyGeneration: 1,
  };
  const pet = makePet({
    personality: 'paranoid',
    traitVector: { ...PERSONALITY_TRAIT_MAP.paranoid.position },
    evolutionHistory: [{
      fromPersonalityId: 'playful',
      toPersonalityId: 'paranoid',
      evolvedAt: '2026-05-04T00:00:00.000Z',
      trigger: 'singularity',
    }],
  });

  recordLegacy(account, pet, { now: new Date('2026-05-04T00:00:00.000Z') });

  closeTo(account.legacyVector!.vitality, 55);
  closeTo(account.legacyVector!.caution, 72.5);
  assert.equal(account.legacyCoefficient, 0.20);
  assert.equal(account.legacyGeneration, 2);
  assert.equal(account.legacyDescription, 'Путь продолжается: жизнь 2');
  assert.equal(account.memoryGuardian?.name, 'Test');
  assert.equal(account.memoryGuardian?.guidance.length > 0, true);
});

test('recordDailyTraitSnapshot updates same day and resets budget on date rollover', () => {
  const pet = makePet({
    traitVector: { ...PERSONALITY_TRAIT_MAP.playful.position },
    dailyTraitBudget: { vitality: 5, order: 2 },
  });

  assert.equal(recordDailyTraitSnapshot(pet, new Date('2026-05-04T10:00:00.000Z')), true);
  assert.equal(pet.dailyTraitSnapshots.length, 1);
  assert.deepEqual(pet.dailyTraitBudget, {});

  pet.dailyTraitBudget = { vitality: 3 };
  pet.traitVector = { ...PERSONALITY_TRAIT_MAP.bold.position };
  assert.equal(recordDailyTraitSnapshot(pet, new Date('2026-05-04T20:00:00.000Z')), false);
  assert.equal(pet.dailyTraitSnapshots.length, 1);
  assert.equal(pet.dailyTraitSnapshots[0]?.vector.vitality, PERSONALITY_TRAIT_MAP.bold.position.vitality);
  assert.deepEqual(pet.dailyTraitBudget, { vitality: 3 });

  assert.equal(recordDailyTraitSnapshot(pet, new Date('2026-05-05T00:01:00.000Z')), true);
  assert.equal(pet.dailyTraitSnapshots.length, 2);
  assert.deepEqual(pet.dailyTraitBudget, {});
});

test('cooldown sync math gates influence reapplication', () => {
  assert.equal(canApplyInfluenceAtSync(undefined, 0, 12), true);
  assert.equal(canApplyInfluenceAtSync(10, 10, 0), true);
  assert.equal(canApplyInfluenceAtSync(10, 11, 2), false);
  assert.equal(canApplyInfluenceAtSync(10, 12, 2), true);
});

test('registry rejects social traumaDelta', () => {
  assert.throws(() => validateInfluenceRegistry([
    {
      id: 'social:bad',
      category: 'social',
      label: 'Bad',
      traitDeltas: { sociality: 1 },
      traumaDelta: 1,
    },
  ]), /social нельзя с traumaDelta/);
});

test('remote influence validation rejects unsafe data', () => {
  assert.equal(validateRemoteInfluence({
    id: 'remote:bad_category',
    category: 'social',
    label: 'Bad',
    traitDeltas: { sociality: 1 },
  }), null);

  assert.equal(validateRemoteInfluence({
    id: 'remote:trauma',
    category: 'item',
    label: 'Bad',
    traitDeltas: { sociality: 1 },
    traumaDelta: 1,
  }), null);

  assert.equal(validateRemoteInfluence({
    id: 'remote:huge',
    category: 'item',
    label: 'Bad',
    traitDeltas: { curiosity: HYSTERESIS },
  }), null);
});

test('balance patch validation clamps allowed shape', () => {
  assert.equal(validateBalancePatch({
    influenceId: 'action:play',
    intensityMultiplier: 1.21,
    reason: 'meta_balance',
    appliedAt: '2026-05-04T00:00:00.000Z',
  }), null);

  assert.deepEqual(validateBalancePatch({
    influenceId: 'action:play',
    intensityMultiplier: 1.2,
    reason: 'meta_balance',
    appliedAt: '2026-05-04T00:00:00.000Z',
  }), {
    influenceId: 'action:play',
    intensityMultiplier: 1.2,
    reason: 'meta_balance',
    appliedAt: '2026-05-04T00:00:00.000Z',
  });
});

await testAsync('threshold crossing emits rare memory once per zone', async () => {
  const pet = makePet({
    traitVector: { ...PERSONALITY_TRAIT_MAP.paranoid.position },
    formationComplete: true,
  });
  const prevVector = createInitialTraitVector();

  await checkThresholdCrossings(pet, prevVector, {
    now: new Date('2026-05-04T00:00:00.000Z'),
    memoryTextGenerator: testMemoryGenerator,
  });

  assert.equal(pet.visitedZones.includes('paranoid'), true);
  assert.equal(pet.coreMemories.length, 1);
  assert.equal(pet.coreMemories[0]?.tier, 'rare');
  assert.equal(pet.coreMemories[0]?.personalityHint, 'paranoid');

  await checkThresholdCrossings(pet, prevVector, {
    now: new Date('2026-05-04T01:00:00.000Z'),
    memoryTextGenerator: testMemoryGenerator,
  });

  assert.equal(pet.coreMemories.length, 1);
});

await testAsync('weekly drift requires seven snapshots and uses directional cooldown', async () => {
  const pet = makePet({
    traitVector: {
      vitality: 70,
      sociality: 50,
      order: 50,
      appetite: 50,
      caution: 50,
      curiosity: 50,
    },
    dailyTraitSnapshots: Array.from({ length: 6 }, (_, i) => ({
      date: `2026-04-2${i}`,
      vector: createInitialTraitVector(),
    })),
  });

  await checkWeeklyDrift(pet, {
    now: new Date('2026-05-04T00:00:00.000Z'),
    memoryTextGenerator: testMemoryGenerator,
  });
  assert.equal(pet.coreMemories.length, 0);

  pet.dailyTraitSnapshots.push({ date: '2026-04-30', vector: createInitialTraitVector() });
  await checkWeeklyDrift(pet, {
    now: new Date('2026-05-04T00:00:00.000Z'),
    memoryTextGenerator: testMemoryGenerator,
  });
  assert.equal(pet.coreMemories.length, 1);
  assert.equal(pet.coreMemories[0]?.traitKey, 'vitality');
  assert.equal(pet.coreMemories[0]?.direction, 'up');
  assert.equal(pet.lastMemoryTimestamp.vitality_up, '2026-05-04T00:00:00.000Z');

  await checkWeeklyDrift(pet, {
    now: new Date('2026-05-04T01:00:00.000Z'),
    memoryTextGenerator: testMemoryGenerator,
  });
  assert.equal(pet.coreMemories.length, 1);

  pet.traitVector.vitality = 30;
  await checkWeeklyDrift(pet, {
    now: new Date('2026-05-04T01:00:00.000Z'),
    memoryTextGenerator: testMemoryGenerator,
  });
  assert.equal(pet.coreMemories.length, 2);
  assert.equal(pet.coreMemories[0]?.direction, 'down');
  assert.equal(pet.lastMemoryTimestamp.vitality_down, '2026-05-04T01:00:00.000Z');
});

await testAsync('common memories cap at 20 while rare memories remain', async () => {
  const pet = makePet({
    traitVector: {
      vitality: 70,
      sociality: 50,
      order: 50,
      appetite: 50,
      caution: 50,
      curiosity: 50,
    },
    dailyTraitSnapshots: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${20 + i}`,
      vector: createInitialTraitVector(),
    })),
  });

  addCoreMemory(pet, {
    tier: 'rare',
    emoji: '★',
    text: 'Rare stays',
    category: 'system',
    traitKey: 'vitality',
    direction: 'origin',
  }, { now: new Date('2026-05-03T00:00:00.000Z') });

  for (let i = 0; i < 25; i++) {
    await checkWeeklyDrift(pet, {
      now: new Date(Date.parse('2026-05-04T00:00:00.000Z') + i * (MEMORY_COOLDOWN_MS + 1)),
      memoryTextGenerator: testMemoryGenerator,
    });
  }

  const rareCount = pet.coreMemories.filter(memory => memory.tier === 'rare').length;
  const commonCount = pet.coreMemories.filter(memory => memory.tier === 'common').length;
  assert.equal(rareCount, 1);
  assert.equal(commonCount, 20);
  assert.equal(pet.coreMemories.some(memory => memory.text === 'Rare stays'), true);
});

await testAsync('MockApi play action moves trait vector as side effect', async () => {
  const api = new MockApiService();
  const before = await api.getPet();
  const beforeVitality = before.traitVector.vitality;
  const beforeCuriosity = before.traitVector.curiosity;
  const beforeOrder = before.traitVector.order;

  const result = await api.playWithPet();
  const after = result.pet;

  assert.equal(after.traitVector.vitality > beforeVitality, true);
  assert.equal(after.traitVector.curiosity > beforeCuriosity, true);
  assert.equal(after.traitVector.order < beforeOrder, true);

  const synced = await api.syncPet();
  assert.equal(synced.dailyTraitSnapshots.length > 0, true);

  const sleeping = await api.sleepPet();
  assert.equal(sleeping.isAsleep, true);
  assert.notEqual(sleeping.sleepStartedAt, null);

  const woken = await api.wakePet();
  assert.equal(woken.isAsleep, false);
  assert.equal(woken.sleepStartedAt, null);
  assert.equal(woken.traumaLevel >= 2, true);
});

await testAsync('MockApi debug time can advance virtual sync time', async () => {
  const api = new MockApiService();
  setMockTimeScale(60);
  assert.equal(getMockTimeScale(), 60);

  const before = await api.getPet();
  advanceMockTime(2);
  const after = await api.syncPet();

  assert.equal(after.ageHours >= before.ageHours + 1.9, true);
  setMockTimeScale(1);
});

await testAsync('MockApi persists offline snapshot command log and cooldowns', async () => {
  const storage = makeMemoryStorage();
  setMockOfflineStorage(storage);
  clearMockOfflineRuntimeState();

  try {
    const api = new MockApiService();
    await api.getPet();
    const afterBond = await api.bondWithPet();
    const loaded = loadOfflinePetSave(storage);

    assert.equal(loaded.ok, true);
    if (!loaded.ok) assert.fail('offline save was not persisted');

    assert.equal(loaded.save.petSnapshot.id, afterBond.id);
    assert.equal(loaded.save.commandLog.at(-1)?.type, 'bond');
    assert.equal(typeof loaded.save.influenceCooldowns['action:bond'], 'number');
    closeTo(loaded.save.petSnapshot.traitVector.sociality, afterBond.traitVector.sociality);

    clearMockOfflineRuntimeState();
    const rehydrated = await new MockApiService().getPet();
    closeTo(rehydrated.traitVector.sociality, afterBond.traitVector.sociality);
    assert.equal(rehydrated.coreMemories.length, afterBond.coreMemories.length);
  } finally {
    setMockOfflineStorage(null);
    clearMockOfflineRuntimeState();
  }
});

await testAsync('MockApi useInventoryItem writes use_item command to offline log', async () => {
  const storage = makeMemoryStorage();
  setMockOfflineStorage(storage);
  clearMockOfflineRuntimeState();

  try {
    const api = new MockApiService();
    await api.getPet();
    await api.buyItem('vitamin');
    await api.useInventoryItem('vitamin');

    const loaded = loadOfflinePetSave(storage);
    assert.equal(loaded.ok, true);
    if (!loaded.ok) assert.fail('offline save was not persisted');

    const lastCommand = loaded.save.commandLog.at(-1);
    assert.equal(lastCommand?.type, 'use_item');
    if (lastCommand?.type === 'use_item') {
      assert.equal(lastCommand.itemId, 'vitamin');
      assert.equal(lastCommand.itemKind, 'medicine');
    }
  } finally {
    setMockOfflineStorage(null);
    clearMockOfflineRuntimeState();
  }
});

await testAsync('MockApi getPet does not mutate personality counters flags or state', async () => {
  const storage = makeMemoryStorage();
  setMockOfflineStorage(storage);
  clearMockOfflineRuntimeState();

  try {
    const api = new MockApiService();
    const before = await api.getPet();
    const after = await api.getPet();

    assert.equal(after.lastUpdated, before.lastUpdated);
    assert.deepEqual(after.behavioralCounters, before.behavioralCounters);
    assert.deepEqual(after.behavioralFlags, before.behavioralFlags);
    assert.deepEqual(after.stateLayers, before.stateLayers);
    assert.equal(after.emergentState, before.emergentState);
  } finally {
    setMockOfflineStorage(null);
    clearMockOfflineRuntimeState();
  }
});

await testAsync('MockApi new life keeps memory guardian and starts next body from echo vector', async () => {
  const api = new MockApiService();
  const result = await api.beginNewLife();

  assert.equal(result.account.legacyGeneration !== undefined && result.account.legacyGeneration > 0, true);
  assert.notEqual(result.account.legacyVector, undefined);
  assert.notEqual(result.account.memoryGuardian, undefined);
  assert.equal(result.pet.ageHours, 3);
  assert.equal(result.pet.formationComplete, false);
  assert.equal(result.pet.coreMemories.length, 0);

  const expected = createInitialTraitVector(
    result.account.legacyVector,
    result.account.legacyCoefficient,
  );
  for (const key of Object.keys(expected) as Array<keyof TraitVector>) {
    closeTo(result.pet.traitVector[key], expected[key]);
  }
});

test('sleep lifecycle resets confused only after natural 4h sleep', () => {
  const pet = makePet({
    dailyVectorVariance: 30,
    confusedState: true,
  });

  onStartSleep(pet, { now: new Date('2026-05-04T00:00:00.000Z') });
  assert.equal(pet.sleepStartedAt, '2026-05-04T00:00:00.000Z');

  onWakeFromSleep(pet, false, {
    now: new Date(`2026-05-04T0${MINIMUM_RESET_SLEEP_HOURS}:30:00.000Z`),
  });

  assert.equal(pet.dailyVectorVariance, 30);
  assert.equal(pet.confusedState, true);
  assert.equal(pet.lastSleepTimestamp, null);
  assert.equal(pet.sleepStartedAt, null);

  onStartSleep(pet, { now: new Date('2026-05-04T06:00:00.000Z') });
  onWakeFromSleep(pet, true, {
    now: new Date('2026-05-04T09:00:00.000Z'),
  });

  assert.equal(pet.dailyVectorVariance, 30);
  assert.equal(pet.confusedState, true);
  assert.equal(pet.lastSleepTimestamp, null);
  assert.equal(pet.sleepStartedAt, null);

  onStartSleep(pet, { now: new Date('2026-05-04T10:00:00.000Z') });
  onWakeFromSleep(pet, true, {
    now: new Date('2026-05-04T14:00:00.000Z'),
  });

  assert.equal(pet.dailyVectorVariance, 0);
  assert.equal(pet.confusedState, false);
  assert.equal(pet.lastSleepTimestamp, '2026-05-04T14:00:00.000Z');
  assert.equal(pet.sleepStartedAt, null);
});

test('variance hard reset requires last full sleep timestamp', () => {
  const pet = makePet({
    dailyVectorVariance: 30,
    confusedState: true,
  });

  checkVarianceHardReset(pet, {
    now: new Date(`2026-05-0${4 + VARIANCE_HARD_RESET_HOURS / 24}T00:00:00.000Z`),
  });

  assert.equal(pet.dailyVectorVariance, 30);
  assert.equal(pet.confusedState, true);

  pet.lastSleepTimestamp = '2026-05-04T00:00:00.000Z';
  checkVarianceHardReset(pet, {
    now: new Date('2026-05-06T00:00:00.000Z'),
  });

  assert.equal(pet.dailyVectorVariance, 0);
  assert.equal(pet.confusedState, false);
});
