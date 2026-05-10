import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { GLASS, ACTIVE_GLOW } from '../constants';
import { SectionLabel } from '../Shared';

const DEFAULT_MORPH = { scale: 1, width: 1, height: 1, headScale: 1, earsScale: 1, limbsScale: 1, squish: 1 };

const MORPH_PRESETS = [
  { id: 'default',    name: 'Обычный',       emoji: '🟣', morph: DEFAULT_MORPH },
  { id: 'chibi',      name: 'Чиби',          emoji: '🐣', morph: { scale: 0.95, width: 1,    height: 0.88, headScale: 1.5, earsScale: 1.4, limbsScale: 0.7,  squish: 1.1  } },
  { id: 'giant_head', name: 'Большая голова', emoji: '🗿', morph: { scale: 1,    width: 1,    height: 1,    headScale: 1.8, earsScale: 1.6, limbsScale: 0.85, squish: 1    } },
  { id: 'tiny_body',  name: 'Малютка',        emoji: '🐁', morph: { scale: 0.75, width: 0.85, height: 0.75, headScale: 1,   earsScale: 0.9, limbsScale: 0.75, squish: 0.9  } },
  { id: 'balloon',    name: 'Шарик',          emoji: '🎈', morph: { scale: 1.1,  width: 1.3,  height: 1.3,  headScale: 1.1, earsScale: 0.9, limbsScale: 0.8,  squish: 1.3  } },
  { id: 'slim',       name: 'Стройный',       emoji: '🪄', morph: { scale: 1,    width: 0.65, height: 1.2,  headScale: 0.9, earsScale: 1,   limbsScale: 0.9,  squish: 0.65 } },
];

type SliderDef = { key: keyof typeof DEFAULT_MORPH; label: string; emoji: string; min: number; max: number };

const SLIDERS: SliderDef[] = [
  { key: 'scale',      label: 'Масштаб',      emoji: '⟺', min: 0.4, max: 2.0 },
  { key: 'width',      label: 'Ширина',        emoji: '↔', min: 0.4, max: 1.8 },
  { key: 'height',     label: 'Высота',        emoji: '↕', min: 0.4, max: 1.8 },
  { key: 'headScale',  label: 'Голова',        emoji: '🐺', min: 0.4, max: 2.2 },
  { key: 'earsScale',  label: 'Уши',           emoji: '👂', min: 0.2, max: 2.5 },
  { key: 'limbsScale', label: 'Лапы',          emoji: '🦾', min: 0.2, max: 2.0 },
  { key: 'squish',     label: 'Сжатие тела',   emoji: '🫳', min: 0.4, max: 1.8 },
];

export function MorphPanel() {
  const { petMorph, setPetMorph } = usePetStore();

  const activePreset = MORPH_PRESETS.find(p =>
    (Object.keys(p.morph) as (keyof typeof DEFAULT_MORPH)[]).every(
      k => Math.abs(p.morph[k] - petMorph[k]) < 0.01
    )
  );

  return (
    <div className="space-y-5">
      <SectionLabel>📐 Морфинг формы</SectionLabel>

      {/* Presets */}
      <div className="grid grid-cols-3 gap-2">
        {MORPH_PRESETS.map(p => {
          const isActive = activePreset?.id === p.id;
          return (
            <motion.button
              key={p.id}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPetMorph({ ...p.morph })}
              className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-2xl text-center"
              style={isActive ? ACTIVE_GLOW('#818CF8') : GLASS}
            >
              <span className="text-xl">{p.emoji}</span>
              <span className="text-[9px] font-bold text-lumio-text leading-tight">{p.name}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Sliders */}
      <div className="space-y-5">
        {SLIDERS.map(({ key, label, emoji, min, max }) => {
          const val = petMorph[key] ?? 1;
          const pct = ((val - min) / (max - min)) * 100;
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-lumio-text">{emoji} {label}</span>
                <span className="text-xs font-mono text-lumio-muted">{val.toFixed(2)}×</span>
              </div>
              <div className="relative h-8 flex items-center">
                <div className="absolute inset-x-0 h-1.5 rounded-full" style={{ background: '#E5E7EB' }} />
                <div className="absolute left-0 h-1.5 rounded-full"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#818CF8,#EC4899)' }} />
                <input
                  type="range" min={min} max={max} step={0.01}
                  value={val}
                  onChange={e => setPetMorph({ ...petMorph, [key]: parseFloat(e.target.value) })}
                  className="absolute inset-x-0 h-8 opacity-0 cursor-pointer w-full"
                />
                <div className="absolute h-4 w-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                  style={{ left: `calc(${pct}% - 8px)`, background: 'linear-gradient(135deg,#818CF8,#EC4899)' }} />
              </div>
              <div className="flex justify-between text-[9px] text-lumio-muted">
                <span>{min}×</span><span>1.0×</span><span>{max}×</span>
              </div>
            </div>
          );
        })}
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={() => setPetMorph({ ...DEFAULT_MORPH })}
        className="w-full py-2 rounded-xl text-xs font-bold text-lumio-muted transition-all"
        style={GLASS}
      >
        ↩ Сбросить пропорции
      </motion.button>
    </div>
  );
}
