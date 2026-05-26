import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo, useRef } from 'react';
import type { Pet } from '../../api';
import type { BehaviorMode } from './usePetBehaviorState';
import { ExplainabilityLog } from '../../api/explainability';
import { getProactivePetSuggestion, type ProactivePetSuggestion } from '../../personality/proactiveSuggestions';
import type { SupportedPetActionId } from '../../personality/petActionIds';
import type { InventoryItem, Room, ShopItem } from '../../api';
import type { ActivityTarget } from '../../personality/timeOfDayActivities';
import {
  dismissSuggestionActivity,
  getLastRoutineSuggestionAt,
  loadDismissedActivities,
  loadEffectiveProactiveRuntimeSettings,
  loadPendingActivities,
  recordDailyAppOpen,
  recordSuggestionAnalytics,
  setLastRoutineSuggestionAt,
  startPendingActivity,
} from '../../personality/proactiveSuggestionState';
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

function buildSuggestion(pet: Pet, inventory: InventoryItem[], rooms: Room[], shopItems: ShopItem[]) {
  const storage = typeof window === 'undefined' ? null : window.localStorage;
  const schedule = storage ? recordDailyAppOpen(storage) : { learnedOffsetHours: 0 };
  const settings = storage ? loadEffectiveProactiveRuntimeSettings(storage) : null;
  return getProactivePetSuggestion({
    pet,
    latestRecord: loadLatestRecord(),
    inventory,
    rooms,
    shopItems,
    dismissedActivities: storage ? loadDismissedActivities(storage) : [],
    pendingActivities: storage ? loadPendingActivities(storage) : [],
    lastRoutineSuggestionAt: storage ? getLastRoutineSuggestionAt(storage) : null,
    scheduleOffsetHours: schedule.learnedOffsetHours,
    tuningConfig: settings?.tuningConfig,
    quietHours: settings?.quietHours,
    configPatch: settings?.configPatch,
    abCohort: settings?.abCohort,
    copyVariantSeed: pet.id,
    includeDebug: true,
    now: new Date(),
  });
}

interface Props {
  pet: Pet;
  mode: BehaviorMode;
  actionLoading?: string | null;
  inventory?: InventoryItem[];
  rooms?: Room[];
  shopItems?: ShopItem[];
  canRunSuggestionAction?: (actionId: SupportedPetActionId) => boolean;
  onSuggestionAction?: (actionId: SupportedPetActionId) => void | Promise<void>;
  onSuggestionTarget?: (target: ActivityTarget, suggestion: ProactivePetSuggestion) => void | Promise<void>;
}

export function PetTalk({
  pet,
  mode,
  actionLoading = null,
  inventory = [],
  rooms = [],
  shopItems = [],
  canRunSuggestionAction,
  onSuggestionAction,
  onSuggestionTarget,
}: Props) {
  const suggestion = useMemo(
    () => buildSuggestion(pet, inventory, rooms, shopItems),
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
      inventory,
      rooms,
      shopItems,
    ],
  );
  const [message, setMessage] = useState(() => suggestion.message || pickMessage(pet));
  const [activeSuggestion, setActiveSuggestion] = useState<ProactivePetSuggestion>(suggestion);
  const cycleIndexRef = useRef(0);
  const shownSuggestionRef = useRef<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [debugOpen, setDebugOpen] = useState(false);

  const isSilent = SILENT_MODES.has(mode);
  const actionId = activeSuggestion.actionId;
  const target = activeSuggestion.target;
  const ctaLabel = activeSuggestion.ctaLabel ?? (actionId ? PET_ACTION_META[actionId].label : undefined);
  const canRunAction = Boolean(
    (actionId || target) &&
    (actionId ? onSuggestionAction : onSuggestionTarget) &&
    !actionLoading &&
    (actionId ? (canRunSuggestionAction?.(actionId) ?? true) : true),
  );

  useEffect(() => {
    const cycle = () => {
      setVisible(false);
      setTimeout(() => {
        const next = buildSuggestion(pet, inventory, rooms, shopItems);
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
  }, [pet, suggestion, inventory, rooms, shopItems]);

  useEffect(() => {
    if (!visible || activeSuggestion.source !== 'time_of_day' || !activeSuggestion.activityId) return;
    const key = `${activeSuggestion.id}:${activeSuggestion.activityId}`;
    if (shownSuggestionRef.current === key) return;
    shownSuggestionRef.current = key;
    if (typeof window !== 'undefined') {
      recordSuggestionAnalytics(window.localStorage, activeSuggestion.activityId, 'shown', new Date());
    }
  }, [activeSuggestion, visible]);

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
            {activeSuggestion.source !== 'mood' && activeSuggestion.activityId && (
              <button
                type="button"
                onPointerDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation();
                  if (typeof window !== 'undefined') {
                    dismissSuggestionActivity(window.localStorage, activeSuggestion.activityId!, new Date());
                  }
                  setDebugOpen(false);
                  setVisible(false);
                }}
                className="pointer-events-auto ml-1 rounded-full"
                title="Скрыть это предложение"
                style={{
                  padding: '1px 5px',
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#6B7280',
                  background: 'rgba(255,255,255,0.55)',
                  border: '1px solid rgba(148,163,184,0.35)',
                }}
              >
                ×
              </button>
            )}
            {ctaLabel && canRunAction && (
              <button
                type="button"
                onPointerDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation();
                  if (typeof window !== 'undefined') {
                    if (activeSuggestion.source === 'time_of_day') {
                      setLastRoutineSuggestionAt(window.localStorage, new Date().toISOString());
                    }
                    if (activeSuggestion.target && activeSuggestion.activityId) {
                      recordSuggestionAnalytics(window.localStorage, activeSuggestion.activityId, 'opened', new Date());
                      startPendingActivity(window.localStorage, {
                        activityId: activeSuggestion.activityId,
                        target: activeSuggestion.target,
                      }, new Date());
                    }
                  }
                  if (actionId) void onSuggestionAction?.(actionId);
                  else if (target) void onSuggestionTarget?.(target, activeSuggestion);
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
                {ctaLabel}
              </button>
            )}
            {activeSuggestion.source === 'time_of_day' && activeSuggestion.debug && (
              <button
                type="button"
                onPointerDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation();
                  setDebugOpen(value => !value);
                }}
                className="pointer-events-auto ml-1 rounded-full border"
                title="Почему выбрано это предложение"
                style={{
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#4F46E5',
                  background: '#EEF2FF',
                  borderColor: '#C7D2FE',
                }}
              >
                ?
              </button>
            )}
            {debugOpen && activeSuggestion.debug && (
              <div className="pointer-events-auto mt-2 rounded-xl border border-indigo-100 bg-white/80 p-2 text-left">
                <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500">
                  <span>period: {activeSuggestion.debug.period}</span>
                  <span>{activeSuggestion.debug.quietHoursActive ? 'quiet' : 'active'}</span>
                </div>
                <div className="mt-1 space-y-1">
                  {activeSuggestion.debug.candidates.slice(0, 3).map(candidate => (
                    <div key={candidate.activityId} className="flex justify-between gap-2 text-[10px]">
                      <span className="truncate text-gray-600">{candidate.activityId}</span>
                      <span className={candidate.blockedBy ? 'text-rose-500' : 'text-indigo-600'}>
                        {candidate.blockedBy ?? Math.round(candidate.score)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
