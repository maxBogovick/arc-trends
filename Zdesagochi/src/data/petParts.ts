export type HeadId      = 'round' | 'oval' | 'square' | 'egg' | 'heart' | 'star' | 'blob' | 'diamond';
export type EarsId      = 'none' | 'pointy' | 'floppy' | 'round_ears' | 'horns' | 'antenna' | 'bat' | 'elf';
export type BodyPartId  = 'chubby' | 'slim' | 'blocky' | 'bubble' | 'pear' | 'tank';
export type LimbsId     = 'none' | 'small_paws' | 'long_arms' | 'fins' | 'wings' | 'stubby' | 'tentacles' | 'claws';
export type TailId      = 'none' | 'fluffy' | 'long' | 'fan' | 'spiral' | 'curly' | 'lightning' | 'bow';
export type NoseId      = 'none' | 'button' | 'cat' | 'led' | 'star' | 'heart';
export type MouthStyleId = 'auto' | 'smile' | 'blush' | 'fangs' | 'pixel' | 'zigzag' | 'dot';

export interface HeadDefinition {
  id: HeadId;
  name: string;
  emoji: string;
  eyeLeft:   { cx: number; cy: number };
  eyeRight:  { cx: number; cy: number };
  mouthCy:   number;
  mouthHW:   number;
  cheekLeft:  { cx: number; cy: number; rx: number; ry: number };
  cheekRight: { cx: number; cy: number; rx: number; ry: number };
}

export interface PartMeta {
  id: string;
  name: string;
  emoji: string;
}

export const HEADS: HeadDefinition[] = [
  {
    id: 'round',
    name: 'Круглая',
    emoji: '⭕',
    eyeLeft:   { cx: 78,  cy: 76 },
    eyeRight:  { cx: 122, cy: 76 },
    mouthCy: 103, mouthHW: 24,
    cheekLeft:  { cx: 62,  cy: 96, rx: 14, ry: 9 },
    cheekRight: { cx: 138, cy: 96, rx: 14, ry: 9 },
  },
  {
    id: 'oval',
    name: 'Овальная',
    emoji: '🥚',
    eyeLeft:   { cx: 80,  cy: 72 },
    eyeRight:  { cx: 120, cy: 72 },
    mouthCy: 104, mouthHW: 22,
    cheekLeft:  { cx: 64,  cy: 94, rx: 13, ry: 8 },
    cheekRight: { cx: 136, cy: 94, rx: 13, ry: 8 },
  },
  {
    id: 'square',
    name: 'Квадратная',
    emoji: '⬛',
    eyeLeft:   { cx: 76,  cy: 66 },
    eyeRight:  { cx: 124, cy: 66 },
    mouthCy: 96, mouthHW: 26,
    cheekLeft:  { cx: 60,  cy: 86, rx: 14, ry: 8 },
    cheekRight: { cx: 140, cy: 86, rx: 14, ry: 8 },
  },
  {
    id: 'egg',
    name: 'Пухлые щёки',
    emoji: '🐡',
    eyeLeft:   { cx: 76,  cy: 74 },
    eyeRight:  { cx: 124, cy: 74 },
    mouthCy: 108, mouthHW: 28,
    cheekLeft:  { cx: 54,  cy: 98, rx: 17, ry: 11 },
    cheekRight: { cx: 146, cy: 98, rx: 17, ry: 11 },
  },
  {
    id: 'heart',
    name: 'Сердце',
    emoji: '❤️',
    eyeLeft:   { cx: 78,  cy: 78 },
    eyeRight:  { cx: 122, cy: 78 },
    mouthCy: 106, mouthHW: 22,
    cheekLeft:  { cx: 62,  cy: 97, rx: 13, ry: 8 },
    cheekRight: { cx: 138, cy: 97, rx: 13, ry: 8 },
  },
  {
    id: 'star',
    name: 'Звезда',
    emoji: '⭐',
    eyeLeft:   { cx: 80,  cy: 78 },
    eyeRight:  { cx: 120, cy: 78 },
    mouthCy: 104, mouthHW: 20,
    cheekLeft:  { cx: 64,  cy: 96, rx: 12, ry: 7 },
    cheekRight: { cx: 136, cy: 96, rx: 12, ry: 7 },
  },
  {
    id: 'blob',
    name: 'Амёба',
    emoji: '🟣',
    eyeLeft:   { cx: 78,  cy: 80 },
    eyeRight:  { cx: 122, cy: 80 },
    mouthCy: 108, mouthHW: 26,
    cheekLeft:  { cx: 60,  cy: 100, rx: 15, ry: 10 },
    cheekRight: { cx: 140, cy: 100, rx: 15, ry: 10 },
  },
  {
    id: 'diamond',
    name: 'Бриллиант',
    emoji: '💎',
    eyeLeft:   { cx: 82,  cy: 72 },
    eyeRight:  { cx: 118, cy: 72 },
    mouthCy: 98, mouthHW: 20,
    cheekLeft:  { cx: 66,  cy: 88, rx: 12, ry: 7 },
    cheekRight: { cx: 134, cy: 88, rx: 12, ry: 7 },
  },
];

