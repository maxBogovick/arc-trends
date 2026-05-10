import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { Pet, PetMood } from '../../api';
import { getSkin, type SkinDefinition, type EyeStyle, type OverlayStyle } from '../../data/skins';
import { type BodyShapeId } from '../../data/bodyShapes';
import { getHead, type HeadId, type EarsId, type BodyPartId, type LimbsId, type ArmsId, type LegsId, type TailId, type NoseId, type MouthStyleId, type PartColorKey } from '../../data/petParts';
import { getAccessory } from '../../data/accessories';
import { getAura } from '../../data/auras';
import { usePetStore } from '../../store/petStore';
import { PetAura } from './PetAura';
import { HeadShape, EarsShape, BodyShape, ArmsShape, LegsShape, TailShape, NoseShape, MouthShape, OutfitShape } from './ModularBody';

interface Props {
  pet: Pet;
  moodOverride?: PetMood;
  size?: number;
  overrideState?: {
    gradientDirection?: 'radial' | 'vertical' | 'horizontal' | 'diagonal' | 'diagonal_reverse';
    equippedNoseId?: NoseId;
    equippedMouthStyleId?: MouthStyleId;
    equippedSkinId?: string;
    equippedBodyId?: BodyShapeId;
    equippedHeadId?: HeadId;
    equippedEarsId?: EarsId;
    equippedBodyPartId?: BodyPartId;
    equippedLimbsId?: LimbsId;
    equippedArmsId?: ArmsId;
    equippedLegsId?: LegsId;
    equippedTailId?: TailId;
    partColors?: Record<PartColorKey, string | null>;
    gradientEnabled?: boolean;
    equippedOutfitId?: string;
    outfitColor?: string;
    outfitColor2?: string;
    petColorOverride?: any;
    petMorph?: any;
    equippedAuraId?: string;
    equippedAccessories?: any;
    accessoryConfigs?: any;
    eyeStyleOverride?: string | null;
    eyeColorOverride?: string | null;
    overlayOverride?: string | null;
  } | null;
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

function EyeCute({ cx, cy, color, mood }: EyeProps) {
  const off = cx < 100 ? 3 : -3;
  if (mood === 'sleeping')
    return <path d={`M ${cx - 13} ${cy} Q ${cx} ${cy - 8} ${cx + 13} ${cy}`} stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />;
  if (mood === 'sick')
    return (
      <g>
        <circle cx={cx} cy={cy} r={14} fill="white" />
        <line x1={cx - 7} y1={cy - 6} x2={cx + 7} y2={cy + 6} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        <line x1={cx + 7} y1={cy - 6} x2={cx - 7} y2={cy + 6} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    );
  return (
    <g>
      <motion.circle cx={cx} cy={cy} r={14} fill="white"
        animate={{ scaleY: [1, 1, 1, 0.07, 1] }} transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 1.5 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }} />
      <circle cx={cx + off * 0.3} cy={cy + 2} r={9} fill={color} />
      <circle cx={cx + off * 0.3 - 2} cy={cy - 3} r={3} fill="white" />
      <circle cx={cx + off * 0.3 + 3} cy={cy + 3} r={1.5} fill="white" opacity={0.7} />
      {/* Star shine */}
      <motion.g animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.8, repeat: Infinity }}>
        <line x1={cx + off * 0.3 - 5} y1={cy - 8} x2={cx + off * 0.3 + 5} y2={cy - 8} stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1={cx + off * 0.3} y1={cy - 13} x2={cx + off * 0.3} y2={cy - 3} stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </motion.g>
    </g>
  );
}

function EyePixel({ cx, cy, color }: EyeProps) {
  const px = 4;
  return (
    <g>
      {/* 3×3 pixel grid eye */}
      {[[-1,0],[0,-1],[1,0],[0,1],[0,0],[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx, dy], i) => (
        <rect key={i}
          x={cx + dx * px - px / 2} y={cy + dy * px - px / 2}
          width={px} height={px}
          fill={i === 4 ? color : i < 4 ? color : 'rgba(255,255,255,0.15)'}
          opacity={i === 4 ? 1 : i < 4 ? 0.9 : 0.3}
        />
      ))}
      {/* pupil highlight */}
      <rect x={cx - 1} y={cy - 3} width={2} height={2} fill="white" opacity={0.8} />
    </g>
  );
}

