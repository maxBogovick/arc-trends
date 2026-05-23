import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { usePetStore } from '../store/petStore';
import type { ShopItem, ItemType, ItemRarity, Room } from '../api';
import { ROOMS_DATA } from '../data/rooms';
import { getItemTrainingHint } from '../personality/guidanceSelectors';

const RARITY_STYLE: Record<ItemRarity, { label: string; border: string; bg: string; text: string }> = {
  common:    { label: 'Обычный',    border: '#D1D5DB', bg: '#F9FAFB', text: '#6B7280' },
  rare:      { label: 'Редкий',     border: '#93C5FD', bg: '#EFF6FF', text: '#2563EB' },
  epic:      { label: 'Эпический',  border: '#C4B5FD', bg: '#F5F3FF', text: '#7C3AED' },
  legendary: { label: 'Легендарный',border: '#FCD34D', bg: '#FFFBEB', text: '#D97706' },
};

const TYPE_LABELS: Record<ItemType, { label: string; emoji: string }> = {
  food:        { label: 'Еда',       emoji: '🍔' },
  toy:         { label: 'Игрушки',   emoji: '🎮' },
  medicine:    { label: 'Медицина',  emoji: '💊' },
  decoration:  { label: 'Декор',     emoji: '🎀' },
};

type Filter = ItemType | 'rooms' | 'all';

