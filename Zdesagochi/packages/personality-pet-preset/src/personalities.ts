import type {
  PersonalityDefinition,
  PersonalityId,
  PersonalitySpecialRules,
} from '../../personality-core/src/types';

// ════════════════════════════════════════════════════════════════════════════
//  PERSONALITIES — реестр всех 16 характеров
//  Добавить новый характер = добавить объект в этот массив.
//  Движок PersonalityEngine не знает о конкретных id — читает объекты.
// ════════════════════════════════════════════════════════════════════════════

const DEFAULT_MOOD_BIAS = { ecstaticMinAvg: 85, happyMinAvg: 65, contentMinAvg: 45 };

export const PERSONALITIES: PersonalityDefinition[] = [

  // ─────────────────────────────────────────────────────────────────────────
  // 1. ИГРИВЫЙ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'playful',
    name: 'Игривый',
    tagline: 'Живёт ради игры',
    description: 'Без движения умирает изнутри. Когда играет — непобедим. Когда не играет — катастрофа.',
    emoji: '🎮',
    rarity: 'common',
    linkedSkinIds: ['phantom', 'cyber'],

    decayRates: { hunger: 1.2, energy: 1.4, happiness: 1.5 },
    restoreBonus: {
      play: { happiness: 20, energy: -5 },
      feed: {},
      bond: { happiness: 5 },
    },
    xpMultipliers:  { play: 1.6, feed: 0.8, bond: 1.0 },
    coinMultipliers: { play: 1.4 },

    foodPreferences: {
      lovedIds:    ['pizza', 'candy'],
      hatedIds:    ['salad'],
      loveBonus:   { happiness: 15 },
      hatePenalty: { happiness: -15, health: -5 },
    },
    autoSleep: { enabled: false, energyThreshold: 0, probability: 0 },
    moodBias: { ecstaticMinAvg: 75, happyMinAvg: 60, contentMinAvg: 40 },
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.3,
    possibleFlags: ['play_burnout', 'food_anxiety', 'abandonment_fear'],
    emergentTriggers: [
      { stateType: 'tantrum', description: 'energy < 15 и не играл > 3ч' },
    ],
    specialRules: {},
    visualProfile: {
      idleAnimationOverride: 'bounce',
      statBarTints: {
        happiness: { warningColor: '#FACC15', warningThreshold: 40, criticalColor: '#EF4444', criticalThreshold: 20, pulseOnWarning: true },
        energy:    { warningColor: '#FB923C', warningThreshold: 30, criticalColor: '#DC2626', criticalThreshold: 15, pulseOnWarning: true },
      },
      emergentStateAnims: {
        tantrum: { bodyAnimation: 'tantrum', eyeExpression: 'angry', particleEffect: 'angryPuffs', overlayTint: 'rgba(200,40,0,0.18)' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. СОНЛИВЫЙ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'drowsy',
    name: 'Сонливый',
    tagline: 'Лучший день — тот, где поспал дважды',
    description: 'Видит мир сквозь пелену дрёмы. Медленный, тёплый, непобедимо уютный.',
    emoji: '😴',
    rarity: 'common',
    linkedSkinIds: ['anthracite'],

    decayRates: { hunger: 0.7, energy: 0.7, happiness: 0.7, health: 0.7, cleanliness: 0.7, bond: 0.7 },
    restoreBonus: {
      sleep: { energy: 30, happiness: 10 },
      feed:  { energy: 5 },
    },
    xpMultipliers:  { play: 0.6, sleep: 1.5, feed: 1.0 },
    coinMultipliers: { play: 0.8 },

    foodPreferences: {
      lovedIds:    ['milk', 'ramen'],
      hatedIds:    ['energy_drink'],
      loveBonus:   { energy: 20, happiness: 10 },
      hatePenalty: { energy: -20 },
    },
    autoSleep: { enabled: true, energyThreshold: 50, probability: 0.4 },
    moodBias: { ecstaticMinAvg: 80, happyMinAvg: 55, contentMinAvg: 35 },
    naturalHealthRegen: 1,
    negativeEffectResistance: 0.2,
    possibleFlags: ['forced_sleep', 'night_disruption', 'trust_bond'],
    emergentTriggers: [],
    visualProfile: {
      idleAnimationOverride: 'drowsy_sway',
      eyeOverride: 'half_closed',
      statBarTints: {
        energy: { warningColor: '#A78BFA', warningThreshold: 50, criticalColor: '#7C3AED', criticalThreshold: 20, pulseOnWarning: false },
      },
      emergentStateAnims: {},
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. ГУРМАН
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'foodie',
    name: 'Гурман',
    tagline: 'Еда — смысл существования',
    description: 'Помнит вкус каждого блюда. Счастлив только когда сыт и разнообразно.',
    emoji: '🍕',
    rarity: 'common',
    linkedSkinIds: ['mercury', 'molten'],

    decayRates: { hunger: 1.6 },
    restoreBonus: {
      feed: { happiness: 15, health: 8 },
    },
    xpMultipliers:  { feed: 1.4, play: 1.0 },
    coinMultipliers: { play: 1.1 },

    foodPreferences: {
      lovedIds:    ['pizza', 'ramen', 'cake', 'sushi'],
      hatedIds:    [],
      loveBonus:   { happiness: 20 },
      hatePenalty: {},
      universalFeedBonus: { happiness: 5 },
    },
    autoSleep: { enabled: false, energyThreshold: 25, probability: 0.1 },
    moodBias: DEFAULT_MOOD_BIAS,
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.0,
    possibleFlags: ['culinary_explorer', 'food_anxiety'],
    emergentTriggers: [
      { stateType: 'feast_frenzy', description: 'happiness > 90 и 3 кормёжки за час' },
    ],
    specialRules: { passiveStatBonusWhenFull: true },
    visualProfile: {
      statBarTints: {
        hunger: { warningColor: '#FCD34D', warningThreshold: 50, criticalColor: '#F97316', criticalThreshold: 25, pulseOnWarning: true },
      },
      emergentStateAnims: {
        feast_frenzy: { bodyAnimation: 'bouncy', eyeExpression: 'hearts', particleEffect: 'foodHearts' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. ДЕРЗКИЙ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'bold',
    name: 'Дерзкий',
    tagline: 'Страха не существует',
    description: 'Никогда не ляжет спать пока не закончит. Боль — просто данные.',
    emoji: '🦁',
    rarity: 'rare',
    linkedSkinIds: ['thunder', 'molten'],

    decayRates: { energy: 1.2 },
    restoreBonus: {
      play: { happiness: 10 },
    },
    xpMultipliers:  { play: 1.3, feed: 0.9 },
    coinMultipliers: { play: 1.6 },

    foodPreferences: {
      lovedIds:    ['pizza', 'ramen'],
      hatedIds:    ['salad', 'apple', 'milk'],
      loveBonus:   { happiness: 15 },
      hatePenalty: { happiness: -20 },
    },
    autoSleep: { enabled: false, energyThreshold: 0, probability: 0 },
    moodBias: { ecstaticMinAvg: 70, happyMinAvg: 55, contentMinAvg: 40 },
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.5,
    possibleFlags: ['health_neglect', 'play_burnout'],
    emergentTriggers: [
      { stateType: 'tantrum', description: 'energy < 15 — не спит, срывается' },
    ],
    specialRules: { rejectSleepWhenEnergized: true },
    visualProfile: {
      idleAnimationOverride: 'proud_stance',
      statBarTints: {
        health: { warningColor: '#F97316', warningThreshold: 30, criticalColor: '#DC2626', criticalThreshold: 15, pulseOnWarning: true },
      },
      emergentStateAnims: {
        tantrum: { bodyAnimation: 'tantrum', eyeExpression: 'angry', overlayTint: 'rgba(200,40,0,0.18)' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. ДЗЕН
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'zen',
    name: 'Дзен',
    tagline: 'Достиг состояния',
    description: 'Ему почти ничего не нужно — только присутствие. Каждое действие принимает с благодарностью.',
    emoji: '🧘',
    rarity: 'rare',
    linkedSkinIds: ['default', 'arctic'],

    decayRates: { hunger: 0.6, happiness: 0.6, energy: 0.6, health: 0.6, cleanliness: 0.6, bond: 0.3 },
    restoreBonus: {
      bond: { bond: 15, happiness: 10 },
      feed: { health: 5 },
    },
    xpMultipliers:  { bond: 1.8, feed: 1.0, play: 0.9 },
    coinMultipliers: {},

    foodPreferences: {
      lovedIds:    ['salad', 'apple', 'sushi', 'milk'],
      hatedIds:    ['candy'],
      loveBonus:   { health: 10 },
      hatePenalty: { energy: -10 },
    },
    autoSleep: { enabled: true, energyThreshold: 25, probability: 0.15 },
    moodBias: { ecstaticMinAvg: 90, happyMinAvg: 40, contentMinAvg: 25 },
    naturalHealthRegen: 2,
    negativeEffectResistance: 0.7,
    possibleFlags: ['trust_bond', 'perfect_balance'],
    emergentTriggers: [],
    visualProfile: {
      idleAnimationOverride: 'gentle_float',
      particleEffect: 'calmParticles',
      statBarTints: {},
      emergentStateAnims: {},
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. НЕРВНЫЙ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'anxious',
    name: 'Нервный',
    tagline: 'Мир — это угроза',
    description: 'Каждый шорох опасен. Но когда всё хорошо — никто не работает лучше.',
    emoji: '😰',
    rarity: 'rare',
    linkedSkinIds: ['void'],

    decayRates: { hunger: 1.4, happiness: 1.4, energy: 1.4, health: 1.4, cleanliness: 1.4, bond: 1.4 },
    restoreBonus: {
      feed: { happiness: 10 },
      bond: { happiness: 15, energy: 5 },
    },
    xpMultipliers:  { play: 1.0, feed: 1.0 },
    coinMultipliers: {},

    foodPreferences: {
      lovedIds:    ['candy', 'cake'],
      hatedIds:    ['salad'],
      loveBonus:   { happiness: 20 },
      hatePenalty: { happiness: -10 },
    },
    autoSleep: { enabled: true, energyThreshold: 35, probability: 0.3 },
    moodBias: { ecstaticMinAvg: 90, happyMinAvg: 70, contentMinAvg: 50 },
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.0,
    possibleFlags: ['abandonment_fear', 'health_neglect', 'food_anxiety'],
    emergentTriggers: [
      { stateType: 'breakdown', description: '3 стата одновременно < 30' },
    ],
    specialRules: { peakPerformanceThreshold: 80, anxiousStatSadThreshold: 40 },
    visualProfile: {
      idleAnimationOverride: 'nervous_shake',
      eyeOverride: 'wide_fear',
      statBarTints: {
        hunger:    { warningColor: '#FBBF24', warningThreshold: 50, criticalColor: '#EF4444', criticalThreshold: 30, pulseOnWarning: true },
        happiness: { warningColor: '#FBBF24', warningThreshold: 50, criticalColor: '#EF4444', criticalThreshold: 30, pulseOnWarning: true },
        energy:    { warningColor: '#FBBF24', warningThreshold: 45, criticalColor: '#EF4444', criticalThreshold: 25, pulseOnWarning: true },
      },
      emergentStateAnims: {
        breakdown: { bodyAnimation: 'trembling', eyeExpression: 'crying', particleEffect: 'darkDrops', overlayTint: 'rgba(80,0,0,0.25)' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. ДИКИЙ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'feral',
    name: 'Дикий',
    tagline: 'Ночь — его стихия',
    description: 'Не домашнее существо. Медицина, купание, укладывание — оскорбления.',
    emoji: '🐺',
    rarity: 'epic',
    linkedSkinIds: ['void', 'shadow'],

    decayRates: { cleanliness: 1.8 },
    restoreBonus: {
      bathe: { cleanliness: 20 },
      feed:  { energy: 5 },
    },
    xpMultipliers:  { play: 1.3, feed: 1.0, heal: 0.3 },
    coinMultipliers: { play: 1.2 },

    foodPreferences: {
      lovedIds:    ['ramen', 'sushi'],
      hatedIds:    ['cake', 'candy', 'salad'],
      loveBonus:   { energy: 15, happiness: 10 },
      hatePenalty: { happiness: -20 },
    },
    autoSleep: { enabled: false, energyThreshold: 10, probability: 0.05 },
    moodBias: DEFAULT_MOOD_BIAS,
    naturalHealthRegen: 2,
    negativeEffectResistance: 0.2,
    possibleFlags: ['forced_sleep', 'health_neglect', 'filth_trauma'],
    emergentTriggers: [
      { stateType: 'midnight_zoomies', description: 'clientLocalHour ∈ [22,23,0,1,2,3,4,5]' },
    ],
    specialRules: { nighttimeHours: [22, 6], nightEnergyDecayDisabled: true, resistsBathing: true },
    visualProfile: {
      idleAnimationOverride: 'wild_crouch',
      eyeOverride: 'wild',
      statBarTints: {
        cleanliness: { warningColor: '#A16207', warningThreshold: 30, criticalColor: '#78350F', criticalThreshold: 10, pulseOnWarning: true },
      },
      emergentStateAnims: {
        midnight_zoomies: { bodyAnimation: 'hyper', eyeExpression: 'glowing', particleEffect: 'nightSparks' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. МУДРЫЙ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'sage',
    name: 'Мудрый',
    tagline: 'Каждый опыт — урок',
    description: 'Не торопится. Накапливает. Деньги не интересуют. Знание — бесценно.',
    emoji: '🦉',
    rarity: 'rare',
    linkedSkinIds: ['root', 'default'],

    decayRates: { hunger: 0.85, energy: 0.85, happiness: 0.85 },
    restoreBonus: {
      bond: { bond: 10, happiness: 8 },
      feed: { health: 5 },
    },
    xpMultipliers:  { play: 1.3, bond: 1.8, feed: 1.2 },
    coinMultipliers: { play: 0.5 },

    foodPreferences: {
      lovedIds:    ['salad', 'apple', 'sushi'],
      hatedIds:    ['candy'],
      loveBonus:   { health: 10 },
      hatePenalty: { happiness: -10 },
    },
    autoSleep: { enabled: true, energyThreshold: 20, probability: 0.1 },
    moodBias: DEFAULT_MOOD_BIAS,
    naturalHealthRegen: 1,
    negativeEffectResistance: 0.4,
    possibleFlags: ['culinary_explorer', 'trust_bond', 'perfect_balance'],
    emergentTriggers: [
      { stateType: 'enlightenment', description: '7 дней подряд avg > 70 при каждом sync' },
    ],
    specialRules: {},
    visualProfile: {
      idleAnimationOverride: 'wise_float',
      particleEffect: 'wisdomParticles',
      statBarTints: {},
      emergentStateAnims: {
        enlightenment: { bodyAnimation: 'meditating', eyeExpression: 'sparkle', particleEffect: 'goldenParticles', overlayTint: 'rgba(255,200,0,0.08)' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. ЧИСТЮЛЯ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'pristine',
    name: 'Чистюля',
    tagline: 'Грязь — это физическая боль',
    description: 'Любое пятно — катастрофа. Но в чистоте — абсолютная сила.',
    emoji: '✨',
    rarity: 'rare',
    linkedSkinIds: ['arctic', 'chrome'],

    decayRates: { cleanliness: 2.5 },
    restoreBonus: {
      bathe: { cleanliness: 15, happiness: 30 },
      feed:  { cleanliness: -2 },
    },
    xpMultipliers:  { bathe: 2.0, play: 0.9 },
    coinMultipliers: {},

    foodPreferences: {
      lovedIds:    ['apple', 'salad', 'sushi'],
      hatedIds:    ['pizza'],
      loveBonus:   { happiness: 10 },
      hatePenalty: { happiness: -15 },
    },
    autoSleep: { enabled: false, energyThreshold: 15, probability: 0.05 },
    moodBias: DEFAULT_MOOD_BIAS,
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.3,
    possibleFlags: ['filth_trauma', 'perfect_balance'],
    emergentTriggers: [
      { stateType: 'contamination_crisis', description: 'cleanliness < 20' },
    ],
    visualProfile: {
      particleEffect: 'sparkleClean',
      statBarTints: {
        cleanliness: { warningColor: '#F59E0B', warningThreshold: 45, criticalColor: '#DC2626', criticalThreshold: 20, pulseOnWarning: true },
      },
      emergentStateAnims: {
        contamination_crisis: { bodyAnimation: 'disgusted', eyeExpression: 'sad_droopy', particleEffect: 'dirtSpots', overlayTint: 'rgba(100,60,0,0.20)' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. ЭМПАТ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'empath',
    name: 'Эмпат',
    tagline: 'Чувствует всё что ты чувствуешь',
    description: 'Одиночество — физический голод. С тобой рядом расцветает. Без тебя угасает.',
    emoji: '💜',
    rarity: 'epic',
    linkedSkinIds: ['phantom', 'shadow'],

    decayRates: { bond: 0.4, hunger: 0.9, energy: 0.9 },
    restoreBonus: {
      bond: { bond: 15, happiness: 10, hunger: 5, energy: 5, health: 5, cleanliness: 2 },
    },
    xpMultipliers:  { bond: 2.0, play: 1.0, feed: 1.0 },
    coinMultipliers: {},

    foodPreferences: {
      lovedIds:    [],
      hatedIds:    [],
      loveBonus:   {},
      hatePenalty: {},
      universalFeedBonus: { bond: 5 },
    },
    autoSleep: { enabled: false, energyThreshold: 20, probability: 0.1 },
    moodBias: DEFAULT_MOOD_BIAS,
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.2,
    possibleFlags: ['abandonment_fear', 'trust_bond'],
    emergentTriggers: [
      { stateType: 'apathy', description: 'session_gap > 48ч' },
    ],
    visualProfile: {
      particleEffect: 'heartParticles',
      statBarTints: {
        bond: { warningColor: '#C084FC', warningThreshold: 35, criticalColor: '#9333EA', criticalThreshold: 15, pulseOnWarning: true },
      },
      emergentStateAnims: {
        apathy: { bodyAnimation: 'lying', eyeExpression: 'hollow', overlayTint: 'rgba(150,150,150,0.30)' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 11. ЖАДНЫЙ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'greedy',
    name: 'Жадный',
    tagline: 'Монеты — кислород',
    description: 'Будет работать за правильную цену. Задаром — не будет.',
    emoji: '💰',
    rarity: 'epic',
    linkedSkinIds: ['thunder', 'chrome'],

    decayRates: { happiness: 1.3 },
    restoreBonus: {
      play: { happiness: 5 },
    },
    xpMultipliers:  { play: 0.7, bond: 0.5, feed: 0.9 },
    coinMultipliers: { play: 2.0, bond: 0.5, feed: 1.2 },

    foodPreferences: {
      lovedIds:    ['galaxy_cake', 'magic_potion'],
      hatedIds:    ['apple', 'salad'],
      loveBonus:   { happiness: 20 },
      hatePenalty: { happiness: -15 },
    },
    autoSleep: { enabled: false, energyThreshold: 10, probability: 0.05 },
    moodBias: DEFAULT_MOOD_BIAS,
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.2,
    possibleFlags: ['abandonment_fear'],
    emergentTriggers: [
      { stateType: 'coin_obsession', description: 'coins < 50 и < 5 игр за 24ч' },
    ],
    visualProfile: {
      particleEffect: 'coinSparkle',
      statBarTints: {},
      emergentStateAnims: {
        coin_obsession: { bodyAnimation: 'arms_crossed', eyeExpression: 'suspicious', particleEffect: 'coinDrain' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 12. МЕЛАНХОЛИК
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'melancholic',
    name: 'Меланхолик',
    tagline: 'Глубина важнее скорости',
    description: 'Находит красоту в грусти. Самые ценные XP — из тихих моментов.',
    emoji: '🌧',
    rarity: 'rare',
    linkedSkinIds: ['void', 'abyss'],

    decayRates: { hunger: 0.8, happiness: 0.8, energy: 0.8 },
    restoreBonus: {
      bond: { bond: 20, happiness: 8 },
    },
    xpMultipliers:  { bond: 2.0, play: 1.0, feed: 1.0, heal: 0.5 },
    coinMultipliers: {},

    foodPreferences: {
      lovedIds:    ['ramen', 'sushi', 'milk'],
      hatedIds:    ['cake', 'candy'],
      loveBonus:   { happiness: 10 },
      hatePenalty: { happiness: -15 },
    },
    autoSleep: { enabled: true, energyThreshold: 30, probability: 0.2 },
    moodBias: { ecstaticMinAvg: 90, happyMinAvg: 70, contentMinAvg: 30 },
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.2,
    possibleFlags: ['abandonment_fear', 'health_neglect'],
    emergentTriggers: [
      { stateType: 'deep_melancholy', description: 'mood = sad ≥5 синков подряд' },
    ],
    specialRules: { xpEveryOtherAction: true },
    visualProfile: {
      idleAnimationOverride: 'slow_float',
      particleEffect: 'melancholicRain',
      statBarTints: {
        happiness: { warningColor: '#818CF8', warningThreshold: 45, criticalColor: '#4338CA', criticalThreshold: 25, pulseOnWarning: false },
      },
      emergentStateAnims: {
        deep_melancholy: { bodyAnimation: 'slow_float', eyeExpression: 'sad_droopy', particleEffect: 'rainDrops', overlayTint: 'rgba(80,0,120,0.15)' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 13. ХАОТИК
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'chaotic',
    name: 'Хаотик',
    tagline: 'Нет паттернов. Нет правил',
    description: 'Всё случайно. Каждая сессия — новое существо. Даже он сам не знает что будет дальше.',
    emoji: '🌀',
    rarity: 'epic',
    linkedSkinIds: ['toxic', 'thunder'],

    decayRates: {},   // рандомизируются движком из dailySeed
    restoreBonus: {},
    xpMultipliers:  {},
    coinMultipliers: {},

    foodPreferences: {
      lovedIds:    [],  // рандомизируются движком
      hatedIds:    [],
      loveBonus:   {},
      hatePenalty: {},
    },
    autoSleep: { enabled: false, energyThreshold: 10, probability: 0 },
    moodBias: DEFAULT_MOOD_BIAS,
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.0,  // рандомизируется
    possibleFlags: ['food_anxiety', 'play_burnout', 'abandonment_fear', 'health_neglect'],
    emergentTriggers: [
      { stateType: 'chaos_surge', description: 'каждые 3 часа автоматически' },
    ],
    specialRules: { randomizeDailySeed: true },
    visualProfile: {
      idleAnimationOverride: 'random_pulse',
      particleEffect: 'chaosRipple',
      statBarTints: {},
      emergentStateAnims: {
        chaos_surge: { bodyAnimation: 'random_pulse', eyeExpression: 'wild', particleEffect: 'rainbowRipple' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 14. СТОИК
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'stoic',
    name: 'Стоик',
    tagline: 'Не реагирует. Раз в жизни — взрывается',
    description: 'Не жалуется. Не просит. Просто существует. И в этом — невероятная сила.',
    emoji: '🪨',
    rarity: 'rare',
    linkedSkinIds: ['anthracite', 'root'],

    decayRates: { hunger: 0.6, happiness: 0.6, energy: 0.6, health: 0.6, cleanliness: 0.6, bond: 0.6 },
    restoreBonus: {},
    xpMultipliers:  { play: 1.0, bond: 1.0, feed: 1.0 },
    coinMultipliers: {},

    foodPreferences: {
      lovedIds:    [],
      hatedIds:    [],
      loveBonus:   {},
      hatePenalty: {},
    },
    autoSleep: { enabled: false, energyThreshold: 5, probability: 0.02 },
    moodBias: { ecstaticMinAvg: 95, happyMinAvg: 80, contentMinAvg: 60 },
    naturalHealthRegen: 1,
    negativeEffectResistance: 0.7,
    possibleFlags: ['health_neglect', 'trust_bond'],
    emergentTriggers: [
      { stateType: 'stoic_peak', description: '10 дней avg > 60 при каждом sync' },
    ],
    specialRules: { flatXpFromPlay: true },
    visualProfile: {
      idleAnimationOverride: 'minimal_idle',
      statBarTints: {},
      emergentStateAnims: {
        stoic_peak: { bodyAnimation: 'explosion', eyeExpression: 'wide_fear', particleEffect: 'goldExplosion' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 15. АВАНТЮРИСТ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'adventurer',
    name: 'Авантюрист',
    tagline: 'Новое — его наркотик',
    description: 'Повторение — его смерть. Каждая новая комната — праздник.',
    emoji: '🧭',
    rarity: 'epic',
    linkedSkinIds: ['cyber', 'arctic'],

    decayRates: { happiness: 1.2 },
    restoreBonus: {
      play: { happiness: 10 },
    },
    xpMultipliers:  { play: 1.2, feed: 1.0 },
    coinMultipliers: { play: 1.1 },

    foodPreferences: {
      lovedIds:    [],  // обрабатывается в specialRules.foodBoredomEnabled
      hatedIds:    [],
      loveBonus:   { happiness: 30 },  // для НОВОЙ еды
      hatePenalty: { happiness: -25 }, // для ПОВТОРНОЙ еды (сегодня)
    },
    autoSleep: { enabled: false, energyThreshold: 15, probability: 0.05 },
    moodBias: DEFAULT_MOOD_BIAS,
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.2,
    possibleFlags: ['food_monotony', 'abandonment_fear'],
    emergentTriggers: [
      { stateType: 'wanderlust', description: '48ч в одной комнате' },
    ],
    specialRules: { foodBoredomEnabled: true },
    visualProfile: {
      idleAnimationOverride: 'impatient_look',
      statBarTints: {
        happiness: { warningColor: '#34D399', warningThreshold: 40, criticalColor: '#059669', criticalThreshold: 20, pulseOnWarning: true },
      },
      emergentStateAnims: {
        wanderlust: { bodyAnimation: 'looking_away', eyeExpression: 'focused', particleEffect: 'footprints' },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 16. ПАРАНОИК
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'paranoid',
    name: 'Параноик',
    tagline: 'Доверие — роскошь, которую нужно заслужить',
    description: 'Не верит никому. Но если поверил — предан до конца. И не простит предательства.',
    emoji: '👁',
    rarity: 'legendary',
    linkedSkinIds: ['abyss', 'chrome'],

    decayRates: {},   // модифицируются в зависимости от фазы в движке
    restoreBonus: {},
    xpMultipliers:  {},
    coinMultipliers: {},

    foodPreferences: {
      lovedIds:    [],
      hatedIds:    [],
      loveBonus:   {},
      hatePenalty: {},
    },
    autoSleep: { enabled: false, energyThreshold: 0, probability: 0 },
    moodBias: DEFAULT_MOOD_BIAS,
    naturalHealthRegen: 0,
    negativeEffectResistance: 0.0,
    possibleFlags: ['abandonment_fear', 'trust_bond'],
    emergentTriggers: [
      { stateType: 'trust_collapse', description: 'trusted-фаза + пропуск > 24ч' },
    ],
    specialRules: {
      healRefuseHealthThreshold: 50,
      feedRestoreByPhase: true,
      trustThresholdBonds: 10,
    },
    visualProfile: {
      idleAnimationOverride: 'suspicious_look',
      eyeOverride: 'suspicious',
      statBarTints: {},
      emergentStateAnims: {
        trust_collapse: { bodyAnimation: 'turned_away', eyeExpression: 'suspicious', overlayTint: 'rgba(0,50,150,0.20)' },
      },
    },
  },
];

type SpecialRuleStatus = 'engine' | 'adapter_owned' | 'deferred';

export interface PersonalitySpecialRuleValidationIssue {
  severity: 'warning' | 'error';
  personalityId: PersonalityId;
  rule: string;
  status: SpecialRuleStatus | 'unknown';
  message: string;
}

const SPECIAL_RULE_SUPPORT: Record<keyof PersonalitySpecialRules, {
  status: SpecialRuleStatus;
  owner: string;
  message: string;
}> = {
  passiveStatBonusWhenFull: {
    status: 'engine',
    owner: 'computeNaturalPassives',
    message: 'Supported by natural passive calculation.',
  },
  rejectSleepWhenEnergized: {
    status: 'engine',
    owner: 'applyPersonalityCommand/applyActionOutcome',
    message: 'Supported by command outcome blocker before sleep lifecycle starts.',
  },
  peakPerformanceThreshold: {
    status: 'engine',
    owner: 'applyPersonalityCommand/applyActionOutcome',
    message: 'Supported by command outcome XP/coin multiplier.',
  },
  anxiousStatSadThreshold: {
    status: 'engine',
    owner: 'calcMoodWithBias',
    message: 'Supported by mood calculation: any stat below threshold forces sad mood.',
  },
  nighttimeHours: {
    status: 'engine',
    owner: 'applyDecay/computeEmergentState',
    message: 'Supported by night decay and midnight_zoomies checks.',
  },
  nightEnergyDecayDisabled: {
    status: 'engine',
    owner: 'applyDecay',
    message: 'Supported by night energy decay calculation.',
  },
  resistsBathing: {
    status: 'adapter_owned',
    owner: 'api-adapter/bathePet',
    message: 'Read by UI adapter to choose bathe event label.',
  },
  xpEveryOtherAction: {
    status: 'engine',
    owner: 'applyPersonalityCommand/applyActionOutcome',
    message: 'Supported by command outcome with persisted behavioral counter.',
  },
  randomizeDailySeed: {
    status: 'engine',
    owner: 'updateCounters/applyDecay/applyActionModifiers/computeEmergentState',
    message: 'Supported by chaos seed, multipliers, and chaos_surge activation.',
  },
  flatXpFromPlay: {
    status: 'engine',
    owner: 'applyActionModifiers',
    message: 'Supported by action modifier calculation.',
  },
  foodBoredomEnabled: {
    status: 'engine',
    owner: 'applyActionModifiers',
    message: 'Supported by food preference modifier calculation.',
  },
  healRefuseHealthThreshold: {
    status: 'engine',
    owner: 'applyPersonalityCommand/getSpecialBlockedAction',
    message: 'Blocks heal command when health is above this threshold.',
  },
  feedRestoreByPhase: {
    status: 'engine',
    owner: 'applyPersonalityCommand/applySpecialOutcomeModifiers',
    message: 'Scales feed restore multiplier based on paranoidPhase behavioral counter.',
  },
  trustThresholdBonds: {
    status: 'engine',
    owner: 'updateCounters',
    message: 'Controls how many bond actions are required to transition paranoidPhase to trusted.',
  },
};

export function validatePersonalitySpecialRules(
  personalities: PersonalityDefinition[] = PERSONALITIES,
): PersonalitySpecialRuleValidationIssue[] {
  const supportedKeys = new Set(Object.keys(SPECIAL_RULE_SUPPORT));
  const issues: PersonalitySpecialRuleValidationIssue[] = [];

  for (const personality of personalities) {
    for (const rule of Object.keys(personality.specialRules ?? {})) {
      if (!supportedKeys.has(rule)) {
        issues.push({
          severity: 'error',
          personalityId: personality.id,
          rule,
          status: 'unknown',
          message: `Unknown specialRules.${rule}; add support metadata before using it in personality data.`,
        });
        continue;
      }

      const support = SPECIAL_RULE_SUPPORT[rule as keyof PersonalitySpecialRules];
      if (support.status !== 'engine') {
        issues.push({
          severity: 'warning',
          personalityId: personality.id,
          rule,
          status: support.status,
          message: `${support.message} Owner: ${support.owner}.`,
        });
      }
    }
  }

  return issues;
}

// Быстрый доступ по id
export const PERSONALITIES_MAP = new Map(
  PERSONALITIES.map(p => [p.id, p])
);

export function getPersonalityStrict(id: string): PersonalityDefinition {
  const personality = PERSONALITIES_MAP.get(id as any);
  if (!personality) throw new Error(`Unknown personality id: ${id}`);
  return personality;
}

export const getPersonality = (id: string): PersonalityDefinition =>
  PERSONALITIES_MAP.get(id as any) ?? getPersonalityStrict('playful');

// Карта скин → характер (берётся первый совпавший)
export const SKIN_TO_PERSONALITY = new Map<string, string>(
  PERSONALITIES.flatMap(p => p.linkedSkinIds.map(skinId => [skinId, p.id] as [string, string]))
);

export const getPersonalityBySkin = (skinId: string): PersonalityDefinition =>
  getPersonality(SKIN_TO_PERSONALITY.get(skinId) ?? 'playful');
