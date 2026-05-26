import {
  clearActivityDismissal,
  completePendingActivities,
  createPendingActivity,
  dismissActivity,
  prunePendingActivities,
  type DismissedActivityState,
  type PendingActivityState,
} from './timeOfDayActivities';
import type { ActivityTarget } from './timeOfDayActivities';
import type { QuietHoursConfig, TimeOfDayTuningConfig } from './timeOfDayActivities';
import { DEFAULT_TIME_OF_DAY_QUIET_HOURS, type TimeOfDayActivityConfigPatch } from './timeOfDayActivityConfig';

const DISMISSED_KEY = 'zdesagochi:proactive-dismissed:v1';
const PENDING_KEY = 'zdesagochi:proactive-pending:v1';
const LAST_ROUTINE_KEY = 'zdesagochi:proactive-last-routine:v1';
const SCHEDULE_KEY = 'zdesagochi:proactive-schedule:v1';
const ANALYTICS_KEY = 'zdesagochi:proactive-analytics:v1';
const TUNING_KEY = 'zdesagochi:proactive-tuning:v1';
const CONFIG_PATCH_KEY = 'zdesagochi:proactive-config-patch:v1';
const QUIET_HOURS_KEY = 'zdesagochi:proactive-quiet-hours:v1';
const REMOTE_CONFIG_KEY = 'zdesagochi:proactive-remote-config:v1';
const REMOTE_CONFIG_URL_KEY = 'zdesagochi:proactive-remote-config-url:v1';
const AB_COHORT_KEY = 'zdesagochi:proactive-ab-cohort:v1';

export interface SuggestionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ScheduleLearningState {
  samples: Array<{ dateKey: string; firstOpenMinute: number; timezoneOffsetMinutes: number }>;
  learnedOffsetHours: number;
  lastRecordedAt?: string;
}

export interface ActivityAnalyticsState {
  activities: Record<string, {
    shown: number;
    opened: number;
    dismissed: number;
    completed: number;
    lastShownAt?: string;
    lastOpenedAt?: string;
    lastDismissedAt?: string;
    lastCompletedAt?: string;
  }>;
}

export interface ProactiveRuntimeSettings {
  tuningConfig: TimeOfDayTuningConfig;
  quietHours: QuietHoursConfig;
  abCohort: string;
  configPatch?: TimeOfDayActivityConfigPatch;
  remoteConfig?: RemoteProactiveConfig;
}

export interface RemoteProactiveConfig {
  version: string;
  tuningConfig?: TimeOfDayTuningConfig;
  timeOfDayConfigPatch?: TimeOfDayActivityConfigPatch;
  quietHours?: Partial<QuietHoursConfig>;
  experiments?: {
    enabled: boolean;
    cohorts: string[];
    cohortScoreMultipliers?: Record<string, Record<string, number>>;
  };
  updatedAt?: string;
}

export const DEFAULT_QUIET_HOURS: QuietHoursConfig = DEFAULT_TIME_OF_DAY_QUIET_HOURS;

export function loadDismissedActivities(storage: SuggestionStorage, now = new Date()): DismissedActivityState[] {
  const parsed = readArray<DismissedActivityState>(storage, DISMISSED_KEY);
  return parsed.filter(item => Boolean(item.activityId) && new Date(item.cooldownUntil).getTime() > now.getTime());
}

export function saveDismissedActivities(storage: SuggestionStorage, value: DismissedActivityState[]): void {
  storage.setItem(DISMISSED_KEY, JSON.stringify(value.slice(0, 50)));
}

export function dismissSuggestionActivity(storage: SuggestionStorage, activityId: string, now = new Date()): DismissedActivityState[] {
  const next = dismissActivity(activityId, now, loadDismissedActivities(storage, now));
  saveDismissedActivities(storage, next);
  recordSuggestionAnalytics(storage, activityId, 'dismissed', now);
  return next;
}

export function loadPendingActivities(storage: SuggestionStorage, now = new Date()): PendingActivityState[] {
  const pending = prunePendingActivities(readArray<PendingActivityState>(storage, PENDING_KEY), now);
  savePendingActivities(storage, pending);
  return pending;
}

export function savePendingActivities(storage: SuggestionStorage, value: PendingActivityState[]): void {
  storage.setItem(PENDING_KEY, JSON.stringify(value.slice(0, 20)));
}

