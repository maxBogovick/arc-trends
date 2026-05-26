import type { InventoryItem, Room, ShopItem, Pet } from '../api/types';
import type { BehaviorAxis, PersonalityId, StatKey, TraitKey } from './types';
import type { SupportedPetActionId } from './petActionIds';
import {
  DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG,
  resolveTimeOfDayActivityConfig,
  type TimeOfDayActivityConfig,
  type TimeOfDayActivityConfigPatch,
} from './timeOfDayActivityConfig';

export type DayPeriod = 'early_morning' | 'morning' | 'day' | 'evening' | 'night';

export type ActivityTarget =
  | { kind: 'action'; actionId: SupportedPetActionId }
  | { kind: 'deep_link'; destination: 'inventory' | 'shop' | 'room' | 'assistant'; filter?: string }
  | { kind: 'inventory_item'; itemId?: string; itemType?: InventoryItem['item']['type'] }
  | { kind: 'room'; roomId?: string }
  | { kind: 'future_command'; commandId: string };

export interface DismissedActivityState {
  activityId: string;
  dismissedAt: string;
  cooldownUntil: string;
  dismissCount: number;
}

export interface PendingActivityState {
  activityId: string;
  target: ActivityTarget;
  openedAt: string;
  expiresAt: string;
  expectedCompletion:
    | { kind: 'action'; actionId: SupportedPetActionId }
    | { kind: 'inventory_item'; itemId?: string; itemType?: InventoryItem['item']['type'] }
    | { kind: 'room_equipped'; roomId?: string }
    | { kind: 'assistant_viewed' };
}

export interface TimeOfDayActivitySuggestion {
  id: string;
  activityId: string;
  message: string;
  reason: string;
  score: number;
  period: DayPeriod;
  target?: ActivityTarget;
  actionId?: SupportedPetActionId;
  ctaLabel?: string;
  debug?: TimeOfDaySuggestionDebug;
}

