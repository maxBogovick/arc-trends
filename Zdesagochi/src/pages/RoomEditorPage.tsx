import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore, type RoomCustomization, type FloorStyle } from '../store/petStore';
import { getFurniture, getFurnitureByCategory } from '../data/roomFurniture';
import { BACKGROUNDS } from '../data/backgrounds';
import { getBackground } from '../data/backgrounds';
import { RoomScene } from '../components/Pet/RoomScene';

type PanelTab = 'furniture' | 'room';
type RoomTab = 'wall' | 'floor' | 'accent' | 'theme';
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
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div>
      <SectionLabel>Своё изображение</SectionLabel>
      {value ? (
        <div className="relative rounded-xl overflow-hidden" style={{ height: 68 }}>
          <img src={value} alt="" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            <button
              onClick={() => onChange(null)}
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

function WallPanel({ c, set }: { c: RoomCustomization; set: (p: Partial<RoomCustomization>) => void }) {
  return (
    <div className="space-y-4">
      <ImageUpload
        label="фон стены"
        value={c.wallImage}
        onChange={v => set({ wallImage: v })}
      />

      {!c.wallImage && (
        <>
          <div>
            <SectionLabel>Основной цвет</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {WALL_PALETTES.map(color => (
                <ColorSwatch key={color} color={color} active={c.wallColor === color} onClick={() => set({ wallColor: color })} />
              ))}
              <CustomColorPicker value={c.wallColor} onChange={v => set({ wallColor: v })} />
            </div>
          </div>
          <div>
            <SectionLabel>Дополнительный цвет</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {WALL_PALETTES.map(color => (
                <ColorSwatch key={color} color={color} active={c.wallColor2 === color} onClick={() => set({ wallColor2: color })} />
              ))}
              <CustomColorPicker value={c.wallColor2} onChange={v => set({ wallColor2: v })} />
            </div>
          </div>
          <div>
            <SectionLabel>Стиль</SectionLabel>
            <div className="flex gap-1.5">
              <StyleButton active={c.wallStyle === 'solid'} onClick={() => set({ wallStyle: 'solid' })}>Однотонная</StyleButton>
              <StyleButton active={c.wallStyle === 'v_gradient'} onClick={() => set({ wallStyle: 'v_gradient' })}>Градиент ↓</StyleButton>
              <StyleButton active={c.wallStyle === 'r_gradient'} onClick={() => set({ wallStyle: 'r_gradient' })}>Радиальный</StyleButton>
            </div>
          </div>
        </>
      )}
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
    <div className="space-y-4">
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

function ThemePanel() {
  const { equippedBgId, ownedBgs, buyBg, equipBg, coins, pet, setRoomCustomization } = usePetStore();

  const applyThemeColors = (bgId: string) => {
    const bg = getBackground(bgId);
    setRoomCustomization({ accentColor: bg.accentColor });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Тема определяет спецэффекты и декорации. Цвета стен/пола можно изменить отдельно.
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

  const selectedItem = placedFurniture.find(p => p.uid === selectedUid) ?? null;

  const countInRoom = (itemId: string) =>
    placedFurniture.filter(p => p.itemId === itemId).length;

  const handleSceneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === sceneRef.current) setSelectedUid(null);
  };

  const handleDragEnd = (uid: string, offsetX: number, offsetY: number) => {
    if (!sceneRef.current) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const placed = placedFurniture.find(p => p.uid === uid);
    if (!placed) return;
    updateRoomFurniture(uid, {
      x: Math.max(2, Math.min(98, placed.x + (offsetX / rect.width) * 100)),
      y: Math.max(2, Math.min(92, placed.y + (offsetY / rect.height) * 100)),
    });
  };

  const ROOM_TABS: Array<{ id: RoomTab; label: string }> = [
    { id: 'wall',   label: '🧱 Стена' },
    { id: 'floor',  label: '🏠 Пол' },
    { id: 'accent', label: '✨ Акцент' },
    { id: 'theme',  label: '🌌 Тема' },
  ];

  const itemsInCategory = getFurnitureByCategory(furnitureCategory);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
            <div className="grid grid-cols-4 gap-1 px-3 pb-2 shrink-0">
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
              {roomTab === 'wall'   && <WallPanel   c={roomCustomization} set={setRoomCustomization} />}
              {roomTab === 'floor'  && <FloorPanel  c={roomCustomization} set={setRoomCustomization} />}
              {roomTab === 'accent' && <AccentPanel c={roomCustomization} set={setRoomCustomization} />}
              {roomTab === 'theme'  && <ThemePanel />}

              {/* Reset button */}
              {roomTab !== 'theme' && (
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
            <button
              onClick={() => {
                if (window.confirm('Очистить всю мебель в комнате?')) {
                  clearRoomFurniture();
                  setSelectedUid(null);
                }
              }}
              className="px-3 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'rgba(239,68,68,0.15)',
                color: '#FCA5A5',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              🗑️ Очистить всё
            </button>
            <button
              onClick={() => setActiveTab('home')}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
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
            {placedFurniture.map(placed => {
              const def = getFurniture(placed.itemId);
              if (!def) return null;
              const isSelected = selectedUid === placed.uid;

              return (
                <motion.div
                  key={placed.uid}
                  drag
                  dragMomentum={false}
                  dragConstraints={sceneRef}
                  onDragEnd={(_e, info) => handleDragEnd(placed.uid, info.offset.x, info.offset.y)}
                  onClick={e => { e.stopPropagation(); setSelectedUid(placed.uid); }}
                  style={{
                    position: 'absolute',
                    left: `${placed.x}%`,
                    top: `${placed.y}%`,
                    transform: `translate(-50%, -50%) scaleX(${placed.flipped ? -1 : 1})`,
                    fontSize: `${placed.scale * 2.5}rem`,
                    cursor: isSelected ? 'grabbing' : 'grab',
                    zIndex: placed.zIndex,
                    filter: isSelected
                      ? 'drop-shadow(0 0 8px rgba(124,58,237,0.8))'
                      : 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
                    userSelect: 'none',
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  {def.emoji}
                </motion.div>
              );
            })}
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

                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                  <span className="text-xs text-purple-300 shrink-0">Размер</span>
                  <input
                    type="range" min={0.5} max={3} step={0.1}
                    value={selectedItem.scale}
                    onChange={e => updateRoomFurniture(selectedItem.uid, { scale: parseFloat(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-xs text-purple-300 w-8 text-right">{selectedItem.scale.toFixed(1)}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => updateRoomFurniture(selectedItem.uid, { flipped: !selectedItem.flipped })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all"
                    style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)' }}
                  >
                    ↔ Отразить
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateRoomFurniture(selectedItem.uid, { zIndex: selectedItem.zIndex + 1 })}
                      title="Слой выше"
                      className="w-8 h-8 rounded-lg text-sm font-bold transition-all flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                    >↑</button>
                    <button
                      onClick={() => updateRoomFurniture(selectedItem.uid, { zIndex: Math.max(1, selectedItem.zIndex - 1) })}
                      title="Слой ниже"
                      className="w-8 h-8 rounded-lg text-sm font-bold transition-all flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                    >↓</button>
                  </div>
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
