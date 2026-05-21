import type {
  AppliedModifier,
  BehaviorAxis,
  DomainEvent,
  PersonalityId,
  PetCommand,
  PetCommandResult,
  TraitKey,
} from '@zdesagochi/personality-core';

export const DEFAULT_EXPLAINABILITY_LOG_KEY = 'zdesagochi:explainability-log:v1';
export const DEFAULT_EXPLAINABILITY_LOG_LIMIT = 100;

export interface ExplainabilityRecord {
  command: PetCommand;
  events: DomainEvent[];
  statDeltas: PetCommandResult['statDeltas'];
  xpDelta: number;
  coinDelta: number;
  blockedAction: PetCommandResult['blockedAction'];
  appliedModifiers: AppliedModifier[];
  meta?: Record<string, unknown>;
  personalityTelemetry?: PersonalityTelemetrySample;
  engineVersion: string;
  registryVersion: string;
  recordedAt: string;
}

export interface CommandExplanation {
  commandId: string;
  commandType: PetCommand['type'];
  at: string;
  title: string;
  summary: string;
  details: string[];
  personalitySummary?: string;
  personalityDetails: string[];
  blocked: boolean;
  record: ExplainabilityRecord;
}

export interface PersonalityTelemetrySample {
  commandId: string;
  commandType: PetCommand['type'];
  recordedAt: string;
  personalityId: string;
  formationComplete: boolean;
  formationProgress: number;
  currentTargetZone: PersonalityId | null;
  evolutionReadiness: number;
  evolutionReadinessTarget: PersonalityId | null;
  dominantBehaviorAxis: BehaviorAxis | null;
  behaviorSampleCount: number;
  traitDrift: Partial<Record<TraitKey, number>>;
  behaviorDrift: Partial<Record<BehaviorAxis, number>>;
  eventTypes: DomainEvent['type'][];
  evolutionProposalTarget: PersonalityId | null;
}

export type ExplainabilityLogLoadResult =
  | { ok: true; records: ExplainabilityRecord[] }
  | { ok: false; reason: 'missing' | 'invalid_json' | 'invalid_shape' };

export interface ExplainabilityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class ExplainabilityLog {
  private records: ExplainabilityRecord[] = [];
  private hydrated = false;

  constructor(
    private readonly storage: ExplainabilityStorage,
    private readonly key = DEFAULT_EXPLAINABILITY_LOG_KEY,
    private readonly limit = DEFAULT_EXPLAINABILITY_LOG_LIMIT,
  ) {}

  load(): ExplainabilityLogLoadResult {
    const raw = this.storage.getItem(this.key);
    if (raw === null) return { ok: false, reason: 'missing' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }

    if (!Array.isArray(parsed) || !parsed.every(isExplainabilityRecord)) {
      return { ok: false, reason: 'invalid_shape' };
    }

    this.records = parsed.slice(0, this.limit);
    this.hydrated = true;
    return { ok: true, records: [...this.records] };
  }

  appendResult(result: PetCommandResult, recordedAt: string): void {
    this.ensureHydrated();
    const record = createExplainabilityRecord(result, recordedAt);
    this.records = [
      record,
      ...this.records.filter(entry => entry.command.commandId !== result.command.commandId),
    ].slice(0, this.limit);
    this.persist();
  }

  list(): ExplainabilityRecord[] {
    this.ensureHydrated();
    return [...this.records];
  }

  select(commandId?: string): CommandExplanation | null {
    this.ensureHydrated();
    const record = commandId
      ? this.records.find(entry => entry.command.commandId === commandId)
      : this.records[0];
    return record ? explainCommandRecord(record) : null;
  }

  listPersonalityTelemetry(): PersonalityTelemetrySample[] {
    this.ensureHydrated();
    return this.records
      .map(record => record.personalityTelemetry)
      .filter((sample): sample is PersonalityTelemetrySample => Boolean(sample));
  }

  clear(): void {
    this.records = [];
    this.hydrated = true;
    this.storage.removeItem(this.key);
  }

  private ensureHydrated(): void {
    if (this.hydrated) return;
    const loaded = this.load();
    if (!loaded.ok) {
      this.records = [];
      this.hydrated = true;
    }
  }

  private persist(): void {
    this.storage.setItem(this.key, JSON.stringify(this.records));
  }
}

export function createExplainabilityRecord(result: PetCommandResult, recordedAt: string): ExplainabilityRecord {
  const record: ExplainabilityRecord = {
    command: result.command,
    events: result.events,
    statDeltas: result.statDeltas,
    xpDelta: result.xpDelta,
    coinDelta: result.coinDelta,
    blockedAction: result.blockedAction,
    appliedModifiers: result.appliedModifiers,
    personalityTelemetry: createPersonalityTelemetrySample(result, recordedAt),
    engineVersion: result.engineVersion,
    registryVersion: result.registryVersion,
    recordedAt,
  };
  if (result.meta) record.meta = result.meta;
  return record;
}

