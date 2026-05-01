import { motion } from 'framer-motion';
import { usePetStore } from '../../store/petStore';
import { PetScene } from '../Pet/PetScene';
import { StatsPanel } from '../Stats/StatsPanel';
import { ActionPanel } from '../Actions/ActionPanel';
import { EventsLog } from './EventsLog';
import { QuickQuests } from './QuickQuests';

export function HomePage({ onPlayGame }: { onPlayGame: () => void }) {
  const { pet, isLoading } = usePetStore();

  if (isLoading && !pet) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            className="w-16 h-16 rounded-3xl"
            style={{ background: 'linear-gradient(135deg,#818CF8,#EC4899)' }}
            animate={{ scale: [1, 1.05, 1], rotate: [0, 3, -3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <p className="text-lumio-muted text-sm font-semibold">Загружаем питомца...</p>
        </div>
      </div>
    );
  }

  if (!pet) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-5 items-start">
      {/* Left column */}
      <div className="space-y-4">
        <StatsPanel />
        <EventsLog />
      </div>

      {/* Center — Pet */}
      <div className="flex flex-col items-center gap-4 lg:py-2">
        <PetScene />
        <ActionPanel onPlayGame={onPlayGame} />
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <QuickQuests />
        <TipCard />
      </div>
    </div>
  );
}

function TipCard() {
  const { pet } = usePetStore();
  if (!pet) return null;

  const tips = [
    pet.stats.hunger < 30      && '🍔 Питомец голоден — срочно покорми!',
    pet.stats.happiness < 30   && '😢 Питомец грустит — поиграй с ним!',
    pet.stats.energy < 20      && '⚡ Питомец устал — уложи спать!',
    pet.stats.health < 30      && '💊 Питомец болен — дай лекарство!',
    pet.stats.cleanliness < 25 && '🛁 Питомец грязный — помой его!',
    pet.stats.bond < 20        && '💜 Обними питомца — он скучает!',
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-3xl p-4 glass">
      <p className="font-bold text-lumio-text text-xs mb-1">💡 Совет</p>
      <p className="text-lumio-muted text-xs leading-relaxed">{tips[0] ?? '✨ Питомец в отличной форме!'}</p>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Параметры снижаются каждые 15 сек. Посещай магазин, выполняй квесты и зарабатывай монеты!
        </p>
      </div>
    </div>
  );
}
