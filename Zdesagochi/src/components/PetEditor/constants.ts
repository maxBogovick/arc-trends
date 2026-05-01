import { PetMood } from '../../api';

export type CategoryId = 'body' | 'morph' | 'color' | 'skin' | 'aura' | 'accessories' | 'bg' | 'presets';

export const CATEGORIES: { id: CategoryId; emoji: string; label: string }[] = [
  { id: 'body',        emoji: '🧬', label: 'Форма' },
  { id: 'morph',       emoji: '📐', label: 'Морфинг' },
  { id: 'color',       emoji: '🎨', label: 'Цвет' },
  { id: 'skin',        emoji: '✨', label: 'Скин' },
  { id: 'aura',        emoji: '💫', label: 'Аура' },
  { id: 'bg',          emoji: '🌌', label: 'Фон' },
  { id: 'presets',     emoji: '👗', label: 'Гардероб' },
];

export const MOODS: { id: PetMood; emoji: string; label: string }[] = [
  { id: 'ecstatic', emoji: '🤩', label: 'Восторг' },
  { id: 'happy',    emoji: '😊', label: 'Счастлив' },
  { id: 'content',  emoji: '🙂', label: 'Доволен' },
  { id: 'sad',      emoji: '😢', label: 'Грустит' },
  { id: 'tired',    emoji: '😴', label: 'Устал' },
  { id: 'sick',     emoji: '🤒', label: 'Болеет' },
];

export const RARITY_COLOR: Record<string, string> = {
  common: '#94A3B8', rare: '#3B82F6', epic: '#8B5CF6', legendary: '#F59E0B',
};

export const GLASS = {
  background: 'white',
  border: '1px solid #E5E7EB',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  borderRadius: 16,
};

export const ACTIVE_GLOW = (color: string) => ({
  background: `${color}11`,
  border: `1.5px solid ${color}`,
  boxShadow: `0 4px 12px ${color}33`,
  borderRadius: 16,
});
