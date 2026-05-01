import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { usePetStore } from '../store/petStore';
import { SKINS, getSkin, type SkinDefinition, type EyeStyle, type OverlayStyle } from '../data/skins';
import { BODY_SHAPES, type BodyShapeId, type BodyShapeDefinition } from '../data/bodyShapes';
import { BACKGROUNDS, type BackgroundDefinition } from '../data/backgrounds';
import { PALETTES, type PetColors } from '../data/palettes';
import type { ItemRarity } from '../api';

type PageTab = 'body' | 'color' | 'skin' | 'bg';

const PAGE_TABS: { id: PageTab; label: string }[] = [
  { id: 'body',  label: '🧬 Форма' },
  { id: 'color', label: '🎨 Цвет'  },
  { id: 'skin',  label: '✨ Скин'  },
  { id: 'bg',    label: '🌌 Фон'   },
];

// ─── Rarity config ────────────────────────────────────────────────────────────

const RARITY: Record<ItemRarity, { label: string; color: string; glow: string; border: string }> = {
  common: { label: 'Стартовый', color: '#94A3B8', glow: '#9CA3AF44', border: '#334155' },
  rare: { label: 'Редкий', color: '#3B82F6', glow: '#93C5FD55', border: '#93C5FD' },
  epic: { label: 'Эпический', color: '#8B5CF6', glow: '#A78BFA55', border: '#C4B5FD' },
  legendary: { label: 'Легендарный', color: '#F59E0B', glow: '#FCD34D77', border: '#FCD34D' },
};

// ─── Mini eye renderers ───────────────────────────────────────────────────────

function MiniEye({ style, color, cx, cy }: { style: EyeStyle; color: string; cx: number; cy: number }) {
  switch (style) {
    case 'led':
      return (
        <g>
          <rect x={cx - 9} y={cy - 4} width={18} height={8} rx={2} fill="#001833" />
          <rect x={cx - 8} y={cy - 3} width={16} height={6} rx={1.5} fill={color} opacity={0.9} />
        </g>
      );
    case 'spiral':
      return (
        <g>
          <circle cx={cx} cy={cy} r={9} fill="#0D0020" />
          <circle cx={cx} cy={cy} r={7} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="10 5" />
          <circle cx={cx} cy={cy} r={2} fill={color} />
        </g>
      );
    case 'slit':
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={9} ry={8} fill="#1A0500" />
          <ellipse cx={cx} cy={cy} rx={2.5} ry={7} fill={color} />
        </g>
      );
    case 'crystal': {
      const pts = `${cx},${cy - 9} ${cx + 8},${cy} ${cx},${cy + 9} ${cx - 8},${cy}`;
      return (
        <g>
          <polygon points={pts} fill={color} opacity={0.9} />
          <polygon points={pts} fill="none" stroke="white" strokeWidth={0.8} opacity={0.5} />
        </g>
      );
    }
    case 'bubble':
      return (
        <g>
          <circle cx={cx - 3} cy={cy + 1} r={6} fill={color} opacity={0.7} />
          <circle cx={cx + 3} cy={cy - 1} r={5} fill={color} opacity={0.9} />
          <circle cx={cx + 3} cy={cy - 1} r={2} fill="white" opacity={0.5} />
        </g>
      );
    case 'cross':
      return (
        <g>
          <circle cx={cx} cy={cy} r={9} fill="rgba(0,0,0,0.5)" />
          <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={2.5} fill={color} />
        </g>
      );
    case 'star': {
      let d = '';
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 9 : 4;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        d += `${i === 0 ? 'M' : 'L'} ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} `;
      }
      return <path d={d + 'Z'} fill={color} opacity={0.9} />;
    }
    case 'lens':
      return (
        <g>
          <circle cx={cx} cy={cy} r={9} fill="#001020" />
          {[7, 5, 3].map(r => (
            <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1} opacity={0.5 + (9 - r) * 0.1} />
          ))}
          <circle cx={cx} cy={cy} r={1.5} fill={color} />
        </g>
      );
    case 'hologram':
      return (
        <g>
          <rect x={cx - 9} y={cy - 7} width={18} height={14} rx={3} fill="rgba(0,0,20,0.85)" />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fontFamily="monospace" fontWeight="bold" fill={color}>◈</text>
        </g>
      );
    default:
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={8} ry={9} fill="white" />
          <circle cx={cx} cy={cy + 1} r={5} fill={color} />
          <circle cx={cx + 2} cy={cy - 2} r={2} fill="white" />
        </g>
      );
  }
}

// ─── Mini overlay ─────────────────────────────────────────────────────────────

