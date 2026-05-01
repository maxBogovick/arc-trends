import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { usePetStore } from '../../store/petStore';

const MEDALS = ['🥇', '🥈', '🥉'];
const STAGE_EMOJI: Record<string, string> = {
  egg: '🥚', baby: '🌱', child: '🌿', teen: '🌲', adult: '🌳', elder: '🦋',
};

export function Leaderboard() {
  const { leaderboard, loadLeaderboard, pet } = usePetStore();

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  return (
    <div
      className="rounded-3xl p-5"
      style={{
        background: 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(124,58,237,0.10), inset 0 1px 0 rgba(255,255,255,0.8)',
        border: '1px solid rgba(255,255,255,0.7)',
      }}
    >
      <h3 className="font-display font-bold text-lumio-text text-sm mb-3">🏆 Рейтинг</h3>

      <div className="space-y-2">
        {leaderboard.slice(0, 7).map((entry, i) => {
          const isMe = pet && entry.petName === pet.name;
          return (
            <motion.div
              key={entry.rank}
              className="flex items-center gap-2.5 p-2.5 rounded-xl transition-all"
              style={{
                background: isMe
                  ? 'linear-gradient(135deg, #EDE9FE, #FCE7F3)'
                  : i % 2 === 0 ? 'rgba(249,250,251,0.8)' : 'transparent',
                border: isMe ? '1px solid rgba(124,58,237,0.2)' : '1px solid transparent',
              }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <span className="text-base w-6 text-center shrink-0">
                {i < 3 ? MEDALS[i] : <span className="text-xs text-gray-400 font-bold">{entry.rank}</span>}
              </span>
              <span className="text-sm shrink-0">{STAGE_EMOJI[entry.petStage] ?? '🐾'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-lumio-text truncate">
                  {entry.petName}
                  {isMe && <span className="ml-1 text-indigo-500">(ты)</span>}
                </p>
                <p className="text-xs text-gray-400">{entry.ownerName} · Ур.{entry.level}</p>
              </div>
              <span className="text-xs font-bold text-yellow-600 shrink-0">
                {(entry.score / 1000).toFixed(1)}k
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
