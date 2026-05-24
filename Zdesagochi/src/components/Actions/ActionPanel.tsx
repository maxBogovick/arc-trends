import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { usePetStore } from '../../store/petStore';
import type { Account, FoodItem, Pet } from '../../api';
import {
  getActionTrainingHint,
  getRecommendedPetActions,
  type ActionRecommendation,
} from '../../personality/guidanceSelectors';

type ActionIntent = 'care' | 'play' | 'bond' | 'routine';
type GridSize = 3 | 4 | 5;

interface ActionConfig {
  id: string;
  intent: ActionIntent;
  gradient: string;
  tint: string;
  disabled?: (pet: Pet, food: FoodItem | null) => boolean;
  tooltip?: (pet: Pet, food: FoodItem | null) => string;
}

const FAVORITES_KEY = 'zdesagochi:action-favorites:v1';
const GRID_SIZE_KEY = 'zdesagochi:action-grid-size:v1';
const GRID_SIZES: GridSize[] = [3, 4, 5];

const ACTIONS: ActionConfig[] = [
  {
    id: 'feed', intent: 'care',
    gradient: 'from-amber-400 to-orange-500', tint: '#FEF3C7',
    disabled: (p, food) => p.isAsleep || p.stats.hunger > 90 || !food,
    tooltip: (p, food) => {
      if (p.isAsleep) return 'Питомец спит';
      if (!food) return 'Еда не загружена';
      if (p.stats.hunger > 90) return 'Питомец уже сыт';
      return `${food.emoji} ${food.name}: лучший вариант сейчас`;
    },
  },
  {
    id: 'bathe', intent: 'care',
    gradient: 'from-sky-400 to-cyan-400', tint: '#E0F2FE',
    disabled: p => p.isAsleep || p.stats.cleanliness > 90,
    tooltip: p => p.isAsleep ? 'Питомец спит' : p.stats.cleanliness > 90 ? 'Питомец чистый' : 'Восстановить чистоту',
  },
  {
    id: 'heal', intent: 'care',
    gradient: 'from-rose-400 to-pink-500', tint: '#FCE7F3',
    disabled: p => p.isAsleep || (p.stats.health > 85 && p.traumaLevel < 40 && p.emergentState !== 'shadow_form'),
    tooltip: p => p.isAsleep ? 'Питомец спит' : p.stats.health > 85 ? 'Сейчас лечение не нужно' : 'Поддержать здоровье',
  },
  {
    id: 'play', intent: 'play',
    gradient: 'from-violet-500 to-purple-600', tint: '#EDE9FE',
    disabled: p => p.isAsleep || p.stats.energy < 10,
    tooltip: p => p.isAsleep ? 'Питомец спит' : p.stats.energy < 10 ? 'Недостаточно энергии' : 'Классическая игра',
  },
  {
    id: 'play_puzzle', intent: 'play',
    gradient: 'from-indigo-400 to-sky-500', tint: '#E0E7FF',
    disabled: p => p.isAsleep || p.stats.energy < 8,
    tooltip: p => p.isAsleep ? 'Питомец спит' : p.stats.energy < 8 ? 'Недостаточно энергии' : 'Любопытство и порядок',
  },
  {
    id: 'play_social', intent: 'play',
    gradient: 'from-teal-400 to-emerald-500', tint: '#D1FAE5',
    disabled: p => p.isAsleep || p.stats.energy < 10,
    tooltip: p => p.isAsleep ? 'Питомец спит' : p.stats.energy < 10 ? 'Недостаточно энергии' : 'Социальность через игру',
  },
  {
    id: 'bond', intent: 'bond',
    gradient: 'from-pink-400 to-rose-500', tint: '#FFE4E6',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец спит' : 'Теплый контакт',
  },
  {
    id: 'bond_listen', intent: 'bond',
    gradient: 'from-emerald-400 to-teal-500', tint: '#CCFBF1',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец спит' : 'Снижает тревожность и укрепляет доверие',
  },
  {
    id: 'bond_praise', intent: 'bond',
    gradient: 'from-yellow-400 to-amber-400', tint: '#FEF9C3',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец спит' : 'Учит уверенности',
  },
  {
    id: 'sleep', intent: 'routine',
    gradient: 'from-indigo-400 to-violet-500', tint: '#EDE9FE',
    tooltip: p => p.isAsleep ? 'Мягко разбудить' : 'Уложить спать',
  },
  {
    id: 'sleep_nap', intent: 'routine',
    gradient: 'from-sky-300 to-blue-400', tint: '#E0F2FE',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец уже спит' : 'Короткое восстановление',
  },
  {
    id: 'sleep_ritual', intent: 'routine',
    gradient: 'from-slate-400 to-indigo-500', tint: '#F1F5F9',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец уже спит' : 'Укрепляет спокойный режим',
  },
];

