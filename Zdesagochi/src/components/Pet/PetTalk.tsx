import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { Pet } from '../../api';

const MESSAGES: Record<string, string[]> = {
  sick:     ['Мне плохо... дай лекарство 🤒', 'Моя голова кружится... 😵'],
  tired:    ['Я так устал... 😴', 'Хочу спать...💤'],
  sleeping: ['Zzz... 😴', '...zZz... 💤'],
  ecstatic: ['ЭТО ЛУЧШИЙ ДЕНЬ! 🤩', 'Я СЧАСТЛИВ КАК НИКОГДА! 🎉', 'Мне так хорошо с тобой! 💜'],
  happy:    ['Мне так хорошо! 😊', 'Спасибо, что заботишься обо мне 💜', 'Сегодня отличный день! ✨'],
  content:  ['Всё хорошо 🙂', 'Я доволен жизнью', 'Норм денёк 👍'],
  sad:      ['Мне грустно... 😢', 'Поиграй со мной?', 'Покорми меня, пожалуйста 🥺'],
  hungry:   ['Я хочу кушать! 🍔', 'Мой животик пустой! 🍕'],
  dirty:    ['Хочу помыться! 🛁', 'Я немного грязный...'],
  lonely:   ['Обними меня! 🤗', 'Ты давно не обнимал меня 🥺'],
};

function pickMessage(pet: Pet): string {
  const pool: string[] = [];
  if (pet.mood === 'sick' || pet.mood === 'tired' || pet.mood === 'sleeping' || pet.mood === 'ecstatic' || pet.mood === 'sad') {
    pool.push(...(MESSAGES[pet.mood] ?? []));
  }
  if (pet.stats.hunger < 30)      pool.push(...MESSAGES.hungry);
  if (pet.stats.cleanliness < 25) pool.push(...MESSAGES.dirty);
  if (pet.stats.bond < 20)        pool.push(...MESSAGES.lonely);
  if (pool.length === 0)          pool.push(...(MESSAGES[pet.mood] ?? MESSAGES.content));
  return pool[Math.floor(Math.random() * pool.length)];
}

export function PetTalk({ pet }: { pet: Pet }) {
  const [message, setMessage] = useState(() => pickMessage(pet));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = () => {
      setVisible(false);
      setTimeout(() => {
        setMessage(pickMessage(pet));
        setVisible(true);
      }, 500);
    };
    const t = setInterval(cycle, 6000);
    setMessage(pickMessage(pet));
    setVisible(true);
    return () => clearInterval(t);
  }, [pet.mood, pet.stats.hunger, pet.stats.bond, pet.stats.cleanliness]);

  return (
    <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-max max-w-[200px] pointer-events-none z-10">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            className="px-3 py-2 rounded-2xl rounded-bl-sm text-xs font-semibold text-center shadow-glass"
            style={{
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(255,255,255,0.8)',
              color: '#1E1147',
              maxWidth: 200,
              whiteSpace: 'nowrap',
            }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
