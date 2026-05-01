import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { usePetStore } from '../store/petStore';
import type { Achievement } from '../api';

const CATEGORY_INFO: Record<Achievement['category'], { label: string; emoji: string; color: string }> = {
  care:     { label: 'Уход',      emoji: '💜', color: '#EC4899' },
  social:   { label: 'Социальное', emoji: '🤗', color: '#7C3AED' },
  play:     { label: 'Игры',      emoji: '🎮', color: '#8B5CF6' },
  progress: { label: 'Прогресс',  emoji: '📈', color: '#F59E0B' },
  shop:     { label: 'Магазин',   emoji: '🛒', color: '#10B981' },
};

type Filter = Achievement['category'] | 'all';

export function AchievementsPage() {
  const { achievements, loadAchievements, claimAchievement, actionLoading } = usePetStore();
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => { loadAchievements(); }, [loadAchievements]);

  const filtered = filter === 'all' ? achievements : achievements.filter(a => a.category === filter);

  const unlocked = achievements.filter(a => a.unlocked).length;
  const total    = achievements.length;

  const categories: { id: Filter; label: string; emoji: string }[] = [
    { id: 'all',      label: 'Все',       emoji: '🏆' },
    { id: 'care',     label: 'Уход',      emoji: '💜' },
    { id: 'social',   label: 'Социальное',emoji: '🤗' },
    { id: 'play',     label: 'Игры',      emoji: '🎮' },
    { id: 'progress', label: 'Прогресс',  emoji: '📈' },
    { id: 'shop',     label: 'Магазин',   emoji: '🛒' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-lumio-text">🏆 Достижения</h1>
          <p className="text-sm text-lumio-muted">Разблокировано {unlocked} из {total}</p>
        </div>
        {/* Progress ring */}
        <div className="relative w-14 h-14">
          <svg viewBox="0 0 56 56" className="rotate-[-90deg]">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#E5E7EB" strokeWidth="6" />
            <motion.circle
              cx="28" cy="28" r="22" fill="none"
              stroke="#7C3AED" strokeWidth="6"
              strokeDasharray={2 * Math.PI * 22}
              animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - unlocked / Math.max(total, 1)) }}
              transition={{ duration: 1, ease: 'easeOut' }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-bold text-xs text-lumio-purple">{Math.round(unlocked / Math.max(total, 1) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0"
            style={{
              background: filter === c.id ? 'linear-gradient(135deg,#7C3AED,#EC4899)' : 'rgba(255,255,255,0.8)',
              color: filter === c.id ? 'white' : '#6B7280',
              border: filter === c.id ? 'none' : '1px solid #E5E7EB',
            }}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((a, i) => (
          <AchievementCard
            key={a.id}
            achievement={a}
            index={i}
            onClaim={() => claimAchievement(a.id)}
            isLoading={actionLoading === `ca_${a.id}`}
          />
        ))}
      </div>
    </div>
  );
}

function AchievementCard({ achievement: a, index, onClaim, isLoading }: {
  achievement: Achievement;
  index: number;
  onClaim: () => void;
  isLoading: boolean;
}) {
  const pct = Math.min((a.progress / a.target) * 100, 100);
  const cat = CATEGORY_INFO[a.category];
  const canClaim = a.unlocked && !a.claimed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden"
      style={{
        background: a.unlocked ? 'rgba(255,255,255,0.9)' : 'rgba(249,250,251,0.8)',
        backdropFilter: 'blur(8px)',
        border: a.unlocked ? `1.5px solid ${cat.color}44` : '1px solid #E5E7EB',
        boxShadow: a.unlocked ? `0 4px 16px ${cat.color}22` : 'none',
        opacity: a.claimed ? 0.65 : 1,
      }}
    >
      {/* Icon */}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 relative"
        style={{ background: a.unlocked ? `${cat.color}18` : '#F3F4F6' }}
      >
        <span style={{ filter: a.unlocked ? 'none' : 'grayscale(1)' }}>{a.emoji}</span>
        {a.claimed && <span className="absolute -bottom-1 -right-1 text-sm">✅</span>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className={`font-bold text-sm ${a.unlocked ? 'text-lumio-text' : 'text-gray-400'}`}>{a.name}</p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${cat.color}18`, color: cat.color }}>
            {cat.emoji}
          </span>
        </div>
        <p className="text-xs text-lumio-muted mb-1.5 leading-tight">{a.description}</p>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: a.unlocked ? `linear-gradient(90deg, ${cat.color}99, ${cat.color})` : '#D1D5DB' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[10px] text-lumio-muted shrink-0">{a.progress}/{a.target}</span>
        </div>
      </div>

      {/* Claim button */}
      {canClaim && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClaim}
          disabled={isLoading}
          className="shrink-0 px-3 py-1.5 rounded-xl font-bold text-xs text-white"
          style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}CC)`, boxShadow: `0 4px 12px ${cat.color}44` }}
        >
          {isLoading ? '...' : `+${a.reward}🪙`}
        </motion.button>
      )}

      {/* Unlocked glow */}
      {a.unlocked && !a.claimed && (
        <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{ border: `1.5px solid ${cat.color}66` }} />
      )}
    </motion.div>
  );
}
