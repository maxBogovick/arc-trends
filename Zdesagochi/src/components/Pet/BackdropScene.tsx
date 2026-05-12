import { motion } from 'framer-motion';
import type { BackdropScene, BackdropType, WindowStyle } from '../../store/petStore';

// ── Sky body: sun or moon based on hour ──────────────────────────────────────

function getSkyBodyHour(hasSun: boolean, sunPreviewHour: number | null): number {
  if (!hasSun) return -1; // no sky body
  if (sunPreviewHour !== null) return sunPreviewHour;
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

function skyBodyPosition(hour: number): { x: number; y: number } {
  // arc from left (6h) to right (20h), peak at noon (13h)
  const sunriseH = 6, sunsetH = 20, peakH = 13;
  const t = (hour - sunriseH) / (sunsetH - sunriseH); // 0..1
  const x = 5 + t * 90; // 5%..95%
  // parabola: y = minY at peak, maxY at edges
  const distFromPeak = (hour - peakH) / (peakH - sunriseH);
  const y = 8 + distFromPeak * distFromPeak * 44; // 8%..52%
  return { x, y };
}

function isNightHour(hour: number) { return hour < 6 || hour >= 20; }

interface SkyBodyProps { hour: number; sceneW: number; sceneH: number }

function SkyBody({ hour, sceneW, sceneH }: SkyBodyProps) {
  if (hour < 0) return null;
  const night = isNightHour(hour);
  const pos = night
    // moon: mirror the arc using night progress
    ? (() => {
      const nightProgress = hour >= 20 ? (hour - 20) / 10 : (hour + 4) / 10;
      const x = 5 + nightProgress * 90;
      const distFromMid = (nightProgress - 0.5) * 2;
      const y = 5 + distFromMid * distFromMid * 35;
      return { x, y };
    })()
    : skyBodyPosition(hour);

  const cx = (pos.x / 100) * sceneW;
  const cy = (pos.y / 100) * sceneH;

  // color by hour
  const sunColor =
    hour < 7 || hour > 19 ? '#FFB347' :
      hour < 9 || hour > 17 ? '#FFD580' :
        '#FFFDE7';

  if (night) {
    return (
      <g>
        {/* single subtle halo — не размывает диск */}
        <circle cx={cx} cy={cy} r={26} fill="rgba(210,228,255,0.18)" />
        {/* moon disc — крупный и чёткий */}
        <circle cx={cx} cy={cy} r={20} fill="#ffffffff" />
        {/* crescent shadow */}
        <circle cx={cx + 12} cy={cy - 3} r={16} fill="#060E1C" />
        {/* крупные кратеры для читаемости */}
        <circle cx={cx - 5} cy={cy + 4} r={2.5} fill="rgba(130,145,200,0.45)" />
        <circle cx={cx - 7} cy={cy - 3} r={1.6} fill="rgba(130,145,200,0.38)" />
        <circle cx={cx - 2} cy={cy + 7} r={1.2} fill="rgba(130,145,200,0.32)" />
      </g>
    );
  }

  return (
    <g>
      {/* outer glow */}
      <motion.circle cx={cx} cy={cy} r={28} fill={sunColor} opacity={0.12}
        animate={{ r: [28, 33, 28] }} transition={{ duration: 4, repeat: Infinity }} />
      <motion.circle cx={cx} cy={cy} r={20} fill={sunColor} opacity={0.2}
        animate={{ r: [20, 23, 20] }} transition={{ duration: 3, repeat: Infinity }} />
      {/* sun disc */}
      <circle cx={cx} cy={cy} r={13} fill={sunColor} />
      <circle cx={cx - 3} cy={cy - 3} r={4} fill="rgba(255,255,255,0.35)" />
    </g>
  );
}

// ── Light rays through window ────────────────────────────────────────────────

interface RaysProps { hour: number; windowStyle: WindowStyle; sceneW: number; sceneH: number }

function LightRays({ hour, windowStyle, sceneW, sceneH }: RaysProps) {
  if (isNightHour(hour) || hour < 0) return null;

  const pos = skyBodyPosition(hour);
  // source point — sun projected onto window top edge
  const sx = (pos.x / 100) * sceneW;

  // warm in morning/evening, white at noon
  const warmth = Math.abs(hour - 13) / 7; // 0=noon, 1=edge
  const r = Math.round(255);
  const g = Math.round(220 + warmth * 20);
  const b = Math.round(180 - warmth * 80);
  const rayColor = `rgba(${r},${g},${b},`;

  // window bounds — approximate
  const wLeft = windowStyle === 'panoramic' ? sceneW * 0.08 : sceneW * 0.18;
  const wRight = windowStyle === 'panoramic' ? sceneW * 0.92 : sceneW * 0.82;
  const wTop = sceneH * 0.04;
  const wBot = windowStyle === 'arch' ? sceneH * 0.68 : sceneH * 0.62;

  // 3 rays fanning from sun position through window
  const rayTargets = [
    { x: wLeft + (wRight - wLeft) * 0.15, y: wBot },
    { x: wLeft + (wRight - wLeft) * 0.50, y: wBot },
    { x: wLeft + (wRight - wLeft) * 0.85, y: wBot },
  ];

  return (
    <g style={{ mixBlendMode: 'screen' }}>
      {rayTargets.map((t, i) => {
        const angle = Math.atan2(t.y - wTop, t.x - sx);
        const endX = t.x + Math.cos(angle) * sceneH * 0.6;
        const endY = t.y + Math.sin(angle) * sceneH * 0.6;
        return (
          <motion.polygon
            key={i}
            points={`${sx},${wTop} ${t.x - 14},${t.y} ${endX - 14},${endY} ${endX + 14},${endY} ${t.x + 14},${t.y}`}
            fill={`url(#ray_grad_${i})`}
            animate={{ opacity: [0.18, 0.28, 0.18] }}
            transition={{ duration: 3 + i * 0.7, repeat: Infinity, delay: i * 0.4 }}
          />
        );
      })}
      <defs>
        {rayTargets.map((t, i) => {
          const endY = t.y + (t.y - wTop) * 0.6;
          return (
            <linearGradient key={i} id={`ray_grad_${i}`} x1="0%" x2="0%"
              gradientUnits="userSpaceOnUse"
              y1={wTop} y2={endY}>
              <stop offset="0%" stopColor={rayColor + '0.55)'} />
              <stop offset="100%" stopColor={rayColor + '0)'} />
            </linearGradient>
          );
        })}
      </defs>
    </g>
  );
}

// ── Sky time darkening ────────────────────────────────────────────────────────

/** Returns [overlayOpacity, overlayColor] based on hour (-1 = no sun → no overlay) */
function computeSkyDarkness(hour: number): { opacity: number; color: string } {
  if (hour < 0) return { opacity: 0, color: '#010818' };

  // deep night
  if (hour < 5) return { opacity: 0.78, color: '#010818' };
  // dawn: 5→7 fade out
  if (hour < 7) return { opacity: 0.78 * (1 - (hour - 5) / 2), color: '#010818' };
  // full day
  if (hour < 17) return { opacity: 0, color: '#010818' };
  // sunset warm tint: 17→19
  if (hour < 19) {
    const t = (hour - 17) / 2; // 0→1
    return { opacity: t * 0.30, color: '#200A30' };
  }
  // dusk: 19→20
  if (hour < 20) {
    const t = (hour - 19); // 0→1
    return { opacity: 0.30 + t * 0.48, color: '#0A0F20' };
  }
  // night
  return { opacity: 0.78, color: '#010818' };
}

interface TimeOverlayProps { hour: number; w: number; h: number }

function SkyTimeOverlay({ hour, w, h }: TimeOverlayProps) {
  const { opacity, color } = computeSkyDarkness(hour);
  if (opacity <= 0) return null;
  return <rect x={0} y={0} width={w} height={h} fill={color} opacity={opacity} style={{ pointerEvents: 'none' }} />;
}

function NightStars({ hour, w, h }: TimeOverlayProps) {
  const { opacity } = computeSkyDarkness(hour);
  if (opacity <= 0.05) return null;
  const starsOpacity = Math.min(1, opacity / 0.6);

  const stars = Array.from({ length: 45 }, (_, i) => ({
    x: (((i * 137.508) % 100) / 100) * w,
    y: (((i * 98.61) % 80) / 100) * h,
    r: 0.5 + (i % 4) * 0.4,
    twinkleDelay: (i % 7) * 0.45,
    twinkleDur: 1.8 + (i % 5) * 0.5,
  }));

  return (
    <g opacity={starsOpacity}>
      {stars.map((s, i) => (
        <motion.circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white"
          animate={{ opacity: [0.35, 0.95, 0.35] }}
          transition={{ duration: s.twinkleDur, repeat: Infinity, delay: s.twinkleDelay }} />
      ))}
    </g>
  );
}

// ── Landscape scenes ─────────────────────────────────────────────────────────

function SceneGarden({ w, h }: { w: number; h: number }) {
  const gy = h * 0.62;
  return (
    <g>
      {/* sky */}
      <defs>
        <linearGradient id="sky_garden" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#87CEEB" />
          <stop offset="100%" stopColor="#C9E8F5" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#sky_garden)" />
      {/* clouds */}
      {[[0.15, 0.18, 52], [0.55, 0.1, 70], [0.78, 0.22, 44]].map(([cx, cy, cw], i) => (
        <g key={i} opacity={0.9}>
          <ellipse cx={cx * w} cy={cy * h} rx={cw} ry={cw * 0.38} fill="white" />
          <ellipse cx={cx * w + cw * 0.3} cy={cy * h - cw * 0.15} rx={cw * 0.55} ry={cw * 0.32} fill="white" />
          <ellipse cx={cx * w - cw * 0.28} cy={cy * h - cw * 0.1} rx={cw * 0.45} ry={cw * 0.28} fill="white" />
        </g>
      ))}
      {/* distant hills */}
      <ellipse cx={w * 0.25} cy={gy + 10} rx={w * 0.38} ry={h * 0.22} fill="#7DBF72" opacity={0.7} />
      <ellipse cx={w * 0.78} cy={gy + 14} rx={w * 0.32} ry={h * 0.18} fill="#6AB55F" opacity={0.7} />
      {/* grass */}
      <rect x={0} y={gy} width={w} height={h - gy} fill="#5BA84E" />
      <ellipse cx={w * 0.5} cy={gy} rx={w * 0.7} ry={h * 0.07} fill="#68C45A" />
      {/* flowers */}
      {[[0.12, 0.68], [0.28, 0.72], [0.68, 0.7], [0.85, 0.67]].map(([fx, fy], i) => (
        <g key={i}>
          <line x1={fx * w} y1={fy * h} x2={fx * w} y2={(fy + 0.07) * h} stroke="#3A7A30" strokeWidth={2} />
          <circle cx={fx * w} cy={fy * h} r={5} fill={['#FFE44D', '#FF8FA3', '#C084FC', '#FFB347'][i]} />
        </g>
      ))}
      {/* tree left */}
      <rect x={w * 0.07} y={gy - h * 0.28} width={8} height={h * 0.3} fill="#5C3D1E" />
      <ellipse cx={w * 0.08} cy={gy - h * 0.28} rx={w * 0.09} ry={h * 0.18} fill="#4A9440" />
      <ellipse cx={w * 0.08} cy={gy - h * 0.3} rx={w * 0.07} ry={h * 0.14} fill="#5BB050" />
      {/* tree right */}
      <rect x={w * 0.88} y={gy - h * 0.22} width={7} height={h * 0.25} fill="#5C3D1E" />
      <ellipse cx={w * 0.89} cy={gy - h * 0.22} rx={w * 0.08} ry={h * 0.16} fill="#4A9440" />
      <ellipse cx={w * 0.89} cy={gy - h * 0.24} rx={w * 0.06} ry={h * 0.12} fill="#5BB050" />
    </g>
  );
}

function SceneOcean({ w, h }: { w: number; h: number }) {
  const wy = h * 0.55;
  return (
    <g>
      <defs>
        <linearGradient id="sky_ocean" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#1A6BAA" />
          <stop offset="100%" stopColor="#5BB8E8" />
        </linearGradient>
        <linearGradient id="sea_grad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#1B6CA8" />
          <stop offset="100%" stopColor="#0A3C6E" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={wy} fill="url(#sky_ocean)" />
      {/* horizon glow */}
      <ellipse cx={w * 0.5} cy={wy} rx={w * 0.6} ry={h * 0.06} fill="rgba(255,220,120,0.18)" />
      {/* clouds */}
      {[[0.2, 0.14, 48], [0.65, 0.08, 60]].map(([cx, cy, cw], i) => (
        <g key={i} opacity={0.85}>
          <ellipse cx={cx * w} cy={cy * h} rx={cw} ry={cw * 0.36} fill="white" />
          <ellipse cx={cx * w + cw * 0.28} cy={cy * h - cw * 0.14} rx={cw * 0.5} ry={cw * 0.3} fill="white" />
        </g>
      ))}
      {/* sea */}
      <rect x={0} y={wy} width={w} height={h - wy} fill="url(#sea_grad)" />
      {/* waves */}
      {[0, 1, 2, 3].map(i => (
        <motion.path key={i}
          d={`M 0 ${wy + 10 + i * 14} Q ${w * 0.25} ${wy + 4 + i * 14} ${w * 0.5} ${wy + 10 + i * 14} Q ${w * 0.75} ${wy + 16 + i * 14} ${w} ${wy + 10 + i * 14}`}
          stroke="rgba(180,220,255,0.45)" strokeWidth={1.5} fill="none"
          animate={{ y: [-3, 3, -3] }}
          transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
      {/* shimmer */}
      {[[0.3, 0.65], [0.55, 0.72], [0.7, 0.62]].map(([sx, sy], i) => (
        <motion.ellipse key={i} cx={sx * w} cy={sy * h} rx={18} ry={3} fill="rgba(255,255,220,0.22)"
          animate={{ opacity: [0.1, 0.35, 0.1] }} transition={{ duration: 2 + i * 0.5, repeat: Infinity }} />
      ))}
    </g>
  );
}

function SceneMountains({ w, h }: { w: number; h: number }) {
  return (
    <g>
      <defs>
        <linearGradient id="sky_mnt" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#2C5F8A" />
          <stop offset="60%" stopColor="#7AB3D4" />
          <stop offset="100%" stopColor="#B8D8EC" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#sky_mnt)" />
      {/* far mountains */}
      <polygon points={`0,${h * 0.72} ${w * 0.18},${h * 0.28} ${w * 0.36},${h * 0.72}`} fill="#6B8FA8" opacity={0.6} />
      <polygon points={`${w * 0.28},${h * 0.72} ${w * 0.5},${h * 0.18} ${w * 0.72},${h * 0.72}`} fill="#5A7E9A" opacity={0.7} />
      <polygon points={`${w * 0.6},${h * 0.72} ${w * 0.82},${h * 0.32} ${w},${h * 0.72}`} fill="#6B8FA8" opacity={0.6} />
      {/* near mountains */}
      <polygon points={`0,${h * 0.8} ${w * 0.22},${h * 0.35} ${w * 0.44},${h * 0.8}`} fill="#4A6E58" />
      <polygon points={`${w * 0.35},${h * 0.8} ${w * 0.58},${h * 0.22} ${w * 0.82},${h * 0.8}`} fill="#3D6050" />
      <polygon points={`${w * 0.7},${h * 0.8} ${w * 0.88},${h * 0.38} ${w},${h * 0.8}`} fill="#4A6E58" />
      {/* snow caps */}
      <polygon points={`${w * 0.22},${h * 0.35} ${w * 0.17},${h * 0.46} ${w * 0.27},${h * 0.46}`} fill="rgba(255,255,255,0.85)" />
      <polygon points={`${w * 0.58},${h * 0.22} ${w * 0.51},${h * 0.38} ${w * 0.65},${h * 0.38}`} fill="rgba(255,255,255,0.9)" />
      <polygon points={`${w * 0.88},${h * 0.38} ${w * 0.83},${h * 0.48} ${w * 0.93},${h * 0.48}`} fill="rgba(255,255,255,0.8)" />
      {/* mist */}
      <rect x={0} y={h * 0.68} width={w} height={h * 0.12} fill="rgba(200,220,235,0.22)" />
      {/* ground */}
      <rect x={0} y={h * 0.78} width={w} height={h * 0.22} fill="#2E5238" />
      <ellipse cx={w * 0.5} cy={h * 0.78} rx={w * 0.65} ry={h * 0.06} fill="#3A6444" />
    </g>
  );
}

function SceneSpace({ w, h }: { w: number; h: number }) {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    x: (((i * 137.5) % 100) / 100) * w,
    y: (((i * 97.3) % 100) / 100) * h * 0.88,
    r: 0.6 + (i % 3) * 0.5,
    delay: i * 0.08,
  }));
  return (
    <g>
      <defs>
        <radialGradient id="space_bg" cx="40%" cy="35%" r="70%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#1A0A3C" />
          <stop offset="50%" stopColor="#0A0520" />
          <stop offset="100%" stopColor="#020008" />
        </radialGradient>
        <radialGradient id="nebula1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nebula2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#space_bg)" />
      {/* nebulae */}
      <ellipse cx={w * 0.3} cy={h * 0.35} rx={w * 0.38} ry={h * 0.3} fill="url(#nebula1)" />
      <ellipse cx={w * 0.72} cy={h * 0.5} rx={w * 0.32} ry={h * 0.28} fill="url(#nebula2)" />
      {/* stars */}
      {stars.map((s, i) => (
        <motion.circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2 + s.delay, repeat: Infinity, delay: s.delay }} />
      ))}
      {/* planet */}
      <circle cx={w * 0.78} cy={h * 0.22} r={22} fill="#C084FC" opacity={0.8} />
      <circle cx={w * 0.78} cy={h * 0.22} r={22} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={6} />
      <ellipse cx={w * 0.78} cy={h * 0.22} rx={32} ry={7} fill="none" stroke="rgba(192,132,252,0.4)" strokeWidth={3} />
      <circle cx={w * 0.74} cy={h * 0.19} r={8} fill="rgba(168,85,247,0.5)" />
      {/* ground/horizon */}
      <rect x={0} y={h * 0.82} width={w} height={h * 0.18} fill="#0D0520" />
      <ellipse cx={w * 0.5} cy={h * 0.82} rx={w * 0.7} ry={h * 0.05} fill="#150A30" />
    </g>
  );
}