export function startPendingActivity(
  storage: SuggestionStorage,
  suggestion: { activityId: string; target?: ActivityTarget },
  now = new Date(),
): PendingActivityState[] {
  const pending = createPendingActivity(suggestion, now);
  if (!pending) return loadPendingActivities(storage, now);
  const next = [pending, ...loadPendingActivities(storage, now).filter(item => item.activityId !== pending.activityId)];
  savePendingActivities(storage, next);
  return next;
}

export function recordActivityCompletion(
  storage: SuggestionStorage,
  completion: PendingActivityState['expectedCompletion'],
  now = new Date(),
): string[] {
  const result = completePendingActivities(loadPendingActivities(storage, now), completion, now);
  savePendingActivities(storage, result.pending);
  if (result.completedActivityIds.length > 0) {
    const dismissed = result.completedActivityIds.reduce(
      (current, activityId) => clearActivityDismissal(activityId, current),
      loadDismissedActivities(storage, now),
    );
    saveDismissedActivities(storage, dismissed);
    for (const activityId of result.completedActivityIds) {
      recordSuggestionAnalytics(storage, activityId, 'completed', now);
    }
  }
  return result.completedActivityIds;
}

export function getLastRoutineSuggestionAt(storage: SuggestionStorage): string | null {
  return storage.getItem(LAST_ROUTINE_KEY);
}

export function setLastRoutineSuggestionAt(storage: SuggestionStorage, at: string): void {
  storage.setItem(LAST_ROUTINE_KEY, at);
}

export function loadScheduleLearningState(storage: SuggestionStorage): ScheduleLearningState {
  const parsed = readJson<ScheduleLearningState>(storage, SCHEDULE_KEY);
  if (!parsed || !Array.isArray(parsed.samples)) return { samples: [], learnedOffsetHours: 0 };
  return {
    samples: parsed.samples
      .filter(sample => typeof sample.dateKey === 'string' && Number.isFinite(sample.firstOpenMinute))
      .slice(-14),
    learnedOffsetHours: clampScheduleOffset(parsed.learnedOffsetHours),
    lastRecordedAt: parsed.lastRecordedAt,
  };
}

export function recordDailyAppOpen(storage: SuggestionStorage, now = new Date()): ScheduleLearningState {
  const state = loadScheduleLearningState(storage);
  const timezoneOffsetMinutes = now.getTimezoneOffset();
  const lastTimezoneOffset = state.samples[state.samples.length - 1]?.timezoneOffsetMinutes;
  if (lastTimezoneOffset !== undefined && Math.abs(lastTimezoneOffset - timezoneOffsetMinutes) >= 4 * 60) {
    const reset: ScheduleLearningState = {
      samples: [{
        dateKey: dateKey(now),
        firstOpenMinute: minuteOfDay(now),
        timezoneOffsetMinutes,
      }],
      learnedOffsetHours: 0,
      lastRecordedAt: now.toISOString(),
    };
    storage.setItem(SCHEDULE_KEY, JSON.stringify(reset));
    return reset;
  }

  const today = dateKey(now);
  const samples = state.samples.some(sample => sample.dateKey === today)
    ? state.samples
    : [...state.samples, { dateKey: today, firstOpenMinute: minuteOfDay(now), timezoneOffsetMinutes }].slice(-14);
  const learnedOffsetHours = computeLearnedScheduleOffset(samples);
  const next = { samples, learnedOffsetHours, lastRecordedAt: now.toISOString() };
  storage.setItem(SCHEDULE_KEY, JSON.stringify(next));
  return next;
}

export function getLearnedScheduleOffset(storage: SuggestionStorage): number {
  return loadScheduleLearningState(storage).learnedOffsetHours;
}

export function computeLearnedScheduleOffset(samples: ScheduleLearningState['samples']): number {
  if (samples.length < 2) return 0;
  const sorted = samples.map(sample => sample.firstOpenMinute).sort((a, b) => a - b);
  const medianMinute = sorted[Math.floor(sorted.length / 2)];
  const medianHour = medianMinute / 60;
  return clampScheduleOffset(Math.round((medianHour - 8) * 2) / 2);
}

