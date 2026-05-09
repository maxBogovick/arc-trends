import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePetStore } from './store/petStore';
import { Sidebar } from './components/Navigation/Sidebar';
import { Notifications } from './components/UI/Notifications';
import { HomePage } from './components/Home/HomePage';
import { MiniGame } from './components/Games/MiniGame';
import { MemoryGame } from './components/Games/MemoryGame';
import { ShopPage } from './pages/ShopPage';
import { InventoryPage } from './pages/InventoryPage';
import { QuestsPage } from './pages/QuestsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { SkinsPage } from './pages/SkinsPage';
import { PetEditorPage } from './pages/PetEditorPage';
import { RoomEditorPage } from './pages/RoomEditorPage';
import { PersonalityTestPage } from './pages/PersonalityTestPage';
type GameType = 'stars' | 'memory' | null;

const SYNC_MS = 15_000;

export default function App() {
  const { loadPet, loadFoods, loadCoins, loadAchievements, loadQuests, loadEvents, loadRooms, syncPet, activeTab } = usePetStore();
  const [game, setGame] = useState<GameType>(null);

  // Initial load
  useEffect(() => {
    loadPet();
    loadFoods();
    loadCoins();
    loadAchievements();
    loadQuests();
    loadEvents();
    loadRooms();
  }, [loadPet, loadFoods, loadCoins, loadAchievements, loadQuests, loadEvents, loadRooms]);

  // Auto-sync pet stats
  useEffect(() => {
    const t = setInterval(() => syncPet(), SYNC_MS);
    return () => clearInterval(t);
  }, [syncPet]);

  const handlePlayGame = (type: GameType) => setGame(type);

  return (
    <div className="min-h-dvh flex font-body">
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-h-dvh pb-24 md:pb-0">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'home'         && <HomePage onPlayGame={() => handlePlayGame('stars')} />}
              {activeTab === 'shop'         && <ShopPage />}
              {activeTab === 'skins'        && <SkinsPage />}
              {activeTab === 'inventory'    && <InventoryPage />}
              {activeTab === 'quests'       && <QuestsPage />}
              {activeTab === 'achievements' && <AchievementsPage />}
              {activeTab === 'leaderboard'  && <LeaderboardPage />}
              {activeTab === 'personality_test' && <PersonalityTestPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Game overlays */}
      <AnimatePresence>
        {game === 'stars'  && <MiniGame    onClose={() => setGame(null)} />}
        {game === 'memory' && <MemoryGame  onClose={() => setGame(null)} />}
      </AnimatePresence>

      {/* Full-screen pet editor */}
      <AnimatePresence>
        {activeTab === 'editor' && <PetEditorPage />}
      </AnimatePresence>

      {/* Full-screen room editor */}
      <AnimatePresence>
        {activeTab === 'room' && <RoomEditorPage key="room-editor" />}
      </AnimatePresence>

      <Notifications />
    </div>
  );
}
