import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { SceneEffect } from '../../data/backgrounds';
import type { PerformancePolicy } from '../../performance/performancePolicy';

const sr = (i: number, off = 0) => ((i * 137 + off * 31) % 100) / 100;

// ── Canvas hook ───────────────────────────────────────────────────────────────

type DrawFn = (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void;
type CanvasPolicy = Pick<PerformancePolicy, 'canvasEffectsEnabled' | 'targetFps'>;

function useCanvas(draw: DrawFn, policy: CanvasPolicy) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<DrawFn>(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext('2d')!;
    let rafId: number;
    let lastFrame = 0;
    const t0 = performance.now();

    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      if (document.hidden || !policy.canvasEffectsEnabled) return;
      const minFrameMs = 1000 / Math.max(1, policy.targetFps);
      if (now - lastFrame < minFrameMs) return;
      lastFrame = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawRef.current(ctx, (now - t0) / 1000, canvas.width, canvas.height);
    };
    if (policy.canvasEffectsEnabled) rafId = requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);

    return () => { if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [policy.canvasEffectsEnabled, policy.targetFps]);

  return ref;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.startsWith('#') ? hex.slice(1) : '808080';
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const CANVAS_BASE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  width: '100%', height: '100%',
  pointerEvents: 'none',
  mixBlendMode: 'screen',
};

// ── Dust ──────────────────────────────────────────────────────────────────────

