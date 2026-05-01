import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { usePetStore } from '../store/petStore';

export function QuestsPage() {
  const { quests, loadQuests, claimQuestReward, actionLoading } = usePetStore();

  useEffect(() => { loadQuests(); }, [loadQuests]);

  const active    = quests.filter(q => !q.claimed && !q.completed);
  const completed = quests.filter(q => q.completed && !q.claimed);
  const claimed   = quests.filter(q => q.claimed);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-lumio-text">🎯 Ежедневные задания</h1>
        <p className="text-sm text-lumio-muted">Обновляются каждый день. Выполняй и получай монеты!</p>
      </div>

      {completed.length > 0 && (
        <Section title="✅ Выполнено — забери награду!" accent="#10B981">
          {completed.map(q => (
            <QuestCard key={q.id} quest={q} onClaim={() => claimQuestReward(q.id)} isLoading={actionLoading === `cq_${q.id}`} />
          ))}
        </Section>
      )}

      {active.length > 0 && (
        <Section title="⏳ В прогрессе">
          {active.map(q => <QuestCard key={q.id} quest={q} />)}
        </Section>
      )}

      {claimed.length > 0 && (
        <Section title="🏁 Завершено сегодня">
          {claimed.map(q => <QuestCard key={q.id} quest={q} isDone />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div>
      <h2 className="font-display font-bold text-sm mb-2" style={{ color: accent ?? '#374151' }}>{title}</h2>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function QuestCard({ quest: q, onClaim, isLoading, isDone }: {
  quest: import('../api').DailyQuest;
  onClaim?: () => void;
  isLoading?: boolean;
  isDone?: boolean;
}) {
  const pct = Math.min((q.progress / q.target) * 100, 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{
        background: isDone ? 'rgba(209,250,229,0.5)' : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(8px)',
        border: isDone ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 4px 16px rgba(124,58,237,0.06)',
      }}
    >
      <div className="text-3xl shrink-0">{q.emoji}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-bold text-lumio-text text-sm">{q.name}</p>
          {isDone && <span className="text-xs text-emerald-600 font-bold">✓ Выполнено</span>}
        </div>
        <p className="text-xs text-lumio-muted mb-1.5">{q.description}</p>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
          <span className="text-xs font-semibold text-lumio-muted shrink-0">{q.progress}/{q.target}</span>
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs font-semibold text-amber-600">🪙 +{q.reward.coins}</span>
          <span className="text-xs font-semibold text-purple-600">⚡ +{q.reward.xp} XP</span>
        </div>
      </div>

      {q.completed && !q.claimed && onClaim && (
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={onClaim}
          disabled={isLoading}
          className="shrink-0 px-4 py-2 rounded-xl font-bold text-sm text-white"
          style={{ background: 'linear-gradient(135deg,#10B981,#059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
        >
          {isLoading ? '...' : 'Забрать!'}
        </motion.button>
      )}
    </motion.div>
  );
}
