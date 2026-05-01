import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { Pet, PetMood } from '../../api';
import { getSkin, type SkinDefinition, type EyeStyle, type OverlayStyle } from '../../data/skins';
import { getBodyShape, type BodyShapeId } from '../../data/bodyShapes';
import { getAccessory } from '../../data/accessories';
import { getAura } from '../../data/auras';
import { usePetStore } from '../../store/petStore';
import { PetAura } from './PetAura';

interface Props {
  pet: Pet;
  moodOverride?: PetMood;
}

// ─── Mouth generator ──────────────────────────────────────────────────────────

function getMouthPath(mood: PetMood, cy: number, hw: number): string {
  const cx = 100;
  switch (mood) {
    case 'ecstatic': return `M ${cx - hw} ${cy} Q ${cx} ${cy + 26} ${cx + hw} ${cy}`;
    case 'happy':    return `M ${cx - hw + 4} ${cy} Q ${cx} ${cy + 18} ${cx + hw - 4} ${cy}`;
    case 'content':  return `M ${cx - hw + 8} ${cy + 2} Q ${cx} ${cy + 13} ${cx + hw - 8} ${cy + 2}`;
    case 'sad':      return `M ${cx - hw + 6} ${cy + 12} Q ${cx} ${cy - 8} ${cx + hw - 6} ${cy + 12}`;
    case 'tired':    return `M ${cx - hw + 10} ${cy + 5} L ${cx + hw - 10} ${cy + 5}`;
    case 'sick':     return `M ${cx - hw + 5} ${cy + 8} Q ${cx - 12} ${cy - 2} ${cx} ${cy + 6} Q ${cx + 12} ${cy + 14} ${cx + hw - 5} ${cy + 4}`;
    case 'sleeping': return `M ${cx - hw + 10} ${cy + 2} Q ${cx} ${cy + 12} ${cx + hw - 10} ${cy + 2}`;
    default:         return `M ${cx - hw + 8} ${cy + 2} Q ${cx} ${cy + 13} ${cx + hw - 8} ${cy + 2}`;
  }
}

// ─── Eye Styles ───────────────────────────────────────────────────────────────

type EyeProps = { cx: number; cy: number; color: string; mood: PetMood };

function EyeNormal({ cx, cy, color, mood }: EyeProps) {
  const off = cx < 100 ? 3 : -3;
  if (mood === 'sleeping')
    return <path d={`M ${cx - 12} ${cy} Q ${cx} ${cy - 7} ${cx + 12} ${cy}`} stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />;
  if (mood === 'sick')
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={12} ry={9} fill="white" />
        <line x1={cx - 6} y1={cy - 5} x2={cx + 6} y2={cy + 5} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        <line x1={cx + 6} y1={cy - 5} x2={cx - 6} y2={cy + 5} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    );
  return (
    <g>
      <motion.ellipse cx={cx} cy={cy} rx={12} ry={13} fill="white"
        animate={{ ry: [13, 13, 13, 0.5, 13] }} transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }} />
      <ellipse cx={cx + off * 0.4} cy={cy + 1} rx={7} ry={7} fill={color} />
      <circle cx={cx + off} cy={cy - 3} r={2.5} fill="white" />
    </g>
  );
}

function EyeLED({ cx, cy, color }: EyeProps) {
  return (
    <g>
      <rect x={cx - 14} y={cy - 5} width={28} height={10} rx={3} fill="#001833" />
      <rect x={cx - 13} y={cy - 4} width={26} height={8} rx={2} fill={color} opacity={0.85} />
      <motion.rect x={cx - 13} y={cy - 4} width={7} height={8} rx={2} fill="white" opacity={0.5}
        animate={{ x: [cx - 13, cx + 6, cx - 13] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }} />
      <rect x={cx - 13} y={cy - 1} width={26} height={1} fill="rgba(0,0,0,0.3)" />
    </g>
  );
}

function EyeSpiral({ cx, cy, color }: EyeProps) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={13} fill="#0D0020" />
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r={10} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray="18 8" />
      </motion.g>
      <motion.g animate={{ rotate: -360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="8 4" opacity={0.7} />
      </motion.g>
      <motion.circle cx={cx} cy={cy} r={2.5} fill={color}
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
    </g>
  );
}

