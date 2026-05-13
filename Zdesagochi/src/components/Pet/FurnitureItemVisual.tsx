import { motion, useAnimation, type AnimationDefinition } from 'framer-motion';
import { useEffect } from 'react';
import { getFurniture } from '../../data/roomFurniture';
import type { PlacedFurnitureItem } from '../../store/petStore';
import type React from 'react';
import { useImageUrl } from '../../utils/imageStore';
import { useDarkness } from './RoomScene';
import type { FurnitureInteractionType } from './usePetBehaviorState';

interface Props {
  placed: PlacedFurnitureItem;
  isSelected?: boolean;
  dragOffset?: { x: number; y: number };
  isDragging?: boolean;
  interactive?: boolean;
  interactionMode?: FurnitureInteractionType | null;
  onClick?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
}

// Per-interaction animation sequences for the inner wrapper
const INTERACTION_ANIMS: Partial<Record<FurnitureInteractionType, AnimationDefinition>> = {
  push_cactus:   { rotate: [0, -18, 10, -22, 6, -10, 4, 0],  transition: { duration: 2.6, times: [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1] } } as AnimationDefinition,
  sit_furniture: { scaleY: [1, 0.84, 1.06, 0.94, 1.02, 1],   scaleX: [1, 1.1, 0.95, 1.04, 0.98, 1], transition: { duration: 0.6, times: [0, 0.2, 0.45, 0.65, 0.85, 1] } } as AnimationDefinition,
  bounce_bed:    { scaleY: [1, 0.86, 1.1, 0.92, 1.04, 1],    scaleX: [1, 1.08, 0.94, 1.04, 0.98, 1], transition: { duration: 0.55, repeat: 4, repeatDelay: 0.2 } } as AnimationDefinition,
  watch_screen:  { scale: [1, 1.03, 1], transition: { duration: 2, repeat: Infinity } } as AnimationDefinition,
  play_console:  { scale: [1, 1.05, 0.97, 1.04, 1], transition: { duration: 0.4, repeat: Infinity } } as AnimationDefinition,
  stare_special: { scale: [1, 1.12, 1.04, 1.12, 1], transition: { duration: 1.8, repeat: Infinity } } as AnimationDefinition,
  dance_music:   { rotate: [-3, 3, -3], scale: [1, 1.05, 1], transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } } as AnimationDefinition,
  hug_trophy:    { scale: [1, 1.06, 1.02, 1.06, 1], transition: { duration: 1.2, repeat: Infinity } } as AnimationDefinition,
  stare_flame:   { scale: [1, 1.04, 0.97, 1.04, 1], transition: { duration: 1, repeat: Infinity } } as AnimationDefinition,
  smell_plant:   { rotate: [-2, 2, -2, 0], transition: { duration: 1.2, repeat: 3 } } as AnimationDefinition,
};