function MiniOverlay({ overlay, color }: { overlay: OverlayStyle; color: string }) {
  switch (overlay) {
    case 'circuits':
      return (
        <g opacity={0.3} stroke={color} fill="none" strokeWidth={0.8}>
          <path d="M 20 38 H 36 V 30" /><path d="M 80 36 H 64 V 28" />
          <circle cx={36} cy={30} r={2} fill={color} /><circle cx={64} cy={28} r={2} fill={color} />
        </g>
      );
    case 'cracks':
      return (
        <g>
          <path d="M 45 28 L 40 44 L 48 47 L 42 62" stroke={color} strokeWidth={1} fill="none" opacity={0.7} />
          <path d="M 60 26 L 63 42 L 56 45 L 60 60" stroke={color} strokeWidth={1} fill="none" opacity={0.6} />
        </g>
      );
    case 'frost':
      return (
        <g opacity={0.4} stroke={color} fill="none" strokeWidth={0.7}>
          {([[30, 32, 8], [70, 34, 6], [35, 80, 7]] as const).map(([cx, cy, r], idx) => (
            <g key={idx}>
              {[0, 1, 2, 3, 4, 5].map(i => {
                const a = (i * Math.PI * 2) / 6;
                return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} />;
              })}
            </g>
          ))}
        </g>
      );
    case 'lightning':
      return (
        <g>
          <path d="M 40 22 L 36 38 L 42 38 L 38 54" stroke={color} strokeWidth={1.2} fill="none" opacity={0.7} />
          <path d="M 62 24 L 66 40 L 60 40 L 64 55" stroke={color} strokeWidth={1.2} fill="none" opacity={0.6} />
        </g>
      );
    case 'stars':
      return (
        <g>
          {([[28, 32], [72, 30], [30, 82], [72, 80]] as const).map(([cx, cy], i) => (
            <text key={i} x={cx} y={cy} fontSize={6} fill={color} textAnchor="middle" opacity={0.6}>✦</text>
          ))}
        </g>
      );
    case 'void':
      return (
        <g opacity={0.3}>
          {[0, 1].map(i => (
            <ellipse key={i} cx={50} cy={50} rx={18 + i * 12} ry={12 + i * 9}
              fill="none" stroke={color} strokeWidth={0.7} />
          ))}
        </g>
      );
    case 'bubbles':
      return (
        <g>
          {([[28, 38, 4], [72, 40, 3], [35, 82, 5]] as const).map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={0.8} opacity={0.45} />
          ))}
        </g>
      );
    case 'bioluminescence':
      return (
        <g>
          {([[28, 42, 3], [72, 44, 3], [35, 80, 4]] as const).map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity={0.4} />
          ))}
        </g>
      );
    case 'prismatic':
      return (
        <g opacity={0.15}>
          <circle cx={50} cy={50} r={36} fill="none" stroke="url(#mini_rainbow)" strokeWidth={3} />
        </g>
      );
    default:
      return null;
  }
}

// ─── SkinPreview (mini SVG) ───────────────────────────────────────────────────

