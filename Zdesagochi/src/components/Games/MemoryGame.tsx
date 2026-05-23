import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { usePetStore } from '../../store/petStore';

const EMOJI_PAIRS = ['🍎', '🍕', '🎮', '🌟', '🎵', '🎁', '🌈', '🦋', '🍭', '🎀'];

interface Card { id: number; emoji: string; flipped: boolean; matched: boolean }

function makeCards(): Card[] {
  const n = 8;
  const emojis = EMOJI_PAIRS.slice(0, n);
  const doubled = [...emojis, ...emojis];
  const shuffled = doubled.sort(() => Math.random() - 0.5);
  return shuffled.map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
}

export function MemoryGame({ onClose }: { onClose: () => void }) {
  const { playWithPet, registerMemoryPerfect } = usePetStore();
  const [phase, setPhase] = useState<'intro' | 'playing' | 'result'>('intro');
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matched, setMatched] = useState(0);
  const [time, setTime] = useState(0);
  const [isPerfect, setIsPerfect] = useState(false);
  const [waitingFlip, setWaitingFlip] = useState(false);

  const totalPairs = 8;

  const endGame = useCallback(async (perfect: boolean) => {
    setPhase('result');
    setIsPerfect(perfect);
    if (perfect) registerMemoryPerfect();
    await playWithPet('puzzle');
  }, [playWithPet, registerMemoryPerfect]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => setTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (matched === totalPairs && phase === 'playing') {
      const perfect = moves <= totalPairs + 2;
      endGame(perfect);
    }
  }, [matched, phase, moves, endGame]);

  const startGame = () => {
    setCards(makeCards());
    setFlipped([]);
    setMoves(0);
    setMatched(0);
    setTime(0);
    setPhase('playing');
    setWaitingFlip(false);
  };

  const flip = (id: number) => {
    if (waitingFlip) return;
    const card = cards[id];
    if (!card || card.matched || card.flipped) return;
    if (flipped.length === 1 && flipped[0] === id) return;

    const newFlipped = [...flipped, id];
    setCards(cs => cs.map(c => c.id === id ? { ...c, flipped: true } : c));

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      setWaitingFlip(true);
      const [a, b] = newFlipped;
      if (cards[a].emoji === cards[b].emoji) {
        // Match!
        setTimeout(() => {
          setCards(cs => cs.map(c => (c.id === a || c.id === b) ? { ...c, matched: true } : c));
          setMatched(m => m + 1);
          setFlipped([]);
          setWaitingFlip(false);
        }, 400);
      } else {
        // No match
        setTimeout(() => {
          setCards(cs => cs.map(c => (c.id === a || c.id === b) ? { ...c, flipped: false } : c));
          setFlipped([]);
          setWaitingFlip(false);
        }, 900);
      }
    } else {
      setFlipped(newFlipped);
      setWaitingFlip(false);
    }
  };

  const scoreLabel = isPerfect ? 'Идеально! 🏆' : moves <= totalPairs + 4 ? 'Отлично! ⭐' : 'Хорошо! 👏';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(30,17,71,0.65)', backdropFilter: 'blur(10px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg,#1E1B4B,#312E81,#4C1D95)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(167,139,250,0.2)',
        }}
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Игра «Память»</h2>
            {phase === 'playing' && <p className="text-purple-300 text-xs">Найди все пары!</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all">✕</button>
        </div>

        {/* Stats bar */}
        {phase === 'playing' && (
          <div className="flex justify-around px-5 pb-3">
            <div className="text-center">
              <p className="text-purple-300 text-[10px]">Ходы</p>
              <p className="text-white font-bold">{moves}</p>
            </div>
            <div className="text-center">
              <p className="text-purple-300 text-[10px]">Пары</p>
              <p className="text-white font-bold">{matched}/{totalPairs}</p>
            </div>
            <div className="text-center">
              <p className="text-purple-300 text-[10px]">Время</p>
              <p className="text-white font-bold">{time}s</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-4 pb-5">
          {phase === 'intro' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <motion.span className="text-5xl" animate={{ rotateY: [0, 360] }} transition={{ duration: 2, repeat: Infinity }}>🧠</motion.span>
              <div className="text-center">
                <p className="text-white font-bold text-base mb-1">Игра на память</p>
                <p className="text-purple-300 text-sm">Найди все {totalPairs} пар карточек. Меньше ходов = лучше!</p>
                <p className="text-yellow-400 text-xs mt-1">Идеальное прохождение = достижение 🏆</p>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-8 py-3 rounded-2xl font-bold text-white text-base"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
                Начать!
              </motion.button>
            </div>
          )}

          {phase === 'playing' && (
            <div className="grid grid-cols-4 gap-2">
              {cards.map(card => (
                <motion.button
                  key={card.id}
                  onClick={() => flip(card.id)}
                  whileTap={{ scale: 0.95 }}
                  className="aspect-square rounded-xl flex items-center justify-center text-2xl relative overflow-hidden"
                  style={{
                    background: card.matched ? 'rgba(16,185,129,0.2)' : card.flipped ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                    border: card.matched ? '1.5px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    cursor: (card.matched || card.flipped) ? 'default' : 'pointer',
                  }}
                >
                  <AnimatePresence mode="wait">
                    {card.flipped || card.matched ? (
                      <motion.span key="emoji"
                        initial={{ rotateY: 90, scale: 0.5 }}
                        animate={{ rotateY: 0, scale: 1 }}
                        exit={{ rotateY: -90, scale: 0.5 }}
                        transition={{ duration: 0.2 }}
                      >
                        {card.emoji}
                      </motion.span>
                    ) : (
                      <motion.span key="back"
                        initial={{ rotateY: 90 }}
                        animate={{ rotateY: 0 }}
                        exit={{ rotateY: 90 }}
                        transition={{ duration: 0.2 }}
                        className="text-purple-400 text-xl"
                      >
                        ✦
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              ))}
            </div>
          )}

          {phase === 'result' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <motion.span className="text-5xl" initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.5 }}>
                {isPerfect ? '🏆' : '⭐'}
              </motion.span>
              <div className="text-center">
                <p className="text-white font-bold text-xl">{scoreLabel}</p>
                <p className="text-purple-300 text-sm mt-0.5">{moves} ходов за {time} секунд</p>
                {isPerfect && (
                  <motion.p className="text-yellow-400 text-xs font-bold mt-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                    Достижение «Мастер памяти» разблокировано! 🧠
                  </motion.p>
                )}
              </div>
              <div className="flex gap-2 mt-1">
                <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                  className="px-5 py-2.5 rounded-xl font-bold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}>
                  Ещё раз
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onClose}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
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
