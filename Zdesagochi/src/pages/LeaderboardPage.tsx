import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { usePetStore } from '../store/petStore';

const MEDALS = ['🥇', '🥈', '🥉'];
const STAGE_EMOJI: Record<string, string> = { egg: '🥚', baby: '🌱', child: '🌿', teen: '🌲', adult: '🌳', elder: '🦋' };

export function LeaderboardPage() {
  const { leaderboard, loadLeaderboard, pet } = usePetStore();

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl text-lumio-text">📊 Рейтинг игроков</h1>
        <p className="text-sm text-lumio-muted">Соревнуйся с другими владельцами питомцев</p>
      </div>

      <div
        className="rounded-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 8px 32px rgba(124,58,237,0.08)' }}
      >
        {/* Top 3 podium */}
        {leaderboard.length >= 3 && (
          <div
            className="p-6"
            style={{ background: 'linear-gradient(135deg,#1E1B4B,#312E81,#4C1D95)' }}
          >
            <div className="flex items-end justify-center gap-4">
              {[1, 0, 2].map(idx => {
                const e = leaderboard[idx];
                const heights = ['h-24', 'h-32', 'h-20'];
                return (
                  <motion.div
                    key={idx}
                    className="flex flex-col items-center gap-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <span className="text-2xl">{STAGE_EMOJI[e.petStage] ?? '🐾'}</span>
                    <p className="text-white font-bold text-xs text-center">{e.petName}</p>
                    <p className="text-purple-300 text-[10px]">{e.ownerName}</p>
                    <div
                      className={`${heights[[1,0,2].indexOf(idx)]} w-16 rounded-t-2xl flex flex-col items-center justify-end pb-2`}
                      style={{ background: idx === 0 ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.12)' }}
                    >
                      <span className="text-2xl">{MEDALS[[1,0,2].indexOf(idx)]}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full list */}
        <div className="divide-y divide-gray-100">
          {leaderboard.map((entry, i) => {
            const isMe = pet && entry.petName === pet.name;
            return (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-5 py-3"
                style={{ background: isMe ? 'rgba(124,58,237,0.05)' : 'transparent' }}
              >
                <span className="w-7 text-center text-base shrink-0">
                  {i < 3 ? MEDALS[i] : <span className="text-xs text-gray-400 font-bold">{entry.rank}</span>}
                </span>
                <span className="text-xl shrink-0">{STAGE_EMOJI[entry.petStage] ?? '🐾'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-lumio-text">
                    {entry.petName}
                    {isMe && <span className="ml-1.5 text-indigo-500 text-xs">(это ты!)</span>}
                  </p>
                  <p className="text-xs text-lumio-muted">{entry.ownerName} · Уровень {entry.level}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-amber-600">{(entry.score / 1000).toFixed(1)}k</p>
                  <p className="text-[10px] text-gray-400">очков</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
