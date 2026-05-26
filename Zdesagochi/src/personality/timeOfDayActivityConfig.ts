import type { ActivityRule, DayPeriod, QuietHoursConfig, TimeOfDayTuningConfig } from './timeOfDayActivities';
import type { PersonalityId } from './types';

export interface DayPeriodDefinition {
  id: DayPeriod;
  startHour: number;
  endHour: number;
  fallbackMessage: string;
}

export interface TimeOfDayScoringPolicy {
  boundaryLookaheadMinutes: number;
  routineSuggestionCooldownMinutes: number;
  fallbackScore: number;
  defaultMissingPeriodWeight: number;
  periodHardNegativeWeight: number;
  periodStrongPositiveWeight: number;
  periodHardNegativeMultiplier: number;
  periodStrongPositiveMultiplier: number;
  personalityHardNegativeWeight: number;
  personalityStrongPositiveWeight: number;
  personalityHardNegativeMultiplier: number;
  personalityStrongPositiveMultiplier: number;
  pendingRepetitionMultiplier: number;
  nightPlayExceptionPersonalities: PersonalityId[];
  playEnergyFloor: number;
  playTraumaCeiling: number;
  feedFullnessCeiling: number;
  batheCleanlinessCeiling: number;
  healHealthCeiling: number;
  healTraumaFloor: number;
}

export interface TimeOfDayActivityConfig {
  periods: DayPeriodDefinition[];
  fallbacks: Record<DayPeriod, string>;
  scoring: TimeOfDayScoringPolicy;
  defaultQuietHours: QuietHoursConfig;
  defaultTuningConfig: TimeOfDayTuningConfig;
  activityRules: ActivityRule[];
}

export interface TimeOfDayActivityConfigPatch {
  periods?: DayPeriodDefinition[];
  fallbackOverrides?: Partial<Record<DayPeriod, string>>;
  scoring?: Partial<TimeOfDayScoringPolicy>;
  defaultQuietHours?: Partial<QuietHoursConfig>;
  defaultTuningConfig?: TimeOfDayTuningConfig;
  activityRules?: ActivityRule[];
  activityRuleOverrides?: Record<string, Partial<ActivityRule>>;
  disabledActivityIds?: string[];
}

export const TIME_OF_DAY_PERIODS: DayPeriodDefinition[] = [
  { id: 'early_morning', startHour: 5, endHour: 8, fallbackMessage: 'Начнем тихо. Я рядом.' },
  { id: 'morning', startHour: 8, endHour: 12, fallbackMessage: 'Какой темп выберем сегодня?' },
  { id: 'day', startHour: 12, endHour: 17, fallbackMessage: 'Я готов подстроиться под твой день.' },
  { id: 'evening', startHour: 17, endHour: 21, fallbackMessage: 'Можно сделать вечер мягче.' },
  { id: 'night', startHour: 21, endHour: 5, fallbackMessage: 'Тише. Я буду рядом.' },
];

export const TIME_OF_DAY_FALLBACKS: Record<DayPeriod, string> = Object.fromEntries(
  TIME_OF_DAY_PERIODS.map(period => [period.id, period.fallbackMessage]),
) as Record<DayPeriod, string>;

export const TIME_OF_DAY_SCORING_POLICY: TimeOfDayScoringPolicy = {
  boundaryLookaheadMinutes: 15,
  routineSuggestionCooldownMinutes: 10,
  fallbackScore: 1,
  defaultMissingPeriodWeight: -15,
  periodHardNegativeWeight: -25,
  periodStrongPositiveWeight: 20,
  periodHardNegativeMultiplier: 0.2,
  periodStrongPositiveMultiplier: 1.35,
  personalityHardNegativeWeight: -25,
  personalityStrongPositiveWeight: 20,
  personalityHardNegativeMultiplier: 0.3,
  personalityStrongPositiveMultiplier: 1.25,
  pendingRepetitionMultiplier: 0.5,
  nightPlayExceptionPersonalities: ['feral', 'chaotic'],
  playEnergyFloor: 25,
  playTraumaCeiling: 45,
  feedFullnessCeiling: 92,
  batheCleanlinessCeiling: 92,
  healHealthCeiling: 88,
  healTraumaFloor: 40,
};

export const DEFAULT_TIME_OF_DAY_QUIET_HOURS: QuietHoursConfig = {
  enabled: false,
  startHour: 22,
  endHour: 7,
};

export const DEFAULT_TIME_OF_DAY_TUNING_CONFIG: TimeOfDayTuningConfig = {};

