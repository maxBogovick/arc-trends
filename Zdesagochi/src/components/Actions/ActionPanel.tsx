import { motion } from 'framer-motion';
import { useState } from 'react';
import { usePetStore } from '../../store/petStore';
import { FoodMenuWrapper } from './FoodMenu';
import type { Account, Pet } from '../../api';

interface ActionConfig {
  id: string;
  gradient: string;
  disabled?: (pet: Pet) => boolean;
  tooltip?: (pet: Pet) => string;
}

const ACTIONS: ActionConfig[] = [
  { id: 'feed',  gradient: 'from-amber-400 to-orange-400', disabled: (p) => p.isAsleep || p.stats.hunger > 90, tooltip: (p) => p.isAsleep ? 'Спит' : p.stats.hunger > 90 ? 'Сыт!' : '' },
  { id: 'play',  gradient: 'from-violet-400 to-purple-500', disabled: (p) => p.isAsleep || p.stats.energy < 10, tooltip: (p) => p.isAsleep ? 'Спит' : p.stats.energy < 10 ? 'Нет сил' : '' },
  { id: 'sleep', gradient: 'from-purple-400 to-indigo-500' },
  { id: 'bathe', gradient: 'from-blue-400 to-cyan-400', disabled: (p) => p.isAsleep || p.stats.cleanliness > 90, tooltip: (p) => p.isAsleep ? 'Спит' : p.stats.cleanliness > 90 ? 'Чистый!' : '' },
  { id: 'heal',  gradient: 'from-red-400 to-pink-400', disabled: (p) => p.stats.health > 85, tooltip: (p) => p.stats.health > 85 ? 'Здоров!' : '' },
  { id: 'bond',  gradient: 'from-pink-400 to-rose-400', disabled: (p) => p.isAsleep, tooltip: (p) => p.isAsleep ? 'Спит' : '' },
];

const ACTION_META: Record<string, { emoji: (p: Pet) => string; label: (p: Pet) => string }> = {
  feed:  { emoji: () => '🍔', label: () => 'Покормить' },
  play:  { emoji: () => '🎮', label: () => 'Играть' },
  sleep: { emoji: (p) => p.isAsleep ? '☀️' : '😴', label: (p) => p.isAsleep ? 'Разбудить' : 'Спать' },
  bathe: { emoji: () => '🛁', label: () => 'Помыть' },
  heal:  { emoji: () => '💊', label: () => 'Лечить' },
  bond:  { emoji: () => '🤗', label: () => 'Обнять' },
};

function getGuardianActionHint(pet: Pet, account: Account, actionId: string): string | null {
  const guardian = account.memoryGuardian;
  if (!guardian) return null;

  if (actionId === 'sleep' && pet.isAsleep) {
    return 'Хранитель помнит: сон лучше не прерывать раньше времени.';
  }

  if (actionId === 'sleep' && pet.confusedState) {
    return 'После насыщенного дня новая форма лучше восстановится во сне.';
  }

  if (actionId === 'bond' && (pet.traumaLevel >= 40 || pet.emergentState === 'shadow_form')) {
    return 'Мягкий контакт сейчас сильнее всего поддержит доверие.';
  }

  if (actionId === 'heal' && pet.emergentState === 'shadow_form') {
    return 'Лечение поможет, но Хранитель подсказывает не заменять им заботу.';
  }

  if (actionId === 'feed' && pet.stats.hunger < 25) {
    return 'Лучше кормить до сильного голода, чтобы тревога не закреплялась.';
  }

  if (actionId === 'play' && pet.stats.energy < 25) {
    return 'Игру лучше отложить, когда сил почти не осталось.';
  }

  return null;
}

function getGuardianPanelHint(pet: Pet, account: Account): string | null {
  const guardian = account.memoryGuardian;
  if (!guardian) return null;

  if (pet.emergentState === 'shadow_form') {
    return 'Хранитель памяти рядом: мягкие действия и доверие помогут пройти тень.';
  }

  if (pet.confusedState) {
    return 'Хранитель памяти подсказывает дать впечатлениям улечься через спокойный сон.';
  }

  if (pet.traumaLevel >= 40) {
    return 'Хранитель памяти замечает напряжение: сейчас лучше выбирать заботливые действия.';
  }

  return guardian.guidance[0] ?? null;
}

