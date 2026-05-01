export type EffectType =
  | 'particles'
  | 'rain'
  | 'stars'
  | 'grid'
  | 'scan'
  | 'aurora'
  | 'lava'
  | 'digital_rain'
  | 'ash'
  | 'void_rings'
  | 'glitch';

export interface SceneEffect {
  type: EffectType;
  color?: string;
  color2?: string;
  count?: number;
  opacity?: number;
}

export interface BackgroundDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  price: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requiredLevel?: number;
  gradient: string;
  floorGradient: string;
  accentColor: string;
  decorations?: Array<{ emoji: string; x: number; y: number; size: number }>;
  effects: SceneEffect[];
}

export const BACKGROUNDS: BackgroundDefinition[] = [
  // ── Free / Common ──────────────────────────────────────────────────────────
  {
    id: 'void_dark',
    name: 'Пустота',
    tagline: 'Здесь ничего нет. Или всё.',
    description: 'Абсолютная тьма с дрейфующими частицами. Спокойствие или ужас — решай сам.',
    emoji: '🌑',
    price: 0,
    rarity: 'common',
    gradient: 'linear-gradient(180deg, #050010 0%, #0D0020 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(168,85,247,0.15))',
    accentColor: '#A855F7',
    effects: [{ type: 'particles', color: '#A855F7', count: 10 }],
  },
  {
    id: 'cyber_grid',
    name: 'Киберсетка',
    tagline: 'Ты внутри системы.',
    description: 'Цифровая решётка уходит в бесконечность. Где-то здесь живёт истина.',
    emoji: '⬛',
    price: 0,
    rarity: 'common',
    gradient: 'linear-gradient(180deg, #000C14 0%, #001824 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(0,212,255,0.12))',
    accentColor: '#00D4FF',
    effects: [
      { type: 'grid', color: '#00D4FF' },
      { type: 'scan', color: '#00D4FF' },
    ],
  },
  {
    id: 'dusk',
    name: 'Сумерки',
    tagline: '2:47 утра. Тишина.',
    description: 'Глубокое фиолетовое небо между ночью и рассветом. Время когда всё возможно.',
    emoji: '🌆',
    price: 0,
    rarity: 'common',
    gradient: 'linear-gradient(180deg, #0F0520 0%, #1E0840 50%, #0A0515 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(192,132,252,0.15))',
    accentColor: '#C084FC',
    effects: [{ type: 'particles', color: '#C084FC', count: 14 }],
  },

  // ── Rare ───────────────────────────────────────────────────────────────────
  {
    id: 'neon_rain',
    name: 'Неоновый ливень',
    tagline: 'Blade Runner. 2049.',
    description: 'Город никогда не спит. Неоновый дождь смывает грехи и воспоминания.',
    emoji: '🌧',
    price: 200,
    rarity: 'rare',
    gradient: 'linear-gradient(180deg, #06000E 0%, #0E0018 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(236,72,153,0.2))',
    accentColor: '#EC4899',
    decorations: [
      { emoji: '🏙', x: 5,  y: 55, size: 36 },
      { emoji: '🏢', x: 72, y: 62, size: 28 },
      { emoji: '📡', x: 82, y: 50, size: 20 },
    ],
    effects: [
      { type: 'rain', color: '#EC4899' },
      { type: 'particles', color: '#00D4FF', count: 6 },
    ],
  },
  {
    id: 'deep_ocean',
    name: 'Морская бездна',
    tagline: '11 000 м. Без света.',
    description: 'Там, где давление раздавит любую сталь, жизнь светится сама по себе.',
    emoji: '🌊',
    price: 200,
    rarity: 'rare',
    gradient: 'linear-gradient(180deg, #020810 0%, #021520 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(34,211,238,0.18))',
    accentColor: '#22D3EE',
    effects: [
      { type: 'particles', color: '#22D3EE', count: 18 },
      { type: 'particles', color: '#06B6D4', count: 8 },
    ],
  },
  {
    id: 'lab',
    name: 'Лаборатория',
    tagline: 'Эксперимент начат.',
    description: 'Чистые стены, зелёный сканирующий луч. Кто-то наблюдает за данными. Данные — ты.',
    emoji: '🔬',
    price: 200,
    rarity: 'rare',
    gradient: 'linear-gradient(180deg, #050A05 0%, #0A140A 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(34,255,68,0.12))',
    accentColor: '#22FF44',
    effects: [
      { type: 'scan', color: '#22FF44' },
      { type: 'grid', color: '#22FF44', opacity: 0.15 },
    ],
  },
  {
    id: 'volcano',
    name: 'Вулкан',
    tagline: '1200°C под ногами.',
    description: 'Земля трещит. Снизу — море огня. Каждый шаг — на грани.',
    emoji: '🌋',
    price: 200,
    rarity: 'rare',
    gradient: 'linear-gradient(180deg, #080200 0%, #150500 70%, #2A0800 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(255,85,0,0.35))',
    accentColor: '#FF5500',
    effects: [{ type: 'lava', color: '#FF5500' }],
  },

  // ── Epic ───────────────────────────────────────────────────────────────────
  {
    id: 'deep_space',
    name: 'Глубокий космос',
    tagline: 'До ближайшей звезды — 4 года.',
    description: 'Туманность расцветает в миллионах световых лет. Ты — пылинка. Великолепная пылинка.',
    emoji: '🌌',
    price: 400,
    rarity: 'epic',
    gradient: 'radial-gradient(ellipse at 40% 30%, #0A0040 0%, #020010 60%, #000008 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(129,140,248,0.12))',
    accentColor: '#818CF8',
    effects: [
      { type: 'stars', count: 35 },
      { type: 'particles', color: '#818CF8', count: 5 },
    ],
  },
  {
    id: 'apocalypse',
    name: 'Апокалипсис',
    tagline: 'Последний закат.',
    description: 'Небо горит. Пепел поднимается вверх. Это не конец — это новое начало.',
    emoji: '🔥',
    price: 400,
    rarity: 'epic',
    gradient: 'linear-gradient(180deg, #120202 0%, #2D0404 50%, #080100 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(255,69,0,0.25))',
    accentColor: '#FF4500',
    effects: [{ type: 'ash', color: '#FF6600', count: 20 }],
  },
  {
    id: 'matrix',
    name: 'Матрица',
    tagline: 'Красная или синяя?',
    description: 'Всё что ты видишь — код. Зелёный дождь из символов — это реальность.',
    emoji: '💻',
    price: 400,
    rarity: 'epic',
    gradient: 'linear-gradient(180deg, #000800 0%, #001000 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(0,255,65,0.15))',
    accentColor: '#00FF41',
    effects: [{ type: 'digital_rain', color: '#00FF41' }],
  },
  {
    id: 'aurora',
    name: 'Северное сияние',
    tagline: '3:00. Сибирь. −40°C.',
    description: 'Магнитное поле Земли рисует картины только для тех, кто достаточно терпелив.',
    emoji: '🌠',
    price: 400,
    rarity: 'epic',
    gradient: 'linear-gradient(180deg, #000814 0%, #010C1C 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(16,185,129,0.12))',
    accentColor: '#10B981',
    effects: [{ type: 'aurora', color: '#10B981', color2: '#6366F1' }],
  },

  // ── Legendary ──────────────────────────────────────────────────────────────
  {
    id: 'void_rift',
    name: 'Разлом',
    tagline: 'Между мирами.',
    description: 'Ткань реальности разорвана. То что смотрит оттуда — не имеет имени. Ещё.',
    emoji: '🕳',
    price: 700,
    rarity: 'legendary',
    requiredLevel: 15,
    gradient: 'radial-gradient(ellipse at 50% 45%, #200040 0%, #060010 60%, #010008 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(217,70,239,0.2))',
    accentColor: '#D946EF',
    effects: [
      { type: 'void_rings', color: '#D946EF' },
      { type: 'glitch', color: '#D946EF' },
    ],
  },
  {
    id: 'chrome_world',
    name: 'Хром',
    tagline: 'Последний уровень.',
    description: 'Хромированная реальность. Звёзды, скан-линии, призматическое свечение. Ты достиг этого.',
    emoji: '✨',
    price: 700,
    rarity: 'legendary',
    requiredLevel: 20,
    gradient: 'linear-gradient(160deg, #080818 0%, #10102A 50%, #080818 100%)',
    floorGradient: 'linear-gradient(180deg, transparent, rgba(240,171,252,0.15))',
    accentColor: '#F0ABFC',
    effects: [
      { type: 'stars', count: 20 },
      { type: 'scan', color: '#F0ABFC' },
      { type: 'particles', color: '#F0ABFC', count: 12 },
    ],
  },
];

export const getBackground = (id: string): BackgroundDefinition =>
  BACKGROUNDS.find(b => b.id === id) ?? BACKGROUNDS[0];