function EyeClosed({ cx, cy, color }: EyeProps) {
  const off = cx < 100 ? -1 : 1;
  return (
    <g>
      <path d={`M ${cx - 13} ${cy} Q ${cx + off * 3} ${cy - 10} ${cx + 13} ${cy}`}
        stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d={`M ${cx - 10} ${cy + 2} Q ${cx + off * 2} ${cy - 5} ${cx + 10} ${cy + 2}`}
        stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={0.4} />
    </g>
  );
}

function EyeWink({ cx, cy, color, mood }: EyeProps) {
  const isLeft = cx < 100;
  if (isLeft) {
    // Left eye = closed wink
    return (
      <g>
        <path d={`M ${cx - 12} ${cy} Q ${cx} ${cy - 9} ${cx + 12} ${cy}`}
          stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  // Right eye = cute open
  return <EyeCute cx={cx} cy={cy} color={color} mood={mood} />;
}

function Eyes({ eyeStyle, eyeColor, head, mood }: { eyeStyle: EyeStyle; eyeColor: string; head: ReturnType<typeof getHead>; mood: PetMood }) {
  const positions: EyeProps[] = [
    { ...head.eyeLeft,  color: eyeColor, mood },
    { ...head.eyeRight, color: eyeColor, mood },
  ];
  return (
    <>
      {positions.map((p, i) => {
        const k = i;
        switch (eyeStyle) {
          case 'led':      return <EyeLED      key={k} {...p} />;
          case 'spiral':   return <EyeSpiral   key={k} {...p} />;
          case 'slit':     return <EyeSlit     key={k} {...p} />;
          case 'crystal':  return <EyeCrystal  key={k} {...p} />;
          case 'bubble':   return <EyeBubble   key={k} {...p} />;
          case 'cross':    return <EyeCross    key={k} {...p} />;
          case 'star':     return <EyeStar     key={k} {...p} />;
          case 'lens':     return <EyeLens     key={k} {...p} />;
          case 'hologram': return <EyeHologram key={k} {...p} />;
          case 'cute':     return <EyeCute     key={k} {...p} />;
          case 'pixel':    return <EyePixel    key={k} {...p} />;
          case 'closed':   return <EyeClosed   key={k} {...p} />;
          case 'wink':     return <EyeWink     key={k} {...p} />;
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

export function PetDisplay({ pet, moodOverride, size = 220, overrideState }: Props) {
  const store = usePetStore();

  const gradientDirection   = overrideState?.gradientDirection   ?? store.gradientDirection;
  const equippedNoseId      = (overrideState?.equippedNoseId      ?? store.equippedNoseId)      as NoseId;
  const equippedMouthStyleId = (overrideState?.equippedMouthStyleId ?? store.equippedMouthStyleId) as MouthStyleId;
  const equippedSkinId      = overrideState?.equippedSkinId      ?? store.equippedSkinId;
  const equippedBodyId      = overrideState?.equippedBodyId      ?? store.equippedBodyId;
  const equippedHeadId      = overrideState?.equippedHeadId      ?? store.equippedHeadId;
  const equippedEarsId      = overrideState?.equippedEarsId      ?? store.equippedEarsId;
  const equippedBodyPartId  = overrideState?.equippedBodyPartId  ?? store.equippedBodyPartId;
  const equippedLimbsId     = overrideState?.equippedLimbsId     ?? store.equippedLimbsId;
  const equippedArmsId      = (overrideState?.equippedArmsId      ?? store.equippedArmsId)      as ArmsId;
  const equippedLegsId      = (overrideState?.equippedLegsId      ?? store.equippedLegsId)      as LegsId;
  const equippedTailId      = overrideState?.equippedTailId      ?? store.equippedTailId;
  const partColors          = overrideState?.partColors          ?? store.partColors;
  const gradientEnabled     = overrideState?.gradientEnabled     ?? store.gradientEnabled;
  const equippedOutfitId    = (overrideState?.equippedOutfitId   ?? store.equippedOutfitId) as import('../../data/petParts').OutfitId;
  const outfitColor         = overrideState?.outfitColor         ?? store.outfitColor;
  const outfitColor2        = overrideState?.outfitColor2        ?? store.outfitColor2;
  const petColorOverride    = overrideState?.petColorOverride    ?? store.petColorOverride;
  const petMorph            = overrideState?.petMorph           ?? store.petMorph;
  const equippedAuraId      = overrideState?.equippedAuraId      ?? store.equippedAuraId;
  const equippedAccessories = overrideState?.equippedAccessories ?? store.equippedAccessories;
  const accessoryConfigs    = overrideState?.accessoryConfigs   ?? store.accessoryConfigs;
  const eyeStyleOverride    = overrideState?.eyeStyleOverride   ?? store.eyeStyleOverride;
  const eyeColorOverride    = overrideState?.eyeColorOverride   ?? store.eyeColorOverride;
  const overlayOverride     = overrideState?.overlayOverride    ?? store.overlayOverride;
  
  const setAccessoryConfig  = store.setAccessoryConfig;
  const recordHistory       = store.recordHistory;
  const isEditor            = store.activeTab === 'editor';

  const renderAccessory = (slot: 'head' | 'face' | 'back' | 'neck' | 'clothing', behind: boolean) => {
    const id = equippedAccessories[slot];
    const acc = getAccessory(id);
    const config = accessoryConfigs[slot];
    if (!acc || id.startsWith('none') || config.behind !== behind) return null;

    let bx = 100, by = 0, bs = 26;
    if (slot === 'head')     { by = 14;  bs = 26; }
    if (slot === 'face')     { by = 86;  bs = 30; }
    if (slot === 'neck')     { by = 126; bs = 22; }
    if (slot === 'clothing') { by = 152; bs = 48; }
    if (slot === 'back') {
      if (behind) { bx = 100; by = 130; bs = 52; }
      else        { bx = 162; by = 112; bs = 28; }
    }

    return (
      <motion.text
        key={`${slot}-${id}`}
        drag={isEditor} dragMomentum={false}
        onDragStart={() => recordHistory()}
        onDragEnd={(_, info) => setAccessoryConfig(slot, { ...config, x: config.x + info.offset.x, y: config.y + info.offset.y })}
        initial={{ x: config.x, y: config.y, rotate: config.rotation }}
        animate={{ x: config.x, y: config.y, rotate: config.rotation }}
        whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
        style={{ cursor: isEditor ? 'grab' : 'auto', filter: `drop-shadow(0 0 6px ${glowColor}88)` }}
        x={bx} y={by}
        fontSize={bs * config.scale}
        textAnchor="middle" dominantBaseline="middle">
        {acc.emoji}
      </motion.text>
    );
  };

  const baseSkin = getSkin(equippedSkinId);
  const skin: SkinDefinition = {
    ...baseSkin,
    eyeStyle: (eyeStyleOverride as EyeStyle) ?? baseSkin.eyeStyle,
    eyeColor: eyeColorOverride ?? baseSkin.eyeColor,
    overlay:  (overlayOverride  as OverlayStyle) ?? baseSkin.overlay,
  };
  const head  = getHead(equippedHeadId);
  const aura  = getAura(equippedAuraId);
  // Keep for backwards compat with any code still reading equippedBodyId
  void equippedBodyId;

  const glitch = useGlitch(skin.animStyle === 'glitch');
  const [hue, setHue] = useState(0);

  useEffect(() => {
    if (skin.animStyle !== 'rainbow') return;
    const t = setInterval(() => setHue(h => (h + 1) % 360), 30);
    return () => clearInterval(t);
  }, [skin.animStyle]);

  const effectiveMood = moodOverride ?? pet?.mood ?? 'happy';
  const baseGlow  = skin.animStyle === 'rainbow' ? `hsl(${hue},90%,60%)` : skin.colors.glow;
  const baseBody1 = skin.animStyle === 'rainbow' ? `hsl(${hue},65%,72%)` : skin.colors.body1;
  const baseBody2 = skin.animStyle === 'rainbow' ? `hsl(${(hue + 120) % 360},65%,50%)` : skin.colors.body2;

  const glowColor = petColorOverride?.glow  ?? baseGlow;
  const body1     = petColorOverride?.body1 ?? baseBody1;
  const body2     = petColorOverride?.body2 ?? baseBody2;

  const floatAnim = pet?.isAsleep
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
  const colors = { body1, body2, glow: glowColor, cheek: petColorOverride?.cheek ?? skin.colors.cheek };

  const getFill = (part: PartColorKey): string | undefined => {
    const override = partColors?.[part];
    if (override) return override;
    if (gradientEnabled === false) return body1;
    return undefined; // use gradient url
  };

  const mouthPath = getMouthPath(effectiveMood, head.mouthCy, head.mouthHW) || "";

  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    setShowSparkles(true);
    const t = setTimeout(() => setShowSparkles(false), 800);
    return () => clearTimeout(t);
  }, [equippedSkinId, equippedHeadId, equippedEarsId, equippedBodyPartId, equippedArmsId, equippedLegsId, equippedTailId, JSON.stringify(equippedAccessories), petColorOverride]);

  const morphStyle: React.CSSProperties = (petMorph.scale !== 1 || petMorph.width !== 1 || petMorph.height !== 1)
    ? { transform: `scale(${petMorph.scale}) scaleX(${petMorph.width}) scaleY(${petMorph.height})` }
    : {};
  const headSc   = petMorph.headScale  ?? 1;
  const earsSc   = petMorph.earsScale  ?? 1;
  const limbsSc  = petMorph.limbsScale ?? 1;
  const squishSc = petMorph.squish     ?? 1;

  return (
    <div className="relative" style={{ ...morphStyle, isolation: 'isolate' }}>
      <PetAura aura={aura} />
      <motion.div
        className="relative"
        style={{ zIndex: 1, x: glitch.x, translateY: glitch.y }}
        animate={floatAnim}
      >
        <svg viewBox="0 0 200 200" width={size} height={size}
          data-pet-export="true"
          style={{ filter: equippedSkinId === 'default' ? 'none' : `drop-shadow(0 0 28px ${glowColor}99) drop-shadow(0 4px 14px ${glowColor}55)`, overflow: 'visible' }}>
          <defs>
            {gradientDirection === 'radial' ? (
              <radialGradient id={gradId} cx="76" cy="60" r="130" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={body1} />
                <stop offset="100%" stopColor={body2} />
              </radialGradient>
            ) : (
              <linearGradient id={gradId}
                x1={gradientDirection === 'horizontal' ? '0%' : gradientDirection === 'diagonal' ? '0%' : gradientDirection === 'diagonal_reverse' ? '100%' : '0%'}
                y1={gradientDirection === 'vertical' ? '0%' : gradientDirection === 'diagonal' ? '0%' : gradientDirection === 'diagonal_reverse' ? '0%' : '0%'}
                x2={gradientDirection === 'horizontal' ? '100%' : gradientDirection === 'diagonal' ? '100%' : gradientDirection === 'diagonal_reverse' ? '0%' : '0%'}
                y2={gradientDirection === 'vertical' ? '100%' : gradientDirection === 'diagonal' ? '100%' : gradientDirection === 'diagonal_reverse' ? '100%' : '100%'}
              >
                <stop offset="0%" stopColor={body1} />
                <stop offset="100%" stopColor={body2} />
              </linearGradient>
            )}
            <linearGradient id="rainbow_grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#FF0080" />
              <stop offset="33%"  stopColor="#00FF80" />
              <stop offset="66%"  stopColor="#0080FF" />
              <stop offset="100%" stopColor="#FF0080" />
            </linearGradient>
          </defs>

          {/* Layer: Behind body */}
          {renderAccessory('back', true)}
          {renderAccessory('head', true)}
          {renderAccessory('face', true)}

          {/* Modular pet body — layers from back to front */}
          <g transform={`translate(175,150) scale(${limbsSc}) translate(-175,-150)`}>
            <TailShape  id={equippedTailId}  gradId={gradId} c={colors} overrideFill={getFill('tail')} />
          </g>
          <g transform={`translate(100,190) scale(${limbsSc},${squishSc}) translate(-100,-190)`}>
            <LegsShape id={equippedLegsId} gradId={gradId} c={colors} overrideFill={getFill('legs')} />
          </g>
          <g transform={`translate(100,150) scale(${limbsSc},${squishSc}) translate(-100,-150)`}>
            <ArmsShape id={equippedArmsId !== 'none' ? equippedArmsId : (equippedLimbsId as ArmsId)} gradId={gradId} c={colors} overrideFill={getFill('arms')} />
          </g>
          <g transform={`translate(100,45) scale(${earsSc}) translate(-100,-45)`}>
            <EarsShape  id={equippedEarsId}  gradId={gradId} c={colors} overrideFill={getFill('ears')} />
          </g>
          <g transform={`translate(100,152) scale(${squishSc},1) translate(-100,-152)`}>
            <BodyShape  id={equippedBodyPartId} gradId={gradId} c={colors} overrideFill={getFill('body')} />
          </g>
          <OutfitShape id={equippedOutfitId} primary={outfitColor} secondary={outfitColor2} />

          <g transform={`translate(100,80) scale(${headSc}) translate(-100,-80)`}>
            <HeadShape  id={equippedHeadId}  gradId={gradId} c={colors} overrideFill={getFill('head')} />
          </g>
          <Overlay skin={skin} />

          {/* Nose */}
          {equippedNoseId !== 'none' && (
            <NoseShape id={equippedNoseId} cy={head.mouthCy - 14} color={skin.eyeColor} />
          )}

          <Eyes eyeStyle={skin.eyeStyle} eyeColor={skin.eyeColor} head={head} mood={effectiveMood} />

          {/* Mouth */}
          {equippedMouthStyleId === 'auto' ? (
            mouthPath && (
              <motion.path
                d={mouthPath}
                stroke={['led','hologram'].includes(skin.eyeStyle) ? skin.eyeColor : 'white'}
                strokeWidth="3.5" fill="none" strokeLinecap="round"
                animate={{ d: mouthPath }} transition={{ duration: 0.4 }}
              />
            )
          ) : (
            <MouthShape
              id={equippedMouthStyleId}
              cy={head.mouthCy}
              hw={head.mouthHW}
              strokeColor={['led','hologram'].includes(skin.eyeStyle) ? skin.eyeColor : 'white'}
            />
          )}

          <LevelAccessory level={pet.level} />

          {/* Clothing (behind body) */}
          {renderAccessory('clothing', true)}

          {/* Layer: Topmost Accessories (In front of everything) */}
          {renderAccessory('clothing', false)}
          {renderAccessory('neck', false)}
          {renderAccessory('back', false)}
          {renderAccessory('head', false)}
          {renderAccessory('face', false)}

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
          {/* Change sparkles burst */}
          <AnimatePresence>
            {showSparkles && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[...Array(6)].map((_, i) => {
                  const angle = (i * Math.PI * 2) / 6;
                  const dist = 60;
                  return (
                    <motion.text
                      key={i}
                      x={100}
                      y={100}
                      fontSize={14}
                      textAnchor="middle"
                      initial={{ x: 100, y: 100, scale: 0 }}
                      animate={{ 
                        x: 100 + Math.cos(angle) * dist, 
                        y: 100 + Math.sin(angle) * dist,
                        scale: [0, 1.5, 0],
                        rotate: [0, 90, 180]
                      }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                      ✨
                    </motion.text>
                  );
                })}
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      </motion.div>
    </div>
  );
}