function EyeSlit({ cx, cy, color }: EyeProps) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={13} ry={11} fill="#1A0500" />
      <motion.ellipse cx={cx} cy={cy} rx={3.5} ry={10} fill={color}
        animate={{ rx: [3.5, 2.5, 3.5] }} transition={{ duration: 3, repeat: Infinity }} />
      <ellipse cx={cx} cy={cy} rx={2} ry={6} fill="rgba(255,200,0,0.55)" />
    </g>
  );
}

function EyeCrystal({ cx, cy, color }: EyeProps) {
  const pts = `${cx},${cy - 13} ${cx + 11},${cy} ${cx},${cy + 13} ${cx - 11},${cy}`;
  return (
    <g>
      <motion.polygon points={pts} fill={color} opacity={0.9}
        animate={{ opacity: [0.9, 0.5, 0.9] }} transition={{ duration: 2.5, repeat: Infinity }} />
      <polygon points={pts} fill="none" stroke="white" strokeWidth={1.2} opacity={0.6} />
      <circle cx={cx} cy={cy} r={3.5} fill="white" opacity={0.8} />
    </g>
  );
}

function EyeBubble({ cx, cy, color }: EyeProps) {
  return (
    <g>
      <circle cx={cx - 4} cy={cy + 2} r={8} fill={color} opacity={0.7} />
      <circle cx={cx + 4} cy={cy - 2} r={7} fill={color} opacity={0.85} />
      <circle cx={cx + 4} cy={cy - 2} r={3} fill="white" opacity={0.5} />
      <circle cx={cx + 2} cy={cy - 4} r={1.5} fill="white" opacity={0.8} />
    </g>
  );
}

function EyeCross({ cx, cy, color }: EyeProps) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="rgba(0,0,0,0.5)" />
      <line x1={cx - 11} y1={cy} x2={cx + 11} y2={cy} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <line x1={cx} y1={cy - 11} x2={cx} y2={cy + 11} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <motion.circle cx={cx} cy={cy} r={3} fill={color}
        animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
      <circle cx={cx} cy={cy} r={12} fill="none" stroke={color} strokeWidth={1.2} opacity={0.5} />
    </g>
  );
}

function EyeStar({ cx, cy, color }: EyeProps) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 12 : 5;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'} ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} `;
  }
  return (
    <motion.g animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <path d={d + 'Z'} fill={color} opacity={0.9} />
      <path d={d + 'Z'} fill="none" stroke="white" strokeWidth={0.8} opacity={0.6} />
      <circle cx={cx} cy={cy} r={2.5} fill="white" />
    </motion.g>
  );
}

function EyeLens({ cx, cy, color }: EyeProps) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={13} fill="#001020" />
      {[11, 8, 5, 2].map((r, i) => (
        <motion.circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.5}
          opacity={0.3 + i * 0.15}
          animate={{ r: [r, r + 1.2, r] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} />
      ))}
      <circle cx={cx} cy={cy} r={2} fill={color} />
    </g>
  );
}

