import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../../store/petStore';
import { getPersonality } from '@zdesagochi/personality-pet-preset';
import { EMERGENT_STATE_MAP } from '../../personality/emergentStates';
import { PersonalityCatalog } from './PersonalityCatalog';
import type { BehavioralFlagType } from '../../personality/types';

const RARITY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  common:    { label: 'Обычный',     color: '#6B7280', bg: 'rgba(107,114,128,0.10)' },
  rare:      { label: 'Редкий',      color: '#3B82F6', bg: 'rgba(59,130,246,0.10)'  },
  epic:      { label: 'Эпический',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)'  },
  legendary: { label: 'Легендарный', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
};

const FLAG_LABEL: Record<BehavioralFlagType, string> = {
  food_anxiety:      '🍽 Тревога еды',
  abandonment_fear:  '😰 Страх брошенности',
  overtreated:       '💊 Передоз лечения',
  night_disruption:  '🌙 Нарушение сна',
  play_burnout:      '🎮 Игровое выгорание',
  filth_trauma:      '🛁 Травма грязи',
  forced_sleep:      '😴 Принудительный сон',
  health_neglect:    '❤️ Запущенное здоровье',
  food_monotony:     '🔁 Однообразная еда',
  trust_bond:        '🤝 Доверие',
  culinary_explorer: '🍳 Кулинарный путешественник',
  night_guardian:    '🌟 Ночной страж',
  perfect_balance:   '⚖️ Идеальный баланс',
};

const POSITIVE_FLAGS = new Set<BehavioralFlagType>([
  'trust_bond', 'culinary_explorer', 'night_guardian', 'perfect_balance',
]);

export function PersonalityCard() {
  const pet = usePetStore(s => s.pet);
  const [catalogOpen, setCatalogOpen] = useState(false);
  if (!pet) return null;

  const def = getPersonality(pet.personality as any);
  if (!def) return null;

  const rarity   = RARITY_STYLE[def.rarity] ?? RARITY_STYLE.common;
  const emergent = pet.emergentState ? EMERGENT_STATE_MAP.get(pet.emergentState as any) : null;
  const flags    = pet.behavioralFlags ?? [];

  // Modifier pills — show only non-trivial (≠ 1.0 / ≠ 0)
  const mods: { label: string; value: string; positive: boolean }[] = [];

  const addMult = (label: string, v: number | undefined, invertPositive = false) => {
    if (v == null || v === 1.0) return;
    const good = invertPositive ? v < 1 : v > 1;
    mods.push({ label, value: `×${v.toFixed(1)}`, positive: good });
  };
  addMult('XP игра',       def.xpMultipliers.play);
  addMult('Монеты игра',   def.coinMultipliers.play);
  addMult('XP еда',        def.xpMultipliers.feed);
  addMult('Распад радости',def.decayRates.happiness, true);
  addMult('Распад энергии',def.decayRates.energy,    true);
  addMult('Распад голода', def.decayRates.hunger,    true);
  if (def.naturalHealthRegen > 0)
    mods.push({ label: 'Реген HP', value: `+${def.naturalHealthRegen}/тик`, positive: true });

  return (
    <>
      <AnimatePresence>
        {catalogOpen && (
          <PersonalityCatalog onClose={() => setCatalogOpen(false)} />
        )}
      </AnimatePresence>

    <div className="rounded-3xl p-5 glass space-y-4">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <motion.span
          className="text-3xl shrink-0"
          animate={{ rotate: [0, 6, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {def.emoji}
        </motion.span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lumio-text text-sm">{def.name}</h3>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: rarity.bg, color: rarity.color }}>
              {rarity.label}
            </span>
          </div>
          <p className="text-[11px] text-lumio-muted mt-0.5 leading-snug italic">«{def.tagline}»</p>
        </div>

        <button
          onClick={() => setCatalogOpen(true)}
          className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
          style={{
            background: 'rgba(139,92,246,0.08)',
            color: '#7C3AED',
            border: '1px solid rgba(139,92,246,0.20)',
          }}
        >
          Сменить
        </button>
      </div>

      {/* ── Description ────────────────────────────────────────────── */}
      <p className="text-[11px] text-gray-500 leading-relaxed">{def.description}</p>

      {/* ── Modifiers ──────────────────────────────────────────────── */}
      {mods.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Модификаторы
          </p>
          <div className="flex flex-wrap gap-1.5">
            {mods.map((m, i) => (
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

      {/* ── Behavioral flags ───────────────────────────────────────── */}
      {flags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            Поведенческие флаги
          </p>
          {flags.map(flag => {
            const isPositive = POSITIVE_FLAGS.has(flag.type);
            const label      = FLAG_LABEL[flag.type] ?? flag.type;
            const pct        = Math.max(0, Math.min(100, flag.healProgress));
            return (
              <div key={flag.type} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-medium"
                    style={{ color: isPositive ? '#059669' : '#DC2626' }}>
                    {label}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {isPositive ? `${Math.round(pct)}%` : `Ур.${flag.severity} · ${Math.round(pct)}%`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: isPositive ? '#10B981' : '#EF4444' }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Emergent-state exit hint ────────────────────────────────── */}
      {emergent && (
        <div className="rounded-xl px-3 py-2"
          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.20)' }}>
          <p className="text-[11px] text-gray-500 font-medium leading-snug">
            💡 Выход из «{emergent.name}»: {emergent.exitHint}
          </p>
        </div>
      )}
    </div>
    </>
  );
}
