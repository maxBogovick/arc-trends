import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { SKINS } from '../../../data/skins';
import { RARITY_COLOR, GLASS, ACTIVE_GLOW } from '../constants';
import { SectionLabel } from '../Shared';

export function SkinPanel() {
  const { equippedSkinId, ownedSkins, coins, pet, buySkin, equipSkin } = usePetStore();
  const [filter, setFilter] = useState<'all' | 'owned'>('all');
  const petLevel = pet?.level ?? 0;

  const filtered = SKINS.filter(s => filter === 'owned' ? ownedSkins.includes(s.id) : true);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>✨ Скин питомца</SectionLabel>
        <div className="flex gap-1">
          {(['all', 'owned'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={{
                background: filter === f ? '#7C3AED' : '#F3F4F6',
                color: filter === f ? 'white' : '#6B7280',
              }}>
              {f === 'all' ? '✦ Все' : '✓ Мои'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {filtered.map(skin => {
          const owned = ownedSkins.includes(skin.id);
          const equipped = equippedSkinId === skin.id;
          const locked = !owned && !!skin.requiredLevel && petLevel < skin.requiredLevel;
          const canAfford = coins >= skin.price;
          const rc = RARITY_COLOR[skin.rarity];

          return (
            <motion.div key={skin.id}
              whileHover={{ scale: 1.02, y: -2 }}
              className={`relative p-3 rounded-2xl flex gap-2 items-center cursor-pointer ${locked ? 'opacity-60 grayscale-[0.5]' : ''}`}
              style={equipped ? ACTIVE_GLOW(skin.colors.glow) : GLASS}
              onClick={() => owned ? equipSkin(skin.id) : (!locked && canAfford && buySkin(skin.id))}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: `linear-gradient(135deg, ${skin.colors.body1}, ${skin.colors.body2})`, boxShadow: `0 0 10px ${skin.colors.glow}55` }}>
                {locked ? '🔒' : skin.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-lumio-text truncate">{skin.name}</p>
                <p className="text-[9px] font-semibold" style={{ color: rc }}>{skin.rarity}</p>
                {!owned && (
                  <p className="text-[10px] font-bold" style={{ color: canAfford ? '#D97706' : '#9CA3AF' }}>
                    🪙 {skin.price}
                  </p>
                )}
                {owned && !equipped && <p className="text-[9px] text-lumio-muted">Нажми надеть</p>}
                {equipped && <p className="text-[9px] font-bold text-emerald-600">✓ Надет</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
