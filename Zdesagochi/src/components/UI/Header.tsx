import { ApiModeToggle } from './ApiModeToggle';
import { usePetStore, type TabId } from '../../store/petStore';

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

export function Header() {
  const activeTab = usePetStore(s => s.activeTab);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 md:px-6"
      style={{
        background: 'rgba(248,250,252,0.76)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,255,255,0.72)',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="md:hidden w-9 h-9 rounded-2xl flex items-center justify-center text-lg shrink-0"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}
        >
          🫧
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-lumio-muted leading-none">Режим данных</p>
          <h1 className="font-display font-bold text-lumio-text text-base leading-tight truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      <ApiModeToggle />
    </header>
  );
}
