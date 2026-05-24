import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { usePetStore } from '../../store/petStore';
import type { Account, FoodItem, Pet } from '../../api';
import {
  getActionTrainingHint,
  getRecommendedPetActions,
  type ActionRecommendation,
} from '../../personality/guidanceSelectors';

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionIntent = 'care' | 'play' | 'bond' | 'routine';

interface ActionConfig {
  id: string;
  intent: ActionIntent;
  gradient: string;
  tint: string;              // soft background fill for the tile
  disabled?: (pet: Pet) => boolean;
  tooltip?: (pet: Pet) => string;
}

// ─── Static data ─────────────────────────────────────────────────────────────

const ACTIONS: ActionConfig[] = [
  {
    id: 'feed', intent: 'care',
    gradient: 'from-amber-400 to-orange-500', tint: '#FEF3C7',
    disabled: p => p.isAsleep || p.stats.hunger > 90,
    tooltip: p => p.isAsleep ? 'Спит' : p.stats.hunger > 90 ? 'Сыт!' : '',
  },
  {
    id: 'bathe', intent: 'care',
    gradient: 'from-sky-400 to-cyan-400', tint: '#E0F2FE',
    disabled: p => p.isAsleep || p.stats.cleanliness > 90,
    tooltip: p => p.isAsleep ? 'Спит' : p.stats.cleanliness > 90 ? 'Чистый!' : '',
  },
  {
    id: 'heal', intent: 'care',
    gradient: 'from-rose-400 to-pink-500', tint: '#FCE7F3',
    disabled: p => p.isAsleep || (p.stats.health > 85 && p.traumaLevel < 40 && p.emergentState !== 'shadow_form'),
    tooltip: p => p.isAsleep ? 'Спит' : p.stats.health > 85 ? 'Здоров!' : '',
  },
  {
    id: 'play', intent: 'play',
    gradient: 'from-violet-500 to-purple-600', tint: '#EDE9FE',
    disabled: p => p.isAsleep || p.stats.energy < 10,
    tooltip: p => p.isAsleep ? 'Спит' : p.stats.energy < 10 ? 'Нет сил' : '',
  },
  {
    id: 'play_puzzle', intent: 'play',
    gradient: 'from-indigo-400 to-sky-500', tint: '#E0E7FF',
    disabled: p => p.isAsleep || p.stats.energy < 8,
    tooltip: p => p.isAsleep ? 'Спит' : p.stats.energy < 8 ? 'Нет сил' : 'Любопытство и порядок',
  },
  {
    id: 'play_social', intent: 'play',
    gradient: 'from-teal-400 to-emerald-500', tint: '#D1FAE5',
    disabled: p => p.isAsleep || p.stats.energy < 10,
    tooltip: p => p.isAsleep ? 'Спит' : p.stats.energy < 10 ? 'Нет сил' : 'Социальность через игру',
  },
  {
    id: 'bond', intent: 'bond',
    gradient: 'from-pink-400 to-rose-500', tint: '#FFE4E6',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Спит' : '',
  },
  {
    id: 'bond_listen', intent: 'bond',
    gradient: 'from-emerald-400 to-teal-500', tint: '#CCFBF1',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Спит' : 'Снижает тревожность',
  },
  {
    id: 'bond_praise', intent: 'bond',
    gradient: 'from-yellow-400 to-amber-400', tint: '#FEF9C3',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Спит' : 'Учит уверенности',
  },
  {
    id: 'sleep', intent: 'routine',
    gradient: 'from-indigo-400 to-violet-500', tint: '#EDE9FE',
  },
  {
    id: 'sleep_nap', intent: 'routine',
    gradient: 'from-sky-300 to-blue-400', tint: '#E0F2FE',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Уже спит' : 'Мини‑сон',
  },
  {
    id: 'sleep_ritual', intent: 'routine',
    gradient: 'from-slate-400 to-indigo-500', tint: '#F1F5F9',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Уже спит' : 'Укрепляет режим',
  },
];

const ACTION_BY_ID = new Map(ACTIONS.map(a => [a.id, a]));

