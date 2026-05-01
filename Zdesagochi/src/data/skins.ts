import type { ItemRarity } from '../api';

export type EyeStyle =
  | 'normal'    // Обычные круглые (моргают)
  | 'led'       // LED-полоска со скан-линией
  | 'spiral'    // Вращающаяся спираль
  | 'slit'      // Вертикальные зрачки (рептилия)
  | 'crystal'   // Ромб из кристалла
  | 'bubble'    // Перекрывающиеся пузыри
  | 'cross'     // Перекрестие прицела
  | 'star'      // Пятиконечная звезда
  | 'lens'      // Концентрические кольца (объектив)
  | 'hologram'; // Мерцающая голограмма

export type OverlayStyle =
  | 'none'
  | 'circuits'       // Схема платы
  | 'cracks'         // Лавовые трещины
  | 'frost'          // Ледяные кристаллы
  | 'bubbles'        // Токсичные пузырьки
  | 'lightning'      // Молнии
  | 'stars'          // Звёздная пыль
  | 'void'           // Линии искажения
  | 'bioluminescence'// Биолюминесцентные пятна
  | 'prismatic';     // Голографическая радуга

export type AnimStyle =
  | 'float'   // Стандартное парение
  | 'glitch'  // Случайные смещения
  | 'pulse'   // Пульсирующий масштаб
  | 'spark'   // Электрические вспышки
  | 'wave'    // Волновое колыхание
  | 'wobble'  // Желеобразное покачивание
  | 'scan'    // Скан-линия сверху вниз
  | 'rainbow';// Циклический перелив цвета

export interface SkinDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  price: number;
  rarity: ItemRarity;
  requiredLevel?: number;
  colors: {
    body1: string;  // gradient top
    body2: string;  // gradient bottom
    glow: string;
    cheek: string;
  };
  eyeStyle: EyeStyle;
  eyeColor: string;
  overlay: OverlayStyle;
  animStyle: AnimStyle;
  bgTint?: string; // тинт фона сцены
}

