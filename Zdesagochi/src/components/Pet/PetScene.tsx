import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { usePetStore } from '../../store/petStore';
import type { Pet } from '../../api';
import { useDarkness } from './RoomScene';
import { PetDisplay } from './PetDisplay';
import { PetTalk } from './PetTalk';
import { RoomScene } from './RoomScene';
import type { PetMood } from '../../api';
import { FurnitureItemVisual } from './FurnitureItemVisual';
import { getFurniture } from '../../data/roomFurniture';

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

// Rendered inside RoomScene children so it has access to DarknessContext
function PetBody({ pet }: { pet: Pet }) {
  const effectiveDarkness = useDarkness();
  const brightness = Math.max(0.05, 1 - effectiveDarkness * 0.88);
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ paddingBottom: '8%', zIndex: 25 }}
    >
      <div
        className="relative pointer-events-auto"
        style={{ filter: brightness < 1 ? `brightness(${brightness.toFixed(2)})` : undefined }}
      >
        <PetTalk pet={pet} />
        <PetDisplay pet={pet} size={270} />
      </div>
    </div>
  );
}

export function PetScene() {
  const { pet, updatePetName, actionLoading, placedFurniture, updateRoomFurniture } = usePetStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const selectedPlaced = placedFurniture.find(p => p.uid === selectedUid) ?? null;
  const selectedDef    = selectedPlaced ? getFurniture(selectedPlaced.itemId) : null;

  if (!pet) return null;

  const moodInfo  = MOOD_LABELS[pet.mood];
  const stageInfo = STAGE_INFO[pet.stage];

  const handleNameSubmit = async () => {
    if (nameInput.trim()) await updatePetName(nameInput.trim());
    setEditingName(false);
    setNameInput('');
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* ── Main scene ─────────────────────────────────────────────── */}
      <RoomScene
        height="clamp(340px, 42vw, 460px)"
        maxWidth="520px"
        onSceneClick={() => setSelectedUid(null)}
      >

        {/* Placed furniture items — lamp items are clickable */}
        {placedFurniture.map(placed => {
          const def = getFurniture(placed.itemId);
          const hasEffects = def?.category === 'lamp';
          return (
            <FurnitureItemVisual
              key={placed.uid}
              placed={placed}
              isSelected={placed.uid === selectedUid}
              onClick={hasEffects ? () => setSelectedUid(uid => uid === placed.uid ? null : placed.uid) : undefined}
            />
          );
        })}

        {/* Effects popup */}
        <AnimatePresence>
          {selectedPlaced && selectedDef && (
            <motion.div
              key={selectedPlaced.uid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3 py-2 rounded-2xl"
              style={{
                zIndex: 50,
                background: 'rgba(15,10,30,0.88)',
                border: '1px solid rgba(124,58,237,0.35)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
              }}
              onClick={e => e.stopPropagation()}
            >
              <span className="text-xl leading-none">{selectedDef.emoji}</span>
              <span className="text-xs font-bold text-white">{selectedDef.name}</span>

              {/* Light toggle for lamps */}
              {selectedDef.category === 'lamp' && (
                <button
                  onClick={() => updateRoomFurniture(selectedPlaced.uid, { isOn: !(selectedPlaced.isOn ?? true) })}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: (selectedPlaced.isOn ?? true) ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.08)',
                    color: (selectedPlaced.isOn ?? true) ? '#FCD34D' : 'rgba(255,255,255,0.4)',
                    border: (selectedPlaced.isOn ?? true) ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {(selectedPlaced.isOn ?? true) ? '💡 Вкл' : '🌑 Выкл'}
                </button>
              )}

              <button
                onClick={() => setSelectedUid(null)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-[11px]"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
              >✕</button>
            </motion.div>
          )}
        </AnimatePresence>

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

        {/* Pet + speech bubble — brightness driven by DarknessContext (set by RoomScene) */}
        <PetBody pet={pet} />

      </RoomScene>

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
