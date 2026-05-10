export type AccessorySlot = 'head' | 'face' | 'back' | 'neck' | 'clothing';
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
const n = (id: string, name: string, emoji: string, r: AccessoryRarity, p: number): AccessoryDef => ({ id, name, emoji, slot: 'neck', rarity: r, price: p });
const cl = (id: string, name: string, emoji: string, r: AccessoryRarity, p: number): AccessoryDef => ({ id, name, emoji, slot: 'clothing', rarity: r, price: p });

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

  n('none_neck',   'Пусто',            '—',  'common',    0   ),
  n('collar',      'Ошейник',          '🔵', 'common',    60  ),
  n('scarf',       'Шарф',             '🧣', 'common',    80  ),
  n('tie',         'Галстук',          '👔', 'common',    70  ),
  n('necklace',    'Ожерелье',         '📿', 'rare',      160 ),
  n('choker',      'Чокер',            '🖤', 'rare',      180 ),
  n('bow_tie',     'Бабочка',          '🎀', 'rare',      150 ),
  n('chain',       'Цепь',             '⛓️', 'epic',      280 ),
  n('amulet',      'Амулет',           '🔮', 'epic',      320 ),

  cl('none_clothing', 'Пусто',         '—',  'common',    0   ),
  cl('hoodie',        'Худи',          '👕', 'common',    90  ),
  cl('vest',          'Жилет',         '🦺', 'common',    80  ),
  cl('armor',         'Доспехи',       '🛡️', 'rare',      240 ),
  cl('coat',          'Пальто',        '🧥', 'rare',      200 ),
  cl('robe',          'Мантия',        '🪄', 'epic',      350 ),
  cl('uniform',       'Форма',         '👮', 'epic',      320 ),
  cl('dress',         'Платье',        '👗', 'rare',      220 ),
  cl('suit',          'Костюм',        '🤵', 'legendary', 500 ),
];

export const getAccessoriesBySlot = (slot: AccessorySlot): AccessoryDef[] =>
  ACCESSORIES.filter(a => a.slot === slot);

export const getAccessory = (id: string): AccessoryDef | undefined =>
  ACCESSORIES.find(a => a.id === id);
