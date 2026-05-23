import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { usePetStore } from '../store/petStore';
import type { ItemRarity } from '../api';
import { getItemTrainingHint } from '../personality/guidanceSelectors';

const RARITY_GLOW: Record<ItemRarity, string> = {
  common:    'rgba(107,114,128,0.2)',
  rare:      'rgba(59,130,246,0.25)',
  epic:      'rgba(124,58,237,0.25)',
  legendary: 'rgba(245,158,11,0.3)',
};
const RARITY_LABEL: Record<ItemRarity, string> = {
  common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟡',
};
const STAT_ICONS: Record<string, string> = {
  hunger: '🍔', happiness: '😊', energy: '⚡', health: '❤️', cleanliness: '🛁', bond: '💜', xp: '⭐',
};

export function InventoryPage() {
  const { inventory, loadInventory, useInventoryItem, actionLoading, pet } = usePetStore();

  useEffect(() => { loadInventory(); }, [loadInventory]);

  if (inventory.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display font-bold text-2xl text-lumio-text mb-2">🎒 Рюкзак</h1>
        <p className="text-lumio-muted mb-6 text-sm">Предметы, купленные в магазине</p>
        <div
          className="rounded-3xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.7)' }}
        >
          <div className="text-5xl mb-4">🎒</div>
          <p className="font-display font-bold text-lumio-text text-lg mb-2">Рюкзак пуст</p>
          <p className="text-lumio-muted text-sm">Загляни в магазин и купи что-нибудь!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl text-lumio-text">🎒 Рюкзак</h1>
        <p className="text-sm text-lumio-muted">{inventory.reduce((a, i) => a + i.quantity, 0)} предметов</p>
      </div>

      <div className="rounded-2xl px-3 py-2 bg-emerald-50/80 border border-emerald-100">
        <p className="text-[11px] font-semibold text-emerald-700">Подсказка характера</p>
        <p className="text-[11px] text-emerald-700/85 leading-snug mt-0.5">{getItemTrainingHint('use')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {inventory.map(({ item, quantity }) => {
          const isLoading = actionLoading === `use_${item.id}`;
          const effects = Object.entries(item.effect).filter(([, v]) => (v ?? 0) !== 0);

          return (
            <motion.div
              key={item.id}
              whileHover={{ y: -3 }}
              className="rounded-2xl p-4 flex flex-col gap-3 relative"
              style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.7)',
                boxShadow: `0 4px 16px ${RARITY_GLOW[item.rarity]}`,
              }}
            >
              {/* Quantity badge */}
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-lumio-purple text-white text-xs font-bold flex items-center justify-center">
                {quantity}
              </div>

              {/* Icon + rarity */}
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'rgba(124,58,237,0.08)' }}>
                  {item.emoji}
                </div>
                <span className="text-base" title={item.rarity}>{RARITY_LABEL[item.rarity]}</span>
              </div>

              <div>
                <p className="font-bold text-lumio-text text-sm">{item.name}</p>
                <p className="text-xs text-lumio-muted leading-tight mt-0.5">{item.description}</p>
                <p className="text-[10px] text-emerald-700 leading-tight mt-1">{getItemTrainingHint('use', item.id)}</p>
              </div>

              {effects.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {effects.map(([k, v]) => (
                    <span key={k} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: (v ?? 0) > 0 ? '#D1FAE5' : '#FEE2E2', color: (v ?? 0) > 0 ? '#065F46' : '#991B1B' }}>
                      {(v ?? 0) > 0 ? '+' : ''}{v} {STAT_ICONS[k] ?? k}
                    </span>
                  ))}
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => useInventoryItem(item.id)}
                disabled={!!actionLoading || pet?.isAsleep}
                className="w-full py-2 rounded-xl font-bold text-sm text-white transition-all"
                style={{
                  background: (actionLoading || pet?.isAsleep) ? '#E5E7EB' : 'linear-gradient(135deg,#7C3AED,#EC4899)',
                  color: (actionLoading || pet?.isAsleep) ? '#9CA3AF' : 'white',
                }}
              >
                {isLoading ? '...' : pet?.isAsleep ? '😴 Спит' : '✨ Использовать'}
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
