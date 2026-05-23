import { motion } from 'framer-motion';
import type { AuraDef } from '../../data/auras';
import { usePerformancePolicy } from '../../performance/usePerformancePolicy';

const AURA_CSS = `
@keyframes auraFlameRise {
  0%   { transform: translateY(0) scaleX(1) rotate(0deg); opacity: 0.9; }
  50%  { transform: translateY(-40px) scaleX(0.6) rotate(8deg); opacity: 0.6; }
  100% { transform: translateY(-80px) scaleX(0.2) rotate(-4deg); opacity: 0; }
}
@keyframes auraFlicker {
  0%,100% { opacity: 0.8; } 25% { opacity: 0.3; } 75% { opacity: 1; }
}
@keyframes auraOrbit {
  from { transform: rotate(0deg) translateX(var(--r)) rotate(0deg); }
  to   { transform: rotate(360deg) translateX(var(--r)) rotate(-360deg); }
}
@keyframes auraOrbitRev {
  from { transform: rotate(360deg) translateX(var(--r)) rotate(-360deg); }
  to   { transform: rotate(0deg) translateX(var(--r)) rotate(0deg); }
}
@keyframes auraPulse {
  0%,100% { transform: scale(1); opacity: 0.6; }
  50%      { transform: scale(1.18); opacity: 1; }
}
@keyframes auraBubbleRise {
  0%   { transform: translateY(0) scale(1);   opacity: 0.8; }
  80%  { transform: translateY(-70px) scale(1.3); opacity: 0.4; }
  100% { transform: translateY(-85px) scale(1.6); opacity: 0; }
}
@keyframes auraElecArc {
  0%,100% { opacity: 0;  clip-path: inset(0 100% 0 0); }
  10%,60% { opacity: 1;  clip-path: inset(0 0% 0 0); }
  40%,90% { opacity: 0.2; }
}
@keyframes auraRay {
  0%,100% { transform: scaleY(1) scaleX(1); opacity: 0.6; }
  50%      { transform: scaleY(1.3) scaleX(0.8); opacity: 1; }
}
@keyframes auraTendril {
  0%   { transform: rotate(var(--ta)) scale(1) translateY(0); opacity: 0.7; }
  50%  { transform: rotate(calc(var(--ta) + 20deg)) scale(1.1) translateY(-6px); opacity: 0.4; }
  100% { transform: rotate(var(--ta)) scale(1) translateY(0); opacity: 0.7; }
}
@keyframes auraHalo {
  0%,100% { transform: scale(1) rotate(0deg); opacity: 0.5; }
  50%      { transform: scale(1.08) rotate(180deg); opacity: 0.9; }
}
@keyframes auraVoidPulse {
  0%,100% { transform: scale(1); opacity: 0.8; }
  50%      { transform: scale(1.25); opacity: 0.3; }
}
@keyframes auraSnowSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
`;

interface Props {
  aura: AuraDef;
}

const sr = (i: number, off = 0) => ((i * 137 + off * 31) % 100) / 100;

export function PetAura({ aura }: Props) {
  const performancePolicy = usePerformancePolicy();
  if (aura.id === 'none') return null;
  if (!performancePolicy.auraEffectsEnabled) return <StaticAura aura={aura} />;

  return (
    <>
      <style>{AURA_CSS}</style>
      <div className="absolute pointer-events-none" style={{ inset: '-70px', zIndex: 0 }}>
        {aura.id === 'flame'    && <FlameAura    c1={aura.color} c2={aura.color2} />}
        {aura.id === 'electric' && <ElectricAura c1={aura.color} c2={aura.color2} />}
        {aura.id === 'ice'      && <IceAura      c1={aura.color} c2={aura.color2} />}
        {aura.id === 'toxic'    && <ToxicAura    c1={aura.color} c2={aura.color2} />}
        {aura.id === 'cosmic'   && <CosmicAura   c1={aura.color} c2={aura.color2} />}
        {aura.id === 'shadow'   && <ShadowAura   c1={aura.color} c2={aura.color2} />}
        {aura.id === 'divine'   && <DivineAura   c1={aura.color} c2={aura.color2} />}
      </div>
    </>
  );
}