function EyeHologram({ cx, cy, color }: EyeProps) {
  return (
    <g>
      <rect x={cx - 13} y={cy - 9} width={26} height={18} rx={4} fill="rgba(0,0,20,0.8)" />
      <motion.text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fontFamily="monospace" fontWeight="bold" fill={color}
        animate={{ opacity: [1, 0.2, 1, 0.5, 1] }} transition={{ duration: 0.9, repeat: Infinity, times: [0, 0.15, 0.35, 0.65, 1] }}>
        ◈
      </motion.text>
      <motion.rect x={cx - 13} y={cy - 9} width={26} height={3} rx={1} fill={color} opacity={0.35}
        animate={{ y: [cy - 9, cy + 9, cy - 9] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} />
    </g>
  );
}

function Eyes({ skin, shapeId, mood }: { skin: SkinDefinition; shapeId: BodyShapeId; mood: PetMood }) {
  const shape = getBodyShape(shapeId);
  const positions: EyeProps[] = [
    { ...shape.eyeLeft,  color: skin.eyeColor, mood },
    { ...shape.eyeRight, color: skin.eyeColor, mood },
  ];
  return (
    <>
      {positions.map((p, i) => {
        const k = i;
        switch (skin.eyeStyle) {
          case 'led':      return <EyeLED      key={k} {...p} />;
          case 'spiral':   return <EyeSpiral   key={k} {...p} />;
          case 'slit':     return <EyeSlit     key={k} {...p} />;
          case 'crystal':  return <EyeCrystal  key={k} {...p} />;
          case 'bubble':   return <EyeBubble   key={k} {...p} />;
          case 'cross':    return <EyeCross    key={k} {...p} />;
          case 'star':     return <EyeStar     key={k} {...p} />;
          case 'lens':     return <EyeLens     key={k} {...p} />;
          case 'hologram': return <EyeHologram key={k} {...p} />;
          default:         return <EyeNormal   key={k} {...p} />;
        }
      })}
    </>
  );
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

function Overlay({ skin }: { skin: SkinDefinition }) {
  const c = skin.colors.glow;
  switch (skin.overlay) {
    case 'circuits': return (
      <g opacity={0.22} stroke={c} fill="none" strokeWidth={1}>
        <path d="M 30 60 H 55 V 45 H 75" /><path d="M 170 70 H 145 V 55 H 125" />
        <path d="M 45 130 H 65 V 145 H 85" /><path d="M 155 125 H 135 V 140 H 115" />
        <path d="M 100 30 V 45" />
        <circle cx={55} cy={45} r={3} fill={c} /><circle cx={145} cy={55} r={3} fill={c} />
        <circle cx={65} cy={145} r={3} fill={c} /><circle cx={135} cy={140} r={3} fill={c} />
      </g>
    );
    case 'cracks': return (
      <g>
        <path d="M 90 50 L 80 70 L 95 75 L 82 100" stroke={c} strokeWidth={1.5} fill="none" opacity={0.7} strokeLinecap="round" />
        <path d="M 115 45 L 120 65 L 108 72 L 118 95" stroke={c} strokeWidth={1.5} fill="none" opacity={0.7} strokeLinecap="round" />
        <path d="M 60 95 L 72 108 L 65 120" stroke={c} strokeWidth={1} fill="none" opacity={0.45} />
        <path d="M 140 90 L 128 105 L 135 118" stroke={c} strokeWidth={1} fill="none" opacity={0.45} />
        <path d="M 90 50 L 80 70 L 95 75 L 82 100" stroke="rgba(255,200,0,0.35)" strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d="M 115 45 L 120 65 L 108 72 L 118 95" stroke="rgba(255,200,0,0.35)" strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
    );
    case 'frost': return (
      <g opacity={0.38} stroke={c} fill="none" strokeWidth={1}>
        {([[55,50,14],[150,60,10],[70,140,9],[135,148,11],[100,38,7]] as const).map(([cx, cy, r], idx) => (
          <g key={idx}>
            {[0,1,2,3,4,5].map(i => {
              const a = (i * Math.PI * 2) / 6;
              return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} />;
            })}
          </g>
        ))}
      </g>
    );
    case 'bubbles': return (
      <g>
        {([[52,58,6],[148,62,5],[65,140,7],[140,145,6],[100,38,5],[80,155,4]] as const).map(([cx, cy, r], i) => (
          <motion.circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={1.2} opacity={0.4}
            animate={{ cy: [cy, cy-8, cy], scale: [1, 1.12, 1] }}
            transition={{ duration: 2 + i * 0.4, repeat: Infinity, delay: i * 0.3 }} />
        ))}
      </g>
    );
    case 'lightning': return (
      <g>
        {[
          { d: "M 75 38 L 68 62 L 78 62 L 70 86", delay: 0 },
          { d: "M 128 42 L 135 65 L 125 65 L 132 88", delay: 0.6 },
          { d: "M 100 25 L 94 45 L 102 45 L 96 65", delay: 0.3 },
        ].map((lt, i) => (
          <motion.path key={i} d={lt.d} stroke={c} strokeWidth={i === 2 ? 1.5 : 2} fill="none"
            animate={{ opacity: [0.8, 0.05, 0.8] }} transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 1.2 + i * 0.3, delay: lt.delay }} />
        ))}
      </g>
    );
    case 'stars': return (
      <g>
        {([[55,55],[148,50],[65,145],[140,142],[100,35],[78,160],[128,158]] as const).map(([cx, cy], i) => (
          <motion.text key={i} x={cx} y={cy} fontSize={8} fill={c} textAnchor="middle"
            animate={{ opacity: [0.2, 0.65, 0.2], scale: [0.8, 1.3, 0.8] }}
            transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.4 }}>
            ✦
          </motion.text>
        ))}
      </g>
    );
    case 'void': return (
      <g opacity={0.32}>
        {[0, 1, 2].map(i => (
          <motion.ellipse key={i} cx={100} cy={100} rx={30 + i * 20} ry={20 + i * 15}
            fill="none" stroke={c} strokeWidth={0.8}
            animate={{ rx: [30 + i * 20, 36 + i * 20, 30 + i * 20], opacity: [0.4, 0.1, 0.4] }}
            transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.5 }} />
        ))}
      </g>
    );
    case 'bioluminescence': return (
      <g>
        {([[55,70,5],[150,75,4],[70,130,6],[135,135,5],[100,50,4],[82,160,3],[118,162,3]] as const).map(([cx, cy, r], i) => (
          <motion.circle key={i} cx={cx} cy={cy} r={r} fill={c}
            animate={{ opacity: [0.08, 0.55, 0.08], r: [r, r + 1.5, r] }}
            transition={{ duration: 1.5 + i * 0.4, repeat: Infinity, delay: i * 0.3 }} />
        ))}
      </g>
    );
    case 'prismatic': return (
      <g opacity={0.18}>
        <motion.rect x={28} y={28} width={144} height={144} rx={72}
          fill="none" stroke="url(#rainbow_grad)" strokeWidth={4}
          animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '100px 100px' }} />
      </g>
    );
    default: return null;
  }
}