function SceneCity({ w, h }: { w: number; h: number }) {
  const buildings = [
    { x: 0, bw: w * 0.15, bh: h * 0.55 },
    { x: w * 0.12, bw: w * 0.12, bh: h * 0.42 },
    { x: w * 0.22, bw: w * 0.18, bh: h * 0.65 },
    { x: w * 0.38, bw: w * 0.14, bh: h * 0.48 },
    { x: w * 0.5, bw: w * 0.1, bh: h * 0.72 },
    { x: w * 0.58, bw: w * 0.16, bh: h * 0.52 },
    { x: w * 0.72, bw: w * 0.13, bh: h * 0.60 },
    { x: w * 0.83, bw: w * 0.17, bh: h * 0.44 },
  ];
  return (
    <g>
      <defs>
        <linearGradient id="sky_city" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#050A18" />
          <stop offset="60%" stopColor="#0D1A3A" />
          <stop offset="100%" stopColor="#1A2850" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#sky_city)" />
      {/* moon in city */}
      <circle cx={w * 0.82} cy={h * 0.12} r={14} fill="#D0D8F0" opacity={0.7} />
      <circle cx={w * 0.87} cy={h * 0.1} r={11} fill="#0D1A3A" opacity={0.6} />
      {/* stars */}
      {[[0.1, 0.06], [0.28, 0.1], [0.45, 0.05], [0.62, 0.08], [0.15, 0.18], [0.55, 0.15]].map(([sx, sy], i) => (
        <motion.circle key={i} cx={sx * w} cy={sy * h} r={1} fill="white" opacity={0.6}
          animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 2 + i * 0.4, repeat: Infinity }} />
      ))}
      {/* buildings */}
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={h - b.bh} width={b.bw} height={b.bh}
            fill={`hsl(220, 20%, ${10 + i * 3}%)`} />
          {/* windows */}
          {Array.from({ length: Math.floor(b.bh / 18) }, (_, row) =>
            Array.from({ length: Math.floor(b.bw / 12) }, (_, col) => {
              const on = Math.random() > 0.45;
              return on ? (
                <motion.rect key={`${row}-${col}`}
                  x={b.x + col * 12 + 3} y={h - b.bh + row * 18 + 5}
                  width={6} height={8} rx={1}
                  fill={`hsl(${40 + col * 10}, 80%, 75%)`} opacity={0.7}
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 3 + row * 0.3, repeat: Infinity, delay: col * 0.4 }} />
              ) : null;
            })
          )}
        </g>
      ))}
      {/* ground reflection */}
      <rect x={0} y={h * 0.82} width={w} height={h * 0.18} fill="#080F1E" />
    </g>
  );
}

