import { motion } from 'framer-motion';
import { usePetStore } from '../../store/petStore';

export function QuickQuests() {
  const { quests, claimQuestReward, actionLoading, setActiveTab } = usePetStore();
  const active = quests.filter(q => !q.claimed).slice(0, 3);

  return (
    <div className="rounded-3xl p-4 glass">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-lumio-text text-sm">🎯 Квесты</h3>
        <button onClick={() => setActiveTab('quests')} className="text-xs text-indigo-500 font-semibold hover:text-indigo-700 transition-colors">
          Все →
        </button>
      </div>

      {active.length === 0 ? (
        <p className="text-xs text-lumio-muted text-center py-3">Все квесты выполнены! 🎉</p>
      ) : (
        <div className="space-y-2.5">
          {active.map(q => {
            const pct = Math.min((q.progress / q.target) * 100, 100);
            const canClaim = q.completed && !q.claimed;
            return (
              <motion.div key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{q.emoji}</span>
                    <span className="text-xs font-semibold text-lumio-text truncate max-w-[120px]">{q.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">{q.progress}/{q.target}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500"
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  {canClaim && (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => claimQuestReward(q.id)}
                      disabled={!!actionLoading}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}
                    >
                      +{q.reward.coins}🪙
                    </motion.button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
