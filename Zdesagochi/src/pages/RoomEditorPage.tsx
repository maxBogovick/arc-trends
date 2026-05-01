import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../store/petStore';
import { getFurniture, getFurnitureByCategory } from '../data/roomFurniture';
import { BACKGROUNDS } from '../data/backgrounds';
import { getBackground } from '../data/backgrounds';
import { SceneEffects } from '../components/Pet/SceneEffects';

const COLOR_PRESETS = [
  '#7C3AED', '#EC4899', '#3B82F6', '#06B6D4', '#10B981',
  '#22C55E', '#EAB308', '#F97316', '#EF4444', '#F43F5E',
  '#6366F1', '#D946EF', '#0EA5E9', '#84CC16', '#F8FAFC',
];

function applyColorOverride(hex: string, base: ReturnType<typeof getBackground>) {
  return {
    ...base,
    gradient: `radial-gradient(ellipse at 40% 30%, ${hex}55 0%, ${hex}1A 55%, #030008 100%)`,
    floorGradient: `linear-gradient(180deg, transparent, ${hex}2E)`,
    accentColor: hex,
  };
}

type PanelTab = 'furniture' | 'bg';
type FurnitureCategory = 'plant' | 'lamp' | 'decor' | 'furniture' | 'gadget' | 'special';

