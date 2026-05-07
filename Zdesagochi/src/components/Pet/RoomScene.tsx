import { motion } from 'framer-motion';
import type { RefObject, ReactNode, MouseEventHandler, CSSProperties } from 'react';
import { usePetStore, type RoomCustomization, type FloorStyle } from '../../store/petStore';
import { getBackground } from '../../data/backgrounds';
import { SceneEffects } from './SceneEffects';

// ── Wall sections ─────────────────────────────────────────────────────────────

function buildBackWallStyle(c: RoomCustomization): CSSProperties {
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

function buildSideWallStyle(c: RoomCustomization): CSSProperties {
  if (c.sideWallImage) {
    return {
      backgroundImage: `url(${c.sideWallImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  switch (c.sideWallStyle) {
    case 'solid':
      return { background: c.sideWallColor };
    case 'v_gradient':
      return { background: `linear-gradient(180deg, ${c.sideWallColor2} 0%, ${c.sideWallColor} 100%)` };
  }
}

function WallSections({ c }: { c: RoomCustomization }) {
  const backStyle = buildBackWallStyle(c);
  const sideStyle = buildSideWallStyle(c);

  // Clip-path trapezoids with correct perspective direction:
  //   Inner top corner (junction with back wall) = 0%  — further from viewer → higher
  //   Outer top corner (scene edge)              = 15% — closer to viewer  → lower
  //
  // Floor triangles extend the side walls downward, diagonal aligned with
  // the floor perspective grid (inner-back → outer-front).

  return (
    <>
      {/* Back wall — full-width base (fills corner triangles above side wall slants) */}
      <div
        className="absolute pointer-events-none"
        style={{ top: 0, bottom: '28%', left: 0, right: 0, zIndex: 0, ...backStyle }}
      />

      {/* Left side wall — trapezoid: inner top at 0%, outer top at 15% of div height */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0, bottom: '28%', left: 0, width: '15%',
          zIndex: 1,
          clipPath: 'polygon(0% 15%, 100% 0%, 100% 100%, 0% 100%)',
          ...sideStyle,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 100%)' }} />
      </div>

      {/* Right side wall — mirror */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0, bottom: '28%', right: 0, width: '15%',
          zIndex: 1,
          clipPath: 'polygon(0% 0%, 100% 15%, 100% 100%, 0% 100%)',
          ...sideStyle,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 100%)' }} />
      </div>

      {/* Left floor triangle — diagonal from inner-back (15%,72%) to outer-front (0%,100%) */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 0, left: 0, width: '15%', height: '28%', zIndex: 5,
          clipPath: 'polygon(0% 0%, 100% 0%, 0% 100%)',
          ...sideStyle,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 100%)' }} />
      </div>

      {/* Right floor triangle */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 0, right: 0, width: '15%', height: '28%', zIndex: 5,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%)',
          ...sideStyle,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 100%)' }} />
      </div>
    </>
  );
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
          `repeating-linear-gradient(180deg,
            rgba(0,0,0,0.32) 0px, rgba(0,0,0,0.32) 1px,
            transparent 1px, transparent 18px)`,
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
      const v  = `${color}10`;
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
          `repeating-linear-gradient(0deg,
            rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px,
            transparent 1px, transparent 3px)`,
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

// ── Architectural overlays ────────────────────────────────────────────────────

function ArchitecturalLayers({ c }: { c: RoomCustomization }) {
  const accent = c.accentColor;

  return (
    <>
      {/* ── Corner simulation (side walls) ── */}
      {c.showCorners && (
        <>
          {/* Left corner shadow band */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0, bottom: '28%', left: 0, width: '16%', zIndex: 3,
              background: 'linear-gradient(to right, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.12) 60%, transparent 100%)',
            }}
          />
          {/* Left corner line */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0, bottom: '28%', left: '15%', width: 1, zIndex: 4,
              background: `linear-gradient(180deg,
                transparent 0%,
                rgba(0,0,0,0.45) 12%,
                rgba(0,0,0,0.38) 88%,
                transparent 100%)`,
            }}
          />
          {/* Left corner highlight (gives 3D effect) */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0, bottom: '28%', left: '15.5%', width: 1, zIndex: 4,
              background: `linear-gradient(180deg,
                transparent 0%,
                rgba(255,255,255,0.06) 12%,
                rgba(255,255,255,0.04) 88%,
                transparent 100%)`,
            }}
          />

          {/* Right corner shadow band */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0, bottom: '28%', right: 0, width: '16%', zIndex: 3,
              background: 'linear-gradient(to left, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.12) 60%, transparent 100%)',
            }}
          />
          {/* Right corner line */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0, bottom: '28%', right: '15%', width: 1, zIndex: 4,
              background: `linear-gradient(180deg,
                transparent 0%,
                rgba(0,0,0,0.45) 12%,
                rgba(0,0,0,0.38) 88%,
                transparent 100%)`,
            }}
          />
          {/* Right corner highlight */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0, bottom: '28%', right: '15.5%', width: 1, zIndex: 4,
              background: `linear-gradient(180deg,
                transparent 0%,
                rgba(255,255,255,0.06) 12%,
                rgba(255,255,255,0.04) 88%,
                transparent 100%)`,
            }}
          />
        </>
      )}

      {/* ── Wainscoting panels ── */}
      {c.wallPanel === 'wainscot' && (
        <div
          className="absolute pointer-events-none"
          style={{ top: '34%', bottom: '28%', left: 0, right: 0, zIndex: 3 }}
        >
          {/* Chair rail */}
          <div style={{
            position: 'absolute', top: 0, left: '15%', right: '15%', height: 2,
            background: `linear-gradient(90deg,
              transparent 0%,
              ${accent}50 15%,
              ${accent}60 50%,
              ${accent}50 85%,
              transparent 100%)`,
            boxShadow: `0 1px 4px rgba(0,0,0,0.35)`,
          }} />

          {/* Three panels */}
          {[
            { left: '16%', right: '65%' },
            { left: '37%', right: '37%' },
            { left: '58%', right: '16%' },
          ].map((p, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: '12%', bottom: '10%',
              left: p.left, right: p.right,
              border: `1px solid ${accent}30`,
              borderRadius: 3,
            }}>
              <div style={{
                position: 'absolute', inset: 4,
                border: `1px solid ${accent}18`,
                borderRadius: 1,
              }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Baseboard (floor-wall junction) ── */}
      {c.showBaseboard && (
        <>
          {/* Baseboard body */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: '28%', left: 0, right: 0, height: 5, zIndex: 6,
              background: `linear-gradient(180deg,
                rgba(255,255,255,0.07) 0%,
                rgba(255,255,255,0.04) 40%,
                rgba(0,0,0,0.3) 100%)`,
              boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
            }}
          />
          {/* Baseboard top highlight line */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: 'calc(28% + 5px)', left: 0, right: 0, height: 1, zIndex: 6,
              background: `linear-gradient(90deg,
                transparent 0%,
                rgba(255,255,255,0.12) 15%,
                rgba(255,255,255,0.16) 50%,
                rgba(255,255,255,0.12) 85%,
                transparent 100%)`,
            }}
          />
        </>
      )}

      {/* ── Crown molding (ceiling line) ── */}
      {c.showBaseboard && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0, left: 0, right: 0, height: 4, zIndex: 6,
              background: 'rgba(0,0,0,0.25)',
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              top: 4, left: 0, right: 0, height: 1, zIndex: 6,
              background: `linear-gradient(90deg,
                transparent 0%,
                rgba(255,255,255,0.08) 15%,
                rgba(255,255,255,0.1) 50%,
                rgba(255,255,255,0.08) 85%,
                transparent 100%)`,
            }}
          />
        </>
      )}
    </>
  );
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

  const floorTexture  = buildFloorTextureStyle(c.floorStyle, c.floorColor, accent);
  const floorGradient = `linear-gradient(180deg, transparent, ${c.floorColor}55)`;
  const showPerspGrid = !c.floorImage && c.floorStyle === 'grid';

  return (
    <div
      ref={sceneRef}
      onClick={onSceneClick}
      className={`relative w-full rounded-3xl overflow-hidden ${className}`}
      style={{
        height,
        maxWidth,
        background: c.wallColor,
        boxShadow: [
          `0 24px 88px ${accent}44`,
          `0 6px 28px rgba(0,0,0,0.7)`,
          `inset 0 1px 0 rgba(255,255,255,0.07)`,
          `inset 0 0 120px ${accent}0C`,
        ].join(', '),
      }}
    >
      {/* Three-section wall (left side / back / right side) */}
      <WallSections c={c} />

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

      {/* Ceiling/top darkening */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 28%)',
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

      {/* Architectural overlays (corners, wainscoting, baseboard, crown) */}
      <ArchitecturalLayers c={c} />

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

        {/* User floor image with perspective receding into distance */}
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