const commonPersonalityWeights: Partial<Record<PersonalityId, number>> = {
  playful: 6,
  drowsy: -4,
  foodie: 0,
  bold: 5,
  zen: 0,
  anxious: -6,
  feral: 6,
  sage: 3,
  pristine: -2,
  empath: 2,
  greedy: 2,
  melancholic: -4,
  chaotic: 5,
  stoic: -2,
  adventurer: 5,
  paranoid: -5,
  curious: 4,
};

const ACTIVITY_RULES: ActivityRule[] = [
  {
    id: 'gentle_wake',
    activityId: 'gentle_wake',
    target: { kind: 'action', actionId: 'sleep' },
    baseScore: 45,
    periodWeights: { early_morning: 30, morning: 22, day: 5, evening: -20, night: -15 },
    personalityWeights: { drowsy: 15, zen: 8, anxious: 8 },
    statWeights: { energy: -10 },
    hardGuards: [{ type: 'asleep' }, { type: 'min_stat', stat: 'energy', value: 85 }],
    message: 'Я выспался. Разбуди меня мягко?',
    reason: 'Энергия восстановилась, мягкое пробуждение безопаснее резкого.',
  },
  {
    id: 'breakfast',
    activityId: 'breakfast',
    target: { kind: 'action', actionId: 'feed' },
    baseScore: 42,
    periodWeights: { early_morning: 18, morning: 32, day: -8, evening: 8, night: -35 },
    personalityWeights: { foodie: 24, greedy: 12, empath: 8, drowsy: 6, stoic: -4 },
    statWeights: { hunger: 34 },
    hardGuards: [{ type: 'awake' }, { type: 'max_stat', stat: 'hunger', value: 80 }],
    message: 'Утро просит завтрак.',
    messageVariants: [
      'Сделаем утро с завтраком?',
      'Я бы начал день с чего-нибудь вкусного.',
      'Пока голод тихий, завтрак будет к месту.',
    ],
    reason: 'Завтрак работает как превентивная забота, пока голод не стал проблемой.',
  },
  {
    id: 'morning_stretch',
    activityId: 'morning_stretch',
    target: { kind: 'action', actionId: 'play' },
    baseScore: 34,
    periodWeights: { early_morning: 8, morning: 28, day: 8, evening: -10, night: -45 },
    personalityWeights: { ...commonPersonalityWeights, bold: 24, playful: 18, stoic: 8, drowsy: -16, anxious: -18 },
    statWeights: { energy: -18, happiness: 8 },
    hardGuards: [{ type: 'awake' }, { type: 'min_stat', stat: 'energy', value: 45 }, { type: 'max_trauma', value: 35 }],
    message: 'Давай разомнемся.',
    messageVariants: [
      'Проверим, сколько во мне утренней силы?',
      'Разгоняем день лёгкой игрой?',
      'Хочу подвигаться, пока есть энергия.',
    ],
    reason: 'Утро и хорошая энергия подходят для легкой активности.',
  },
  {
    id: 'brain_warmup',
    activityId: 'brain_warmup',
    target: { kind: 'action', actionId: 'play_puzzle' },
    baseScore: 36,
    periodWeights: { early_morning: 12, morning: 30, day: 22, evening: 14, night: -18 },
    personalityWeights: { sage: 24, curious: 26, stoic: 12, zen: 8, chaotic: -6 },
    traitWeights: { curiosity: 10, order: 6 },
    statWeights: { energy: -8 },
    hardGuards: [{ type: 'awake' }, { type: 'min_stat', stat: 'energy', value: 30 }],
    message: 'Хочу размять голову загадкой.',
    messageVariants: [
      'Дай мне задачу, я хочу подумать.',
      'Мозг уже проснулся. Пазл?',
      'Проверим любопытство загадкой?',
    ],
    reason: 'Период подходит для curiosity/order активности.',
  },
  {
    id: 'confidence_praise',
    activityId: 'confidence_praise',
    target: { kind: 'action', actionId: 'bond_praise' },
    baseScore: 32,
    periodWeights: { early_morning: 18, morning: 18, day: 10, evening: 18, night: 2 },
    personalityWeights: { anxious: 24, melancholic: 20, empath: 15, bold: 5 },
    statWeights: { bond: 18, happiness: 10 },
    hardGuards: [{ type: 'awake' }],
    message: 'Скажи, что я справляюсь.',
    reason: 'Похвала поддерживает связь и уверенность.',
  },
  {
    id: 'calm_breathing',
    activityId: 'calm_breathing',
    target: { kind: 'action', actionId: 'bond_listen' },
    baseScore: 38,
    periodWeights: { early_morning: 25, morning: 15, day: 8, evening: 26, night: 22 },
    personalityWeights: { anxious: 28, zen: 16, paranoid: 24, melancholic: 14 },
    statWeights: { bond: 10 },
    hardGuards: [{ type: 'awake' }],
    message: 'Можно начать тихо? Просто выслушай меня.',
    messageVariants: [
      'Давай без спешки. Побудь рядом.',
      'Мне нужен спокойный старт рядом с тобой.',
      'Можно чуть тише и внимательнее?',
    ],
    reason: 'Спокойная поддержка снижает тревожность и не требует сна.',
  },
  {
    id: 'tidy_start',
    activityId: 'tidy_start',
    target: { kind: 'action', actionId: 'bathe' },
    baseScore: 28,
    periodWeights: { early_morning: 15, morning: 18, day: 4, evening: 20, night: -18 },
    personalityWeights: { pristine: 28, stoic: 16, zen: 12, feral: -24 },
    statWeights: { cleanliness: 34 },
    hardGuards: [{ type: 'awake' }, { type: 'max_stat', stat: 'cleanliness', value: 75 }],
    message: 'Сначала порядок, потом всё остальное.',
    reason: 'Чистота просела, а этот характер ценит порядок.',
  },
  {
    id: 'forest_walk',
    activityId: 'forest_walk',
    target: { kind: 'room', roomId: 'forest' },
    baseScore: 30,
    periodWeights: { early_morning: 18, morning: 22, day: 25, evening: 12, night: -12 },
    personalityWeights: { feral: 28, adventurer: 28, curious: 16, sage: 8, paranoid: -10 },
    traitWeights: { curiosity: 8, vitality: 6 },
    roomBonus: { roomId: 'forest', weight: 16 },
    hardGuards: [{ type: 'awake' }, { type: 'unlocked_room', roomId: 'forest' }],
    message: 'Пахнет новым маршрутом. Заглянем на поляну?',
    messageVariants: [
      'Лес зовёт. Сменим воздух?',
      'Хочу на поляну, там спокойнее думать.',
      'Пойдём туда, где больше пространства?',
    ],
    reason: 'Лесная комната поддерживает exploration-настрой.',
    ctaLabel: 'Поляна',
  },
  {
    id: 'beach_air',
    activityId: 'beach_air',
    target: { kind: 'room', roomId: 'beach' },
    baseScore: 26,
    periodWeights: { early_morning: 8, morning: 18, day: 22, evening: 15, night: -25 },
    personalityWeights: { playful: 14, foodie: 8, empath: 12, melancholic: 10 },
    roomBonus: { roomId: 'beach', weight: 12 },
    hardGuards: [{ type: 'awake' }, { type: 'unlocked_room', roomId: 'beach' }],
    message: 'Хочу немного воздуха и волн.',
    reason: 'Пляжная смена среды дает мягкое исследование.',
    ctaLabel: 'Пляж',
  },
  {
    id: 'toy_rotation',
    activityId: 'toy_rotation',
    target: { kind: 'inventory_item', itemType: 'toy' },
    baseScore: 26,
    periodWeights: { early_morning: 4, morning: 14, day: 24, evening: 10, night: -30 },
    personalityWeights: { playful: 25, chaotic: 22, adventurer: 12, drowsy: -12 },
    inventoryBonus: { itemType: 'toy', weight: 18 },
    hardGuards: [{ type: 'awake' }, { type: 'owned_item', itemType: 'toy' }],
    message: 'Выберем игрушку не как вчера?',
    messageVariants: [
      'Давай достанем игрушку и сменим темп.',
      'Хочу другую игру, не по кругу.',
      'Пусть сегодня игрушка задаст настроение.',
    ],
    reason: 'Разные игрушки поддерживают разнообразие и curiosity.',
    ctaLabel: 'Игрушка',
  },
  {
    id: 'music_break',
    activityId: 'music_break',
    target: { kind: 'inventory_item', itemId: 'music_box' },
    baseScore: 30,
    periodWeights: { early_morning: 10, morning: 8, day: 12, evening: 28, night: 24 },
    personalityWeights: { anxious: 26, empath: 18, melancholic: 24, zen: 16, drowsy: 18 },
    inventoryBonus: { itemId: 'music_box', weight: 18 },
    hardGuards: [{ type: 'awake' }, { type: 'owned_item', itemId: 'music_box' }],
    message: 'Давай заведём шкатулку и выдохнем.',
    messageVariants: [
      'Музыка сделает вечер мягче.',
      'Шкатулка сейчас звучала бы правильно.',
      'Хочу немного музыки без суеты.',
    ],
    reason: 'Музыкальная шкатулка подходит для recovery/social вечера.',
    ctaLabel: 'Шкатулка',
  },
  {
    id: 'crystal_observation',
    activityId: 'crystal_observation',
    target: { kind: 'inventory_item', itemId: 'crystal_ball' },
    baseScore: 28,
    periodWeights: { early_morning: 6, morning: 12, day: 22, evening: 20, night: 20 },
    personalityWeights: { sage: 22, curious: 26, paranoid: 12, chaotic: 4 },
    traitWeights: { curiosity: 10 },
    inventoryBonus: { itemId: 'crystal_ball', weight: 18 },
    hardGuards: [{ type: 'owned_item', itemId: 'crystal_ball' }],
    message: 'Посмотрим, что покажет шар?',
    reason: 'Хрустальный шар усиливает curiosity и спокойное исследование.',
    ctaLabel: 'Шар',
  },
  {
    id: 'space_observation',
    activityId: 'space_observation',
    target: { kind: 'room', roomId: 'space' },
    baseScore: 24,
    periodWeights: { early_morning: -4, morning: 4, day: 16, evening: 18, night: 26 },
    personalityWeights: { sage: 18, curious: 24, paranoid: 10, adventurer: 8 },
    roomBonus: { roomId: 'space', weight: 14 },
    hardGuards: [{ type: 'unlocked_room', roomId: 'space' }],
    message: 'Небо сегодня задаёт вопросы.',
    reason: 'Космическая сцена подходит для спокойной curiosity активности.',
    ctaLabel: 'Космос',
  },
  {
    id: 'shared_game',
    activityId: 'shared_game',
    target: { kind: 'action', actionId: 'play_social' },
    baseScore: 32,
    periodWeights: { early_morning: 4, morning: 15, day: 24, evening: 22, night: -28 },
    personalityWeights: { empath: 26, playful: 18, melancholic: 12, anxious: 6 },
    statWeights: { happiness: 12, bond: 18, energy: -10 },
    hardGuards: [{ type: 'awake' }, { type: 'min_stat', stat: 'energy', value: 35 }],
    message: 'Давай сделаем что-то вместе.',
    reason: 'Совместная игра поддерживает social/play без резкого хаоса.',
  },
  {
    id: 'active_training',
    activityId: 'active_training',
    target: { kind: 'action', actionId: 'play' },
    baseScore: 34,
    periodWeights: { early_morning: -6, morning: 18, day: 30, evening: 0, night: -60 },
    personalityWeights: { bold: 28, playful: 18, chaotic: 18, greedy: 12, stoic: 5, drowsy: -22 },
    statWeights: { energy: -18, happiness: 8 },
    hardGuards: [{ type: 'awake' }, { type: 'min_stat', stat: 'energy', value: 55 }, { type: 'max_trauma', value: 35 }],
    message: 'Время испытания. Сыграем?',
    messageVariants: [
      'Я готов к вызову. Играем?',
      'Проверим реакцию, пока сил много?',
      'День просит активную игру.',
    ],
    reason: 'День и высокая энергия подходят для активного вызова.',
  },
  {
    id: 'decoration_refresh',
    activityId: 'decoration_refresh',
    target: { kind: 'inventory_item', itemType: 'decoration' },
    baseScore: 22,
    periodWeights: { early_morning: 6, morning: 10, day: 16, evening: 22, night: -8 },
    personalityWeights: { pristine: 20, empath: 14, zen: 14, curious: 8 },
    inventoryBonus: { itemType: 'decoration', weight: 14 },
    hardGuards: [{ type: 'owned_item', itemType: 'decoration' }],
    message: 'Добавим комнате немного смысла?',
    reason: 'Декорации поддерживают social/order стиль.',
    ctaLabel: 'Декор',
  },
  {
    id: 'health_check',
    activityId: 'health_check',
    target: { kind: 'action', actionId: 'heal' },
    baseScore: 30,
    periodWeights: { early_morning: 12, morning: 10, day: 8, evening: 16, night: 10 },
    personalityWeights: { anxious: 18, pristine: 12, paranoid: 16 },
    statWeights: { health: 40 },
    hardGuards: [{ type: 'awake' }, { type: 'max_stat', stat: 'health', value: 80 }],
    message: 'Проверь здоровье, пожалуйста.',
    reason: 'Здоровье ниже комфортной зоны.',
  },
  {
    id: 'sleep_preparation',
    activityId: 'sleep_preparation',
    target: { kind: 'action', actionId: 'sleep_ritual' },
    baseScore: 38,
    periodWeights: { early_morning: -8, morning: -20, day: -12, evening: 28, night: 34 },
    personalityWeights: { zen: 24, drowsy: 26, stoic: 18, anxious: 18, paranoid: 16, bold: -12, chaotic: -16 },
    statWeights: { energy: 28 },
    hardGuards: [{ type: 'awake' }],
    message: 'Пора сделать спокойный ритуал.',
    messageVariants: [
      'Давай мягко завершим день.',
      'Ночь ближе. Лучше перейти в спокойный ритм.',
      'Мне нужен ритуал без резких движений.',
    ],
    reason: 'Вечер и ночь подходят для recovery/order сигнала.',
  },
  {
    id: 'night_patrol',
    activityId: 'night_patrol',
    target: { kind: 'room', roomId: 'forest' },
    baseScore: 22,
    periodWeights: { early_morning: -10, morning: -20, day: -12, evening: 8, night: 34 },
    personalityWeights: { feral: 30, chaotic: 24 },
    roomBonus: { roomId: 'forest', weight: 10 },
    hardGuards: [
      { type: 'awake' },
      { type: 'personality_in', ids: ['feral', 'chaotic'] },
      { type: 'min_stat', stat: 'energy', value: 70 },
      { type: 'max_trauma', value: 25 },
      { type: 'unlocked_room', roomId: 'forest' },
    ],
    message: 'Ночь зовёт на тихий патруль.',
    reason: 'Ночная активность разрешена только для диких/хаотичных стилей при стабильном состоянии.',
    ctaLabel: 'Патруль',
  },
  {
    id: 'memory_review',
    activityId: 'memory_review',
    target: { kind: 'deep_link', destination: 'assistant', filter: 'timeline' },
    baseScore: 20,
    periodWeights: { early_morning: 0, morning: 4, day: 12, evening: 20, night: 8 },
    personalityWeights: { sage: 20, melancholic: 14, paranoid: 12, empath: 8 },
    message: 'Посмотрим, что я уже запомнил?',
    reason: 'Вечер подходит для спокойного осмысления истории.',
    ctaLabel: 'Память',
  },
  {
    id: 'shop_explore',
    activityId: 'shop_explore',
    target: { kind: 'deep_link', destination: 'shop', filter: 'toy' },
    baseScore: 16,
    periodWeights: { early_morning: -8, morning: 6, day: 16, evening: 8, night: -20 },
    personalityWeights: { greedy: 24, curious: 12, adventurer: 12, stoic: -8 },
    hardGuards: [{ type: 'awake' }],
    message: 'Может, подберём полезную вещь?',
    reason: 'Магазин уместен как reward/exploration активность.',
    ctaLabel: 'Подобрать',
  },
];


