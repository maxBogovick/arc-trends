import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore, type RoomCustomization, type FloorStyle, type RoomPreset, type PlacedFurnitureItem, type RoomLight } from '../store/petStore';
import { saveImage, deleteImage, useImageUrl } from '../utils/imageStore';
import { FurnitureItemVisual } from '../components/Pet/FurnitureItemVisual';
import { getFurniture, getFurnitureByCategory } from '../data/roomFurniture';
import { BACKGROUNDS, getBackground } from '../data/backgrounds';
import { RoomScene } from '../components/Pet/RoomScene';

type PanelTab = 'furniture' | 'room';
type RoomTab = 'wall' | 'floor' | 'accent' | 'lighting' | 'theme' | 'presets';
type FurnitureCategory = 'plant' | 'lamp' | 'decor' | 'furniture' | 'gadget' | 'special';

const FURNITURE_CATEGORIES: Array<{ id: FurnitureCategory; emoji: string; label: string }> = [
  { id: 'plant',     emoji: '🌿', label: 'Растения' },
  { id: 'lamp',      emoji: '💡', label: 'Свет' },
  { id: 'decor',     emoji: '🎨', label: 'Декор' },
  { id: 'furniture', emoji: '🛋️', label: 'Мебель' },
  { id: 'gadget',    emoji: '📺', label: 'Гаджеты' },
  { id: 'special',   emoji: '⭐', label: 'Особые' },
];

const RARITY_COLOR: Record<string, string> = {
  common:    '#6B7280',
  rare:      '#3B82F6',
  epic:      '#8B5CF6',
  legendary: '#F59E0B',
};

const WALL_PALETTES = [
  '#0D0020', '#050010', '#1E1B4B', '#0C0A1E', '#0A0A14',
  '#1A0A00', '#001A0A', '#0A1A00', '#1A001A', '#001A1A',
  '#2D1B69', '#1E3A5F', '#3B1F2B', '#1F3B2F', '#2B2B1F',
];

const FLOOR_PALETTES = [
  '#A855F7', '#6D28D9', '#EC4899', '#3B82F6', '#06B6D4',
  '#10B981', '#EAB308', '#F97316', '#EF4444', '#8B5CF6',
  '#D946EF', '#0EA5E9', '#22C55E', '#F59E0B', '#64748B',
];

const ACCENT_PALETTES = [
  '#A855F7', '#EC4899', '#00D4FF', '#00FF41', '#FF5500',
  '#F59E0B', '#10B981', '#6366F1', '#D946EF', '#22D3EE',
  '#FF4500', '#FF0080', '#00FF80', '#8080FF', '#FFFFFF',
];

function ColorSwatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 26, height: 26, borderRadius: 7,
        background: color, flexShrink: 0,
        border: active ? '2.5px solid white' : '2px solid rgba(255,255,255,0.15)',
        boxShadow: active ? `0 0 8px ${color}` : 'none',
      }}
    />
  );
}

function CustomColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label
      style={{
        width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
        border: '1.5px dashed rgba(255,255,255,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: 'rgba(255,255,255,0.5)',
        position: 'relative', flexShrink: 0,
      }}
    >
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
      />
      +
    </label>
  );
}

function StyleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: active ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)',
        color: active ? '#C4B5FD' : 'rgba(255,255,255,0.45)',
        border: active ? '1px solid rgba(124,58,237,0.5)' : '1px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
      {children}
    </p>
  );
}


// ── Image upload ──────────────────────────────────────────────────────────────

function ImageUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  // Resolves "idb:key" → data URL for display; passes through null or legacy URLs
  const resolvedUrl = useImageUrl(value);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target; // capture before async
    const reader = new FileReader();
    reader.onload = async ev => {
      const ref = await saveImage(ev.target?.result as string); // save to IDB
      onChange(ref);           // store short "idb:key" in state / localStorage
      input.value = '';        // reset so same file can be re-selected
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    deleteImage(value);  // async cleanup, fire-and-forget
    onChange(null);
  };

  return (
    <div>
      <SectionLabel>Своё изображение</SectionLabel>
      {value ? (
        <div className="relative rounded-xl overflow-hidden" style={{ height: 68 }}>
          {resolvedUrl && <img src={resolvedUrl} alt="" className="w-full h-full object-cover" />}
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            <button
              onClick={handleRemove}
              className="px-3 py-1 rounded-lg text-xs font-bold text-white"
              style={{ background: 'rgba(239,68,68,0.8)' }}
            >
              ✕ Убрать
            </button>
          </div>
          <div
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
            style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.8)' }}
          >
            Активно
          </div>
        </div>
      ) : (
        <label
          className="flex flex-col items-center justify-center gap-1 rounded-xl cursor-pointer transition-all hover:border-purple-500/50"
          style={{
            height: 68, border: '1.5px dashed rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.35)', fontSize: 11,
          }}
        >
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <span style={{ fontSize: 22 }}>📁</span>
          <span>Загрузить {label}</span>
        </label>
      )}
    </div>
  );
}

// ── Wall panel ────────────────────────────────────────────────────────────────