export function loadActivityAnalytics(storage: SuggestionStorage): ActivityAnalyticsState {
  const parsed = readJson<ActivityAnalyticsState>(storage, ANALYTICS_KEY);
  if (!parsed || typeof parsed.activities !== 'object' || parsed.activities === null) return { activities: {} };
  return { activities: parsed.activities };
}

export function recordSuggestionAnalytics(
  storage: SuggestionStorage,
  activityId: string,
  event: 'shown' | 'opened' | 'dismissed' | 'completed',
  now = new Date(),
): ActivityAnalyticsState {
  const state = loadActivityAnalytics(storage);
  const current = state.activities[activityId] ?? { shown: 0, opened: 0, dismissed: 0, completed: 0 };
  const capitalized = `${event.charAt(0).toUpperCase()}${event.slice(1)}` as 'Shown' | 'Opened' | 'Dismissed' | 'Completed';
  const next = {
    ...state,
    activities: {
      ...state.activities,
      [activityId]: {
        ...current,
        [event]: current[event] + 1,
        [`last${capitalized}At`]: now.toISOString(),
      },
    },
  };
  storage.setItem(ANALYTICS_KEY, JSON.stringify(next));
  return next;
}

export function loadProactiveRuntimeSettings(storage: SuggestionStorage): ProactiveRuntimeSettings {
  return {
    tuningConfig: readJson<TimeOfDayTuningConfig>(storage, TUNING_KEY) ?? {},
    configPatch: readJson<TimeOfDayActivityConfigPatch>(storage, CONFIG_PATCH_KEY) ?? undefined,
    quietHours: { ...DEFAULT_QUIET_HOURS, ...(readJson<QuietHoursConfig>(storage, QUIET_HOURS_KEY) ?? {}) },
    abCohort: getOrCreateAbCohort(storage),
  };
}

export function saveProactiveRuntimeSettings(storage: SuggestionStorage, settings: ProactiveRuntimeSettings): void {
  storage.setItem(TUNING_KEY, JSON.stringify(settings.tuningConfig));
  storage.setItem(QUIET_HOURS_KEY, JSON.stringify(settings.quietHours));
  if (settings.configPatch) storage.setItem(CONFIG_PATCH_KEY, JSON.stringify(settings.configPatch));
  else storage.removeItem(CONFIG_PATCH_KEY);
}

export function loadEffectiveProactiveRuntimeSettings(storage: SuggestionStorage): ProactiveRuntimeSettings {
  const local = loadProactiveRuntimeSettings(storage);
  const remote = loadRemoteProactiveConfig(storage);
  const cohorts = remote?.experiments?.enabled ? remote.experiments.cohorts : undefined;
  const abCohort = getOrCreateAbCohort(storage, cohorts);
  return {
    tuningConfig: mergeTuningConfigs(local.tuningConfig, remote?.tuningConfig, {
      cohortScoreMultipliers: remote?.experiments?.cohortScoreMultipliers,
    }),
    quietHours: { ...local.quietHours, ...(remote?.quietHours ?? {}) },
    abCohort,
    configPatch: mergeConfigPatches(remote?.timeOfDayConfigPatch, local.configPatch),
    remoteConfig: remote ?? undefined,
  };
}

export function loadRemoteProactiveConfig(storage: SuggestionStorage): RemoteProactiveConfig | null {
  return readJson<RemoteProactiveConfig>(storage, REMOTE_CONFIG_KEY);
}

export function saveRemoteProactiveConfig(storage: SuggestionStorage, config: RemoteProactiveConfig): void {
  storage.setItem(REMOTE_CONFIG_KEY, JSON.stringify({ ...config, updatedAt: new Date().toISOString() }));
}

