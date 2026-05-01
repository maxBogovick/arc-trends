import type { ItemRarity } from '../api';

export type AuraId = 'none' | 'flame' | 'electric' | 'ice' | 'toxic' | 'cosmic' | 'shadow' | 'divine';

export interface AuraDef {
  id: AuraId;
  name: string;
  emoji: string;
  description: string;
  rarity: ItemRarity;
  price: number;
  color: string;
  color2: string;
}

export const AURAS: AuraDef[] = [
  { id: 'none',     name: 'Без ауры',  emoji: '○',  rarity: 'common',    price: 0,   color: '#888888', color2: '#444444', description: 'Никаких особых эффектов' },
  { id: 'flame',    name: 'Пламя',     emoji: '🔥', rarity: 'rare',      price: 200, color: '#FF6600', color2: '#FF2200', description: 'Горящие языки пламени вокруг питомца' },
  { id: 'electric', name: 'Молния',    emoji: '⚡', rarity: 'rare',      price: 180, color: '#FFE500', color2: '#00AAFF', description: 'Электрические разряды искрят вокруг' },
  { id: 'ice',      name: 'Иней',      emoji: '❄️', rarity: 'epic',      price: 340, color: '#80D8FF', color2: '#0088CC', description: 'Ледяные кристаллы медленно кружатся' },
  { id: 'toxic',    name: 'Токсин',    emoji: '☢️', rarity: 'epic',      price: 360, color: '#39FF14', color2: '#007700', description: 'Зловещее зелёное свечение и пузыри' },
  { id: 'cosmic',   name: 'Космос',    emoji: '🌌', rarity: 'legendary', price: 580, color: '#CC44FF', color2: '#0044CC', description: 'Звёзды и туманности вращаются вокруг' },
  { id: 'shadow',   name: 'Тень',      emoji: '🌑', rarity: 'legendary', price: 620, color: '#6600CC', color2: '#110022', description: 'Тёмная материя поглощает свет вокруг' },
  { id: 'divine',   name: 'Свет',      emoji: '✨', rarity: 'legendary', price: 650, color: '#FFE066', color2: '#FFFFFF', description: 'Святое золотое сияние благословляет питомца' },
];

export const getAura = (id: string): AuraDef =>
  AURAS.find(a => a.id === id) ?? AURAS[0];
