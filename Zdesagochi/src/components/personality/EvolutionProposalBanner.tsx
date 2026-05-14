import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../../store/petStore';
import { getPersonality } from '@zdesagochi/personality-pet-preset';
import type { CoreMemory } from '../../personality/types';

export function EvolutionProposalBanner() {
  const { pet, acceptEvolution, rejectEvolution, actionLoading } = usePetStore();
  const proposal = pet?.evolutionProposal;

  if (!proposal) return null;

  const targetDef = getPersonality(proposal.targetPersonalityId as any);
  const readinessPct = Math.round((proposal.readiness ?? 0) * 100);

  return (
    <AnimatePresence>
      <motion.div
        key="evolution-proposal"
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full rounded-3xl p-4 space-y-3"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(236,72,153,0.10) 100%)',
          border: '1px solid rgba(139,92,246,0.35)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(139,92,246,0.18)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">✨</span>
          <div>
            <div className="text-xs font-bold text-purple-700 uppercase tracking-wide">Эволюция характера</div>
            <div className="text-sm font-semibold text-lumio-text">
              {targetDef?.name ?? proposal.targetPersonalityId}
            </div>
          </div>
          <div className="ml-auto text-xs font-bold text-purple-500">{readinessPct}% готово</div>
        </div>

        {/* Narrative */}
        {proposal.narrativeText && (
          <p className="text-xs text-gray-600 leading-relaxed italic">
            &ldquo;{proposal.narrativeText}&rdquo;
          </p>
        )}

        {/* Core memories that drove this */}
        {proposal.coreMemoryIds && proposal.coreMemoryIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(pet?.coreMemories ?? [])
              .filter((m: CoreMemory) => proposal.coreMemoryIds!.includes(m.id ?? ''))
              .slice(0, 3)
              .map((m: CoreMemory, i: number) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(139,92,246,0.12)', color: '#7C3AED' }}
                >
                  {m.emoji} {m.text}
                </span>
              ))}
          </div>
        )}

        {/* Readiness bar */}
        <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400"
            initial={{ width: 0 }}
            animate={{ width: `${readinessPct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => acceptEvolution?.()}
            disabled={!!actionLoading}
            className="flex-1 py-2 rounded-2xl text-sm font-bold text-white transition-all"
            style={{
              background: actionLoading ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg,#8B5CF6,#EC4899)',
              boxShadow: actionLoading ? 'none' : '0 2px 12px rgba(139,92,246,0.35)',
            }}
          >
            Принять
          </button>
          <button
            onClick={() => rejectEvolution?.()}
            disabled={!!actionLoading}
            className="flex-1 py-2 rounded-2xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Позже
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