function StaticAura({ aura }: Props) {
  return (
    <div className="absolute pointer-events-none" style={{ inset: '-46px', zIndex: 0 }}>
      <div
        className="absolute"
        style={{
          inset: 28,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at 50% 55%, ${aura.color2}24, ${aura.color}16 48%, transparent 72%)`,
          boxShadow: `0 0 26px 10px ${aura.color}2f`,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

// ─── Flame ────────────────────────────────────────────────────────────────────

function FlameAura({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <div className="w-full h-full relative">
      {/* Outer glow ring */}
      <div className="absolute" style={{
        inset: 20, borderRadius: '50%',
        boxShadow: `0 0 40px 18px ${c1}55, 0 0 80px 30px ${c2}22`,
        animation: 'auraPulse 2s ease-in-out infinite',
      }} />
      {/* 10 flame particles along bottom arc */}
      {Array.from({ length: 10 }, (_, i) => {
        const angle = -30 + (i / 9) * 240;
        const rad = (angle * Math.PI) / 180;
        const cx = 50 + Math.cos(rad) * 44;
        const cy = 55 + Math.sin(rad) * 44;
        const delay = sr(i) * 1.5;
        const dur = 0.8 + sr(i, 1) * 0.7;
        const w = 8 + sr(i, 2) * 10;
        const color = i % 2 === 0 ? c1 : c2;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${cx}%`, top: `${cy}%`,
            width: w, height: w * 2,
            background: `radial-gradient(ellipse at 50% 80%, ${color}ff, ${color}88 40%, transparent 80%)`,
            borderRadius: '50% 50% 30% 30%',
            animation: `auraFlameRise ${dur}s ease-out ${delay}s infinite, auraFlicker ${dur * 0.7}s ease-in-out ${delay}s infinite`,
            transformOrigin: 'bottom center',
          }} />
        );
      })}
    </div>
  );
}

// ─── Electric ─────────────────────────────────────────────────────────────────

function ElectricAura({ c1, c2 }: { c1: string; c2: string }) {
  const arcs = [
    { x1: 10, y1: 30, x2: 25, y2: 15, x3: 35, y3: 25, x4: 20, y4: 10 },
    { x1: 75, y1: 20, x2: 85, y2: 35, x3: 90, y3: 25, x4: 95, y4: 40 },
    { x1: 15, y1: 70, x2: 5,  y2: 60, x3: 8,  y3: 50, x4: 2,  y4: 40 },
    { x1: 80, y1: 75, x2: 90, y2: 65, x3: 88, y3: 55, x4: 95, y4: 48 },
    { x1: 40, y1: 8,  x2: 50, y2: 2,  x3: 60, y3: 8,  x4: 65, y4: 2 },
    { x1: 35, y1: 92, x2: 50, y2: 98, x3: 60, y3: 92, x4: 70, y4: 96 },
  ];

  return (
    <div className="w-full h-full relative">
      {/* Glow */}
      <div className="absolute" style={{
        inset: 18, borderRadius: '50%',
        boxShadow: `0 0 30px 12px ${c1}44, 0 0 60px 20px ${c2}22`,
        animation: 'auraFlicker 0.3s ease-in-out infinite',
      }} />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" style={{ mixBlendMode: 'screen' }}>
        {arcs.map((a, i) => (
          <motion.polyline
            key={i}
            points={`${a.x1},${a.y1} ${a.x2},${a.y2} ${a.x3},${a.y3} ${a.x4},${a.y4}`}
            fill="none"
            stroke={i % 2 === 0 ? c1 : c2}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0}
            animate={{ opacity: [0, 1, 0, 1, 0], pathLength: [0, 1, 1, 1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.8 + sr(i) * 1.5, delay: sr(i, 1) * 0.8 }}
          />
        ))}
      </svg>
      {/* 4 orbiting sparks */}
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 5, height: 5,
          background: i % 2 === 0 ? c1 : c2,
          borderRadius: '50%',
          boxShadow: `0 0 8px 3px ${i % 2 === 0 ? c1 : c2}`,
          '--r': `${38 + sr(i) * 8}px`,
          animation: `${i % 2 === 0 ? 'auraOrbit' : 'auraOrbitRev'} ${1.5 + sr(i) * 0.8}s linear ${sr(i, 1) * 0.5}s infinite`,
          transform: 'translate(-50%, -50%)',
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

// ─── Ice ──────────────────────────────────────────────────────────────────────

function IceAura({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <div className="w-full h-full relative">
      {/* Frost glow */}
      <motion.div className="absolute" style={{
        inset: 22, borderRadius: '50%',
        boxShadow: `0 0 35px 14px ${c1}44, 0 0 70px 25px ${c2}22`,
      }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Orbiting ice crystals */}
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 6 + sr(i) * 5, height: 6 + sr(i) * 5,
          background: `radial-gradient(circle, white 20%, ${c1} 60%, ${c2} 100%)`,
          borderRadius: i % 2 === 0 ? '50%' : '2px',
          boxShadow: `0 0 6px 2px ${c1}99`,
          '--r': `${42 + sr(i) * 14}px`,
          animation: `auraOrbit ${3 + sr(i) * 2.5}s linear ${sr(i, 1)}s infinite`,
          transform: 'translate(-50%, -50%)',
          rotate: `${i * 45}deg`,
        } as React.CSSProperties} />
      ))}
      {/* Snowflake SVG overlay */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" style={{ opacity: 0.25 }}>
        {[0, 60, 120].map(angle => (
          <line key={angle}
            x1={50} y1={50}
            x2={50 + Math.cos((angle * Math.PI) / 180) * 30}
            y2={50 + Math.sin((angle * Math.PI) / 180) * 30}
            stroke={c1} strokeWidth={0.8}
            style={{ animation: `auraSnowSpin 8s linear infinite`, transformOrigin: '50px 50px' }}
          />
        ))}
      </svg>
    </div>
  );
}

