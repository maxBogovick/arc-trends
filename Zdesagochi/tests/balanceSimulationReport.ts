import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Pet, PetMood, PetStage } from '../src/api/types';
import type { BehavioralCounters, MoodSnapshot, TraitVector } from '../src/personality/types';
import type { PetCommand } from '@zdesagochi/personality-core';
import {
  applyPersonalityCommand,
  replayPersonalityCommands,
} from '../src/personality/commandHandlers';
import { createDefaultCounters } from '../src/personality/PersonalityEngine';
import {
  addCatharsisProgress,
  checkEvolution,
  checkShadowForm,
  collapseSingularity,
  createInitialTraitVector,
  FORMATION_THRESHOLD,
  SINGULARITY_THRESHOLD_SYNCS,
  STABILITY_SYNCS,
} from '../src/personality/TraitEvolutionEngine';
import { PERSONALITY_TRAIT_MAP } from '../src/personality/personalityTraitMap';

interface ScenarioResult {
  name: string;
  status: 'pass' | 'warn';
  metrics: Record<string, string | number | boolean>;
  notes: string[];
}

const REPORT_PATH = resolve('docs/reports/personality_balance_report.md');
const START = '2026-05-04T00:00:00.000Z';

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: 'sim-pet',
    name: 'Sim',
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

function at(hours: number): string {
  return new Date(new Date(START).getTime() + hours * 3_600_000).toISOString();
}

async function runFormationScenario(): Promise<ScenarioResult> {
  let pet = makePet();
  let influenceCooldowns = {};
  let commands = 0;
  let currentSync = 0;
  let day = 0;

  while (!pet.formationComplete && day < 30) {
    const dailyCommands: PetCommand[] = [
      buildActionCommand('feed', commands, at(day * 24 + 1)),
      buildActionCommand('play', commands + 1, at(day * 24 + 2)),
      buildActionCommand('bond', commands + 2, at(day * 24 + 3)),
      buildActionCommand('bathe', commands + 3, at(day * 24 + 4)),
      buildActionCommand('heal', commands + 4, at(day * 24 + 5)),
      {
        type: 'use_item',
        itemId: 'magic_wand',
        itemKind: 'toy',
        itemEffect: { happiness: 10, xp: 5 },
        at: at(day * 24 + 6),
        commandId: `sim-item-magic-wand-${day}`,
      },
      {
        type: 'use_item',
        itemId: 'puzzle',
        itemKind: 'toy',
        itemEffect: { happiness: 5, xp: 5 },
        at: at(day * 24 + 7),
        commandId: `sim-item-puzzle-${day}`,
      },
      { type: 'sync', at: at(day * 24 + 23), commandId: `sim-formation-sync-${day}` },
    ];

    for (const command of dailyCommands) {
      const result = await applyPersonalityCommand(pet, command, {
        currentSync,
        influenceCooldowns,
        rng: () => 0.42,
      });
      pet = result.pet;
      influenceCooldowns = result.influenceCooldowns;
      commands++;
      if (command.type === 'sync') currentSync++;
      if (pet.formationComplete) break;
    }
    day++;
  }

  assert.equal(pet.formationComplete, true, 'formation should complete in bounded command loop');
  assert.equal(pet.coreMemories.some(memory => memory.text.includes('Характер сформировался')), true);

  return {
    name: 'Formation speed',
    status: commands <= 260 ? 'pass' : 'warn',
    metrics: {
      commandsToFormation: commands,
      simulatedDays: day,
      formationThreshold: FORMATION_THRESHOLD,
      formedPersonality: pet.personality,
      rareMemories: pet.coreMemories.filter(memory => memory.tier === 'rare').length,
    },
    notes: ['Balanced action loop should form a personality without requiring backend or UI state.'],
  };
}

async function runEvolutionScenario(): Promise<ScenarioResult> {
  const pet = makePet({
    formationComplete: true,
    personality: 'playful',
    ageHours: 120,
    traitVector: { ...PERSONALITY_TRAIT_MAP.paranoid.position },
  });

  for (let i = 1; i <= STABILITY_SYNCS; i++) {
    checkEvolution(pet, { now: new Date(at(i)), rng: () => 0.42 });
  }

  assert.equal(pet.evolutionProposal?.targetPersonalityId, 'paranoid');
  assert.equal(pet.ticksInTargetZone, STABILITY_SYNCS);

  return {
    name: 'Evolution proposal speed',
    status: 'pass',
    metrics: {
      stableChecksToProposal: STABILITY_SYNCS,
      expectedStabilitySyncs: STABILITY_SYNCS,
      targetPersonality: pet.evolutionProposal.targetPersonalityId,
      readiness: pet.evolutionProposal.readiness,
    },
    notes: ['A stable off-home trait vector proposes evolution at the configured stability window.'],
  };
}

async function runShadowScenario(): Promise<ScenarioResult> {
  const pet = makePet({
    formationComplete: true,
    traumaLevel: 80,
  });

  const entered = checkShadowForm(pet, { now: new Date(START) });
  assert.equal(entered, true);
  assert.equal(pet.emergentState, 'shadow_form');

  let steps = 0;
  while (pet.emergentState === 'shadow_form' && steps < 10) {
    steps++;
    addCatharsisProgress(pet, 25, { now: new Date(at(steps)) });
  }

  assert.notEqual(pet.emergentState, 'shadow_form');
  assert.equal(pet.catharsisAchieved, true);

  return {
    name: 'Shadow entry and recovery',
    status: steps === 4 ? 'pass' : 'warn',
    metrics: {
      traumaToEnter: 80,
      catharsisSteps: steps,
      cooldownSet: Boolean(pet.traumaCooldownUntil),
      rareMemories: pet.coreMemories.filter(memory => memory.tier === 'rare').length,
    },
    notes: ['Four 25-point catharsis ticks should recover from shadow form.'],
  };
}

