import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ApiModeToggle } from './ApiModeToggle';
import { usePetStore, type TabId } from '../../store/petStore';

// ─── Static data ──────────────────────────────────────────────────────────────

const TAB_TITLES: Record<TabId, string> = {
  home: 'Главная',
  shop: 'Магазин',
  inventory: 'Рюкзак',
  quests: 'Задания',
  achievements: 'Достижения',
  leaderboard: 'Рейтинг',
  skins: 'Скины',
  editor: 'Редактор питомца',
  room: 'Комната',
  personality_test: 'Тест характера',
  personality_assistant: 'Помощник характера',
};

const STAGE_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  egg: { label: 'Яйцо', emoji: '🥚', color: '#94A3B8' },
  baby: { label: 'Малыш', emoji: '🌱', color: '#34D399' },
  child: { label: 'Ребёнок', emoji: '🌿', color: '#10B981' },
  teen: { label: 'Подросток', emoji: '🌲', color: '#059669' },
  adult: { label: 'Взрослый', emoji: '🌳', color: '#0D9488' },
  elder: { label: 'Мудрец', emoji: '🦋', color: '#7C3AED' },
};

// ─── Name editor ──────────────────────────────────────────────────────────────

function NameEditor({
  name,
  disabled,
  onSave,
}: {
  name: string;
  disabled: boolean;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const submit = async () => {
    if (value.trim()) await onSave(value.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder={name}
          maxLength={20}
          className="w-28 px-2 py-0.5 rounded-lg border border-indigo-300 font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        />
        <button
          onClick={submit}
          disabled={disabled}
          className="h-6 w-6 rounded-lg bg-indigo-500 text-white text-[11px] font-bold disabled:opacity-50 flex items-center justify-center"
        >
          ✓
        </button>
        <button
          onClick={() => setEditing(false)}
          className="h-6 w-6 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setEditing(true); setValue(name); }}
      className="group flex items-center gap-1 min-w-0"
      title="Переименовать"
    >
      <span className="font-bold text-slate-800 text-sm leading-tight truncate max-w-[120px]">
        {name}
      </span>
      <span className="text-[10px] opacity-0 group-hover:opacity-40 transition-opacity">✏️</span>
    </button>
  );
}

// ─── XP bar ───────────────────────────────────────────────────────────────────

function XpBar({ xp, xpToNext, burst }: { xp: number; xpToNext: number; burst: boolean }) {
  const pct = Math.max(0, Math.min(100, (xp / Math.max(1, xpToNext)) * 100));

  return (
    <div className="flex items-center gap-1.5 min-w-[90px] flex-1 max-w-[140px]">
      <div className="relative flex-1 h-[5px] rounded-full overflow-hidden bg-slate-200/80">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            background: burst
              ? 'linear-gradient(90deg,#F59E0B,#FCD34D)'
              : 'linear-gradient(90deg,#818CF8,#A78BFA)',
          }}
        />
        {burst && (
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: 'linear-gradient(90deg,#F59E0B44,#FCD34D88)' }}
          />
        )}
      </div>
      <span className="text-[9px] font-bold text-slate-400 tabular-nums whitespace-nowrap shrink-0">
        {xp}/{xpToNext}
      </span>
    </div>
  );
}

// ─── Catharsis burst banner ───────────────────────────────────────────────────

