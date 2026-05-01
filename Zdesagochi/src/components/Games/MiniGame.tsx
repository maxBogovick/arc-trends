import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePetStore } from '../../store/petStore';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  emoji: string;
}

const EMOJIS = ['⭐', '🌟', '✨', '💫', '🌠'];
const GAME_DURATION = 30;

let starId = 0;

export function MiniGame({ onClose }: { onClose: () => void }) {
  const { playWithPet } = usePetStore();
  type PlayResult = { score: number; xpGained: number; coinsGained: number; message: string };
  const [lastResult, setLastResult] = useState<PlayResult | null>(null);
  const [phase, setPhase] = useState<'intro' | 'playing' | 'result'>('intro');
  const [stars, setStars] = useState<Star[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [caught, setCaught] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopGame = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
  }, []);

  const endGame = useCallback(async () => {
    stopGame();
    setPhase('result');
    const r = await playWithPet();
    if (r) setLastResult(r);
  }, [stopGame, playWithPet]);

  useEffect(() => {
    if (phase !== 'playing') return;

    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    spawnRef.current = setInterval(() => {
      const newStar: Star = {
        id: ++starId,
        x: 5 + Math.random() * 85,
        y: 5 + Math.random() * 75,
        size: 24 + Math.floor(Math.random() * 20),
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      };
      setStars(s => [...s.slice(-15), newStar]);
    }, 800);

    return () => stopGame();
  }, [phase, endGame, stopGame]);

  const catchStar = (id: number, points: number) => {
    setCaught(c => [...c, id]);
    setScore(s => s + points);
    setTimeout(() => {
      setStars(s => s.filter(st => st.id !== id));
      setCaught(c => c.filter(cid => cid !== id));
    }, 300);
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setStars([]);
    setPhase('playing');
  };

  const timerColor = timeLeft > 15 ? '#10B981' : timeLeft > 7 ? '#F59E0B' : '#EF4444';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(30,17,71,0.6)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4C1D95 100%)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(167,139,250,0.2)',
          minHeight: 480,
        }}
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 40 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Поймай звёзды!</h2>
            {phase === 'playing' && (
              <p className="text-purple-300 text-xs">Кликай на звёзды как можно быстрее</p>
            )}
          </div>
          <button
            onClick={() => { stopGame(); onClose(); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >✕</button>
        </div>

        {/* Game area */}
        <div
          className="relative mx-4 mb-4 rounded-2xl overflow-hidden select-none"
          style={{ height: 320, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.15)' }}
        >
          {phase === 'intro' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <motion.span className="text-6xl" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                ⭐
              </motion.span>
              <p className="text-white/80 text-sm text-center px-6">
                У тебя {GAME_DURATION} секунд чтобы поймать как можно больше звёзд!
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.04 }}
                onClick={startGame}
                className="px-8 py-3 rounded-2xl font-display font-bold text-white text-base"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}
              >
                Начать!
              </motion.button>
            </div>
          )}

          {phase === 'playing' && (
            <>
              {/* Timer */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                <motion.span
                  className="font-display font-bold text-2xl"
                  style={{ color: timerColor }}
                  key={timeLeft}
                  animate={{ scale: timeLeft <= 5 ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {timeLeft}s
                </motion.span>
              </div>

              {/* Score */}
              <div className="absolute top-3 right-3 z-10">
                <span className="text-yellow-400 font-bold text-sm">⭐ {score}</span>
              </div>

              {/* Stars */}
              <AnimatePresence>
                {stars.map(star => {
                  const isCaught = caught.includes(star.id);
                  const points = star.size > 35 ? 5 : star.size > 28 ? 10 : 20;
                  return (
                    <motion.button
                      key={star.id}
                      className="absolute flex items-center justify-center"
                      style={{ left: `${star.x}%`, top: `${star.y}%`, fontSize: star.size, cursor: 'pointer' }}
                      initial={{ scale: 0, rotate: -30 }}
                      animate={isCaught ? { scale: [1, 1.5, 0], rotate: 30 } : { scale: 1, rotate: 0 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => !isCaught && catchStar(star.id, points)}
                    >
                      {star.emoji}
                      {isCaught && (
                        <motion.span
                          className="absolute -top-4 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-xs"
                          initial={{ y: 0, opacity: 1 }}
                          animate={{ y: -20, opacity: 0 }}
                          transition={{ duration: 0.5 }}
                        >
                          +{points}
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </>
          )}

          {phase === 'result' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <motion.span
                className="text-5xl"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ duration: 0.5 }}
              >
                {score >= 150 ? '🏆' : score >= 80 ? '🥇' : '🎉'}
              </motion.span>
              <div className="text-center">
                <p className="text-white font-display font-bold text-xl">{score} очков!</p>
                <p className="text-purple-300 text-sm mt-0.5">
                  {lastResult?.message ?? ''}
                </p>
                {lastResult?.xpGained && (
                  <motion.p
                    className="text-yellow-400 font-bold text-sm mt-1"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    +{lastResult.xpGained} XP ⚡  +{lastResult.coinsGained} 🪙
                  </motion.p>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}
                >
                  Ещё раз!
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl font-semibold text-white/70 text-sm"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  Закрыть
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
