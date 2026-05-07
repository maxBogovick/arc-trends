import { motion } from 'framer-motion';
import type { RefObject, ReactNode, MouseEventHandler, CSSProperties } from 'react';
import { usePetStore, type RoomCustomization, type FloorStyle } from '../../store/petStore';
import { getBackground } from '../../data/backgrounds';
import { SceneEffects } from './SceneEffects';

// ── Wall ──────────────────────────────────────────────────────────────────────

function buildWallStyle(c: RoomCustomization): CSSProperties {
  if (c.wallImage) {
    return {
      backgroundImage: `url(${c.wallImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  switch (c.wallStyle) {
    case 'solid':
      return { background: c.wallColor };
    case 'v_gradient':
      return { background: `linear-gradient(180deg, ${c.wallColor2} 0%, ${c.wallColor} 100%)` };
    case 'r_gradient':
      return { background: `radial-gradient(ellipse at 40% 30%, ${c.wallColor2} 0%, ${c.wallColor} 80%)` };
  }
}

// ── Floor textures ────────────────────────────────────────────────────────────

function buildFloorTextureStyle(style: FloorStyle, color: string, accent: string): CSSProperties {
  switch (style) {
    case 'flat':
    case 'grid':
      return {};

    case 'wood':
      return {
        backgroundImage: [
          // plank separators
          `repeating-linear-gradient(180deg,
            rgba(0,0,0,0.32) 0px, rgba(0,0,0,0.32) 1px,
            transparent 1px, transparent 18px)`,
          // grain shimmer
          `repeating-linear-gradient(88deg,
            transparent 0px, transparent 10px,
            rgba(255,255,255,0.025) 10px, rgba(255,255,255,0.025) 11px)`,
        ].join(', '),
      };

    case 'tile':
      return {
        backgroundImage: [
          `repeating-linear-gradient(90deg,
            ${accent}30 0px, ${accent}30 1px,
            transparent 1px, transparent 26px)`,
          `repeating-linear-gradient(0deg,
            ${accent}30 0px, ${accent}30 1px,
            transparent 1px, transparent 26px)`,
        ].join(', '),
      };

    case 'marble': {
      const v = `${color}10`;
      const v2 = `${color}07`;
      return {
        backgroundImage: [
          `repeating-linear-gradient(-42deg,
            transparent 0px, transparent 24px,
            ${v} 24px, ${v} 25px,
            transparent 25px, transparent 58px,
            ${v2} 58px, ${v2} 60px)`,
          `repeating-linear-gradient(22deg,
            transparent 0px, transparent 40px,
            rgba(255,255,255,0.04) 40px, rgba(255,255,255,0.04) 41px)`,
        ].join(', '),
      };
    }

    case 'metal':
      return {
        backgroundImage: [
          // brushed horizontal micro-lines
          `repeating-linear-gradient(0deg,
            rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px,
            transparent 1px, transparent 3px)`,
          // plate grid with accent tint
          `repeating-linear-gradient(90deg,
            ${accent}20 0px, ${accent}20 1px,
            transparent 1px, transparent 30px)`,
          `repeating-linear-gradient(0deg,
            ${accent}18 0px, ${accent}18 1px,
            transparent 1px, transparent 22px)`,
        ].join(', '),
      };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  height?: string;
  maxWidth?: string;
  sceneRef?: RefObject<HTMLDivElement>;
  onSceneClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
  children?: ReactNode;
}

export function RoomScene({
  height = 'clamp(340px, 42vw, 460px)',
  maxWidth = '520px',
  sceneRef,
  onSceneClick,
  className = '',
  children,
}: Props) {
  const { equippedBgId, roomCustomization: c } = usePetStore();
  const bg     = getBackground(equippedBgId ?? 'void_dark');
  const accent = c.accentColor;

  const wallStyle      = buildWallStyle(c);
  const floorTexture   = buildFloorTextureStyle(c.floorStyle, c.floorColor, accent);
  const floorGradient  = `linear-gradient(180deg, transparent, ${c.floorColor}55)`;
  const showPerspGrid  = !c.floorImage && c.floorStyle === 'grid';

  return (
    <div
      ref={sceneRef}
      onClick={onSceneClick}
      className={`relative w-full rounded-3xl overflow-hidden ${className}`}
      style={{
        height,
        maxWidth,
        ...wallStyle,
        boxShadow: [
          `0 24px 88px ${accent}44`,
          `0 6px 28px rgba(0,0,0,0.7)`,
          `inset 0 1px 0 rgba(255,255,255,0.07)`,
          `inset 0 0 120px ${accent}0C`,
        ].join(', '),
      }}
    >
      {/* Theme animated effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <SceneEffects effects={bg.effects} />
      </div>

      {/* Ambient light */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '8%', left: '50%', transform: 'translate(-50%, 0)',
          width: '78%', height: '62%',
          background: `radial-gradient(ellipse at 50% 48%, ${accent}1E 0%, transparent 68%)`,
          zIndex: 1,
        }}
      />

      {/* Wall vignette */}
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

      {/* Theme decorations */}
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

      {/* ── Floor ── */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: '28%', zIndex: 4 }}
      >
        {/* Base depth gradient */}
        <div className="absolute inset-0" style={{ background: floorGradient }} />

        {/* CSS texture pattern */}
        {!c.floorImage && (
          <div className="absolute inset-0" style={floorTexture} />
        )}

        {/* Perspective grid (grid style only) */}
        {showPerspGrid && (
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }}
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
          >
            {[-85, -60, -38, -18, 0, 18, 38, 60, 85].map((offset, i) => (
              <line key={`v${i}`} x1={50} y1={0} x2={50 + offset} y2={28}
                stroke={accent} strokeWidth={0.45} />
            ))}
            {[5, 11, 17, 24].map((y, i) => (
              <line key={`h${i}`} x1={0} y1={y} x2={100} y2={y}
                stroke={accent} strokeWidth={0.35} opacity={0.8 - i * 0.14} />
            ))}
          </svg>
        )}

        {/* User floor image — perspective receding into distance */}
        {c.floorImage && (
          <div className="absolute inset-0" style={{ overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: '-15%',
                right: '-15%',
                height: '210%',
                backgroundImage: `url(${c.floorImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 30%',
                transform: 'perspective(220px) rotateX(44deg)',
                transformOrigin: 'bottom center',
              }}
            />
          </div>
        )}

        {/* Floor edge darkening for depth */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, transparent 35%)' }}
        />
      </div>

      {/* Pet shadow on floor */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '22%', left: '50%', transform: 'translateX(-50%)',
          width: '46%', height: '5%',
          background: `radial-gradient(ellipse, ${accent}88 0%, transparent 70%)`,
          filter: 'blur(12px)',
          zIndex: 5,
        }}
      />

      {children}
    </div>
  );
}
