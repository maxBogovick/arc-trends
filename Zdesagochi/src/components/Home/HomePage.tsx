import { motion } from 'framer-motion';
import { usePetStore } from '../../store/petStore';
import { PetScene } from '../Pet/PetScene';
import { StatsPanel } from '../Stats/StatsPanel';
import { ActionPanel } from '../Actions/ActionPanel';
import { EventsLog } from './EventsLog';
import { QuickQuests } from './QuickQuests';
import { EmergentStateBanner } from '../personality/EmergentStateBanner';
import { MoodGraph } from '../personality/MoodGraph';
import { PersonalityCard } from '../personality/PersonalityCard';
import { EvolutionInspector } from '../personality/EvolutionInspector';
import { CoreMemoriesPanel } from '../personality/CoreMemoriesPanel';

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
        <PetScene actionPanel={<ActionPanel onPlayGame={onPlayGame} />} />
        <EmergentStateBanner />
        <div className="w-full" style={{ maxWidth: '520px' }}>
          <CoreMemoriesPanel />
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <PersonalityCard />
        <EvolutionInspector />
        <MoodGraph />
        <QuickQuests />
      </div>
    </div>
  );
}