export function explainCommandRecord(record: ExplainabilityRecord): CommandExplanation {
  const details: string[] = [];
  const personalityDetails: string[] = [];
  const changedStats = Object.entries(record.statDeltas)
    .filter(([, value]) => typeof value === 'number' && value !== 0)
    .map(([stat, value]) => `${stat} ${formatSigned(value as number)}`);
  if (changedStats.length > 0) details.push(`Stats: ${changedStats.join(', ')}`);
  if (record.xpDelta !== 0) details.push(`XP: ${formatSigned(record.xpDelta)}`);
  if (record.coinDelta !== 0) details.push(`Coins: ${formatSigned(record.coinDelta)}`);
  if (record.blockedAction) details.push(`Blocked: ${record.blockedAction.reason}`);

  for (const event of record.events) {
    if (event.type === 'trait_vector_changed') {
      const traits = Object.entries(event.nextVector)
        .filter(([trait, value]) => event.prevVector[trait as keyof typeof event.prevVector] !== value)
        .map(([trait, value]) => `${trait} ${formatSigned(value - event.prevVector[trait as keyof typeof event.prevVector])}`);
      if (traits.length > 0) details.push(`Traits: ${traits.join(', ')}`);
    } else if (event.type === 'behavior_profile_changed') {
      const axes = Object.entries(event.nextProfile.axes)
        .filter(([axis, value]) => event.prevProfile.axes[axis as keyof typeof event.prevProfile.axes] !== value)
        .map(([axis, value]) => `${axis} ${formatSigned(value - event.prevProfile.axes[axis as keyof typeof event.prevProfile.axes])}`);
      if (axes.length > 0) {
        details.push(`Behavior: ${axes.join(', ')}`);
        personalityDetails.push(`Поведенческий профиль изменился: ${axes.join(', ')}`);
      }
    } else if (event.type === 'evolution_readiness_changed') {
      const target = event.targetTo ?? event.targetFrom ?? 'none';
      const delta = event.to - event.from;
      details.push(`Evolution readiness: ${target} ${formatSigned(delta)} (${Math.round(event.to)}%)`);
      personalityDetails.push(`Готовность к смене характера ${target}: ${Math.round(event.from)}% -> ${Math.round(event.to)}%`);
    } else if (event.type === 'trauma_level_changed') {
      details.push(`Trauma: ${event.from} -> ${event.to}`);
    } else if (event.type === 'catharsis_progress_changed') {
      details.push(`Catharsis: ${event.from} -> ${event.to}${event.completed ? ' complete' : ''}`);
    } else if (event.type === 'emergent_state_changed') {
      details.push(`State: ${event.from ?? 'none'} -> ${event.to ?? 'none'}`);
    } else if (event.type === 'core_memory_added') {
      details.push(`Memory: ${event.memory.text}`);
    } else if (event.type === 'evolution_proposed') {
      details.push(`Evolution proposed: ${event.proposal.targetPersonalityId}`);
      personalityDetails.push(`Появилось предложение смены характера: ${event.proposal.targetPersonalityId}, готовность ${Math.round(event.proposal.readiness)}%`);
    } else if (event.type === 'evolution_recorded') {
      details.push(`Evolution recorded: ${event.record.toPersonalityId}`);
      personalityDetails.push(`Характер изменился: ${event.record.fromPersonalityId} -> ${event.record.toPersonalityId}`);
    } else if (event.type === 'sleep_started') {
      details.push('Sleep started');
    } else if (event.type === 'sleep_finished') {
      details.push(`Sleep finished: ${event.sleptHours.toFixed(1)}h, natural=${event.naturalWake}`);
    } else if (event.type === 'influence_cooldown_skipped') {
      details.push(`Skipped influence: ${event.influenceId}`);
    } else if (event.type === 'offline_sync_capped') {
      details.push(`Offline sync capped: ${event.reason}`);
    }
  }

  for (const modifier of record.appliedModifiers) {
    details.push(`Modifier: ${modifier.id}`);
  }

  const summary = record.blockedAction
    ? `${record.command.type} was blocked: ${record.blockedAction.reason}`
    : details[0] ?? `${record.command.type} applied with no visible changes`;
  const personalitySummary = createPersonalitySummary(record, personalityDetails);

  return {
    commandId: record.command.commandId,
    commandType: record.command.type,
    at: record.command.at,
    title: `${record.command.type} @ ${record.command.at}`,
    summary,
    details,
    personalitySummary,
    personalityDetails,
    blocked: Boolean(record.blockedAction),
    record,
  };
}

