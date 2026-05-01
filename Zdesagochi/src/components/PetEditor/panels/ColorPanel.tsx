import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { getSkin } from '../../../data/skins';
import { PALETTES } from '../../../data/palettes';
import type { PetColors } from '../../../data/palettes';
import { GLASS, ACTIVE_GLOW } from '../constants';
import { SectionLabel } from '../Shared';

export function ColorPanel() {
  const { petColorOverride, setPetColorOverride, equippedSkinId } = usePetStore();
  const skin = getSkin(equippedSkinId);
  const base = petColorOverride ?? skin.colors;
  const [custom, setCustom] = useState<PetColors>({ body1: base.body1, body2: base.body2, glow: base.glow, cheek: base.cheek });

  const applyPalette = (p: PetColors) => { setPetColorOverride(p); setCustom(p); };
  const applyCustom  = (next: PetColors) => { setCustom(next); setPetColorOverride(next); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionLabel>🎨 Цветовая схема</SectionLabel>
        {petColorOverride && (
          <button onClick={() => setPetColorOverride(null)}
            className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded-lg transition-colors"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            ↩ Сброс
          </button>
        )}
      </div>

      {/* Palette grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {PALETTES.map((p, i) => {
          const active = petColorOverride?.body1 === p.body1 && petColorOverride?.glow === p.glow;
          return (
            <motion.button key={i}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => applyPalette(p)}
              className="flex flex-col items-center gap-1 p-1.5 rounded-xl"
              style={active ? ACTIVE_GLOW(p.glow) : GLASS}
            >
              <div className="w-full h-8 rounded-lg overflow-hidden relative"
                style={{ background: `linear-gradient(135deg, ${p.body1}, ${p.body2})` }}>
                <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: p.glow, boxShadow: `0 0 5px ${p.glow}` }} />
                {active && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-white/90 flex items-center justify-center text-[8px] font-bold text-gray-800">✓</div>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-lumio-muted leading-tight text-center truncate w-full">{p.name}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Custom pickers */}
      <div className="p-4 rounded-2xl space-y-4" style={GLASS}>
        <p className="text-xs font-semibold text-lumio-muted">✏️ Свой цвет</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'body1' as const, label: 'Основной',  desc: 'Верх тела' },
            { key: 'body2' as const, label: 'Тёмный',    desc: 'Низ / тень' },
            { key: 'glow'  as const, label: 'Свечение',  desc: 'Ауры и глаза' },
            { key: 'cheek' as const, label: 'Щёки',      desc: 'Акцент' },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center gap-2">
              <label className="relative cursor-pointer group shrink-0">
                <div className="w-10 h-10 rounded-xl border-2 border-slate-300 shadow-lg transition-transform group-hover:scale-110"
                  style={{ background: custom[key], boxShadow: `0 0 12px ${custom[key]}66` }} />
                <input type="color" value={custom[key]}
                  onChange={e => applyCustom({ ...custom, [key]: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </label>
              <div>
                <p className="text-xs font-bold text-lumio-text">{label}</p>
                <p className="text-[9px] text-lumio-muted">{desc}</p>
                <p className="text-[8px] font-mono text-lumio-muted">{custom[key]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