export interface TimeOfDayTuningConfig {
  disabledActivityIds?: string[];
  activityScoreMultipliers?: Record<string, number>;
  cohortScoreMultipliers?: Record<string, Record<string, number>>;
  globalScoreMultiplier?: number;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface TimeOfDayDebugCandidate {
  activityId: string;
  score: number;
  rawScore: number;
  blockedBy?: string;
  factors: {
    baseScore: number;
    periodWeight: number;
    personalityWeight: number;
    statUrgencyWeight: number;
    traitWeight: number;
    behaviorWeight: number;
    inventoryOrRoomBonus: number;
    availabilityMultiplier: number;
    safetyMultiplier: number;
    periodCompatibilityMultiplier: number;
    personalityCompatibilityMultiplier: number;
    dismissalMultiplier: number;
    repetitionMultiplier: number;
    tuningMultiplier: number;
  };
}

export interface TimeOfDaySuggestionDebug {
  period: DayPeriod;
  quietHoursActive: boolean;
  candidates: TimeOfDayDebugCandidate[];
}

export interface ActivityRule {
  id: string;
  activityId: string;
  target?: ActivityTarget;
  baseScore: number;
  periodWeights: Partial<Record<DayPeriod, number>>;
  personalityWeights?: Partial<Record<PersonalityId, number>>;
  traitWeights?: Partial<Record<TraitKey, number>>;
  behaviorWeights?: Partial<Record<BehaviorAxis, number>>;
  statWeights?: Partial<Record<StatKey, number>>;
  inventoryBonus?: { itemId?: string; itemType?: InventoryItem['item']['type']; weight: number };
  roomBonus?: { roomId: string; weight: number };
  hardGuards?: ActivityGuard[];
  message: string;
  messageVariants?: string[];
  reason: string;
  ctaLabel?: string;
}

export type ActivityGuard =
  | { type: 'awake' }
  | { type: 'asleep' }
  | { type: 'min_stat'; stat: StatKey; value: number }
  | { type: 'max_stat'; stat: StatKey; value: number }
  | { type: 'max_trauma'; value: number }
  | { type: 'min_trauma'; value: number }
  | { type: 'personality_in'; ids: PersonalityId[] }
  | { type: 'personality_not_in'; ids: PersonalityId[] }
  | { type: 'owned_item'; itemId?: string; itemType?: InventoryItem['item']['type'] }
  | { type: 'unlocked_room'; roomId: string };

export interface TimeOfDaySuggestionInput {
  pet: Pet;
  now?: Date;
  inventory?: InventoryItem[];
  rooms?: Room[];
  shopItems?: ShopItem[];
  dismissedActivities?: DismissedActivityState[];
  pendingActivities?: PendingActivityState[];
  scheduleOffsetHours?: number;
  lastRoutineSuggestionAt?: string | null;
  tuningConfig?: TimeOfDayTuningConfig;
  quietHours?: QuietHoursConfig;
  includeDebug?: boolean;
  abCohort?: string;
  copyVariantSeed?: string;
  configPatch?: TimeOfDayActivityConfigPatch;
}

export function getDayPeriod(
  date: Date,
  scheduleOffsetHours = 0,
  config: TimeOfDayActivityConfig = DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG,
): DayPeriod {
  const clampedOffset = Math.max(-2, Math.min(2, scheduleOffsetHours));
  const hour = (((date.getHours() + date.getMinutes() / 60) - clampedOffset) + 24) % 24;
  return config.periods.find(period => isHourInPeriod(hour, period.startHour, period.endHour))?.id ?? 'night';
}

export function shouldResetScheduleOffset(lastTimezoneOffsetMinutes: number, currentTimezoneOffsetMinutes: number): boolean {
  return Math.abs(currentTimezoneOffsetMinutes - lastTimezoneOffsetMinutes) >= 4 * 60;
}

export function dismissActivity(
  activityId: string,
  now: Date,
  previous: DismissedActivityState[] = [],
): DismissedActivityState[] {
  const existing = previous.find(item => item.activityId === activityId);
  const dismissCount = (existing?.dismissCount ?? 0) + 1;
  const cooldownMinutes = dismissCount === 1 ? 30 : dismissCount === 2 ? 120 : 6 * 60;
  const next: DismissedActivityState = {
    activityId,
    dismissedAt: now.toISOString(),
    cooldownUntil: new Date(now.getTime() + cooldownMinutes * 60_000).toISOString(),
    dismissCount,
  };
  return [next, ...previous.filter(item => item.activityId !== activityId)].slice(0, 50);
}

export function clearActivityDismissal(activityId: string, previous: DismissedActivityState[] = []): DismissedActivityState[] {
  return previous.filter(item => item.activityId !== activityId);
}

export function createPendingActivity(
  suggestion: { activityId: string; target?: ActivityTarget },
  now: Date,
): PendingActivityState | null {
  if (!suggestion.target || suggestion.target.kind === 'action') return null;
  const expectedCompletion = expectedCompletionForTarget(suggestion.target);
  if (!expectedCompletion) return null;
  return {
    activityId: suggestion.activityId,
    target: suggestion.target,
    openedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 60_000).toISOString(),
    expectedCompletion,
  };
}

export function completePendingActivities(
  pending: PendingActivityState[] = [],
  completion: PendingActivityState['expectedCompletion'],
  now: Date,
): { completedActivityIds: string[]; pending: PendingActivityState[] } {
  const completedActivityIds: string[] = [];
  const remaining = pending.filter(item => {
    if (new Date(item.expiresAt).getTime() < now.getTime()) return false;
    if (matchesCompletion(item.expectedCompletion, completion)) {
      completedActivityIds.push(item.activityId);
      return false;
    }
    return true;
  });
  return { completedActivityIds, pending: remaining };
}

export function prunePendingActivities(pending: PendingActivityState[] = [], now: Date): PendingActivityState[] {
  return pending.filter(item => new Date(item.expiresAt).getTime() >= now.getTime());
}

