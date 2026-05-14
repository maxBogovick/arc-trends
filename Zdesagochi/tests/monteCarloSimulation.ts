import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Pet, PetMood, PetStage } from '../src/api/types';
import type { BehavioralCounters, MoodSnapshot } from '../src/personality/types';
import type { PetCommand } from '@zdesagochi/personality-core';
import { applyPersonalityCommand } from '../src/personality/commandHandlers';
import { createDefaultCounters, computeEmergentState } from '../src/personality/PersonalityEngine';
import {
  createInitialTraitVector,
  checkShadowForm,
  addCatharsisProgress,
  checkEvolution,
  acceptEvolution,
} from '../src/personality/TraitEvolutionEngine';
import { PERSONALITIES } from '../src/personality/personalities';

const REPORT_PATH = resolve('docs/reports/monte_carlo_report.md');
const SIM_DAYS = 30;
const RUNS_PER_STYLE = 20;

const PERSONALITY_IDS = PERSONALITIES.map(p => p.id);

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

type PlayStyle = 'common' | 'neglect' | 'heavy' | 'food_only' | 'balanced' | 'shadow_recovery' | 'singularity_hunt';

async function runOneDayCommon(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  const actions: PetCommand[] = [
    cmd('feed', ts(base, day * 24 + 1)),
    cmd('play', ts(base, day * 24 + 3)),
    cmd('bathe', ts(base, day * 24 + 5)),
    cmd('bond', ts(base, day * 24 + 7)),
    cmd('sleep', ts(base, day * 24 + 20)),
    cmd('wake', ts(base, day * 24 + 28)),
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-common` },
  ];
  return runActions(pet, actions, cooldowns, sync, rng);
}

async function runOneDayNeglect(pet: Pet, base: Date, day: number, cooldowns: Record<string, number>, sync: number, rng: () => number) {
  const actions: PetCommand[] = [
    cmd('feed', ts(base, day * 24 + 12)),
    { type: 'sync', at: ts(base, day * 24 + 23), commandId: `mc-sync-${day}-neglect` },
  ];
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

async function runActions(
  pet: Pet,
  actions: PetCommand[],
  cooldowns: Record<string, number>,
  sync: number,
  rng: () => number,
): Promise<{ pet: Pet; cooldowns: Record<string, number>; sync: number }> {
  for (const action of actions) {
    try {
      const result = await applyPersonalityCommand(pet, action, {
        currentSync: sync,
        influenceCooldowns: cooldowns,
        rng,
      });
      pet = result.pet;
      cooldowns = result.influenceCooldowns;
      if (action.type === 'sync') sync++;

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
  return { pet, cooldowns, sync };
}

// ─── Single run ───────────────────────────────────────────────────────────────

interface RunResult {
  formedPersonality: string | null;
  formationDay: number | null;
  evolved: boolean;
  shadowEntered: boolean;
  shadowRecovered: boolean;
  confusedEvents: number;
  singularityTriggered: boolean;
  totalMemories: number;
  rareMemories: number;
  finalPersonality: string;
}

async function runSimulation(personalityId: string, style: PlayStyle, seed: number): Promise<RunResult> {
  let pet = makePet(personalityId);
  let cooldowns: Record<string, number> = {};
  let sync = 0;
  const rng = makeRng(seed);
  const base = new Date('2026-01-01T00:00:00.000Z');

  let formedPersonality: string | null = null;
  let formationDay: number | null = null;
  let evolved = false;
  let shadowEntered = false;
  let shadowRecovered = false;
  let confusedEvents = 0;
  let singularityTriggered = false;

  const prevConfused = false;

  for (let day = 0; day < SIM_DAYS; day++) {
    let state: { pet: Pet; cooldowns: Record<string, number>; sync: number };

    switch (style) {
      case 'common': state = await runOneDayCommon(pet, base, day, cooldowns, sync, rng); break;
      case 'neglect': state = await runOneDayNeglect(pet, base, day, cooldowns, sync, rng); break;
      case 'heavy': state = await runOneDayHeavy(pet, base, day, cooldowns, sync, rng); break;
      case 'food_only': state = await runOneDayFoodOnly(pet, base, day, cooldowns, sync, rng); break;
      case 'balanced': state = await runOneDayBalanced(pet, base, day, cooldowns, sync, rng); break;
      case 'shadow_recovery': state = await runOneDayShadowRecovery(pet, base, day, cooldowns, sync, rng); break;
      case 'singularity_hunt': state = await runOneDaySingularity(pet, base, day, cooldowns, sync, rng); break;
    }

    pet = state.pet;
    cooldowns = state.cooldowns;
    sync = state.sync;

    if (!formedPersonality && pet.formationComplete) {
      formedPersonality = pet.personality;
      formationDay = day;
    }

    if (pet.evolutionHistory.length > 0) evolved = true;

    if (pet.emergentState === 'shadow_form' || pet.stateLayers?.evolution?.some?.((s: any) => s.type === 'shadow_form')) {
      shadowEntered = true;
    }
    if (shadowEntered && pet.catharsisAchieved) shadowRecovered = true;

    if (pet.confusedState && !prevConfused) confusedEvents++;

    if (pet.stateLayers?.evolution?.some?.((s: any) => s.type === 'singularity') || pet.emergentState === 'singularity') {
      singularityTriggered = true;
    }
  }

  return {
    formedPersonality,
    formationDay,
    evolved,
    shadowEntered,
    shadowRecovered,
    confusedEvents,
    singularityTriggered,
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
  shadowEntryRate: number;
  shadowRecoveryRate: number;
  avgConfusedEvents: number;
  singularityRate: number;
  avgMemories: number;
  avgRareMemories: number;
  finalPersonalityDistribution: Record<string, number>;
}

async function runStyleForPersonality(personalityId: string, style: PlayStyle): Promise<StyleStats> {
  const results: RunResult[] = [];
  for (let i = 0; i < RUNS_PER_STYLE; i++) {
    results.push(await runSimulation(personalityId, style, i * 31337 + personalityId.charCodeAt(0) * 137));
  }

  const formed = results.filter(r => r.formedPersonality !== null);
  const finalDist: Record<string, number> = {};
  for (const r of results) {
    finalDist[r.finalPersonality] = (finalDist[r.finalPersonality] ?? 0) + 1;
  }
  for (const key of Object.keys(finalDist)) finalDist[key] = finalDist[key] / results.length;

  return {
    style,
    personalityId,
    formationRate: formed.length / results.length,
    avgFormationDay: formed.length > 0 ? formed.reduce((s, r) => s + (r.formationDay ?? 0), 0) / formed.length : -1,
    evolutionRate: results.filter(r => r.evolved).length / results.length,
    shadowEntryRate: results.filter(r => r.shadowEntered).length / results.length,
    shadowRecoveryRate: results.filter(r => r.shadowRecovered).length / results.length,
    avgConfusedEvents: results.reduce((s, r) => s + r.confusedEvents, 0) / results.length,
    singularityRate: results.filter(r => r.singularityTriggered).length / results.length,
    avgMemories: results.reduce((s, r) => s + r.totalMemories, 0) / results.length,
    avgRareMemories: results.reduce((s, r) => s + r.rareMemories, 0) / results.length,
    finalPersonalityDistribution: finalDist,
  };
}

// ─── Report renderer ──────────────────────────────────────────────────────────

function pct(v: number): string { return `${(v * 100).toFixed(0)}%`; }
function dec(v: number): string { return v.toFixed(1); }

function renderReport(allStats: StyleStats[]): string {
  const generatedAt = new Date().toISOString();
  const STYLES: PlayStyle[] = ['common', 'neglect', 'heavy', 'food_only', 'balanced', 'shadow_recovery', 'singularity_hunt'];

  const lines: string[] = [
    '# Personality Engine Monte Carlo Report',
    '',
    `Generated at: ${generatedAt}  `,
    `Runs per personality/style: ${RUNS_PER_STYLE}  `,
    `Simulation days: ${SIM_DAYS}`,
    '',
    '## Summary by style (averaged across all personalities)',
    '',
    '| Style | Formation% | Avg Formation Day | Evolution% | Shadow Entry% | Shadow Recovery% | Singularity% | Avg Memories |',
    '|---|---|---|---|---|---|---|---|',
  ];

  for (const style of STYLES) {
    const rows = allStats.filter(s => s.style === style);
    const avg = (fn: (s: StyleStats) => number) => rows.reduce((a, r) => a + fn(r), 0) / rows.length;
    lines.push([
      `| ${style}`,
      pct(avg(s => s.formationRate)),
      dec(avg(s => s.avgFormationDay)),
      pct(avg(s => s.evolutionRate)),
      pct(avg(s => s.shadowEntryRate)),
      pct(avg(s => s.shadowRecoveryRate)),
      pct(avg(s => s.singularityRate)),
      dec(avg(s => s.avgMemories)),
      '|',
    ].join(' | '));
  }

  lines.push('', '## Per-personality detail (common play style)', '');
  lines.push('| Personality | Formation% | Avg Day | Evolution% | Shadow% | Confused/30d | Memories |');
  lines.push('|---|---|---|---|---|---|---|');

  for (const stat of allStats.filter(s => s.style === 'common')) {
    lines.push([
      `| ${stat.personalityId}`,
      pct(stat.formationRate),
      dec(stat.avgFormationDay),
      pct(stat.evolutionRate),
      pct(stat.shadowEntryRate),
      dec(stat.avgConfusedEvents),
      dec(stat.avgMemories),
      '|',
    ].join(' | '));
  }

  lines.push('', '## Final personality distribution (common play style, % of runs ending as each personality)', '');
  const allPersonalities = new Set<string>();
  for (const s of allStats.filter(st => st.style === 'common')) {
    for (const k of Object.keys(s.finalPersonalityDistribution)) allPersonalities.add(k);
  }
  const header = `| Start \\ End | ${[...allPersonalities].join(' | ')} |`;
  lines.push(header);
  lines.push('|' + '---|'.repeat([...allPersonalities].size + 1));
  for (const stat of allStats.filter(s => s.style === 'common')) {
    const row = [...allPersonalities].map(p => pct(stat.finalPersonalityDistribution[p] ?? 0)).join(' | ');
    lines.push(`| ${stat.personalityId} | ${row} |`);
  }

  return lines.join('\n') + '\n';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const STYLES: PlayStyle[] = ['common', 'neglect', 'heavy', 'food_only', 'balanced', 'shadow_recovery', 'singularity_hunt'];

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
console.log(`Shadow entry rate (common): ${(avg(s => s.shadowEntryRate) * 100).toFixed(0)}%`);
console.log(`Singularity rate (common): ${(avg(s => s.singularityRate) * 100).toFixed(0)}%`);
