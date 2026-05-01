export type PetColors = { body1: string; body2: string; glow: string; cheek: string };

export const PALETTES: (PetColors & { name: string; emoji: string })[] = [
  { name: 'Нулевой',  emoji: '◼', body1: '#2A2A3C', body2: '#0E0E1A', glow: '#00D4FF', cheek: '#0A2030' },
  { name: 'Алый',     emoji: '🔴', body1: '#3D0A0A', body2: '#1A0303', glow: '#FF3333', cheek: '#2A0808' },
  { name: 'Изумруд',  emoji: '💚', body1: '#0A2A10', body2: '#031508', glow: '#00FF66', cheek: '#083018' },
  { name: 'Океан',    emoji: '🌊', body1: '#0A1A3D', body2: '#030A1A', glow: '#00BBFF', cheek: '#081525' },
  { name: 'Золото',   emoji: '✨', body1: '#2A1A00', body2: '#120B00', glow: '#FFB800', cheek: '#1A1000' },
  { name: 'Матрица',  emoji: '💻', body1: '#071407', body2: '#020802', glow: '#18FF40', cheek: '#04100A' },
  { name: 'Роза',     emoji: '🌸', body1: '#2A0A1A', body2: '#12030B', glow: '#FF66AA', cheek: '#200818' },
  { name: 'Космос',   emoji: '🌌', body1: '#1A0A2A', body2: '#0A0315', glow: '#CC44FF', cheek: '#150820' },
  { name: 'Арктика',  emoji: '❄️', body1: '#B0CFEE', body2: '#5080B0', glow: '#80D8FF', cheek: '#90B8DC' },
  { name: 'Обсидиан', emoji: '⬛', body1: '#141414', body2: '#000000', glow: '#FFFFFF', cheek: '#101010' },
  { name: 'Лава',     emoji: '🌋', body1: '#3D1A00', body2: '#1A0800', glow: '#FF6600', cheek: '#2A1000' },
  { name: 'Призрак',  emoji: '👻', body1: '#C8D0E8', body2: '#6070A0', glow: '#9AAEFF', cheek: '#A8B0D0' },
  { name: 'Янтарь',   emoji: '🟠', body1: '#2A1500', body2: '#120800', glow: '#FF8C00', cheek: '#1A0F00' },
  { name: 'Хром',     emoji: '🔮', body1: '#C0C8D8', body2: '#6070A0', glow: '#D946EF', cheek: '#A0A8C0' },
  { name: 'Токсин',   emoji: '☢️', body1: '#0A2A00', body2: '#030F00', glow: '#39FF14', cheek: '#061A04' },
  { name: 'Закат',    emoji: '🌅', body1: '#3D2200', body2: '#1A0C00', glow: '#FFAA00', cheek: '#2A1600' },
];
