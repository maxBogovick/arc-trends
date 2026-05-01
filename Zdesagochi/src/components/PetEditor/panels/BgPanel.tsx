import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { BACKGROUNDS } from '../../../data/backgrounds';
import { RARITY_COLOR } from '../constants';
import { SectionLabel } from '../Shared';

export function BgPanel() {
  const { equippedBgId, ownedBgs, coins, pet, buyBg, equipBg } = usePetStore();
  const petLevel = pet?.level ?? 0;

  return (
    <div className="space-y-3">
      <SectionLabel>🌌 Фон сцены</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {BACKGROUNDS.map(bg => {
          const owned = ownedBgs.includes(bg.id);
          const equipped = equippedBgId === bg.id;
          const locked = !owned && !!bg.requiredLevel && petLevel < bg.requiredLevel;
          const canAfford = coins >= bg.price;
          const rc = RARITY_COLOR[bg.rarity];

          return (
            <motion.div key={bg.id}
              whileHover={{ scale: 1.02, y: -2 }}
              className={`relative overflow-hidden rounded-2xl cursor-pointer ${locked ? 'opacity-60 grayscale-[0.5]' : ''}`}
              style={{
                border: equipped ? `1.5px solid ${bg.accentColor}88` : '1px solid #E5E7EB',
                boxShadow: equipped ? `0 0 20px ${bg.accentColor}44` : 'none',
              }}
              onClick={() => owned ? equipBg(bg.id) : (!locked && canAfford && buyBg(bg.id))}
            >
              {/* Preview */}
              <div className="h-16 flex items-center justify-center relative" style={{ background: bg.gradient }}>
                <span className="text-2xl" style={{ filter: `drop-shadow(0 0 6px ${bg.accentColor})` }}>{bg.emoji}</span>
                {locked && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-lg">🔒</span></div>}
                {equipped && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: bg.accentColor }}>✓</div>
                )}
              </div>
              {/* Info */}
              <div className="px-2 py-1.5" style={{ background: 'white' }}>
                <p className="text-[11px] font-bold text-lumio-text truncate">{bg.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[8px] font-bold" style={{ color: rc }}>{bg.rarity}</span>
                  {!owned && (
                    <span className="text-[9px] font-bold" style={{ color: canAfford ? '#D97706' : '#9CA3AF' }}>
                      🪙 {bg.price}
                    </span>
                  )}
                  {owned && !equipped && <span className="text-[9px] font-medium text-lumio-muted">Выбрать</span>}
                  {equipped && <span className="text-[9px] font-bold text-emerald-600">✓ Надет</span>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
