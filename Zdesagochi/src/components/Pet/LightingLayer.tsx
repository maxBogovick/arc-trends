import { useState, useEffect } from 'react';
import { usePetStore } from '../../store/petStore';
import { getFurniture } from '../../data/roomFurniture';

const LAMP_COLORS: Record<string, string> = {
  candle:     '#FF8020',
  torch:      '#FFE890',
  floorlamp:  '#FFE0A0',
  oillamp:    '#FF6010',
  chandelier: '#FFF0C0',
  lantern:    '#FF5030',
};
const LAMP_SIZES: Record<string, number> = {
  candle:     38,
  torch:      50,
  floorlamp:  60,
  oillamp:    32,
  chandelier: 75,
  lantern:    44,
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface SunLight {
  id: string;
  x: number;
  y: number;
  color: string;
  intensity: number;
  size: number;
}

function getSunLight(now: Date): SunLight | null {
  const h = now.getHours() + now.getMinutes() / 60;
  const sunriseH = 6;
  const sunsetH = 20;

  if (h < sunriseH || h > sunsetH) return null;

  const progress = (h - sunriseH) / (sunsetH - sunriseH); // 0..1 across the day

  // Sun moves left→right across the room, arcs high at noon
  const x = 5 + progress * 90;
  const y = 88 - 68 * Math.sin(Math.PI * progress); // 88% at edges, 20% at noon

  // Color: orange at dawn/dusk, warm white at noon
  let color: string;
  if (h < 7.5 || h > 18.5)      color = '#FF6820'; // orange/red
  else if (h < 9 || h > 17)     color = '#FFB040'; // amber
  else if (h < 10.5 || h > 15)  color = '#FFD870'; // warm yellow
  else                           color = '#FFF5D0'; // warm white

  // Intensity: low at dawn/dusk, bright at noon
  const intensity = 0.18 + 0.52 * Math.sin(Math.PI * progress);

  return { id: 'sun', x, y, color, intensity, size: 160 };
}

export function LightingLayer() {
  const { roomCustomization: c, placedFurniture } = usePetStore();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const sources = [
    ...c.roomLights.filter(l => l.isOn).map(l => ({
      id: l.id,
      x: l.x,
      y: l.y,
      color: l.color,
      intensity: l.intensity,
      size: l.size,
    })),
    ...placedFurniture
      .filter(p => {
        const def = getFurniture(p.itemId);
        return def?.category === 'lamp' && (p.isOn ?? true);
      })
      .map(p => ({
        id: `lamp_${p.uid}`,
        x: p.x,
        y: p.y,
        color: LAMP_COLORS[p.itemId] ?? '#FFE080',
        intensity: 0.38,
        size: (LAMP_SIZES[p.itemId] ?? 42) * p.scale,
      })),
    ...(c.hasSun ? [getSunLight(now)].filter(Boolean) as SunLight[] : []),
  ];

  if (sources.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        mixBlendMode: 'screen',
        zIndex: 4,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {sources.map(s => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}%`,
            height: `${s.size}%`,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: `radial-gradient(ellipse at center, ${hexToRgba(s.color, s.intensity)} 0%, ${hexToRgba(s.color, s.intensity * 0.3)} 35%, transparent 70%)`,
          }}
        />
      ))}
    </div>
  );
}
