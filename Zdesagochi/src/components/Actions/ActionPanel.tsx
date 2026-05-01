import { motion } from 'framer-motion';
import { useState } from 'react';
import { usePetStore } from '../../store/petStore';
import { FoodMenuWrapper } from './FoodMenu';
import type { Pet } from '../../api';

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

export function ActionPanel({ onPlayGame }: { onPlayGame: () => void }) {
  const { pet, sleepPet, wakePet, bathePet, healPet, bondWithPet, actionLoading } = usePetStore();
  const [showFood, setShowFood] = useState(false);
  const [gameMenu, setGameMenu] = useState(false);

  if (!pet) return null;

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
        <div className="grid grid-cols-3 gap-2">
          {ACTIONS.map(cfg => {
            const meta = ACTION_META[cfg.id];
            const emoji = meta.emoji(pet);
            const label = meta.label(pet);
            const isDisabled = (cfg.disabled?.(pet) ?? false) || !!actionLoading;
            const isActive = actionLoading === cfg.id || (cfg.id === 'sleep' && actionLoading === 'sleep');
            const tooltip = cfg.tooltip?.(pet) ?? '';

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
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
