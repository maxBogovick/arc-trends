import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { SceneEffect } from '../../data/backgrounds';

const sr = (i: number, off = 0) => ((i * 137 + off * 31) % 100) / 100;
const SCR: React.CSSProperties = { mixBlendMode: 'screen' };

/* ─── Dust (subtle atmosphere, replaces old Particles) ──────────────────────── */
function Dust({ color, count = 14 }: { color: string; count?: number }) {
  const items = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x:   sr(i, 0) * 88 + 6,
    y:   sr(i, 1) * 78 + 8,
    sz:  sr(i, 2) * 1.4 + 0.7,          // 0.7–2.1px
    dur: sr(i, 3) * 10 + 14,            // 14–24s (very slow)
    del: sr(i, 4) * 10,
    dy:  (sr(i, 5) - 0.5) * 10,         // ±5px drift
    dx:  (sr(i, 6) - 0.5) * 6,          // ±3px drift
    maxOp: sr(i, 7) * 0.12 + 0.04,      // 0.04–0.16 opacity max
  })), [count]);

  return (
    <div className="absolute inset-0 pointer-events-none" style={SCR}>
      {items.map((p, i) => (
        <motion.div key={i} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          transform: 'translate(-50%,-50%)',
          width: p.sz, height: p.sz, borderRadius: '50%',
          background: color,
          boxShadow: `0 0 ${p.sz * 4}px ${p.sz * 1.5}px ${color}`,
        }}
          animate={{
            y: [0, p.dy, 0],
            x: [0, p.dx, 0],
            opacity: [0, p.maxOp, 0],
          }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.del, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ─── Stars ──────────────────────────────────────────────────────────────────── */
function Stars({ count = 32 }: { count?: number }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: sr(i, 0) * 96 + 2, y: sr(i, 1) * 95 + 2,
    r: sr(i, 2) * 2 + 0.4,
    dur: sr(i, 3) * 3 + 1.5, del: sr(i, 4) * 5,
    bright: i < Math.ceil(count * 0.25),
  })), [count]);
  const shoots = useMemo(() => Array.from({ length: 3 }, (_, i) => ({
    x1: sr(i + 60, 0) * 50 + 5, y1: sr(i + 60, 1) * 30 + 5,
    len: sr(i + 60, 5) * 45 + 25, ang: sr(i + 60, 6) * 35 + 15,
    dur: sr(i + 60, 3) * 0.6 + 0.5, repDel: sr(i + 60, 4) * 7 + 5,
  })), []);
  return (
    <>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { x: '28%', y: '22%', w: 145, h: 105, c: '#5040D0', op: 0.2  },
          { x: '74%', y: '66%', w: 100, h: 80,  c: '#901880', op: 0.14 },
        ].map((n, i) => (
          <motion.div key={i} style={{
            position: 'absolute', left: n.x, top: n.y,
            transform: 'translate(-50%,-50%)',
            width: n.w, height: n.h, borderRadius: '50%',
            background: n.c, opacity: n.op, filter: 'blur(28px)',
          }}
            animate={{ scale: [1, 1.15, 1], opacity: [n.op, n.op * 1.6, n.op] }}
            transition={{ duration: 8 + i * 5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible', mixBlendMode: 'screen' }}>
        {stars.map((s, i) => (
          <motion.circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r}
            fill={s.bright ? 'white' : '#8899BB'}
            animate={{ opacity: [0.06, s.bright ? 1 : 0.5, 0.06], r: s.bright ? [s.r, s.r * 2, s.r] : [s.r, s.r, s.r] }}
            transition={{ duration: s.dur, repeat: Infinity, delay: s.del, ease: 'easeInOut' }}
          />
        ))}
        {shoots.map((s, i) => {
          const rad = (s.ang * Math.PI) / 180;
          return (
            <motion.line key={`sh${i}`}
              x1={`${s.x1}%`} y1={`${s.y1}%`}
              x2={`${s.x1 + s.len * Math.cos(rad)}%`} y2={`${s.y1 + s.len * Math.sin(rad) * 0.5}%`}
              stroke="white" strokeWidth={1.8} strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 3px white)' }}
              animate={{ opacity: [0, 0.95, 0] }}
              transition={{ duration: s.dur, repeat: Infinity, repeatDelay: s.repDel, ease: 'easeOut' }}
            />
          );
        })}
      </svg>
    </>
  );
}