export const DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG: TimeOfDayActivityConfig = {
  periods: TIME_OF_DAY_PERIODS,
  fallbacks: TIME_OF_DAY_FALLBACKS,
  scoring: TIME_OF_DAY_SCORING_POLICY,
  defaultQuietHours: DEFAULT_TIME_OF_DAY_QUIET_HOURS,
  defaultTuningConfig: DEFAULT_TIME_OF_DAY_TUNING_CONFIG,
  activityRules: ACTIVITY_RULES,
};

export function resolveTimeOfDayActivityConfig(patch?: TimeOfDayActivityConfigPatch): TimeOfDayActivityConfig {
  if (!patch) return DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG;
  const baseRules = patch.activityRules ?? DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG.activityRules;
  const overrides = patch.activityRuleOverrides ?? {};
  const disabled = new Set(patch.disabledActivityIds ?? []);
  return {
    periods: patch.periods ?? DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG.periods,
    fallbacks: { ...DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG.fallbacks, ...(patch.fallbackOverrides ?? {}) },
    scoring: { ...DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG.scoring, ...(patch.scoring ?? {}) },
    defaultQuietHours: { ...DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG.defaultQuietHours, ...(patch.defaultQuietHours ?? {}) },
    defaultTuningConfig: { ...DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG.defaultTuningConfig, ...(patch.defaultTuningConfig ?? {}) },
    activityRules: baseRules
      .filter(rule => !disabled.has(rule.activityId))
      .map(rule => ({ ...rule, ...(overrides[rule.activityId] ?? {}) })),
  };
}
