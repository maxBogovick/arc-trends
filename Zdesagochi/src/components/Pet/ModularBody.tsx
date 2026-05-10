import { motion } from 'framer-motion';
import type { HeadId, EarsId, BodyPartId, ArmsId, LegsId, TailId, NoseId, MouthStyleId } from '../../data/petParts';

interface PartColors {
  body1: string;
  body2: string;
  glow: string;
  cheek: string;
}

interface PartProps {
  gradId: string;
  c: PartColors;
  overrideFill?: string | null;
}

// ─── HEAD ─────────────────────────────────────────────────────────────────────

export function HeadShape({ id, gradId, overrideFill }: PartProps & { id: HeadId }) {
  const f = overrideFill ?? `url(#${gradId})`;
  switch (id) {
    case 'oval':
      return <ellipse cx="100" cy="80" rx="44" ry="58" fill={f} />;
    case 'square':
      return <rect x="50" y="26" width="100" height="96" rx="22" fill={f} />;
    case 'egg':
      return (
        <path
          d="M 100 26 C 142 22, 168 50, 164 82 C 160 114, 138 132, 100 134 C 62 132, 40 114, 36 82 C 32 50, 58 22, 100 26 Z"
          fill={f}
        />
      );
    case 'heart':
      return (
        <path
          d="M 100 130 C 60 110, 26 90, 32 62 C 36 42, 56 30, 76 36 C 88 40, 96 50, 100 58 C 104 50, 112 40, 124 36 C 144 30, 164 42, 168 62 C 174 90, 140 110, 100 130 Z"
          fill={f}
        />
      );
    case 'star': {
      let d = '';
      const pts = 5;
      for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? 54 : 26;
        const a = (i * Math.PI) / pts - Math.PI / 2;
        d += `${i === 0 ? 'M' : 'L'} ${100 + r * Math.cos(a)} ${80 + r * Math.sin(a)} `;
      }
      return <path d={d + 'Z'} fill={f} />;
    }
    case 'blob':
      return (
        <path
          d="M 100 28 C 130 24, 160 42, 158 70 C 156 90, 168 108, 154 122 C 140 136, 120 138, 100 136 C 80 138, 60 136, 46 122 C 32 108, 44 90, 42 70 C 40 42, 70 24, 100 28 Z"
          fill={f}
        />
      );
    case 'diamond':
      return (
        <path
          d="M 100 22 L 148 70 L 128 126 L 72 126 L 52 70 Z"
          fill={f}
        />
      );
    default: // round
      return <circle cx="100" cy="80" r="54" fill={f} />;
  }
}

// ─── EARS ─────────────────────────────────────────────────────────────────────

