import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../../store/petStore';
import { EMERGENT_STATE_MAP } from '../../personality/emergentStates';

export function EmergentStateBanner() {
  const pet = usePetStore(s => s.pet);
  if (!pet?.emergentState) return null;

  const def = EMERGENT_STATE_MAP.get(pet.emergentState as any);
  if (!def) return null;

  // Выбираем цвет по приоритету
  const urgency = def.priority <= 3 ? 'critical' : def.priority <= 6 ? 'warning' : 'info';

  const colors = {
    critical: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#DC2626', pulse: 'rgba(239,68,68,0.2)' },
    warning:  { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)', text: '#EA580C', pulse: 'rgba(251,146,60,0.2)' },
    info:     { bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.30)', text: '#7C3AED', pulse: 'rgba(139,92,246,0.15)' },
  }[urgency];

  const firstBlocked = def.blockedActions[0];

  return (
    <AnimatePresence>
      <motion.div
        key={pet.emergentState}
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="rounded-2xl px-4 py-3 flex items-start gap-3"
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          boxShadow: `0 2px 12px ${colors.pulse}`,
        }}
      >
        {/* Пульс-иконка */}
        <motion.span
          className="text-xl shrink-0 mt-0.5"
          animate={urgency === 'critical' ? { scale: [1, 1.25, 1] } : {}}
          transition={{ duration: 0.9, repeat: Infinity }}
        >
          {def.emoji}
        </motion.span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm" style={{ color: colors.text }}>
              {def.name}
            </span>
            {def.exclusive && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/60 text-gray-500">
                активное
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">
            {def.description}
          </p>
          {firstBlocked && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: colors.text }}>
              💡 {firstBlocked.alternativeHint}
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
