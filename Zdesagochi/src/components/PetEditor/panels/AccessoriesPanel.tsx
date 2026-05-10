import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { getAccessoriesBySlot } from '../../../data/accessories';
import type { AccessorySlot } from '../../../data/accessories';
import { RARITY_COLOR, GLASS, ACTIVE_GLOW } from '../constants';
import { SectionLabel } from '../Shared';

type RarityFilter = 'all' | 'common' | 'rare' | 'epic' | 'legendary';

const RARITY_FILTERS: { id: RarityFilter; label: string }[] = [
  { id: 'all',       label: 'Все'    },
  { id: 'common',    label: 'C'      },
  { id: 'rare',      label: 'R'      },
  { id: 'epic',      label: 'E'      },
  { id: 'legendary', label: 'L'      },
];

export function AccessoriesPanel() {
  const [slot, setSlot] = useState<AccessorySlot>('head');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const { equippedAccessories, setAccessory, accessoryConfigs, setAccessoryConfig, ownedAccessoriesList, buyAccessory, coins } = usePetStore();

  const SLOT_TABS: { id: AccessorySlot; emoji: string; label: string }[] = [
    { id: 'head',     emoji: '👒', label: 'Голова' },
    { id: 'face',     emoji: '😎', label: 'Лицо' },
    { id: 'neck',     emoji: '📿', label: 'Шея' },
    { id: 'clothing', emoji: '👕', label: 'Одежда' },
    { id: 'back',     emoji: '🎒', label: 'Спина' },
  ];

  const items = getAccessoriesBySlot(slot).filter(a =>
    rarityFilter === 'all' || a.id.startsWith('none') || a.rarity === rarityFilter
  );
  const equipped = equippedAccessories[slot];
  const config = accessoryConfigs[slot];

  return (
    <div className="space-y-3">
      <SectionLabel>👒 Аксессуары</SectionLabel>
      <div className="flex justify-between items-center px-1">
        <p className="text-[10px] text-lumio-muted">Примерь любые вещи перед покупкой</p>
        <div className="text-[10px] font-bold text-lumio-text">🪙 {coins.toLocaleString()}</div>
      </div>

      {/* Slot tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F3F4F6' }}>
        {SLOT_TABS.map(t => (
          <button key={t.id} onClick={() => setSlot(t.id)}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: slot === t.id ? 'white' : 'transparent', boxShadow: slot === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              color: slot === t.id ? '#1E1147' : '#6B7280',
            }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Rarity filter */}
      <div className="flex gap-1">
        {RARITY_FILTERS.map(f => (
          <button key={f.id} onClick={() => setRarityFilter(f.id)}
            className="flex-1 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={{
              background: rarityFilter === f.id ? '#818CF8' : '#F3F4F6',
              color: rarityFilter === f.id ? 'white' : '#6B7280',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {items.map(acc => {
          const isEquipped = equipped === acc.id;
          const isOwned = ownedAccessoriesList.includes(acc.id) || acc.id.startsWith('none');
          const rc = RARITY_COLOR[acc.rarity];

          return (
            <motion.button key={acc.id}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setAccessory(slot, acc.id);
                // recordHistory is handled by store now
              }}
              className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-all relative overflow-hidden"
              style={isEquipped ? ACTIVE_GLOW('#818CF8') : GLASS}
            >
              <span className="text-2xl">{acc.id.startsWith('none') ? '—' : acc.emoji}</span>
              <span className="text-[9px] font-semibold text-lumio-text text-center leading-tight h-6 flex items-center">{acc.name}</span>
              
              {!isOwned && (
                <div className="mt-1 flex flex-col items-center gap-0.5">
                  <div className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded-full border border-amber-200">
                    🪙 {acc.price}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      buyAccessory(acc.id);
                    }}
                    className="mt-0.5 px-2 py-0.5 bg-indigo-500 text-white text-[8px] font-black rounded-lg uppercase tracking-tighter"
                  >
                    Купить
                  </motion.button>
                </div>
              )}

              {isOwned && !acc.id.startsWith('none') && (
                <span className="text-[8px] font-bold mt-1" style={{ color: rc }}>{acc.rarity}</span>
              )}

              {isEquipped && isOwned && (
                <div className="absolute top-1 right-1 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                  <span className="text-[6px] text-white font-bold">✓</span>
                </div>
              )}

              {isEquipped && !isOwned && (
                <div className="absolute top-1 right-1 px-1 rounded bg-amber-500 text-[6px] text-white font-bold border border-white">
                  ПРЕВЬЮ
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {equipped && !equipped.startsWith('none') && (
        <div className="mt-4 p-3 rounded-2xl space-y-3" style={GLASS}>
          <p className="text-xs font-semibold text-lumio-text">Настройка позиции ({SLOT_TABS.find(t => t.id === slot)?.label})</p>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-lumio-muted">
              <span>Масштаб: {config.scale.toFixed(2)}x</span>
            </div>
            <input type="range" min="0.3" max="3" step="0.05" value={config.scale}
              onChange={e => setAccessoryConfig(slot, { ...config, scale: parseFloat(e.target.value) })}
              className="w-full accent-indigo-400" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-lumio-muted">
              <span>По оси X: {config.x}px</span>
            </div>
            <input type="range" min="-100" max="100" step="1" value={config.x}
              onChange={e => setAccessoryConfig(slot, { ...config, x: parseInt(e.target.value) })}
              className="w-full accent-indigo-400" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-lumio-muted">
              <span>По оси Y: {config.y}px</span>
            </div>
            <input type="range" min="-100" max="100" step="1" value={config.y}
              onChange={e => setAccessoryConfig(slot, { ...config, y: parseInt(e.target.value) })}
              className="w-full accent-indigo-400" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-lumio-muted">
              <span>Поворот: {config.rotation}°</span>
            </div>
            <input type="range" min="-180" max="180" step="1" value={config.rotation}
              onChange={e => setAccessoryConfig(slot, { ...config, rotation: parseInt(e.target.value) })}
              className="w-full accent-indigo-400" />
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl" style={{ background: '#F3F4F6' }}>
            <span className="text-[10px] font-bold text-lumio-text">Отображать ЗА питомцем</span>
            <button
              onClick={() => setAccessoryConfig(slot, { ...config, behind: !config.behind })}
              className={`w-10 h-5 rounded-full relative transition-colors ${config.behind ? 'bg-indigo-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.behind ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          
          <button onClick={() => setAccessoryConfig(slot, { scale: 1, x: 0, y: 0, rotation: 0, behind: slot === 'back' })}
            className="w-full py-1.5 rounded-xl text-xs font-bold text-lumio-muted transition-all hover:bg-slate-200"
            style={{ background: '#F3F4F6' }}>
            Сбросить
          </button>
        </div>
      )}
    </div>
  );
}
