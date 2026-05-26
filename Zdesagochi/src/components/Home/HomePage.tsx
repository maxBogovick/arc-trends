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
import {
  bestFoodForPet,
  isPetActionDisabled,
  runSupportedPetAction,
} from '../Actions/petActionControls';
import type { SupportedPetActionId } from '../../personality/petActionIds';
import type { ActivityTarget } from '../../personality/timeOfDayActivities';
import type { ProactivePetSuggestion } from '../../personality/proactiveSuggestions';
import { recordActivityCompletion } from '../../personality/proactiveSuggestionState';

export function HomePage({ onPlayGame }: { onPlayGame: () => void }) {
  const {
    pet,
    isLoading,
    foods,
    inventory,
    rooms,
    feedPet,
    playWithPet,
    sleepPet,
    wakePet,
    bathePet,
    healPet,
    bondWithPet,
    useInventoryItem,
    equipRoom,
    setActiveTab,
    notify,
  } = usePetStore();

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

  const canRunSuggestionAction = (actionId: SupportedPetActionId) => {
    const food = bestFoodForPet(pet, foods);
    return !isPetActionDisabled(actionId, pet, food);
  };

  const handleSuggestionAction = async (actionId: SupportedPetActionId) => {
    await runSupportedPetAction(actionId, {
      pet,
      foods,
      onPlayGame,
      feedPet,
      playWithPet,
      sleepPet,
      wakePet,
      bathePet,
      healPet,
      bondWithPet,
      notify,
    });
    if (typeof window !== 'undefined') {
      recordActivityCompletion(window.localStorage, { kind: 'action', actionId }, new Date());
    }
  };

  const handleSuggestionTarget = async (target: ActivityTarget, _suggestion: ProactivePetSuggestion) => {
    switch (target.kind) {
      case 'inventory_item': {
        if (target.itemId && inventory.some(entry => entry.itemId === target.itemId && entry.quantity > 0)) {
          await useInventoryItem(target.itemId);
          if (typeof window !== 'undefined') {
            recordActivityCompletion(window.localStorage, { kind: 'inventory_item', itemId: target.itemId }, new Date());
          }
          return;
        }
        setActiveTab('inventory');
        break;
      }
      case 'room': {
        const room = target.roomId ? rooms.find(item => item.id === target.roomId && item.unlocked) : null;
        if (room) {
          await equipRoom(room.id);
          if (typeof window !== 'undefined') {
            recordActivityCompletion(window.localStorage, { kind: 'room_equipped', roomId: room.id }, new Date());
          }
          return;
        }
        setActiveTab('room');
        break;
      }
      case 'deep_link': {
        if (target.destination === 'inventory') setActiveTab('inventory');
        if (target.destination === 'shop') setActiveTab('shop');
        if (target.destination === 'room') setActiveTab('room');
        if (target.destination === 'assistant') {
          setActiveTab('personality_assistant');
          if (typeof window !== 'undefined') {
            recordActivityCompletion(window.localStorage, { kind: 'assistant_viewed' }, new Date());
          }
        }
        break;
      }
      case 'future_command':
        notify('Эта активность ещё готовится', 'info');
        break;
      case 'action':
        await handleSuggestionAction(target.actionId);
        break;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-5 items-start">
      {/* Left column */}
      <div className="space-y-4">
        <StatsPanel />
        <EventsLog />
      </div>

      {/* Center — Pet */}
      <div className="flex flex-col items-center gap-4 lg:py-2">
        <PetScene
          actionPanel={<ActionPanel onPlayGame={onPlayGame} />}
          canRunSuggestionAction={canRunSuggestionAction}
          onSuggestionAction={handleSuggestionAction}
          onSuggestionTarget={handleSuggestionTarget}
        />
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
