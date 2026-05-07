import type { EmergentStateDefinition } from './types';

// ════════════════════════════════════════════════════════════════════════════
//  EMERGENT STATE DEFINITIONS — реестр эмерджентных состояний
//  Добавить новое состояние = добавить объект в этот массив.
//  Движок читает реестр, не знает о конкретных состояниях.
// ════════════════════════════════════════════════════════════════════════════

export const EMERGENT_STATE_DEFS: EmergentStateDefinition[] = [
  // priority 0 — Trait Evolution перехватывает обычную эволюцию
  {
    type: 'singularity',
    name: 'Точка сингулярности',
    description: 'Питомец завис между тремя личностями. Любое движение решит всё.',
    emoji: '✨',
    priority: 0,
    exclusive: true,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'play', statAdditives: {}, xpMultiplier: 3.0, coinMultiplier: 2.0 },
      { actionType: 'feed', statAdditives: {}, xpMultiplier: 3.0, coinMultiplier: 2.0 },
      { actionType: 'bond', statAdditives: {}, xpMultiplier: 3.0, coinMultiplier: 2.0 },
    ],
    exitHint: 'Любое действие может схлопнуть в один из характеров. Или удерживай баланс.',
    visual: {
      bodyAnimation: 'glitch',
      eyeExpression: 'sparkle',
      particleEffect: 'tripleStar',
      overlayTint: 'rgba(255,255,255,0.05)',
    },
  },

  // priority 1 — критическое: здоровье питомца под угрозой
  {
    type: 'breakdown',
    name: 'Коллапс',
    description: 'Нервная система не выдержала. Всё одновременно рухнуло.',
    emoji: '💔',
    priority: 1,
    exclusive: true,
    blockedActions: [
      { actionType: 'play',  reason: 'Сил больше нет', alternativeHint: 'Приласкай питомца' },
      { actionType: 'bathe', reason: 'Слишком слаб', alternativeHint: 'Сначала успокой его объятиями' },
    ],
    modifiedActions: [
      { actionType: 'bond', statAdditives: { happiness: 10, energy: 5 }, xpMultiplier: 1.5, coinMultiplier: 0.5 },
      { actionType: 'feed', statAdditives: {}, xpMultiplier: 0.5, coinMultiplier: 0.5 },
    ],
    exitHint: 'Каждый стат должен быть выше 50',
    visual: {
      bodyAnimation: 'trembling',
      eyeExpression: 'crying',
      particleEffect: 'darkDrops',
      overlayTint: 'rgba(80,0,0,0.25)',
    },
  },

  // priority 2
  {
    type: 'contamination_crisis',
    name: 'Кризис загрязнения',
    description: 'Не может есть пока не стало чисто. Физически невозможно.',
    emoji: '🤢',
    priority: 2,
    exclusive: true,
    blockedActions: [
      { actionType: 'feed', reason: 'Не будет есть в таком виде', alternativeHint: 'Сначала искупай' },
    ],
    modifiedActions: [
      { actionType: 'bathe', statAdditives: { cleanliness: 20, happiness: 10 }, xpMultiplier: 2.0, coinMultiplier: 1.0 },
    ],
    exitHint: 'Искупай питомца',
    visual: {
      bodyAnimation: 'disgusted',
      eyeExpression: 'sad_droopy',
      particleEffect: 'dirtSpots',
      overlayTint: 'rgba(100,60,0,0.20)',
    },
  },

  // priority 3
  {
    type: 'tantrum',
    name: 'Истерика',
    description: 'Силы кончились, а спать не хочет. Теперь только крик.',
    emoji: '😤',
    priority: 3,
    exclusive: true,
    blockedActions: [
      { actionType: 'feed',  reason: 'Отказывается есть', alternativeHint: 'Успокой объятиями' },
      { actionType: 'play',  reason: 'Слишком устал для игр', alternativeHint: 'Ласка поможет' },
      { actionType: 'sleep', reason: 'Сам не ляжет', alternativeHint: '5 объятий — и уснёт' },
    ],
    modifiedActions: [
      { actionType: 'bond', statAdditives: { happiness: 15, energy: 3 }, xpMultiplier: 1.0, coinMultiplier: 0.5 },
    ],
    exitHint: 'Успокой питомца объятиями — тогда сам уснёт',
    visual: {
      bodyAnimation: 'tantrum',
      eyeExpression: 'angry',
      particleEffect: 'angryPuffs',
      overlayTint: 'rgba(200,40,0,0.18)',
    },
  },

  // priority 4
  {
    type: 'apathy',
    name: 'Апатия одиночества',
    description: 'Слишком долго был один. Стандартные действия бессмысленны.',
    emoji: '🫥',
    priority: 4,
    exclusive: true,
    blockedActions: [
      { actionType: 'feed',  reason: 'Равнодушен к еде', alternativeHint: 'Купи подарок примирения или просто побудь рядом' },
      { actionType: 'play',  reason: 'Не хочет играть', alternativeHint: 'Сначала верни доверие' },
      { actionType: 'bathe', reason: 'Безразличен', alternativeHint: 'Подарок или 5 минут рядом' },
      { actionType: 'heal',  reason: 'Отвергает помощь', alternativeHint: 'Нужна не медицина, а присутствие' },
    ],
    modifiedActions: [
      { actionType: 'bond', statAdditives: { happiness: 5, bond: 10 }, xpMultiplier: 2.0, coinMultiplier: 0.5 },
    ],
    exitHint: 'Купи подарок примирения или держи приложение открытым 5 минут',
    visual: {
      bodyAnimation: 'lying',
      eyeExpression: 'hollow',
      overlayTint: 'rgba(150,150,150,0.30)',
    },
  },

  // priority 5
  {
    type: 'trust_collapse',
    name: 'Крах доверия',
    description: 'Поверил — и был предан. Второй шанс дорого стоит.',
    emoji: '🥶',
    priority: 5,
    exclusive: true,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'feed',  statAdditives: {}, xpMultiplier: 0.2, coinMultiplier: 0.2 },
      { actionType: 'play',  statAdditives: {}, xpMultiplier: 0.2, coinMultiplier: 0.2 },
      { actionType: 'heal',  statAdditives: {}, xpMultiplier: 0.2, coinMultiplier: 0.2 },
      { actionType: 'bathe', statAdditives: {}, xpMultiplier: 0.2, coinMultiplier: 0.2 },
      { actionType: 'bond',  statAdditives: { bond: 5 }, xpMultiplier: 1.5, coinMultiplier: 1.0 },
    ],
    exitHint: '20 объятий подряд вернут доверие',
    visual: {
      bodyAnimation: 'turned_away',
      eyeExpression: 'suspicious',
      overlayTint: 'rgba(0,50,150,0.20)',
    },
  },

  // priority 6
  {
    type: 'food_panic',
    name: 'Пищевая паника',
    description: 'Требует еду даже если сыт. Тревога сильнее разума.',
    emoji: '😱',
    priority: 6,
    exclusive: false,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'feed', statAdditives: { happiness: 20, energy: 5 }, xpMultiplier: 1.0, coinMultiplier: 1.0 },
    ],
    exitHint: 'Покорми несколько раз когда сыт — тревога утихнет',
    visual: {
      bodyAnimation: 'shaking_head',
      eyeExpression: 'wide_fear',
      particleEffect: 'foodGhosts',
    },
  },

  // priority 7
  {
    type: 'coin_obsession',
    name: 'Монетная одержимость',
    description: 'Работает только за достойную оплату. Меньше 10 монет — саботаж.',
    emoji: '💸',
    priority: 7,
    exclusive: false,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'play', statAdditives: {}, xpMultiplier: 0.5, coinMultiplier: 0.5 },
      { actionType: 'bond', statAdditives: {}, xpMultiplier: 0.3, coinMultiplier: 0.3 },
    ],
    exitHint: 'Накопи 100 монет — жадность утихнет',
    visual: {
      bodyAnimation: 'arms_crossed',
      eyeExpression: 'suspicious',
      particleEffect: 'coinDrain',
    },
  },

  // priority 8
  {
    type: 'midnight_zoomies',
    name: 'Ночной разгул',
    description: 'Ночь — его время. Никто не уложит спать.',
    emoji: '🌙',
    priority: 8,
    exclusive: false,
    blockedActions: [
      { actionType: 'sleep', reason: 'Ни за что не ляжет ночью', alternativeHint: 'Дождись утра' },
    ],
    modifiedActions: [
      { actionType: 'play', statAdditives: { happiness: 10 }, xpMultiplier: 2.5, coinMultiplier: 1.5 },
      { actionType: 'bond', statAdditives: { happiness: -10 }, xpMultiplier: 0.5, coinMultiplier: 0.5 },
    ],
    exitHint: 'Само пройдёт на рассвете',
    visual: {
      bodyAnimation: 'hyper',
      eyeExpression: 'glowing',
      particleEffect: 'nightSparks',
    },
  },

  // priority 9
  {
    type: 'deep_melancholy',
    name: 'Глубокая меланхолия',
    description: 'Когда грусть становится домом. События превращаются в поэзию.',
    emoji: '🌧',
    priority: 9,
    exclusive: false,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'bond', statAdditives: {}, xpMultiplier: 2.0, coinMultiplier: 1.0 },
      { actionType: 'play', statAdditives: {}, xpMultiplier: 1.5, coinMultiplier: 1.2 },
      { actionType: 'feed', statAdditives: {}, xpMultiplier: 1.5, coinMultiplier: 1.0 },
    ],
    exitHint: 'Повысь счастье выше 70 дважды подряд',
    visual: {
      bodyAnimation: 'slow_float',
      eyeExpression: 'sad_droopy',
      particleEffect: 'rainDrops',
      overlayTint: 'rgba(80,0,120,0.15)',
    },
  },

  // priority 10
  {
    type: 'wanderlust',
    name: 'Зов странствий',
    description: 'В этой комнате уже 48 часов. Невыносимо.',
    emoji: '🧭',
    priority: 10,
    exclusive: false,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'play', statAdditives: { happiness: -15 }, xpMultiplier: 0.4, coinMultiplier: 0.6 },
    ],
    exitHint: 'Смени комнату — желание путешествовать угаснет',
    visual: {
      bodyAnimation: 'looking_away',
      eyeExpression: 'focused',
      particleEffect: 'footprints',
    },
  },

  // priority 11
  {
    type: 'enlightenment',
    name: 'Просветление',
    description: '7 дней совершенного ухода. Мудрец достиг вершины.',
    emoji: '✨',
    priority: 11,
    exclusive: false,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'play',  statAdditives: {}, xpMultiplier: 2.0, coinMultiplier: 1.2 },
      { actionType: 'feed',  statAdditives: {}, xpMultiplier: 2.0, coinMultiplier: 1.0 },
      { actionType: 'bond',  statAdditives: {}, xpMultiplier: 2.0, coinMultiplier: 1.0 },
      { actionType: 'bathe', statAdditives: {}, xpMultiplier: 2.0, coinMultiplier: 1.0 },
    ],
    exitHint: 'Наслаждайся — длится 24 часа',
    visual: {
      bodyAnimation: 'meditating',
      eyeExpression: 'sparkle',
      particleEffect: 'goldenParticles',
      overlayTint: 'rgba(255,200,0,0.08)',
    },
  },

  // priority 12
  {
    type: 'stoic_peak',
    name: 'Пик стоицизма',
    description: '10 дней терпения. Один раз — взрыв.',
    emoji: '💥',
    priority: 12,
    exclusive: false,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'bond', statAdditives: {}, xpMultiplier: 5.0, coinMultiplier: 3.0 },
      { actionType: 'play', statAdditives: {}, xpMultiplier: 3.0, coinMultiplier: 3.0 },
      { actionType: 'feed', statAdditives: {}, xpMultiplier: 3.0, coinMultiplier: 3.0 },
    ],
    exitHint: 'Одноразовый взрыв. Длится 2 часа',
    visual: {
      bodyAnimation: 'explosion',
      eyeExpression: 'wide_fear',
      particleEffect: 'goldExplosion',
    },
  },

  // priority 13
  {
    type: 'chaos_surge',
    name: 'Волна хаоса',
    description: 'Очередной непредсказуемый всплеск. Что будет — неизвестно.',
    emoji: '🌀',
    priority: 13,
    exclusive: false,
    blockedActions: [],
    modifiedActions: [],  // эффект вычисляется динамически из seed в движке
    exitHint: 'Само пройдёт через 30–60 минут',
    visual: {
      bodyAnimation: 'random_pulse',
      eyeExpression: 'wild',
      particleEffect: 'rainbowRipple',
    },
  },

  // priority 14
  {
    type: 'feast_frenzy',
    name: 'Гастрономический экстаз',
    description: 'Три кормёжки за час и полное счастье. Поглощён едой полностью.',
    emoji: '🍽',
    priority: 14,
    exclusive: false,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'play', statAdditives: { happiness: 10 }, xpMultiplier: 2.0, coinMultiplier: 1.5 },
      { actionType: 'feed', statAdditives: { happiness: 20 }, xpMultiplier: 1.5, coinMultiplier: 1.0 },
    ],
    exitHint: 'Само пройдёт через 2 часа',
    visual: {
      bodyAnimation: 'bouncy',
      eyeExpression: 'hearts',
      particleEffect: 'foodHearts',
    },
  },

  {
    type: 'identity_crisis',
    name: 'Кризис идентичности',
    description: 'Черты разошлись слишком далеко. Нужен устойчивый паттерн ухода.',
    emoji: '🌫',
    priority: 2,
    exclusive: true,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'play', statAdditives: {}, xpMultiplier: 0.5, coinMultiplier: 0.7 },
      { actionType: 'feed', statAdditives: {}, xpMultiplier: 0.5, coinMultiplier: 1.0 },
      { actionType: 'bond', statAdditives: {}, xpMultiplier: 1.5, coinMultiplier: 1.0 },
    ],
    exitHint: 'Выработай регулярный паттерн ухода на несколько дней',
    visual: {
      bodyAnimation: 'dissolve',
      eyeExpression: 'hollow',
      overlayTint: 'rgba(100,100,100,0.28)',
    },
  },

  {
    type: 'shadow_form',
    name: 'Теневая форма',
    description: 'Накопленная травма вышла наружу. Нужны спокойные действия и доверие.',
    emoji: '🌑',
    priority: 1,
    exclusive: true,
    blockedActions: [
      { actionType: 'play', reason: 'Сейчас игры ранят сильнее', alternativeHint: 'Сначала восстанови доверие' },
    ],
    modifiedActions: [
      { actionType: 'bond', statAdditives: { bond: 15, happiness: 10 }, xpMultiplier: 2.0, coinMultiplier: 0.5 },
      { actionType: 'heal', statAdditives: { health: 10 }, xpMultiplier: 1.5, coinMultiplier: 0.5 },
      { actionType: 'feed', statAdditives: { happiness: -5 }, xpMultiplier: 0.5, coinMultiplier: 0.5 },
    ],
    exitHint: 'Мягкая забота заполняет катарсис',
    visual: {
      bodyAnimation: 'shadow_pulse',
      eyeExpression: 'hollow',
      particleEffect: 'shadowWisps',
      overlayTint: 'rgba(20,20,35,0.35)',
    },
  },

  {
    type: 'confused',
    name: 'Когнитивный диссонанс',
    description: 'Слишком много противоречивых впечатлений за день.',
    emoji: '❓',
    priority: 15,
    exclusive: false,
    blockedActions: [],
    modifiedActions: [
      { actionType: 'play', statAdditives: {}, xpMultiplier: 0.8, coinMultiplier: 1.0 },
      { actionType: 'use_item', statAdditives: {}, xpMultiplier: 0.7, coinMultiplier: 1.0 },
    ],
    exitHint: 'Нужен непрерывный сон не меньше 4 часов',
    visual: {
      bodyAnimation: 'dizzy',
      eyeExpression: 'wide_fear',
      particleEffect: 'questionMarks',
    },
  },
];

// Быстрый доступ по типу
export const EMERGENT_STATE_MAP = new Map(
  EMERGENT_STATE_DEFS.map(s => [s.type, s])
);

export const getEmergentStateDef = (type: string): EmergentStateDefinition | undefined =>
  EMERGENT_STATE_MAP.get(type as any);
