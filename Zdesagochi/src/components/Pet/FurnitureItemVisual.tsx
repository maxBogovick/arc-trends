import { motion } from 'framer-motion';
import { getFurniture } from '../../data/roomFurniture';
import { usePetStore, type PlacedFurnitureItem } from '../../store/petStore';
import type React from 'react';
import { useImageUrl } from '../../utils/imageStore';

interface Props {
  placed: PlacedFurnitureItem;
  isSelected?: boolean;
  dragOffset?: { x: number; y: number };
  isDragging?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
}

export function FurnitureItemVisual({
  placed,
  isSelected = false,
  dragOffset = { x: 0, y: 0 },
  isDragging = false,
  interactive = false,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  // Must be called before any early return (Rules of Hooks)
  const paintingImage = useImageUrl(placed.imageUrl);
  const ambientDarkness = usePetStore(s => s.roomCustomization.ambientDarkness);

  const def = getFurniture(placed.itemId);
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
        /* Candle flickers; everything else is static */
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
    </div>
  );
}
