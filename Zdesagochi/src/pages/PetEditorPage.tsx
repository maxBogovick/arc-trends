import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../store/petStore';
import { PetDisplay } from '../components/Pet/PetDisplay';
import { BODY_SHAPES } from '../data/bodyShapes';
import { SKINS, getSkin } from '../data/skins';
import { BACKGROUNDS, getBackground } from '../data/backgrounds';
import { AURAS, getAura } from '../data/auras';
import { getAccessoriesBySlot } from '../data/accessories';
import { PALETTES } from '../data/palettes';
import type { PetColors } from '../data/palettes';
import type { PetMood } from '../api';
import type { BodyShapeId } from '../data/bodyShapes';
import type { AccessorySlot } from '../data/accessories';

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryId = 'body' | 'morph' | 'color' | 'skin' | 'aura' | 'accessories' | 'bg';

const CATEGORIES: { id: CategoryId; emoji: string; label: string }[] = [
  { id: 'body',        emoji: '🧬', label: 'Форма' },
  { id: 'morph',       emoji: '📐', label: 'Морфинг' },
  { id: 'color',       emoji: '🎨', label: 'Цвет' },
  { id: 'skin',        emoji: '✨', label: 'Скин' },
  { id: 'aura',        emoji: '💫', label: 'Аура' },
  { id: 'accessories', emoji: '👒', label: 'Вещи' },
  { id: 'bg',          emoji: '🌌', label: 'Фон' },
];

const MOODS: { id: PetMood; emoji: string; label: string }[] = [
  { id: 'ecstatic', emoji: '🤩', label: 'Восторг' },
  { id: 'happy',    emoji: '😊', label: 'Счастлив' },
  { id: 'content',  emoji: '🙂', label: 'Доволен' },
  { id: 'sad',      emoji: '😢', label: 'Грустит' },
  { id: 'tired',    emoji: '😴', label: 'Устал' },
  { id: 'sick',     emoji: '🤒', label: 'Болеет' },
];

const RARITY_COLOR: Record<string, string> = {
  common: '#94A3B8', rare: '#3B82F6', epic: '#8B5CF6', legendary: '#F59E0B',
};

// ─── Dark theme shared styles ──────────────────────────────────────────────

const GLASS = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16,
};

const ACTIVE_GLOW = (color: string) => ({
  background: `${color}22`,
  border: `1.5px solid ${color}88`,
  boxShadow: `0 0 14px ${color}44`,
  borderRadius: 16,
});

// ─── Body Panel ───────────────────────────────────────────────────────────────

