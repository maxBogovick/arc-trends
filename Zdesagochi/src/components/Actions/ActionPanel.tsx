import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { usePetStore } from '../../store/petStore';
import type { Account, FoodItem, Pet } from '../../api';
import {
  PET_ACTIONS,
  PET_ACTION_BY_ID,
  PET_ACTION_META,
  bestFoodForPet,
  loadingKey,
  runSupportedPetAction,
  type SupportedPetActionId,
} from './petActionControls';
import {
  getRecommendedPetActions,
  type ActionRecommendation,
} from '../../personality/guidanceSelectors';

// ─── Types ────────────────────────────────────────────────────────────────────

type ColCount = 4 | 5 | 6 | 7 | 8;

interface ActionConfig {
  id: SupportedPetActionId;
  disabled?: (pet: Pet, food: FoodItem | null) => boolean;
  tooltip?: (pet: Pet, food: FoodItem | null) => string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLS_KEY = 'zdesagochi:flat-grid-cols:v1';
const COL_OPTIONS: ColCount[] = [4, 5, 6, 7, 8];

const ACTIONS: ActionConfig[] = PET_ACTIONS;
const ACTION_BY_ID = PET_ACTION_BY_ID;
const ACTION_META = PET_ACTION_META;

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

function getGuardianHint(pet: Pet, account: Account): string | null {
  const g = account.memoryGuardian;
  if (!g) return null;
  if (pet.emergentState === 'shadow_form') return '🔮 Мягкие действия и доверие помогут пройти тень.';
  if (pet.confusedState) return '🔮 Дай впечатлениям улечься через спокойный сон.';
  if (pet.traumaLevel >= 40) return '🔮 Сейчас лучше заботливые действия.';
  return g.guidance[0] ? `🔮 ${g.guidance[0]}` : null;
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
  const actionId = rec.actionId as SupportedPetActionId;
  const meta = ACTION_META[actionId];
  const cfg = ACTION_BY_ID.get(actionId);
  const disabled = (cfg?.disabled?.(pet, food) ?? false) || !!loading;
  const busy = loading === rec.actionId || loading === loadingKey(actionId);

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
  const actionId = id as SupportedPetActionId;
  const meta = ACTION_META[actionId];
  const cfg = ACTION_BY_ID.get(actionId)!;
  const scale = COL_SCALE[cols];
  const disabled = (cfg.disabled?.(pet, food) ?? false) || !!loading;
  const busy = loading === id || loading === loadingKey(actionId);

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
    .filter(r => ACTION_BY_ID.has(r.actionId as SupportedPetActionId))
    .slice(0, 6);
  const hotIds = new Set(recommendations.map(r => r.actionId));
  const guardianHint = getGuardianHint(pet, account);

  const handleAction = async (id: SupportedPetActionId) => {
    if (id !== 'feed') setFoodPickerOpen(false);
    await runSupportedPetAction(id, {
      pet,
      foods,
      onPlayGame,
      onOpenFoodPicker: () => {
        if (!foods.length) { notify('Еда пока не загружена', 'error'); return; }
        setFoodPickerOpen(v => !v);
      },
      feedPet,
      playWithPet,
      sleepPet,
      wakePet,
      bathePet,
      healPet,
      bondWithPet,
      notify,
    });
  };

  const handleFeedPick = async (foodId: string) => {
    await feedPet(foodId);
    setFoodPickerOpen(false);
  };

  // rec pills also open food picker for 'feed'
  const handleRecAction = async (id: string) => {
    await handleAction(id as SupportedPetActionId);
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
            onAction={id => handleAction(id as SupportedPetActionId)}
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
