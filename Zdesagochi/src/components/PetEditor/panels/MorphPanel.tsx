import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { GLASS } from '../constants';
import { SectionLabel } from '../Shared';

export function MorphPanel() {
  const { petMorph, setPetMorph } = usePetStore();

  const sliders: { key: keyof typeof petMorph; label: string; emoji: string }[] = [
    { key: 'scale',  label: 'Масштаб',  emoji: '⟺' },
    { key: 'width',  label: 'Ширина',   emoji: '↔' },
    { key: 'height', label: 'Высота',   emoji: '↕' },
  ];

  return (
    <div className="space-y-5">
      <SectionLabel>📐 Морфинг формы</SectionLabel>
      <div className="space-y-5">
        {sliders.map(({ key, label, emoji }) => {
          const val = petMorph[key];
          const pct = ((val - 0.4) / (1.8 - 0.4)) * 100;
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
                  type="range" min={0.4} max={1.8} step={0.01}
                  value={val}
                  onChange={e => setPetMorph({ ...petMorph, [key]: parseFloat(e.target.value) })}
                  className="absolute inset-x-0 h-8 opacity-0 cursor-pointer w-full"
                />
                <div className="absolute h-4 w-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                  style={{ left: `calc(${pct}% - 8px)`, background: 'linear-gradient(135deg,#818CF8,#EC4899)' }} />
              </div>
              <div className="flex justify-between text-[9px] text-lumio-muted">
                <span>0.4×</span><span>1.0×</span><span>1.8×</span>
              </div>
            </div>
          );
        })}
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={() => setPetMorph({ scale: 1, width: 1, height: 1 })}
        className="w-full py-2 rounded-xl text-xs font-bold text-lumio-muted transition-all"
        style={GLASS}
      >
        ↩ Сбросить пропорции
      </motion.button>
    </div>
  );
}