const GROUPS: Array<{
  id: ActionIntent;
  label: string;
  icon: string;
  accent: string;           // tab accent color
  ids: string[];
}> = [
    { id: 'care', label: 'Забота', icon: '🩺', accent: '#F59E0B', ids: ['feed', 'bathe', 'heal'] },
    { id: 'play', label: 'Игра', icon: '🎮', accent: '#8B5CF6', ids: ['play', 'play_puzzle', 'play_social'] },
    { id: 'bond', label: 'Связь', icon: '🤍', accent: '#F43F5E', ids: ['bond', 'bond_listen', 'bond_praise'] },
    { id: 'routine', label: 'Режим', icon: '🌙', accent: '#6366F1', ids: ['sleep', 'sleep_nap', 'sleep_ritual'] },
  ];

const ACTION_META: Record<string, {
  emoji: (p: Pet) => string;
  label: (p: Pet) => string;
}> = {
  feed: { emoji: () => '🍔', label: () => 'Еда' },
  play: { emoji: () => '🎮', label: () => 'Играть' },
  play_puzzle: { emoji: () => '🧩', label: () => 'Пазл' },
  play_social: { emoji: () => '🫶', label: () => 'Вместе' },
  sleep: { emoji: p => p.isAsleep ? '☀️' : '😴', label: p => p.isAsleep ? 'Будить' : 'Спать' },
  sleep_nap: { emoji: () => '💤', label: () => 'Дрёма' },
  sleep_ritual: { emoji: () => '🌙', label: () => 'Ритуал' },
  bathe: { emoji: () => '🛁', label: () => 'Помыть' },
  heal: { emoji: () => '💊', label: () => 'Лечить' },
  bond: { emoji: () => '🤗', label: () => 'Обнять' },
  bond_listen: { emoji: () => '👂', label: () => 'Слушать' },
  bond_praise: { emoji: () => '✨', label: () => 'Похвала' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGuardianHint(pet: Pet, account: Account, actionId?: string): string | null {
  const g = account.memoryGuardian;
  if (!g) return null;
  if (!actionId) {
    if (pet.emergentState === 'shadow_form') return '🔮 Мягкие действия и доверие помогут пройти тень.';
    if (pet.confusedState) return '🔮 Дай впечатлениям улечься через спокойный сон.';
    if (pet.traumaLevel >= 40) return '🔮 Сейчас лучше заботливые действия.';
    return g.guidance[0] ? `🔮 ${g.guidance[0]}` : null;
  }
  if (actionId === 'sleep' && pet.isAsleep) return 'Сон лучше не прерывать раньше времени.';
  if (actionId === 'bond' && pet.traumaLevel >= 40) return 'Мягкий контакт поддержит доверие.';
  if (actionId === 'feed' && pet.stats.hunger < 25) return 'Лучше кормить до сильного голода.';
  if (actionId === 'play' && pet.stats.energy < 25) return 'Игру лучше отложить.';
  return getActionTrainingHint(actionId);
}

function loadingKey(id: string): string {
  if (id === 'play') return 'play_classic';
  return id;
}

function humanize(reason: string): string {
  return reason
    .replace('engine evidence', 'состоянию')
    .replace('care-сигнал', 'забота')
    .replace('recovery', 'восстановление')
    .replace('social', 'связь');
}

// ─── Single action tile ───────────────────────────────────────────────────────

function ActionTile({
  cfg, pet, account, actionLoading, recommendation, onAction,
}: {
  cfg: ActionConfig;
  pet: Pet;
  account: Account;
  actionLoading: string | null;
  recommendation?: ActionRecommendation;
  onAction: (id: string) => void;
}) {
  const meta = ACTION_META[cfg.id];
  const emoji = meta.emoji(pet);
  const label = meta.label(pet);
  const isDisabled = (cfg.disabled?.(pet) ?? false) || !!actionLoading;
  const isBusy = actionLoading === cfg.id || actionLoading === loadingKey(cfg.id)
    || (cfg.id.startsWith('sleep') && actionLoading === 'sleep')
    || (cfg.id.startsWith('bond') && actionLoading === 'bond');
  const isRec = !!recommendation;
  const hasHint = isRec || !!getGuardianHint(pet, account, cfg.id);
  const tip = recommendation?.reason
    ?? getGuardianHint(pet, account, cfg.id)
    ?? cfg.tooltip?.(pet) ?? '';

  return (
    <motion.button
      whileTap={isDisabled ? {} : { scale: 0.90 }}
      onClick={() => !isDisabled && onAction(cfg.id)}
      disabled={isDisabled}
      title={tip}
      className="relative flex flex-col items-center justify-center rounded-2xl select-none"
      style={{
        aspectRatio: '1 / 1',
        height: 64,
        background: isDisabled
          ? '#F1F5F9'
          : isRec
            ? 'linear-gradient(150deg,#ECFDF5 0%,#D1FAE5 100%)'
            : cfg.tint,
        border: isRec
          ? '1.5px solid rgba(16,185,129,0.35)'
          : isDisabled
            ? '1.5px solid #E2E8F0'
            : '1.5px solid rgba(255,255,255,0.8)',
        boxShadow: isDisabled
          ? 'none'
          : isRec
            ? '0 4px 14px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.7)'
            : '0 2px 8px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.7)',
        opacity: isDisabled ? 0.42 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        gap: 3,
        padding: '6px 4px',
      }}
    >
      {/* Hover gradient overlay */}
      {!isDisabled && (
        <motion.div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${cfg.gradient}`}
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 0.13 }}
          style={{ opacity: isBusy ? 0.16 : undefined }}
        />
      )}

      {/* Recommended pulse */}
      {isRec && !isDisabled && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              '0 0 0 0px rgba(16,185,129,0.25)',
              '0 0 0 5px rgba(16,185,129,0)',
            ],
          }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* Hint dot */}
      {hasHint && !isDisabled && (
        <span
          className="absolute top-1.5 right-1.5 h-[6px] w-[6px] rounded-full z-20"
          style={{ background: isRec ? '#10B981' : '#F59E0B' }}
        />
      )}

      {/* Emoji */}
      <span className="relative z-10 text-[22px] leading-none">
        {isBusy
          ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>⏳</motion.span>
          : emoji}
      </span>

      {/* Label */}
      <span className="relative z-10 text-[9.5px] font-bold text-slate-700 leading-tight text-center truncate max-w-full px-1">
        {label}
      </span>
    </motion.button>
  );
}

function InlineFoodPicker({
  foods,
  actionLoading,
  onFeed,
}: {
  foods: FoodItem[];
  actionLoading: string | null;
  onFeed: (foodId: string) => void;
}) {
  if (foods.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 px-3 py-2 text-[10px] font-medium text-slate-500">
        Еда пока не загружена.
      </p>
    );
  }

  return (
    <motion.div
      key="inline-food"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.14 }}
      className="mt-2 grid grid-cols-4 gap-1.5 rounded-2xl bg-amber-50/70 p-2"
      style={{ border: '1px solid rgba(245,158,11,0.16)' }}
    >
      {foods.slice(0, 8).map(food => (
        <motion.button
          key={food.id}
          type="button"
          whileTap={{ scale: 0.94 }}
          disabled={!!actionLoading}
          onClick={() => onFeed(food.id)}
          title={`${food.name}: +${food.hungerRestore} сытость`}
          className="flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl bg-white/75 px-1 py-1.5 text-center disabled:opacity-50"
        >
          <span className="text-xl leading-none">{food.emoji}</span>
          <span className="max-w-full truncate text-[8.5px] font-bold text-slate-700">{food.name}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActionPanel({ onPlayGame }: { onPlayGame: () => void }) {
  const {
    pet, account,
    playWithPet, sleepPet, wakePet, bathePet, healPet, bondWithPet,
    setActiveTab, actionLoading, foods, feedPet,
  } = usePetStore();

  const [showFood, setShowFood] = useState(false);
  const [activeGroup, setActiveGroup] = useState<ActionIntent>('care');

  if (!pet) return null;

  const recommendations = getRecommendedPetActions(pet).filter(r => ACTION_BY_ID.has(r.actionId));
  const recById = new Map(recommendations.map(r => [r.actionId, r]));
  const topRec = recommendations[0] ?? null;
  const guardianHint = getGuardianHint(pet, account);

  // Which groups have at least one recommendation?
  const groupHasRec = new Set(
    GROUPS
      .filter(g => g.ids.some(id => recById.has(id)))
      .map(g => g.id)
  );

  const currentGroup = GROUPS.find(g => g.id === activeGroup)!;

  const handleAction = async (id: string) => {
    switch (id) {
      case 'feed':
        setActiveGroup('care');
        return setShowFood(v => !v);
      case 'play': return onPlayGame();
      case 'play_puzzle': return playWithPet('puzzle');
      case 'play_social': return playWithPet('social');
      case 'sleep': return pet.isAsleep ? wakePet('gentle') : sleepPet();
      case 'sleep_nap': return sleepPet('nap');
      case 'sleep_ritual': return sleepPet('ritual');
      case 'bathe': return bathePet();
      case 'heal': return healPet();
      case 'bond': return bondWithPet();
      case 'bond_listen': return bondWithPet('listen');
      case 'bond_praise': return bondWithPet('praise');
    }
  };

  const handleFeed = async (foodId: string) => {
    await feedPet(foodId);
    setShowFood(false);
  };

  return (
    <>
      <div
        className="w-full rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.84)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.72)',
          boxShadow: '0 6px 28px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        {/* ── Category tab bar ─────────────────────────────── */}
        <div
          className="flex items-stretch gap-0 border-b"
          style={{ borderColor: 'rgba(226,232,240,0.7)' }}
        >
          {GROUPS.map(g => {
            const isActive = g.id === activeGroup;
            const hasRec = groupHasRec.has(g.id);

            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setActiveGroup(g.id);
                  if (g.id !== 'care') setShowFood(false);
                }}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-colors"
                style={{
                  background: isActive ? `${g.accent}12` : 'transparent',
                  borderBottom: isActive ? `2px solid ${g.accent}` : '2px solid transparent',
                }}
              >
                {/* Rec dot on tab */}
                {hasRec && (
                  <span
                    className="absolute top-2 right-[calc(50%-10px)] h-1.5 w-1.5 rounded-full"
                    style={{ background: '#10B981' }}
                  />
                )}
                <span className="text-base leading-none">{g.icon}</span>
                <span
                  className="text-[9px] font-bold leading-none"
                  style={{ color: isActive ? g.accent : '#94A3B8' }}
                >
                  {g.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Action tiles for current group ───────────────── */}
        <div className="px-3 pt-3 pb-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeGroup}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-3 gap-2"
            >
              {currentGroup.ids.map(id => {
                const cfg = ACTION_BY_ID.get(id);
                return cfg ? (
                  <ActionTile
                    key={id}
                    cfg={cfg}
                    pet={pet}
                    account={account}
                    actionLoading={actionLoading}
                    recommendation={recById.get(id)}
                    onAction={handleAction}
                  />
                ) : null;
              })}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {showFood && activeGroup === 'care' && (
              <InlineFoodPicker
                foods={foods}
                actionLoading={actionLoading}
                onFeed={handleFeed}
              />
            )}
          </AnimatePresence>

          {/* Inline hint for active group's top recommendation */}
          <AnimatePresence>
            {topRec && currentGroup.ids.includes(topRec.actionId) && (
              <motion.p
                key={topRec.actionId}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 text-[9.5px] font-semibold text-emerald-700 leading-snug px-0.5"
              >
                <span className="opacity-60">Сейчас: </span>
                {humanize(topRec.reason)}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ── Bottom bar: inventory + shop ─────────────────── */}
        <div
          className="flex border-t"
          style={{ borderColor: 'rgba(226,232,240,0.6)' }}
        >
          {[
            { id: 'inventory' as const, emoji: '🎒', label: 'Рюкзак' },
            { id: 'shop' as const, emoji: '🛍️', label: 'Магазин' },
          ].map((item, i) => (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors hover:bg-slate-50/80"
              style={{
                borderRight: i === 0 ? '1px solid rgba(226,232,240,0.6)' : 'none',
              }}
            >
              <span className="text-sm leading-none">{item.emoji}</span>
              <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
              <span className="text-[10px] text-slate-300">›</span>
            </motion.button>
          ))}
        </div>

        {/* ── Guardian hint (conditional) ───────────────────── */}
        <AnimatePresence>
          {guardianHint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p
                className="text-[9.5px] font-medium text-emerald-800 leading-snug px-3.5 py-2 border-t"
                style={{
                  borderColor: 'rgba(16,185,129,0.15)',
                  background: 'linear-gradient(90deg,rgba(236,253,245,0.9),rgba(209,250,229,0.5))',
                }}
              >
                {guardianHint}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
