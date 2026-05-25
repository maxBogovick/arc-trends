import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePetStore } from '../../store/petStore';
import type { Pet } from '../../api';
import { useDarkness } from './RoomScene';
import { PetDisplay } from './PetDisplay';
import { PetTalk } from './PetTalk';
import { RoomScene } from './RoomScene';
import type { PetMood } from '../../api';
import { FurnitureItemVisual } from './FurnitureItemVisual';
import { getFurniture } from '../../data/roomFurniture';
import { usePetBehaviorState, type BehaviorMode, type SceneInteraction } from './usePetBehaviorState';
import { getPetArchetype } from './petArchetype';
import { SceneProps } from './SceneProps';
import { BehaviorEffects } from './BehaviorEffects';
import { EvolutionProposalBanner } from '../personality/EvolutionProposalBanner';
import { ShadowCatharsisProgress } from '../personality/ShadowCatharsisProgress';
import { usePerformancePolicy } from '../../performance/usePerformancePolicy';

export const MOOD_LABELS: Record<PetMood, { text: string; emoji: string; color: string }> = {
  ecstatic: { text: 'В восторге!', emoji: '🤩', color: 'text-yellow-600' },
  happy: { text: 'Счастливый', emoji: '😊', color: 'text-indigo-600' },
  content: { text: 'Доволен', emoji: '🙂', color: 'text-blue-600' },
  sad: { text: 'Грустит', emoji: '😢', color: 'text-blue-500' },
  tired: { text: 'Устал', emoji: '😴', color: 'text-gray-500' },
  sick: { text: 'Болеет', emoji: '🤒', color: 'text-emerald-600' },
  sleeping: { text: 'Спит', emoji: '💤', color: 'text-purple-500' },
};

// ── Travel speed by mood ──────────────────────────────────────────────────────
function patrolTransitionDuration(mode: BehaviorMode, mood: PetMood): number {
  if (mode === 'sleeping') return 1.8;
  // Action modes: snap quickly so food/props appear at the same position as the pet
  if (mode === 'eating' || mode === 'playing' || mode === 'cleaning' || mode === 'medicine') return 0.25;
  if (mood === 'ecstatic') return 0.9;
  if (mood === 'tired' || mood === 'sad') return 2.4;
  return 1.5;
}

// ── PetBody — rendered inside RoomScene to access DarknessContext ─────────────
interface PetBodyProps {
  pet: Pet;
  mode: BehaviorMode;
  petX: number;
  petY?: number;
  facingRight: boolean;
  sceneInteraction: SceneInteraction | null;
  moodTransitionDuration: number;
  motionEnabled: boolean;
  mouseInRoom?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}

function PetBody({ pet, mode, petX, petY = 0, facingRight, sceneInteraction, moodTransitionDuration, motionEnabled, mouseInRoom = false, onPointerDown }: PetBodyProps) {
  const effectiveDarkness = useDarkness();
  const brightness = Math.max(0.05, 1 - effectiveDarkness * 0.88);
  const isSleeping = mode === 'sleeping' || pet.isAsleep;
  const isCarried = mode === 'carried' || mode === 'being_grabbed';
  const isLanding = mode === 'landing';

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ bottom: '13%', zIndex: 25 }}
      animate={{ left: `${petX}%`, y: petY }}
      transition={{
        left: { duration: moodTransitionDuration, ease: 'easeInOut' },
        y: { duration: isLanding ? 0.32 : moodTransitionDuration, ease: isLanding ? [0.4, 0, 0.8, 1] : 'easeOut' },
      }}
    >
      {/* translateX(-50%) centres the pet on its position point */}
      <div
        className="relative pointer-events-auto"
        style={{
          transform: 'translateX(-50%)',
          cursor: isSleeping ? 'default' : 'grab',
          filter: brightness < 1 ? `brightness(${brightness.toFixed(2)})` : undefined,
        }}
        onPointerDown={onPointerDown}
      >
        {/* Shadow on floor — pulses inversely with float, fades when carried */}
        <motion.div
          className="absolute pointer-events-none"
          style={{
            bottom: 4,
            left: '50%', translateX: '-50%',
            width: isSleeping ? 88 : 100,
            height: 12,
            background: 'rgba(0,0,0,0.22)',
            borderRadius: '50%',
            filter: 'blur(6px)',
            zIndex: -1,
          }}
          animate={{
            scaleX: isCarried ? 0.3 : isSleeping || !motionEnabled ? 1 : [1, 0.65, 1],
            opacity: isCarried ? 0.05 : isSleeping || !motionEnabled ? 0.26 : [0.45, 0.15, 0.45],
          }}
          transition={{ duration: isCarried ? 0.3 : 3, repeat: isCarried || !motionEnabled ? 0 : Infinity, ease: 'easeInOut' }}
        />
        <PetTalk pet={pet} mode={mode} />
        {motionEnabled && (
          <BehaviorEffects pet={pet} mode={mode} sceneInteraction={sceneInteraction} facingRight={facingRight} />
        )}
        <PetDisplay
          pet={pet}
          size={270}
          behaviorMode={mode}
          sceneInteractionType={sceneInteraction?.type}
          facingRight={facingRight}
          mouseInRoom={mouseInRoom}
        />
      </div>
    </motion.div>
  );
}