export function EarsShape({ id, gradId, c, overrideFill }: PartProps & { id: EarsId }) {
  const f = overrideFill ?? `url(#${gradId})`;
  switch (id) {
    case 'pointy':
      return (
        <g>
          <path d="M 64 56 L 46 14 L 88 44 Z" fill={f} />
          <path d="M 136 56 L 154 14 L 112 44 Z" fill={f} />
          <path d="M 68 52 L 56 24 L 84 46 Z" fill={c.cheek} opacity={0.55} />
          <path d="M 132 52 L 144 24 L 116 46 Z" fill={c.cheek} opacity={0.55} />
        </g>
      );
    case 'floppy':
      return (
        <g>
          {/* Left ear hangs down from head side */}
          <path d="M 50 54 C 28 48, 16 74, 20 106 C 23 124, 38 126, 50 110 L 58 60 Z" fill={f} />
          <path d="M 150 54 C 172 48, 184 74, 180 106 C 177 124, 162 126, 150 110 L 142 60 Z" fill={f} />
          {/* Inner shading */}
          <path d="M 52 62 C 34 58, 26 80, 28 104 C 30 116, 38 118, 48 108 L 54 68 Z" fill={c.cheek} opacity={0.28} />
          <path d="M 148 62 C 166 58, 174 80, 172 104 C 170 116, 162 118, 152 108 L 146 68 Z" fill={c.cheek} opacity={0.28} />
        </g>
      );
    case 'round_ears':
      return (
        <g>
          <circle cx="60" cy="42" r="26" fill={f} />
          <circle cx="140" cy="42" r="26" fill={f} />
          <circle cx="60" cy="42" r="16" fill={c.cheek} opacity={0.45} />
          <circle cx="140" cy="42" r="16" fill={c.cheek} opacity={0.45} />
        </g>
      );
    case 'horns':
      return (
        <g>
          {/* Horn shape: solid filled */}
          <path d="M 78 40 L 65 2 L 96 36 Z" fill={c.glow} opacity={0.92} />
          <path d="M 122 40 L 135 2 L 104 36 Z" fill={c.glow} opacity={0.92} />
          {/* Inner highlight */}
          <path d="M 82 38 L 72 14 L 92 36 Z" fill="white" opacity={0.22} />
          <path d="M 118 38 L 128 14 L 108 36 Z" fill="white" opacity={0.22} />
        </g>
      );
    case 'antenna':
      return (
        <g>
          <line x1="82" y1="34" x2="64" y2="6" stroke={c.glow} strokeWidth="3.5" strokeLinecap="round" />
          <line x1="118" y1="34" x2="136" y2="6" stroke={c.glow} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="64" cy="6" r="7" fill={c.glow} />
          <circle cx="136" cy="6" r="7" fill={c.glow} />
          <circle cx="64" cy="6" r="3.5" fill="white" opacity={0.65} />
          <circle cx="136" cy="6" r="3.5" fill="white" opacity={0.65} />
        </g>
      );
    case 'bat':
      return (
        <g>
          {/* Bat wing ear left */}
          <path d="M 58 54 C 30 20, 18 0, 46 14 C 54 18, 60 28, 58 54 Z" fill={f} />
          <path d="M 52 50 C 36 22, 28 10, 48 18 C 54 22, 56 30, 52 50 Z" fill={c.cheek} opacity={0.3} />
          {/* Right */}
          <path d="M 142 54 C 170 20, 182 0, 154 14 C 146 18, 140 28, 142 54 Z" fill={f} />
          <path d="M 148 50 C 164 22, 172 10, 152 18 C 146 22, 144 30, 148 50 Z" fill={c.cheek} opacity={0.3} />
        </g>
      );
    case 'elf':
      return (
        <g>
          {/* Long pointy elf ear left */}
          <path d="M 52 70 L 20 48 L 60 60 Z" fill={f} />
          <path d="M 54 68 L 26 50 L 58 62 Z" fill={c.cheek} opacity={0.4} />
          {/* Right */}
          <path d="M 148 70 L 180 48 L 140 60 Z" fill={f} />
          <path d="M 146 68 L 174 50 L 142 62 Z" fill={c.cheek} opacity={0.4} />
        </g>
      );
    default: // none
      return null;
  }
}

// ─── BODY ─────────────────────────────────────────────────────────────────────

export function BodyShape({ id, gradId, overrideFill }: PartProps & { id: BodyPartId }) {
  const f = overrideFill ?? `url(#${gradId})`;
  switch (id) {
    case 'slim':
      return (
        <>
          <path
            d="M 76 108 C 58 112, 48 130, 50 156 C 52 176, 70 192, 100 192 C 130 192, 148 176, 150 156 C 152 130, 142 112, 124 108 Z"
            fill={f}
          />
          {/* Belly shine */}
          <ellipse cx="100" cy="145" rx="18" ry="26" fill="white" opacity={0.08} />
        </>
      );
    case 'blocky':
      return (
        <>
          <path
            d="M 50 108 L 150 108 C 168 108, 180 120, 180 138 L 180 170 C 180 184, 168 194, 150 194 L 50 194 C 32 194, 20 184, 20 170 L 20 138 C 20 120, 32 108, 50 108 Z"
            fill={f}
          />
          {/* Corner highlights */}
          <rect x="52" y="110" width="18" height="10" rx="4" fill="white" opacity={0.1} />
        </>
      );
    case 'bubble':
      return (
        <>
          <circle cx="100" cy="152" r="50" fill={f} />
          {/* Specular highlight */}
          <ellipse cx="82" cy="134" rx="16" ry="11" fill="white" opacity={0.13} transform="rotate(-20 82 134)" />
        </>
      );
    case 'pear':
      return (
        <>
          <ellipse cx="100" cy="164" rx="56" ry="38" fill={f} />
          <ellipse cx="100" cy="164" rx="36" ry="28" fill="white" opacity={0.06} />
        </>
      );
    case 'tank':
      return (
        <>
          {/* Blocky robot torso */}
          <path
            d="M 46 108 L 154 108 L 162 114 L 168 128 L 168 180 L 162 190 L 38 190 L 32 180 L 32 128 L 38 114 Z"
            fill={f}
          />
          {/* Panel lines */}
          <line x1="46" y1="120" x2="154" y2="120" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
          <line x1="100" y1="108" x2="100" y2="190" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
          {/* Vent slots */}
          {[130, 142, 154, 166].map(y => (
            <rect key={y} x="70" y={y} width="16" height="4" rx="2" fill="rgba(0,0,0,0.25)" />
          ))}
          {[130, 142, 154, 166].map(y => (
            <rect key={y + 'r'} x="114" y={y} width="16" height="4" rx="2" fill="rgba(0,0,0,0.25)" />
          ))}
        </>
      );
    default: // chubby
      return (
        <>
          <path
            d="M 50 108 C 28 112, 16 132, 18 158 C 20 180, 46 196, 100 196 C 154 196, 180 180, 182 158 C 184 132, 172 112, 150 108 Z"
            fill={f}
          />
          <ellipse cx="100" cy="155" rx="24" ry="32" fill="white" opacity={0.08} />
        </>
      );
  }
}