// ─── Toxic ────────────────────────────────────────────────────────────────────

function ToxicAura({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <div className="w-full h-full relative">
      {/* Pulsing outer ring */}
      <motion.div className="absolute rounded-full" style={{
        inset: 16,
        border: `2px solid ${c1}55`,
        boxShadow: `0 0 24px 10px ${c1}44, inset 0 0 20px ${c2}22`,
      }}
        animate={{ scale: [1, 1.06, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Rising bubbles */}
      {Array.from({ length: 8 }, (_, i) => {
        const x = 25 + sr(i) * 50;
        const size = 5 + sr(i, 1) * 7;
        const delay = sr(i, 2) * 2;
        const dur = 2 + sr(i, 3) * 1.5;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${x}%`, bottom: '20%',
            width: size, height: size,
            borderRadius: '50%',
            border: `1.5px solid ${c1}99`,
            background: `radial-gradient(circle at 35% 35%, ${c1}55, transparent 70%)`,
            animation: `auraBubbleRise ${dur}s ease-out ${delay}s infinite`,
          }} />
        );
      })}
      {/* Glow base */}
      <div className="absolute" style={{
        bottom: '10%', left: '20%', right: '20%', height: '30%',
        background: `radial-gradient(ellipse at 50% 100%, ${c1}44, transparent 70%)`,
        borderRadius: '50%',
        animation: 'auraPulse 1.5s ease-in-out infinite',
      }} />
    </div>
  );
}

// ─── Cosmic ───────────────────────────────────────────────────────────────────

function CosmicAura({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <div className="w-full h-full relative" style={{ mixBlendMode: 'screen' }}>
      {/* Nebula glow */}
      <motion.div className="absolute" style={{
        inset: 14, borderRadius: '50%',
        background: `radial-gradient(ellipse at 40% 40%, ${c2}44, ${c1}22, transparent 70%)`,
        boxShadow: `0 0 50px 20px ${c1}33, 0 0 100px 40px ${c2}11`,
      }}
        animate={{ scale: [1, 1.08, 1], rotate: [0, 15, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Orbiting stars */}
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 3 + sr(i) * 3, height: 3 + sr(i) * 3,
          background: i % 3 === 0 ? 'white' : i % 3 === 1 ? c1 : c2,
          borderRadius: '50%',
          boxShadow: `0 0 6px 2px ${c1}`,
          '--r': `${44 + sr(i) * 20}px`,
          animation: `${i % 2 === 0 ? 'auraOrbit' : 'auraOrbitRev'} ${4 + sr(i) * 4}s linear ${sr(i, 1)}s infinite`,
          transform: 'translate(-50%, -50%)',
        } as React.CSSProperties} />
      ))}
      {/* Small scattered stars */}
      {Array.from({ length: 12 }, (_, i) => (
        <motion.div key={`s${i}`} style={{
          position: 'absolute',
          left: `${10 + sr(i) * 80}%`, top: `${10 + sr(i, 1) * 80}%`,
          width: 2, height: 2,
          borderRadius: '50%',
          background: sr(i, 2) > 0.5 ? c1 : 'white',
        }}
          animate={{ opacity: [0.1, 1, 0.1], scale: [0.8, 1.5, 0.8] }}
          transition={{ duration: 1.5 + sr(i) * 2, repeat: Infinity, delay: sr(i, 3) * 2 }}
        />
      ))}
    </div>
  );
}

// ─── Shadow ───────────────────────────────────────────────────────────────────

function ShadowAura({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <div className="w-full h-full relative">
      {/* Dark void core */}
      <motion.div className="absolute" style={{
        inset: 20, borderRadius: '50%',
        background: `radial-gradient(ellipse at 50% 50%, ${c2}cc, transparent 70%)`,
        boxShadow: `0 0 40px 20px ${c1}44, inset 0 0 30px ${c2}88`,
      }}
        animate={{ scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Orbiting shadow rings */}
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="absolute" style={{
          inset: 10 + i * 10,
          borderRadius: '50%',
          border: `1.5px solid ${c1}${30 + i * 15}`,
        }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360, scale: [1, 1.05, 1] }}
          transition={{ duration: 6 + i * 2, repeat: Infinity, ease: 'linear' }}
        />
      ))}
      {/* Shadow tendrils */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * 360;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 3, height: 40 + sr(i) * 20,
            background: `linear-gradient(to top, ${c1}cc, transparent)`,
            borderRadius: 2,
            transformOrigin: 'bottom center',
            '--ta': `${angle}deg`,
            animation: `auraTendril ${2 + sr(i)}s ease-in-out ${sr(i, 1)}s infinite`,
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
          } as React.CSSProperties} />
        );
      })}
    </div>
  );
}

// ─── Divine ───────────────────────────────────────────────────────────────────

function DivineAura({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <div className="w-full h-full relative" style={{ mixBlendMode: 'screen' }}>
      {/* Golden outer glow */}
      <motion.div className="absolute" style={{
        inset: 12, borderRadius: '50%',
        boxShadow: `0 0 50px 20px ${c1}55, 0 0 100px 40px ${c2}22`,
      }}
        animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* 8 golden rays */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * 360;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 3, height: 55 + sr(i) * 20,
            background: `linear-gradient(to top, ${c1}dd, ${c2}88, transparent)`,
            borderRadius: 2,
            transformOrigin: 'bottom center',
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            animation: `auraRay ${1.5 + sr(i) * 1}s ease-in-out ${sr(i, 1) * 0.8}s infinite`,
          }} />
        );
      })}
      {/* Two rotating halos */}
      {[0, 1].map(i => (
        <motion.div key={i} className="absolute" style={{
          inset: 24 + i * 12,
          borderRadius: '50%',
          border: `${2 - i * 0.5}px solid ${c1}${50 + i * 20}`,
          boxShadow: `0 0 10px 4px ${c1}44`,
        }}
          animate={{ rotate: i === 0 ? 360 : -360, scale: [1, 1.03, 1] }}
          transition={{ duration: 4 + i * 2, repeat: Infinity, ease: 'linear' }}
        />
      ))}
      {/* Floating sparkle particles */}
      {Array.from({ length: 10 }, (_, i) => (
        <motion.div key={`sp${i}`} style={{
          position: 'absolute',
          left: `${15 + sr(i) * 70}%`, top: `${15 + sr(i, 1) * 70}%`,
          width: 4 + sr(i) * 3, height: 4 + sr(i) * 3,
          background: sr(i, 2) > 0.5 ? c1 : c2,
          borderRadius: '50%',
          boxShadow: `0 0 6px 2px ${c1}`,
        }}
          animate={{ opacity: [0, 1, 0], y: [0, -15, -30], scale: [0.5, 1.2, 0.3] }}
          transition={{ duration: 2 + sr(i), repeat: Infinity, delay: sr(i, 3) * 2 }}
        />
      ))}
    </div>
  );
}