export async function fetchRemoteProactiveConfig(
  storage: SuggestionStorage,
  url: string,
  fetcher: typeof fetch = fetch,
  verifySecret?: string,
): Promise<RemoteProactiveConfig> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Remote config HTTP ${response.status}`);
  const config = await response.json() as RemoteProactiveConfig;
  if (!config.version) throw new Error('Remote config requires version');
  if (verifySecret) await verifyRemoteProactiveConfigSignature(config, verifySecret);
  saveRemoteProactiveConfig(storage, config);
  saveRemoteConfigUrl(storage, url);
  return config;
}

export async function verifyRemoteProactiveConfigSignature(config: RemoteProactiveConfig, secret: string): Promise<boolean> {
  const signature = (config as RemoteProactiveConfig & { signature?: string }).signature;
  if (!signature) throw new Error('Remote config signature is required');
  const unsigned = { ...config } as Record<string, unknown>;
  delete unsigned.signature;
  const expected = await signRemoteProactiveConfig(unsigned, secret);
  if (signature !== expected) throw new Error('Remote config signature mismatch');
  return true;
}

export async function signRemoteProactiveConfig(config: unknown, secret: string): Promise<string> {
  const canonical = JSON.stringify(config);
  const bytes = new TextEncoder().encode(`${secret}:${canonical}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const binary = Array.from(new Uint8Array(digest), byte => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

export function loadRemoteConfigUrl(storage: SuggestionStorage): string {
  return storage.getItem(REMOTE_CONFIG_URL_KEY) ?? '';
}

export function saveRemoteConfigUrl(storage: SuggestionStorage, url: string): void {
  if (url.trim()) storage.setItem(REMOTE_CONFIG_URL_KEY, url.trim());
  else storage.removeItem(REMOTE_CONFIG_URL_KEY);
}

export function getOrCreateAbCohort(storage: SuggestionStorage, cohorts = ['control', 'routine_soft', 'routine_bold']): string {
  const valid = cohorts.length > 0 ? cohorts : ['control'];
  const existing = storage.getItem(AB_COHORT_KEY);
  if (existing && valid.includes(existing)) return existing;
  const cohort = valid[Math.floor(Math.random() * valid.length)] ?? 'control';
  storage.setItem(AB_COHORT_KEY, cohort);
  return cohort;
}

export function exportActivityAnalytics(storage: SuggestionStorage): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    schedule: loadScheduleLearningState(storage),
    analytics: loadActivityAnalytics(storage),
    settings: loadEffectiveProactiveRuntimeSettings(storage),
  }, null, 2);
}

function mergeTuningConfigs(...configs: Array<TimeOfDayTuningConfig | undefined>): TimeOfDayTuningConfig {
  const merged: TimeOfDayTuningConfig = {};
  for (const config of configs) {
    if (!config) continue;
    merged.globalScoreMultiplier = config.globalScoreMultiplier ?? merged.globalScoreMultiplier;
    merged.disabledActivityIds = [...new Set([...(merged.disabledActivityIds ?? []), ...(config.disabledActivityIds ?? [])])];
    merged.activityScoreMultipliers = {
      ...(merged.activityScoreMultipliers ?? {}),
      ...(config.activityScoreMultipliers ?? {}),
    };
    merged.cohortScoreMultipliers = {
      ...(merged.cohortScoreMultipliers ?? {}),
      ...(config.cohortScoreMultipliers ?? {}),
    };
  }
  return merged;
}

function mergeConfigPatches(
  ...configs: Array<TimeOfDayActivityConfigPatch | undefined>
): TimeOfDayActivityConfigPatch | undefined {
  let merged: TimeOfDayActivityConfigPatch | undefined;
  for (const config of configs) {
    if (!config) continue;
    merged = {
      ...(merged ?? {}),
      ...config,
      fallbackOverrides: {
        ...(merged?.fallbackOverrides ?? {}),
        ...(config.fallbackOverrides ?? {}),
      },
      scoring: {
        ...(merged?.scoring ?? {}),
        ...(config.scoring ?? {}),
      },
      defaultQuietHours: {
        ...(merged?.defaultQuietHours ?? {}),
        ...(config.defaultQuietHours ?? {}),
      },
      defaultTuningConfig: mergeTuningConfigs(merged?.defaultTuningConfig, config.defaultTuningConfig),
      activityRuleOverrides: {
        ...(merged?.activityRuleOverrides ?? {}),
        ...(config.activityRuleOverrides ?? {}),
      },
      disabledActivityIds: [
        ...new Set([...(merged?.disabledActivityIds ?? []), ...(config.disabledActivityIds ?? [])]),
      ],
      activityRules: config.activityRules ?? merged?.activityRules,
    };
  }
  return merged;
}

function readArray<T>(storage: SuggestionStorage, key: string): T[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    storage.removeItem(key);
    return [];
  }
}

function readJson<T>(storage: SuggestionStorage, key: string): T | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function clampScheduleOffset(value: number): number {
  return Math.max(-2, Math.min(2, Number.isFinite(value) ? value : 0));
}

function dateKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function minuteOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}
