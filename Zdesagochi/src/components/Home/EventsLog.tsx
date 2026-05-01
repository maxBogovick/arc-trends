import { motion } from 'framer-motion';
import { usePetStore } from '../../store/petStore';

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
  return `${Math.floor(diff / 3600)}ч назад`;
}

const EVENT_COLORS: Record<string, string> = {
  feed:    '#F59E0B', play:    '#8B5CF6', sleep:   '#7C3AED',
  wake:    '#3B82F6', bathe:   '#06B6D4', heal:    '#EF4444',
  bond:    '#EC4899', levelup: '#F59E0B', evolve:  '#10B981',
  buy:     '#6366F1', quest:   '#14B8A6', achieve: '#F97316',
};

export function EventsLog() {
  const { events } = usePetStore();

  return (
    <div className="rounded-3xl p-4 glass">
      <h3 className="font-display font-bold text-lumio-text text-sm mb-3">📜 Журнал событий</h3>
      {events.length === 0 ? (
        <p className="text-xs text-lumio-muted text-center py-4">Пока событий нет. Начни ухаживать!</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {events.slice(0, 12).map((evt, i) => (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start gap-2.5"
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5"
                style={{ background: `${EVENT_COLORS[evt.type] ?? '#6B7280'}18` }}
              >
                {evt.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-lumio-text font-medium leading-tight">{evt.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400">{timeAgo(evt.timestamp)}</span>
                  {evt.xpGained && <span className="text-[10px] text-purple-500 font-semibold">+{evt.xpGained} XP</span>}
                  {evt.coinsGained && evt.coinsGained > 0 && <span className="text-[10px] text-amber-500 font-semibold">+{evt.coinsGained} 🪙</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