export const SKINS: SkinDefinition[] = [
  // ─── Бесплатные стартовые скины ───────────────────────────────────────────
  {
    id: 'default',
    name: 'Нулевой',
    tagline: 'Система запущена',
    description: 'Чистый процесс без имени. Существует в пространстве между тактами процессора. Ghost in the Shell-вайб.',
    emoji: '◼',
    price: 0,
    rarity: 'common',
    colors: { body1: '#2A2A3C', body2: '#0E0E1A', glow: '#00D4FF', cheek: '#0A2030' },
    eyeStyle: 'led',
    eyeColor: '#00D4FF',
    overlay: 'circuits',
    animStyle: 'scan',
    bgTint: 'rgba(0,180,255,0.05)',
  },
  {
    id: 'phantom',
    name: 'Призрак',
    tagline: 'Белый шум',
    description: 'Остаточный сигнал. Ни жив, ни мёртв — просто помеха в эфире. Исчезает раньше, чем ты успеваешь заметить.',
    emoji: '📡',
    price: 0,
    rarity: 'common',
    colors: { body1: '#C8D0E8', body2: '#6070A0', glow: '#9AAEFF', cheek: '#A8B0D0' },
    eyeStyle: 'hologram',
    eyeColor: '#9AAEFF',
    overlay: 'void',
    animStyle: 'glitch',
    bgTint: 'rgba(100,120,255,0.05)',
  },
  {
    id: 'anthracite',
    name: 'Антрацит',
    tagline: 'Без лишних движений',
    description: 'Тёмный. Тихий. Терпеливый. Охотник, который никогда не промахивается. Золотые зрачки в темноте.',
    emoji: '🌑',
    price: 0,
    rarity: 'common',
    colors: { body1: '#252530', body2: '#0C0C16', glow: '#C8901A', cheek: '#18140A' },
    eyeStyle: 'slit',
    eyeColor: '#D49A12',
    overlay: 'none',
    animStyle: 'pulse',
    bgTint: 'rgba(180,120,0,0.05)',
  },
  {
    id: 'mercury',
    name: 'Жидкий металл',
    tagline: 'Форма не имеет значения',
    description: 'Текучий и непостоянный. Принимает любую форму. Отражает мир как зеркало. Уничтожает как ртуть.',
    emoji: '🔮',
    price: 0,
    rarity: 'common',
    colors: { body1: '#B0BAD0', body2: '#484E60', glow: '#C8D4F8', cheek: '#808898' },
    eyeStyle: 'bubble',
    eyeColor: '#E0E8FF',
    overlay: 'prismatic',
    animStyle: 'wave',
    bgTint: 'rgba(180,190,255,0.05)',
  },
  {
    id: 'root',
    name: 'root',
    tagline: 'sudo всё',
    description: 'Уровень 0. Полный доступ. Нет ничего, что он не может переписать. Работает в фоне. Видит всё.',
    emoji: '🖥',
    price: 0,
    rarity: 'common',
    colors: { body1: '#071407', body2: '#020802', glow: '#18FF40', cheek: '#04100A' },
    eyeStyle: 'lens',
    eyeColor: '#18FF40',
    overlay: 'bioluminescence',
    animStyle: 'glitch',
    bgTint: 'rgba(0,200,40,0.06)',
  },
  {
    id: 'cyber',
    name: 'Киберпризрак',
    tagline: 'Из цифрового мира',
    description: 'Существо из сети. Видит мир в двоичном коде. Никогда не спит.',
    emoji: '👾',
    price: 150,
    rarity: 'rare',
    colors: { body1: '#00E5FF', body2: '#0050A0', glow: '#00E5FF', cheek: '#80FFFF' },
    eyeStyle: 'led',
    eyeColor: '#00E5FF',
    overlay: 'circuits',
    animStyle: 'scan',
    bgTint: 'rgba(0,100,200,0.08)',
  },
  {
    id: 'void',
    name: 'Пожиратель Пустоты',
    tagline: 'Из тёмного измерения',
    description: 'Смотришь в пустоту — пустота смотрит на тебя. Бесконечный голод.',
    emoji: '🌑',
    price: 300,
    rarity: 'epic',
    colors: { body1: '#3B0764', body2: '#0D0D0D', glow: '#A855F7', cheek: '#4B0082' },
    eyeStyle: 'spiral',
    eyeColor: '#D946EF',
    overlay: 'void',
    animStyle: 'glitch',
    bgTint: 'rgba(90,0,150,0.1)',
  },
  {
    id: 'molten',
    name: 'Расплавленное Ядро',
    tagline: '1200°C изнутри',
    description: 'Рождён в жерле вулкана. Каждый вдох — облако пепла.',
    emoji: '🌋',
    price: 250,
    rarity: 'epic',
    colors: { body1: '#FF4500', body2: '#7F1D1D', glow: '#FF6600', cheek: '#FF4500' },
    eyeStyle: 'slit',
    eyeColor: '#FF8C00',
    overlay: 'cracks',
    animStyle: 'pulse',
    bgTint: 'rgba(200,50,0,0.08)',
  },
  {
    id: 'arctic',
    name: 'Арктический Шторм',
    tagline: 'Вечная мерзлота',
    description: 'Его дыхание — метель. Прикосновение — мгновенное обморожение.',
    emoji: '❄️',
    price: 200,
    rarity: 'rare',
    colors: { body1: '#BAE6FD', body2: '#38BDF8', glow: '#7DD3FC', cheek: '#BFDBFE' },
    eyeStyle: 'crystal',
    eyeColor: '#0EA5E9',
    overlay: 'frost',
    animStyle: 'float',
    bgTint: 'rgba(56,189,248,0.08)',
  },
  {
    id: 'toxic',
    name: 'Токсичная Слизь',
    tagline: 'Радиоактивен',
    description: 'Мутировал после эксперимента. Кислота вместо слёз. Опасен на расстоянии.',
    emoji: '☢️',
    price: 180,
    rarity: 'rare',
    colors: { body1: '#39FF14', body2: '#006400', glow: '#39FF14', cheek: '#BFFF00' },
    eyeStyle: 'bubble',
    eyeColor: '#ADFF2F',
    overlay: 'bubbles',
    animStyle: 'wobble',
    bgTint: 'rgba(50,200,0,0.08)',
  },
  {
    id: 'shadow',
    name: 'Ночной Страж',
    tagline: 'Хранитель тьмы',
    description: 'Существует только в полночь. Питается страхами. Исчезает на рассвете.',
    emoji: '🌒',
    price: 350,
    rarity: 'epic',
    colors: { body1: '#1E1B4B', body2: '#0F0F1A', glow: '#C084FC', cheek: '#312E81' },
    eyeStyle: 'cross',
    eyeColor: '#C084FC',
    overlay: 'stars',
    animStyle: 'float',
    bgTint: 'rgba(30,10,60,0.12)',
  },
  {
    id: 'thunder',
    name: 'Громовержец',
    tagline: '50 000 вольт',
    description: 'Скорость молнии. Мощь урагана. Полностью непредсказуем.',
    emoji: '⚡',
    price: 280,
    rarity: 'epic',
    colors: { body1: '#FDE047', body2: '#B45309', glow: '#FACC15', cheek: '#FEF9C3' },
    eyeStyle: 'star',
    eyeColor: '#FFF700',
    overlay: 'lightning',
    animStyle: 'spark',
    bgTint: 'rgba(250,200,0,0.08)',
  },
  {
    id: 'abyss',
    name: 'Морская Бездна',
    tagline: '11 000 м глубины',
    description: 'Из самых тёмных глубин. Там нет света — он сам является светом.',
    emoji: '🌊',
    price: 320,
    rarity: 'epic',
    colors: { body1: '#0C4A6E', body2: '#042F4D', glow: '#06B6D4', cheek: '#0E7490' },
    eyeStyle: 'lens',
    eyeColor: '#22D3EE',
    overlay: 'bioluminescence',
    animStyle: 'wave',
    bgTint: 'rgba(0,50,100,0.12)',
  },
  {
    id: 'chrome',
    name: 'Хром Нова',
    tagline: 'Последний своего рода',
    description: 'Звёздное существо из другой галактики. Один во всей вселенной.',
    emoji: '✨',
    price: 500,
    rarity: 'legendary',
    requiredLevel: 10,
    colors: { body1: '#E2E8F0', body2: '#94A3B8', glow: '#D946EF', cheek: '#FFB6C1' },
    eyeStyle: 'hologram',
    eyeColor: '#D946EF',
    overlay: 'prismatic',
    animStyle: 'rainbow',
    bgTint: 'rgba(200,100,255,0.08)',
  },
];

export const getSkin = (id: string): SkinDefinition =>
  SKINS.find(s => s.id === id) ?? SKINS[0];
