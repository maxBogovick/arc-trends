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
              className={`relative p-3 rounded-2xl cursor-pointer ${!owned && !canAfford ? 'opacity-60 grayscale-[0.5]' : ''}`}
              style={equipped ? ACTIVE_GLOW(aura.color) : GLASS}
              onClick={() => owned ? equipAura(aura.id) : (canAfford && buyAura(aura.id))}
            >
              {/* Aura glow preview */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{
                    background: `radial-gradient(circle at 40% 40%, ${aura.color}44, ${aura.color2}22)`,
                    boxShadow: equipped ? `0 0 16px ${aura.color}88` : `0 0 8px ${aura.color}33`,
                    border: `1px solid ${aura.color}44`,
                  }}>
                  {aura.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-lumio-text">{aura.name}</p>
                  <p className="text-[9px] font-semibold" style={{ color: rc }}>{aura.rarity}</p>
                </div>
              </div>
              <p className="text-[9px] text-lumio-muted leading-tight mb-2">{aura.description}</p>
              {aura.id !== 'none' && (
                <div className="text-[10px] font-bold">
                  {owned
                    ? <span className={equipped ? 'text-emerald-600' : 'text-lumio-muted'}>
                        {equipped ? '✓ Активна' : 'Нажми включить'}
                      </span>
                    : <span style={{ color: canAfford ? '#D97706' : '#9CA3AF' }}>
                        🪙 {aura.price}
                      </span>
                  }
                </div>
              )}
              {aura.id === 'none' && equipped && (
                <p className="text-[9px] text-emerald-600 font-bold">✓ Активна</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
