import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../../store/petStore';

const CATHARSIS_THRESHOLD = 100;

export function ShadowCatharsisProgress() {
  const { pet } = usePetStore();

  const inShadow = pet?.emergentState === 'shadow_form'
    || pet?.stateLayers?.evolution?.some?.((s: any) => s.type === 'shadow_form');

  const burstActive = pet?.catharsisXpBurstExpiresAt
    && new Date(pet.catharsisXpBurstExpiresAt).getTime() > Date.now();

  if (!inShadow && !burstActive) return null;

  const progress = pet?.catharsisProgress ?? 0;
  const pct = Math.round((progress / CATHARSIS_THRESHOLD) * 100);

  return (
    <AnimatePresence>
      {inShadow && (
        <motion.div
          key="shadow-catharsis"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3 }}
          className="w-full rounded-3xl p-4 space-y-2"
          style={{
            background: 'linear-gradient(135deg, rgba(30,10,60,0.92) 0%, rgba(60,20,80,0.88) 100%)',
            border: '1px solid rgba(139,92,246,0.4)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(139,92,246,0.25)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">🌑</span>
            <div>
              <div className="text-xs font-bold text-purple-300 uppercase tracking-wide">Теневая форма</div>
              <div className="text-xs text-purple-200 mt-0.5">Проявляй заботу, чтобы найти путь обратно</div>
            </div>
            <div className="ml-auto text-xs font-bold text-purple-300">{pct}%</div>
          </div>

          {/* Catharsis progress bar */}
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #8B5CF6, #EC4899)' }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          <div className="text-[10px] text-purple-400 text-center">
            Катарсис: {progress} / {CATHARSIS_THRESHOLD}
          </div>
        </motion.div>
      )}

      {burstActive && !inShadow && (
        <motion.div
          key="catharsis-burst"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="w-full rounded-3xl px-4 py-2.5 flex items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(251,146,60,0.12) 100%)',
            border: '1px solid rgba(251,191,36,0.4)',
          }}
        >
          <span className="text-lg leading-none">🌅</span>
          <div>
            <div className="text-xs font-bold text-yellow-700">Катарсис!</div>
            <div className="text-[10px] text-yellow-600">XP ×5 ещё активен</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
