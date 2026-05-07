import type { HeadId, EarsId, BodyPartId, LimbsId, TailId } from '../../data/petParts';

interface PartColors {
  body1: string;
  body2: string;
  glow: string;
  cheek: string;
}

interface PartProps {
  gradId: string;
  c: PartColors;
}

// ─── HEAD ─────────────────────────────────────────────────────────────────────

export function HeadShape({ id, gradId }: PartProps & { id: HeadId }) {
  const f = `url(#${gradId})`;
  switch (id) {
    case 'oval':
      return <ellipse cx="100" cy="80" rx="44" ry="58" fill={f} />;
    case 'square':
      return <rect x="50" y="26" width="100" height="96" rx="22" fill={f} />;
    case 'egg':
      // Wide puffy cheeks, narrower at top
      return (
        <path
          d="M 100 26 C 142 22, 168 50, 164 82 C 160 114, 138 132, 100 134 C 62 132, 40 114, 36 82 C 32 50, 58 22, 100 26 Z"
          fill={f}
        />
      );
    default: // round
      return <circle cx="100" cy="80" r="54" fill={f} />;
  }
}

// ─── EARS ─────────────────────────────────────────────────────────────────────

export function EarsShape({ id, gradId, c }: PartProps & { id: EarsId }) {
  const f = `url(#${gradId})`;
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
    default: // none
      return null;
  }
}

// ─── BODY ─────────────────────────────────────────────────────────────────────

export function BodyShape({ id, gradId }: PartProps & { id: BodyPartId }) {
  const f = `url(#${gradId})`;
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
    default: // chubby
      return (
        <>
          <path
            d="M 50 108 C 28 112, 16 132, 18 158 C 20 180, 46 196, 100 196 C 154 196, 180 180, 182 158 C 184 132, 172 112, 150 108 Z"
            fill={f}
          />
          {/* Belly shine */}
          <ellipse cx="100" cy="155" rx="24" ry="32" fill="white" opacity={0.08} />
        </>
      );
  }
}

// ─── LIMBS ────────────────────────────────────────────────────────────────────

export function LimbsShape({ id, gradId, c }: PartProps & { id: LimbsId }) {
  const f = `url(#${gradId})`;
  switch (id) {
    case 'small_paws':
      return (
        <g>
          {/* Two front paws at body bottom */}
          <ellipse cx="70" cy="194" rx="20" ry="12" fill={c.body2} />
          <ellipse cx="130" cy="194" rx="20" ry="12" fill={c.body2} />
          {/* Toe lines */}
          <line x1="63" y1="192" x2="63" y2="200" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="70" y1="193" x2="70" y2="201" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="77" y1="192" x2="77" y2="200" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="123" y1="192" x2="123" y2="200" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="130" y1="193" x2="130" y2="201" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
          <line x1="137" y1="192" x2="137" y2="200" stroke={c.body1} strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
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
          {/* Short rounded arms */}
          <path d="M 42 118 C 20 122, 14 144, 26 160 C 34 170, 50 166, 54 150 L 56 120 Z" fill={f} />
          <path d="M 158 118 C 180 122, 186 144, 174 160 C 166 170, 150 166, 146 150 L 144 120 Z" fill={f} />
          {/* Knuckle */}
          <circle cx="30" cy="158" r="6" fill={c.body2} opacity={0.75} />
          <circle cx="170" cy="158" r="6" fill={c.body2} opacity={0.75} />
        </g>
      );
    default: // none
      return null;
  }
}

// ─── TAIL ─────────────────────────────────────────────────────────────────────

export function TailShape({ id, gradId, c }: PartProps & { id: TailId }) {
  const f = `url(#${gradId})`;
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
    default: // none
      return null;
  }
}
