import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { usePetStore } from '../../store/petStore';
import { FoodMenuWrapper } from './FoodMenu';
import type { Account, Pet } from '../../api';
import { getActionTrainingHint, getRecommendedPetActions, type ActionRecommendation } from '../../personality/guidanceSelectors';

type ActionIntent = 'care' | 'play' | 'bond' | 'routine';

interface ActionConfig {
  id: string;
  intent: ActionIntent;
  gradient: string;
  disabled?: (pet: Pet) => boolean;
  tooltip?: (pet: Pet) => string;
}

const ACTIONS: ActionConfig[] = [
  { id: 'feed', intent: 'care', gradient: 'from-amber-400 to-orange-400', disabled: (p) => p.isAsleep || p.stats.hunger > 90, tooltip: (p) => p.isAsleep ? 'Спит' : p.stats.hunger > 90 ? 'Сыт!' : '' },
  { id: 'bathe', intent: 'care', gradient: 'from-blue-400 to-cyan-400', disabled: (p) => p.isAsleep || p.stats.cleanliness > 90, tooltip: (p) => p.isAsleep ? 'Спит' : p.stats.cleanliness > 90 ? 'Чистый!' : '' },
  {
    id: 'heal',
    intent: 'care',
    gradient: 'from-red-400 to-pink-400',
    disabled: (p) => p.isAsleep || (p.stats.health > 85 && p.traumaLevel < 40 && p.emergentState !== 'shadow_form'),
    tooltip: (p) => p.isAsleep ? 'Спит' : p.stats.health > 85 && p.traumaLevel < 40 && p.emergentState !== 'shadow_form' ? 'Здоров!' : '',
  },
  { id: 'play', intent: 'play', gradient: 'from-violet-400 to-purple-500', disabled: (p) => p.isAsleep || p.stats.energy < 10, tooltip: (p) => p.isAsleep ? 'Спит' : p.stats.energy < 10 ? 'Нет сил' : '' },
  { id: 'play_puzzle', intent: 'play', gradient: 'from-indigo-400 to-sky-500', disabled: (p) => p.isAsleep || p.stats.energy < 8, tooltip: (p) => p.isAsleep ? 'Спит' : p.stats.energy < 8 ? 'Нет сил' : 'Тренирует любопытство и порядок' },
  { id: 'play_social', intent: 'play', gradient: 'from-cyan-400 to-emerald-500', disabled: (p) => p.isAsleep || p.stats.energy < 10, tooltip: (p) => p.isAsleep ? 'Спит' : p.stats.energy < 10 ? 'Нет сил' : 'Тренирует социальность через игру' },
  { id: 'bond', intent: 'bond', gradient: 'from-pink-400 to-rose-400', disabled: (p) => p.isAsleep, tooltip: (p) => p.isAsleep ? 'Спит' : '' },
  { id: 'bond_listen', intent: 'bond', gradient: 'from-emerald-400 to-teal-500', disabled: (p) => p.isAsleep, tooltip: (p) => p.isAsleep ? 'Спит' : 'Снижает тревожность и учит восстановлению' },
  { id: 'bond_praise', intent: 'bond', gradient: 'from-yellow-300 to-amber-400', disabled: (p) => p.isAsleep, tooltip: (p) => p.isAsleep ? 'Спит' : 'Учит уверенности и теплому контакту' },
  { id: 'sleep', intent: 'routine', gradient: 'from-purple-400 to-indigo-500' },
  { id: 'sleep_nap', intent: 'routine', gradient: 'from-sky-300 to-blue-400', disabled: (p) => p.isAsleep, tooltip: (p) => p.isAsleep ? 'Уже спит' : 'Короткое восстановление без сильного ухода в режим' },
  { id: 'sleep_ritual', intent: 'routine', gradient: 'from-slate-400 to-violet-500', disabled: (p) => p.isAsleep, tooltip: (p) => p.isAsleep ? 'Уже спит' : 'Укрепляет режим и восстановление' },
];

const ACTION_BY_ID = new Map(ACTIONS.map(action => [action.id, action]));

