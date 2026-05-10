import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { getSkin } from '../../../data/skins';
import type { EyeStyle } from '../../../data/skins';
import { GLASS, ACTIVE_GLOW } from '../constants';
import { SectionLabel } from '../Shared';

const EYE_STYLES: { id: EyeStyle; emoji: string; label: string; desc: string }[] = [
  { id: 'normal',   emoji: '👁',  label: 'Обычные',    desc: 'Моргают' },
  { id: 'cute',     emoji: '🥺',  label: 'Кавай',      desc: 'Большие со звёздой' },
  { id: 'led',      emoji: '📺',  label: 'LED',        desc: 'Полоска-дисплей' },
  { id: 'hologram', emoji: '📡',  label: 'Голограмма', desc: 'Мерцающий символ' },
  { id: 'spiral',   emoji: '🌀',  label: 'Спираль',    desc: 'Вращается' },
  { id: 'lens',     emoji: '🔭',  label: 'Объектив',   desc: 'Концентрические' },
  { id: 'crystal',  emoji: '💎',  label: 'Кристалл',   desc: 'Ромб с блеском' },
  { id: 'bubble',   emoji: '🫧',  label: 'Пузыри',     desc: 'Перекрывающиеся' },
  { id: 'star',     emoji: '⭐',  label: 'Звезда',     desc: 'Вращается' },
  { id: 'slit',     emoji: '🐍',  label: 'Щель',       desc: 'Рептилия' },
  { id: 'cross',    emoji: '🎯',  label: 'Прицел',     desc: 'Перекрестие' },
  { id: 'pixel',    emoji: '🕹',  label: 'Пиксель',    desc: '8-bit арт' },
  { id: 'closed',   emoji: '😊',  label: 'Дуги',       desc: 'Закрытые глаза' },
  { id: 'wink',     emoji: '😉',  label: 'Подмигивание', desc: 'Один закрыт' },
];

export function EyesPanel() {
  const { eyeStyleOverride, eyeColorOverride, equippedSkinId, setEyeStyleOverride, setEyeColorOverride } = usePetStore();
  const skin = getSkin(equippedSkinId);

  const activeStyle = (eyeStyleOverride as EyeStyle | null) ?? skin.eyeStyle;
  const activeColor = eyeColorOverride ?? skin.eyeColor;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionLabel>👁 Стиль глаз</SectionLabel>
        {(eyeStyleOverride || eyeColorOverride) && (
          <button
            onClick={() => { setEyeStyleOverride(null); setEyeColorOverride(null); }}
            className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded-lg transition-colors"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            ↩ Сброс
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {EYE_STYLES.map(style => {
          const isActive = activeStyle === style.id;
          return (
            <motion.button
              key={style.id}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setEyeStyleOverride(style.id)}
              className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-all relative"
              style={isActive ? ACTIVE_GLOW('#818CF8') : GLASS}
            >
              <span className="text-2xl">{style.emoji}</span>
              <span className="text-[9px] font-bold text-lumio-text text-center leading-tight">{style.label}</span>
              <span className="text-[8px] text-lumio-muted text-center leading-tight">{style.desc}</span>
              {isActive && (
                <div className="absolute top-1 right-1 w-3 h-3 bg-indigo-500 rounded-full flex items-center justify-center border border-white">
                  <span className="text-[6px] text-white font-bold">✓</span>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Eye color */}
      <div className="p-4 rounded-2xl space-y-3" style={GLASS}>
        <p className="text-xs font-semibold text-lumio-muted">🎨 Цвет глаз</p>
        <div className="flex items-center gap-3">
          <label className="relative cursor-pointer group shrink-0">
            <div
              className="w-12 h-12 rounded-xl border-2 border-slate-200 shadow-lg transition-transform group-hover:scale-110"
              style={{ background: activeColor, boxShadow: `0 0 16px ${activeColor}88` }}
            />
            <input
              type="color"
              value={activeColor}
              onChange={e => setEyeColorOverride(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>
          <div className="flex-1">
            <p className="text-xs font-bold text-lumio-text mb-1">Выбери цвет</p>
            <p className="text-[9px] font-mono text-lumio-muted mb-2">{activeColor}</p>
            {/* Quick palette */}
            <div className="flex gap-1.5 flex-wrap">
              {['#00D4FF','#FF3366','#39FF14','#FFB800','#D946EF','#FFFFFF','#FF6600','#00FF99','#818CF8'].map(c => (
                <button
                  key={c}
                  onClick={() => setEyeColorOverride(c)}
                  className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-125"
                  style={{ background: c, borderColor: activeColor === c ? 'white' : 'transparent', boxShadow: `0 0 6px ${c}99` }}
                />
              ))}
            </div>
          </div>
        </div>
        {eyeColorOverride && (
          <button
            onClick={() => setEyeColorOverride(null)}
            className="w-full py-1.5 rounded-xl text-xs font-bold text-lumio-muted hover:bg-slate-200 transition-all"
            style={{ background: '#F3F4F6' }}>
            Использовать цвет скина
          </button>
        )}
      </div>
    </div>
  );
}