async function runSingularityScenario(): Promise<ScenarioResult> {
  const singularityVector = {
    vitality: 78.33333333333333,
    sociality: 51.666666666666664,
    order: 16.666666666666668,
    appetite: 45,
    caution: 16.666666666666668,
    curiosity: 78.33333333333333,
  } as TraitVector;
  let pet = makePet({
    ageHours: 2400,
    formationComplete: true,
    traitVector: singularityVector,
  });

  for (let i = 1; i <= SINGULARITY_THRESHOLD_SYNCS; i++) {
    checkEvolution(pet, { now: new Date(at(i)), rng: () => 0.42 });
  }

  assert.equal(pet.stateLayers?.evolution?.some(state => state.type === 'singularity'), true);
  assert.equal(pet.singularityZones.length >= 3, true);
  const zonesAtEntry = pet.singularityZones.length;

  pet.traitVector = { ...PERSONALITY_TRAIT_MAP.playful.position };
  collapseSingularity(pet, { now: new Date(at(SINGULARITY_THRESHOLD_SYNCS + 1)), rng: () => 0 });

  assert.equal(pet.evolutionHistory.at(-1)?.trigger, 'singularity');

  return {
    name: 'Singularity rarity and collapse',
    status: 'pass',
    metrics: {
      syncsToSingularity: SINGULARITY_THRESHOLD_SYNCS,
      zonesAtEntry,
      collapsedTo: pet.personality,
      rareMemories: pet.coreMemories.filter(memory => memory.tier === 'rare').length,
    },
    notes: ['Singularity requires the configured threshold and collapses only after leaving the tie zone.'],
  };
}

async function runMemoryScenario(): Promise<ScenarioResult> {
  const formation = await runFormationScenario();
  const shadow = await runShadowScenario();
  const singularity = await runSingularityScenario();
  const rareMemoryTotal =
    Number(formation.metrics.rareMemories) +
    Number(shadow.metrics.rareMemories) +
    Number(singularity.metrics.rareMemories);

  assert.equal(rareMemoryTotal >= 4, true);

  return {
    name: 'Memory generation rate',
    status: 'pass',
    metrics: {
      rareMemoriesAcrossCoreScenarios: rareMemoryTotal,
      expectedMinimum: 4,
    },
    notes: ['Formation, catharsis, singularity entry, and singularity collapse all leave durable rare memories.'],
  };
}

function buildActionCommand(type: PetCommand['type'], index: number, timestamp: string): PetCommand {
  const commandId = `sim-${type}-${index}`;
  switch (type) {
    case 'feed':
      return {
        type,
        foodId: `food-${index % 8}`,
        foodEffect: { hungerRestore: 20, happinessBonus: 5, healthBonus: 5 },
        at: timestamp,
        commandId,
      };
    case 'play':
      return { type, scoreSeed: String(100 + (index % 50)), at: timestamp, commandId };
    case 'sleep':
    case 'wake':
    case 'bathe':
    case 'heal':
    case 'bond':
      return { type, at: timestamp, commandId };
    default:
      return { type: 'bond', at: timestamp, commandId };
  }
}

function renderReport(results: ScenarioResult[]): string {
  const generatedAt = new Date().toISOString();
  const lines = [
    '# Personality Balance Simulation Report',
    '',
    `Generated at: ${generatedAt}`,
    '',
    '## Summary',
    '',
    '| Scenario | Status | Key metrics |',
    '|---|---|---|',
    ...results.map(result => `| ${result.name} | ${result.status} | ${formatMetrics(result.metrics)} |`),
    '',
    '## Details',
    '',
  ];

  for (const result of results) {
    lines.push(`### ${result.name}`, '');
    lines.push(`Status: ${result.status}`, '');
    lines.push('| Metric | Value |', '|---|---|');
    for (const [key, value] of Object.entries(result.metrics)) {
      lines.push(`| ${key} | ${String(value)} |`);
    }
    lines.push('', ...result.notes.map(note => `- ${note}`), '');
  }

  lines.push(
    '## Interpretation',
    '',
    '- Formation, evolution proposal, shadow recovery, singularity, and rare memory generation are reproducible through deterministic simulation.',
    '- This report is a balance proof artifact, not a replacement for product analytics.',
    '- Warnings should be investigated before changing trait deltas, thresholds, or cooldowns.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function formatMetrics(metrics: Record<string, string | number | boolean>): string {
  return Object.entries(metrics)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`)
    .join('<br>');
}

const results = [
  await runFormationScenario(),
  await runEvolutionScenario(),
  await runShadowScenario(),
  await runSingularityScenario(),
  await runMemoryScenario(),
];

await mkdir(dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, renderReport(results), 'utf8');

console.log(`Balance simulation report written to ${REPORT_PATH}`);
for (const result of results) {
  console.log(`${result.status.toUpperCase()} - ${result.name}: ${formatMetrics(result.metrics).replaceAll('<br>', '; ')}`);
}
