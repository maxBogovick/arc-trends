import type { AppliedModifier, DomainEvent, PetCommand, PetCommandResult } from '@zdesagochi/personality-core';

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
  blocked: boolean;
  record: ExplainabilityRecord;
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
    engineVersion: result.engineVersion,
    registryVersion: result.registryVersion,
    recordedAt,
  };
  if (result.meta) record.meta = result.meta;
  return record;
}

export function explainCommandRecord(record: ExplainabilityRecord): CommandExplanation {
  const details: string[] = [];
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
    } else if (event.type === 'evolution_recorded') {
      details.push(`Evolution recorded: ${event.record.toPersonalityId}`);
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

  return {
    commandId: record.command.commandId,
    commandType: record.command.type,
    at: record.command.at,
    title: `${record.command.type} @ ${record.command.at}`,
    summary,
    details,
    blocked: Boolean(record.blockedAction),
    record,
  };
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${Number.isInteger(value) ? value : Number(value.toFixed(2))}`;
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
  if (typeof value.engineVersion !== 'string') return false;
  if (typeof value.registryVersion !== 'string') return false;
  if (typeof value.recordedAt !== 'string') return false;
  return true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
