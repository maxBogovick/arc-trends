export interface FurnitureDefinition {
  id: string;
  name: string;
  emoji: string;
  category: 'plant' | 'lamp' | 'decor' | 'furniture' | 'gadget' | 'special';
  price: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  defaultScale: number;
  onWall?: boolean;  // hangs on back wall, Y locked to upper zone
}

export const FURNITURE: FurnitureDefinition[] = [
  // ── Plants ─────────────────────────────────────────────────────────────────
  { id: 'cactus',    name: 'Кактус',    emoji: '🌵', category: 'plant',     price: 0,   rarity: 'common',    defaultScale: 1.2 },
  { id: 'pot',       name: 'Горшок',    emoji: '🪴', category: 'plant',     price: 0,   rarity: 'common',    defaultScale: 1.0 },
  { id: 'lantern',   name: 'Фонарь',    emoji: '🏮', category: 'lamp',      price: 50,  rarity: 'common',    defaultScale: 1.0, onWall: true },
  { id: 'palm',      name: 'Пальма',    emoji: '🌴', category: 'plant',     price: 100, rarity: 'common',    defaultScale: 1.4 },
  { id: 'mushroom',  name: 'Гриб',      emoji: '🍄', category: 'plant',     price: 150, rarity: 'rare',      defaultScale: 1.0 },
  { id: 'sakura',    name: 'Сакура',    emoji: '🌸', category: 'plant',     price: 200, rarity: 'rare',      defaultScale: 1.3 },

  // ── Lamps ──────────────────────────────────────────────────────────────────
  { id: 'candle',    name: 'Свеча',     emoji: '🕯️', category: 'lamp',      price: 0,   rarity: 'common',    defaultScale: 0.9 },
  { id: 'torch',     name: 'Фонарик',   emoji: '🔦', category: 'lamp',      price: 50,  rarity: 'common',    defaultScale: 1.0 },
  { id: 'floorlamp', name: 'Торшер',    emoji: '💡', category: 'lamp',      price: 100, rarity: 'common',    defaultScale: 1.2 },
  { id: 'oillamp',   name: 'Лампадка',  emoji: '🪔', category: 'lamp',      price: 200, rarity: 'rare',      defaultScale: 1.0 },
  { id: 'chandelier',name: 'Люстра',    emoji: '✨', category: 'lamp',      price: 300, rarity: 'epic',      defaultScale: 1.5, onWall: true },

  // ── Decor ──────────────────────────────────────────────────────────────────
  { id: 'painting',  name: 'Картина',   emoji: '🖼️', category: 'decor',     price: 0,   rarity: 'common',    defaultScale: 1.2, onWall: true },
  { id: 'mirror',    name: 'Зеркало',   emoji: '🪞', category: 'decor',     price: 150, rarity: 'rare',      defaultScale: 1.2, onWall: true },
  { id: 'easel',     name: 'Мольберт',  emoji: '🎨', category: 'decor',     price: 200, rarity: 'rare',      defaultScale: 1.3 },
  { id: 'mask',      name: 'Маска',     emoji: '🎭', category: 'decor',     price: 250, rarity: 'rare',      defaultScale: 1.0, onWall: true },
  { id: 'trophy',    name: 'Кубок',     emoji: '🏆', category: 'decor',     price: 300, rarity: 'epic',      defaultScale: 1.1 },

  // ── Furniture ──────────────────────────────────────────────────────────────
  { id: 'sofa',      name: 'Диван',     emoji: '🛋️', category: 'furniture', price: 0,   rarity: 'common',    defaultScale: 1.6 },
  { id: 'door',      name: 'Дверь',     emoji: '🚪', category: 'furniture', price: 100, rarity: 'common',    defaultScale: 1.5, onWall: true },
  { id: 'armchair',  name: 'Кресло',    emoji: '🪑', category: 'furniture', price: 100, rarity: 'common',    defaultScale: 1.2 },
  { id: 'shelf',     name: 'Полка',     emoji: '📚', category: 'furniture', price: 150, rarity: 'common',    defaultScale: 1.3, onWall: true },
  { id: 'bed',       name: 'Кровать',   emoji: '🛏️', category: 'furniture', price: 200, rarity: 'rare',      defaultScale: 1.8 },

  // ── Gadgets ────────────────────────────────────────────────────────────────
  { id: 'tv',        name: 'Телевизор', emoji: '📺', category: 'gadget',    price: 200, rarity: 'rare',      defaultScale: 1.4 },
  { id: 'console',   name: 'Приставка', emoji: '🎮', category: 'gadget',    price: 250, rarity: 'rare',      defaultScale: 1.0 },
  { id: 'computer',  name: 'Компьютер', emoji: '🖥️', category: 'gadget',    price: 300, rarity: 'epic',      defaultScale: 1.3 },
  { id: 'hifi',      name: 'Муз. центр',emoji: '🎵', category: 'gadget',    price: 300, rarity: 'epic',      defaultScale: 1.2 },

  // ── Special ────────────────────────────────────────────────────────────────
  { id: 'rainbow',   name: 'Радуга',    emoji: '🌈', category: 'special',   price: 400, rarity: 'epic',      defaultScale: 2.0 },
  { id: 'moon',      name: 'Луна',      emoji: '🌙', category: 'special',   price: 400, rarity: 'epic',      defaultScale: 1.5 },
  { id: 'star',      name: 'Звезда',    emoji: '⭐', category: 'special',   price: 500, rarity: 'epic',      defaultScale: 1.3 },
  { id: 'orb',       name: 'Шар',       emoji: '🔮', category: 'special',   price: 500, rarity: 'epic',      defaultScale: 1.2 },
  { id: 'crystal',   name: 'Кристалл',  emoji: '💎', category: 'special',   price: 600, rarity: 'legendary', defaultScale: 1.4 },
];

export const getFurniture = (id: string): FurnitureDefinition | undefined =>
  FURNITURE.find(f => f.id === id);

export const getFurnitureByCategory = (cat: string): FurnitureDefinition[] =>
  FURNITURE.filter(f => f.category === cat);
