import { usePetStore } from '../../store/petStore';
import { getFurniture } from '../../data/roomFurniture';

// Colour and size each furniture lamp casts onto the room
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

export function LightingLayer() {
  const { roomCustomization: c, placedFurniture } = usePetStore();

  // Merge room lights + active furniture lamps into one source list
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
  ];

  if (sources.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        mixBlendMode: 'screen',
        zIndex: 3,
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
