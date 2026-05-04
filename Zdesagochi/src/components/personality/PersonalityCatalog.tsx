import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PERSONALITIES } from '../../personality/personalities';
import { usePetStore } from '../../store/petStore';
import type { PersonalityDefinition, PersonalityId } from '../../personality/types';

// ── Стили редкости ────────────────────────────────────────────────────────────

const RARITY_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  common:    { label: 'Обычный',     color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.20)' },
  rare:      { label: 'Редкий',      color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)'  },
  epic:      { label: 'Эпический',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.30)'  },
  legendary: { label: 'Легендарный', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.35)'  },
};

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

// ── Вспомогательный компонент: карточка в сетке ───────────────────────────────

function CatalogCard({
  def, current, selected, onSelect,
}: {
  def: PersonalityDefinition;
  current: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const r = RARITY_STYLE[def.rarity] ?? RARITY_STYLE.common;

  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full text-left rounded-2xl p-3 transition-all"
      style={{
        background: selected ? r.bg : 'rgba(255,255,255,0.7)',
        border: `1.5px solid ${selected ? r.color : r.border}`,
        boxShadow: selected
          ? `0 0 0 2px ${r.color}30, 0 4px 12px ${r.color}20`
          : '0 2px 8px rgba(0,0,0,0.04)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-start gap-2">
        <motion.span
          className="text-2xl shrink-0 mt-0.5"
          animate={selected ? { rotate: [0, 8, -8, 0] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {def.emoji}
        </motion.span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-lumio-text">{def.name}</span>
            {current && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#10B98120', color: '#059669' }}>
                текущий
              </span>
            )}
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: r.bg, color: r.color }}>
              {r.label}
            </span>
          </div>
          <p className="text-[10px] text-lumio-muted mt-0.5 leading-snug italic truncate">
            «{def.tagline}»
          </p>
        </div>
      </div>
    </motion.button>
  );
}

// ── Детальная панель выбранного характера ─────────────────────────────────────

function DetailPanel({
  def, current, onApply,
}: {
  def: PersonalityDefinition;
  current: boolean;
  onApply: () => void;
}) {
  const r = RARITY_STYLE[def.rarity] ?? RARITY_STYLE.common;

  const keyModifiers: { label: string; value: string; positive: boolean }[] = [];
  const push = (label: string, v: number | undefined, invertPositive = false) => {
    if (v == null || v === 1.0) return;
    const good = invertPositive ? v < 1 : v > 1;
    keyModifiers.push({ label, value: `×${v.toFixed(1)}`, positive: good });
  };
  push('XP за игру',        def.xpMultipliers.play);
  push('XP за еду',         def.xpMultipliers.feed);
  push('XP за bond',        def.xpMultipliers.bond);
  push('Монеты за игру',    def.coinMultipliers.play);
  push('Распад радости',    def.decayRates.happiness, true);
  push('Распад энергии',    def.decayRates.energy,    true);
  push('Распад голода',     def.decayRates.hunger,    true);
  push('Распад чистоты',    def.decayRates.cleanliness, true);
  push('Распад связи',      def.decayRates.bond,      true);
  if (def.naturalHealthRegen > 0)
    keyModifiers.push({ label: 'Реген HP', value: `+${def.naturalHealthRegen}/тик`, positive: true });

  const loved = def.foodPreferences.lovedIds;
  const hated = def.foodPreferences.hatedIds;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <motion.span
          className="text-4xl"
          animate={{ rotate: [0, 6, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          {def.emoji}
        </motion.span>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lumio-text text-base">{def.name}</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: r.bg, color: r.color }}>
              {r.label}
            </span>
          </div>
          <p className="text-xs text-lumio-muted italic mt-0.5">«{def.tagline}»</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-[12px] text-gray-600 leading-relaxed mb-4">{def.description}</p>

      {/* Key modifiers */}
      {keyModifiers.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Ключевые модификаторы
          </p>
          <div className="flex flex-wrap gap-1.5">
            {keyModifiers.map((m, i) => (
              <span key={i}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: m.positive ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
                  color:      m.positive ? '#059669'               : '#DC2626',
                }}>
                {m.label}: {m.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Food preferences */}
      {(loved.length > 0 || hated.length > 0) && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Вкусовые предпочтения
          </p>
          <div className="flex flex-wrap gap-2">
            {loved.map(f => (
              <span key={f} className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.10)', color: '#059669' }}>
                💚 {f}
              </span>
            ))}
            {hated.map(f => (
              <span key={f} className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
                ❌ {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Auto-sleep */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Авто-сон
        </p>
        <p className="text-[11px] text-gray-500">
          {def.autoSleep.enabled
            ? `Засыпает сам при energy ≤ ${def.autoSleep.energyThreshold} (шанс ${Math.round(def.autoSleep.probability * 100)}%)`
            : 'Не засыпает сам'}
        </p>
      </div>

      {/* Emergent triggers */}
      {def.emergentTriggers.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Особые состояния
          </p>
          <div className="space-y-1">
            {def.emergentTriggers.map(t => (
              <p key={t.stateType} className="text-[11px] text-gray-500">
                ⚡ <span className="font-medium text-lumio-text">{t.stateType}</span>: {t.description}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Linked skins */}
      {def.linkedSkinIds.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Скины этого характера
          </p>
          <div className="flex flex-wrap gap-1.5">
            {def.linkedSkinIds.map(s => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(139,92,246,0.08)', color: '#7C3AED' }}>
                🎨 {s}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Надень один из этих скинов, чтобы этот характер применился автоматически.
          </p>
        </div>
      )}

      {/* Apply button */}
      <div className="mt-auto">
        {current ? (
          <div className="text-center py-2.5 rounded-xl text-sm font-semibold text-gray-400"
            style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.15)' }}>
            ✓ Это текущий характер
          </div>
        ) : (
          <motion.button
            onClick={onApply}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${r.color}, ${r.color}cc)`,
              boxShadow: `0 4px 14px ${r.color}40`,
            }}
          >
            Выбрать «{def.name}»
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ── Основной компонент каталога ───────────────────────────────────────────────

export function PersonalityCatalog({ onClose }: { onClose: () => void }) {
  const pet = usePetStore(s => s.pet);
  const setPersonality = usePetStore(s => s.setPersonality);
  const notify = usePetStore(s => s.notify);

  const currentPersonalityId = pet?.personality ?? 'playful';

  const [search, setSearch]     = useState('');
  const [rarityFilter, setRarityFilter] = useState<string>('all');
  const [selectedId, setSelectedId]     = useState<PersonalityId>(currentPersonalityId as PersonalityId);
  const [confirmed, setConfirmed]       = useState(false);

  const selectedDef = PERSONALITIES.find(p => p.id === selectedId) ?? PERSONALITIES[0];

  const filtered = PERSONALITIES
    .filter(p => rarityFilter === 'all' || p.rarity === rarityFilter)
    .filter(p =>
      search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.tagline.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) =>
      RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
    );

  const handleApply = () => {
    setPersonality(selectedDef.id);
    setConfirmed(true);
    notify(`${selectedDef.emoji} Характер «${selectedDef.name}» выбран!`, 'success');
    setTimeout(onClose, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-3xl rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(20px)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Заголовок ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-display font-bold text-lumio-text text-lg">Каталог характеров</h2>
            <p className="text-xs text-lumio-muted mt-0.5">
              {PERSONALITIES.length} характеров · выбери подходящий питомцу
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ── Фильтры ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100">
          <input
            type="text"
            placeholder="Поиск по имени..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-xs rounded-xl px-3 py-1.5 outline-none"
            style={{
              background: 'rgba(107,114,128,0.07)',
              border: '1px solid rgba(107,114,128,0.15)',
              color: '#374151',
            }}
          />
          <div className="flex gap-1">
            {['all', 'common', 'rare', 'epic', 'legendary'].map(r => {
              const rs = r === 'all' ? null : RARITY_STYLE[r];
              const active = rarityFilter === r;
              return (
                <button key={r}
                  onClick={() => setRarityFilter(r)}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                  style={{
                    background: active ? (rs?.bg ?? 'rgba(139,92,246,0.12)') : 'transparent',
                    color:      active ? (rs?.color ?? '#7C3AED')            : '#9CA3AF',
                    border:     active ? `1px solid ${rs?.border ?? 'rgba(139,92,246,0.3)'}` : '1px solid transparent',
                  }}
                >
                  {r === 'all' ? 'Все' : rs?.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Основной контент ────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">
          {/* Список слева */}
          <div className="w-64 border-r border-gray-100 overflow-y-auto p-3 space-y-1.5 shrink-0">
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Ничего не найдено</p>
            )}
            {filtered.map(p => (
              <CatalogCard
                key={p.id}
                def={p}
                current={p.id === currentPersonalityId}
                selected={p.id === selectedId}
                onSelect={() => { setSelectedId(p.id); setConfirmed(false); }}
              />
            ))}
          </div>

          {/* Детали справа */}
          <div className="flex-1 overflow-y-auto p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedId}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <DetailPanel
                  def={selectedDef}
                  current={selectedDef.id === currentPersonalityId}
                  onApply={handleApply}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Подтверждение ───────────────────────────────────────── */}
        <AnimatePresence>
          {confirmed && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-6 py-3 text-center text-sm font-semibold"
              style={{ background: 'rgba(16,185,129,0.08)', borderTop: '1px solid rgba(16,185,129,0.15)', color: '#059669' }}
            >
              ✓ Применено — питомец теперь {selectedDef.emoji} {selectedDef.name}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