const ACTION_BY_ID = new Map(ACTIONS.map(a => [a.id, a]));

const GROUPS: Array<{ id: ActionIntent; label: string; icon: string; accent: string; ids: string[] }> = [
  { id: 'care', label: 'Забота', icon: '🩺', accent: '#F59E0B', ids: ['feed', 'bathe', 'heal'] },
  { id: 'play', label: 'Игра', icon: '🎮', accent: '#8B5CF6', ids: ['play', 'play_puzzle', 'play_social'] },
  { id: 'bond', label: 'Связь', icon: '🤍', accent: '#F43F5E', ids: ['bond', 'bond_listen', 'bond_praise'] },
  { id: 'routine', label: 'Режим', icon: '🌙', accent: '#6366F1', ids: ['sleep', 'sleep_nap', 'sleep_ritual'] },
];

const ACTION_META: Record<string, {
  emoji: (pet: Pet, food: FoodItem | null) => string;
  label: (pet: Pet) => string;
  short: string;
}> = {
  feed: { emoji: (_pet, food) => food?.emoji ?? '🍔', label: () => 'Покормить', short: 'Еда' },
  play: { emoji: () => '🎮', label: () => 'Играть', short: 'Игра' },
  play_puzzle: { emoji: () => '🧩', label: () => 'Пазл', short: 'Пазл' },
  play_social: { emoji: () => '🫶', label: () => 'Вместе', short: 'Вместе' },
  sleep: { emoji: p => p.isAsleep ? '☀️' : '😴', label: p => p.isAsleep ? 'Разбудить' : 'Спать', short: 'Сон' },
  sleep_nap: { emoji: () => '💤', label: () => 'Дрёма', short: 'Дрёма' },
  sleep_ritual: { emoji: () => '🌙', label: () => 'Ритуал', short: 'Ритуал' },
  bathe: { emoji: () => '🛁', label: () => 'Помыть', short: 'Мыть' },
  heal: { emoji: () => '💊', label: () => 'Лечить', short: 'Лечить' },
  bond: { emoji: () => '🤗', label: () => 'Обнять', short: 'Обнять' },
  bond_listen: { emoji: () => '👂', label: () => 'Слушать', short: 'Слушать' },
  bond_praise: { emoji: () => '✨', label: () => 'Похвала', short: 'Похвала' },
};

const DEFAULT_FAVORITES = [
  'feed',
  'bond_listen',
  'sleep_nap',
  'play_puzzle',
  'bathe',
  'heal',
  'bond',
  'play_social',
  'sleep_ritual',
];

function readGridSize(): GridSize {
  if (typeof localStorage === 'undefined') return 3;
  const raw = Number(localStorage.getItem(GRID_SIZE_KEY));
  return raw === 4 || raw === 5 ? raw : 3;
}

