import { motion } from 'framer-motion';
import { usePetStore, type TabId } from '../../store/petStore';
import { ApiModeToggle } from '../UI/ApiModeToggle';

interface NavItem {
  id: TabId;
  emoji: string;
  label: string;
  badge?: () => number;
}

const ITEMS: NavItem[] = [
  { id: 'home',         emoji: '🏠', label: 'Главная' },
  { id: 'shop',         emoji: '🛒', label: 'Магазин' },
  { id: 'skins',        emoji: '🎨', label: 'Скины' },
  { id: 'room',         emoji: '🛋️', label: 'Комната' },
  { id: 'inventory',    emoji: '🎒', label: 'Рюкзак' },
  { id: 'quests',       emoji: '🎯', label: 'Задания' },
  { id: 'achievements', emoji: '🏆', label: 'Достижения' },
  { id: 'leaderboard',  emoji: '📊', label: 'Рейтинг' },
];

export function Sidebar() {
  const { activeTab, setActiveTab, coins, unclaimedAchievements, completedUnclaimedQuests } = usePetStore();

  const badges: Partial<Record<TabId, number>> = {
    achievements: unclaimedAchievements(),
    quests:       completedUnclaimedQuests(),
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-56 h-screen sticky top-0 shrink-0 p-4 gap-2"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          borderRight: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '2px 0 20px rgba(124,58,237,0.06)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 py-4 mb-2">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}
          >
            🫧
          </div>
          <div>
            <p className="font-display font-bold text-lumio-text text-base leading-none">Lumio</p>
            <p className="text-[10px] text-lumio-muted mt-0.5">Digital Companion</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1">
          {ITEMS.map(item => {
            const isActive = activeTab === item.id;
            const badge = badges[item.id] ?? 0;
            return (
              <motion.button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all relative group"
                style={{
                  background: isActive ? 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.08))' : 'transparent',
                  color: isActive ? '#7C3AED' : '#6B7280',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(236,72,153,0.06))', border: '1px solid rgba(124,58,237,0.15)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <span className="text-lg relative z-10">{item.emoji}</span>
                <span className={`font-semibold text-sm relative z-10 ${isActive ? 'text-lumio-purple' : 'text-lumio-muted group-hover:text-lumio-text'} transition-colors`}>
                  {item.label}
                </span>
                {badge > 0 && (
                  <motion.span
                    className="ml-auto relative z-10 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                    style={{ background: '#EF4444' }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                  >
                    {badge}
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Editor CTA */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setActiveTab('editor')}
          className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-left transition-all w-full mb-1"
          style={{
            background: activeTab === 'editor'
              ? 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(236,72,153,0.15))'
              : 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(236,72,153,0.06))',
            border: activeTab === 'editor'
              ? '1.5px solid rgba(124,58,237,0.5)'
              : '1px solid rgba(124,58,237,0.2)',
          }}
        >
          <span className="text-lg">✏️</span>
          <span className="font-semibold text-sm text-purple-700">Редактор</span>
        </motion.button>

        {/* Coins */}
        <div
          className="px-3 py-3 rounded-2xl mb-2"
          style={{ background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <p className="text-xs text-amber-700 font-semibold mb-0.5">Монеты</p>
          <p className="font-display font-bold text-amber-900 text-xl">🪙 {coins.toLocaleString()}</p>
        </div>

        {/* API Toggle */}
        <ApiModeToggle compact />
      </aside>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 safe-bottom"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255,255,255,0.7)',
          boxShadow: '0 -4px 24px rgba(124,58,237,0.1)',
        }}
      >
        {ITEMS.map(item => {
          const isActive = activeTab === item.id;
          const badge = badges[item.id] ?? 0;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl relative"
            >
              {isActive && (
                <motion.div layoutId="mobile-active" className="absolute inset-0 rounded-xl bg-indigo-50" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
              )}
              <span className="text-xl relative z-10">{item.emoji}</span>
              <span className={`text-[9px] font-semibold relative z-10 ${isActive ? 'text-lumio-purple' : 'text-gray-400'}`}>{item.label}</span>
              {badge > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{badge}</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setActiveTab('editor')}
          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl relative"
        >
          {activeTab === 'editor' && (
            <motion.div layoutId="mobile-active" className="absolute inset-0 rounded-xl bg-purple-50" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
          )}
          <span className="text-xl relative z-10">✏️</span>
          <span className={`text-[9px] font-semibold relative z-10 ${activeTab === 'editor' ? 'text-lumio-purple' : 'text-gray-400'}`}>Редактор</span>
        </button>
      </nav>
    </>
  );
}
