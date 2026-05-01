export type AccessorySlot = 'head' | 'face' | 'back';
export type AccessoryRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AccessoryDef {
  id: string;
  name: string;
  emoji: string;
  slot: AccessorySlot;
  rarity: AccessoryRarity;
  price: number;
  behindBody?: boolean;
}

const h = (id: string, name: string, emoji: string, r: AccessoryRarity, p: number): AccessoryDef => ({ id, name, emoji, slot: 'head', rarity: r, price: p });
const f = (id: string, name: string, emoji: string, r: AccessoryRarity, p: number): AccessoryDef => ({ id, name, emoji, slot: 'face', rarity: r, price: p });
const b = (id: string, name: string, emoji: string, r: AccessoryRarity, p: number, behind = false): AccessoryDef => ({ id, name, emoji, slot: 'back', rarity: r, price: p, behindBody: behind });

export const ACCESSORIES: AccessoryDef[] = [
  h('none_head',   'Пусто',            '—',  'common',    0  ),
  h('cap',         'Кепка',            '🧢', 'common',    60 ),
  h('antenna',     'Антенна',          '📡', 'common',    80 ),
  h('halo',        'Нимб',             '😇', 'rare',      160),
  h('horns',       'Рога',             '😈', 'rare',      180),
  h('crown',       'Корона',           '👑', 'rare',      220),
  h('headphones',  'Наушники',         '🎧', 'rare',      200),
  h('wizard_hat',  'Шляпа мага',       '🧙', 'epic',      340),
  h('top_hat',     'Цилиндр',          '🎩', 'epic',      360),

  f('none_face',   'Пусто',            '—',  'common',    0  ),
  f('scar',        'Шрам',             '⚔️', 'common',    50 ),
  f('glasses',     'Очки',             '👓', 'common',    70 ),
  f('sunglasses',  'Тёмные очки',      '🕶️', 'rare',      150),
  f('monocle',     'Монокль',          '🧐', 'rare',      180),
  f('mask',        'Маска',            '🎭', 'epic',      280),
  f('cyber_eye',   'Кибер-глаз',       '🤖', 'legendary', 500),

  b('none_back',   'Пусто',            '—',  'common',    0   ),
  b('gem',         'Кристалл',         '💎', 'rare',      200 ),
  b('sword',       'Меч',              '⚔️', 'rare',      240 ),
  b('cape',        'Плащ',             '🦸', 'rare',      220, true),
  b('wings',       'Крылья',           '🦋', 'epic',      380, true),
  b('jetpack',     'Джетпак',          '🚀', 'epic',      420, true),
  b('angel_wings', 'Ангел',            '👼', 'legendary', 650, true),
];

export const getAccessoriesBySlot = (slot: AccessorySlot): AccessoryDef[] =>
  ACCESSORIES.filter(a => a.slot === slot);

export const getAccessory = (id: string): AccessoryDef | undefined =>
  ACCESSORIES.find(a => a.id === id);