// ─── ARMS ────────────────────────────────────────────────────────────────────

export function ArmsShape({ id, gradId, c, overrideFill }: PartProps & { id: ArmsId }) {
  const f = overrideFill ?? `url(#${gradId})`;
  switch (id) {
    case 'small_paws':
      return (
        <g>
          {/* Small paw at arm-level sides */}
          <ellipse cx="30" cy="144" rx="18" ry="14" fill={f} />
          <ellipse cx="170" cy="144" rx="18" ry="14" fill={f} />
          <line x1="23" y1="142" x2="23" y2="151" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="30" y1="143" x2="30" y2="152" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="37" y1="142" x2="37" y2="151" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="163" y1="142" x2="163" y2="151" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="170" y1="143" x2="170" y2="152" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="177" y1="142" x2="177" y2="151" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
        </g>
      );
    case 'long_arms':
      return (
        <g>
          <path d="M 50 124 C 28 118, 6 138, 2 164 C 0 176, 12 182, 22 172 C 26 150, 46 136, 58 136 Z" fill={f} />
          <path d="M 150 124 C 172 118, 194 138, 198 164 C 200 176, 188 182, 178 172 C 174 150, 154 136, 142 136 Z" fill={f} />
          {/* Knuckle hints */}
          <circle cx="10" cy="170" r="5" fill={c.body2} opacity={0.7} />
          <circle cx="190" cy="170" r="5" fill={c.body2} opacity={0.7} />
        </g>
      );
    case 'fins':
      return (
        <g>
          <path d="M 36 128 C 10 112, -2 142, 16 164 C 26 176, 44 168, 46 152 Z" fill={f} />
          <path d="M 164 128 C 190 112, 202 142, 184 164 C 174 176, 156 168, 154 152 Z" fill={f} />
          {/* Fin rays */}
          <line x1="36" y1="128" x2="16" y2="164" stroke={c.body1} strokeWidth="1.2" opacity={0.25} />
          <line x1="36" y1="128" x2="28" y2="160" stroke={c.body1} strokeWidth="1.2" opacity={0.25} />
          <line x1="164" y1="128" x2="184" y2="164" stroke={c.body1} strokeWidth="1.2" opacity={0.25} />
          <line x1="164" y1="128" x2="172" y2="160" stroke={c.body1} strokeWidth="1.2" opacity={0.25} />
        </g>
      );
    case 'wings':
      return (
        <g>
          {/* Wing membrane */}
          <path d="M 44 118 C 12 98, -6 130, 8 160 C 18 178, 46 174, 50 154 Z" fill={f} />
          <path d="M 156 118 C 188 98, 206 130, 192 160 C 182 178, 154 174, 150 154 Z" fill={f} />
          {/* Inner lighter wing section */}
          <path d="M 46 124 C 22 110, 10 136, 20 158 C 28 170, 48 168, 50 152 Z" fill="white" opacity={0.18} />
          <path d="M 154 124 C 178 110, 190 136, 180 158 C 172 170, 152 168, 150 152 Z" fill="white" opacity={0.18} />
          {/* Wing vein lines */}
          <line x1="44" y1="118" x2="8" y2="160" stroke={c.glow} strokeWidth="1" opacity={0.3} />
          <line x1="44" y1="118" x2="24" y2="164" stroke={c.glow} strokeWidth="1" opacity={0.3} />
          <line x1="156" y1="118" x2="192" y2="160" stroke={c.glow} strokeWidth="1" opacity={0.3} />
          <line x1="156" y1="118" x2="176" y2="164" stroke={c.glow} strokeWidth="1" opacity={0.3} />
        </g>
      );
    case 'stubby':
      return (
        <g>
          <path d="M 42 118 C 20 122, 14 144, 26 160 C 34 170, 50 166, 54 150 L 56 120 Z" fill={f} />
          <path d="M 158 118 C 180 122, 186 144, 174 160 C 166 170, 150 166, 146 150 L 144 120 Z" fill={f} />
          <circle cx="30" cy="158" r="6" fill={c.body2} opacity={0.75} />
          <circle cx="170" cy="158" r="6" fill={c.body2} opacity={0.75} />
        </g>
      );
    case 'tentacles':
      return (
        <g>
          {/* Three tentacles each side */}
          {[[-30, 8], [-18, 20], [-6, 28]].map(([dx, dy], i) => (
            <path key={i}
              d={`M ${46 + i * 4} 134 C ${20 + dx} ${140 + dy}, ${10 + dx} ${168 + dy}, ${22 + dx} ${180 + dy}`}
              stroke={c.body2} strokeWidth="9" fill="none" strokeLinecap="round" />
          ))}
          {[[-30, 8], [-18, 20], [-6, 28]].map(([dx, dy], i) => (
            <path key={i + 'r'}
              d={`M ${154 - i * 4} 134 C ${180 - dx} ${140 + dy}, ${190 - dx} ${168 + dy}, ${178 - dx} ${180 + dy}`}
              stroke={c.body2} strokeWidth="9" fill="none" strokeLinecap="round" />
          ))}
          {/* sucker dots */}
          {[0,1,2].map(i => <circle key={i} cx={20 - 30 + i * 4} cy={168 + 8 + i * 8} r={3.5} fill={c.glow} opacity={0.6} />)}
          {[0,1,2].map(i => <circle key={i + 'r'} cx={180 + 30 - i * 4} cy={168 + 8 + i * 8} r={3.5} fill={c.glow} opacity={0.6} />)}
        </g>
      );
    case 'claws':
      return (
        <g>
          {/* Arm with 3 claws */}
          <path d="M 46 122 C 24 128, 16 148, 28 164 L 54 136 Z" fill={f} />
          <path d="M 154 122 C 176 128, 184 148, 172 164 L 146 136 Z" fill={f} />
          {/* Claws left */}
          <path d="M 28 164 L 12 178" stroke={c.glow} strokeWidth="5" strokeLinecap="round" />
          <path d="M 32 168 L 20 186" stroke={c.glow} strokeWidth="5" strokeLinecap="round" />
          <path d="M 38 170 L 30 190" stroke={c.glow} strokeWidth="5" strokeLinecap="round" />
          {/* Claws right */}
          <path d="M 172 164 L 188 178" stroke={c.glow} strokeWidth="5" strokeLinecap="round" />
          <path d="M 168 168 L 180 186" stroke={c.glow} strokeWidth="5" strokeLinecap="round" />
          <path d="M 162 170 L 170 190" stroke={c.glow} strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    default: // none
      return null;
  }
}

// Keep old name as alias for backward compat with saved presets / overrideState
export const LimbsShape = ArmsShape;

// ─── LEGS ────────────────────────────────────────────────────────────────────

export function LegsShape({ id, gradId, c, overrideFill }: PartProps & { id: LegsId }) {
  const f = overrideFill ?? `url(#${gradId})`;
  switch (id) {
    case 'paws':
      return (
        <g>
          <ellipse cx="70" cy="194" rx="20" ry="12" fill={f} />
          <ellipse cx="130" cy="194" rx="20" ry="12" fill={f} />
          <line x1="63" y1="192" x2="63" y2="200" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="70" y1="193" x2="70" y2="201" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="77" y1="192" x2="77" y2="200" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="123" y1="192" x2="123" y2="200" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="130" y1="193" x2="130" y2="201" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="137" y1="192" x2="137" y2="200" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
        </g>
      );
    case 'stubby_legs':
      return (
        <g>
          {/* Short round legs */}
          <path d="M 70 182 C 58 182, 52 190, 56 198 C 60 206, 84 206, 84 198 C 84 190, 82 182, 70 182 Z" fill={f} />
          <path d="M 130 182 C 118 182, 116 190, 116 198 C 116 206, 140 206, 144 198 C 148 190, 142 182, 130 182 Z" fill={f} />
          <ellipse cx="70" cy="198" rx="14" ry="8" fill={c.body2} opacity={0.6} />
          <ellipse cx="130" cy="198" rx="14" ry="8" fill={c.body2} opacity={0.6} />
        </g>
      );
    case 'hooves':
      return (
        <g>
          {/* Narrow leg + pointed hoof */}
          <path d="M 78 180 L 68 180 L 62 198 L 78 198 Z" fill={f} />
          <path d="M 122 180 L 132 180 L 138 198 L 122 198 Z" fill={f} />
          <path d="M 62 198 L 58 204 L 82 204 L 78 198 Z" fill={c.body2} />
          <path d="M 122 198 L 118 204 L 142 204 L 138 198 Z" fill={c.body2} />
        </g>
      );
    case 'claw_feet':
      return (
        <g>
          {/* Foot base */}
          <ellipse cx="70" cy="192" rx="16" ry="10" fill={f} />
          <ellipse cx="130" cy="192" rx="16" ry="10" fill={f} />
          {/* Claws left */}
          <path d="M 58 196 L 50 206" stroke={c.glow} strokeWidth="4" strokeLinecap="round" />
          <path d="M 68 198 L 64 208" stroke={c.glow} strokeWidth="4" strokeLinecap="round" />
          <path d="M 78 196 L 80 206" stroke={c.glow} strokeWidth="4" strokeLinecap="round" />
          {/* Claws right */}
          <path d="M 118 196 L 116 206" stroke={c.glow} strokeWidth="4" strokeLinecap="round" />
          <path d="M 130 198 L 130 208" stroke={c.glow} strokeWidth="4" strokeLinecap="round" />
          <path d="M 142 196 L 146 206" stroke={c.glow} strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case 'flippers':
      return (
        <g>
          {/* Flat wide flippers */}
          <path d="M 40 180 C 44 172, 90 172, 92 180 C 94 188, 44 196, 36 192 Z" fill={f} />
          <path d="M 160 180 C 156 172, 110 172, 108 180 C 106 188, 156 196, 164 192 Z" fill={f} />
          <path d="M 42 180 C 46 174, 88 174, 90 180" stroke="white" strokeWidth="1.5" fill="none" opacity={0.2} />
          <path d="M 158 180 C 154 174, 112 174, 110 180" stroke="white" strokeWidth="1.5" fill="none" opacity={0.2} />
        </g>
      );
    default: // none
      return null;
  }
}

// ─── TAIL ─────────────────────────────────────────────────────────────────────

// ─── NOSE ──────────────────────────────────────────────────────────────────────

export function NoseShape({ id, cy, color }: { id: NoseId; cy: number; color: string }) {
  const cx = 100;
  switch (id) {
    case 'button':
      return <circle cx={cx} cy={cy} r={4.5} fill={color} opacity={0.75} />;
    case 'cat':
      return (
        <path
          d={`M ${cx - 5} ${cy - 2} L ${cx} ${cy + 4} L ${cx + 5} ${cy - 2} Z`}
          fill={color} opacity={0.8}
        />
      );
    case 'led':
      return (
        <motion.circle cx={cx} cy={cy} r={4} fill={color}
          animate={{ opacity: [0.9, 0.3, 0.9], r: [4, 5, 4] }}
          transition={{ duration: 1.4, repeat: Infinity }}>
          <animate attributeName="r" values="4;5;4" dur="1.4s" repeatCount="indefinite" />
        </motion.circle>
      );
    case 'star': {
      let d = '';
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 5 : 2.2;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        d += `${i === 0 ? 'M' : 'L'} ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} `;
      }
      return <path d={d + 'Z'} fill={color} opacity={0.85} />;
    }
    case 'heart':
      return (
        <path
          d={`M ${cx} ${cy + 3.5} C ${cx - 6} ${cy - 2}, ${cx - 10} ${cy - 6}, ${cx} ${cy - 2} C ${cx + 10} ${cy - 6}, ${cx + 6} ${cy - 2}, ${cx} ${cy + 3.5} Z`}
          fill={color} opacity={0.82}
        />
      );
    default:
      return null;
  }
}

// ─── MOUTH STYLE ───────────────────────────────────────────────────────────────

export function MouthShape({ id, cy, hw, strokeColor }: { id: MouthStyleId; cy: number; hw: number; strokeColor: string }) {
  const cx = 100;
  if (id === 'auto') return null;

  switch (id) {
    case 'smile':
      return (
        <path d={`M ${cx - hw + 2} ${cy} Q ${cx} ${cy + 20} ${cx + hw - 2} ${cy}`}
          stroke={strokeColor} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      );
    case 'blush':
      return (
        <g>
          <path d={`M ${cx - hw + 6} ${cy + 4} Q ${cx} ${cy + 14} ${cx + hw - 6} ${cy + 4}`}
            stroke={strokeColor} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx={cx - hw + 2} cy={cy + 4} r={2.5} fill={strokeColor} opacity={0.5} />
          <circle cx={cx + hw - 2} cy={cy + 4} r={2.5} fill={strokeColor} opacity={0.5} />
        </g>
      );
    case 'fangs':
      return (
        <g>
          <path d={`M ${cx - hw + 4} ${cy} Q ${cx} ${cy + 16} ${cx + hw - 4} ${cy}`}
            stroke={strokeColor} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d={`M ${cx - 8} ${cy} L ${cx - 4} ${cy + 10}`}
            stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d={`M ${cx + 8} ${cy} L ${cx + 4} ${cy + 10}`}
            stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'pixel': {
      const blocks = [-8, -4, 0, 4, 8];
      return (
        <g>
          {blocks.map((dx, i) => (
            <rect key={i} x={cx + dx - 2} y={cy + (i % 2 === 0 ? 4 : 0)} width={4} height={4}
              fill={strokeColor} rx={0.5} />
          ))}
        </g>
      );
    }
    case 'zigzag': {
      const w = hw - 4;
      const pts = Array.from({ length: 7 }, (_, i) => {
        const x = cx - w + (i * w * 2) / 6;
        const y = cy + (i % 2 === 0 ? 0 : 10);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
      return <path d={pts} stroke={strokeColor} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    }
    case 'dot':
      return (
        <g>
          <circle cx={cx} cy={cy + 6} r={6} fill={strokeColor} opacity={0.8} />
          <circle cx={cx} cy={cy + 6} r={4} fill="rgba(0,0,0,0.25)" />
        </g>
      );
    default:
      return null;
  }
}

export function TailShape({ id, gradId, c, overrideFill }: PartProps & { id: TailId }) {
  const f = overrideFill ?? `url(#${gradId})`;
  switch (id) {
    case 'fluffy':
      return (
        <g>
          {/* Three stacked fluffy balls */}
          <circle cx="176" cy="148" r="24" fill={c.body2} />
          <circle cx="186" cy="124" r="20" fill={c.body2} />
          <circle cx="180" cy="102" r="16" fill={c.body2} />
          {/* Lighter overlay for fur depth */}
          <circle cx="176" cy="148" r="20" fill={f} opacity={0.65} />
          <circle cx="186" cy="124" r="16" fill={f} opacity={0.65} />
          <circle cx="180" cy="102" r="13" fill={f} opacity={0.65} />
          {/* Specular */}
          <ellipse cx="170" cy="140" rx="8" ry="6" fill="white" opacity={0.18} transform="rotate(-20 170 140)" />
          <ellipse cx="180" cy="118" rx="6" ry="5" fill="white" opacity={0.18} transform="rotate(-20 180 118)" />
        </g>
      );
    case 'long':
      return (
        <path
          d="M 161 154 C 186 140, 202 114, 198 86 C 195 68, 182 64, 176 76 C 183 90, 181 112, 165 142 Z"
          fill={f}
        />
      );
    case 'fan':
      return (
        <g>
          {/* Upper fan lobe */}
          <path d="M 158 148 C 186 128, 210 136, 202 160 C 196 176, 174 174, 162 158 Z" fill={f} />
          {/* Lower fan lobe */}
          <path d="M 158 148 C 186 160, 208 172, 198 192 C 190 206, 168 200, 160 180 Z" fill={f} />
          {/* Center rib */}
          <line x1="158" y1="148" x2="202" y2="160" stroke={c.glow} strokeWidth="1.5" opacity={0.4} strokeLinecap="round" />
          <line x1="158" y1="148" x2="198" y2="190" stroke={c.glow} strokeWidth="1.5" opacity={0.4} strokeLinecap="round" />
          {/* Highlight */}
          <path d="M 162 148 C 182 132, 196 140, 192 158 C 188 168, 174 168, 168 158 Z" fill="white" opacity={0.12} />
        </g>
      );
    case 'spiral':
      return (
        <g>
          {/* Thick stroke along spiral path = solid tail */}
          <path
            d="M 164 152 C 190 138, 204 112, 192 88 C 182 68, 166 66, 160 80 C 172 88, 182 104, 174 120 C 168 134, 158 140, 162 152"
            fill="none" stroke={c.body2} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M 164 152 C 190 138, 204 112, 192 88 C 182 68, 166 66, 160 80 C 172 88, 182 104, 174 120 C 168 134, 158 140, 162 152"
            fill="none" stroke={c.body1} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" opacity={0.65}
          />
          <path
            d="M 164 152 C 190 138, 204 112, 192 88 C 182 68, 166 66, 160 80 C 172 88, 182 104, 174 120 C 168 134, 158 140, 162 152"
            fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity={0.15}
          />
        </g>
      );
    case 'curly':
      return (
        <g>
          <path
            d="M 162 150 C 186 138, 196 120, 182 108 C 170 98, 156 106, 158 120 C 160 132, 172 132, 170 120"
            fill="none" stroke={c.body2} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M 162 150 C 186 138, 196 120, 182 108 C 170 98, 156 106, 158 120 C 160 132, 172 132, 170 120"
            fill="none" stroke={c.body1} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity={0.7}
          />
          <path
            d="M 162 150 C 186 138, 196 120, 182 108 C 170 98, 156 106, 158 120 C 160 132, 172 132, 170 120"
            fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.18}
          />
        </g>
      );
    case 'lightning':
      return (
        <g>
          {/* Zigzag lightning bolt tail */}
          <path d="M 158 148 L 190 120 L 174 118 L 204 82 L 186 82 L 210 52"
            stroke={c.glow} strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 158 148 L 190 120 L 174 118 L 204 82 L 186 82 L 210 52"
            stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.3} />
        </g>
      );
    case 'bow': {
      const bx = 176, by = 148;
      return (
        <g>
          {/* Ribbon/bow shape */}
          <path d={`M ${bx} ${by} C ${bx - 18} ${by - 22}, ${bx - 30} ${by - 6}, ${bx} ${by} C ${bx - 30} ${by + 6}, ${bx - 18} ${by + 22}, ${bx} ${by} Z`}
            fill={c.glow} opacity={0.9} />
          <path d={`M ${bx} ${by} C ${bx + 18} ${by - 22}, ${bx + 30} ${by - 6}, ${bx} ${by} C ${bx + 30} ${by + 6}, ${bx + 18} ${by + 22}, ${bx} ${by} Z`}
            fill={c.glow} opacity={0.9} />
          <circle cx={bx} cy={by} r={7} fill={c.body1} />
          <circle cx={bx} cy={by} r={4} fill={c.glow} opacity={0.7} />
          {/* Ribbon tails */}
          <path d={`M ${bx - 4} ${by + 4} C ${bx - 12} ${by + 16}, ${bx - 24} ${by + 20}, ${bx - 22} ${by + 30}`}
            stroke={c.glow} strokeWidth="4" fill="none" strokeLinecap="round" opacity={0.8} />
          <path d={`M ${bx + 4} ${by + 4} C ${bx + 12} ${by + 16}, ${bx + 24} ${by + 20}, ${bx + 22} ${by + 30}`}
            stroke={c.glow} strokeWidth="4" fill="none" strokeLinecap="round" opacity={0.8} />
        </g>
      );
    }
    default: // none
      return null;
  }
}
