export type BodyShapeId = 'blob' | 'cat' | 'chunky' | 'tall' | 'tailed' | 'split' | 'bear';

export interface BodyShapeDefinition {
  id: BodyShapeId;
  name: string;
  description: string;
  emoji: string;
  eyeLeft:   { cx: number; cy: number };
  eyeRight:  { cx: number; cy: number };
  mouthCy:   number;
  mouthHW:   number;
  cheekLeft:  { cx: number; cy: number; rx: number; ry: number };
  cheekRight: { cx: number; cy: number; rx: number; ry: number };
}

export const BODY_SHAPES: BodyShapeDefinition[] = [
  {
    id: 'blob',
    name: 'Амёба',
    description: 'Классический органический сгусток. Форма есть — смысла нет.',
    emoji: '🫧',
    eyeLeft:   { cx: 76,  cy: 88  },
    eyeRight:  { cx: 124, cy: 88  },
    mouthCy: 133, mouthHW: 28,
    cheekLeft:  { cx: 62,  cy: 110, rx: 14, ry: 9 },
    cheekRight: { cx: 138, cy: 110, rx: 14, ry: 9 },
  },
  {
    id: 'cat',
    name: 'Кошак',
    description: 'Острые уши. Взгляд сверху вниз. Никому ничего не должен.',
    emoji: '🐱',
    eyeLeft:   { cx: 78,  cy: 98  },
    eyeRight:  { cx: 122, cy: 98  },
    mouthCy: 130, mouthHW: 26,
    cheekLeft:  { cx: 60,  cy: 114, rx: 13, ry: 8 },
    cheekRight: { cx: 140, cy: 114, rx: 13, ry: 8 },
  },
  {
    id: 'chunky',
    name: 'Коренастый',
    description: 'Широкий. Устойчивый. Никто не сдвинет с места.',
    emoji: '🧱',
    eyeLeft:   { cx: 78,  cy: 100 },
    eyeRight:  { cx: 122, cy: 100 },
    mouthCy: 130, mouthHW: 26,
    cheekLeft:  { cx: 55,  cy: 118, rx: 13, ry: 8 },
    cheekRight: { cx: 145, cy: 118, rx: 13, ry: 8 },
  },
  {
    id: 'tall',
    name: 'Долговязый',
    description: 'Длинный. Руки достают куда нужно. Смотрит сверху.',
    emoji: '🦒',
    eyeLeft:   { cx: 87,  cy: 76  },
    eyeRight:  { cx: 113, cy: 76  },
    mouthCy: 106, mouthHW: 20,
    cheekLeft:  { cx: 73,  cy: 90, rx: 10, ry: 6 },
    cheekRight: { cx: 127, cy: 90, rx: 10, ry: 6 },
  },
  {
    id: 'tailed',
    name: 'Хвостатый',
    description: 'Хвост — не украшение. Оружие.',
    emoji: '🦎',
    eyeLeft:   { cx: 76,  cy: 88  },
    eyeRight:  { cx: 116, cy: 88  },
    mouthCy: 126, mouthHW: 25,
    cheekLeft:  { cx: 60,  cy: 108, rx: 12, ry: 7 },
    cheekRight: { cx: 128, cy: 108, rx: 12, ry: 7 },
  },
  {
    id: 'split',
    name: 'Двухчастный',
    description: 'Голова и тело договорились работать вместе. Пока.',
    emoji: '🎭',
    eyeLeft:   { cx: 84,  cy: 68  },
    eyeRight:  { cx: 116, cy: 68  },
    mouthCy: 90, mouthHW: 22,
    cheekLeft:  { cx: 63,  cy: 80, rx: 11, ry: 7 },
    cheekRight: { cx: 137, cy: 80, rx: 11, ry: 7 },
  },
  {
    id: 'bear',
    name: 'Медведь',
    description: 'Мягкий снаружи. Не стоит проверять что внутри.',
    emoji: '🐻',
    eyeLeft:   { cx: 80,  cy: 100 },
    eyeRight:  { cx: 120, cy: 100 },
    mouthCy: 130, mouthHW: 26,
    cheekLeft:  { cx: 62,  cy: 116, rx: 14, ry: 9 },
    cheekRight: { cx: 138, cy: 116, rx: 14, ry: 9 },
  },
];

export const getBodyShape = (id: BodyShapeId): BodyShapeDefinition =>
  BODY_SHAPES.find(s => s.id === id) ?? BODY_SHAPES[0];