function SceneSakura({ w, h }: { w: number; h: number }) {
  const gy = h * 0.65;
  const petals = Array.from({ length: 18 }, (_, i) => ({
    x: (((i * 131) % 100) / 100) * w,
    y: (((i * 73) % 70) / 100) * h,
    size: 4 + (i % 3) * 3,
    delay: i * 0.3,
  }));
  return (
    <g>
      <defs>
        <linearGradient id="sky_sakura" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFB7C5" />
          <stop offset="100%" stopColor="#FFDDE5" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#sky_sakura)" />
      {/* ground */}
      <rect x={0} y={gy} width={w} height={h - gy} fill="#C8E8A0" />
      <ellipse cx={w * 0.5} cy={gy} rx={w * 0.8} ry={h * 0.06} fill="#D4EEA8" />
      {/* path */}
      <ellipse cx={w * 0.5} cy={gy + h * 0.12} rx={w * 0.12} ry={h * 0.15} fill="#C8B88A" opacity={0.5} />
      {/* trunk left */}
      <rect x={w * 0.06} y={gy - h * 0.35} width={10} height={h * 0.37} fill="#6B3F1E" />
      <rect x={w * 0.06 + 2} y={gy - h * 0.22} width={5} height={3} fill="#6B3F1E"
        transform={`rotate(-30 ${w * 0.07} ${gy - h * 0.22})`} />
      {/* blossom left */}
      <ellipse cx={w * 0.1} cy={gy - h * 0.35} rx={w * 0.14} ry={h * 0.22} fill="#FFAAC0" opacity={0.85} />
      <ellipse cx={w * 0.07} cy={gy - h * 0.38} rx={w * 0.1} ry={h * 0.16} fill="#FFB8CC" />
      {/* trunk right */}
      <rect x={w * 0.86} y={gy - h * 0.3} width={9} height={h * 0.32} fill="#6B3F1E" />
      <ellipse cx={w * 0.89} cy={gy - h * 0.3} rx={w * 0.12} ry={h * 0.2} fill="#FFAAC0" opacity={0.85} />
      <ellipse cx={w * 0.87} cy={gy - h * 0.33} rx={w * 0.09} ry={h * 0.14} fill="#FFB8CC" />
      {/* floating petals */}
      {petals.map((p, i) => (
        <motion.g key={i}
          animate={{ y: [0, h * 0.3], x: [0, (i % 2 === 0 ? 1 : -1) * 30], opacity: [0.8, 0], rotate: [0, 180] }}
          transition={{ duration: 4 + p.delay, repeat: Infinity, delay: p.delay, ease: 'linear' }}
          style={{ originX: p.x, originY: p.y }}>
          <ellipse cx={p.x} cy={p.y} rx={p.size} ry={p.size * 0.6} fill="#FFB8CC" opacity={0.8} />
        </motion.g>
      ))}
    </g>
  );
}