export function ActionPanel({ onPlayGame }: { onPlayGame: () => void }) {
  const { pet, account, sleepPet, wakePet, bathePet, healPet, bondWithPet, actionLoading } = usePetStore();
  const [showFood, setShowFood] = useState(false);
  const [gameMenu, setGameMenu] = useState(false);

  if (!pet) return null;
  const guardianHint = getGuardianPanelHint(pet, account);

  const handleAction = async (id: string) => {
    switch (id) {
      case 'feed':  return setShowFood(true);
      case 'play':  return setGameMenu(true);
      case 'sleep': return pet.isAsleep ? wakePet() : sleepPet();
      case 'bathe': return bathePet();
      case 'heal':  return healPet();
      case 'bond':  return bondWithPet();
    }
  };

  return (
    <div className="relative w-full">
      <FoodMenuWrapper show={showFood} onClose={() => setShowFood(false)} />

      {/* Game selector */}
      {gameMenu && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl backdrop-blur-sm" style={{ background: 'rgba(30,17,71,0.3)' }}>
          <div className="glass rounded-2xl p-5 flex flex-col gap-3 items-center" style={{ minWidth: 220 }}>
            <p className="font-bold text-lumio-text text-sm">Выбери игру</p>
            <button
              onClick={() => { setGameMenu(false); onPlayGame(); }}
              className="w-full py-2.5 rounded-xl font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)' }}>
              ⭐ Поймай звёзды
            </button>
            <button
              onClick={() => { setGameMenu(false); onPlayGame(); /* MemoryGame */ }}
              className="w-full py-2.5 rounded-xl font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg,#EC4899,#F43F5E)' }}>
              🧠 Игра «Память»
            </button>
            <button onClick={() => setGameMenu(false)} className="text-xs text-lumio-muted hover:text-lumio-text transition-colors">Отмена</button>
          </div>
        </div>
      )}

      <div className="rounded-3xl p-4 glass">
        <h3 className="font-display font-bold text-lumio-text text-sm mb-3">Действия</h3>
        {guardianHint && (
          <div className="mb-3 rounded-2xl px-3 py-2 bg-emerald-50/80 border border-emerald-100">
            <p className="text-[11px] font-semibold text-emerald-700">Хранитель памяти</p>
            <p className="text-[11px] text-emerald-700/85 leading-snug mt-0.5">{guardianHint}</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {ACTIONS.map(cfg => {
            const meta = ACTION_META[cfg.id];
            const emoji = meta.emoji(pet);
            const label = meta.label(pet);
            const isDisabled = (cfg.disabled?.(pet) ?? false) || !!actionLoading;
            const isActive = actionLoading === cfg.id || (cfg.id === 'sleep' && actionLoading === 'sleep');
            const actionHint = getGuardianActionHint(pet, account, cfg.id);
            const tooltip = actionHint ?? cfg.tooltip?.(pet) ?? '';

            return (
              <motion.button
                key={cfg.id}
                whileTap={{ scale: 0.9 }}
                whileHover={isDisabled ? {} : { scale: 1.03, y: -2 }}
                onClick={() => !isDisabled && handleAction(cfg.id)}
                disabled={isDisabled}
                title={tooltip}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all group relative overflow-hidden"
                style={{
                  background: isDisabled ? '#F3F4F6' : 'linear-gradient(135deg,#F5F3FF,#EDE9FE)',
                  boxShadow: isDisabled ? 'none' : '0 4px 12px rgba(124,58,237,0.10)',
                  opacity: isDisabled ? 0.5 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                {!isDisabled && (
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl bg-gradient-to-br ${cfg.gradient}`}
                    style={{ opacity: isActive ? 0.18 : undefined }} />
                )}
                <span className="text-2xl relative z-10">
                  {isActive ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}>⏳</motion.span> : emoji}
                </span>
                <span className="text-[11px] font-bold text-lumio-text relative z-10 leading-tight text-center">{label}</span>
                {actionHint && (
                  <span className="absolute right-1.5 top-1.5 z-10 h-2 w-2 rounded-full bg-emerald-400" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