const ACTION_GROUPS: Array<{ id: ActionIntent; title: string; ids: string[] }> = [
  { id: 'care', title: 'Care', ids: ['feed', 'bathe', 'heal'] },
  { id: 'play', title: 'Play', ids: ['play', 'play_puzzle', 'play_social'] },
  { id: 'bond', title: 'Bond', ids: ['bond', 'bond_listen', 'bond_praise'] },
  { id: 'routine', title: 'Routine', ids: ['sleep', 'sleep_nap', 'sleep_ritual'] },
];

const ACTION_META: Record<string, { emoji: (p: Pet) => string; label: (p: Pet) => string }> = {
  feed:  { emoji: () => '🍔', label: () => 'Покормить' },
  play:  { emoji: () => '🎮', label: () => 'Играть' },
  play_puzzle:  { emoji: () => '🧩', label: () => 'Головоломка' },
  play_social:  { emoji: () => '🫶', label: () => 'Вместе' },
  sleep: { emoji: (p) => p.isAsleep ? '☀️' : '😴', label: (p) => p.isAsleep ? 'Разбудить' : 'Спать' },
  sleep_nap: { emoji: () => '💤', label: () => 'Дрёма' },
  sleep_ritual: { emoji: () => '🌙', label: () => 'Ритуал сна' },
  bathe: { emoji: () => '🛁', label: () => 'Помыть' },
  heal:  { emoji: () => '💊', label: () => 'Лечить' },
  bond:  { emoji: () => '🤗', label: () => 'Обнять' },
  bond_listen:  { emoji: () => '👂', label: () => 'Выслушать' },
  bond_praise:  { emoji: () => '✨', label: () => 'Похвала' },
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

  return getActionTrainingHint(actionId);
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
  const { pet, account, playWithPet, sleepPet, wakePet, bathePet, healPet, bondWithPet, setActiveTab, actionLoading } = usePetStore();
  const [showFood, setShowFood] = useState(false);
  const [gameMenu, setGameMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!pet) return null;
  const guardianHint = getGuardianPanelHint(pet, account);
  const recommendations = getRecommendedPetActions(pet).filter(item => ACTION_BY_ID.has(item.actionId));
  const recommendationById = new Map(recommendations.map(item => [item.actionId, item]));

  const handleAction = async (id: string) => {
    switch (id) {
      case 'feed':  return setShowFood(true);
      case 'play':  return setGameMenu(true);
      case 'play_puzzle': return playWithPet('puzzle');
      case 'play_social': return playWithPet('social');
      case 'sleep': return pet.isAsleep ? wakePet('gentle') : sleepPet();
      case 'sleep_nap': return sleepPet('nap');
      case 'sleep_ritual': return sleepPet('ritual');
      case 'bathe': return bathePet();
      case 'heal':  return healPet();
      case 'bond':  return bondWithPet();
      case 'bond_listen': return bondWithPet('listen');
      case 'bond_praise': return bondWithPet('praise');
    }
  };

  const renderActionButton = (cfg: ActionConfig, recommendation?: ActionRecommendation, compact = false) => {
    const meta = ACTION_META[cfg.id];
    const emoji = meta.emoji(pet);
    const label = meta.label(pet);
    const isDisabled = (cfg.disabled?.(pet) ?? false) || !!actionLoading;
    const isActive = actionLoading === cfg.id
      || (cfg.id.startsWith('sleep') && actionLoading === 'sleep')
      || (cfg.id.startsWith('bond') && actionLoading === 'bond');
    const actionHint = getGuardianActionHint(pet, account, cfg.id);
    const tooltip = recommendation?.reason ?? actionHint ?? cfg.tooltip?.(pet) ?? '';

    return (
      <motion.button
        key={cfg.id}
        whileTap={{ scale: 0.96 }}
        whileHover={isDisabled ? {} : { scale: 1.02, y: -1 }}
        onClick={() => !isDisabled && handleAction(cfg.id)}
        disabled={isDisabled}
        title={tooltip}
        className={`relative overflow-hidden rounded-2xl transition-all group ${compact ? 'min-h-[76px] p-2.5' : 'min-h-[92px] p-3'} flex flex-col items-center justify-center gap-1.5`}
        style={{
          background: isDisabled ? '#F3F4F6' : recommendation ? '#F0FDF4' : 'linear-gradient(135deg,#F8FAFC,#F1F5F9)',
          border: recommendation ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(148,163,184,0.18)',
          boxShadow: isDisabled ? 'none' : recommendation ? '0 5px 16px rgba(16,185,129,0.12)' : '0 3px 10px rgba(15,23,42,0.06)',
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {!isDisabled && (
          <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl bg-gradient-to-br ${cfg.gradient}`}
            style={{ opacity: isActive ? 0.18 : undefined }} />
        )}
        <span className={`${compact ? 'text-xl' : 'text-2xl'} relative z-10`}>
          {isActive ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}>⏳</motion.span> : emoji}
        </span>
        <span className="text-[11px] font-bold text-lumio-text relative z-10 leading-tight text-center">{label}</span>
        {recommendation && !compact && (
          <span className="text-[10px] text-emerald-700/85 relative z-10 leading-tight text-center line-clamp-2">{recommendation.reason}</span>
        )}
        {(recommendation || actionHint) && (
          <span className="absolute right-1.5 top-1.5 z-10 h-2 w-2 rounded-full bg-emerald-400" />
        )}
      </motion.button>
    );
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
              onClick={() => { setGameMenu(false); playWithPet('puzzle'); }}
              className="w-full py-2.5 rounded-xl font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg,#EC4899,#F43F5E)' }}>
              🧩 Головоломка
            </button>
            <button
              onClick={() => { setGameMenu(false); playWithPet('social'); }}
              className="w-full py-2.5 rounded-xl font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg,#06B6D4,#10B981)' }}>
              🫶 Совместная игра
            </button>
            <button onClick={() => setGameMenu(false)} className="text-xs text-lumio-muted hover:text-lumio-text transition-colors">Отмена</button>
          </div>
        </div>
      )}

      <div className="rounded-3xl p-4 glass">
        <button
          onClick={() => {
            setCollapsed(v => !v);
            setShowFood(false);
            setGameMenu(false);
          }}
          className="w-full flex items-center justify-between"
        >
          <h3 className="font-display font-bold text-lumio-text text-sm">Действия</h3>
          <span className="text-xs text-gray-400">{collapsed ? '▼' : '▲'} {recommendations.length}/{ACTIONS.length}</span>
        </button>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="actions-body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="pt-3">
                {guardianHint && (
                  <div className="mb-3 rounded-2xl px-3 py-2 bg-emerald-50/80 border border-emerald-100">
                    <p className="text-[11px] font-semibold text-emerald-700">Хранитель памяти</p>
                    <p className="text-[11px] text-emerald-700/85 leading-snug mt-0.5">{guardianHint}</p>
                  </div>
                )}
                <div className="space-y-3">
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Рекомендуем</p>
                      <p className="text-[10px] text-lumio-muted">по состоянию и engine evidence</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {recommendations.slice(0, 5).map(item => {
                        const cfg = ACTION_BY_ID.get(item.actionId);
                        return cfg ? renderActionButton(cfg, item) : null;
                      })}
                    </div>
                  </section>

                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="w-full rounded-2xl px-3 py-2 text-xs font-bold text-lumio-purple bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-colors"
                  >
                    {showAll ? 'Скрыть полный список' : 'Показать все действия'}
                  </button>

                  <AnimatePresence initial={false}>
                    {showAll && (
                      <motion.div
                        key="all-actions"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.16 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 pt-1">
                          {ACTION_GROUPS.map(group => (
                            <section key={group.id}>
                              <p className="mb-1.5 text-[11px] font-bold text-lumio-muted">{group.title}</p>
                              <div className="grid grid-cols-3 gap-2">
                                {group.ids.map(id => {
                                  const cfg = ACTION_BY_ID.get(id);
                                  return cfg ? renderActionButton(cfg, recommendationById.get(id), true) : null;
                                })}
                              </div>
                            </section>
                          ))}

                          <section>
                            <p className="mb-1.5 text-[11px] font-bold text-lumio-muted">Items</p>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveTab('inventory')}
                                className="min-h-[64px] rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-center text-xs font-bold text-lumio-text hover:bg-slate-100 transition-colors"
                                title={getActionTrainingHint('use_item')}
                              >
                                <span className="block text-xl mb-1">🎒</span>
                                Инвентарь
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveTab('shop')}
                                className="min-h-[64px] rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-center text-xs font-bold text-lumio-text hover:bg-slate-100 transition-colors"
                                title={getActionTrainingHint('add_item')}
                              >
                                <span className="block text-xl mb-1">🛍️</span>
                                Магазин
                              </button>
                            </div>
                          </section>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