function SceneDesert({ w, h }: { w: number; h: number }) {
  const gy = h * 0.6;
  return (
    <g>
      <defs>
        <linearGradient id="sky_desert" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#1A0A00" />
          <stop offset="40%" stopColor="#8B2E00" />
          <stop offset="70%" stopColor="#E8700A" />
          <stop offset="100%" stopColor="#FFBC4A" />
        </linearGradient>
        <linearGradient id="sand_grad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#D4995A" />
          <stop offset="100%" stopColor="#A87040" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#sky_desert)" />
      {/* dune silhouettes */}
      <ellipse cx={w * 0.2} cy={gy + h * 0.06} rx={w * 0.45} ry={h * 0.18} fill="#8B5A2B" />
      <ellipse cx={w * 0.75} cy={gy + h * 0.1} rx={w * 0.4} ry={h * 0.16} fill="#7A4E24" />
      <rect x={0} y={gy} width={w} height={h - gy} fill="url(#sand_grad)" />
      <path d={`M 0 ${gy} Q ${w * 0.3} ${gy - h * 0.12} ${w * 0.55} ${gy} Q ${w * 0.75} ${gy + h * 0.06} ${w} ${gy - h * 0.04}`}
        fill="#C4854A" />
      {/* cactus */}
      <rect x={w * 0.72} y={gy - h * 0.3} width={8} height={h * 0.32} fill="#3A7A40" />
      <rect x={w * 0.72 - 14} y={gy - h * 0.18} width={14} height={5} fill="#3A7A40" />
      <rect x={w * 0.72 + 8} y={gy - h * 0.22} width={14} height={5} fill="#3A7A40" />
      <rect x={w * 0.72 - 14} y={gy - h * 0.22} width={5} height={h * 0.06} fill="#3A7A40" />
      <rect x={w * 0.72 + 17} y={gy - h * 0.26} width={5} height={h * 0.07} fill="#3A7A40" />
      {/* small cactus */}
      <rect x={w * 0.18} y={gy - h * 0.16} width={5} height={h * 0.18} fill="#3A7A40" />
    </g>
  );
}

