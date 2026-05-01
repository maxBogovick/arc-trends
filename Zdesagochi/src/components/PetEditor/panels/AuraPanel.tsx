import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { AURAS } from '../../../data/auras';
import { RARITY_COLOR, GLASS, ACTIVE_GLOW } from '../constants';
import { SectionLabel } from '../Shared';

export function AuraPanel() {
  const { equippedAuraId, ownedAuras, coins, buyAura, equipAura } = usePetStore();

  return (
    <div className="space-y-3">
      <SectionLabel>💫 Аура питомца</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {AURAS.map(aura => {
          const owned = ownedAuras.includes(aura.id);
          const equipped = equippedAuraId === aura.id;
          const canAfford = coins >= aura.price;
          const rc = RARITY_COLOR[aura.rarity];

          return (
            <motion.div key={aura.id}
              whileHover={{ scale: 1.02, y: -2 }}
              className={`relative p-3 rounded-2xl cursor-pointer transition-all ${!owned && !canAfford ? 'opacity-60 grayscale-[0.5]' : ''}`}
              style={equipped ? ACTIVE_GLOW(aura.color) : GLASS}
              onClick={() => owned ? equipAura(aura.id) : (canAfford && buyAura(aura.id))}
            >
              {/* Rarity tag */}
              <div className="absolute top-2 right-2 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border"
                style={{ color: rc, borderColor: `${rc}44`, background: `${rc}11` }}>
                {aura.rarity}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform duration-500"
                  style={{
                    background: `radial-gradient(circle at 40% 40%, ${aura.color}44, ${aura.color2}22)`,
                    boxShadow: equipped ? `0 0 16px ${aura.color}88` : `0 0 8px ${aura.color}33`,
                    border: `1px solid ${aura.color}44`,
                    transform: equipped ? 'scale(1.1) rotate(10deg)' : 'none'
                  }}>
                  {aura.emoji}
                </div>
                <div className="flex-1 min-w-0 pr-10">
                  <p className="text-xs font-bold text-lumio-text truncate">{aura.name}</p>
                  <p className="text-[8px] font-medium text-lumio-muted italic">{'Эффект присутствия'}</p>
                </div>
              </div>

              <p className="text-[9px] text-lumio-muted leading-tight mb-2 h-6 overflow-hidden line-clamp-2">{aura.description}</p>
              
              <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-50">
                {aura.id !== 'none' ? (
                  owned ? (
                    <span className={`text-[9px] font-bold ${equipped ? 'text-emerald-600' : 'text-indigo-400'}`}>
                      {equipped ? '✓ Активна' : 'Экипировать'}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold" style={{ color: canAfford ? '#D97706' : '#9CA3AF' }}>
                        🪙 {aura.price}
                      </span>
                    </div>
                  )
                ) : (
                  <span className="text-[9px] font-bold text-emerald-600">✓ Базовая</span>
                )}
                
                {!owned && aura.id !== 'none' && canAfford && (
                  <div className="px-2 py-0.5 rounded-lg bg-indigo-500 text-white text-[8px] font-black uppercase">Купить</div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