function BodyPanel() {
  const { equippedBodyId, equipBody, equippedSkinId } = usePetStore();
  const skin = getSkin(equippedSkinId);

  return (
    <div className="space-y-3">
      <SectionLabel>🧬 Форма тела</SectionLabel>
      <p className="text-xs text-white/40">Бесплатно — меняй сколько угодно</p>
      <div className="grid grid-cols-3 gap-2">
        {BODY_SHAPES.map(shape => {
          const active = equippedBodyId === shape.id;
          return (
            <motion.button key={shape.id}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => equipBody(shape.id as BodyShapeId)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
              style={active ? ACTIVE_GLOW(skin.colors.glow) : GLASS}
            >
              <span className="text-2xl">{shape.emoji}</span>
              <span className="text-[11px] font-semibold text-white/80">{shape.name}</span>
              {active && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: skin.colors.glow + 'aa' }}>✓</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Morph Panel ─────────────────────────────────────────────────────────────

function MorphPanel() {
  const { petMorph, setPetMorph } = usePetStore();

  const sliders: { key: keyof typeof petMorph; label: string; emoji: string }[] = [
    { key: 'scale',  label: 'Масштаб',  emoji: '⟺' },
    { key: 'width',  label: 'Ширина',   emoji: '↔' },
    { key: 'height', label: 'Высота',   emoji: '↕' },
  ];

  return (
    <div className="space-y-5">
      <SectionLabel>📐 Морфинг формы</SectionLabel>
      <div className="space-y-5">
        {sliders.map(({ key, label, emoji }) => {
          const val = petMorph[key];
          const pct = ((val - 0.4) / (1.8 - 0.4)) * 100;
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white/80">{emoji} {label}</span>
                <span className="text-xs font-mono text-white/50">{val.toFixed(2)}×</span>
              </div>
              <div className="relative h-8 flex items-center">
                <div className="absolute inset-x-0 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <div className="absolute left-0 h-1.5 rounded-full"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#818CF8,#EC4899)' }} />
                <input
                  type="range" min={0.4} max={1.8} step={0.01}
                  value={val}
                  onChange={e => setPetMorph({ ...petMorph, [key]: parseFloat(e.target.value) })}
                  className="absolute inset-x-0 h-8 opacity-0 cursor-pointer w-full"
                />
                <div className="absolute h-4 w-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                  style={{ left: `calc(${pct}% - 8px)`, background: 'linear-gradient(135deg,#818CF8,#EC4899)' }} />
              </div>
              <div className="flex justify-between text-[9px] text-white/30">
                <span>0.4×</span><span>1.0×</span><span>1.8×</span>
              </div>
            </div>
          );
        })}
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={() => setPetMorph({ scale: 1, width: 1, height: 1 })}
        className="w-full py-2 rounded-xl text-xs font-bold text-white/60 transition-all"
        style={GLASS}
      >
        ↩ Сбросить пропорции
      </motion.button>
    </div>
  );
}

// ─── Color Panel ─────────────────────────────────────────────────────────────

function ColorPanel() {
  const { petColorOverride, setPetColorOverride, equippedSkinId } = usePetStore();
  const skin = getSkin(equippedSkinId);
  const base = petColorOverride ?? skin.colors;
  const [custom, setCustom] = useState<PetColors>({ body1: base.body1, body2: base.body2, glow: base.glow, cheek: base.cheek });

  const applyPalette = (p: PetColors) => { setPetColorOverride(p); setCustom(p); };
  const applyCustom  = (next: PetColors) => { setCustom(next); setPetColorOverride(next); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionLabel>🎨 Цветовая схема</SectionLabel>
        {petColorOverride && (
          <button onClick={() => setPetColorOverride(null)}
            className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded-lg transition-colors"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            ↩ Сброс
          </button>
        )}
      </div>

      {/* Palette grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {PALETTES.map((p, i) => {
          const active = petColorOverride?.body1 === p.body1 && petColorOverride?.glow === p.glow;
          return (
            <motion.button key={i}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => applyPalette(p)}
              className="flex flex-col items-center gap-1 p-1.5 rounded-xl"
              style={active ? ACTIVE_GLOW(p.glow) : GLASS}
            >
              <div className="w-full h-8 rounded-lg overflow-hidden relative"
                style={{ background: `linear-gradient(135deg, ${p.body1}, ${p.body2})` }}>
                <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: p.glow, boxShadow: `0 0 5px ${p.glow}` }} />
                {active && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-white/90 flex items-center justify-center text-[8px] font-bold text-gray-800">✓</div>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-white/50 leading-tight text-center truncate w-full">{p.name}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Custom pickers */}
      <div className="p-4 rounded-2xl space-y-4" style={GLASS}>
        <p className="text-xs font-semibold text-white/60">✏️ Свой цвет</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'body1' as const, label: 'Основной',  desc: 'Верх тела' },
            { key: 'body2' as const, label: 'Тёмный',    desc: 'Низ / тень' },
            { key: 'glow'  as const, label: 'Свечение',  desc: 'Ауры и глаза' },
            { key: 'cheek' as const, label: 'Щёки',      desc: 'Акцент' },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center gap-2">
              <label className="relative cursor-pointer group shrink-0">
                <div className="w-10 h-10 rounded-xl border-2 border-white/20 shadow-lg transition-transform group-hover:scale-110"
                  style={{ background: custom[key], boxShadow: `0 0 12px ${custom[key]}66` }} />
                <input type="color" value={custom[key]}
                  onChange={e => applyCustom({ ...custom, [key]: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </label>
              <div>
                <p className="text-xs font-bold text-white/80">{label}</p>
                <p className="text-[9px] text-white/40">{desc}</p>
                <p className="text-[8px] font-mono text-white/30">{custom[key]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Skin Panel ───────────────────────────────────────────────────────────────

function SkinPanel() {
  const { equippedSkinId, ownedSkins, coins, pet, buySkin, equipSkin } = usePetStore();
  const [filter, setFilter] = useState<'all' | 'owned'>('all');
  const petLevel = pet?.level ?? 0;

  const filtered = SKINS.filter(s => filter === 'owned' ? ownedSkins.includes(s.id) : true);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>✨ Скин питомца</SectionLabel>
        <div className="flex gap-1">
          {(['all', 'owned'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={{
                background: filter === f ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)',
                color: filter === f ? 'white' : 'rgba(255,255,255,0.4)',
              }}>
              {f === 'all' ? '✦ Все' : '✓ Мои'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {filtered.map(skin => {
          const owned = ownedSkins.includes(skin.id);
          const equipped = equippedSkinId === skin.id;
          const locked = !owned && !!skin.requiredLevel && petLevel < skin.requiredLevel;
          const canAfford = coins >= skin.price;
          const rc = RARITY_COLOR[skin.rarity];

          return (
            <motion.div key={skin.id}
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative p-3 rounded-2xl flex gap-2 items-center cursor-pointer"
              style={equipped ? ACTIVE_GLOW(skin.colors.glow) : GLASS}
              onClick={() => owned ? equipSkin(skin.id) : (!locked && canAfford && buySkin(skin.id))}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: `linear-gradient(135deg, ${skin.colors.body1}, ${skin.colors.body2})`, boxShadow: `0 0 10px ${skin.colors.glow}55` }}>
                {locked ? '🔒' : skin.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white/90 truncate">{skin.name}</p>
                <p className="text-[9px] font-semibold" style={{ color: rc }}>{skin.rarity}</p>
                {!owned && (
                  <p className="text-[10px] font-bold" style={{ color: canAfford ? '#FFD700' : 'rgba(255,255,255,0.3)' }}>
                    🪙 {skin.price}
                  </p>
                )}
                {owned && !equipped && <p className="text-[9px] text-white/40">Нажми надеть</p>}
                {equipped && <p className="text-[9px] font-bold text-emerald-400">✓ Надет</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Aura Panel ───────────────────────────────────────────────────────────────

function AuraPanel() {
  const { equippedAuraId, ownedAuras, coins, buyAura, equipAura } = usePetStore();

  return (
    <div className="space-y-3">
      <SectionLabel>💫 Аура питомца</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {AURAS.map(aura => {
          const owned = ownedAuras.includes(aura.id);
          const equipped = equippedAuraId === aura.id;
          const canAfford = coins >= aura.price;
          const rc = RARITY_COLOR[aura.rarity];

          return (
            <motion.div key={aura.id}
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative p-3 rounded-2xl cursor-pointer"
              style={equipped ? ACTIVE_GLOW(aura.color) : GLASS}
              onClick={() => owned ? equipAura(aura.id) : (canAfford && buyAura(aura.id))}
            >
              {/* Aura glow preview */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{
                    background: `radial-gradient(circle at 40% 40%, ${aura.color}44, ${aura.color2}22)`,
                    boxShadow: equipped ? `0 0 16px ${aura.color}88` : `0 0 8px ${aura.color}33`,
                    border: `1px solid ${aura.color}44`,
                  }}>
                  {aura.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white/90">{aura.name}</p>
                  <p className="text-[9px] font-semibold" style={{ color: rc }}>{aura.rarity}</p>
                </div>
              </div>
              <p className="text-[9px] text-white/40 leading-tight mb-2">{aura.description}</p>
              {aura.id !== 'none' && (
                <div className="text-[10px] font-bold">
                  {owned
                    ? <span className={equipped ? 'text-emerald-400' : 'text-white/50'}>
                        {equipped ? '✓ Активна' : 'Нажми включить'}
                      </span>
                    : <span style={{ color: canAfford ? '#FFD700' : 'rgba(255,255,255,0.3)' }}>
                        🪙 {aura.price}
                      </span>
                  }
                </div>
              )}
              {aura.id === 'none' && equipped && (
                <p className="text-[9px] text-emerald-400 font-bold">✓ Активна</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Accessories Panel ────────────────────────────────────────────────────────

function AccessoriesPanel() {
  const [slot, setSlot] = useState<AccessorySlot>('head');
  const { equippedAccessories, setAccessory } = usePetStore();

  const SLOT_TABS: { id: AccessorySlot; emoji: string; label: string }[] = [
    { id: 'head', emoji: '👒', label: 'Голова' },
    { id: 'face', emoji: '😎', label: 'Лицо' },
    { id: 'back', emoji: '🎒', label: 'Спина' },
  ];

  const items = getAccessoriesBySlot(slot);
  const equipped = equippedAccessories[slot];

  return (
    <div className="space-y-3">
      <SectionLabel>👒 Аксессуары</SectionLabel>
      <p className="text-xs text-white/40">Бесплатно — экипируй что хочешь</p>

      {/* Slot tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {SLOT_TABS.map(t => (
          <button key={t.id} onClick={() => setSlot(t.id)}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: slot === t.id ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: slot === t.id ? 'white' : 'rgba(255,255,255,0.4)',
            }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {items.map(acc => {
          const isEquipped = equipped === acc.id;
          const rc = RARITY_COLOR[acc.rarity];
          return (
            <motion.button key={acc.id}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAccessory(slot, acc.id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
              style={isEquipped ? ACTIVE_GLOW('#818CF8') : GLASS}
            >
              <span className="text-2xl">{acc.id.startsWith('none') ? '—' : acc.emoji}</span>
              <span className="text-[10px] font-semibold text-white/80 text-center leading-tight">{acc.name}</span>
              <span className="text-[8px] font-bold" style={{ color: rc }}>{acc.rarity}</span>
              {isEquipped && <span className="text-[9px] font-bold text-emerald-400">✓</span>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Background Panel ─────────────────────────────────────────────────────────

function BgPanel() {
  const { equippedBgId, ownedBgs, coins, pet, buyBg, equipBg } = usePetStore();
  const petLevel = pet?.level ?? 0;

  return (
    <div className="space-y-3">
      <SectionLabel>🌌 Фон сцены</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {BACKGROUNDS.map(bg => {
          const owned = ownedBgs.includes(bg.id);
          const equipped = equippedBgId === bg.id;
          const locked = !owned && !!bg.requiredLevel && petLevel < bg.requiredLevel;
          const canAfford = coins >= bg.price;
          const rc = RARITY_COLOR[bg.rarity];

          return (
            <motion.div key={bg.id}
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden rounded-2xl cursor-pointer"
              style={{
                border: equipped ? `1.5px solid ${bg.accentColor}88` : '1px solid rgba(255,255,255,0.1)',
                boxShadow: equipped ? `0 0 20px ${bg.accentColor}44` : 'none',
              }}
              onClick={() => owned ? equipBg(bg.id) : (!locked && canAfford && buyBg(bg.id))}
            >
              {/* Preview */}
              <div className="h-16 flex items-center justify-center relative" style={{ background: bg.gradient }}>
                <span className="text-2xl" style={{ filter: `drop-shadow(0 0 6px ${bg.accentColor})` }}>{bg.emoji}</span>
                {locked && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-lg">🔒</span></div>}
                {equipped && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: bg.accentColor }}>✓</div>
                )}
              </div>
              {/* Info */}
              <div className="px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.6)' }}>
                <p className="text-[11px] font-bold text-white/90 truncate">{bg.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold" style={{ color: rc }}>{bg.rarity}</span>
                  {!owned && (
                    <span className="text-[9px] font-bold" style={{ color: canAfford ? '#FFD700' : 'rgba(255,255,255,0.3)' }}>
                      🪙 {bg.price}
                    </span>
                  )}
                  {owned && !equipped && <span className="text-[9px] text-white/30">Выбрать</span>}
                  {equipped && <span className="text-[9px] font-bold text-emerald-400">✓</span>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-bold text-sm text-white/90 tracking-wide">{children}</h3>
  );
}

// ─── Left preview ─────────────────────────────────────────────────────────────

function EditorPreview({ previewMood, setPreviewMood }: { previewMood: PetMood; setPreviewMood: (m: PetMood) => void }) {
  const { pet, equippedAuraId, equippedBgId } = usePetStore();
  const bg = getBackground(equippedBgId);
  const aura = getAura(equippedAuraId);

  if (!pet) return null;

  const fakePet = { ...pet, mood: previewMood, isAsleep: false };

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Scene container */}
      <div className="relative rounded-3xl overflow-hidden"
        style={{
          width: 280, height: 280,
          background: bg.gradient,
          boxShadow: `0 0 60px ${bg.accentColor}44, 0 0 120px ${bg.accentColor}11, inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}>
        {/* Background floor */}
        <div className="absolute bottom-0 left-0 right-0 h-14 rounded-b-3xl" style={{ background: bg.floorGradient }} />

        {/* Aura name badge */}
        {aura.id !== 'none' && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold"
            style={{ background: `${aura.color}33`, color: aura.color, border: `1px solid ${aura.color}55` }}>
            {aura.emoji} {aura.name}
          </div>
        )}

        {/* Pet */}
        <div className="absolute inset-0 flex items-center justify-center">
          <PetDisplay pet={fakePet} moodOverride={previewMood} />
        </div>
      </div>

      {/* Mood strip */}
      <div className="flex gap-1.5">
        {MOODS.map(m => (
          <motion.button key={m.id}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setPreviewMood(m.id)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all"
            title={m.label}
            style={previewMood === m.id ? {
              background: 'rgba(129,140,248,0.3)',
              border: '1.5px solid #818CF8',
              boxShadow: '0 0 10px #818CF844',
            } : {
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
            {m.emoji}
          </motion.button>
        ))}
      </div>

      {/* Summary chips */}
      <SummaryChips />
    </div>
  );
}

function SummaryChips() {
  const { equippedSkinId, equippedBodyId, equippedAuraId, equippedBgId } = usePetStore();
  const skin = getSkin(equippedSkinId);
  const bg = getBackground(equippedBgId);
  const aura = getAura(equippedAuraId);
  const shape = BODY_SHAPES.find(s => s.id === equippedBodyId);

  const chips = [
    { label: `${shape?.emoji} ${shape?.name}` },
    { label: `${skin.emoji} ${skin.name}` },
    aura.id !== 'none' ? { label: `${aura.emoji} ${aura.name}` } : null,
    { label: `${bg.emoji} ${bg.name}` },
  ].filter(Boolean) as { label: string }[];

  return (
    <div className="flex flex-wrap gap-1.5 justify-center max-w-xs">
      {chips.map((c, i) => (
        <span key={i} className="px-2 py-0.5 rounded-full text-[9px] font-semibold text-white/60"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export function PetEditorPage() {
  const {
    setActiveTab, equipBody, equipSkin, equipAura, equipBg, setPetColorOverride,
    setPetMorph, setAccessory,
    ownedSkins, ownedAuras, ownedBgs, coins,
  } = usePetStore();

  const [category, setCategory] = useState<CategoryId>('body');
  const [previewMood, setPreviewMood] = useState<PetMood>('happy');

  const randomize = useCallback(() => {
    const shapes = BODY_SHAPES.map(s => s.id);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    equipBody(pick(shapes) as BodyShapeId);

    const availSkins = SKINS.filter(s => ownedSkins.includes(s.id));
    if (availSkins.length) equipSkin(pick(availSkins).id);

    const availAuras = ownedAuras;
    if (availAuras.length) equipAura(pick(availAuras));

    const availBgs = ownedBgs;
    if (availBgs.length) equipBg(pick(availBgs));

    const pal = pick(PALETTES);
    setPetColorOverride(pal);
    setPetMorph({ scale: 0.8 + Math.random() * 0.6, width: 0.8 + Math.random() * 0.6, height: 0.8 + Math.random() * 0.6 });

    const heads = getAccessoriesBySlot('head');
    const faces = getAccessoriesBySlot('face');
    const backs = getAccessoriesBySlot('back');
    setAccessory('head', pick(heads).id);
    setAccessory('face', pick(faces).id);
    setAccessory('back', pick(backs).id);
  }, [ownedSkins, ownedAuras, ownedBgs, equipBody, equipSkin, equipAura, equipBg, setPetColorOverride, setPetMorph, setAccessory]);

  const PANEL_MAP: Record<CategoryId, React.ReactNode> = {
    body:        <BodyPanel />,
    morph:       <MorphPanel />,
    color:       <ColorPanel />,
    skin:        <SkinPanel />,
    aura:        <AuraPanel />,
    accessories: <AccessoriesPanel />,
    bg:          <BgPanel />,
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#0A0A14' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Header ── */}
      <header className="h-14 flex items-center gap-3 px-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold text-white/70 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          ← Назад
        </motion.button>

        <div className="flex-1 text-center">
          <h1 className="font-bold text-white text-base tracking-wide">✏️ Редактор питомца</h1>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={randomize}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold text-white/70 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            title="Рандомный облик">
            🎲 Рандом
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('home')}
            className="px-4 py-1.5 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', boxShadow: '0 4px 16px rgba(124,58,237,0.4)' }}>
            ✓ Готово
          </motion.button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left panel: Preview (desktop only) ── */}
        <div className="hidden lg:flex flex-col items-center justify-center gap-6 p-8 shrink-0"
          style={{ width: 340, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
          <EditorPreview previewMood={previewMood} setPreviewMood={setPreviewMood} />
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Category sidebar */}
          <div className="w-14 flex flex-col items-center py-3 gap-0.5 shrink-0"
            style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            {CATEGORIES.map(cat => {
              const active = category === cat.id;
              return (
                <motion.button key={cat.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCategory(cat.id)}
                  className="w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all"
                  style={{
                    background: active ? 'rgba(124,58,237,0.3)' : 'transparent',
                    border: active ? '1px solid rgba(124,58,237,0.5)' : '1px solid transparent',
                  }}
                  title={cat.label}>
                  <span className="text-base">{cat.emoji}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto">
            {/* Mobile preview */}
            <div className="lg:hidden p-4 border-b border-white/08">
              <EditorPreview previewMood={previewMood} setPreviewMood={setPreviewMood} />
            </div>

            {/* Category header */}
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-xl">{CATEGORIES.find(c => c.id === category)?.emoji}</span>
              <span className="font-bold text-white/90 text-sm">{CATEGORIES.find(c => c.id === category)?.label}</span>
              <div className="flex-1" />
              <div className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white/40"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                🪙 {coins.toLocaleString()}
              </div>
            </div>

            {/* Animated panels */}
            <div className="p-4">
              <AnimatePresence mode="wait">
                <motion.div key={category}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}>
                  {PANEL_MAP[category]}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