function SceneWinter({ w, h }: { w: number; h: number }) {
  const gy = h * 0.62;
  const snowflakes = Array.from({ length: 20 }, (_, i) => ({
    x: (((i * 139) % 100) / 100) * w,
    y: (((i * 83) % 90) / 100) * h,
    r: 1 + (i % 3),
    delay: i * 0.25,
  }));
  return (
    <g>
      <defs>
        <linearGradient id="sky_winter" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#8AA8C8" />
          <stop offset="100%" stopColor="#C8DCF0" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#sky_winter)" />
      {/* distant trees silhouette */}
      {[0.05, 0.18, 0.3, 0.55, 0.68, 0.8, 0.92].map((tx, i) => (
        <g key={i}>
          <polygon points={`${tx * w},${gy - h * 0.32} ${tx * w - 14},${gy} ${tx * w + 14},${gy}`}
            fill={`hsl(210, 20%, ${25 + i * 3}%)`} />
          <polygon points={`${tx * w},${gy - h * 0.38} ${tx * w - 10},${gy - h * 0.22} ${tx * w + 10},${gy - h * 0.22}`}
            fill={`hsl(210, 18%, ${28 + i * 3}%)`} />
          {/* snow on branches */}
          <ellipse cx={tx * w} cy={gy - h * 0.38} rx={8} ry={3} fill="rgba(255,255,255,0.8)" />
          <ellipse cx={tx * w} cy={gy - h * 0.26} rx={11} ry={3} fill="rgba(255,255,255,0.7)" />
        </g>
      ))}
      {/* snow ground */}
      <rect x={0} y={gy} width={w} height={h - gy} fill="#E8F4FC" />
      <ellipse cx={w * 0.5} cy={gy} rx={w * 0.7} ry={h * 0.07} fill="white" />
      {/* snowflakes */}
      {snowflakes.map((s, i) => (
        <motion.circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={0.75}
          animate={{ y: [0, h * 0.25], opacity: [0.8, 0] }}
          transition={{ duration: 5 + s.delay, repeat: Infinity, delay: s.delay, ease: 'linear' }} />
      ))}
    </g>
  );
}