export function createPersonalityTelemetrySample(result: PetCommandResult, recordedAt: string): PersonalityTelemetrySample {
  const traitDrift: Partial<Record<TraitKey, number>> = {};
  const behaviorDrift: Partial<Record<BehaviorAxis, number>> = {};

  for (const event of result.events) {
    if (event.type === 'trait_vector_changed') {
      for (const [trait, value] of Object.entries(event.nextVector)) {
        const key = trait as TraitKey;
        const delta = value - event.prevVector[key];
        if (delta !== 0) traitDrift[key] = round2((traitDrift[key] ?? 0) + delta);
      }
    } else if (event.type === 'behavior_profile_changed') {
      for (const [axis, value] of Object.entries(event.nextProfile.axes)) {
        const key = axis as BehaviorAxis;
        const delta = value - event.prevProfile.axes[key];
        if (delta !== 0) behaviorDrift[key] = round2((behaviorDrift[key] ?? 0) + delta);
      }
    }
  }

  const profile = result.pet.behaviorProfile;
  const dominantBehaviorAxis = profile ? dominantAxis(profile.axes) : null;

  return {
    commandId: result.command.commandId,
    commandType: result.command.type,
    recordedAt,
    personalityId: result.pet.personality,
    formationComplete: result.pet.formationComplete,
    formationProgress: result.pet.formationProgress,
    currentTargetZone: result.pet.currentTargetZone,
    evolutionReadiness: result.pet.evolutionReadiness ?? 0,
    evolutionReadinessTarget: result.pet.evolutionReadinessTarget ?? null,
    dominantBehaviorAxis,
    behaviorSampleCount: profile?.sampleCount ?? 0,
    traitDrift,
    behaviorDrift,
    eventTypes: result.events.map(event => event.type),
    evolutionProposalTarget: result.pet.evolutionProposal?.targetPersonalityId ?? null,
  };
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${Number.isInteger(value) ? value : Number(value.toFixed(2))}`;
}

function createPersonalitySummary(record: ExplainabilityRecord, details: string[]): string | undefined {
  const telemetry = record.personalityTelemetry;
  if (!telemetry) return details[0];
  if (telemetry.evolutionProposalTarget) {
    return `Характер готовится измениться к ${telemetry.evolutionProposalTarget}.`;
  }
  if (telemetry.evolutionReadinessTarget && telemetry.evolutionReadiness > 0) {
    return `Поведение двигает характер к ${telemetry.evolutionReadinessTarget}: ${Math.round(telemetry.evolutionReadiness)}%.`;
  }
  const dominantDrift = strongestEntry(telemetry.behaviorDrift) ?? strongestEntry(telemetry.traitDrift);
  if (dominantDrift) {
    return `Это действие заметнее всего повлияло на ${dominantDrift[0]} (${formatSigned(dominantDrift[1])}).`;
  }
  return details[0];
}

function dominantAxis(axes: Record<BehaviorAxis, number>): BehaviorAxis {
  return (Object.keys(axes) as BehaviorAxis[])
    .reduce((best, axis) => axes[axis] > axes[best] ? axis : best, 'care');
}

function strongestEntry<T extends string>(values: Partial<Record<T, number>>): [T, number] | null {
  let best: [T, number] | null = null;
  for (const [key, value] of Object.entries(values) as Array<[T, number]>) {
    if (value === 0) continue;
    if (!best || Math.abs(value) > Math.abs(best[1])) best = [key, value];
  }
  return best;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function isExplainabilityRecord(value: unknown): value is ExplainabilityRecord {
  if (!isObject(value)) return false;
  if (!isObject(value.command)) return false;
  if (typeof value.command.commandId !== 'string') return false;
  if (typeof value.command.type !== 'string') return false;
  if (typeof value.command.at !== 'string') return false;
  if (!Array.isArray(value.events)) return false;
  if (!isObject(value.statDeltas)) return false;
  if (typeof value.xpDelta !== 'number') return false;
  if (typeof value.coinDelta !== 'number') return false;
  if (value.blockedAction !== null && !isObject(value.blockedAction)) return false;
  if (!Array.isArray(value.appliedModifiers)) return false;
  if (value.meta !== undefined && !isObject(value.meta)) return false;
  if (value.personalityTelemetry !== undefined && !isObject(value.personalityTelemetry)) return false;
  if (typeof value.engineVersion !== 'string') return false;
  if (typeof value.registryVersion !== 'string') return false;
  if (typeof value.recordedAt !== 'string') return false;
  return true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
