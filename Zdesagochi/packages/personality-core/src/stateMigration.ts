import type { PersonalityState } from './coreState';
import { PERSONALITY_STATE_SCHEMA_VERSION } from './engineVersion';
import { createInitialBehaviorProfile } from './TraitEvolutionEngine';

export type PersonalityStateMigrationResult =
  | { ok: true; state: PersonalityState; migrated: boolean; fromVersion: number | null; toVersion: number }
  | { ok: false; reason: 'invalid_state' | 'unsupported_future_version'; fromVersion: number | null; toVersion: number };

type SchemaVersionReadResult =
  | { ok: true; version: number | null }
  | { ok: false; version: number | null };

export function migratePersonalityState(rawState: unknown): PersonalityStateMigrationResult {
  if (!isObject(rawState)) {
    return {
      ok: false,
      reason: 'invalid_state',
      fromVersion: null,
      toVersion: PERSONALITY_STATE_SCHEMA_VERSION,
    };
  }

  const schemaVersion = readSchemaVersion(rawState);
  const fromVersion = schemaVersion.version;
  if (!schemaVersion.ok) {
    return {
      ok: false,
      reason: 'invalid_state',
      fromVersion,
      toVersion: PERSONALITY_STATE_SCHEMA_VERSION,
    };
  }

  if (fromVersion !== null && fromVersion > PERSONALITY_STATE_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'unsupported_future_version',
      fromVersion,
      toVersion: PERSONALITY_STATE_SCHEMA_VERSION,
    };
  }

  if (!isPersonalityStateShape(rawState)) {
    return {
      ok: false,
      reason: 'invalid_state',
      fromVersion,
      toVersion: PERSONALITY_STATE_SCHEMA_VERSION,
    };
  }

  const state = {
    ...rawState,
    behaviorProfile: isObject(rawState.behaviorProfile)
      ? rawState.behaviorProfile
      : createInitialBehaviorProfile(),
    evolutionReadiness: typeof rawState.evolutionReadiness === 'number' ? rawState.evolutionReadiness : 0,
    evolutionReadinessTarget: typeof rawState.evolutionReadinessTarget === 'string' ? rawState.evolutionReadinessTarget : null,
    schemaVersion: PERSONALITY_STATE_SCHEMA_VERSION,
  };

  return {
    ok: true,
    state,
    migrated: fromVersion !== PERSONALITY_STATE_SCHEMA_VERSION,
    fromVersion,
    toVersion: PERSONALITY_STATE_SCHEMA_VERSION,
  };
}

function readSchemaVersion(value: Record<string, unknown>): SchemaVersionReadResult {
  if (value.schemaVersion === undefined) return { ok: true, version: null };
  if (
    typeof value.schemaVersion === 'number' &&
    Number.isInteger(value.schemaVersion) &&
    value.schemaVersion >= 1
  ) {
    return { ok: true, version: value.schemaVersion };
  }
  return {
    ok: false,
    version: typeof value.schemaVersion === 'number' && Number.isInteger(value.schemaVersion)
      ? value.schemaVersion
      : null,
  };
}

function isPersonalityStateShape(value: unknown): value is PersonalityState {
  if (!isObject(value)) return false;
  return (
    isObject(value.stats) &&
    typeof value.mood === 'string' &&
    typeof value.personality === 'string' &&
    typeof value.lastUpdated === 'string' &&
    Array.isArray(value.behavioralFlags) &&
    isObject(value.behavioralCounters) &&
    isObject(value.traitVector) &&
    Array.isArray(value.coreMemories) &&
    Array.isArray(value.evolutionHistory)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