export function FurnitureItemVisual({
  placed,
  isSelected = false,
  dragOffset = { x: 0, y: 0 },
  isDragging = false,
  interactive = false,
  interactionMode = null,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  const paintingImage = useImageUrl(placed.imageUrl);
  const ambientDarkness = useDarkness();
  const innerControls = useAnimation();

  const def = getFurniture(placed.itemId);

  // Trigger interaction animation when interactionMode changes
  useEffect(() => {
    if (!interactionMode) {
      innerControls.stop();
      innerControls.set({ rotate: 0, scale: 1, scaleX: 1, scaleY: 1 });
      return;
    }
    const anim = INTERACTION_ANIMS[interactionMode];
    if (anim) {
      innerControls.start(anim);
    }
  }, [interactionMode, innerControls]);

  if (!def) return null;

  const rotation = placed.rotation ?? 0;
  const tiltX    = placed.tiltX ?? 0;
  const tiltY    = placed.tiltY ?? 0;
  const hue      = placed.hue ?? 0;
  const isOn     = placed.isOn ?? true;
  const isLamp   = def.category === 'lamp';
  const isCandle = placed.itemId === 'candle';
  const isTorch  = placed.itemId === 'torch';

  const emojiFilter = [
    hue ? `hue-rotate(${hue}deg)` : null,
    isLamp && !isOn ? 'grayscale(0.7) brightness(0.4)' : null,
    // glow enhancement when being stared at
    interactionMode === 'stare_special' || interactionMode === 'stare_flame'
      ? 'brightness(1.4) saturate(1.3)'
      : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${placed.x}%`,
        top: `${placed.y}%`,
        transform: [
          `translate(calc(-50% + ${dragOffset.x}px), calc(-50% + ${dragOffset.y}px))`,
          `rotate(${rotation}deg)`,
          `scaleX(${placed.flipped ? -1 : 1})`,
          `perspective(400px)`,
          `rotateX(${tiltX}deg)`,
          `rotateY(${tiltY}deg)`,
        ].join(' '),
        fontSize: `${placed.scale * 2.5}rem`,
        zIndex: placed.zIndex + (isDragging ? 50 : 0),
        filter: [
          ambientDarkness > 0 ? `brightness(${Math.max(0.05, 1 - ambientDarkness * 0.88).toFixed(2)})` : null,
          isSelected
            ? 'drop-shadow(0 0 10px rgba(124,58,237,0.9))'
            : 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
        ].filter(Boolean).join(' '),
        cursor: interactive
          ? placed.locked ? 'default' : isDragging ? 'grabbing' : 'grab'
          : onClick ? 'pointer' : undefined,
        userSelect: interactive ? 'none' : undefined,
        touchAction: interactive ? 'none' : undefined,
        pointerEvents: (interactive || onClick) ? 'auto' : 'none',
        transition: isDragging ? 'none' : 'filter 0.15s',
      }}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Inner motion wrapper — driven by interaction animation */}
      <motion.div animate={innerControls} style={{ display: 'inline-block', transformOrigin: 'bottom center' }}>

        {/* Lamp ambient glow */}
        {isLamp && isOn && !isTorch && (
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: '3.2em', height: '3.2em',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: isCandle
              ? 'radial-gradient(circle, rgba(255,160,40,0.55) 0%, rgba(255,100,0,0.15) 50%, transparent 70%)'
              : 'radial-gradient(circle, rgba(255,220,120,0.45) 0%, transparent 70%)',
            filter: 'blur(0.4em)',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        )}

        {/* Torch light beam */}
        {isTorch && isOn && (
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: '3em', height: '1.1em',
            transformOrigin: '0% 50%',
            transform: 'translateY(-50%) rotate(35deg)',
            background: 'linear-gradient(to right, rgba(255,235,150,0.65) 0%, rgba(255,235,150,0.1) 70%, transparent 100%)',
            clipPath: 'polygon(0% 10%, 100% 0%, 100% 100%, 0% 90%)',
            filter: 'blur(0.1em)',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        )}
        {isTorch && isOn && (
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: '1.2em', height: '1.2em',
            transform: 'translate(-20%, -50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,240,160,0.5) 0%, transparent 70%)',
            filter: 'blur(0.2em)',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        )}

        {/* Painting with custom photo */}
        {placed.itemId === 'painting' && paintingImage ? (
          <div style={{
            display: 'inline-block', position: 'relative', zIndex: 1,
            width: '2.2em', height: '1.8em',
            border: '0.12em solid #C9A227',
            borderRadius: '0.06em',
            outline: '0.06em solid #7B5200',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 0 0.04em rgba(255,220,100,0.4), 0 0.08em 0.3em rgba(0,0,0,0.6)',
            filter: emojiFilter,
          }}>
            <img
              src={paintingImage}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : (
          <motion.span
            style={{ display: 'inline-block', position: 'relative', zIndex: 1, filter: emojiFilter }}
            animate={isCandle && isOn ? {
              rotate: [-1.5, 1.2, -0.8, 1.5, -1.2, 0.6, -1.5],
              scaleX: [1, 0.96, 1.03, 0.97, 1.02, 0.98, 1],
              scaleY: [1, 1.03, 0.97, 1.04, 0.96, 1.02, 1],
            } : {}}
            transition={isCandle && isOn ? {
              duration: 1.6,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, 0.15, 0.3, 0.5, 0.65, 0.8, 1],
            } : {}}
          >
            {def.emoji}
          </motion.span>
        )}

        {placed.locked && interactive && (
          <span style={{
            position: 'absolute', top: '-0.15em', right: '-0.25em',
            fontSize: '0.35em', lineHeight: 1, pointerEvents: 'none',
            zIndex: 2,
          }}>🔒</span>
        )}

      </motion.div>
    </div>
  );
}