/* ─── Rain ───────────────────────────────────────────────────────────────────── */
const RAIN_CSS = `
@keyframes neonRain{0%{transform:translateY(-70px) translateX(0);opacity:0}8%{opacity:1}88%{opacity:.8}100%{transform:translateY(320px) translateX(-22px);opacity:0}}
@keyframes splash{0%{transform:translate(-50%,-50%) scale(.2);opacity:.7}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}`;
function Rain({ color }: { color: string }) {
  const drops = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    x: sr(i, 0) * 96, w: sr(i, 1) * 1.2 + 0.5, h: sr(i, 2) * 25 + 12,
    dur: sr(i, 3) * 0.8 + 0.45, del: sr(i, 4) * 2.5,
    op: sr(i, 5) * 0.45 + 0.3, glow: sr(i, 6) > 0.65,
  })), []);
  const splashes = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    x: sr(i + 30, 0) * 85 + 7,
    dur: sr(i + 30, 1) * 0.6 + 0.5, del: sr(i + 30, 2) * 2.5,
  })), []);
  return (
    <>
      <style>{RAIN_CSS}</style>
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={SCR}>
        {drops.map((d, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${d.x}%`, top: 0,
            width: d.w, height: d.h,
            background: `linear-gradient(to bottom, transparent, ${color})`,
            opacity: d.op,
            boxShadow: d.glow ? `0 0 ${d.w * 4}px ${color}cc` : 'none',
            borderRadius: 2,
            animation: `neonRain ${d.dur}s ${d.del}s linear infinite`,
          }} />
        ))}
        {splashes.map((s, i) => (
          <div key={`sp${i}`} style={{
            position: 'absolute', left: `${s.x}%`, bottom: '4%',
            width: 14, height: 6, borderRadius: '50%',
            border: `1px solid ${color}88`,
            animation: `splash ${s.dur}s ${s.del}s ease-out infinite`,
          }} />
        ))}
      </div>
    </>
  );
}

/* ─── Ash / Embers ───────────────────────────────────────────────────────────── */
const ASH_CSS = `
@keyframes emberRise{0%{transform:translateY(0) translateX(0);opacity:0}10%{opacity:.9}80%{opacity:.4}100%{transform:translateY(-290px) translateX(var(--dx));opacity:0}}`;
function Ash({ color, count = 22 }: { color: string; count?: number }) {
  const items = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: sr(i, 0) * 88 + 6, sz: sr(i, 1) * 3 + 1.2,
    dur: sr(i, 2) * 3.5 + 3, del: sr(i, 3) * 5,
    dx: (sr(i, 4) - 0.5) * 50, bright: sr(i, 5) > 0.6,
  })), [count]);
  return (
    <>
      <style>{ASH_CSS}</style>
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={SCR}>
        {items.map((s, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${s.x}%`, bottom: '4%',
            width: s.sz * 2, height: s.sz * 2, borderRadius: '50%',
            background: s.bright ? `radial-gradient(circle, #fff 0%, ${color} 40%, transparent 80%)` : color,
            boxShadow: s.bright ? `0 0 ${s.sz * 5}px ${s.sz * 2}px ${color}cc` : `0 0 ${s.sz * 3}px ${color}88`,
            '--dx': `${s.dx}px`,
            animation: `emberRise ${s.dur}s ${s.del}s ease-out infinite`,
          } as React.CSSProperties} />
        ))}
      </div>
    </>
  );
}