function readFavorites(max: number): string[] {
  if (typeof localStorage === 'undefined') return DEFAULT_FAVORITES.slice(0, max);
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    if (!Array.isArray(parsed)) return DEFAULT_FAVORITES.slice(0, max);
    const ids = parsed.filter((id): id is string => typeof id === 'string' && ACTION_BY_ID.has(id));
    return (ids.length > 0 ? ids : DEFAULT_FAVORITES).slice(0, max);
  } catch {
    return DEFAULT_FAVORITES.slice(0, max);
  }
}

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

function chooseFoodForPet(pet: Pet, foods: FoodItem[]): FoodItem | null {
  if (foods.length === 0) return null;

  if (pet.stats.hunger <= 25) {
    return [...foods].sort((a, b) => b.hungerRestore - a.hungerRestore)[0];
  }

  if (pet.stats.health <= 70) {
    return [...foods].sort((a, b) => {
      const healthDiff = b.healthBonus - a.healthBonus;
      return healthDiff !== 0 ? healthDiff : b.hungerRestore - a.hungerRestore;
    })[0];
  }

  const gentleIds = ['apple', 'milk', 'salad'];
  return foods.find(food => gentleIds.includes(food.id))
    ?? [...foods].sort((a, b) => {
      const healthDiff = b.healthBonus - a.healthBonus;
      return healthDiff !== 0 ? healthDiff : a.hungerRestore - b.hungerRestore;
    })[0];
}

function foodReason(pet: Pet, food: FoodItem | null): string {
  if (!food) return 'еда не загружена';
  if (pet.stats.hunger <= 25) return `${food.name}: питомец сильно голоден`;
  if (pet.stats.health <= 70) return `${food.name}: здоровье просело`;
  return `${food.name}: мягкий вариант сейчас`;
}