function Scene({ scene, w, h, hour }: { scene: BackdropScene; w: number; h: number; hour: number }) {
  return (
    <>
      {(() => {
        switch (scene) {
          case 'garden': return <SceneGarden w={w} h={h} />;
          case 'ocean': return <SceneOcean w={w} h={h} />;
          case 'mountains': return <SceneMountains w={w} h={h} />;
          case 'space': return <SceneSpace w={w} h={h} />;
          case 'city': return <SceneCity w={w} h={h} />;
          case 'sakura': return <SceneSakura w={w} h={h} />;
          case 'desert': return <SceneDesert w={w} h={h} />;
          case 'winter': return <SceneWinter w={w} h={h} />;
        }
      })()}
      {/* night stars appear on all scenes except space/city which already have own stars */}
      {scene !== 'space' && scene !== 'city' && <NightStars hour={hour} w={w} h={h} />}
      <SkyTimeOverlay hour={hour} w={w} h={h} />
    </>
  );
}

// ── Window frame ─────────────────────────────────────────────────────────────

function WindowFrame({ style, w, h }: { style: WindowStyle; w: number; h: number }) {
  const frameColor = '#D4C4A0';
  const frameColor2 = '#B8A880';
  const thickness = 10;
  const shadow = 'rgba(0,0,0,0.45)';

  if (style === 'classic') {
    // Rectangle with cross divider
    const L = w * 0.18, R = w * 0.82, T = h * 0.06, B = h * 0.62;
    const mx = (L + R) / 2, my = (T + B) / 2;
    return (
      <g>
        {/* frame shadow */}
        <rect x={L + 3} y={T + 3} width={R - L} height={B - T} rx={3} fill={shadow} opacity={0.4} />
        {/* outer frame */}
        <rect x={L} y={T} width={R - L} height={B - T} rx={3} fill="none"
          stroke={frameColor} strokeWidth={thickness} />
        {/* cross dividers */}
        <line x1={mx} y1={T} x2={mx} y2={B} stroke={frameColor} strokeWidth={thickness * 0.6} />
        <line x1={L} y1={my} x2={R} y2={my} stroke={frameColor} strokeWidth={thickness * 0.6} />
        {/* inner highlight */}
        <rect x={L + 2} y={T + 2} width={R - L - 4} height={B - T - 4} rx={2} fill="none"
          stroke={frameColor2} strokeWidth={1.5} opacity={0.5} />
        {/* sill */}
        <rect x={L - 8} y={B} width={R - L + 16} height={12} rx={3} fill={frameColor2} />
      </g>
    );
  }

  if (style === 'arch') {
    const L = w * 0.2, R = w * 0.8, T = h * 0.05, B = h * 0.68;
    const midX = (L + R) / 2;
    const archR = (R - L) / 2;
    const archCY = T + archR;
    const rectT = archCY;
    return (
      <g>
        {/* shadow */}
        <path d={`M ${L + 3} ${B + 3} L ${L + 3} ${archCY} A ${archR} ${archR} 0 0 1 ${R + 3} ${archCY} L ${R + 3} ${B + 3} Z`}
          fill={shadow} opacity={0.35} />
        {/* frame path */}
        <path d={`M ${L} ${B} L ${L} ${archCY} A ${archR} ${archR} 0 0 1 ${R} ${archCY} L ${R} ${B} Z`}
          fill="none" stroke={frameColor} strokeWidth={thickness} />
        {/* center divider */}
        <line x1={midX} y1={rectT} x2={midX} y2={B} stroke={frameColor} strokeWidth={thickness * 0.55} />
        {/* horizontal bar */}
        <line x1={L} y1={(rectT + B) * 0.5} x2={R} y2={(rectT + B) * 0.5} stroke={frameColor} strokeWidth={thickness * 0.5} />
        {/* arch radial lines */}
        {[-0.45, 0, 0.45].map((a, i) => {
          const angle = Math.PI * (0.25 + a * 0.45);
          return <line key={i}
            x1={midX} y1={archCY}
            x2={midX + Math.cos(angle) * archR}
            y2={archCY - Math.sin(angle) * archR}
            stroke={frameColor} strokeWidth={thickness * 0.5} />;
        })}
        {/* sill */}
        <rect x={L - 8} y={B} width={R - L + 16} height={12} rx={3} fill={frameColor2} />
      </g>
    );
  }

  // panoramic — wide thin frame
  const L = w * 0.06, R = w * 0.94, T = h * 0.04, B = h * 0.64;
  const t3 = (L + (R - L) / 3), t6 = (L + (R - L) * 2 / 3);
  return (
    <g>
      <rect x={L + 3} y={T + 3} width={R - L} height={B - T} rx={2} fill={shadow} opacity={0.3} />
      <rect x={L} y={T} width={R - L} height={B - T} rx={2} fill="none"
        stroke={frameColor} strokeWidth={thickness * 0.65} />
      <line x1={t3} y1={T} x2={t3} y2={B} stroke={frameColor} strokeWidth={thickness * 0.4} />
      <line x1={t6} y1={T} x2={t6} y2={B} stroke={frameColor} strokeWidth={thickness * 0.4} />
      <rect x={L - 6} y={B} width={R - L + 12} height={10} rx={2} fill={frameColor2} />
    </g>
  );
}