function Dust({ color, count = 14, policy }: { color: string; count?: number; policy: CanvasPolicy }) {
  const pts = useMemo(() => Array.from({ length: count }, (_, i) => ({
    bx:   sr(i, 0) * 0.88 + 0.06,
    by:   sr(i, 1) * 0.78 + 0.08,
    sz:   sr(i, 2) * 1.4 + 0.7,
    dur:  sr(i, 3) * 10 + 14,
    del:  sr(i, 4) * 10,
    dy:   (sr(i, 5) - 0.5) * 10,
    dx:   (sr(i, 6) - 0.5) * 6,
    maxOp: sr(i, 7) * 0.12 + 0.04,
  })), [count]);

  const [r, g, b] = useMemo(() => hexToRgb(color), [color]);

  const ref = useCanvas((ctx, t, w, h) => {
    ctx.globalCompositeOperation = 'source-over';
    for (const p of pts) {
      const phase = ((t - p.del) / p.dur) * Math.PI * 2;
      const x = p.bx * w + p.dx * Math.sin(phase * 0.7);
      const y = p.by * h + p.dy * Math.sin(phase);
      const op = p.maxOp * (0.5 + 0.5 * Math.sin(phase));
      if (op < 0.005) continue;
      const rad = p.sz * 4;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${r},${g},${b},${op})`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }, policy);

  return <canvas ref={ref} style={CANVAS_BASE} />;
}

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ count = 32, policy }: { count?: number; policy: CanvasPolicy }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x:  sr(i, 0) * 0.96 + 0.02,
    y:  sr(i, 1) * 0.95 + 0.02,
    r:  sr(i, 2) * 2 + 0.4,
    dur: sr(i, 3) * 3 + 1.5,
    del: sr(i, 4) * 5,
    bright: i < Math.ceil(count * 0.25),
  })), [count]);

  const shoots = useMemo(() => Array.from({ length: 3 }, (_, i) => ({
    x1:     sr(i + 60, 0) * 0.5 + 0.05,
    y1:     sr(i + 60, 1) * 0.3 + 0.05,
    lenF:   sr(i + 60, 5) * 0.45 + 0.25,
    ang:    sr(i + 60, 6) * 35 + 15,
    dur:    sr(i + 60, 3) * 0.6 + 0.5,
    repDel: sr(i + 60, 4) * 7 + 5,
  })), []);

  const nebulas = useMemo(() => [
    { x: 0.28, y: 0.22, rw: 0.145, rh: 0.105, r: 80,  g: 64,  b: 208, op: 0.20 },
    { x: 0.74, y: 0.66, rw: 0.10,  rh: 0.08,  r: 144, g: 24,  b: 128, op: 0.14 },
  ], []);

  const ref = useCanvas((ctx, t, w, h) => {
    // Nebulas — slow pulse, no blur needed (radial gradient is already soft)
    for (const n of nebulas) {
      const op = n.op * (1 + 0.6 * Math.sin(t * 0.08));
      const grd = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, n.rw * w);
      grd.addColorStop(0, `rgba(${n.r},${n.g},${n.b},${op})`);
      grd.addColorStop(1, `rgba(${n.r},${n.g},${n.b},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(n.x * w, n.y * h, n.rw * w, n.rh * h, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stars
    for (const s of stars) {
      const phase = ((t - s.del) / s.dur) * Math.PI * 2;
      const raw = 0.5 + 0.5 * Math.sin(phase);
      const op  = s.bright ? raw * 0.94 + 0.06 : raw * 0.44 + 0.06;
      const rr  = s.bright ? s.r * (1 + raw) : s.r;

      ctx.fillStyle = s.bright
        ? `rgba(255,255,255,${op})`
        : `rgba(136,153,187,${op})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, rr, 0, Math.PI * 2);
      ctx.fill();

      if (s.bright && op > 0.3) {
        const grd = ctx.createRadialGradient(s.x * w, s.y * h, 0, s.x * w, s.y * h, rr * 4);
        grd.addColorStop(0, `rgba(255,255,255,${op * 0.35})`);
        grd.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, rr * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Shooting stars
    ctx.lineCap = 'round';
    for (const s of shoots) {
      const cycle = s.dur + s.repDel;
      const localT = ((t % cycle) + cycle) % cycle;
      if (localT >= s.dur) continue;
      const frac = localT / s.dur;
      const op = frac < 0.15 ? frac / 0.15 : Math.max(0, 1 - (frac - 0.15) / 0.85);
      if (op < 0.01) continue;
      const rad = (s.ang * Math.PI) / 180;
      const x1 = s.x1 * w, y1 = s.y1 * h;
      const x2 = x1 + s.lenF * w * Math.cos(rad);
      const y2 = y1 + s.lenF * w * Math.sin(rad) * 0.5;
      const grd = ctx.createLinearGradient(x1, y1, x2, y2);
      grd.addColorStop(0, `rgba(255,255,255,${op * 0.95})`);
      grd.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }, policy);

  return <canvas ref={ref} style={CANVAS_BASE} />;
}

// ── Rain ──────────────────────────────────────────────────────────────────────

function Rain({ color, policy }: { color: string; policy: CanvasPolicy }) {
  const drops = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    xF:   sr(i, 0) * 0.96,
    w:    sr(i, 1) * 1.2 + 0.5,
    dropH: sr(i, 2) * 25 + 12,
    dur:  sr(i, 3) * 0.8 + 0.45,
    del:  sr(i, 4) * 2.5,
    op:   sr(i, 5) * 0.45 + 0.3,
    glow: sr(i, 6) > 0.65,
  })), []);

  const splashes = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    xF:   sr(i + 30, 0) * 0.85 + 0.07,
    dur:  sr(i + 30, 1) * 0.6 + 0.5,
    del:  sr(i + 30, 2) * 2.5,
  })), []);

  const [r, g, b] = useMemo(() => hexToRgb(color), [color]);

  const ref = useCanvas((ctx, t, w, h) => {
    for (const d of drops) {
      const cycle = d.dur;
      const localT = ((t - d.del) % cycle + cycle) % cycle;
      const frac = localT / cycle;
      const dropH = d.dropH;
      const yTop = -dropH + frac * (h + dropH + 20);
      const x = d.xF * w - 22 * frac;

      // Opacity envelope: ramp 0→8%, hold 8→88%, fade 88→100%
      let op: number;
      if (frac < 0.08)       op = d.op * (frac / 0.08);
      else if (frac < 0.88)  op = d.op;
      else                   op = d.op * (1 - (frac - 0.88) / 0.12);

      if (op < 0.01) continue;

      const grd = ctx.createLinearGradient(x, yTop, x, yTop + dropH);
      grd.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grd.addColorStop(1, `rgba(${r},${g},${b},${op})`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.rect(x - d.w / 2, yTop, d.w, dropH);
      ctx.fill();
    }

    // Splashes at bottom
    for (const s of splashes) {
      const cycle = s.dur;
      const localT = ((t - s.del) % cycle + cycle) % cycle;
      const frac = localT / cycle;
      const op = Math.max(0, 0.7 * (1 - frac));
      const scale = 0.2 + frac * 2.3;
      const x = s.xF * w;
      const y = h * 0.96;
      const rw = 7 * scale, rh = 3 * scale;
      ctx.strokeStyle = `rgba(${r},${g},${b},${op * 0.53})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, policy);

  return <canvas ref={ref} style={CANVAS_BASE} />;
}

// ── Ash / Embers ──────────────────────────────────────────────────────────────

function Ash({ color, count = 22, policy }: { color: string; count?: number; policy: CanvasPolicy }) {
  const items = useMemo(() => Array.from({ length: count }, (_, i) => ({
    xF:    sr(i, 0) * 0.88 + 0.06,
    sz:    sr(i, 1) * 3 + 1.2,
    dur:   sr(i, 2) * 3.5 + 3,
    del:   sr(i, 3) * 5,
    dxPx:  (sr(i, 4) - 0.5) * 50,
    bright: sr(i, 5) > 0.6,
  })), [count]);

  const [r, g, b] = useMemo(() => hexToRgb(color), [color]);

  const ref = useCanvas((ctx, t, w, h) => {
    for (const em of items) {
      const cycle = em.dur;
      const localT = ((t - em.del) % cycle + cycle) % cycle;
      const frac = localT / cycle;

      let op: number;
      if (frac < 0.10)       op = frac / 0.10 * 0.9;
      else if (frac < 0.80)  op = 0.9 * (1 - (frac - 0.10) / 0.7 * 0.5);
      else                   op = 0.45 * (1 - (frac - 0.80) / 0.20);

      if (op < 0.01) continue;

      const x = em.xF * w + em.dxPx * frac;
      const y = h * 0.96 - frac * 290;
      const rad = em.sz;

      const grd = ctx.createRadialGradient(x, y, 0, x, y, rad * 2);
      if (em.bright) {
        grd.addColorStop(0, `rgba(255,255,255,${op})`);
        grd.addColorStop(0.4, `rgba(${r},${g},${b},${op})`);
      } else {
        grd.addColorStop(0, `rgba(${r},${g},${b},${op})`);
      }
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, rad * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, policy);

  return <canvas ref={ref} style={CANVAS_BASE} />;
}

// ── Aurora ────────────────────────────────────────────────────────────────────

function Aurora({ color, color2, policy }: { color: string; color2?: string; policy: CanvasPolicy }) {
  const c2 = color2 ?? '#818CF8';
  const [r1, g1, b1] = useMemo(() => hexToRgb(color), [color]);
  const [r2, g2, b2] = useMemo(() => hexToRgb(c2), [c2]);
  const [r3, g3, b3] = useMemo(() => hexToRgb('#A855F7'), []);
  const [r4, g4, b4] = useMemo(() => hexToRgb('#EC4899'), []);
  const [r5, g5, b5] = useMemo(() => hexToRgb('#6366F1'), []);

  const bands = useMemo(() => [
    { yF: 0.08, hF: 70, cr: r1, cg: g1, cb: b1, op: 0.44, scAmpl: 0.6, delay: 0,   xAmpl: 18 },
    { yF: 0.22, hF: 55, cr: r2, cg: g2, cb: b2, op: 0.33, scAmpl: 0.3, delay: 1.2, xAmpl: 14 },
    { yF: 0.34, hF: 80, cr: r3, cg: g3, cb: b3, op: 0.33, scAmpl: 0.4, delay: 2.1, xAmpl: 20 },
    { yF: 0.48, hF: 45, cr: r4, cg: g4, cb: b4, op: 0.33, scAmpl: 0.2, delay: 0.7, xAmpl: 12 },
    { yF: 0.58, hF: 60, cr: r5, cg: g5, cb: b5, op: 0.33, scAmpl: 0.4, delay: 1.7, xAmpl: 16 },
  ], [r1, g1, b1, r2, g2, b2, r3, g3, b3, r4, g4, b4, r5, g5, b5]);

  const ref = useCanvas((ctx, t, w, h) => {
    for (const band of bands) {
      const dur = 5 + bands.indexOf(band) * 1.3;
      const phase = ((t - band.delay) / dur) * Math.PI * 2;
      const scaleY = 1 + band.scAmpl * Math.sin(phase);
      const xOff = band.xAmpl * Math.sin(phase * 0.7);
      const op = band.op * (0.5 + 0.5 * Math.sin(phase * 0.5 + 0.5));

      const cy = band.yF * h;
      const bandH = band.hF * scaleY;

      const grd = ctx.createLinearGradient(0, cy - bandH / 2, 0, cy + bandH / 2);
      grd.addColorStop(0, `rgba(${band.cr},${band.cg},${band.cb},0)`);
      grd.addColorStop(0.5, `rgba(${band.cr},${band.cg},${band.cb},${op})`);
      grd.addColorStop(1, `rgba(${band.cr},${band.cg},${band.cb},0)`);

      ctx.save();
      ctx.translate(xOff, 0);
      ctx.fillStyle = grd;
      ctx.fillRect(-w * 0.12, cy - bandH / 2, w * 1.24, bandH);
      ctx.restore();
    }
  }, policy);

  return <canvas ref={ref} style={CANVAS_BASE} />;
}

// ── Lava ──────────────────────────────────────────────────────────────────────

function Lava({ color, policy }: { color: string; policy: CanvasPolicy }) {
  const bubbles = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    xF:    sr(i, 0) * 0.84 + 0.08,
    botF:  sr(i, 1) * 0.22 + 0.03,
    sz:    sr(i, 2) * 6 + 2.5,
    dur:   sr(i, 3) * 1.5 + 1.2,
    del:   sr(i, 4) * 3,
    bright: i < 4,
  })), []);

  const sparks = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    xF:   sr(i + 20, 0) * 0.80 + 0.10,
    sz:   sr(i + 20, 1) * 2 + 0.8,
    dur:  sr(i + 20, 2) + 0.8,
    del:  sr(i + 20, 3) * 3,
    dxPx: (sr(i + 20, 4) - 0.5) * 24,
  })), []);

  const [r, g, b] = useMemo(() => hexToRgb(color), [color]);

  const ref = useCanvas((ctx, t, w, h) => {
    // Base lava glow at bottom
    const glowPulse = 0.6 + 0.4 * Math.sin(t * (Math.PI * 2 / 2.2));
    const glowGrd = ctx.createLinearGradient(0, h * 0.48, 0, h);
    glowGrd.addColorStop(0, `rgba(${r},${g},${b},0)`);
    glowGrd.addColorStop(0.35, `rgba(${r},${g},${b},${0.33 * glowPulse})`);
    glowGrd.addColorStop(1, `rgba(${r},${g},${b},${0.66 * glowPulse})`);
    ctx.fillStyle = glowGrd;
    ctx.fillRect(0, 0, w, h);

    // Bubbles
    for (const bub of bubbles) {
      const cycle = bub.dur;
      const localT = ((t - bub.del) % cycle + cycle) % cycle;
      const frac = localT / cycle;

      let op: number;
      if (frac < 0.40) op = 0.9 * (frac / 0.40);
      else if (frac < 0.85) op = 0.9 * (1 - (frac - 0.40) / 0.45 * 0.5);
      else op = 0.45 * (1 - (frac - 0.85) / 0.15);

      if (op < 0.01) continue;

      const scale = frac < 0.85 ? frac / 0.85 : 1 + (frac - 0.85) / 0.15 * 0.3;
      const x = bub.xF * w;
      const y = (1 - bub.botF) * h - frac * 16;
      const rad = bub.sz * scale;

      const grd = ctx.createRadialGradient(x, y, 0, x, y, rad);
      if (bub.bright) {
        grd.addColorStop(0, `rgba(255,255,255,${op})`);
        grd.addColorStop(0.4, `rgba(${r},${g},${b},${op})`);
      } else {
        grd.addColorStop(0, `rgba(${r},${g},${b},${op})`);
      }
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sparks flying up
    for (const sp of sparks) {
      const cycle = sp.dur;
      const localT = ((t - sp.del) % cycle + cycle) % cycle;
      const frac = localT / cycle;

      const op = frac < 0.2 ? frac / 0.2 : Math.max(0, 1 - (frac - 0.2) / 0.8);
      if (op < 0.01) continue;

      const x = sp.xF * w + sp.dxPx * frac;
      const y = h * 0.92 - frac * (150 + sp.sz * 20);
      const scale = 0.5 + frac * 0.5;
      const rad = sp.sz * scale;

      const grd = ctx.createRadialGradient(x, y, 0, x, y, rad * 2);
      grd.addColorStop(0, `rgba(255,255,255,${op})`);
      grd.addColorStop(0.5, `rgba(${r},${g},${b},${op})`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, rad * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, policy);

  return <canvas ref={ref} style={CANVAS_BASE} />;
}

// ── Digital Rain ──────────────────────────────────────────────────────────────

const DR_CHARS = '0123456789ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃ!@#$%&?';

function DigitalRain({ color, policy }: { color: string; policy: CanvasPolicy }) {
  const LINE_H = 18;
  const FONT_SZ = 10;

  const cols = useMemo(() => Array.from({ length: 11 }, (_, i) => ({
    xF:   (i * 9.1 + sr(i, 1) * 2) / 100,
    chars: Array.from({ length: 18 }, (__, j) =>
      DR_CHARS[Math.floor(sr(i * 18 + j, j) * DR_CHARS.length)]),
    dur: sr(i, 2) * 2.5 + 1.8,
    del: sr(i, 3) * 3,
    op:  sr(i, 4) * 0.45 + 0.5,
  })), []);

  const [r, g, b] = useMemo(() => hexToRgb(color), [color]);

  const ref = useCanvas((ctx, t, w, h) => {
    ctx.font = `${FONT_SZ}px monospace`;
    ctx.textBaseline = 'top';

    for (const col of cols) {
      const colH = col.chars.length * LINE_H;
      const cycle = col.dur;
      const localT = ((t - col.del) % cycle + cycle) % cycle;
      const yTop = -colH + (localT / cycle) * (h + colH);

      for (let j = 0; j < col.chars.length; j++) {
        const cy = yTop + j * LINE_H;
        if (cy < -LINE_H || cy > h) continue;

        const tailFade = Math.max(0, 1 - j / 20);
        const charOp = col.op * tailFade;
        if (charOp < 0.01) continue;

        if (j === 0) {
          ctx.fillStyle = `rgba(255,255,255,${col.op})`;
        } else if (j < 4) {
          ctx.fillStyle = `rgba(${r},${g},${b},${charOp})`;
        } else {
          ctx.fillStyle = `rgba(${r},${g},${b},${charOp * 0.7})`;
        }
        ctx.fillText(col.chars[j], col.xF * w, cy);
      }
    }
  }, policy);

  return <canvas ref={ref} style={CANVAS_BASE} />;
}

// ── Grid (lightweight — keep framer-motion) ───────────────────────────────────

function Grid({ color, opacity: op = 0.14 }: { color: string; opacity?: number }) {
  const lines = [20, 40, 60, 80];
  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {lines.map(v => [
          <line key={`h${v}`} x1="0%" y1={`${v}%`} x2="100%" y2={`${v}%`} stroke={color} strokeWidth={0.5} opacity={op} />,
          <line key={`v${v}`} x1={`${v}%`} y1="0%" x2={`${v}%`} y2="100%" stroke={color} strokeWidth={0.5} opacity={op} />,
        ])}
        {lines.flatMap(x => lines.map(y => (
          <circle key={`n${x}${y}`} cx={`${x}%`} cy={`${y}%`} r={1.5} fill={color} opacity={op * 2.5} />
        )))}
        {[{ nx: 20, ny: 40, del: 0 }, { nx: 60, ny: 20, del: 0.8 }, { nx: 40, ny: 80, del: 1.6 }, { nx: 80, ny: 60, del: 2.4 }].map((p, i) => (
          <motion.g key={`ping${i}`}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            animate={{ scale: [1, 4.7, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: p.del, ease: 'easeOut' }}
          >
            <circle cx={`${p.nx}%`} cy={`${p.ny}%`} r={1.5} fill={color} />
          </motion.g>
        ))}
      </svg>
      <motion.div
        className="absolute pointer-events-none"
        style={{ top: '40%', left: 0, width: '2%', height: 1.5, background: color, boxShadow: `0 0 6px ${color}`, opacity: 0.75 }}
        animate={{ left: ['-2%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
    </>
  );
}

// ── Scan (lightweight — keep framer-motion) ───────────────────────────────────

function Scan({ color }: { color: string }) {
  const digits = useMemo(() => Array.from({ length: 7 }, (_, i) =>
    Math.floor(sr(i + 10, i) * 100).toString().padStart(2, '0')), []);
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

// ── Void Rings (keep framer-motion — manageable count) ────────────────────────

function VoidRings({ color }: { color: string }) {
  const orbiters = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    angle: i * 60, sz: sr(i, 1) * 3 + 2,
    dur: sr(i, 2) + 1.5, del: sr(i, 3),
  })), []);
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ mixBlendMode: 'screen' }}>
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
              left: 70 + 70 * 0.28 * Math.cos(rad) - o.sz / 2,
              top:  70 + 70 * 0.28 * Math.sin(rad) - o.sz / 2,
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

// ── Glitch (CSS keyframes — already cheap) ────────────────────────────────────

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
        {tears.map((tr, i) => (
          <div key={i} style={{
            position: 'absolute', left: 0, right: 0,
            top: `${tr.y}%`, height: tr.h,
            background: `linear-gradient(90deg, transparent, ${color}66, rgba(255,255,255,0.4), ${color}44, transparent)`,
            animationName: 'scanTear', animationDuration: `${tr.dur}s`,
            animationDelay: `${tr.del}s`, animationTimingFunction: 'step-end',
            animationIterationCount: 'infinite',
          }} />
        ))}
        {pixels.map((px, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${px.x}%`, top: `${px.y}%`,
            width: px.w, height: px.h, background: px.c,
            animationName: 'pixelFlash', animationDuration: `${px.dur}s`,
            animationDelay: `${px.del}s`, animationTimingFunction: 'step-end',
            animationIterationCount: 'infinite',
          }} />
        ))}
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function EffectRenderer({ effect, policy }: { effect: SceneEffect; policy: PerformancePolicy }) {
  if (!policy.canvasEffectsEnabled) {
    if (effect.type === 'grid') return <Grid color={effect.color ?? '#00D4FF'} opacity={(effect.opacity ?? 0.14) * 0.65} />;
    return null;
  }
  const scaledCount = typeof effect.count === 'number'
    ? Math.max(1, Math.round(effect.count * policy.particleMultiplier))
    : undefined;

  switch (effect.type) {
    case 'particles':    return <Dust        color={effect.color ?? '#A855F7'} count={scaledCount} policy={policy} />;
    case 'stars':        return <Stars       count={scaledCount} policy={policy} />;
    case 'rain':         return <Rain        color={effect.color ?? '#EC4899'} policy={policy} />;
    case 'ash':          return <Ash         color={effect.color ?? '#FF6600'} count={scaledCount} policy={policy} />;
    case 'grid':         return <Grid        color={effect.color ?? '#00D4FF'} opacity={effect.opacity} />;
    case 'scan':         return <Scan        color={effect.color ?? '#00FF41'} />;
    case 'aurora':       return <Aurora      color={effect.color ?? '#10B981'} color2={effect.color2} policy={policy} />;
    case 'lava':         return <Lava        color={effect.color ?? '#FF5500'} policy={policy} />;
    case 'digital_rain': return <DigitalRain color={effect.color ?? '#00FF41'} policy={policy} />;
    case 'void_rings':   return <VoidRings   color={effect.color ?? '#D946EF'} />;
    case 'glitch':       return <Glitch      color={effect.color ?? '#D946EF'} />;
    default:             return null;
  }
}

export function SceneEffects({ effects, policy }: { effects: SceneEffect[]; policy: PerformancePolicy }) {
  const limitedEffects = policy.effectiveQuality === 'low'
    ? effects.slice(0, policy.maxCanvasEffects)
    : effects;
  return <>{limitedEffects.map((e, i) => <EffectRenderer key={i} effect={e} policy={policy} />)}</>;
}