function ActionTile({
  cfg,
  pet,
  account,
  actionLoading,
  recommendation,
  selectedFood,
  onAction,
  compact = false,
}: {
  cfg: ActionConfig;
  pet: Pet;
  account: Account;
  actionLoading: string | null;
  recommendation?: ActionRecommendation;
  selectedFood: FoodItem | null;
  onAction: (id: string) => void;
  compact?: boolean;
}) {
  const meta = ACTION_META[cfg.id];
  const isDisabled = (cfg.disabled?.(pet, selectedFood) ?? false) || !!actionLoading;
  const isBusy = actionLoading === cfg.id || actionLoading === loadingKey(cfg.id)
    || (cfg.id.startsWith('sleep') && actionLoading === 'sleep')
    || (cfg.id.startsWith('bond') && actionLoading === 'bond');
  const isRec = !!recommendation;
  const guardianHint = getGuardianHint(pet, account, cfg.id);
  const tip = recommendation?.reason
    ?? (cfg.id === 'feed' ? foodReason(pet, selectedFood) : guardianHint)
    ?? cfg.tooltip?.(pet, selectedFood) ?? '';

  return (
    <motion.button
      type="button"
      whileTap={isDisabled ? {} : { scale: 0.92 }}
      onClick={() => !isDisabled && onAction(cfg.id)}
      disabled={isDisabled}
      title={tip}
      className="relative flex flex-col items-center justify-center rounded-2xl select-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
      style={{
        aspectRatio: '1 / 1',
        minHeight: compact ? 54 : 64,
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
        gap: compact ? 2 : 3,
        padding: compact ? '5px 3px' : '6px 4px',
      }}
    >
      {!isDisabled && (
        <motion.div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${cfg.gradient}`}
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 0.13 }}
          style={{ opacity: isBusy ? 0.16 : undefined }}
        />
      )}

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

      {(isRec || guardianHint) && !isDisabled && (
        <span
          className="absolute top-1.5 right-1.5 h-[6px] w-[6px] rounded-full z-20"
          style={{ background: isRec ? '#10B981' : '#F59E0B' }}
        />
      )}

      <span className="relative z-10 text-[22px] leading-none">
        {isBusy
          ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>⏳</motion.span>
          : meta.emoji(pet, selectedFood)}
      </span>

      <span className="relative z-10 text-[9.5px] font-bold text-slate-700 leading-tight text-center truncate max-w-full px-1">
        {compact ? meta.short : meta.label(pet)}
      </span>
    </motion.button>
  );
}

function SectionHeader({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">{title}</p>
        {detail && <p className="text-[9.5px] font-semibold text-slate-400 truncate">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function ActionPanel({ onPlayGame }: { onPlayGame: () => void }) {
  const {
    pet, account,
    playWithPet, sleepPet, wakePet, bathePet, healPet, bondWithPet,
    setActiveTab, actionLoading, foods, feedPet, notify,
  } = usePetStore();

  const [gridSize, setGridSizeState] = useState<GridSize>(() => readGridSize());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readFavorites(readGridSize() * readGridSize()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activeGroup, setActiveGroup] = useState<ActionIntent>('care');

  const gridLimit = gridSize * gridSize;

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(GRID_SIZE_KEY, String(gridSize));
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds.slice(0, gridLimit)));
  }, [favoriteIds, gridLimit, gridSize]);

  if (!pet) return null;

  const selectedFood = chooseFoodForPet(pet, foods);
  const recommendations = getRecommendedPetActions(pet).filter(r => ACTION_BY_ID.has(r.actionId)).slice(0, 5);
  const recById = new Map(recommendations.map(r => [r.actionId, r]));
  const visibleFavoriteIds = favoriteIds.filter(id => ACTION_BY_ID.has(id)).slice(0, gridLimit);
  const guardianHint = getGuardianHint(pet, account);
  const currentGroup = GROUPS.find(g => g.id === activeGroup) ?? GROUPS[0];
  const groupHasRec = new Set(
    GROUPS
      .filter(g => g.ids.some(id => recById.has(id)))
      .map(g => g.id)
  );

  const recommendedDetail = recommendations[0]
    ? humanize(recommendations[0].reason)
    : 'по состоянию питомца';

  const setGridSize = (next: GridSize) => {
    setGridSizeState(next);
    setFavoriteIds(ids => ids.slice(0, next * next));
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds(ids => {
      if (ids.includes(id)) return ids.filter(item => item !== id);
      if (ids.length >= gridLimit) return ids;
      return [...ids, id];
    });
  };

  const handleAction = async (id: string) => {
    switch (id) {
      case 'feed':
        if (!selectedFood) {
          notify('Еда пока не загружена', 'error');
          return;
        }
        await feedPet(selectedFood.id);
        return;
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

  const quickGridStyle = { gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` };

  return (
    <div
      className="w-full rounded-3xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.84)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.72)',
        boxShadow: '0 6px 28px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      <div className="space-y-4 px-3 pt-3 pb-3">
        <section className="space-y-2">
          <SectionHeader
            title="Лучшее сейчас"
            detail={recommendedDetail}
          />
          <div className="grid grid-cols-5 gap-1.5">
            {recommendations.map(rec => {
              const cfg = ACTION_BY_ID.get(rec.actionId);
              return cfg ? (
                <ActionTile
                  key={rec.actionId}
                  cfg={cfg}
                  pet={pet}
                  account={account}
                  actionLoading={actionLoading}
                  recommendation={rec}
                  selectedFood={selectedFood}
                  onAction={handleAction}
                  compact
                />
              ) : null;
            })}
          </div>
        </section>

        <section className="space-y-2">
          <SectionHeader
            title="Быстрые действия"
            detail={`${gridSize}×${gridSize} · ${visibleFavoriteIds.length}/${gridLimit}`}
            action={(
              <button
                type="button"
                onClick={() => setSettingsOpen(v => !v)}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 hover:bg-slate-200"
              >
                {settingsOpen ? 'Готово' : 'Настроить'}
              </button>
            )}
          />

          <div className="grid gap-1.5" style={quickGridStyle}>
            {visibleFavoriteIds.map(id => {
              const cfg = ACTION_BY_ID.get(id);
              return cfg ? (
                <ActionTile
                  key={id}
                  cfg={cfg}
                  pet={pet}
                  account={account}
                  actionLoading={actionLoading}
                  recommendation={recById.get(id)}
                  selectedFood={selectedFood}
                  onAction={handleAction}
                  compact
                />
              ) : null;
            })}
          </div>

          <AnimatePresence initial={false}>
            {settingsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="rounded-2xl bg-slate-50/80 p-2.5 space-y-3"
                style={{ border: '1px solid rgba(226,232,240,0.8)' }}
              >
                <div className="grid grid-cols-3 gap-1.5">
                  {GRID_SIZES.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setGridSize(size)}
                      className="rounded-xl py-1.5 text-[10px] font-black"
                      style={{
                        background: gridSize === size ? '#7C3AED' : 'white',
                        color: gridSize === size ? 'white' : '#64748B',
                        border: gridSize === size ? '1px solid #7C3AED' : '1px solid #E2E8F0',
                      }}
                    >
                      {size}×{size}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {GROUPS.map(group => (
                    <div key={group.id} className="space-y-1.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {group.icon} {group.label}
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {group.ids.map(id => {
                          const active = favoriteIds.includes(id);
                          const disabled = !active && favoriteIds.length >= gridLimit;
                          return (
                            <button
                              key={id}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleFavorite(id)}
                              className="rounded-xl px-2 py-1.5 text-[10px] font-bold disabled:opacity-40"
                              style={{
                                background: active ? `${group.accent}18` : 'white',
                                color: active ? group.accent : '#64748B',
                                border: active ? `1px solid ${group.accent}44` : '1px solid #E2E8F0',
                              }}
                            >
                              {ACTION_META[id].emoji(pet, selectedFood)} {ACTION_META[id].short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="space-y-2">
          <SectionHeader
            title="Все действия"
            detail="по группам, когда нужно не быстрое"
            action={(
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 hover:bg-slate-200"
              >
                {showAll ? 'Свернуть' : 'Открыть'}
              </button>
            )}
          />

          <AnimatePresence initial={false}>
            {showAll && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.16 }}
                className="overflow-hidden rounded-2xl"
                style={{ border: '1px solid rgba(226,232,240,0.75)' }}
              >
                <div className="flex border-b" style={{ borderColor: 'rgba(226,232,240,0.75)' }}>
                  {GROUPS.map(g => {
                    const isActive = g.id === activeGroup;
                    const hasRec = groupHasRec.has(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setActiveGroup(g.id)}
                        className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors"
                        style={{
                          background: isActive ? `${g.accent}12` : 'rgba(255,255,255,0.5)',
                          borderBottom: isActive ? `2px solid ${g.accent}` : '2px solid transparent',
                        }}
                      >
                        {hasRec && (
                          <span
                            className="absolute top-1.5 right-[calc(50%-10px)] h-1.5 w-1.5 rounded-full"
                            style={{ background: '#10B981' }}
                          />
                        )}
                        <span className="text-sm leading-none">{g.icon}</span>
                        <span className="text-[8.5px] font-bold leading-none" style={{ color: isActive ? g.accent : '#94A3B8' }}>
                          {g.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-2 bg-white/45 p-2.5">
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
                        selectedFood={selectedFood}
                        onAction={handleAction}
                      />
                    ) : null;
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <div className="flex border-t" style={{ borderColor: 'rgba(226,232,240,0.6)' }}>
        {[
          { id: 'inventory' as const, emoji: '🎒', label: 'Рюкзак' },
          { id: 'shop' as const, emoji: '🛍️', label: 'Магазин' },
        ].map((item, index) => (
          <motion.button
            key={item.id}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors hover:bg-slate-50/80"
            style={{ borderRight: index === 0 ? '1px solid rgba(226,232,240,0.6)' : 'none' }}
          >
            <span className="text-sm leading-none">{item.emoji}</span>
            <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
            <span className="text-[10px] text-slate-300">›</span>
          </motion.button>
        ))}
      </div>

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
  );
}
