import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const tempDir = await mkdtemp(join(tmpdir(), 'personality-core-demo-'));
const entry = join(tempDir, 'demo.ts');
const outfile = join(tempDir, 'demo.mjs');
const coreEntry = JSON.stringify(`${process.cwd()}/packages/personality-core/src/index.ts`);
const presetEntry = JSON.stringify(`${process.cwd()}/packages/personality-pet-preset/src/index.ts`);

const demoSource = `
  import assert from 'node:assert/strict';
  import {
    PERSONALITY_STATE_SCHEMA_VERSION,
    createPersonalityEngine,
    migratePersonalityState,
    type PersonalityState,
  } from ${coreEntry};
  import { zdesagochiPetPreset } from ${presetEntry};

  const now = '2026-05-04T00:00:00.000Z';
  const state: PersonalityState = {
    schemaVersion: PERSONALITY_STATE_SCHEMA_VERSION,
    mood: 'happy',
    stats: { hunger: 70, happiness: 80, energy: 80, health: 80, cleanliness: 80, bond: 80 },
    ageHours: 3,
    level: 1,
    xp: 0,
    xpToNext: 100,
    isAsleep: false,
    equippedRoomId: 'default',
    lastUpdated: now,
    personality: 'playful',
    behavioralFlags: [],
    emergentState: null,
    stateLayers: {},
    behavioralCounters: {
      sessionGapHours: 0,
      lastActionTimestamp: now,
      feedInRedZone7d: 0,
      feedInGreenZone7d: 0,
      forcedSleepCount7d: 0,
      healWhenHealthy7d: 0,
      nightWakeCount7d: 0,
      sessionGapsOver48h_30d: 0,
      filthCrisisCount30d: 0,
      consecutiveLowHealthSyncs: 0,
      consecutiveGoodSyncs: 0,
      consecutiveBadMoodSyncs: 0,
      maxConsecHighPlayDays: 0,
      currentHighPlayDays: 0,
      nightSingleInteractionDays7d: 0,
      lastStatsSnapshot: {},
      playCountToday: 0,
      lastDayReset: now.slice(0, 10),
      dailyFoodLog: {},
      recentFeedTimestamps: [],
      uniqueFoodsTried: [],
      totalBondActions: 0,
      sameRoomHours: 0,
      lastEquippedRoomId: 'default',
      lastRoomCheckTs: now,
      paranoidPhase: 'untrusted',
      bondActionsInPhase: 0,
      stoicPeakUsed: false,
      enlightenmentActive: false,
      chaosDailySeed: 0.5,
      chaosSeedDate: now.slice(0, 10),
      melancholicActionCount: 0,
      rollingWindows: { dailyBuckets: [] },
    },
    moodHistory: [],
    traitVector: { vitality: 50, sociality: 50, order: 50, appetite: 50, caution: 50, curiosity: 50 },
    dailyTraitBudget: {},
    currentTargetZone: null,
    ticksInTargetZone: 0,
    voidSyncs: 0,
    dailyTraitSnapshots: [],
    coreMemories: [],
    lastMemoryTimestamp: {},
    visitedZones: [],
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
    coinBalance: 0,
  };

  const migrated = migratePersonalityState(state);
  assert.equal(migrated.ok, true);

  const engine = createPersonalityEngine(zdesagochiPetPreset);
  const command = {
    type: 'feed',
    foodId: 'apple',
    at: '2026-05-04T01:00:00.000Z',
    commandId: 'demo-feed-1',
  } as const;
  const result = await engine.applyCommand(state, command);
  const replay = await engine.replay(state, [command]);

  assert.equal(result.schemaVersion, PERSONALITY_STATE_SCHEMA_VERSION);
  assert.equal(replay.schemaVersion, PERSONALITY_STATE_SCHEMA_VERSION);
  assert.equal(result.pet.stats.hunger > state.stats.hunger, true);
  assert.equal(replay.commandResults.length, 1);
`;

try {
  await writeFile(entry, demoSource);
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  });
  await import(pathToFileURL(outfile).href);
  console.log('PASS - personality core quickstart demo');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