function WallSubSection({
  title,
  image,
  onImageChange,
  color,
  color2,
  wallStyle,
  onColor,
  onColor2,
  onStyle,
  styleOptions,
}: {
  title: string;
  image: string | null;
  onImageChange: (v: string | null) => void;
  color: string;
  color2: string;
  wallStyle: string;
  onColor: (v: string) => void;
  onColor2: (v: string) => void;
  onStyle: (v: string) => void;
  styleOptions: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="space-y-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.65)' }}>{title}</p>
      <ImageUpload label="фон" value={image} onChange={onImageChange} />
      {!image && (
        <>
          <div>
            <SectionLabel>Основной цвет</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {WALL_PALETTES.map(c => (
                <ColorSwatch key={c} color={c} active={color === c} onClick={() => onColor(c)} />
              ))}
              <CustomColorPicker value={color} onChange={onColor} />
            </div>
          </div>
          <div>
            <SectionLabel>Дополнительный цвет</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {WALL_PALETTES.map(c => (
                <ColorSwatch key={c} color={c} active={color2 === c} onClick={() => onColor2(c)} />
              ))}
              <CustomColorPicker value={color2} onChange={onColor2} />
            </div>
          </div>
          <div>
            <SectionLabel>Стиль</SectionLabel>
            <div className="flex gap-1.5">
              {styleOptions.map(opt => (
                <StyleButton key={opt.id} active={wallStyle === opt.id} onClick={() => onStyle(opt.id)}>
                  {opt.label}
                </StyleButton>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WallPanel({ c, set }: { c: RoomCustomization; set: (p: Partial<RoomCustomization>) => void }) {
  return (
    <div className="space-y-4">

      {/* Back wall */}
      <WallSubSection
        title="🖼 Задняя стена"
        image={c.wallImage}
        onImageChange={v => set({ wallImage: v })}
        color={c.wallColor}
        color2={c.wallColor2}
        wallStyle={c.wallStyle}
        onColor={v => set({ wallColor: v })}
        onColor2={v => set({ wallColor2: v })}
        onStyle={v => set({ wallStyle: v as RoomCustomization['wallStyle'] })}
        styleOptions={[
          { id: 'solid',      label: 'Однотонная' },
          { id: 'v_gradient', label: 'Градиент ↓' },
          { id: 'r_gradient', label: 'Радиальный' },
        ]}
      />

      {/* Side walls */}
      <WallSubSection
        title="🧱 Боковые стены"
        image={c.sideWallImage}
        onImageChange={v => set({ sideWallImage: v })}
        color={c.sideWallColor}
        color2={c.sideWallColor2}
        wallStyle={c.sideWallStyle}
        onColor={v => set({ sideWallColor: v })}
        onColor2={v => set({ sideWallColor2: v })}
        onStyle={v => set({ sideWallStyle: v as RoomCustomization['sideWallStyle'] })}
        styleOptions={[
          { id: 'solid',      label: 'Однотонная' },
          { id: 'v_gradient', label: 'Градиент ↓' },
        ]}
      />

      {/* Ceiling */}
      <WallSubSection
        title="☁️ Потолок"
        image={c.ceilingImage}
        onImageChange={v => set({ ceilingImage: v })}
        color={c.ceilingColor}
        color2={c.ceilingColor2}
        wallStyle={c.ceilingStyle}
        onColor={v => set({ ceilingColor: v })}
        onColor2={v => set({ ceilingColor2: v })}
        onStyle={v => set({ ceilingStyle: v as RoomCustomization['ceilingStyle'] })}
        styleOptions={[
          { id: 'solid',      label: 'Однотонная' },
          { id: 'v_gradient', label: 'Градиент' },
        ]}
      />

    </div>
  );
}

// ── Floor panel ───────────────────────────────────────────────────────────────

const FLOOR_STYLES: Array<{ id: FloorStyle; label: string; preview: string }> = [
  { id: 'flat',   label: 'Плоский', preview: '▬' },
  { id: 'grid',   label: 'Сетка',   preview: '⊞' },
  { id: 'wood',   label: 'Паркет',  preview: '≡' },
  { id: 'tile',   label: 'Плитка',  preview: '⊟' },
  { id: 'marble', label: 'Мрамор',  preview: '≀' },
  { id: 'metal',  label: 'Металл',  preview: '⊠' },
];

function FloorPanel({ c, set }: { c: RoomCustomization; set: (p: Partial<RoomCustomization>) => void }) {
  return (
    <div className="space-y-4">
      <ImageUpload
        label="текстуру пола"
        value={c.floorImage}
        onChange={v => set({ floorImage: v })}
      />

      {!c.floorImage && (
        <>
          <div>
            <SectionLabel>Цвет</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {FLOOR_PALETTES.map(color => (
                <ColorSwatch key={color} color={color} active={c.floorColor === color} onClick={() => set({ floorColor: color })} />
              ))}
              <CustomColorPicker value={c.floorColor} onChange={v => set({ floorColor: v })} />
            </div>
          </div>
          <div>
            <SectionLabel>Текстура</SectionLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {FLOOR_STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => set({ floorStyle: s.id })}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all"
                  style={{
                    background: c.floorStyle === s.id ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.06)',
                    color: c.floorStyle === s.id ? '#C4B5FD' : 'rgba(255,255,255,0.4)',
                    border: c.floorStyle === s.id ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{s.preview}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AccentPanel({ c, set }: { c: RoomCustomization; set: (p: Partial<RoomCustomization>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Цвет акцента</SectionLabel>
        <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Влияет на свечение, линии сетки и фоновые эффекты
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ACCENT_PALETTES.map(color => (
            <ColorSwatch key={color} color={color} active={c.accentColor === color} onClick={() => set({ accentColor: color })} />
          ))}
          <CustomColorPicker value={c.accentColor} onChange={v => set({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}

// ── Lighting panel ────────────────────────────────────────────────────────────

const LIGHT_PRESETS: Array<Omit<RoomLight, 'id' | 'isOn'>> = [
  { name: 'Потолочный',     x: 50, y: 22, color: '#FFFFFF', intensity: 0.45, size: 90  },
  { name: 'Бра левое',      x: 12, y: 38, color: '#FFE0A0', intensity: 0.38, size: 52  },
  { name: 'Бра правое',     x: 88, y: 38, color: '#FFE0A0', intensity: 0.38, size: 52  },
  { name: 'Подсветка пола', x: 50, y: 90, color: '#8060FF', intensity: 0.30, size: 75  },
  { name: 'Солнце',         x: 88, y: 8,  color: '#FFF5C0', intensity: 0.65, size: 140 },
  { name: 'Луна',           x: 78, y: 12, color: '#C0D8FF', intensity: 0.28, size: 85  },
  { name: 'Неон',           x: 50, y: 50, color: '#FF00FF', intensity: 0.32, size: 100 },
];

function LightCard({ light, onUpdate, onRemove }: {
  light: RoomLight;
  onUpdate: (changes: Partial<RoomLight>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOn = light.isOn;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${isOn ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)'}` }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* On/off dot */}
        <button
          onClick={() => onUpdate({ isOn: !isOn })}
          style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: isOn ? light.color : 'rgba(255,255,255,0.18)',
            boxShadow: isOn ? `0 0 6px ${light.color}` : 'none',
            border: 'none', cursor: 'pointer',
          }}
        />
        <span
          className="flex-1 text-xs font-semibold truncate cursor-pointer"
          style={{ color: isOn ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)' }}
          onClick={() => setExpanded(e => !e)}
        >
          {light.name}
        </span>
        {/* Colour swatch */}
        <label style={{ width: 16, height: 16, borderRadius: 4, background: light.color, flexShrink: 0, cursor: 'pointer', position: 'relative' }}>
          <input type="color" value={light.color} onChange={e => onUpdate({ color: e.target.value })}
            style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
        </label>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[11px] w-5 h-5 flex items-center justify-center rounded"
          style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)' }}
        >{expanded ? '▲' : '▼'}</button>
        <button
          onClick={onRemove}
          className="text-[10px] w-5 h-5 flex items-center justify-center rounded"
          style={{ color: '#FCA5A5', background: 'rgba(239,68,68,0.12)' }}
        >✕</button>
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-[10px] w-14 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>Яркость</span>
            <input type="range" min={0.05} max={1} step={0.05} value={light.intensity}
              onChange={e => onUpdate({ intensity: parseFloat(e.target.value) })}
              className="flex-1 accent-purple-500" />
            <span className="text-[10px] w-7 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{Math.round(light.intensity * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] w-14 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>Размер</span>
            <input type="range" min={20} max={200} step={5} value={light.size}
              onChange={e => onUpdate({ size: parseFloat(e.target.value) })}
              className="flex-1 accent-purple-500" />
            <span className="text-[10px] w-7 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{light.size}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] w-14 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>← Право</span>
            <input type="range" min={0} max={100} step={1} value={light.x}
              onChange={e => onUpdate({ x: parseFloat(e.target.value) })}
              className="flex-1 accent-purple-500" />
            <span className="text-[10px] w-7 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{light.x}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] w-14 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>↑ Низ</span>
            <input type="range" min={0} max={100} step={1} value={light.y}
              onChange={e => onUpdate({ y: parseFloat(e.target.value) })}
              className="flex-1 accent-purple-500" />
            <span className="text-[10px] w-7 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{light.y}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SunStatus() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const h = now.getHours() + now.getMinutes() / 60;
  const sunriseH = 6, sunsetH = 20;
  const isUp = h >= sunriseH && h <= sunsetH;
  const progress = isUp ? (h - sunriseH) / (sunsetH - sunriseH) : 0;
  const phase =
    !isUp        ? 'Ночь 🌙' :
    h < 7.5      ? 'Рассвет 🌅' :
    h < 10       ? 'Утро ☀️' :
    h < 14       ? 'Полдень ☀️' :
    h < 17       ? 'День 🌤' :
    h < 18.5     ? 'Вечер 🌇' :
                   'Закат 🌆';

  return (
    <div className="flex items-center gap-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
      <span>{phase}</span>
      {isUp && (
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: 'linear-gradient(to right, #FF8040, #FFEE80)', borderRadius: 999 }} />
        </div>
      )}
      <span>{now.getHours().toString().padStart(2,'0')}:{now.getMinutes().toString().padStart(2,'0')}</span>
    </div>
  );
}

function LightingPanel() {
  const { roomCustomization: c, setRoomCustomization, addRoomLight, updateRoomLight, removeRoomLight } = usePetStore();
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div className="space-y-3">

      {/* ── Ambient darkness ─────────────────────────────── */}
      <div className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <SectionLabel>Фоновая темнота</SectionLabel>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>☀️</span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={c.ambientDarkness}
            onChange={e => setRoomCustomization({ ambientDarkness: parseFloat(e.target.value) })}
            className="flex-1 accent-purple-500"
          />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>🌑</span>
          <span className="text-[10px] w-7 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{Math.round(c.ambientDarkness * 100)}%</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([['День', 0], ['Сумерки', 0.45], ['Ночь', 0.82], ['Кромешная тьма', 0.96]] as [string, number][]).map(([label, val]) => (
            <button
              key={label}
              onClick={() => setRoomCustomization({ ambientDarkness: val })}
              className="px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all"
              style={{
                background: Math.abs(c.ambientDarkness - val) < 0.05 ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* ── Sun ──────────────────────────────────────────── */}
      <div className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(255,180,40,0.06)', border: '1px solid rgba(255,180,40,0.15)' }}>
        <div className="flex items-center justify-between">
          <SectionLabel>Солнечный свет</SectionLabel>
          <button
            onClick={() => setRoomCustomization({ hasSun: !c.hasSun })}
            className="px-3 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={{
              background: c.hasSun ? 'rgba(255,180,40,0.35)' : 'rgba(255,255,255,0.08)',
              color: c.hasSun ? '#FFD060' : 'rgba(255,255,255,0.4)',
              border: c.hasSun ? '1px solid rgba(255,180,40,0.5)' : '1px solid rgba(255,255,255,0.1)',
            }}
          >{c.hasSun ? '☀️ Включено' : '☀️ Выключено'}</button>
        </div>
        {c.hasSun && <SunStatus />}
        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Позиция и цвет меняются автоматически в зависимости от времени суток. Поднимите темноту для контраста.
        </p>
      </div>

      {/* ── Manual light sources ──────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Ручные источники света
        </p>
        <button
          onClick={() => setShowPresets(s => !s)}
          className="px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0"
          style={{ background: 'rgba(124,58,237,0.25)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.4)' }}
        >+ Добавить</button>
      </div>

      {showPresets && (
        <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {LIGHT_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => { addRoomLight({ ...preset, isOn: true }); setShowPresets(false); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: preset.color, flexShrink: 0, boxShadow: `0 0 5px ${preset.color}` }} />
              <span className="text-[10px] font-semibold text-white truncate">{preset.name}</span>
            </button>
          ))}
        </div>
      )}

      {c.roomLights.length === 0 ? (
        <p className="text-center text-xs py-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Нет источников света</p>
      ) : (
        <div className="space-y-2">
          {c.roomLights.map(light => (
            <LightCard
              key={light.id}
              light={light}
              onUpdate={changes => updateRoomLight(light.id, changes)}
              onRemove={() => removeRoomLight(light.id)}
            />
          ))}
        </div>
      )}

      <p className="text-[9px] pt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
        💡 Мебельные лампы (свеча, фонарик…) автоматически добавляют свет когда включены
      </p>
    </div>
  );
}

function extractGradientHex(gradient: string): string[] {
  return gradient.match(/#[0-9A-Fa-f]{6}/g) ?? [];
}

function ThemePanel() {
  const { equippedBgId, ownedBgs, buyBg, equipBg, coins, pet, setRoomCustomization } = usePetStore();

  const applyThemeColors = (bgId: string) => {
    const bg = getBackground(bgId);
    const hexes = extractGradientHex(bg.gradient);
    const wallColor  = hexes[hexes.length - 1] ?? '#0D0020';
    const wallColor2 = hexes[0] ?? wallColor;
    setRoomCustomization({
      accentColor:    bg.accentColor,
      wallColor,
      wallColor2,
      wallStyle:      'v_gradient',
      sideWallColor:  wallColor2,
      sideWallColor2: wallColor,
      sideWallStyle:  'v_gradient',
      ceilingColor:   hexes[hexes.length - 1] ?? wallColor,
      ceilingStyle:   'solid',
      floorColor:     bg.accentColor,
      wallImage:      null,
      sideWallImage:  null,
      ceilingImage:   null,
      floorImage:     null,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Тема устанавливает эффекты и автоматически подбирает цвета стен, пола и акцента.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {BACKGROUNDS.map(bgDef => {
          const owned = ownedBgs.includes(bgDef.id);
          const equipped = equippedBgId === bgDef.id;
          const petLevel = pet?.level ?? 0;
          const locked = !owned && !!bgDef.requiredLevel && petLevel < bgDef.requiredLevel;
          const canAfford = coins >= bgDef.price;
          const rc = RARITY_COLOR[bgDef.rarity];

          return (
            <motion.div
              key={bgDef.id}
              whileHover={{ scale: 1.02 }}
              className={`relative overflow-hidden rounded-2xl cursor-pointer ${locked ? 'opacity-50' : ''}`}
              style={{
                border: equipped ? `1.5px solid ${bgDef.accentColor}88` : '1px solid rgba(255,255,255,0.12)',
                boxShadow: equipped ? `0 0 16px ${bgDef.accentColor}44` : 'none',
              }}
              onClick={() => {
                if (locked) return;
                if (owned) {
                  equipBg(bgDef.id);
                  applyThemeColors(bgDef.id);
                } else if (canAfford) {
                  buyBg(bgDef.id);
                }
              }}
            >
              <div className="h-14 flex items-center justify-center relative" style={{ background: bgDef.gradient }}>
                <span className="text-xl">{bgDef.emoji}</span>
                {locked && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span>🔒</span>
                  </div>
                )}
                {equipped && (
                  <div
                    className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ background: bgDef.accentColor }}
                  >✓</div>
                )}
              </div>
              <div className="px-2 py-1.5" style={{ background: 'rgba(15,10,30,0.9)' }}>
                <p className="text-[11px] font-bold text-white truncate">{bgDef.name}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px] font-bold" style={{ color: rc }}>{bgDef.rarity}</span>
                  {!owned && (
                    <span className="text-[9px] font-bold" style={{ color: canAfford ? '#FCD34D' : '#6B7280' }}>
                      🪙 {bgDef.price}
                    </span>
                  )}
                  {owned && !equipped && <span className="text-[9px] text-purple-300">Выбрать</span>}
                  {equipped && <span className="text-[9px] font-bold text-emerald-400">✓ Надет</span>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Room preset mini-preview ──────────────────────────────────────────────────

function PresetPreview({ p }: { p: RoomPreset }) {
  const c = p.customization;
  return (
    <div
      style={{
        width: 64, height: 46, borderRadius: 8, overflow: 'hidden',
        position: 'relative', flexShrink: 0,
        background: c.wallColor,
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      {/* side wall hints */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: '28%', width: '16%', background: c.sideWallColor, opacity: 0.8 }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: '28%', width: '16%', background: c.sideWallColor, opacity: 0.8 }} />
      {/* floor */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '28%', background: c.floorColor, opacity: 0.9 }} />
      {/* accent glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 60%, ${c.accentColor}22 0%, transparent 80%)` }} />
      {/* furniture items */}
      {p.furniture.slice(0, 10).map(f => {
        const def = getFurniture(f.itemId);
        if (!def) return null;
        return (
          <div key={f.uid} style={{
            position: 'absolute',
            left: `${f.x}%`, top: `${f.y}%`,
            transform: `translate(-50%, -50%) scaleX(${f.flipped ? -1 : 1})`,
            fontSize: `${Math.max(7, Math.min(11, f.scale * 7))}px`,
            lineHeight: 1, pointerEvents: 'none',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
          }}>
            {def.emoji}
          </div>
        );
      })}
    </div>
  );
}

// ── Presets panel ─────────────────────────────────────────────────────────────

function PresetsPanel() {
  const { roomPresets, saveRoomPreset, applyRoomPreset, deleteRoomPreset, exportRoomPreset, importRoomPreset } = usePetStore();
  const [nameInput, setNameInput] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSave = () => {
    const name = nameInput.trim();
    if (!name) return;
    saveRoomPreset(name);
    setNameInput('');
  };

  const handleCopyCode = (id: string) => {
    const code = exportRoomPreset(id);
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleImport = () => {
    const ok = importRoomPreset(importCode);
    if (ok) {
      setImportCode('');
      setImportError(false);
    } else {
      setImportError(true);
    }
  };

  return (
    <div className="space-y-4">

      {/* Save current */}
      <div className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
        <SectionLabel>Сохранить текущую комнату</SectionLabel>
        <div className="flex gap-2">
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Название пресета…"
            maxLength={30}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs text-white placeholder:text-white/30 outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
          />
          <button
            onClick={handleSave}
            disabled={!nameInput.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
            style={{
              background: nameInput.trim() ? 'linear-gradient(135deg,#7C3AED,#EC4899)' : 'rgba(255,255,255,0.08)',
              color: nameInput.trim() ? 'white' : 'rgba(255,255,255,0.3)',
            }}
          >
            💾 Сохранить
          </button>
        </div>
      </div>

      {/* Import by code */}
      <div className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <SectionLabel>Импорт по коду</SectionLabel>
        <div className="flex gap-2">
          <input
            value={importCode}
            onChange={e => { setImportCode(e.target.value); setImportError(false); }}
            onKeyDown={e => e.key === 'Enter' && importCode.trim() && handleImport()}
            placeholder="Вставить код комнаты…"
            className="flex-1 px-3 py-1.5 rounded-lg text-xs text-white placeholder:text-white/30 outline-none"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${importError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`,
            }}
          />
          <button
            onClick={handleImport}
            disabled={!importCode.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
            style={{
              background: importCode.trim() ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)',
              color: importCode.trim() ? '#6EE7B7' : 'rgba(255,255,255,0.3)',
              border: importCode.trim() ? '1px solid rgba(16,185,129,0.4)' : '1px solid transparent',
            }}
          >
            📥 Загрузить
          </button>
        </div>
        {importError && (
          <p className="text-[10px]" style={{ color: '#FCA5A5' }}>Неверный код — проверьте и попробуйте снова</p>
        )}
      </div>

      {/* List */}
      {roomPresets.length === 0 ? (
        <p className="text-center text-xs py-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Нет сохранённых комнат
        </p>
      ) : (
        <div className="space-y-2">
          <SectionLabel>Сохранённые комнаты ({roomPresets.length})</SectionLabel>
          {roomPresets.map(preset => (
            <motion.div
              key={preset.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-3 p-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              <PresetPreview p={preset} />

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{preset.name}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {new Date(preset.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {preset.furniture.length} предм.
                </p>
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => applyRoomPreset(preset.id)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.5),rgba(236,72,153,0.3))', border: '1px solid rgba(124,58,237,0.4)' }}
                >
                  ✓ Применить
                </button>

                <button
                  onClick={() => handleCopyCode(preset.id)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                  style={{
                    background: copiedId === preset.id ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.07)',
                    color: copiedId === preset.id ? '#6EE7B7' : 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {copiedId === preset.id ? '✓ Скопировано' : '📤 Код'}
                </button>

                {confirmDeleteId === preset.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => { deleteRoomPreset(preset.id); setConfirmDeleteId(null); }}
                      className="flex-1 py-1 rounded-lg text-[10px] font-bold transition-all"
                      style={{ background: 'rgba(239,68,68,0.35)', color: '#FCA5A5' }}
                    >
                      Да
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 py-1 rounded-lg text-[10px] font-bold transition-all"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                    >
                      Нет
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(preset.id)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    🗑 Удалить
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Draggable furniture item ───────────────────────────────────────────────────
// Uses raw pointer events instead of framer-motion drag to avoid the internal
// translate accumulation bug: framer-motion doesn't reset its x/y when the
// CSS left/top position updates, causing items to drift further on each drag.

interface DraggableFurnitureItemProps {
  placed: PlacedFurnitureItem;
  isSelected: boolean;
  onMove: (uid: string, dx: number, dy: number) => void;
  onSelect: (uid: string) => void;
}

function DraggableFurnitureItem({ placed, isSelected, onMove, onSelect }: DraggableFurnitureItemProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = React.useRef(false);
  const startPointer = React.useRef({ x: 0, y: 0 });

  const isDragging = !!(offset.x || offset.y);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (placed.locked) { onSelect(placed.uid); return; }
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    startPointer.current = { x: e.clientX, y: e.clientY };
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setOffset({ x: e.clientX - startPointer.current.x, y: e.clientY - startPointer.current.y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = e.clientX - startPointer.current.x;
    const dy = e.clientY - startPointer.current.y;
    setOffset({ x: 0, y: 0 });
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      onSelect(placed.uid);
    } else {
      onMove(placed.uid, dx, dy);
    }
  };

  return (
    <FurnitureItemVisual
      placed={placed}
      isSelected={isSelected}
      dragOffset={offset}
      isDragging={isDragging}
      interactive
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}

export function RoomEditorPage() {
  const {
    setActiveTab,
    coins,
    ownedFurnitureIds,
    placedFurniture,
    addRoomFurniture,
    removeRoomFurniture,
    updateRoomFurniture,
    buyRoomFurniture,
    clearRoomFurniture,
    roomCustomization,
    setRoomCustomization,
    resetRoomCustomization,
  } = usePetStore();

  const sceneRef = useRef<HTMLDivElement>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('furniture');
  const [roomTab, setRoomTab] = useState<RoomTab>('wall');
  const [furnitureCategory, setFurnitureCategory] = useState<FurnitureCategory>('plant');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  const selectedItem = placedFurniture.find(p => p.uid === selectedUid) ?? null;
  const selectedPaintingUrl = useImageUrl(selectedItem?.imageUrl);

  const countInRoom = (itemId: string) =>
    placedFurniture.filter(p => p.itemId === itemId).length;

  const handleSceneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === sceneRef.current) setSelectedUid(null);
  };

  const handleFurnitureMove = (uid: string, dx: number, dy: number) => {
    if (!sceneRef.current) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const placed = placedFurniture.find(p => p.uid === uid);
    if (!placed) return;
    updateRoomFurniture(uid, {
      x: Math.max(3, Math.min(97, placed.x + (dx / rect.width) * 100)),
      y: Math.max(3, Math.min(97, placed.y + (dy / rect.height) * 100)),
    });
  };

  const ROOM_TABS: Array<{ id: RoomTab; label: string }> = [
    { id: 'wall',     label: '🧱 Стена'  },
    { id: 'floor',    label: '🏠 Пол'    },
    { id: 'accent',   label: '✨ Акцент' },
    { id: 'lighting', label: '💡 Свет'   },
    { id: 'theme',    label: '🌌 Тема'   },
    { id: 'presets',  label: '💾 Пресеты'},
  ];

  const itemsInCategory = getFurnitureByCategory(furnitureCategory);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, pointerEvents: 'auto' }}
      exit={{ opacity: 0, pointerEvents: 'none' }}
      transition={{ duration: 0.2 }}
      style={{ background: 'rgba(15,10,30,0.92)', backdropFilter: 'blur(8px)' }}
    >
      {/* ── Left Panel ──────────────────────────────────────────── */}
      <div
        className="w-72 h-full flex flex-col shrink-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.07)',
          borderRight: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {/* Top-level tabs */}
        <div className="flex gap-1 p-3 shrink-0">
          {(['furniture', 'room'] as PanelTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setPanelTab(tab)}
              className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: panelTab === tab
                  ? 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(236,72,153,0.2))'
                  : 'rgba(255,255,255,0.05)',
                color: panelTab === tab ? '#E9D5FF' : 'rgba(255,255,255,0.5)',
                border: panelTab === tab ? '1px solid rgba(124,58,237,0.4)' : '1px solid transparent',
              }}
            >
              {tab === 'furniture' ? '🛋️ Мебель' : '🎨 Комната'}
            </button>
          ))}
        </div>

        {/* ── Furniture panel ── */}
        {panelTab === 'furniture' && (
          <>
            <div className="flex flex-wrap gap-1 px-3 pb-2 shrink-0">
              {FURNITURE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFurnitureCategory(cat.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: furnitureCategory === cat.id ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)',
                    color: furnitureCategory === cat.id ? '#C4B5FD' : 'rgba(255,255,255,0.5)',
                    border: furnitureCategory === cat.id ? '1px solid rgba(124,58,237,0.4)' : '1px solid transparent',
                  }}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
              {itemsInCategory.map(item => {
                const owned = ownedFurnitureIds.includes(item.id);
                const canAfford = coins >= item.price;
                const inRoom = countInRoom(item.id);
                const rc = RARITY_COLOR[item.rarity];

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2.5 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <span className="text-3xl leading-none shrink-0">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{item.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-bold" style={{ color: rc }}>{item.rarity}</span>
                        {inRoom > 0 && (
                          <span className="text-[10px] font-semibold text-purple-300 ml-1">×{inRoom}</span>
                        )}
                      </div>
                    </div>
                    {owned ? (
                      <button
                        onClick={() => addRoomFurniture(item.id)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-white transition-all shrink-0"
                        style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}
                      >
                        + Добавить
                      </button>
                    ) : (
                      <button
                        onClick={() => canAfford && buyRoomFurniture(item.id)}
                        disabled={!canAfford}
                        className="px-2 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0"
                        style={{
                          background: canAfford
                            ? 'linear-gradient(135deg,rgba(245,158,11,0.3),rgba(245,158,11,0.15))'
                            : 'rgba(255,255,255,0.06)',
                          color: canAfford ? '#FCD34D' : 'rgba(255,255,255,0.3)',
                          border: canAfford ? '1px solid rgba(245,158,11,0.35)' : '1px solid transparent',
                        }}
                      >
                        {item.price === 0 ? '+ Добавить' : `🪙 ${item.price}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Room panel ── */}
        {panelTab === 'room' && (
          <>
            {/* Room sub-tabs */}
            <div className="grid grid-cols-3 gap-1 px-3 pb-2 shrink-0">
              {ROOM_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setRoomTab(t.id)}
                  className="py-1.5 rounded-lg text-[10px] font-bold transition-all"
                  style={{
                    background: roomTab === t.id ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)',
                    color: roomTab === t.id ? '#C4B5FD' : 'rgba(255,255,255,0.4)',
                    border: roomTab === t.id ? '1px solid rgba(124,58,237,0.4)' : '1px solid transparent',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {roomTab === 'wall'     && <WallPanel     c={roomCustomization} set={setRoomCustomization} />}
              {roomTab === 'floor'    && <FloorPanel    c={roomCustomization} set={setRoomCustomization} />}
              {roomTab === 'accent'   && <AccentPanel   c={roomCustomization} set={setRoomCustomization} />}
              {roomTab === 'lighting' && <LightingPanel />}
              {roomTab === 'theme'    && <ThemePanel />}
              {roomTab === 'presets'  && <PresetsPanel />}

              {/* Reset button */}
              {roomTab !== 'theme' && roomTab !== 'presets' && roomTab !== 'lighting' && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <button
                    onClick={resetRoomCustomization}
                    className="w-full py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.4)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    ↺ Сбросить к стандарту
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Right: Preview ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <h1 className="font-display font-bold text-xl text-white">🛋️ Редактор комнаты</h1>
          <div className="flex items-center gap-2">
            {clearConfirm ? (
              <>
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>Удалить всю мебель?</span>
                <button
                  onClick={() => { clearRoomFurniture(); setSelectedUid(null); setClearConfirm(false); }}
                  className="px-3 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'rgba(239,68,68,0.35)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.5)' }}
                >Да</button>
                <button
                  onClick={() => setClearConfirm(false)}
                  className="px-3 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
                >Нет</button>
              </>
            ) : (
              <button
                onClick={() => setClearConfirm(true)}
                className="px-3 py-2 rounded-xl text-sm font-bold transition-all"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                🗑️ Очистить всё
              </button>
            )}
            <button
              onClick={() => setActiveTab('home')}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              ✕ Закрыть
            </button>
          </div>
        </div>

        {/* Scene + controls */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-4 p-6">
          {/* Room preview */}
          <RoomScene
            height="clamp(320px, 40vw, 480px)"
            maxWidth="600px"
            sceneRef={sceneRef}
            onSceneClick={handleSceneClick}
            className="cursor-crosshair"
          >
            {/* Draggable furniture */}
            {placedFurniture.map(placed => (
              <DraggableFurnitureItem
                key={placed.uid}
                placed={placed}
                isSelected={selectedUid === placed.uid}
                onMove={handleFurnitureMove}
                onSelect={setSelectedUid}
              />
            ))}
          </RoomScene>

          {/* Selected item controls */}
          <AnimatePresence>
            {selectedItem && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.18 }}
                className="w-full rounded-2xl p-4 flex flex-wrap items-center gap-4"
                style={{
                  maxWidth: '600px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(124,58,237,0.3)',
                }}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-3xl leading-none">{getFurniture(selectedItem.itemId)?.emoji}</span>
                  <span className="text-sm font-bold text-white">{getFurniture(selectedItem.itemId)?.name}</span>
                </div>

                {/* Painting photo upload */}
                {selectedItem.itemId === 'painting' && (
                  <div className="flex items-center gap-2 w-full">
                    {selectedItem.imageUrl ? (
                      <>
                        <img
                          src={selectedPaintingUrl ?? ''}
                          style={{ width: 40, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(201,162,39,0.6)', flexShrink: 0 }}
                        />
                        <span className="text-xs flex-1 truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>Своя фотография</span>
                        <button
                          onClick={() => { deleteImage(selectedItem.imageUrl); updateRoomFurniture(selectedItem.uid, { imageUrl: undefined }); }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0"
                          style={{ background: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}
                        >✕ Убрать</button>
                      </>
                    ) : (
                      <label
                        className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all w-full"
                        style={{ background: 'rgba(201,162,39,0.12)', border: '1px dashed rgba(201,162,39,0.4)', color: 'rgba(255,220,100,0.8)' }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async ev => {
                              const ref = await saveImage(ev.target?.result as string);
                              updateRoomFurniture(selectedItem.uid, { imageUrl: ref });
                              e.target.value = '';
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        <span style={{ fontSize: 16 }}>🖼️</span>
                        <span className="text-xs font-semibold">Добавить фото в картину</span>
                      </label>
                    )}
                  </div>
                )}

                {/* Size */}
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-purple-300 shrink-0">Размер</span>
                  <input
                    type="range" min={0.5} max={3} step={0.1}
                    value={selectedItem.scale}
                    onChange={e => updateRoomFurniture(selectedItem.uid, { scale: parseFloat(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-xs text-purple-300 w-8 text-right">{selectedItem.scale.toFixed(1)}</span>
                </div>

                {/* Rotation (Z) */}
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-purple-300 shrink-0 w-16">Поворот</span>
                  <input
                    type="range" min={-180} max={180} step={1}
                    value={selectedItem.rotation ?? 0}
                    onChange={e => updateRoomFurniture(selectedItem.uid, { rotation: parseFloat(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-xs text-purple-300 w-10 text-right">{(selectedItem.rotation ?? 0).toFixed(0)}°</span>
                </div>

                {/* Tilt X (lean forward/back in 3D) */}
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-purple-300 shrink-0 w-16">3D ось X</span>
                  <input
                    type="range" min={-80} max={80} step={1}
                    value={selectedItem.tiltX ?? 0}
                    onChange={e => updateRoomFurniture(selectedItem.uid, { tiltX: parseFloat(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-xs text-purple-300 w-10 text-right">{(selectedItem.tiltX ?? 0).toFixed(0)}°</span>
                </div>

                {/* Tilt Y (lean left/right in 3D) */}
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-purple-300 shrink-0 w-16">3D ось Y</span>
                  <input
                    type="range" min={-80} max={80} step={1}
                    value={selectedItem.tiltY ?? 0}
                    onChange={e => updateRoomFurniture(selectedItem.uid, { tiltY: parseFloat(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-xs text-purple-300 w-10 text-right">{(selectedItem.tiltY ?? 0).toFixed(0)}°</span>
                </div>

                {/* Color / Hue */}
                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                  <span className="text-xs text-purple-300 shrink-0">Цвет</span>
                  <div className="relative flex-1">
                    <input
                      type="range" min={0} max={359} step={1}
                      value={selectedItem.hue ?? 0}
                      onChange={e => updateRoomFurniture(selectedItem.uid, { hue: parseFloat(e.target.value) })}
                      className="w-full h-3 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: 'linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)',
                        WebkitAppearance: 'none',
                      }}
                    />
                  </div>
                  <button
                    onClick={() => updateRoomFurniture(selectedItem.uid, { hue: 0 })}
                    className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                    title="Сбросить цвет"
                  >↺</button>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => updateRoomFurniture(selectedItem.uid, { flipped: !selectedItem.flipped })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all"
                    style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)' }}
                  >
                    ↔ Отразить
                  </button>
                  {getFurniture(selectedItem.itemId)?.category === 'lamp' && (
                    <button
                      onClick={() => updateRoomFurniture(selectedItem.uid, { isOn: !(selectedItem.isOn ?? true) })}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: (selectedItem.isOn ?? true)
                          ? 'rgba(251,191,36,0.25)'
                          : 'rgba(255,255,255,0.08)',
                        color: (selectedItem.isOn ?? true) ? '#FCD34D' : 'rgba(255,255,255,0.45)',
                        border: (selectedItem.isOn ?? true)
                          ? '1px solid rgba(251,191,36,0.45)'
                          : '1px solid rgba(255,255,255,0.12)',
                      }}
                    >
                      {(selectedItem.isOn ?? true) ? '💡 Выкл.' : '🌑 Вкл.'}
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const maxZ = Math.max(...placedFurniture.map(f => f.zIndex));
                        updateRoomFurniture(selectedItem.uid, { zIndex: maxZ + 1 });
                      }}
                      title="На самый перед"
                      className="h-8 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                    >⤒</button>
                    <button
                      onClick={() => updateRoomFurniture(selectedItem.uid, { zIndex: selectedItem.zIndex + 1 })}
                      title="Слой выше"
                      className="w-8 h-8 rounded-lg text-sm font-bold transition-all flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                    >↑</button>
                    <span
                      className="text-[10px] font-mono w-6 text-center"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >{selectedItem.zIndex}</span>
                    <button
                      onClick={() => updateRoomFurniture(selectedItem.uid, { zIndex: Math.max(1, selectedItem.zIndex - 1) })}
                      title="Слой ниже"
                      className="w-8 h-8 rounded-lg text-sm font-bold transition-all flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                    >↓</button>
                    <button
                      onClick={() => {
                        const minZ = Math.min(...placedFurniture.map(f => f.zIndex));
                        updateRoomFurniture(selectedItem.uid, { zIndex: Math.max(1, minZ - 1) });
                      }}
                      title="На самый зад"
                      className="h-8 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                    >⤓</button>
                  </div>
                  <button
                    onClick={() => updateRoomFurniture(selectedItem.uid, { locked: !selectedItem.locked })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: selectedItem.locked ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)',
                      color: selectedItem.locked ? '#FCD34D' : 'rgba(255,255,255,0.6)',
                      border: selectedItem.locked ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.12)',
                    }}
                  >
                    {selectedItem.locked ? '🔒 Разблок.' : '🔓 Заблок.'}
                  </button>
                  <button
                    onClick={() => { removeRoomFurniture(selectedItem.uid); setSelectedUid(null); }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{ background: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.35)' }}
                  >
                    🗑️ Удалить
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {placedFurniture.length === 0 && (
            <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Добавьте мебель из левой панели
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