function SkinPreview({ skin, size = 90 }: { skin: SkinDefinition; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`mini_bg_${skin.id}`} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor={skin.colors.body1} />
          <stop offset="100%" stopColor={skin.colors.body2} />
        </radialGradient>
        <linearGradient id="mini_rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF0080" />
          <stop offset="50%" stopColor="#00FF80" />
          <stop offset="100%" stopColor="#0080FF" />
        </linearGradient>
        <filter id={`mini_glow_${skin.id}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Glow halo */}
      <ellipse cx={50} cy={52} rx={32} ry={30} fill={skin.colors.glow} opacity={0.18} />

      {/* Body */}
      <path
        d="M 50 14 C 67 9, 86 24, 85 44 C 84 65, 73 84, 50 86 C 27 84, 16 65, 15 44 C 14 24, 33 9, 50 14 Z"
        fill={`url(#mini_bg_${skin.id})`}
        style={{ filter: `drop-shadow(0 0 8px ${skin.colors.glow}99)` }}
      />

      <MiniOverlay overlay={skin.overlay} color={skin.colors.glow} />

      {/* Eyes */}
      <MiniEye style={skin.eyeStyle} color={skin.eyeColor} cx={37} cy={42} />
      <MiniEye style={skin.eyeStyle} color={skin.eyeColor} cx={63} cy={42} />

      {/* Cheeks */}
      <ellipse cx={28} cy={54} rx={8} ry={5} fill={skin.colors.cheek} opacity={0.5} />
      <ellipse cx={72} cy={54} rx={8} ry={5} fill={skin.colors.cheek} opacity={0.5} />

      {/* Mouth */}
      <path d="M 38 62 Q 50 72 62 62" stroke="white" strokeWidth={2} fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ─── SkinCard ─────────────────────────────────────────────────────────────────

function SkinCard({ skin, owned, equipped, onBuy, onEquip, coins, petLevel }: {
  skin: SkinDefinition;
  owned: boolean;
  equipped: boolean;
  onBuy: () => void;
  onEquip: () => void;
  coins: number;
  petLevel: number;
}) {
  const r = RARITY[skin.rarity];
  const locked = !owned && !!skin.requiredLevel && petLevel < skin.requiredLevel;
  const canAfford = coins >= skin.price;

  const isDark = skin.rarity === 'common';
  const textColor = isDark ? 'rgba(255,255,255,0.9)' : '#1E1147';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : '#6B7280';

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: isDark
          ? `linear-gradient(160deg, ${skin.colors.body1}ee, ${skin.colors.body2}ff)`
          : `linear-gradient(160deg, ${skin.colors.body1}22, white 60%)`,
        border: equipped ? `2px solid ${r.color}` : `1.5px solid ${r.border}`,
        boxShadow: equipped
          ? `0 0 20px ${skin.colors.glow}66, 0 4px 16px rgba(0,0,0,0.15)`
          : `0 2px 12px rgba(0,0,0,0.08)`,
      }}
    >
      {/* Equipped badge */}
      {equipped && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
          style={{ background: skin.colors.glow }}
        >
          ✓ Надет
        </motion.div>
      )}

      {/* Rarity badge */}
      <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold"
        style={{ background: r.border + '33', color: r.color, border: `1px solid ${r.border}` }}>
        {r.label}
      </div>

      {/* Preview area */}
      <div
        className="relative flex items-center justify-center pt-6 pb-2"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${skin.colors.glow}20, transparent 70%)`,
          minHeight: 130,
        }}
      >
        {locked ? (
          <div className="flex flex-col items-center gap-1 opacity-50">
            <span className="text-4xl">🔒</span>
            <span className="text-xs font-bold" style={{ color: r.color }}>Ур. {skin.requiredLevel}</span>
          </div>
        ) : (
          <SkinPreview skin={skin} size={96} />
        )}
      </div>

      {/* Info */}
      <div className="px-3 pb-3 flex flex-col gap-2 flex-1">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{skin.emoji}</span>
            <p className="font-display font-bold text-sm" style={{ color: textColor }}>{skin.name}</p>
          </div>
          <p className="text-[10px] mt-0.5 italic" style={{ color: mutedColor }}>{skin.tagline}</p>
        </div>

        {/* Action button */}
        {owned ? (
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={onEquip}
            disabled={equipped}
            className="w-full py-2 rounded-xl font-display font-bold text-xs transition-all"
            style={{
              background: equipped
                ? 'rgba(0,0,0,0.05)'
                : `linear-gradient(135deg, ${skin.colors.body1}, ${skin.colors.body2})`,
              color: equipped ? '#9CA3AF' : 'white',
              boxShadow: equipped ? 'none' : `0 4px 12px ${skin.colors.glow}66`,
              cursor: equipped ? 'default' : 'pointer',
            }}
          >
            {equipped ? '✓ Надет' : '🎨 Надеть'}
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={locked ? undefined : onBuy}
            disabled={locked || !canAfford}
            className="w-full py-2 rounded-xl font-display font-bold text-xs transition-all"
            style={{
              background: locked
                ? '#E5E7EB'
                : canAfford
                  ? `linear-gradient(135deg, ${skin.colors.body1}, ${skin.colors.body2})`
                  : '#E5E7EB',
              color: locked || !canAfford ? '#9CA3AF' : 'white',
              boxShadow: (!locked && canAfford) ? `0 4px 12px ${skin.colors.glow}66` : 'none',
              cursor: (locked || !canAfford) ? 'not-allowed' : 'pointer',
            }}
          >
            {locked ? `🔒 Ур. ${skin.requiredLevel}` : `🪙 ${skin.price}`}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function SkinModal({ skin, owned, equipped, onBuy, onEquip, onClose, coins, petLevel }: {
  skin: SkinDefinition;
  owned: boolean;
  equipped: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onClose: () => void;
  coins: number;
  petLevel: number;
}) {
  const r = RARITY[skin.rarity];
  const locked = !owned && !!skin.requiredLevel && petLevel < skin.requiredLevel;
  const canAfford = coins >= skin.price;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,40,0.7)', backdropFilter: 'blur(12px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${skin.colors.body2}dd, #0f0a28ee)`,
          border: `1.5px solid ${skin.colors.glow}55`,
          boxShadow: `0 0 60px ${skin.colors.glow}44, 0 24px 64px rgba(0,0,0,0.5)`,
        }}
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all text-sm"
        >✕</button>

        {/* Big preview */}
        <div className="flex flex-col items-center pt-8 pb-4" style={{
          background: `radial-gradient(ellipse at 50% 40%, ${skin.colors.glow}33, transparent 70%)`,
        }}>
          <motion.div
            animate={
              skin.animStyle === 'pulse' ? { scale: [1, 1.06, 1] } :
                skin.animStyle === 'wobble' ? { rotate: [0, 3, -3, 0] } :
                  skin.animStyle === 'wave' ? { y: [0, -8, 0] } :
                    skin.animStyle === 'spark' ? { y: [0, -12, 0] } :
                      { y: [0, -8, 0] }
            }
            transition={{ duration: skin.animStyle === 'spark' ? 0.7 : 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <SkinPreview skin={skin} size={150} />
          </motion.div>

          {/* Rarity */}
          <span className="mt-2 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: r.border + '33', color: r.color, border: `1px solid ${r.border}` }}>
            {r.label}
          </span>
        </div>

        {/* Info */}
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{skin.emoji}</span>
            <div>
              <h2 className="font-display font-bold text-white text-lg">{skin.name}</h2>
              <p className="text-xs italic" style={{ color: skin.colors.glow }}>{skin.tagline}</p>
            </div>
          </div>
          <p className="text-sm text-white/70 mb-4 leading-relaxed">{skin.description}</p>

          {/* Traits */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {[
              { label: skin.eyeStyle, icon: '👁' },
              { label: skin.overlay !== 'none' ? skin.overlay : null, icon: '✨' },
              { label: skin.animStyle, icon: '💫' },
            ].filter(t => t.label).map(t => (
              <span key={t.label} className="px-2 py-0.5 rounded-lg text-[10px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                {t.icon} {t.label}
              </span>
            ))}
          </div>

          {/* Action */}
          {owned ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { onEquip(); onClose(); }}
              disabled={equipped}
              className="w-full py-3 rounded-2xl font-display font-bold text-sm"
              style={{
                background: equipped ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${skin.colors.body1}, ${skin.colors.body2})`,
                color: equipped ? 'rgba(255,255,255,0.4)' : 'white',
                boxShadow: equipped ? 'none' : `0 6px 20px ${skin.colors.glow}66`,
              }}
            >
              {equipped ? '✓ Уже надет' : '🎨 Надеть'}
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={locked ? undefined : () => { onBuy(); onClose(); }}
              disabled={locked || !canAfford}
              className="w-full py-3 rounded-2xl font-display font-bold text-sm"
              style={{
                background: locked || !canAfford
                  ? 'rgba(255,255,255,0.06)'
                  : `linear-gradient(135deg, ${skin.colors.body1}, ${skin.colors.body2})`,
                color: locked || !canAfford ? 'rgba(255,255,255,0.35)' : 'white',
                boxShadow: (!locked && canAfford) ? `0 6px 20px ${skin.colors.glow}66` : 'none',
                cursor: (locked || !canAfford) ? 'not-allowed' : 'pointer',
              }}
            >
              {locked
                ? `🔒 Нужен уровень ${skin.requiredLevel}`
                : !canAfford
                  ? `Нужно ещё 🪙 ${skin.price - coins}`
                  : `🪙 ${skin.price} — Купить`}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Shape Preview SVG ────────────────────────────────────────────────────────

function ShapePreviewSVG({ shape, color1, color2, glowColor, size = 80 }: {
  shape: BodyShapeDefinition; color1: string; color2: string; glowColor: string; size?: number;
}) {
  const gid = `sp_${shape.id}`;
  const paths: Record<BodyShapeId, React.ReactNode> = {
    blob: (
      <path d="M 50 14 C 67 9, 86 24, 85 44 C 84 65, 73 84, 50 86 C 27 84, 16 65, 15 44 C 14 24, 33 9, 50 14 Z" fill={`url(#${gid})`} />
    ),
    cat: (
      <>
        <path d="M 25 40 L 18 18 L 39 30 Z" fill={color2} />
        <path d="M 75 40 L 82 18 L 61 30 Z" fill={color2} />
        <path d="M 27 38 L 22 22 L 36 31 Z" fill={glowColor} opacity={0.3} />
        <path d="M 73 38 L 78 22 L 64 31 Z" fill={glowColor} opacity={0.3} />
        <path d="M 50 27 C 68 22, 84 33, 84 53 C 84 73, 73 86, 50 86 C 27 86, 16 73, 16 53 C 16 33, 32 22, 50 27 Z" fill={`url(#${gid})`} />
      </>
    ),
    chunky: (
      <>
        <path d="M 26 84 L 22 94 C 22 98, 29 100, 34 98 L 37 84 Z" fill={color2} />
        <path d="M 63 84 L 66 98 C 71 100, 78 98, 78 94 L 74 84 Z" fill={color2} />
        <path d="M 16 38 C 16 29, 28 23, 50 23 C 72 23, 84 29, 84 38 L 84 71 C 84 79, 74 84, 50 84 C 26 84, 16 79, 16 71 Z" fill={`url(#${gid})`} />
      </>
    ),
    tall: (
      <>
        <path d="M 31 41 C 23 45, 12 52, 7 65 C 6 68, 9 71, 12 69 C 16 57, 26 51, 34 46 Z" fill={`url(#${gid})`} />
        <path d="M 69 41 C 77 45, 88 52, 93 65 C 94 68, 91 71, 88 69 C 84 57, 74 51, 66 46 Z" fill={`url(#${gid})`} />
        <path d="M 50 11 C 60 10, 69 18, 69 37 C 69 63, 63 84, 50 86 C 37 84, 31 63, 31 37 C 31 18, 40 10, 50 11 Z" fill={`url(#${gid})`} />
      </>
    ),
    tailed: (
      <>
        <path d="M 79 44 C 95 36, 103 54, 96 68 C 93 77, 86 78, 82 73 C 87 76, 92 74, 94 65 C 97 54, 90 40, 76 50 Z" fill={color2} />
        <path d="M 46 15 C 63 10, 80 25, 79 44 C 78 63, 68 81, 46 83 C 24 81, 15 64, 15 45 C 15 26, 30 10, 46 15 Z" fill={`url(#${gid})`} />
      </>
    ),
    split: (
      <path d="M 50 10 C 64 10, 74 20, 74 34 C 74 46, 68 53, 59 58 C 69 62, 82 70, 82 81 C 82 91, 71 98, 50 98 C 29 98, 18 91, 18 81 C 18 70, 31 62, 41 58 C 32 53, 26 46, 26 34 C 26 20, 36 10, 50 10 Z" fill={`url(#${gid})`} />
    ),
    bear: (
      <>
        <circle cx={26} cy={27} r={12} fill={color2} />
        <circle cx={74} cy={27} r={12} fill={color2} />
        <circle cx={26} cy={27} r={7} fill={glowColor} opacity={0.3} />
        <circle cx={74} cy={27} r={7} fill={glowColor} opacity={0.3} />
        <ellipse cx={10} cy={66} rx={8} ry={7} fill={color2} />
        <ellipse cx={90} cy={66} rx={8} ry={7} fill={color2} />
        <path d="M 50 28 C 70 23, 85 35, 85 54 C 85 74, 74 88, 50 88 C 26 88, 15 74, 15 54 C 15 35, 30 23, 50 28 Z" fill={`url(#${gid})`} />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={gid} cx="38" cy="30" r="65" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </radialGradient>
      </defs>
      <ellipse cx={50} cy={52} rx={36} ry={34} fill={glowColor} opacity={0.15} />
      {paths[shape.id]}
      {/* Small dots for eyes */}
      <circle cx={shape.eyeLeft.cx / 2}  cy={shape.eyeLeft.cy / 2}  r={2.5} fill="white" opacity={0.8} />
      <circle cx={shape.eyeRight.cx / 2} cy={shape.eyeRight.cy / 2} r={2.5} fill="white" opacity={0.8} />
    </svg>
  );
}

function ShapeCard({ shape, equipped, onEquip, skin }: {
  shape: BodyShapeDefinition;
  equipped: boolean;
  onEquip: () => void;
  skin: SkinDefinition;
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.03 }}
      onClick={onEquip}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="relative rounded-2xl overflow-hidden flex flex-col cursor-pointer"
      style={{
        background: equipped
          ? `linear-gradient(160deg, ${skin.colors.body1}44, ${skin.colors.body2}66)`
          : 'rgba(255,255,255,0.7)',
        border: equipped
          ? `2px solid ${skin.colors.glow}`
          : '1.5px solid #E5E7EB',
        boxShadow: equipped
          ? `0 0 16px ${skin.colors.glow}44, 0 4px 12px rgba(0,0,0,0.1)`
          : '0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      {equipped && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
          style={{ background: skin.colors.glow }}
        >
          ✓
        </motion.div>
      )}

      <div className="flex items-center justify-center pt-3 pb-1"
        style={{ background: `radial-gradient(ellipse at 50% 40%, ${skin.colors.glow}18, transparent 70%)` }}>
        <ShapePreviewSVG
          shape={shape}
          color1={skin.colors.body1}
          color2={skin.colors.body2}
          glowColor={skin.colors.glow}
          size={72}
        />
      </div>

      <div className="px-2 pb-3 text-center">
        <p className="font-display font-bold text-xs text-lumio-text">{shape.emoji} {shape.name}</p>
      </div>
    </motion.div>
  );
}

// ─── BgCard ───────────────────────────────────────────────────────────────────

const EFFECT_ICON: Record<string, string> = {
  particles: '✦', rain: '🌧', stars: '★', grid: '⊞', scan: '▷',
  aurora: '◉', lava: '🔥', digital_rain: '▓', ash: '🌑', void_rings: '◯', glitch: '⚡',
};

function BgCard({ bg, owned, equipped, onBuy, onEquip, coins, petLevel }: {
  bg: BackgroundDefinition;
  owned: boolean;
  equipped: boolean;
  onBuy: () => void;
  onEquip: () => void;
  coins: number;
  petLevel: number;
}) {
  const r = RARITY[bg.rarity];
  const locked = !owned && !!bg.requiredLevel && petLevel < bg.requiredLevel;
  const canAfford = coins >= bg.price;

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.7)',
        border: equipped ? `2px solid ${bg.accentColor}` : `1.5px solid ${r.border}`,
        boxShadow: equipped
          ? `0 0 20px ${bg.accentColor}55, 0 4px 16px rgba(0,0,0,0.12)`
          : `0 2px 8px rgba(0,0,0,0.06)`,
      }}
    >
      {/* Equipped badge */}
      {equipped && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
          style={{ background: bg.accentColor }}
        >
          ✓ Активен
        </motion.div>
      )}

      {/* Rarity badge */}
      <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold"
        style={{ background: r.border + '33', color: r.color, border: `1px solid ${r.border}` }}>
        {r.label}
      </div>

      {/* Scene preview */}
      <div
        className="relative overflow-hidden"
        style={{ background: bg.gradient, minHeight: 100 }}
      >
        {/* Animated accent glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: `radial-gradient(ellipse at 50% 60%, ${bg.accentColor}33, transparent 70%)` }}
        />

        {/* Floor strip */}
        <div className="absolute bottom-0 left-0 right-0 h-5" style={{ background: bg.floorGradient }} />

        {/* Emoji */}
        <div className="flex items-center justify-center h-full pt-6 pb-4">
          {locked ? (
            <div className="flex flex-col items-center gap-1 opacity-60">
              <span className="text-3xl">🔒</span>
              <span className="text-[10px] font-bold text-white/70">Ур. {bg.requiredLevel}</span>
            </div>
          ) : (
            <motion.span
              className="text-4xl select-none"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ filter: `drop-shadow(0 0 8px ${bg.accentColor})` }}
            >
              {bg.emoji}
            </motion.span>
          )}
        </div>

        {/* Effect dots */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1 px-2">
          {bg.effects.slice(0, 4).map((e, i) => (
            <span
              key={i}
              className="text-[10px] opacity-80"
              style={{ color: e.color ?? bg.accentColor }}
              title={e.type}
            >
              {EFFECT_ICON[e.type] ?? '◆'}
            </span>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2 flex flex-col gap-1.5 flex-1">
        <div>
          <p className="font-display font-bold text-xs text-lumio-text">{bg.name}</p>
          <p className="text-[10px] text-lumio-muted italic truncate">{bg.tagline}</p>
        </div>

        {owned ? (
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={onEquip}
            disabled={equipped}
            className="w-full py-1.5 rounded-xl font-display font-bold text-[11px] transition-all"
            style={{
              background: equipped
                ? 'rgba(0,0,0,0.04)'
                : `linear-gradient(135deg, ${bg.accentColor}cc, ${bg.accentColor}88)`,
              color: equipped ? '#9CA3AF' : 'white',
              boxShadow: equipped ? 'none' : `0 3px 10px ${bg.accentColor}55`,
              cursor: equipped ? 'default' : 'pointer',
            }}
          >
            {equipped ? '✓ Активен' : '🌌 Включить'}
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={locked ? undefined : onBuy}
            disabled={locked || !canAfford}
            className="w-full py-1.5 rounded-xl font-display font-bold text-[11px] transition-all"
            style={{
              background: locked || !canAfford
                ? '#F3F4F6'
                : `linear-gradient(135deg, ${bg.accentColor}cc, ${bg.accentColor}88)`,
              color: locked || !canAfford ? '#9CA3AF' : 'white',
              boxShadow: (!locked && canAfford) ? `0 3px 10px ${bg.accentColor}55` : 'none',
              cursor: (locked || !canAfford) ? 'not-allowed' : 'pointer',
            }}
          >
            {locked ? `🔒 Ур. ${bg.requiredLevel}` : canAfford ? `🪙 ${bg.price}` : `🪙 ${bg.price}`}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Color Palettes ───────────────────────────────────────────────────────────

// ─── Color Tab ────────────────────────────────────────────────────────────────

function ColorTab() {
  const petColorOverride = usePetStore(s => s.petColorOverride);
  const setPetColorOverride = usePetStore(s => s.setPetColorOverride);
  const equippedSkinId = usePetStore(s => s.equippedSkinId);
  const skin = getSkin(equippedSkinId);

  const base = petColorOverride ?? skin.colors;
  const [custom, setCustom] = useState<PetColors>({ body1: base.body1, body2: base.body2, glow: base.glow, cheek: base.cheek });

  const applyPalette = (p: PetColors) => {
    setPetColorOverride(p);
    setCustom(p);
  };

  const applyCustom = (next: PetColors) => {
    setCustom(next);
    setPetColorOverride(next);
  };

  return (
    <div className="space-y-6">
      {/* Preset palettes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-bold text-base text-lumio-text">🎨 Цветовая схема</h2>
            <p className="text-xs text-lumio-muted">Выбери готовую палитру или настрой свою</p>
          </div>
          {petColorOverride && (
            <button
              onClick={() => setPetColorOverride(null)}
              className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
            >
              ↩ Сброс
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {PALETTES.map((p, i) => {
            const active = petColorOverride?.body1 === p.body1 && petColorOverride?.glow === p.glow;
            return (
              <motion.button key={i}
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => applyPalette(p)}
                className="relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
                style={{
                  background: active ? `${p.glow}18` : 'rgba(255,255,255,0.65)',
                  border: active ? `2px solid ${p.glow}` : '1.5px solid #E5E7EB',
                  boxShadow: active ? `0 0 14px ${p.glow}55, 0 2px 8px rgba(0,0,0,0.1)` : '0 1px 4px rgba(0,0,0,0.05)',
                }}
              >
                <div className="w-full h-9 rounded-lg overflow-hidden relative"
                  style={{ background: `linear-gradient(135deg, ${p.body1} 0%, ${p.body2} 100%)` }}>
                  <div className="absolute bottom-1.5 right-1.5 w-3 h-3 rounded-full"
                    style={{ background: p.glow, boxShadow: `0 0 6px ${p.glow}` }} />
                  {active && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-white/90 flex items-center justify-center text-[9px] font-bold text-gray-800">✓</div>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-lumio-muted font-semibold text-center leading-tight">{p.name}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Custom color pickers */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid #E5E7EB' }}>
        <h3 className="font-display font-semibold text-sm text-lumio-text mb-4">✏️ Свой цвет</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {([
            { key: 'body1' as const, label: 'Основной',  desc: 'Верх тела' },
            { key: 'body2' as const, label: 'Тёмный',    desc: 'Низ / тень' },
            { key: 'glow'  as const, label: 'Свечение',  desc: 'Ауры и глаза' },
            { key: 'cheek' as const, label: 'Щёки',      desc: 'Акцент' },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex flex-col items-center gap-2">
              <label className="text-xs font-bold text-lumio-text">{label}</label>
              <label className="relative cursor-pointer group">
                <div className="w-14 h-14 rounded-2xl border-4 border-white shadow-lg transition-transform group-hover:scale-110"
                  style={{ background: custom[key], boxShadow: `0 0 16px ${custom[key]}88, 0 4px 12px rgba(0,0,0,0.15)` }} />
                <input
                  type="color" value={custom[key]}
                  onChange={e => applyCustom({ ...custom, [key]: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
              <span className="text-[9px] text-lumio-muted font-mono">{custom[key]}</span>
              <span className="text-[9px] text-lumio-muted">{desc}</span>
            </div>
          ))}
        </div>

        {/* Live preview strip */}
        <div className="mt-4 h-8 rounded-xl overflow-hidden relative"
          style={{ background: `linear-gradient(135deg, ${custom.body1} 0%, ${custom.body2} 50%, ${custom.body1} 100%)` }}>
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ background: custom.glow, boxShadow: `0 0 10px ${custom.glow}` }} />
            <div className="w-2 h-2 rounded-full" style={{ background: custom.cheek, opacity: 0.7 }} />
            <div className="w-2 h-2 rounded-full" style={{ background: custom.cheek, opacity: 0.7 }} />
            <div className="w-3 h-3 rounded-full" style={{ background: custom.glow, boxShadow: `0 0 10px ${custom.glow}` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SkinsPage ────────────────────────────────────────────────────────────────

type RarityFilter = ItemRarity | 'all' | 'owned';

const RARITY_FILTERS: { id: RarityFilter; label: string; color?: string }[] = [
  { id: 'all',       label: '✦ Все' },
  { id: 'owned',     label: '✓ Мои' },
  { id: 'common',    label: 'Старт',       color: '#6B7280' },
  { id: 'rare',      label: 'Редкий',      color: '#3B82F6' },
  { id: 'epic',      label: 'Эпический',   color: '#8B5CF6' },
  { id: 'legendary', label: 'Легендарный', color: '#F59E0B' },
];

function FilterBar({ value, onChange }: { value: RarityFilter; onChange: (v: RarityFilter) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {RARITY_FILTERS.map(f => (
        <button key={f.id} onClick={() => onChange(f.id)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0"
          style={{
            background: value === f.id ? (f.color ?? 'linear-gradient(135deg,#7C3AED,#EC4899)') : 'rgba(255,255,255,0.8)',
            color: value === f.id ? 'white' : f.color ?? '#6B7280',
            border: value === f.id ? 'none' : `1px solid ${f.color ?? '#E5E7EB'}`,
            boxShadow: value === f.id && f.color ? `0 4px 12px ${f.color}55` : 'none',
          }}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function SkinsPage() {
  const {
    coins, equippedSkinId, equippedBodyId, ownedSkins, buySkin, equipSkin, equipBody,
    equippedBgId, ownedBgs, buyBg, equipBg, pet,
  } = usePetStore();
  const [pageTab, setPageTab] = useState<PageTab>('body');
  const [skinFilter, setSkinFilter] = useState<RarityFilter>('all');
  const [bgFilter, setBgFilter] = useState<RarityFilter>('all');
  const [selected, setSelected] = useState<SkinDefinition | null>(null);

  const petLevel = pet?.level ?? 0;
  const currentSkin = getSkin(equippedSkinId);
  const activeBg = BACKGROUNDS.find(b => b.id === equippedBgId) ?? BACKGROUNDS[0];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-lumio-text">🎨 Внешний вид</h1>
          <p className="text-sm text-lumio-muted">Кастомизация питомца</p>
        </div>
        <div className="px-4 py-2 rounded-2xl" style={{ background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <p className="font-display font-bold text-amber-900 text-xl">🪙 {coins.toLocaleString()}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'rgba(0,0,0,0.05)' }}>
        {PAGE_TABS.map(t => (
          <button key={t.id} onClick={() => setPageTab(t.id)}
            className="flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all"
            style={{
              background: pageTab === t.id ? 'white' : 'transparent',
              color: pageTab === t.id ? '#4F46E5' : '#6B7280',
              boxShadow: pageTab === t.id ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={pageTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}>

          {/* ── ФОРМА ── */}
          {pageTab === 'body' && (
            <div className="space-y-4">
              <p className="text-xs text-lumio-muted">Форма персонажа — бесплатно, меняй сколько угодно</p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {BODY_SHAPES.map(shape => (
                  <ShapeCard key={shape.id} shape={shape}
                    equipped={equippedBodyId === shape.id}
                    onEquip={() => equipBody(shape.id)}
                    skin={currentSkin}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── ЦВЕТ ── */}
          {pageTab === 'color' && <ColorTab />}

          {/* ── СКИН ── */}
          {pageTab === 'skin' && (
            <div className="space-y-4">
              {/* Current skin banner */}
              <motion.div className="relative overflow-hidden rounded-2xl p-4 flex items-center gap-4"
                style={{
                  background: `linear-gradient(135deg, ${currentSkin.colors.body2}cc, ${currentSkin.colors.body1}88)`,
                  border: `1.5px solid ${currentSkin.colors.glow}55`,
                  boxShadow: `0 4px 24px ${currentSkin.colors.glow}33`,
                }}>
                <div style={{ filter: `drop-shadow(0 0 12px ${currentSkin.colors.glow}88)` }}>
                  <SkinPreview skin={currentSkin} size={72} />
                </div>
                <div>
                  <p className="text-xs text-white/60 font-semibold mb-0.5">Сейчас надет</p>
                  <p className="font-display font-bold text-white text-lg">{currentSkin.emoji} {currentSkin.name}</p>
                  <p className="text-sm italic" style={{ color: currentSkin.colors.glow }}>{currentSkin.tagline}</p>
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 text-7xl pointer-events-none select-none">
                  {currentSkin.emoji}
                </div>
              </motion.div>

              <FilterBar value={skinFilter} onChange={setSkinFilter} />

              <AnimatePresence mode="popLayout">
                <motion.div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" layout>
                  {SKINS.filter(s => {
                    if (skinFilter === 'owned') return ownedSkins.includes(s.id);
                    if (skinFilter === 'all') return true;
                    return s.rarity === skinFilter;
                  }).map(skin => (
                    <motion.div key={skin.id} layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setSelected(skin)} className="cursor-pointer">
                      <SkinCard skin={skin}
                        owned={ownedSkins.includes(skin.id)}
                        equipped={equippedSkinId === skin.id}
                        coins={coins} petLevel={petLevel}
                        onBuy={() => buySkin(skin.id)}
                        onEquip={() => equipSkin(skin.id)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* ── ФОН ── */}
          {pageTab === 'bg' && (
            <div className="space-y-4">
              {/* Active bg banner */}
              <motion.div className="relative overflow-hidden rounded-2xl p-4 flex items-center gap-4"
                style={{
                  background: activeBg.gradient,
                  border: `1.5px solid ${activeBg.accentColor}55`,
                  boxShadow: `0 4px 24px ${activeBg.accentColor}33`,
                }}>
                <motion.span className="text-5xl select-none"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ filter: `drop-shadow(0 0 12px ${activeBg.accentColor})` }}>
                  {activeBg.emoji}
                </motion.span>
                <div>
                  <p className="text-xs text-white/60 font-semibold mb-0.5">Сейчас активен</p>
                  <p className="font-display font-bold text-white text-lg">{activeBg.name}</p>
                  <p className="text-sm italic" style={{ color: activeBg.accentColor }}>{activeBg.tagline}</p>
                </div>
                <div className="ml-auto flex gap-1.5">
                  {activeBg.effects.map((e, i) => (
                    <span key={i} className="text-sm opacity-70" style={{ color: e.color ?? activeBg.accentColor }}>
                      {EFFECT_ICON[e.type] ?? '◆'}
                    </span>
                  ))}
                </div>
              </motion.div>

              <FilterBar value={bgFilter} onChange={setBgFilter} />

              <motion.div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" layout>
                {BACKGROUNDS.filter(bg => {
                  if (bgFilter === 'owned') return ownedBgs.includes(bg.id);
                  if (bgFilter === 'all') return true;
                  return bg.rarity === bgFilter;
                }).map(bg => (
                  <motion.div key={bg.id} layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}>
                    <BgCard bg={bg}
                      owned={ownedBgs.includes(bg.id)}
                      equipped={equippedBgId === bg.id}
                      coins={coins} petLevel={petLevel}
                      onBuy={() => buyBg(bg.id)}
                      onEquip={() => equipBg(bg.id)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <SkinModal
            skin={selected}
            owned={ownedSkins.includes(selected.id)}
            equipped={equippedSkinId === selected.id}
            coins={coins} petLevel={petLevel}
            onBuy={() => buySkin(selected.id)}
            onEquip={() => equipSkin(selected.id)}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