// ─── Body shapes ──────────────────────────────────────────────────────────────

interface BodyProps {
  gradId: string;
  c: { body1: string; body2: string; glow: string; cheek: string };
  isAsleep: boolean;
}

function BlobBody({ gradId, isAsleep }: BodyProps) {
  return (
    <motion.path
      d="M 100 28 C 135 18, 174 48, 172 88 C 170 130, 148 168, 100 172 C 52 168, 30 130, 28 88 C 26 48, 65 18, 100 28 Z"
      fill={`url(#${gradId})`}
      animate={isAsleep
        ? { d: 'M 100 38 C 132 28, 168 52, 166 88 C 164 124, 144 160, 100 164 C 56 160, 36 124, 34 88 C 32 52, 68 28, 100 38 Z' }
        : { d: 'M 100 28 C 135 18, 174 48, 172 88 C 170 130, 148 168, 100 172 C 52 168, 30 130, 28 88 C 26 48, 65 18, 100 28 Z' }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    />
  );
}

function CatBody({ gradId, c, isAsleep }: BodyProps) {
  return (
    <>
      {/* Ears behind body */}
      <path d="M 50 80 L 36 36 L 78 60 Z" fill={`url(#${gradId})`} />
      <path d="M 150 80 L 164 36 L 122 60 Z" fill={`url(#${gradId})`} />
      {/* Inner ears */}
      <path d="M 54 74 L 44 48 L 70 63 Z" fill={c.cheek} opacity={0.55} />
      <path d="M 146 74 L 156 48 L 130 63 Z" fill={c.cheek} opacity={0.55} />
      {/* Body */}
      <motion.path
        d="M 100 54 C 136 44, 168 66, 168 106 C 168 146, 146 170, 100 170 C 54 170, 32 146, 32 106 C 32 66, 64 44, 100 54 Z"
        fill={`url(#${gradId})`}
        animate={isAsleep
          ? { d: 'M 100 62 C 134 52, 162 72, 162 108 C 162 143, 141 164, 100 164 C 59 164, 38 143, 38 108 C 38 74, 66 52, 100 62 Z' }
          : { d: 'M 100 54 C 136 44, 168 66, 168 106 C 168 146, 146 170, 100 170 C 54 170, 32 146, 32 106 C 32 66, 64 44, 100 54 Z' }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
    </>
  );
}

function ChunkyBody({ gradId, c, isAsleep }: BodyProps) {
  return (
    <>
      {/* Legs behind body */}
      <path d="M 52 168 L 46 188 C 46 196, 60 200, 70 196 L 76 168 Z" fill={c.body2} />
      <path d="M 124 168 L 130 196 C 140 200, 154 196, 154 188 L 148 168 Z" fill={c.body2} />
      {/* Body */}
      <motion.path
        d="M 32 76 C 32 58, 56 46, 100 46 C 144 46, 168 58, 168 76 L 168 142 C 168 158, 148 168, 100 168 C 52 168, 32 158, 32 142 Z"
        fill={`url(#${gradId})`}
        animate={isAsleep
          ? { d: 'M 36 82 C 36 65, 58 56, 100 56 C 142 56, 164 65, 164 82 L 164 138 C 164 153, 146 162, 100 162 C 54 162, 36 153, 36 138 Z' }
          : { d: 'M 32 76 C 32 58, 56 46, 100 46 C 144 46, 168 58, 168 76 L 168 142 C 168 158, 148 168, 100 168 C 52 168, 32 158, 32 142 Z' }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
    </>
  );
}

function TallBody({ gradId, isAsleep }: BodyProps) {
  return (
    <>
      {/* Long arms */}
      <path d="M 62 82 C 46 90, 24 104, 14 130 C 12 137, 18 142, 24 138 C 32 114, 52 102, 68 92 Z" fill={`url(#${gradId})`} />
      <path d="M 138 82 C 154 90, 176 104, 186 130 C 188 137, 182 142, 176 138 C 168 114, 148 102, 132 92 Z" fill={`url(#${gradId})`} />
      {/* Slim body */}
      <motion.path
        d="M 100 22 C 120 20, 138 36, 138 74 C 138 126, 126 168, 100 172 C 74 168, 62 126, 62 74 C 62 36, 80 20, 100 22 Z"
        fill={`url(#${gradId})`}
        animate={isAsleep
          ? { d: 'M 100 30 C 118 28, 134 42, 134 78 C 134 128, 124 164, 100 168 C 76 164, 66 128, 66 78 C 66 42, 82 28, 100 30 Z' }
          : { d: 'M 100 22 C 120 20, 138 36, 138 74 C 138 126, 126 168, 100 172 C 74 168, 62 126, 62 74 C 62 36, 80 20, 100 22 Z' }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
    </>
  );
}

function TailedBody({ gradId, c, isAsleep }: BodyProps) {
  return (
    <>
      {/* Tail drawn before body so base is covered */}
      <path
        d="M 156 88 C 190 72, 205 108, 192 136 C 185 154, 170 158, 162 146 C 170 152, 183 148, 188 130 C 194 108, 180 80, 152 100 Z"
        fill={c.body2}
      />
      <path
        d="M 158 90 C 190 74, 204 108, 192 134 C 185 152, 170 156, 162 144"
        stroke={c.body1} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.4}
      />
      {/* Body slightly left-shifted */}
      <motion.path
        d="M 92 30 C 126 20, 160 50, 158 88 C 156 126, 136 162, 92 165 C 48 162, 30 128, 30 90 C 30 52, 60 20, 92 30 Z"
        fill={`url(#${gradId})`}
        animate={isAsleep
          ? { d: 'M 92 40 C 124 30, 154 56, 152 90 C 150 124, 132 156, 92 159 C 52 156, 34 130, 34 92 C 34 58, 62 30, 92 40 Z' }
          : { d: 'M 92 30 C 126 20, 160 50, 158 88 C 156 126, 136 162, 92 165 C 48 162, 30 128, 30 90 C 30 52, 60 20, 92 30 Z' }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
    </>
  );
}

function SplitBody({ gradId, isAsleep }: BodyProps) {
  return (
    <motion.path
      d="M 100 20 C 128 20, 148 40, 148 68 C 148 92, 136 106, 118 116 C 138 124, 164 140, 164 162 C 164 182, 142 196, 100 196 C 58 196, 36 182, 36 162 C 36 140, 62 124, 82 116 C 64 106, 52 92, 52 68 C 52 40, 72 20, 100 20 Z"
      fill={`url(#${gradId})`}
      animate={isAsleep
        ? { d: 'M 100 28 C 126 28, 144 46, 144 72 C 144 94, 134 108, 116 118 C 136 126, 160 142, 160 162 C 160 180, 140 192, 100 192 C 60 192, 40 180, 40 162 C 40 142, 64 126, 84 118 C 66 108, 56 94, 56 72 C 56 46, 74 28, 100 28 Z' }
        : { d: 'M 100 20 C 128 20, 148 40, 148 68 C 148 92, 136 106, 118 116 C 138 124, 164 140, 164 162 C 164 182, 142 196, 100 196 C 58 196, 36 182, 36 162 C 36 140, 62 124, 82 116 C 64 106, 52 92, 52 68 C 52 40, 72 20, 100 20 Z' }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    />
  );
}

function BearBody({ gradId, c, isAsleep }: BodyProps) {
  return (
    <>
      {/* Ears + paws behind body */}
      <circle cx={52} cy={54} r={24} fill={c.body2} />
      <circle cx={148} cy={54} r={24} fill={c.body2} />
      <circle cx={52} cy={54} r={15} fill={c.cheek} opacity={0.45} />
      <circle cx={148} cy={54} r={15} fill={c.cheek} opacity={0.45} />
      <ellipse cx={20} cy={132} rx={16} ry={14} fill={c.body2} />
      <ellipse cx={180} cy={132} rx={16} ry={14} fill={c.body2} />
      {/* Body */}
      <motion.path
        d="M 100 56 C 140 46, 170 70, 170 108 C 170 148, 148 175, 100 175 C 52 175, 30 148, 30 108 C 30 70, 60 46, 100 56 Z"
        fill={`url(#${gradId})`}
        animate={isAsleep
          ? { d: 'M 100 64 C 138 54, 164 76, 162 110 C 160 144, 140 168, 100 168 C 60 168, 38 144, 38 110 C 38 78, 62 54, 100 64 Z' }
          : { d: 'M 100 56 C 140 46, 170 70, 170 108 C 170 148, 148 175, 100 175 C 52 175, 30 148, 30 108 C 30 70, 60 46, 100 56 Z' }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
    </>
  );
}

function BodyRenderer({ shapeId, gradId, c, isAsleep }: BodyProps & { shapeId: BodyShapeId }) {
  const props = { gradId, c, isAsleep };
  switch (shapeId) {
    case 'cat':    return <CatBody    {...props} />;
    case 'chunky': return <ChunkyBody {...props} />;
    case 'tall':   return <TallBody   {...props} />;
    case 'tailed': return <TailedBody {...props} />;
    case 'split':  return <SplitBody  {...props} />;
    case 'bear':   return <BearBody   {...props} />;
    default:       return <BlobBody   {...props} />;
  }
}

// ─── Level accessories ────────────────────────────────────────────────────────

function LevelAccessory({ level }: { level: number }) {
  if (level >= 21) return <text x="100" y="22" fontSize="22" textAnchor="middle">🪽</text>;
  if (level >= 16) return <text x="100" y="24" fontSize="20" textAnchor="middle">😇</text>;
  if (level >= 11) return <text x="100" y="24" fontSize="18" textAnchor="middle">👑</text>;
  if (level >= 6)  return <text x="100" y="26" fontSize="16" textAnchor="middle">🎩</text>;
  return null;
}

// ─── Glitch hook ──────────────────────────────────────────────────────────────

function useGlitch(enabled: boolean) {
  const [xy, setXy] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      if (Math.random() < 0.15) {
        setXy({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 5 });
        setTimeout(() => setXy({ x: 0, y: 0 }), 80);
      }
    }, 200);
    return () => clearInterval(t);
  }, [enabled]);
  return xy;
}

// ─── PetDisplay ──────────────────────────────────────────────────────────────

export function PetDisplay({ pet, moodOverride }: Props) {
  const equippedSkinId     = usePetStore(s => s.equippedSkinId);
  const equippedBodyId     = usePetStore(s => s.equippedBodyId);
  const colorOverride      = usePetStore(s => s.petColorOverride);
  const petMorph           = usePetStore(s => s.petMorph);
  const equippedAuraId     = usePetStore(s => s.equippedAuraId);
  const equippedAccessories = usePetStore(s => s.equippedAccessories);
  const accessoryConfigs   = usePetStore(s => s.accessoryConfigs);
  const eyeStyleOverride   = usePetStore(s => s.eyeStyleOverride);
  const overlayOverride    = usePetStore(s => s.overlayOverride);
  const setAccessoryConfig = usePetStore(s => s.setAccessoryConfig);
  const isEditor           = usePetStore(s => s.activeTab) === 'editor';

  const baseSkin = getSkin(equippedSkinId);
  const skin: SkinDefinition = {
    ...baseSkin,
    eyeStyle: (eyeStyleOverride as EyeStyle) ?? baseSkin.eyeStyle,
    overlay:  (overlayOverride  as OverlayStyle) ?? baseSkin.overlay,
  };
  const shape = getBodyShape(equippedBodyId);
  const aura  = getAura(equippedAuraId);

  const headAcc = getAccessory(equippedAccessories.head);
  const faceAcc = getAccessory(equippedAccessories.face);
  const backAcc = getAccessory(equippedAccessories.back);

  const glitch = useGlitch(skin.animStyle === 'glitch');
  const [hue, setHue] = useState(0);

  useEffect(() => {
    if (skin.animStyle !== 'rainbow') return;
    const t = setInterval(() => setHue(h => (h + 1) % 360), 30);
    return () => clearInterval(t);
  }, [skin.animStyle]);

  const effectiveMood = moodOverride ?? pet.mood;
  const showCheeks = ['ecstatic', 'happy', 'content'].includes(effectiveMood);
  const baseGlow  = skin.animStyle === 'rainbow' ? `hsl(${hue},90%,60%)` : skin.colors.glow;
  const baseBody1 = skin.animStyle === 'rainbow' ? `hsl(${hue},65%,72%)` : skin.colors.body1;
  const baseBody2 = skin.animStyle === 'rainbow' ? `hsl(${(hue + 120) % 360},65%,50%)` : skin.colors.body2;

  const glowColor = colorOverride?.glow  ?? baseGlow;
  const body1     = colorOverride?.body1 ?? baseBody1;
  const body2     = colorOverride?.body2 ?? baseBody2;

  const floatAnim = pet.isAsleep
    ? { y: [0, -4, 0] as number[], transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const } }
    : skin.animStyle === 'pulse'
    ? { scale: [1, 1.04, 1] as number[], transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const } }
    : skin.animStyle === 'wobble'
    ? { rotate: [0, 2, -2, 0] as number[], transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const } }
    : skin.animStyle === 'wave'
    ? { y: [0, -8, 2, -8, 0] as number[], transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const } }
    : skin.animStyle === 'spark'
    ? { y: [0, -14, -10, -14, 0] as number[], transition: { duration: 0.7, repeat: Infinity, ease: 'easeInOut' as const } }
    : { y: [0, -10, 0] as number[], transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const } };

  const gradId = `bg_${skin.id}`;
  const colors = { body1, body2, glow: glowColor, cheek: colorOverride?.cheek ?? skin.colors.cheek };

  const mouthPath = getMouthPath(effectiveMood, shape.mouthCy, shape.mouthHW);

  const morphStyle: React.CSSProperties = (petMorph.scale !== 1 || petMorph.width !== 1 || petMorph.height !== 1)
    ? { transform: `scale(${petMorph.scale}) scaleX(${petMorph.width}) scaleY(${petMorph.height})` }
    : {};

  return (
    <div className="relative" style={{ ...morphStyle, isolation: 'isolate' }}>
      <PetAura aura={aura} />
      <motion.div
        className="relative"
        style={{ zIndex: 1, x: glitch.x, translateY: glitch.y }}
        animate={floatAnim}
      >
        <svg viewBox="0 0 200 200" width="220" height="220"
          style={{ filter: `drop-shadow(0 0 28px ${glowColor}99) drop-shadow(0 4px 14px ${glowColor}55)`, overflow: 'visible' }}>
          <defs>
            <radialGradient id={gradId} cx="76" cy="60" r="130" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={body1} />
              <stop offset="100%" stopColor={body2} />
            </radialGradient>
            <linearGradient id="rainbow_grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#FF0080" />
              <stop offset="33%"  stopColor="#00FF80" />
              <stop offset="66%"  stopColor="#0080FF" />
              <stop offset="100%" stopColor="#FF0080" />
            </linearGradient>
          </defs>

          {/* Back accessories rendered behind body */}
          {backAcc && backAcc.id !== 'none_back' && backAcc.behindBody && (
            <motion.text
              drag={isEditor} dragMomentum={false}
              onDragEnd={(e, info) => setAccessoryConfig('back', { ...accessoryConfigs.back, x: accessoryConfigs.back.x + info.offset.x, y: accessoryConfigs.back.y + info.offset.y })}
              initial={{ x: accessoryConfigs.back.x, y: accessoryConfigs.back.y }}
              animate={{ x: accessoryConfigs.back.x, y: accessoryConfigs.back.y }}
              whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
              style={{ cursor: isEditor ? 'grab' : 'auto', filter: `drop-shadow(0 0 8px ${glowColor}88)` }}
              x={100}
              y={130}
              fontSize={52 * accessoryConfigs.back.scale}
              textAnchor="middle" dominantBaseline="middle">
              {backAcc.emoji}
            </motion.text>
          )}

          <BodyRenderer shapeId={equippedBodyId} gradId={gradId} c={colors} isAsleep={pet.isAsleep} />

          <Overlay skin={skin} />

          {/* Back accessories rendered in front of body */}
          {backAcc && backAcc.id !== 'none_back' && !backAcc.behindBody && (
            <motion.text
              drag={isEditor} dragMomentum={false}
              onDragEnd={(e, info) => setAccessoryConfig('back', { ...accessoryConfigs.back, x: accessoryConfigs.back.x + info.offset.x, y: accessoryConfigs.back.y + info.offset.y })}
              initial={{ x: accessoryConfigs.back.x, y: accessoryConfigs.back.y }}
              animate={{ x: accessoryConfigs.back.x, y: accessoryConfigs.back.y }}
              whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
              style={{ cursor: isEditor ? 'grab' : 'auto', filter: `drop-shadow(0 0 6px ${glowColor}88)` }}
              x={162}
              y={112}
              fontSize={28 * accessoryConfigs.back.scale}
              textAnchor="middle" dominantBaseline="middle">
              {backAcc.emoji}
            </motion.text>
          )}

          {/* Cheeks */}
          <AnimatePresence>
            {showCheeks && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ellipse cx={shape.cheekLeft.cx}  cy={shape.cheekLeft.cy}  rx={shape.cheekLeft.rx}  ry={shape.cheekLeft.ry}  fill={skin.colors.cheek} opacity={0.55} />
                <ellipse cx={shape.cheekRight.cx} cy={shape.cheekRight.cy} rx={shape.cheekRight.rx} ry={shape.cheekRight.ry} fill={skin.colors.cheek} opacity={0.55} />
              </motion.g>
            )}
          </AnimatePresence>

          <Eyes skin={skin} shapeId={equippedBodyId} mood={effectiveMood} />

          {/* Face accessories */}
          {faceAcc && faceAcc.id !== 'none_face' && (
            <motion.text
              drag={isEditor} dragMomentum={false}
              onDragEnd={(e, info) => setAccessoryConfig('face', { ...accessoryConfigs.face, x: accessoryConfigs.face.x + info.offset.x, y: accessoryConfigs.face.y + info.offset.y })}
              initial={{ x: accessoryConfigs.face.x, y: accessoryConfigs.face.y }}
              animate={{ x: accessoryConfigs.face.x, y: accessoryConfigs.face.y }}
              whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
              style={{ cursor: isEditor ? 'grab' : 'auto', filter: `drop-shadow(0 0 6px ${glowColor}88)` }}
              x={100}
              y={86}
              fontSize={30 * accessoryConfigs.face.scale}
              textAnchor="middle" dominantBaseline="middle">
              {faceAcc.emoji}
            </motion.text>
          )}

          {/* Mouth */}
          <motion.path
            d={mouthPath}
            stroke={['led','hologram'].includes(skin.eyeStyle) ? skin.eyeColor : 'white'}
            strokeWidth="3.5" fill="none" strokeLinecap="round"
            animate={{ d: mouthPath }} transition={{ duration: 0.4 }}
          />

          {/* Head accessories */}
          {headAcc && headAcc.id !== 'none_head' && (
            <motion.text
              drag={isEditor} dragMomentum={false}
              onDragEnd={(e, info) => setAccessoryConfig('head', { ...accessoryConfigs.head, x: accessoryConfigs.head.x + info.offset.x, y: accessoryConfigs.head.y + info.offset.y })}
              initial={{ x: accessoryConfigs.head.x, y: accessoryConfigs.head.y }}
              animate={{ x: accessoryConfigs.head.x, y: accessoryConfigs.head.y }}
              whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
              style={{ cursor: isEditor ? 'grab' : 'auto', filter: `drop-shadow(0 0 6px ${glowColor}88)` }}
              x={100}
              y={14}
              fontSize={26 * accessoryConfigs.head.scale}
              textAnchor="middle" dominantBaseline="middle">
              {headAcc.emoji}
            </motion.text>
          )}

          <LevelAccessory level={pet.level} />

          {/* Zzz */}
          {pet.isAsleep && (
            <g>
              {[0, 1, 2].map(i => (
                <motion.text key={i} x={145 + i * 10} y={50 - i * 14} fontSize={10 + i * 5}
                  fill={skin.colors.glow} fontWeight="700" fontFamily="Space Grotesk"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [55 - i * 14, 50 - i * 14, 40 - i * 14, 30 - i * 14] }}
                  transition={{ duration: 2.5, delay: i * 0.6, repeat: Infinity, repeatDelay: 1 }}>
                  z
                </motion.text>
              ))}
            </g>
          )}

          {/* Ecstatic sparkles */}
          {effectiveMood === 'ecstatic' && [[145, 45], [160, 72], [148, 60]].map(([x, y], i) => (
            <motion.text key={i} x={x} y={y} fontSize={12} textAnchor="middle"
              animate={{ opacity: [0, 1, 0], y: [y, y - 12, y - 22], scale: [0.5, 1.2, 0.5] }}
              transition={{ duration: 1.5, delay: i * 0.28, repeat: Infinity, repeatDelay: 0.6 }}>
              ✨
            </motion.text>
          ))}
        </svg>
      </motion.div>
    </div>
  );
}
