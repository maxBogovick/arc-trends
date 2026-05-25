import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { usePetStore } from '../../store/petStore';
import type { Account, FoodItem, Pet } from '../../api';
import {
  getRecommendedPetActions,
  type ActionRecommendation,
} from '../../personality/guidanceSelectors';

// ─── Types ────────────────────────────────────────────────────────────────────

type ColCount = 4 | 5 | 6 | 7 | 8;

interface ActionConfig {
  id: string;
  disabled?: (pet: Pet, food: FoodItem | null) => boolean;
  tooltip?: (pet: Pet, food: FoodItem | null) => string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLS_KEY = 'zdesagochi:flat-grid-cols:v1';
const COL_OPTIONS: ColCount[] = [4, 5, 6, 7, 8];

const ACTIONS: ActionConfig[] = [
  {
    id: 'feed',
    disabled: (p, food) => p.isAsleep || p.stats.hunger > 90 || !food,
    tooltip: (p, food) => {
      if (p.isAsleep) return 'Питомец спит';
      if (!food) return 'Еда не загружена';
      if (p.stats.hunger > 90) return 'Питомец уже сыт';
      return `${food.emoji} ${food.name}`;
    },
  },
  {
    id: 'bathe',
    disabled: p => p.isAsleep || p.stats.cleanliness > 90,
    tooltip: p =>
      p.isAsleep ? 'Питомец спит' : p.stats.cleanliness > 90 ? 'Питомец чистый' : 'Восстановить чистоту',
  },
  {
    id: 'heal',
    disabled: p =>
      p.isAsleep || (p.stats.health > 85 && p.traumaLevel < 40 && p.emergentState !== 'shadow_form'),
    tooltip: p =>
      p.isAsleep ? 'Питомец спит' : p.stats.health > 85 ? 'Лечение не нужно' : 'Поддержать здоровье',
  },
  {
    id: 'play',
    disabled: p => p.isAsleep || p.stats.energy < 10,
    tooltip: p =>
      p.isAsleep ? 'Питомец спит' : p.stats.energy < 10 ? 'Нет энергии' : 'Классическая игра',
  },
  {
    id: 'play_puzzle',
    disabled: p => p.isAsleep || p.stats.energy < 8,
    tooltip: p =>
      p.isAsleep ? 'Питомец спит' : p.stats.energy < 8 ? 'Нет энергии' : 'Любопытство и порядок',
  },
  {
    id: 'play_social',
    disabled: p => p.isAsleep || p.stats.energy < 10,
    tooltip: p =>
      p.isAsleep ? 'Питомец спит' : p.stats.energy < 10 ? 'Нет энергии' : 'Социальность через игру',
  },
  {
    id: 'bond',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец спит' : 'Тёплый контакт',
  },
  {
    id: 'bond_listen',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец спит' : 'Снижает тревожность',
  },
  {
    id: 'bond_praise',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Питомец спит' : 'Учит уверенности',
  },
  {
    id: 'sleep',
    tooltip: p => p.isAsleep ? 'Мягко разбудить' : 'Уложить спать',
  },
  {
    id: 'sleep_nap',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Уже спит' : 'Короткое восстановление',
  },
  {
    id: 'sleep_ritual',
    disabled: p => p.isAsleep,
    tooltip: p => p.isAsleep ? 'Уже спит' : 'Спокойный режим',
  },
];

const ACTION_BY_ID = new Map(ACTIONS.map(a => [a.id, a]));

const ACTION_META: Record<string, {
  emoji: (pet: Pet, food: FoodItem | null) => string;
  label: string;
}> = {
  feed: { emoji: (_p, f) => f?.emoji ?? '🍔', label: 'Еда' },
  bathe: { emoji: () => '🛁', label: 'Мыть' },
  heal: { emoji: () => '💊', label: 'Лечить' },
  play: { emoji: () => '🎮', label: 'Игра' },
  play_puzzle: { emoji: () => '🧩', label: 'Пазл' },
  play_social: { emoji: () => '🫶', label: 'Вместе' },
  bond: { emoji: () => '🤗', label: 'Обнять' },
  bond_listen: { emoji: () => '👂', label: 'Слушать' },
  bond_praise: { emoji: () => '✨', label: 'Похвала' },
  sleep: { emoji: p => p.isAsleep ? '☀️' : '😴', label: 'Сон' },
  sleep_nap: { emoji: () => '💤', label: 'Дрёма' },
  sleep_ritual: { emoji: () => '🌙', label: 'Ритуал' },
};

const COL_SCALE: Record<ColCount, { ico: number; lbl: number }> = {
  4: { ico: 28, lbl: 10 },
  5: { ico: 24, lbl: 9 },
  6: { ico: 20, lbl: 8 },
  7: { ico: 18, lbl: 8 },
  8: { ico: 16, lbl: 7.5 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readCols(): ColCount {
  if (typeof localStorage === 'undefined') return 6;
  const v = Number(localStorage.getItem(COLS_KEY));
  return COL_OPTIONS.includes(v as ColCount) ? (v as ColCount) : 6;
}

function bestFoodForPet(pet: Pet, foods: FoodItem[]): FoodItem | null {
  if (!foods.length) return null;
  if (pet.stats.hunger <= 25)
    return [...foods].sort((a, b) => b.hungerRestore - a.hungerRestore)[0];
  if (pet.stats.health <= 70)
    return [...foods].sort((a, b) => (b.healthBonus - a.healthBonus) || (b.hungerRestore - a.hungerRestore))[0];
  const gentle = ['apple', 'milk', 'salad'];
  return (
    foods.find(f => gentle.includes(f.id)) ??
    [...foods].sort((a, b) => (b.healthBonus - a.healthBonus) || (a.hungerRestore - b.hungerRestore))[0]
  );
}

function getGuardianHint(pet: Pet, account: Account): string | null {
  const g = account.memoryGuardian;
  if (!g) return null;
  if (pet.emergentState === 'shadow_form') return '🔮 Мягкие действия и доверие помогут пройти тень.';
  if (pet.confusedState) return '🔮 Дай впечатлениям улечься через спокойный сон.';
  if (pet.traumaLevel >= 40) return '🔮 Сейчас лучше заботливые действия.';
  return g.guidance[0] ? `🔮 ${g.guidance[0]}` : null;
}

function loadingKey(id: string) {
  return id === 'play' ? 'play_classic' : id;
}

// ─── Food Picker ──────────────────────────────────────────────────────────────

function FoodPicker({
  foods,
  best,
  pet,
  loading,
  onPick,
  onClose,
}: {
  foods: FoodItem[];
  best: FoodItem | null;
  pet: Pet;
  loading: string | null;
  onPick: (foodId: string) => void;
  onClose: () => void;
}) {
  const busy = loading === 'feed';

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        overflow: 'hidden',
        borderBottom: '0.5px solid rgba(226,232,240,0.8)',
        background: 'rgba(240,253,249,0.7)',
      }}
    >
      <div style={{ padding: '6px 8px' }}>
        {/* header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: '#065F46', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Что дать?
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 9, fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* food items — 2-row grid, no scroll */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.ceil(foods.length / 2)}, minmax(0, 1fr))`,
            gap: 3,
          }}
        >
          {foods.map(food => {
            const isBest = food.id === best?.id;
            const isDisabled = pet.stats.hunger > 90 || busy;

            return (
              <motion.button
                key={food.id}
                type="button"
                whileTap={isDisabled ? {} : { scale: 0.9 }}
                disabled={isDisabled}
                onClick={() => !isDisabled && onPick(food.id)}
                className="flex flex-col items-center rounded-lg"
                style={{
                  gap: 2,
                  padding: '5px 3px 4px',
                  border: isBest ? '1.5px solid #6EE7B7' : '1px solid rgba(226,232,240,0.8)',
                  background: isBest ? '#ECFDF5' : 'rgba(255,255,255,0.85)',
                  opacity: isDisabled ? 0.4 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  position: 'relative',
                }}
              >
                {isBest && (
                  <span style={{ position: 'absolute', top: 2, right: 3, fontSize: 7, color: '#10B981', fontWeight: 700 }}>
                    ★
                  </span>
                )}
                <span style={{ fontSize: 16, lineHeight: 1 }}>{food.emoji}</span>
                <span style={{ fontSize: 8, fontWeight: 500, color: isBest ? '#065F46' : 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {food.name}
                </span>
                <span style={{ fontSize: 7.5, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
                  +{food.hungerRestore}{food.healthBonus > 0 ? ` ❤️+${food.healthBonus}` : ''}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Rec Pill ─────────────────────────────────────────────────────────────────

function RecPill({
  rec, pet, food, loading, onAction,
}: {
  rec: ActionRecommendation;
  pet: Pet;
  food: FoodItem | null;
  loading: string | null;
  onAction: (id: string) => void;
}) {
  const meta = ACTION_META[rec.actionId];
  const cfg = ACTION_BY_ID.get(rec.actionId);
  const disabled = (cfg?.disabled?.(pet, food) ?? false) || !!loading;
  const busy = loading === rec.actionId || loading === loadingKey(rec.actionId);

  return (
    <motion.button
      type="button"
      whileTap={disabled ? {} : { scale: 0.93 }}
      onClick={() => !disabled && onAction(rec.actionId)}
      disabled={disabled}
      title={rec.reason}
      className="flex-none flex items-center gap-1 rounded-full border select-none"
      style={{
        padding: '3px 8px 3px 5px',
        borderColor: disabled ? 'transparent' : '#6EE7B7',
        background: disabled ? 'var(--color-background-secondary)' : '#F0FDF9',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={{ fontSize: 12, lineHeight: 1 }}>
        {busy ? '⏳' : meta.emoji(pet, food)}
      </span>
      <span style={{ fontSize: 9, fontWeight: 500, color: disabled ? 'var(--color-text-tertiary)' : '#065F46', whiteSpace: 'nowrap' }}>
        {meta.label}
      </span>
    </motion.button>
  );
}

// ─── Grid Cell ────────────────────────────────────────────────────────────────

function GridCell({
  id, pet, food, loading, isHot, isActive, cols, onAction,
}: {
  id: string;
  pet: Pet;
  food: FoodItem | null;
  loading: string | null;
  isHot: boolean;
  isActive: boolean;
  cols: ColCount;
  onAction: (id: string) => void;
}) {
  const meta = ACTION_META[id];
  const cfg = ACTION_BY_ID.get(id)!;
  const scale = COL_SCALE[cols];
  const disabled = (cfg.disabled?.(pet, food) ?? false) || !!loading;
  const busy = loading === id || loading === loadingKey(id);

  return (
    <motion.button
      type="button"
      whileTap={disabled ? {} : { scale: 0.88 }}
      onClick={() => !disabled && onAction(id)}
      disabled={disabled}
      title={cfg.tooltip?.(pet, food) ?? ''}
      className="relative flex flex-col items-center justify-center select-none focus:outline-none rounded-md"
      style={{
        padding: '5px 1px 4px',
        gap: 2,
        opacity: disabled ? 0.22 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: isActive ? 'rgba(16,185,129,0.08)' : 'transparent',
        outline: isActive ? '1.5px solid rgba(16,185,129,0.3)' : 'none',
        outlineOffset: -1,
        transition: 'background .12s',
      }}
    >
      {isHot && !disabled && (
        <span
          className="absolute rounded-full"
          style={{ top: 3, right: 5, width: 4, height: 4, background: '#10B981' }}
        />
      )}
      <span style={{ fontSize: scale.ico, lineHeight: 1 }}>
        {busy ? '⏳' : meta.emoji(pet, food)}
      </span>
      <span style={{
        fontSize: scale.lbl,
        fontWeight: 500,
        color: isHot && !disabled ? '#10B981' : 'var(--color-text-tertiary)',
        lineHeight: 1,
      }}>
        {meta.label}
      </span>
    </motion.button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActionPanel({ onPlayGame }: { onPlayGame: () => void }) {
  const {
    pet, account,
    playWithPet, sleepPet, wakePet, bathePet, healPet, bondWithPet,
    setActiveTab, actionLoading, foods, feedPet, notify,
  } = usePetStore();

  const [cols, setCols] = useState<ColCount>(readCols);
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);

  useEffect(() => {
    if (typeof localStorage !== 'undefined')
      localStorage.setItem(COLS_KEY, String(cols));
  }, [cols]);

  // close food picker after feeding finishes
  useEffect(() => {
    if (!actionLoading) setFoodPickerOpen(false);
  }, [actionLoading]);

  if (!pet) return null;

  const bestFood = bestFoodForPet(pet, foods);
  const recommendations = getRecommendedPetActions(pet)
    .filter(r => ACTION_BY_ID.has(r.actionId))
    .slice(0, 6);
  const hotIds = new Set(recommendations.map(r => r.actionId));
  const guardianHint = getGuardianHint(pet, account);

  const handleAction = async (id: string) => {
    if (id === 'feed') {
      if (!foods.length) { notify('Еда пока не загружена', 'error'); return; }
      // toggle food picker
      setFoodPickerOpen(v => !v);
      return;
    }
    setFoodPickerOpen(false);
    switch (id) {
      case 'play': onPlayGame(); break;
      case 'play_puzzle': await playWithPet('puzzle'); break;
      case 'play_social': await playWithPet('social'); break;
      case 'sleep': pet.isAsleep ? await wakePet('gentle') : await sleepPet(); break;
      case 'sleep_nap': await sleepPet('nap'); break;
      case 'sleep_ritual': await sleepPet('ritual'); break;
      case 'bathe': await bathePet(); break;
      case 'heal': await healPet(); break;
      case 'bond': await bondWithPet(); break;
      case 'bond_listen': await bondWithPet('listen'); break;
      case 'bond_praise': await bondWithPet('praise'); break;
    }
  };

  const handleFeedPick = async (foodId: string) => {
    await feedPet(foodId);
    setFoodPickerOpen(false);
  };

  // rec pills also open food picker for 'feed'
  const handleRecAction = async (id: string) => {
    if (id === 'feed') { handleAction('feed'); return; }
    await handleAction(id);
  };

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.72)',
        boxShadow: '0 4px 20px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      {/* Recommendation pills */}
      {recommendations.length > 0 && (
        <div
          className="flex gap-1 overflow-x-auto"
          style={{ padding: '5px 6px', borderBottom: '0.5px solid rgba(226,232,240,0.7)', scrollbarWidth: 'none' }}
        >
          {recommendations.map(rec => (
            <RecPill
              key={rec.actionId}
              rec={rec}
              pet={pet}
              food={bestFood}
              loading={actionLoading}
              onAction={handleRecAction}
            />
          ))}
        </div>
      )}

      {/* Food picker */}
      <AnimatePresence initial={false}>
        {foodPickerOpen && (
          <FoodPicker
            foods={foods}
            best={bestFood}
            pet={pet}
            loading={actionLoading}
            onPick={handleFeedPick}
            onClose={() => setFoodPickerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Column count switcher */}
      <div
        className="flex items-center"
        style={{ borderBottom: '0.5px solid rgba(226,232,240,0.7)' }}
      >
        <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)', padding: '0 8px', whiteSpace: 'nowrap', userSelect: 'none' }}>
          в ряд
        </span>
        {COL_OPTIONS.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setCols(n)}
            style={{
              flex: 1, padding: '5px 2px',
              fontSize: 11, fontWeight: 500,
              color: cols === n ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              background: cols === n ? 'rgba(226,232,240,0.45)' : 'transparent',
              border: 'none',
              borderRight: n !== 8 ? '0.5px solid rgba(226,232,240,0.7)' : 'none',
              cursor: 'pointer',
              transition: 'background .12s',
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Action grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          padding: '4px 4px 2px',
        }}
      >
        {ACTIONS.map(({ id }) => (
          <GridCell
            key={id}
            id={id}
            pet={pet}
            food={bestFood}
            loading={actionLoading}
            isHot={hotIds.has(id)}
            isActive={id === 'feed' && foodPickerOpen}
            cols={cols}
            onAction={handleAction}
          />
        ))}
      </div>

      {/* Footer nav */}
      <div className="flex" style={{ borderTop: '0.5px solid rgba(226,232,240,0.7)' }}>
        {([
          { id: 'inventory' as const, emoji: '🎒', label: 'Рюкзак' },
          { id: 'shop' as const, emoji: '🛍️', label: 'Магазин' },
        ] as const).map((item, i) => (
          <motion.button
            key={item.id}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-1 items-center justify-center gap-1"
            style={{
              padding: '7px 4px',
              fontSize: 10, fontWeight: 500,
              color: 'var(--color-text-secondary)',
              borderRight: i === 0 ? '0.5px solid rgba(226,232,240,0.7)' : 'none',
              background: 'transparent', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13 }}>{item.emoji}</span>
            {item.label}
          </motion.button>
        ))}
      </div>

      {/* Guardian hint */}
      <AnimatePresence>
        {guardianHint && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              fontSize: 10, color: '#065F46',
              background: '#F0FDF9',
              borderTop: '0.5px solid #A7F3D0',
              padding: '5px 10px',
              lineHeight: 1.5, overflow: 'hidden',
            }}
          >
            {guardianHint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}