// ── PetScene ──────────────────────────────────────────────────────────────────
export function PetScene({ actionPanel }: { actionPanel?: ReactNode }) {
  const performancePolicy = usePerformancePolicy();
  const {
    pet,
    actionLoading,
    placedFurniture,
    updateRoomFurniture,
    equippedTailId,
    equippedLegsId,
    equippedArmsId,
    equippedOutfitId,
  } = usePetStore();

  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  // Determine pet archetype for eating props
  const archetype = getPetArchetype({
    equippedTailId: equippedTailId ?? 'none',
    equippedLegsId: equippedLegsId ?? 'none',
    equippedArmsId: equippedArmsId ?? 'none',
    equippedOutfitId: equippedOutfitId ?? 'none',
  });

  // ── Mouse-in-room tracking ────────────────────────────────────────────────────
  const [mouseInRoom, setMouseInRoom] = useState(false);
  const [mousePosX, setMousePosX] = useState<number>(50);

  // Behavior state machine — paused when mouse is in room
  const behaviorState = usePetBehaviorState(
    pet ?? null,
    actionLoading,
    placedFurniture,
    mouseInRoom || !performancePolicy.patrolEnabled,
  );

  // ── Drag state ────────────────────────────────────────────────────────────────
  const sceneRef = useRef<HTMLDivElement>(null);
  type DragPhase = 'being_grabbed' | 'carried' | 'landing';
  const [dragState, setDragState] = useState<{ x: number; y: number; phase: DragPhase } | null>(null);
  const dragRef = useRef<{ x: number; y: number; phase: DragPhase } | null>(null);
  const dragStartClientY = useRef<number>(0);

  const handlePetPointerDown = useCallback((e: React.PointerEvent) => {
    if (pet?.isAsleep || actionLoading) return;
    e.stopPropagation();
    e.preventDefault();

    const startX = behaviorState.petX;
    dragStartClientY.current = e.clientY;
    dragRef.current = { x: startX, y: 0, phase: 'being_grabbed' };
    setDragState({ x: startX, y: 0, phase: 'being_grabbed' });

    const grabTimer = setTimeout(() => {
      if (dragRef.current) {
        dragRef.current.phase = 'carried';
        setDragState(d => d ? { ...d, phase: 'carried' } : null);
      }
    }, 220);

    const onMove = (ev: PointerEvent) => {
      const scene = sceneRef.current;
      if (!scene || !dragRef.current || dragRef.current.phase === 'landing') return;
      const rect = scene.getBoundingClientRect();
      const newX = Math.max(8, Math.min(92, ((ev.clientX - rect.left) / rect.width) * 100));
      // y: negative = up, positive = down; clamp so pet can't go offscreen
      const newY = Math.max(-rect.height * 0.78, Math.min(40, ev.clientY - dragStartClientY.current));
      dragRef.current.x = newX;
      dragRef.current.y = newY;
      dragRef.current.phase = 'carried';
      setDragState({ x: newX, y: newY, phase: 'carried' });
    };

    const onUp = () => {
      clearTimeout(grabTimer);
      const finalX = dragRef.current?.x ?? startX;
      dragRef.current = { x: finalX, y: 0, phase: 'landing' };
      setDragState({ x: finalX, y: 0, phase: 'landing' });
      setTimeout(() => {
        behaviorState.warpTo(finalX);
        dragRef.current = null;
        setDragState(null);
      }, 700);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet?.isAsleep, actionLoading, behaviorState.petX, behaviorState.warpTo]);

  // ── Scene pointer tracking ────────────────────────────────────────────────────
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const onEnter = () => setMouseInRoom(true);
    const onLeave = () => setMouseInRoom(false);
    const onMove = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      setMousePosX(((ev.clientX - rect.left) / rect.width) * 100);
    };
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointermove', onMove);
    };
  }, []);

  // Effective display values: drag overrides behavior state
  const displayX = dragState ? dragState.x : behaviorState.petX;
  const displayY = dragState ? dragState.y : 0;
  const displayMode = dragState ? dragState.phase : behaviorState.mode;
  const isSleeping = behaviorState.mode === 'sleeping' || !!pet?.isAsleep;
  const isActionMode = behaviorState.mode === 'eating'
    || behaviorState.mode === 'playing'
    || behaviorState.mode === 'cleaning'
    || behaviorState.mode === 'medicine';
  // When mouse is in room, pet turns to face the cursor (disabled while sleeping)
  const mouseFacing = mouseInRoom && !dragState && !isSleeping && !isActionMode ? mousePosX > displayX : null;
  const displayFacing = mouseFacing !== null ? mouseFacing : dragState ? dragState.x >= 50 : behaviorState.facingRight;
  const displayInteraction = dragState ? null : behaviorState.sceneInteraction;

  const selectedPlaced = placedFurniture.find(p => p.uid === selectedUid) ?? null;
  const selectedDef = selectedPlaced ? getFurniture(selectedPlaced.itemId) : null;

  if (!pet) return null;

  const moodInfo = MOOD_LABELS[pet.mood];

  const isDragging = dragState !== null;
  const travelDuration = isDragging ? 0.06 : patrolTransitionDuration(behaviorState.mode, pet.mood);

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* ── Main scene ─────────────────────────────────────────────── */}
      <RoomScene
        height="clamp(340px, 42vw, 460px)"
        maxWidth="520px"
        sceneRef={sceneRef}
        onSceneClick={() => setSelectedUid(null)}
      >
        <div
          className="absolute top-3 right-3 z-40 flex items-center gap-1 rounded-2xl border border-white/45 bg-white/80 p-1 shadow-sm"
          onClick={e => e.stopPropagation()}
        >
          {(['auto', 'high', 'low', 'min'] as const).map(q => (
            <button
              key={q}
              type="button"
              title={
                q === 'auto'
                  ? 'Авто качество'
                  : q === 'high'
                    ? 'Высокое качество'
                    : q === 'low'
                      ? 'Экономный режим'
                      : 'Минимум: отключить все эффекты'
              }
              onClick={() => performancePolicy.setQuality(q)}
              className="h-7 min-w-8 rounded-xl px-2 text-[11px] font-bold transition-colors"
              style={{
                background: performancePolicy.requestedQuality === q ? '#7C3AED' : 'transparent',
                color: performancePolicy.requestedQuality === q ? 'white' : '#6B7280',
              }}
            >
              {q === 'auto' ? 'Авто' : q === 'high' ? 'HD' : q === 'low' ? 'Eco' : 'Мин'}
            </button>
          ))}
        </div>

        {/* Placed furniture items */}
        {placedFurniture.map(placed => {
          const def = getFurniture(placed.itemId);
          const hasEffects = def?.category === 'lamp';

          // Pass interaction mode when this item is being interacted with
          const isInteracting = behaviorState.sceneInteraction?.furnitureUid === placed.uid;
          const interactionMode = isInteracting ? behaviorState.sceneInteraction!.type : null;

          return (
            <FurnitureItemVisual
              key={placed.uid}
              placed={placed}
              isSelected={placed.uid === selectedUid}
              interactionMode={interactionMode}
              onClick={hasEffects ? () => setSelectedUid(uid => uid === placed.uid ? null : placed.uid) : undefined}
            />
          );
        })}

        {/* Ephemeral action props (food bowl / table / toy ball / bubbles) */}
        {!performancePolicy.allEffectsDisabled && (
          <SceneProps
            activeAction={behaviorState.activeAction}
            mode={behaviorState.mode}
            archetype={archetype}
            petX={displayX}
            facingRight={displayFacing}
            transitionDuration={travelDuration}
            petSize={270}
          />
        )}

        {/* Effects popup for lamp items */}
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

        {/* Pet — freely positioned, driven by behavior state (or drag override) */}
        <PetBody
          pet={pet}
          mode={displayMode}
          petX={displayX}
          petY={displayY}
          facingRight={displayFacing}
          sceneInteraction={displayInteraction}
          moodTransitionDuration={travelDuration}
          motionEnabled={performancePolicy.motionEnabled}
          mouseInRoom={mouseInRoom}
          onPointerDown={handlePetPointerDown}
        />

      </RoomScene>

      {/* ── Evolution / Shadow panels ─────────────────────────────── */}
      <div className="w-full space-y-2" style={{ maxWidth: '520px' }}>
        <ShadowCatharsisProgress showBurst={false} />
        <EvolutionProposalBanner />
        {actionPanel}
      </div>
    </div>
  );
}
