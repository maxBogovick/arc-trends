import { motion } from 'framer-motion';
import { useState } from 'react';
import { usePetStore } from '../../store/petStore';
import { PetDisplay } from './PetDisplay';
import { PetTalk } from './PetTalk';
import { SceneEffects } from './SceneEffects';
import type { PetMood } from '../../api';
import { getBackground } from '../../data/backgrounds';

export const MOOD_LABELS: Record<PetMood, { text: string; emoji: string; color: string }> = {
  ecstatic: { text: 'В восторге!', emoji: '🤩', color: 'text-yellow-600' },
  happy:    { text: 'Счастливый', emoji: '😊', color: 'text-indigo-600' },
  content:  { text: 'Доволен',    emoji: '🙂', color: 'text-blue-600'   },
  sad:      { text: 'Грустит',    emoji: '😢', color: 'text-blue-500'   },
  tired:    { text: 'Устал',      emoji: '😴', color: 'text-gray-500'   },
  sick:     { text: 'Болеет',     emoji: '🤒', color: 'text-emerald-600' },
  sleeping: { text: 'Спит',       emoji: '💤', color: 'text-purple-500' },
};

const STAGE_INFO: Record<string, { label: string; emoji: string }> = {
  egg:   { label: 'Яйцо',      emoji: '🥚' },
  baby:  { label: 'Малыш',     emoji: '🌱' },
  child: { label: 'Ребёнок',   emoji: '🌿' },
  teen:  { label: 'Подросток', emoji: '🌲' },
  adult: { label: 'Взрослый',  emoji: '🌳' },
  elder: { label: 'Мудрец',    emoji: '🦋' },
};

export function PetScene() {
  const { pet, updatePetName, actionLoading, equippedBgId } = usePetStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  if (!pet) return null;

  const moodInfo  = MOOD_LABELS[pet.mood];
  const stageInfo = STAGE_INFO[pet.stage];
  const bg        = getBackground(equippedBgId ?? 'void_dark');

  const handleNameSubmit = async () => {
    if (nameInput.trim()) await updatePetName(nameInput.trim());
    setEditingName(false);
    setNameInput('');
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* ── Main scene ─────────────────────────────────────────────── */}
      <div
        className="relative w-full rounded-3xl overflow-hidden"
        style={{
          height: 'clamp(340px, 42vw, 460px)',
          maxWidth: '520px',
          background: bg.gradient,
          boxShadow: [
            `0 24px 88px ${bg.accentColor}44`,
            `0 6px 28px rgba(0,0,0,0.7)`,
            `inset 0 1px 0 rgba(255,255,255,0.07)`,
            `inset 0 0 120px ${bg.accentColor}0C`,
          ].join(', '),
        }}
      >
        {/* Background animated effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <SceneEffects effects={bg.effects} />
        </div>

        {/* Ambient light from pet — soft radial matching accent */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '8%', left: '50%',
            transform: 'translate(-50%, 0)',
            width: '78%', height: '62%',
            background: `radial-gradient(ellipse at 50% 48%, ${bg.accentColor}1E 0%, transparent 68%)`,
            zIndex: 1,
          }}
        />

        {/* Wall depth: left/right vignette + ceiling darkening */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'linear-gradient(to right,  rgba(0,0,0,0.44) 0%, transparent 22%)',
              'linear-gradient(to left,   rgba(0,0,0,0.44) 0%, transparent 22%)',
              'linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, transparent 30%)',
            ].join(', '),
            zIndex: 2,
          }}
        />

        {/* Decorations (from background data) */}
        {(bg.decorations ?? []).map((d, i) => (
          <motion.div
            key={i}
            className="absolute select-none pointer-events-none"
            style={{ left: `${d.x}%`, top: `${d.y}%`, fontSize: d.size, zIndex: 3 }}
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3 + i * 0.7, repeat: Infinity, delay: i * 0.5 }}
          >
            {d.emoji}
          </motion.div>
        ))}

        {/* Floor with perspective grid */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{ height: '28%', zIndex: 4 }}
        >
          <div className="absolute inset-0" style={{ background: bg.floorGradient }} />
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }}
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
          >
            {/* Radiating perspective lines from vanishing point */}
            {[-85, -60, -38, -18, 0, 18, 38, 60, 85].map((offset, i) => (
              <line key={`v${i}`} x1={50} y1={0} x2={50 + offset} y2={28}
                stroke={bg.accentColor} strokeWidth={0.45} />
            ))}
            {/* Horizontal parallels */}
            {[5, 11, 17, 24].map((y, i) => (
              <line key={`h${i}`} x1={0} y1={y} x2={100} y2={y}
                stroke={bg.accentColor} strokeWidth={0.35} opacity={0.8 - i * 0.14} />
            ))}
          </svg>
        </div>

        {/* Pet glow shadow on floor */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '22%', left: '50%',
            transform: 'translateX(-50%)',
            width: '46%', height: '5%',
            background: `radial-gradient(ellipse, ${bg.accentColor}88 0%, transparent 70%)`,
            filter: 'blur(12px)',
            zIndex: 5,
          }}
        />

        {/* Mood badge */}
        <motion.div
          key={pet.mood}
          className={`absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${moodInfo.color}`}
          style={{
            background: 'rgba(255,255,255,0.88)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {moodInfo.emoji} {moodInfo.text}
        </motion.div>

        {/* Pet + speech bubble — shifted slightly up so feet rest on floor */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ paddingBottom: '8%', zIndex: 6 }}
        >
          <div className="relative pointer-events-auto">
            <PetTalk pet={pet} />
            <PetDisplay pet={pet} size={270} />
          </div>
        </div>
      </div>

      {/* ── Pet info ──────────────────────────────────────────────── */}
      <div className="text-center space-y-2 w-full" style={{ maxWidth: '520px' }}>
        {editingName ? (
          <div className="flex items-center justify-center gap-2">
            <input
              autoFocus value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') setEditingName(false);
              }}
              placeholder={pet.name} maxLength={20}
              className="px-3 py-1 rounded-xl border border-indigo-300 text-center font-display font-semibold text-lg text-lumio-text outline-none focus:ring-2 focus:ring-indigo-400 w-36"
            />
            <button
              onClick={handleNameSubmit} disabled={!!actionLoading}
              className="px-3 py-1 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors"
            >✓</button>
            <button
              onClick={() => setEditingName(false)}
              className="px-3 py-1 bg-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-300 transition-colors"
            >✕</button>
          </div>
        ) : (
          <button
            onClick={() => { setEditingName(true); setNameInput(pet.name); }}
            className="group flex items-center gap-1.5 mx-auto"
          >
            <h2 className="font-display font-bold text-2xl text-lumio-text">{pet.name}</h2>
            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm">✏️</span>
          </button>
        )}

        <div className="flex items-center justify-center gap-2 text-xs flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">{stageInfo.emoji} {stageInfo.label}</span>
          <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-bold">⭐ Ур.{pet.level}</span>
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">🕐 {Math.floor(pet.ageHours)}ч</span>
        </div>

        {/* XP bar */}
        <div className="w-full max-w-xs mx-auto">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>XP</span>
            <span>{pet.xp} / {pet.xpToNext}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(pet.xp / pet.xpToNext) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