function BurstBanner({ onDismiss }: { onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const pet = usePetStore(s => s.pet);
  const actionLoading = usePetStore(s => s.actionLoading);
  const foods = usePetStore(s => s.foods);
  const feedPet = usePetStore(s => s.feedPet);
  const sleepPet = usePetStore(s => s.sleepPet);
  const bondWithPet = usePetStore(s => s.bondWithPet);

  const recoveryFood = foods.find(food => food.hungerRestore > 0) ?? foods[0] ?? null;
  const busy = Boolean(actionLoading);
  const asleep = Boolean(pet?.isAsleep);
  const canInteract = Boolean(pet) && !busy;
  const canSoftInteract = canInteract && !asleep;

  const burstActions = [
    {
      emoji: '👂',
      label: 'Выслушать',
      hint: 'Связь',
      disabled: !canSoftInteract,
      disabledReason: asleep ? 'Питомец спит' : busy ? 'Действие уже выполняется' : 'Питомец не загружен',
      run: () => bondWithPet('listen'),
    },
    {
      emoji: '💤',
      label: 'Дрёма',
      hint: 'Сон',
      disabled: !canSoftInteract,
      disabledReason: asleep ? 'Питомец уже спит' : busy ? 'Действие уже выполняется' : 'Питомец не загружен',
      run: () => sleepPet('nap'),
    },
    {
      emoji: recoveryFood?.emoji ?? '🍔',
      label: 'Покормить',
      hint: recoveryFood?.name ?? 'Еда',
      disabled: !canSoftInteract || !recoveryFood || (pet?.stats.hunger ?? 100) >= 95,
      disabledReason: !recoveryFood
        ? 'Еда не загружена'
        : (pet?.stats.hunger ?? 100) >= 95
          ? 'Питомец уже сыт'
          : asleep
            ? 'Питомец спит'
            : busy
              ? 'Действие уже выполняется'
              : 'Питомец не загружен',
      run: () => recoveryFood ? feedPet(recoveryFood.id) : Promise.resolve(),
    },
    {
      emoji: '🤗',
      label: 'Обнять',
      hint: 'Связь',
      disabled: !canSoftInteract,
      disabledReason: asleep ? 'Питомец спит' : busy ? 'Действие уже выполняется' : 'Питомец не загружен',
      run: () => bondWithPet('hug'),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: 'spring', damping: 24, stiffness: 300 }}
      className="w-full overflow-hidden"
      style={{
        background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
        borderBottom: '1px solid rgba(245,158,11,0.2)',
        boxShadow: '0 2px 12px rgba(245,158,11,0.1)',
      }}
    >
      {/* Always-visible row */}
      <div className="flex items-center gap-2.5 px-4 py-2">
        <motion.span
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 2 }}
          className="text-base leading-none shrink-0"
        >
          🌅
        </motion.span>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-amber-900 leading-tight">
            Питомец восстанавливается — это особый момент
          </p>
          <p className="text-[10px] text-amber-700 leading-tight mt-0.5">
            Мягкие действия сейчас работают в&nbsp;5&nbsp;раз сильнее обычного
          </p>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 text-[10px] font-bold text-amber-700 underline underline-offset-2 decoration-amber-400/60 whitespace-nowrap"
        >
          {expanded ? 'Скрыть' : 'Что делать?'}
        </button>

        <button
          onClick={onDismiss}
          className="shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-amber-400 hover:text-amber-600 hover:bg-amber-100 transition-colors text-[13px] font-bold leading-none"
          title="Закрыть"
        >
          ×
        </button>
      </div>

      {/* Expandable action guide */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="mx-4 mb-3 rounded-2xl p-3"
              style={{
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(245,158,11,0.18)',
              }}
            >
              <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-2">
                Выбирай эти действия
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {burstActions.map(a => (
                  <button
                    key={a.label}
                    type="button"
                    disabled={a.disabled}
                    onClick={() => { void a.run(); }}
                    title={a.disabled ? a.disabledReason : `${a.label}: мягкое действие восстановления`}
                    className="group flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl py-2 px-2 transition-all disabled:cursor-not-allowed disabled:opacity-45 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-amber-300"
                    style={{ background: 'rgba(245,158,11,0.08)' }}
                  >
                    <span className="text-xl leading-none transition-transform group-enabled:group-hover:scale-110">{a.emoji}</span>
                    <span className="text-[9px] font-bold text-amber-800 leading-tight text-center">{a.label}</span>
                    <span className="text-[8px] font-bold text-amber-600/75 leading-none text-center">{a.hint}</span>
                  </button>
                ))}
              </div>
              <p className="text-[9.5px] text-amber-600 leading-snug mt-2.5">
                Избегай интенсивных игр и прерывания сна — питомец ещё не окреп. Окно восстановления закроется само.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header() {
  const activeTab = usePetStore(s => s.activeTab);
  const pet = usePetStore(s => s.pet);
  const actionLoading = usePetStore(s => s.actionLoading);
  const updatePetName = usePetStore(s => s.updatePetName);

  const [burstDismissed, setBurstDismissed] = useState(false);

  const isHome = activeTab === 'home';
  const stageInfo = pet ? STAGE_INFO[pet.stage] : null;
  const burstActive =
    !burstDismissed &&
    Boolean(pet?.catharsisXpBurstExpiresAt && new Date(pet.catharsisXpBurstExpiresAt).getTime() > Date.now());

  return (
    <header
      className="sticky top-0 z-30 w-full"
      style={{
        background: 'rgba(248,250,252,0.82)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(226,232,240,0.6)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.6)',
      }}
    >
      {/* ── Main row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 md:px-5">

        {/* Logo mark (mobile) */}
        <div
          className="md:hidden shrink-0 h-8 w-8 rounded-xl flex items-center justify-center text-base"
          style={{
            background: 'linear-gradient(135deg,#7C3AED,#EC4899)',
            boxShadow: '0 3px 10px rgba(124,58,237,0.32)',
          }}
        >
          🫧
        </div>

        {/* Tab title */}
        <h1
          className="font-bold text-slate-800 text-sm leading-tight shrink-0"
          style={{ letterSpacing: '-0.01em' }}
        >
          {TAB_TITLES[activeTab]}
        </h1>

        {/* Pet status strip — only on Home */}
        <AnimatePresence initial={false}>
          {isHome && pet && stageInfo && (
            <motion.div
              key="pet-strip"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 min-w-0 overflow-hidden flex-1"
            >
              {/* Divider */}
              <div className="h-4 w-px bg-slate-200 shrink-0" />

              {/* Name */}
              <NameEditor
                name={pet.name}
                disabled={!!actionLoading}
                onSave={updatePetName}
              />

              {/* Stage + level badges */}
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none"
                  style={{
                    background: `${stageInfo.color}18`,
                    color: stageInfo.color,
                  }}
                >
                  {stageInfo.emoji} {stageInfo.label}
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 leading-none">
                  Ур.{pet.level}
                </span>
                <span className="hidden sm:inline text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 leading-none">
                  {Math.floor(pet.ageHours)}ч
                </span>
              </div>

              {/* XP bar */}
              <XpBar xp={pet.xp} xpToNext={pet.xpToNext} burst={burstActive} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* API toggle */}
        <div className="shrink-0">
          <ApiModeToggle />
        </div>
      </div>

      {/* ── Burst guidance banner (below main row) ───────────────────── */}
      <AnimatePresence>
        {isHome && burstActive && (
          <BurstBanner onDismiss={() => setBurstDismissed(true)} />
        )}
      </AnimatePresence>
    </header>
  );
}