const CATEGORIES: Array<{ id: FurnitureCategory; emoji: string; label: string }> = [
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
    equippedBgId,
    ownedBgs,
    buyBg,
    equipBg,
    roomBgColorOverride,
    setRoomBgColorOverride,
    pet,
  } = usePetStore();

  const sceneRef = useRef<HTMLDivElement>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('furniture');
  const [furnitureCategory, setFurnitureCategory] = useState<FurnitureCategory>('plant');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const selectedItem = placedFurniture.find(p => p.uid === selectedUid) ?? null;

  const rawBg = getBackground(equippedBgId ?? 'void_dark');
  const bg = roomBgColorOverride ? applyColorOverride(roomBgColorOverride, rawBg) : rawBg;

  const itemsInCategory = getFurnitureByCategory(furnitureCategory);

  const countInRoom = (itemId: string) =>
    placedFurniture.filter(p => p.itemId === itemId).length;

  const handleSceneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === sceneRef.current) {
      setSelectedUid(null);
    }
  };

  const handleDragEnd = (uid: string, offsetX: number, offsetY: number) => {
    if (!sceneRef.current) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const placed = placedFurniture.find(p => p.uid === uid);
    if (!placed) return;
    const newX = placed.x + (offsetX / rect.width) * 100;
    const newY = placed.y + (offsetY / rect.height) * 100;
    updateRoomFurniture(uid, {
      x: Math.max(2, Math.min(98, newX)),
      y: Math.max(2, Math.min(92, newY)),
    });
  };

  const handleLayerUp = () => {
    if (!selectedItem) return;
    updateRoomFurniture(selectedItem.uid, { zIndex: selectedItem.zIndex + 1 });
  };

  const handleLayerDown = () => {
    if (!selectedItem) return;
    updateRoomFurniture(selectedItem.uid, { zIndex: Math.max(1, selectedItem.zIndex - 1) });
  };

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
        {/* Panel tabs */}
        <div className="flex gap-1 p-3 shrink-0">
          {(['furniture', 'bg'] as PanelTab[]).map(tab => (
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
              {tab === 'furniture' ? '🛋️ Мебель' : '🌌 Фон'}
            </button>
          ))}
        </div>

        {panelTab === 'furniture' && (
          <>
            {/* Category tabs */}
            <div className="flex flex-wrap gap-1 px-3 pb-2 shrink-0">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFurnitureCategory(cat.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: furnitureCategory === cat.id
                      ? 'rgba(124,58,237,0.35)'
                      : 'rgba(255,255,255,0.07)',
                    color: furnitureCategory === cat.id ? '#C4B5FD' : 'rgba(255,255,255,0.5)',
                    border: furnitureCategory === cat.id
                      ? '1px solid rgba(124,58,237,0.4)'
                      : '1px solid transparent',
                  }}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Items grid */}
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
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
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

        {panelTab === 'bg' && (
          <div className="flex-1 overflow-y-auto px-3 pb-3">

            {/* ── Color override ── */}
            <div className="mb-4 p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>🎨 Цвет темы</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    title={color}
                    onClick={() => setRoomBgColorOverride(roomBgColorOverride === color ? null : color)}
                    style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: color,
                      border: roomBgColorOverride === color
                        ? '2.5px solid white'
                        : '2px solid rgba(255,255,255,0.15)',
                      boxShadow: roomBgColorOverride === color ? `0 0 8px ${color}` : 'none',
                      flexShrink: 0,
                    }}
                  />
                ))}
                {/* Custom color picker */}
                <label
                  title="Свой цвет"
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
                    value={roomBgColorOverride ?? '#7C3AED'}
                    onChange={e => setRoomBgColorOverride(e.target.value)}
                    style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                  />
                  +
                </label>
              </div>
              {roomBgColorOverride ? (
                <button
                  onClick={() => setRoomBgColorOverride(null)}
                  className="text-[10px] font-semibold transition-colors"
                  style={{ color: 'rgba(167,139,250,0.7)' }}
                >
                  ✕ Сбросить цвет
                </button>
              ) : (
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Выбери цвет акцента комнаты</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
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
                      owned ? equipBg(bgDef.id) : (canAfford && buyBg(bgDef.id));
                    }}
                  >
                    <div className="h-14 flex items-center justify-center relative" style={{ background: bgDef.gradient }}>
                      <span className="text-xl">{bgDef.emoji}</span>
                      {locked && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span>🔒</span></div>}
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
        )}
      </div>

      {/* ── Right: Preview area ──────────────────────────────────── */}
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

        {/* Scene + Controls */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-4 p-6">
          {/* Room preview */}
          <div
            ref={sceneRef}
            className="relative w-full rounded-3xl overflow-hidden cursor-crosshair"
            style={{
              maxWidth: '600px',
              height: 'clamp(320px, 40vw, 480px)',
              background: bg.gradient,
              boxShadow: [
                `0 24px 88px ${bg.accentColor}44`,
                `0 6px 28px rgba(0,0,0,0.7)`,
                `inset 0 1px 0 rgba(255,255,255,0.07)`,
              ].join(', '),
            }}
            onClick={handleSceneClick}
          >
            {/* BG effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <SceneEffects effects={bg.effects} />
            </div>

            {/* Ambient light */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: '8%', left: '50%',
                transform: 'translate(-50%, 0)',
                width: '78%', height: '62%',
                background: `radial-gradient(ellipse at 50% 48%, ${bg.accentColor}1E 0%, transparent 68%)`,
                zIndex: 1,
              }}
            />

            {/* Wall vignette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: [
                  'linear-gradient(to right,  rgba(0,0,0,0.44) 0%, transparent 22%)',
                  'linear-gradient(to left,   rgba(0,0,0,0.44) 0%, transparent 22%)',
                  'linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, transparent 30%)',
                ].join(', '),
                zIndex: 2,
              }}
            />

            {/* Background decorations */}
            {(bg.decorations ?? []).map((d, i) => (
              <motion.div
                key={i}
                className="absolute select-none pointer-events-none"
                style={{ left: `${d.x}%`, top: `${d.y}%`, fontSize: d.size, zIndex: 3 }}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3 + i * 0.7, repeat: Infinity, delay: i * 0.5 }}
              >
                {d.emoji}
              </motion.div>
            ))}

            {/* Floor */}
            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none"
              style={{ height: '28%', zIndex: 4 }}
            >
              <div className="absolute inset-0" style={{ background: bg.floorGradient }} />
              <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }}
                viewBox="0 0 100 28"
                preserveAspectRatio="none"
              >
                {[-85, -60, -38, -18, 0, 18, 38, 60, 85].map((offset, i) => (
                  <line key={`v${i}`} x1={50} y1={0} x2={50 + offset} y2={28}
                    stroke={bg.accentColor} strokeWidth={0.45} />
                ))}
                {[5, 11, 17, 24].map((y, i) => (
                  <line key={`h${i}`} x1={0} y1={y} x2={100} y2={y}
                    stroke={bg.accentColor} strokeWidth={0.35} opacity={0.8 - i * 0.14} />
                ))}
              </svg>
            </div>

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
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedUid(placed.uid);
                  }}
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
          </div>

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
                {/* Item identity */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-3xl leading-none">{getFurniture(selectedItem.itemId)?.emoji}</span>
                  <span className="text-sm font-bold text-white">{getFurniture(selectedItem.itemId)?.name}</span>
                </div>

                {/* Scale slider */}
                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                  <span className="text-xs text-purple-300 shrink-0">Размер</span>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={selectedItem.scale}
                    onChange={e => updateRoomFurniture(selectedItem.uid, { scale: parseFloat(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-xs text-purple-300 w-8 text-right">{selectedItem.scale.toFixed(1)}</span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => updateRoomFurniture(selectedItem.uid, { flipped: !selectedItem.flipped })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all"
                    style={{
                      background: 'rgba(124,58,237,0.25)',
                      border: '1px solid rgba(124,58,237,0.4)',
                    }}
                  >
                    ↔ Отразить
                  </button>

                  <div className="flex gap-1">
                    <button
                      onClick={handleLayerUp}
                      title="Слой выше"
                      className="w-8 h-8 rounded-lg text-sm font-bold transition-all flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={handleLayerDown}
                      title="Слой ниже"
                      className="w-8 h-8 rounded-lg text-sm font-bold transition-all flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                    >
                      ↓
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      removeRoomFurniture(selectedItem.uid);
                      setSelectedUid(null);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: 'rgba(239,68,68,0.2)',
                      color: '#FCA5A5',
                      border: '1px solid rgba(239,68,68,0.35)',
                    }}
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