export function getTimeOfDayActivitySuggestion(input: TimeOfDaySuggestionInput): TimeOfDayActivitySuggestion {
  const now = input.now ?? new Date();
  const config = resolveTimeOfDayActivityConfig(input.configPatch);
  const tuningConfig = mergeTuningConfig(config.defaultTuningConfig, input.tuningConfig);
  const quietHours = input.quietHours ?? config.defaultQuietHours;
  const period = getEffectivePeriod(now, input.scheduleOffsetHours ?? 0, config);
  const quietHoursActive = isQuietHoursActive(now, quietHours);
  if (quietHoursActive) {
    return fallbackSuggestion(config, period, 'Routine-предложения подавлены режимом тишины.', debugReport(period, true, []));
  }

  const lastRoutineAt = input.lastRoutineSuggestionAt ? new Date(input.lastRoutineSuggestionAt).getTime() : 0;
  const routineSuppressed = lastRoutineAt > 0 && now.getTime() - lastRoutineAt < config.scoring.routineSuggestionCooldownMinutes * 60_000;

  if (routineSuppressed) return fallbackSuggestion(config, period, 'Недавно уже было предложение распорядка.', debugReport(period, false, []));

  const candidates = config.activityRules.map(rule => scoreRule(rule, input, config, tuningConfig, period, now));
  const scored = candidates
    .filter((item): item is { rule: ActivityRule; score: number; debug: TimeOfDayDebugCandidate } => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const debug = debugReport(period, false, candidates.map(item => item.debug));
  if (!best || best.score <= 0) return fallbackSuggestion(config, period, 'Нет подходящей активности для текущего состояния.', debug);

  const target = best.rule.target;
  const actionId = target?.kind === 'action' ? target.actionId : undefined;
  return {
    id: `time:${period}:${best.rule.activityId}`,
    activityId: best.rule.activityId,
    message: chooseRuleMessage(best.rule, input, now),
    reason: best.rule.reason,
    score: best.score,
    period,
    target,
    actionId,
    ctaLabel: best.rule.ctaLabel ?? ctaLabelForTarget(target),
    debug: input.includeDebug ? debug : undefined,
  };
}

export function getTimeOfDayActivityDebugReport(input: TimeOfDaySuggestionInput): TimeOfDaySuggestionDebug {
  const config = resolveTimeOfDayActivityConfig(input.configPatch);
  return getTimeOfDayActivitySuggestion({ ...input, includeDebug: true }).debug
    ?? debugReport(getEffectivePeriod(input.now ?? new Date(), input.scheduleOffsetHours ?? 0, config), false, []);
}

export function isQuietHoursActive(now: Date, config?: QuietHoursConfig): boolean {
  if (!config?.enabled) return false;
  const start = normalizeHour(config.startHour);
  const end = normalizeHour(config.endHour);
  const current = now.getHours() + now.getMinutes() / 60;
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function getEffectivePeriod(now: Date, offset: number, config: TimeOfDayActivityConfig): DayPeriod {
  const minutesUntilBoundary = minutesUntilNextBoundary(now, offset, config);
  if (minutesUntilBoundary < config.scoring.boundaryLookaheadMinutes) {
    const current = getDayPeriod(now, offset, config);
    const order = config.periods.map(period => period.id);
    return order[(order.indexOf(current) + 1) % order.length];
  }
  return getDayPeriod(now, offset, config);
}

function minutesUntilNextBoundary(now: Date, offset: number, config: TimeOfDayActivityConfig): number {
  const current = getDayPeriod(now, offset, config);
  for (let i = 1; i <= 24 * 60; i++) {
    const next = new Date(now.getTime() + i * 60_000);
    if (getDayPeriod(next, offset, config) !== current) return i;
  }
  return Infinity;
}

function fallbackSuggestion(config: TimeOfDayActivityConfig, period: DayPeriod, reason: string, debug?: TimeOfDaySuggestionDebug): TimeOfDayActivitySuggestion {
  return {
    id: `time:${period}:fallback`,
    activityId: `${period}:fallback`,
    message: config.fallbacks[period],
    reason,
    score: config.scoring.fallbackScore,
    period,
    debug,
  };
}

function scoreRule(
  rule: ActivityRule,
  input: TimeOfDaySuggestionInput,
  config: TimeOfDayActivityConfig,
  tuningConfig: TimeOfDayTuningConfig,
  period: DayPeriod,
  now: Date,
): { rule: ActivityRule; score: number; debug: TimeOfDayDebugCandidate } {
  const emptyFactors = makeEmptyFactors(rule.baseScore);
  if (tuningConfig.disabledActivityIds?.includes(rule.activityId)) {
    return blockedRule(rule, 'disabled_by_tuning', emptyFactors);
  }
  const failedGuard = rule.hardGuards?.find(guard => !passesGuard(guard, input));
  if (failedGuard) return blockedRule(rule, `guard:${failedGuard.type}`, emptyFactors);

  const pet = input.pet;
  const periodWeight = rule.periodWeights[period] ?? config.scoring.defaultMissingPeriodWeight;
  const personalityWeight = rule.personalityWeights?.[pet.personality as PersonalityId] ?? 0;
  const statUrgencyWeight = scoreStats(rule, pet);
  const traitWeight = scoreTraits(rule, pet);
  const behaviorWeight = scoreBehavior(rule, pet);
  const inventoryOrRoomBonus = scoreAvailabilityBonus(rule, input);

  const rawScore = rule.baseScore + periodWeight + personalityWeight + statUrgencyWeight + traitWeight + behaviorWeight + inventoryOrRoomBonus;
  const availabilityMultiplier = getAvailabilityMultiplier(rule, input);
  const safetyMultiplier = getSafetyMultiplier(rule, input, period);
  const periodCompatibilityMultiplier = periodWeight <= config.scoring.periodHardNegativeWeight
    ? config.scoring.periodHardNegativeMultiplier
    : periodWeight >= config.scoring.periodStrongPositiveWeight
      ? config.scoring.periodStrongPositiveMultiplier
      : 1;
  const personalityCompatibilityMultiplier = personalityWeight <= config.scoring.personalityHardNegativeWeight
    ? config.scoring.personalityHardNegativeMultiplier
    : personalityWeight >= config.scoring.personalityStrongPositiveWeight
      ? config.scoring.personalityStrongPositiveMultiplier
      : 1;
  const dismissalMultiplier = getDismissalMultiplier(rule.activityId, input.dismissedActivities, now);
  const repetitionMultiplier = input.pendingActivities?.some(item => item.activityId === rule.activityId) ? config.scoring.pendingRepetitionMultiplier : 1;
  const tuningMultiplier = (tuningConfig.globalScoreMultiplier ?? 1)
    * (tuningConfig.activityScoreMultipliers?.[rule.activityId] ?? 1);
  const cohortMultiplier = input.abCohort
    ? tuningConfig.cohortScoreMultipliers?.[input.abCohort]?.[rule.activityId] ?? 1
    : 1;

  const score = rawScore
    * availabilityMultiplier
    * safetyMultiplier
    * periodCompatibilityMultiplier
    * personalityCompatibilityMultiplier
    * dismissalMultiplier
    * repetitionMultiplier
    * tuningMultiplier
    * cohortMultiplier;
  const debug: TimeOfDayDebugCandidate = {
    activityId: rule.activityId,
    score: Number.isFinite(score) && score > 0 ? score : 0,
    rawScore,
    factors: {
      baseScore: rule.baseScore,
      periodWeight,
      personalityWeight,
      statUrgencyWeight,
      traitWeight,
      behaviorWeight,
      inventoryOrRoomBonus,
      availabilityMultiplier,
      safetyMultiplier,
      periodCompatibilityMultiplier,
      personalityCompatibilityMultiplier,
      dismissalMultiplier,
      repetitionMultiplier,
      tuningMultiplier: tuningMultiplier * cohortMultiplier,
    },
  };
  return { rule, score: debug.score, debug };
}

function chooseRuleMessage(rule: ActivityRule, input: TimeOfDaySuggestionInput, now: Date): string {
  const variants = [rule.message, ...(rule.messageVariants ?? [])].filter(Boolean);
  if (variants.length <= 1) return rule.message;
  const seed = `${input.copyVariantSeed ?? input.pet.id}:${input.abCohort ?? 'control'}:${rule.activityId}:${dateKey(now)}`;
  return variants[hashString(seed) % variants.length];
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function dateKey(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function makeEmptyFactors(baseScore: number): TimeOfDayDebugCandidate['factors'] {
  return {
    baseScore,
    periodWeight: 0,
    personalityWeight: 0,
    statUrgencyWeight: 0,
    traitWeight: 0,
    behaviorWeight: 0,
    inventoryOrRoomBonus: 0,
    availabilityMultiplier: 1,
    safetyMultiplier: 1,
    periodCompatibilityMultiplier: 1,
    personalityCompatibilityMultiplier: 1,
    dismissalMultiplier: 1,
    repetitionMultiplier: 1,
    tuningMultiplier: 1,
  };
}

function blockedRule(
  rule: ActivityRule,
  blockedBy: string,
  factors: TimeOfDayDebugCandidate['factors'],
): { rule: ActivityRule; score: number; debug: TimeOfDayDebugCandidate } {
  return {
    rule,
    score: 0,
    debug: {
      activityId: rule.activityId,
      score: 0,
      rawScore: 0,
      blockedBy,
      factors,
    },
  };
}

function debugReport(period: DayPeriod, quietHoursActive: boolean, candidates: TimeOfDayDebugCandidate[]): TimeOfDaySuggestionDebug {
  return {
    period,
    quietHoursActive,
    candidates: [...candidates].sort((a, b) => b.score - a.score).slice(0, 12),
  };
}

function normalizeHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

function passesGuard(guard: ActivityGuard, input: TimeOfDaySuggestionInput): boolean {
  const pet = input.pet;
  switch (guard.type) {
    case 'awake':
      return !pet.isAsleep;
    case 'asleep':
      return pet.isAsleep;
    case 'min_stat':
      return pet.stats[guard.stat] >= guard.value;
    case 'max_stat':
      return pet.stats[guard.stat] <= guard.value;
    case 'max_trauma':
      return pet.traumaLevel <= guard.value;
    case 'min_trauma':
      return pet.traumaLevel >= guard.value;
    case 'personality_in':
      return guard.ids.includes(pet.personality as PersonalityId);
    case 'personality_not_in':
      return !guard.ids.includes(pet.personality as PersonalityId);
    case 'owned_item':
      return hasInventoryItem(input.inventory, guard.itemId, guard.itemType);
    case 'unlocked_room':
      return Boolean(input.rooms?.some(room => room.id === guard.roomId && room.unlocked));
  }
}

function scoreStats(rule: ActivityRule, pet: Pet): number {
  let score = 0;
  for (const [stat, weight] of Object.entries(rule.statWeights ?? {}) as Array<[StatKey, number]>) {
    const value = pet.stats[stat];
    const need = stat === 'hunger' || stat === 'energy' || stat === 'health' || stat === 'cleanliness' || stat === 'bond'
      ? Math.max(0, 80 - value) / 80
      : 0;
    score += need * weight;
  }
  return score;
}

function scoreTraits(rule: ActivityRule, pet: Pet): number {
  let score = 0;
  for (const [trait, weight] of Object.entries(rule.traitWeights ?? {}) as Array<[TraitKey, number]>) {
    score += ((pet.traitVector[trait] ?? 50) - 50) / 50 * weight;
  }
  return score;
}

function scoreBehavior(rule: ActivityRule, pet: Pet): number {
  let score = 0;
  for (const [axis, weight] of Object.entries(rule.behaviorWeights ?? {}) as Array<[BehaviorAxis, number]>) {
    score += ((pet.behaviorProfile?.axes[axis] ?? 0) / 100) * weight;
  }
  return score;
}

function scoreAvailabilityBonus(rule: ActivityRule, input: TimeOfDaySuggestionInput): number {
  let score = 0;
  if (rule.inventoryBonus && hasInventoryItem(input.inventory, rule.inventoryBonus.itemId, rule.inventoryBonus.itemType)) {
    score += rule.inventoryBonus.weight;
  }
  if (rule.roomBonus && input.rooms?.some(room => room.id === rule.roomBonus?.roomId && room.unlocked)) {
    score += rule.roomBonus.weight;
  }
  return score;
}

function getAvailabilityMultiplier(rule: ActivityRule, input: TimeOfDaySuggestionInput): number {
  const target = rule.target;
  if (!target) return 1;
  if (target.kind === 'inventory_item') return hasInventoryItem(input.inventory, target.itemId, target.itemType) ? 1 : 0;
  if (target.kind === 'room') return target.roomId ? (input.rooms?.some(room => room.id === target.roomId && room.unlocked) ? 1 : 0) : 1;
  return 1;
}

function getSafetyMultiplier(rule: ActivityRule, input: TimeOfDaySuggestionInput, period: DayPeriod): number {
  const config = resolveTimeOfDayActivityConfig(input.configPatch);
  const pet = input.pet;
  const actionId = rule.target?.kind === 'action' ? rule.target.actionId : undefined;
  if (actionId?.startsWith('play') && (pet.stats.energy < config.scoring.playEnergyFloor || pet.traumaLevel >= config.scoring.playTraumaCeiling)) return 0;
  if (period === 'night' && actionId?.startsWith('play') && !config.scoring.nightPlayExceptionPersonalities.includes(pet.personality as PersonalityId)) return 0;
  if (actionId === 'feed' && pet.stats.hunger > config.scoring.feedFullnessCeiling) return 0;
  if (actionId === 'bathe' && pet.stats.cleanliness > config.scoring.batheCleanlinessCeiling) return 0;
  if (actionId === 'heal' && pet.stats.health > config.scoring.healHealthCeiling && pet.traumaLevel < config.scoring.healTraumaFloor) return 0;
  return 1;
}

function isHourInPeriod(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

function mergeTuningConfig(base: TimeOfDayTuningConfig, overlay?: TimeOfDayTuningConfig): TimeOfDayTuningConfig {
  if (!overlay) return base;
  return {
    globalScoreMultiplier: overlay.globalScoreMultiplier ?? base.globalScoreMultiplier,
    disabledActivityIds: [...new Set([...(base.disabledActivityIds ?? []), ...(overlay.disabledActivityIds ?? [])])],
    activityScoreMultipliers: {
      ...(base.activityScoreMultipliers ?? {}),
      ...(overlay.activityScoreMultipliers ?? {}),
    },
    cohortScoreMultipliers: {
      ...(base.cohortScoreMultipliers ?? {}),
      ...(overlay.cohortScoreMultipliers ?? {}),
    },
  };
}

function getDismissalMultiplier(activityId: string, dismissed: DismissedActivityState[] = [], now: Date): number {
  const state = dismissed.find(item => item.activityId === activityId);
  if (!state) return 1;
  return new Date(state.cooldownUntil).getTime() > now.getTime() ? 0 : 1;
}

function hasInventoryItem(inventory: InventoryItem[] = [], itemId?: string, itemType?: InventoryItem['item']['type']): boolean {
  return inventory.some(entry =>
    entry.quantity > 0 &&
    (itemId ? entry.itemId === itemId : true) &&
    (itemType ? entry.item.type === itemType : true),
  );
}

function expectedCompletionForTarget(target: ActivityTarget): PendingActivityState['expectedCompletion'] | null {
  if (target.kind === 'inventory_item') return { kind: 'inventory_item', itemId: target.itemId, itemType: target.itemType };
  if (target.kind === 'room') return { kind: 'room_equipped', roomId: target.roomId };
  if (target.kind === 'deep_link' && target.destination === 'assistant') return { kind: 'assistant_viewed' };
  if (target.kind === 'deep_link' && target.destination === 'inventory') return { kind: 'inventory_item' };
  if (target.kind === 'deep_link' && target.destination === 'room') return { kind: 'room_equipped' };
  return null;
}

function matchesCompletion(expected: PendingActivityState['expectedCompletion'], actual: PendingActivityState['expectedCompletion']): boolean {
  if (expected.kind !== actual.kind) return false;
  if (expected.kind === 'action' && actual.kind === 'action') return expected.actionId === actual.actionId;
  if (expected.kind === 'inventory_item' && actual.kind === 'inventory_item') {
    return (!expected.itemId || expected.itemId === actual.itemId) && (!expected.itemType || expected.itemType === actual.itemType);
  }
  if (expected.kind === 'room_equipped' && actual.kind === 'room_equipped') return !expected.roomId || expected.roomId === actual.roomId;
  return expected.kind === 'assistant_viewed';
}

function ctaLabelForTarget(target?: ActivityTarget): string | undefined {
  if (!target) return undefined;
  if (target.kind === 'action') return undefined;
  if (target.kind === 'inventory_item') return target.itemId ? 'Использовать' : 'Выбрать';
  if (target.kind === 'room') return 'Открыть';
  if (target.kind === 'deep_link') {
    if (target.destination === 'inventory') return 'Выбрать';
    if (target.destination === 'room') return 'Комнаты';
    if (target.destination === 'shop') return 'Подобрать';
    if (target.destination === 'assistant') return 'Открыть';
  }
  return undefined;
}