function ItemCard({ item, onBuy, canAfford }: { item: ShopItem; onBuy: () => void; canAfford: boolean }) {
  const r = RARITY_STYLE[item.rarity];
  const effects = Object.entries(item.effect)
    .filter(([, v]) => (v ?? 0) !== 0)
    .map(([k, v]) => ({ key: k, val: v ?? 0 }));

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: r.bg, border: `1.5px solid ${r.border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'rgba(255,255,255,0.7)' }}>
          {item.emoji}
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: r.border + '33', color: r.text }}>
          {r.label}
        </span>
      </div>

      <div>
        <p className="font-display font-bold text-lumio-text text-sm">{item.name}</p>
        <p className="text-xs text-lumio-muted mt-0.5 leading-tight">{item.description}</p>
        <p className="text-[10px] text-emerald-700 mt-1 leading-tight">{getItemTrainingHint('buy', item.id)}</p>
      </div>

      {effects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {effects.map(({ key, val }) => {
            const ICONS: Record<string, string> = { hunger: '🍔', happiness: '😊', energy: '⚡', health: '❤️', cleanliness: '🛁', bond: '💜', xp: '⭐' };
            return (
              <span key={key} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: val > 0 ? '#D1FAE5' : '#FEE2E2', color: val > 0 ? '#065F46' : '#991B1B' }}>
                {val > 0 ? '+' : ''}{val} {ICONS[key] ?? key}
              </span>
            );
          })}
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={onBuy}
        disabled={!canAfford}
        className="w-full py-2 rounded-xl font-display font-bold text-sm transition-all"
        style={{
          background: canAfford ? `linear-gradient(135deg, ${r.border}, ${r.text}88)` : '#E5E7EB',
          color: canAfford ? 'white' : '#9CA3AF',
          cursor: canAfford ? 'pointer' : 'not-allowed',
          boxShadow: canAfford ? `0 4px 12px ${r.border}88` : 'none',
        }}
      >
        🪙 {item.price}
      </motion.button>
    </motion.div>
  );
}

function RoomCard({ room, onBuy, onEquip, coins, isEquipped }: {
  room: Room; onBuy: () => void; onEquip: () => void; coins: number; isEquipped: boolean;
}) {
  return (
    <motion.div whileHover={{ y: -3 }} className="rounded-2xl overflow-hidden" style={{ border: isEquipped ? '2px solid #7C3AED' : '1.5px solid #E5E7EB' }}>
      <div className="h-24 relative" style={{ background: room.gradient }}>
        {room.decorations.slice(0, 3).map((d, i) => (
          <span key={i} className="absolute select-none" style={{ left: `${d.x}%`, top: `${d.y}%`, fontSize: d.size * 0.6 }}>{d.emoji}</span>
        ))}
        {isEquipped && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#7C3AED' }}>
            Активна ✓
          </div>
        )}
      </div>
      <div className="p-3 bg-white">
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-sm text-lumio-text">{room.emoji} {room.name}</p>
        </div>
        <p className="text-xs text-lumio-muted mb-2">{room.description}</p>
        {room.unlocked ? (
          <button onClick={onEquip} disabled={isEquipped}
            className="w-full py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: isEquipped ? '#E5E7EB' : 'linear-gradient(135deg,#7C3AED,#EC4899)', color: isEquipped ? '#9CA3AF' : 'white' }}>
            {isEquipped ? '✓ Активна' : 'Активировать'}
          </button>
        ) : (
          <button onClick={onBuy} disabled={coins < room.price}
            className="w-full py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: coins >= room.price ? 'linear-gradient(135deg,#F59E0B,#D97706)' : '#E5E7EB', color: coins >= room.price ? 'white' : '#9CA3AF' }}>
            🪙 {room.price} — Купить
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function ShopPage() {
  const { shopItems, rooms, coins, buyItem, buyRoom, equipRoom, loadShop, loadRooms, actionLoading, pet } = usePetStore();
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => { loadShop(); loadRooms(); }, [loadShop, loadRooms]);

  const displayRooms = rooms.length > 0 ? rooms : ROOMS_DATA;
  const filters: { id: Filter; label: string; emoji: string }[] = [
    { id: 'all', label: 'Всё', emoji: '🏪' },
    { id: 'food', label: 'Еда', emoji: '🍔' },
    { id: 'toy', label: 'Игрушки', emoji: '🎮' },
    { id: 'medicine', label: 'Медицина', emoji: '💊' },
    { id: 'decoration', label: 'Декор', emoji: '🎀' },
    { id: 'rooms', label: 'Комнаты', emoji: '🏠' },
  ];

  const filtered = filter === 'all' ? shopItems
    : filter === 'rooms' ? [] : shopItems.filter(i => i.type === filter);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-lumio-text">🛒 Магазин</h1>
          <p className="text-sm text-lumio-muted">Покупай предметы, чтобы баловать питомца</p>
        </div>
        <div className="px-4 py-2 rounded-2xl" style={{ background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <p className="font-display font-bold text-amber-900 text-xl">🪙 {coins.toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-2xl px-3 py-2 bg-emerald-50/80 border border-emerald-100">
        <p className="text-[11px] font-semibold text-emerald-700">Помощник характера</p>
        <p className="text-[11px] text-emerald-700/85 leading-snug mt-0.5">{getItemTrainingHint('buy')}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0"
            style={{
              background: filter === f.id ? 'linear-gradient(135deg,#7C3AED,#EC4899)' : 'rgba(255,255,255,0.8)',
              color: filter === f.id ? 'white' : '#6B7280',
              border: filter === f.id ? 'none' : '1px solid #E5E7EB',
            }}
          >
            {f.emoji} {f.label}
          </button>
        ))}
      </div>

      {/* Items grid */}
      {filter !== 'rooms' && (
        <>
          {filtered.length === 0 ? (
            <p className="text-center text-lumio-muted py-8">Загружаем товары...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  canAfford={coins >= item.price && !actionLoading}
                  onBuy={() => buyItem(item.id)}
                />
              ))}
            </div>
          )}

          {/* Type hint */}
          {filter !== 'all' && (filter as string) !== 'rooms' && (
            <div className="text-center">
              <p className="text-xs text-lumio-muted">{TYPE_LABELS[filter as ItemType]?.emoji} {TYPE_LABELS[filter as ItemType]?.label}</p>
            </div>
          )}
        </>
      )}

      {/* Rooms */}
      {(filter === 'all' || (filter as string) === 'rooms') && (
        <div>
          <h2 className="font-display font-bold text-lg text-lumio-text mb-3">🏠 Комнаты</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {displayRooms.map(room => (
              <RoomCard
                key={room.id}
                room={room}
                coins={coins}
                isEquipped={pet?.equippedRoomId === room.id}
                onBuy={() => buyRoom(room.id)}
                onEquip={() => equipRoom(room.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
