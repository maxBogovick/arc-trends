import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo, useRef } from 'react';
import type { Pet } from '../../api';
import type { BehaviorMode } from './usePetBehaviorState';
import { ExplainabilityLog } from '../../api/explainability';
import { getProactivePetSuggestion, type ProactivePetSuggestion } from '../../personality/proactiveSuggestions';
import type { SupportedPetActionId } from '../../personality/petActionIds';
import { PET_ACTION_META } from '../Actions/petActionControls';

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

// Bubble bg tint per mood
const MOOD_BG: Partial<Record<string, string>> = {
  ecstatic: 'rgba(255,250,200,0.97)',
  happy:    'rgba(240,245,255,0.97)',
  sad:      'rgba(225,235,255,0.97)',
  tired:    'rgba(235,235,245,0.95)',
  sick:     'rgba(230,250,225,0.96)',
  sleeping: 'rgba(230,225,255,0.96)',
};

// Accent dot color per mood
const MOOD_DOT: Partial<Record<string, string>> = {
  ecstatic: '#F59E0B',
  happy:    '#6366F1',
  sad:      '#60A5FA',
  sick:     '#4ADE80',
  tired:    '#94A3B8',
  sleeping: '#A78BFA',
  content:  '#818CF8',
};

// Pet is too busy to talk during active animations, but sleep can still surface wake/rest hints.
const SILENT_MODES = new Set<BehaviorMode>(['eating', 'playing', 'cleaning', 'medicine']);

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

function loadLatestRecord() {
  if (typeof window === 'undefined') return null;
  return new ExplainabilityLog(window.localStorage).select()?.record ?? null;
}

interface Props {
  pet: Pet;
  mode: BehaviorMode;
  actionLoading?: string | null;
  canRunSuggestionAction?: (actionId: SupportedPetActionId) => boolean;
  onSuggestionAction?: (actionId: SupportedPetActionId) => void | Promise<void>;
}

export function PetTalk({
  pet,
  mode,
  actionLoading = null,
  canRunSuggestionAction,
  onSuggestionAction,
}: Props) {
  const suggestion = useMemo(
    () => getProactivePetSuggestion({ pet, latestRecord: loadLatestRecord() }),
    [
      pet.lastUpdated,
      pet.mood,
      pet.isAsleep,
      pet.emergentState,
      pet.confusedState,
      pet.traumaLevel,
      pet.evolutionReadinessTarget,
      pet.currentTargetZone,
      pet.evolutionProposal?.proposedAt,
      pet.stats.hunger,
      pet.stats.energy,
      pet.stats.health,
      pet.stats.cleanliness,
      pet.stats.bond,
    ],
  );
  const [message, setMessage] = useState(() => suggestion.message || pickMessage(pet));
  const [activeSuggestion, setActiveSuggestion] = useState<ProactivePetSuggestion>(suggestion);
  const cycleIndexRef = useRef(0);
  const [visible, setVisible] = useState(true);

  const isSilent = SILENT_MODES.has(mode);
  const actionId = activeSuggestion.actionId;
  const canRunAction = Boolean(
    actionId &&
    onSuggestionAction &&
    !actionLoading &&
    (canRunSuggestionAction?.(actionId) ?? true),
  );

  useEffect(() => {
    const cycle = () => {
      setVisible(false);
      setTimeout(() => {
        const next = getProactivePetSuggestion({ pet, latestRecord: loadLatestRecord() });
        cycleIndexRef.current += 1;
        setActiveSuggestion(next);
        setMessage(cycleIndexRef.current % 3 === 0 && next.source !== 'after_action' ? pickMessage(pet) : next.message || pickMessage(pet));
        setVisible(true);
      }, 500);
    };
    const t = setInterval(cycle, 6000);
    setActiveSuggestion(suggestion);
    setMessage(suggestion.message || pickMessage(pet));
    setVisible(true);
    return () => clearInterval(t);
  }, [pet, suggestion]);

  const bg  = MOOD_BG[pet.mood]  ?? 'rgba(255,255,255,0.95)';
  const dot = MOOD_DOT[pet.mood] ?? '#818CF8';

  return (
    <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-max max-w-[240px] pointer-events-none z-10">
      <AnimatePresence>
        {visible && !isSilent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="px-3 py-2 rounded-2xl rounded-bl-sm text-xs font-semibold text-center"
            style={{
              background: bg,
              border: `1.5px solid ${dot}55`,
              color: '#1E1147',
              boxShadow: `0 4px 16px ${dot}22, 0 1px 4px rgba(0,0,0,0.08)`,
              whiteSpace: 'normal',
            }}
          >
            {/* Mood accent dot */}
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: dot, marginRight: 5, verticalAlign: 'middle', boxShadow: `0 0 5px ${dot}88` }} />
            {message}
            {actionId && canRunAction && (
              <button
                type="button"
                onPointerDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation();
                  void onSuggestionAction?.(actionId);
                }}
                className="pointer-events-auto ml-2 rounded-full border"
                title={activeSuggestion.reason}
                style={{
                  padding: '2px 7px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#065F46',
                  background: '#ECFDF5',
                  borderColor: '#6EE7B7',
                  whiteSpace: 'nowrap',
                }}
              >
                {PET_ACTION_META[actionId].label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