export const EARS_OPTIONS: PartMeta[] = [
  { id: 'none',       name: 'Нет',       emoji: '✖️' },
  { id: 'pointy',     name: 'Острые',    emoji: '🐱' },
  { id: 'floppy',     name: 'Висячие',   emoji: '🐶' },
  { id: 'round_ears', name: 'Круглые',   emoji: '🐻' },
  { id: 'horns',      name: 'Рожки',     emoji: '😈' },
  { id: 'antenna',    name: 'Антенны',   emoji: '👾' },
  { id: 'bat',        name: 'Летучая мышь', emoji: '🦇' },
  { id: 'elf',        name: 'Эльф',      emoji: '🧝' },
];

export const BODY_PARTS: PartMeta[] = [
  { id: 'chubby', name: 'Пузатое',    emoji: '🫃' },
  { id: 'slim',   name: 'Стройное',   emoji: '🧍' },
  { id: 'blocky', name: 'Квадратное', emoji: '🧱' },
  { id: 'bubble', name: 'Шаровидное', emoji: '🫧' },
  { id: 'pear',   name: 'Грушевидное',emoji: '🍐' },
  { id: 'tank',   name: 'Танк',       emoji: '🤖' },
];

export const LIMBS_OPTIONS: PartMeta[] = [
  { id: 'none',       name: 'Нет',       emoji: '✖️' },
  { id: 'small_paws', name: 'Лапки',     emoji: '🐾' },
  { id: 'long_arms',  name: 'Руки',      emoji: '🦾' },
  { id: 'fins',       name: 'Плавники',  emoji: '🐟' },
  { id: 'wings',      name: 'Крылья',    emoji: '🦋' },
  { id: 'stubby',     name: 'Коротышки', emoji: '🐸' },
  { id: 'tentacles',  name: 'Щупальца',  emoji: '🐙' },
  { id: 'claws',      name: 'Когти',     emoji: '🦅' },
];

export const TAILS_OPTIONS: PartMeta[] = [
  { id: 'none',      name: 'Нет',       emoji: '✖️' },
  { id: 'fluffy',    name: 'Пушистый',  emoji: '🦊' },
  { id: 'long',      name: 'Длинный',   emoji: '🐈' },
  { id: 'fan',       name: 'Веер',      emoji: '🐠' },
  { id: 'spiral',    name: 'Спираль',   emoji: '🐉' },
  { id: 'curly',     name: 'Кучерявый', emoji: '🐷' },
  { id: 'lightning', name: 'Молния',    emoji: '⚡' },
  { id: 'bow',       name: 'Бантик',    emoji: '🎀' },
];

export const NOSE_OPTIONS: PartMeta[] = [
  { id: 'none',   name: 'Нет',       emoji: '✖️' },
  { id: 'button', name: 'Кнопка',    emoji: '🔘' },
  { id: 'cat',    name: 'Кошачий',   emoji: '🐱' },
  { id: 'led',    name: 'LED-точка', emoji: '💡' },
  { id: 'star',   name: 'Звёздочка', emoji: '⭐' },
  { id: 'heart',  name: 'Сердечко',  emoji: '❤️' },
];

export const MOUTH_STYLES: PartMeta[] = [
  { id: 'auto',   name: 'По настроению', emoji: '🎭' },
  { id: 'smile',  name: 'Улыбка',        emoji: '😊' },
  { id: 'blush',  name: 'Смущение',      emoji: '🥺' },
  { id: 'fangs',  name: 'Клыки',         emoji: '🧛' },
  { id: 'pixel',  name: 'Пиксель',       emoji: '🕹' },
  { id: 'zigzag', name: 'Зигзаг',        emoji: '〰️' },
  { id: 'dot',    name: 'Кружок',        emoji: '⭕' },
];

export const HEAD_OPTIONS: PartMeta[] = HEADS.map(h => ({ id: h.id, name: h.name, emoji: h.emoji }));

export const getHead = (id: HeadId): HeadDefinition =>
  HEADS.find(h => h.id === id) ?? HEADS[0];