/* ─── Grid ───────────────────────────────────────────────────────────────────── */
function Grid({ color, opacity: op = 0.14 }: { color: string; opacity?: number }) {
  const vLines = [20, 40, 60, 80];
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none">
      {vLines.map(v => [
        <line key={`h${v}`} x1="0%" y1={`${v}%`} x2="100%" y2={`${v}%`} stroke={color} strokeWidth={0.5} opacity={op} />,
        <line key={`v${v}`} x1={`${v}%`} y1="0%" x2={`${v}%`} y2="100%" stroke={color} strokeWidth={0.5} opacity={op} />,
      ])}
      {vLines.flatMap(x => vLines.map(y => (
        <circle key={`n${x}${y}`} cx={`${x}%`} cy={`${y}%`} r={1.5} fill={color} opacity={op * 2.5} />
      )))}
      {[{ nx: 20, ny: 40, del: 0 }, { nx: 60, ny: 20, del: 0.8 }, { nx: 40, ny: 80, del: 1.6 }, { nx: 80, ny: 60, del: 2.4 }].map((p, i) => (
        <motion.circle key={`ping${i}`} cx={`${p.nx}%`} cy={`${p.ny}%`} r={1.5} fill={color}
          animate={{ r: [1.5, 7, 1.5], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: p.del, ease: 'easeOut' }}
        />
      ))}
      {/* Traveling signal */}
      <motion.line x1="0%" y1="40%" x2="1%" y2="40%"
        stroke={color} strokeWidth={1.5} opacity={0.7}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        animate={{ x1: ['0%', '100%'], x2: ['2%', '102%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  );
}

/* ─── Scan ───────────────────────────────────────────────────────────────────── */
function Scan({ color }: { color: string }) {
  const digits = useMemo(() => Array.from({ length: 7 }, (_, i) => Math.floor(sr(i + 10, i) * 100).toString().padStart(2, '0')), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div style={{
        position: 'absolute', left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent 0%, ${color}44 10%, ${color} 50%, ${color}cc 55%, ${color}44 90%, transparent 100%)`,
        boxShadow: `0 0 24px 8px ${color}55, 0 0 8px 2px ${color}99`,
      }}
        animate={{ top: ['-1%', '103%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 1.2 }}
      />
      <motion.div style={{
        position: 'absolute', left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${color}33, transparent)`,
      }}
        animate={{ top: ['-1%', '103%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 1.2, delay: 0.14 }}
      />
      <motion.div style={{
        position: 'absolute', right: 5, top: 10, bottom: 10, width: 22,
        fontFamily: 'monospace', fontSize: 8, color, opacity: 0.45,
        display: 'flex', flexDirection: 'column', gap: 3,
      }}
        animate={{ opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 2.4, repeat: Infinity }}>
        {digits.map((d, i) => <div key={i}>{d}</div>)}
      </motion.div>
    </div>
  );
}

/* ─── Aurora ─────────────────────────────────────────────────────────────────── */
function Aurora({ color, color2 }: { color: string; color2?: string }) {
  const c2 = color2 ?? '#818CF8';
  const bands = [
    { top: '8%',  h: 70, bg: `${color}44, ${c2}33`,      scaleY: [1, 1.6, 0.8, 1],    delay: 0   },
    { top: '22%', h: 55, bg: `${c2}33, ${color}44`,      scaleY: [1, 0.7, 1.3, 1],    delay: 1.2 },
    { top: '34%', h: 80, bg: `${color}33, #A855F755`,    scaleY: [1, 1.4, 0.9, 1],    delay: 2.1 },
    { top: '48%', h: 45, bg: `${c2}33, #EC489933`,       scaleY: [1, 1.2, 0.75, 1],   delay: 0.7 },
    { top: '58%', h: 60, bg: `#6366F133, ${color}44`,    scaleY: [1, 0.85, 1.4, 1],   delay: 1.7 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={SCR}>
      {bands.map((b, i) => (
        <motion.div key={i} style={{
          position: 'absolute', left: '-12%', right: '-12%',
          height: b.h, top: b.top, borderRadius: b.h,
          background: `linear-gradient(90deg, transparent 0%, ${b.bg} 50%, transparent 100%)`,
          filter: `blur(${16 + i * 4}px)`,
        }}
          animate={{ scaleY: b.scaleY, opacity: [0.5, 1, 0.4, 0.5], x: [0, 18, -14, 0] }}
          transition={{ duration: 5 + i * 1.3, repeat: Infinity, ease: 'easeInOut', delay: b.delay }}
        />
      ))}
    </div>
  );
}

/* ─── Lava ───────────────────────────────────────────────────────────────────── */
const LAVA_CSS = `
@keyframes lavaGlow{0%,100%{opacity:.6;transform:scaleX(1)}50%{opacity:1;transform:scaleX(1.04)}}
@keyframes lavaBubble{0%{transform:scale(0) translateY(0);opacity:0}40%{opacity:.9}85%{transform:scale(1) translateY(-16px);opacity:.5}100%{transform:scale(.3) translateY(-22px);opacity:0}}`;
function Lava({ color }: { color: string }) {
  const bubbles = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    x: sr(i, 0) * 84 + 8, bot: sr(i, 1) * 22 + 3,
    sz: sr(i, 2) * 6 + 2.5, dur: sr(i, 3) * 1.5 + 1.2,
    del: sr(i, 4) * 3, bright: i < 4,
  })), []);
  const sparks = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    x: sr(i + 20, 0) * 80 + 10, sz: sr(i + 20, 1) * 2 + 0.8,
    dur: sr(i + 20, 2) * 1 + 0.8, del: sr(i + 20, 3) * 3,
    dx: (sr(i + 20, 4) - 0.5) * 24,
  })), []);
  return (
    <>
      <style>{LAVA_CSS}</style>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '52%',
          background: `linear-gradient(0deg, ${color}66 0%, ${color}33 35%, ${color}12 65%, transparent 100%)`,
          animation: 'lavaGlow 2.2s ease-in-out infinite',
        }} />
        {[0, 1, 2].map(i => (
          <motion.div key={i} style={{
            position: 'absolute', bottom: '28%', left: `${25 + i * 22}%`,
            width: 30, height: 8, borderRadius: '50%',
            border: `1px solid ${color}88`,
            transform: 'translate(-50%, 50%)',
          }}
            animate={{ scaleX: [0.5, 1.5, 0.5], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6 }}
          />
        ))}
        {bubbles.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${b.x}%`, bottom: `${b.bot}%`,
            width: b.sz * 2, height: b.sz * 2, borderRadius: '50%',
            background: b.bright ? `radial-gradient(circle, #fff 0%, ${color} 40%, transparent 80%)` : color,
            boxShadow: `0 0 ${b.sz * 4}px ${b.sz}px ${color}88`,
            animation: `lavaBubble ${b.dur}s ${b.del}s ease-out infinite`,
          }} />
        ))}
        {sparks.map((s, i) => (
          <motion.div key={`sp${i}`} style={{
            position: 'absolute', left: `${s.x}%`, bottom: '8%',
            width: s.sz * 2, height: s.sz * 2, borderRadius: '50%',
            background: '#fff',
            boxShadow: `0 0 ${s.sz * 4}px ${s.sz}px ${color}`,
          }}
            animate={{ y: [0, -(150 + s.sz * 20)], x: [0, s.dx], opacity: [0, 1, 0], scale: [0.5, 1, 0.2] }}
            transition={{ duration: s.dur, repeat: Infinity, delay: s.del, ease: 'easeOut' }}
          />
        ))}
      </div>
    </>
  );
}

