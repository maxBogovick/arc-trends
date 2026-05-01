import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { getAccessoriesBySlot } from '../../../data/accessories';
import type { AccessorySlot } from '../../../data/accessories';
import { RARITY_COLOR, GLASS, ACTIVE_GLOW } from '../constants';
import { SectionLabel } from '../Shared';

export function AccessoriesPanel() {
  const [slot, setSlot] = useState<AccessorySlot>('head');
  const { equippedAccessories, setAccessory, accessoryConfigs, setAccessoryConfig } = usePetStore();

  const SLOT_TABS: { id: AccessorySlot; emoji: string; label: string }[] = [
    { id: 'head', emoji: '👒', label: 'Голова' },
    { id: 'face', emoji: '😎', label: 'Лицо' },
    { id: 'back', emoji: '🎒', label: 'Спина' },
  ];

  const items = getAccessoriesBySlot(slot);
  const equipped = equippedAccessories[slot];
  const config = accessoryConfigs[slot];

  return (
    <div className="space-y-3">
      <SectionLabel>👒 Аксессуары</SectionLabel>
      <p className="text-xs text-lumio-muted">Бесплатно — экипируй что хочешь</p>

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

      <div className="grid grid-cols-3 gap-2">
        {items.map(acc => {
          const isEquipped = equipped === acc.id;
          const rc = RARITY_COLOR[acc.rarity];
          return (
            <motion.button key={acc.id}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAccessory(slot, acc.id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
              style={isEquipped ? ACTIVE_GLOW('#818CF8') : GLASS}
            >
              <span className="text-2xl">{acc.id.startsWith('none') ? '—' : acc.emoji}</span>
              <span className="text-[10px] font-semibold text-lumio-text text-center leading-tight">{acc.name}</span>
              <span className="text-[8px] font-bold" style={{ color: rc }}>{acc.rarity}</span>
              {isEquipped && <span className="text-[9px] font-bold text-emerald-600">✓</span>}
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
