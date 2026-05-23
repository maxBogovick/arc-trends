import { motion } from 'framer-motion';
import { createContext, useContext, useState, useEffect } from 'react';
import type { RefObject, ReactNode, MouseEventHandler, CSSProperties } from 'react';
import { usePetStore, type RoomCustomization, type FloorStyle } from '../../store/petStore';
import { getBackground } from '../../data/backgrounds';
import { SceneEffects } from './SceneEffects';
import { LightingLayer } from './LightingLayer';
import { BackdropScene } from './BackdropScene';
import { usePerformancePolicy } from '../../performance/usePerformancePolicy';

// ── Darkness context ──────────────────────────────────────────────────────────
// RoomScene computes effectiveDarkness once per minute and shares it via context
// so that FurnitureItemVisual and pet don't need their own timers.

export const DarknessContext = createContext<number>(0);
export const useDarkness = () => useContext(DarknessContext);

export function computeEffectiveDarkness(c: RoomCustomization, now: Date): number {
  if (!c.hasSun) return c.ambientDarkness;

  const sunTime = c.sunPreviewHour !== null && c.sunPreviewHour !== undefined
    ? (() => {
        const d = new Date();
        d.setHours(Math.floor(c.sunPreviewHour!), Math.round((c.sunPreviewHour! % 1) * 60), 0, 0);
        return d;
      })()
    : now;

  const h = sunTime.getHours() + sunTime.getMinutes() / 60;
  const sunriseH = 6, sunsetH = 20;
  if (h < sunriseH || h > sunsetH) return c.ambientDarkness;

  const progress = (h - sunriseH) / (sunsetH - sunriseH);
  const sunIntensity = 0.18 + 0.52 * Math.sin(Math.PI * progress);
  // At peak noon sun (~0.70 intensity) with factor 1.5 → darkness reaches 0
  return Math.max(0, c.ambientDarkness * (1 - sunIntensity * 1.5));
}

const DEPTH = 400;

// ── Wall style builders ───────────────────────────────────────────────────────

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

function buildCeilingStyle(c: RoomCustomization): CSSProperties {
  if (c.ceilingImage) {
    return {
      backgroundImage: `url(${c.ceilingImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  switch (c.ceilingStyle) {
    case 'solid':
      return { background: c.ceilingColor };
    case 'v_gradient':
      return { background: `linear-gradient(180deg, ${c.ceilingColor} 0%, ${c.ceilingColor2} 100%)` };
  }
}

// ── Floor textures ────────────────────────────────────────────────────────────

function buildFloorTextureStyle(style: FloorStyle, color: string, accent: string): CSSProperties {
  switch (style) {
    case 'flat':
      return {};

    case 'grid':
      return {
        backgroundImage: [
          `repeating-linear-gradient(90deg,
            ${accent}40 0px, ${accent}40 1px,
            transparent 1px, transparent 40px)`,
          `repeating-linear-gradient(0deg,
            ${accent}40 0px, ${accent}40 1px,
            transparent 1px, transparent 40px)`,
        ].join(', '),
      };

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
  const performancePolicy = usePerformancePolicy();
  const bg = getBackground(equippedBgId ?? 'void_dark');
  const accent = c.accentColor;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!performancePolicy.visible) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [performancePolicy.visible]);

  const effectiveDarkness = computeEffectiveDarkness(c, now);

  const floorTexture = buildFloorTextureStyle(c.floorStyle, c.floorColor, accent);
  const backWallStyle = buildBackWallStyle(c);
  const sideWallStyle = buildSideWallStyle(c);
  const ceilingStyle = buildCeilingStyle(c);
  const backdropType    = c.backdropType  ?? 'wall';
  const backdropScene   = c.backdropScene ?? 'garden';
  const windowStyle     = c.windowStyle   ?? 'classic';


  return (
    // overflow:hidden must be on a SEPARATE element from perspective — Safari flattens
    // preserve-3d when overflow:hidden and perspective are on the same element.
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
      {/* Perspective container — intentionally separate from overflow:hidden above */}
      <div
        className="absolute inset-0"
        style={{ perspective: '700px', perspectiveOrigin: '50% 44%', zIndex: 0 }}
      >
      {/* ── 3D room box ── */}
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}>

        {/* Back wall */}
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute', inset: 0,
            transform: `translateZ(-${DEPTH}px)`,
            ...(backdropType === 'wall' ? backWallStyle : { background: 'transparent' }),
          }}
        >
          {/* Backdrop (window or panorama) rendered inside back wall plane */}
          <BackdropScene
            backdropType={backdropType}
            backdropScene={backdropScene}
            windowStyle={windowStyle}
            hasSun={c.hasSun}
            sunPreviewHour={c.sunPreviewHour}
            width={700}
            height={460}
            backWallCssStyle={backWallStyle}
            motionEnabled={performancePolicy.motionEnabled}
          />
        </div>

        {/* Left wall */}
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute', top: 0, left: 0, width: DEPTH, height: '100%',
            transformOrigin: '0% 50%',
            transform: 'rotateY(90deg)',
            ...sideWallStyle,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.08) 100%)' }} />
        </div>

        {/* Right wall */}
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute', top: 0, right: 0, width: DEPTH, height: '100%',
            transformOrigin: '100% 50%',
            transform: 'rotateY(-90deg)',
            ...sideWallStyle,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.08) 100%)' }} />
        </div>

        {/* Ceiling */}
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: DEPTH,
            transformOrigin: '50% 0%',
            transform: 'rotateX(-90deg)',
            ...ceilingStyle,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 100%)' }} />
        </div>

        {/* Floor */}
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: DEPTH,
            transformOrigin: '50% 100%',
            transform: 'rotateX(90deg)',
            background: c.floorColor,
          }}
        >
          {!c.floorImage && (
            <div style={{ position: 'absolute', inset: 0, ...floorTexture }} />
          )}
          {c.floorImage && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${c.floorImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%)' }} />
        </div>
      </div>
      </div>{/* end perspective container */}

      {/* Theme animated effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
        <SceneEffects effects={bg.effects} policy={performancePolicy} />
      </div>

      {/* Ambient darkness — multiply layer that dims the whole room.
          Reduced automatically when sun is active. Light sources (screen, zIndex 4) punch through. */}
      {effectiveDarkness > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `rgba(0, 5, 20, ${effectiveDarkness})`,
            mixBlendMode: 'multiply',
            zIndex: 2,
          }}
        />
      )}

      {/* Ceiling/top darkening */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 28%)',
          zIndex: 3,
        }}
      />

      {/* Light sources — mix-blend-mode: screen layer */}
      <LightingLayer />

      {/* Theme decorations */}
      {(bg.decorations ?? []).map((d, i) => (
        <motion.div
          key={i}
          className="absolute select-none pointer-events-none"
          style={{ left: `${d.x}%`, top: `${d.y}%`, fontSize: d.size, zIndex: 3 }}
          animate={performancePolicy.motionEnabled ? { y: [0, -3, 0] } : { y: 0 }}
          transition={performancePolicy.motionEnabled ? { duration: 3 + i * 0.7, repeat: Infinity, delay: i * 0.5 } : { duration: 0 }}
        >
          {d.emoji}
        </motion.div>
      ))}

      <DarknessContext.Provider value={effectiveDarkness}>
        {children}
      </DarknessContext.Provider>
    </div>
  );
}