/* ─── Digital Rain ───────────────────────────────────────────────────────────── */
const DR_CSS = `@keyframes drScroll{from{transform:translateY(-105%)}to{transform:translateY(105%)}}`;
const DR_CHARS = '0123456789ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃ!@#$%&?';
function DigitalRain({ color }: { color: string }) {
  const cols = useMemo(() => Array.from({ length: 11 }, (_, i) => ({
    x: i * 9.1 + sr(i, 1) * 2,
    chars: Array.from({ length: 18 }, (__, j) => DR_CHARS[Math.floor(sr(i * 18 + j, j) * DR_CHARS.length)]),
    dur: sr(i, 2) * 2.5 + 1.8, del: sr(i, 3) * 3, op: sr(i, 4) * 0.45 + 0.5,
  })), []);
  return (
    <>
      <style>{DR_CSS}</style>
      <div className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ ...SCR, fontFamily: 'monospace', fontSize: 10 }}>
        {cols.map((col, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${col.x}%`, top: 0,
            opacity: col.op,
            animation: `drScroll ${col.dur}s ${col.del}s linear infinite`,
          }}>
            {col.chars.map((ch, j) => (
              <div key={j} style={{
                lineHeight: '18px', color: j === 0 ? '#fff' : color,
                textShadow: j === 0 ? `0 0 8px #fff, 0 0 16px ${color}` : j < 4 ? `0 0 5px ${color}` : 'none',
                opacity: j === 0 ? 1 : Math.max(0, 1 - j / 20),
              }}>{ch}</div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── Void Rings ─────────────────────────────────────────────────────────────── */
function VoidRings({ color }: { color: string }) {
  const orbiters = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    angle: i * 60, dist: 0.28, sz: sr(i, 1) * 3 + 2,
    dur: sr(i, 2) + 1.5, del: sr(i, 3),
  })), []);
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={SCR}>
      <div style={{
        position: 'absolute', width: 34, height: 34, borderRadius: '50%',
        background: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.85) 60%, transparent 100%)',
        boxShadow: '0 0 30px 10px rgba(0,0,0,0.8)', zIndex: 2,
      }} />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <motion.div key={i} style={{
          position: 'absolute', width: 52, height: 52, borderRadius: '50%',
          border: `${i < 2 ? 2 : 1.2}px solid ${color}`,
          boxShadow: `0 0 ${12 + i * 4}px ${color}${i < 2 ? 'aa' : '55'}, inset 0 0 ${8 + i * 2}px ${color}22`,
        }}
          animate={{ scale: [0.3, 4.5], opacity: [0.9, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.58, ease: 'easeOut' }}
        />
      ))}
      <motion.div style={{ position: 'absolute', width: 140, height: 140 }}
        animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
        {orbiters.map((o, i) => {
          const rad = (o.angle * Math.PI) / 180;
          return (
            <motion.div key={i} style={{
              position: 'absolute',
              left: 70 + 70 * o.dist * Math.cos(rad) - o.sz / 2,
              top:  70 + 70 * o.dist * Math.sin(rad) - o.sz / 2,
              width: o.sz, height: o.sz, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 ${o.sz * 4}px ${o.sz}px ${color}88`,
            }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.4, 0.8] }}
              transition={{ duration: o.dur, repeat: Infinity, delay: o.del }}
            />
          );
        })}
      </motion.div>
    </div>
  );
}

/* ─── Glitch ─────────────────────────────────────────────────────────────────── */
const GLITCH_CSS = `
@keyframes scanTear{0%,88%,100%{opacity:0}89%{opacity:1;transform:translateX(0)}90%{opacity:1;transform:translateX(-8px)}91%{opacity:.7;transform:translateX(6px)}92%{opacity:0}}
@keyframes pixelFlash{0%,82%,100%{opacity:0}83%,85%,87%{opacity:.75}84%,86%{opacity:.25}}`;
function Glitch({ color }: { color: string }) {
  const tears = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    y: sr(i, 0) * 80 + 5, h: sr(i, 1) * 4 + 1,
    del: sr(i, 2) * 3 + 0.5, dur: sr(i, 3) * 2 + 1.5,
  })), []);
  const pixels = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    x: sr(i + 20, 0) * 80, y: sr(i + 20, 1) * 80,
    w: sr(i + 20, 2) * 30 + 8, h: sr(i + 20, 3) * 6 + 2,
    c: i % 3 === 0 ? '#FF0055' : i % 3 === 1 ? '#00FFFF' : color,
    del: sr(i + 20, 4) * 4 + 0.3, dur: sr(i + 20, 5) + 0.5,
  })), [color]);
  return (
    <>
      <style>{GLITCH_CSS}</style>
      <motion.div className="absolute inset-0 pointer-events-none"
        style={{ background: `${color}06`, mixBlendMode: 'screen' }}
        animate={{ x: [0, -5, 5, -3, 0], opacity: [0, 0, 0.5, 0, 0] }}
        transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 2.5 }}
      />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {tears.map((t, i) => (
          <div key={i} style={{
            position: 'absolute', left: 0, right: 0,
            top: `${t.y}%`, height: t.h,
            background: `linear-gradient(90deg, transparent, ${color}66, rgba(255,255,255,0.4), ${color}44, transparent)`,
            animationName: 'scanTear', animationDuration: `${t.dur}s`,
            animationDelay: `${t.del}s`, animationTimingFunction: 'step-end',
            animationIterationCount: 'infinite',
          }} />
        ))}
        {pixels.map((p, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
            width: p.w, height: p.h, background: p.c,
            animationName: 'pixelFlash', animationDuration: `${p.dur}s`,
            animationDelay: `${p.del}s`, animationTimingFunction: 'step-end',
            animationIterationCount: 'infinite',
          }} />
        ))}
      </div>
    </>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────────────── */
function EffectRenderer({ effect }: { effect: SceneEffect }) {
  switch (effect.type) {
    case 'particles':    return <Dust         color={effect.color ?? '#A855F7'} count={effect.count} />;
    case 'stars':        return <Stars        count={effect.count} />;
    case 'rain':         return <Rain         color={effect.color ?? '#EC4899'} />;
    case 'ash':          return <Ash          color={effect.color ?? '#FF6600'} count={effect.count} />;
    case 'grid':         return <Grid         color={effect.color ?? '#00D4FF'} opacity={effect.opacity} />;
    case 'scan':         return <Scan         color={effect.color ?? '#00FF41'} />;
    case 'aurora':       return <Aurora       color={effect.color ?? '#10B981'} color2={effect.color2} />;
    case 'lava':         return <Lava         color={effect.color ?? '#FF5500'} />;
    case 'digital_rain': return <DigitalRain  color={effect.color ?? '#00FF41'} />;
    case 'void_rings':   return <VoidRings    color={effect.color ?? '#D946EF'} />;
    case 'glitch':       return <Glitch       color={effect.color ?? '#D946EF'} />;
    default:             return null;
  }
}

export function SceneEffects({ effects }: { effects: SceneEffect[] }) {
  return <>{effects.map((e, i) => <EffectRenderer key={i} effect={e} />)}</>;
}