// ── Clip path for window glass area ─────────────────────────────────────────

function windowClipPath(style: WindowStyle, w: number, h: number, id: string) {
  if (style === 'classic') {
    const L = w * 0.18 + 5, R = w * 0.82 - 5, T = h * 0.06 + 5, B = h * 0.62 - 5;
    return <clipPath id={id}><rect x={L} y={T} width={R - L} height={B - T} /></clipPath>;
  }
  if (style === 'arch') {
    const L = w * 0.2 + 5, R = w * 0.8 - 5, T = h * 0.05 + 5, B = h * 0.68 - 5;
    const archR = (R - L) / 2, archCY = T + archR;
    return (
      <clipPath id={id}>
        <path d={`M ${L} ${B} L ${L} ${archCY} A ${archR} ${archR} 0 0 1 ${R} ${archCY} L ${R} ${B} Z`} />
      </clipPath>
    );
  }
  // panoramic
  const L = w * 0.06 + 4, R = w * 0.94 - 4, T = h * 0.04 + 4, B = h * 0.64 - 4;
  return <clipPath id={id}><rect x={L} y={T} width={R - L} height={B - T} /></clipPath>;
}

// ── Wall mask (covers outside of window when type=window) ────────────────────

function WallMask({ style, w, h, wallStyle }: { style: WindowStyle; w: number; h: number; wallStyle: React.CSSProperties }) {
  // For SVG we approximate wall color — use a neutral fallback drawn as rect
  // The actual wall background is behind the SVG (CSS), so we just cut out the window
  // by drawing wall-colored rects around the window area.
  const bg = (wallStyle.background as string) ?? '#0D0020';

  if (style === 'classic') {
    const L = w * 0.18, R = w * 0.82, T = h * 0.06, B = h * 0.62;
    return (
      <g>
        <rect x={0} y={0} width={L} height={h} fill={bg} />
        <rect x={R} y={0} width={w - R} height={h} fill={bg} />
        <rect x={0} y={0} width={w} height={T} fill={bg} />
        <rect x={0} y={B} width={w} height={h - B} fill={bg} />
      </g>
    );
  }
  if (style === 'arch') {
    const L = w * 0.2, R = w * 0.8, T = h * 0.05, B = h * 0.68;
    const archR = (R - L) / 2, archCY = T + archR;
    return (
      <g>
        <rect x={0} y={0} width={L} height={h} fill={bg} />
        <rect x={R} y={0} width={w - R} height={h} fill={bg} />
        <rect x={0} y={0} width={w} height={T} fill={bg} />
        <rect x={0} y={B} width={w} height={h - B} fill={bg} />
        {/* fill arch corners */}
        <path d={`M ${L} ${T} L ${L} ${archCY} A ${archR} ${archR} 0 0 1 ${R} ${archCY} L ${R} ${T} Z`}
          fill={bg} />
      </g>
    );
  }
  // panoramic
  const L = w * 0.06, R = w * 0.94, T = h * 0.04, B = h * 0.64;
  return (
    <g>
      <rect x={0} y={0} width={L} height={h} fill={bg} />
      <rect x={R} y={0} width={w - R} height={h} fill={bg} />
      <rect x={0} y={0} width={w} height={T} fill={bg} />
      <rect x={0} y={B} width={w} height={h - B} fill={bg} />
    </g>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface BackdropProps {
  backdropType: BackdropType;
  backdropScene: BackdropScene;
  windowStyle: WindowStyle;
  hasSun: boolean;
  sunPreviewHour: number | null;
  width: number;
  height: number;
  backWallCssStyle: React.CSSProperties;
}

export function BackdropScene({
  backdropType,
  backdropScene,
  windowStyle,
  hasSun,
  sunPreviewHour,
  width: w,
  height: h,
  backWallCssStyle,
}: BackdropProps) {
  if (backdropType === 'wall') return null;

  const hour = getSkyBodyHour(hasSun, sunPreviewHour);
  const clipId = `win_clip_${windowStyle}`;

  if (backdropType === 'panorama') {
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%" height="100%"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        preserveAspectRatio="xMidYMid slice"
      >
        <Scene scene={backdropScene} w={w} h={h} hour={hour} />
        <SkyBody hour={hour} sceneW={w} sceneH={h} />
      </svg>
    );
  }

  // window mode
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%" height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {windowClipPath(windowStyle, w, h, clipId)}
      </defs>

      {/* scene visible only through window glass */}
      <g clipPath={`url(#${clipId})`}>
        <Scene scene={backdropScene} w={w} h={h} hour={hour} />
        <SkyBody hour={hour} sceneW={w} sceneH={h} />
        {/* glass tint */}
        <rect x={0} y={0} width={w} height={h} fill="rgba(180,210,240,0.06)" />
      </g>

      {/* wall around window */}
      <WallMask style={windowStyle} w={w} h={h} wallStyle={backWallCssStyle} />

      {/* light rays on top of everything (no floor spot) */}
      <LightRays hour={hour} windowStyle={windowStyle} sceneW={w} sceneH={h} />

      {/* window frame on top */}
      <WindowFrame style={windowStyle} w={w} h={h} />
    </svg>
  );
}
