import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [open, setOpen] = useState(false);
  const latest = events[0] ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-3xl p-3 glass text-left hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-9 w-9 rounded-2xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
              {latest?.emoji ?? '📜'}
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold text-lumio-text text-sm">Журнал</p>
              <p className="text-[11px] text-lumio-muted truncate">
                {latest ? `${latest.description} · ${timeAgo(latest.timestamp)}` : 'Пока событий нет'}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-lumio-purple bg-violet-50 px-2 py-1 rounded-full shrink-0">
            {events.length}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="events-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
            style={{ background: 'rgba(30,17,71,0.24)', backdropFilter: 'blur(8px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              key="events-drawer"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-[420px] rounded-3xl bg-white/95 p-4 shadow-2xl border border-white/80"
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-lumio-text text-base">Журнал событий</h3>
                  <p className="text-[11px] text-lumio-muted">Последние действия и награды</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 w-9 rounded-2xl bg-slate-100 text-slate-500 font-bold"
                  title="Закрыть"
                >
                  ×
                </button>
              </div>

              {events.length === 0 ? (
                <p className="text-xs text-lumio-muted text-center py-8">Пока событий нет. Начни ухаживать!</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {events.slice(0, 30).map((evt, i) => (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.015 }}
                      className="flex items-start gap-2.5 rounded-2xl bg-slate-50/80 px-2.5 py-2"
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5"
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
