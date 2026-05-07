import { motion } from 'framer-motion';
import { DAILY_BUDGET, FORMATION_THRESHOLD, STABILITY_SYNCS } from '../../personality/TraitEvolutionEngine';
import { getPersonality } from '../../personality/personalities';
import { TRAIT_KEYS, type TraitKey } from '../../personality/types';
import { usePetStore } from '../../store/petStore';

const TRAIT_LABELS: Record<TraitKey, { label: string; color: string; bg: string }> = {
  vitality: { label: 'Активность', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  sociality: { label: 'Социальность', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)' },
  order: { label: 'Порядок', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  appetite: { label: 'Аппетит', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
  caution: { label: 'Осторожность', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  curiosity: { label: 'Любопытство', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
};

const IS_DEV = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

function pct(value: number, max = 100): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function fmt(value: number | undefined): string {
  return Math.round(value ?? 0).toString();
}

export function EvolutionInspector() {
  const pet = usePetStore(s => s.pet);
  const account = usePetStore(s => s.account);
  const apiMode = usePetStore(s => s.apiMode);
  const actionLoading = usePetStore(s => s.actionLoading);
  const debugTimeScale = usePetStore(s => s.debugTimeScale);
  const setDebugTimeScale = usePetStore(s => s.setDebugTimeScale);
  const advanceDebugTime = usePetStore(s => s.advanceDebugTime);
  const syncPet = usePetStore(s => s.syncPet);
  const beginNewLife = usePetStore(s => s.beginNewLife);
  if (!pet) return null;

  const traitVector = pet.traitVector ?? {};
  const dailyBudget = pet.dailyTraitBudget ?? {};
  const memories = pet.coreMemories ?? [];
  const target = pet.currentTargetZone ? getPersonality(pet.currentTargetZone) : null;
  const proposal = pet.evolutionProposal;
  const proposalTarget = proposal ? getPersonality(proposal.targetPersonalityId) : null;
  const formationProgress = pet.formationProgress ?? 0;
  const formationPct = pet.formationComplete ? 100 : pct(formationProgress, FORMATION_THRESHOLD);
  const variance = pet.dailyVectorVariance ?? 0;
  const legacyVector = account.legacyVector;
  const strongestLegacy = legacyVector
    ? TRAIT_KEYS.reduce((best, key) => legacyVector[key] > legacyVector[best] ? key : best, TRAIT_KEYS[0])
    : null;
  const canBeginNewLife = apiMode === 'mock' && (pet.stage === 'adult' || pet.stage === 'elder' || IS_DEV);
  const guardian = account.memoryGuardian;

  return (
    <div className="rounded-3xl p-4 glass space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-lumio-text text-sm">Эволюция</h3>
          <p className="text-[11px] text-lumio-muted mt-0.5">
            {pet.formationComplete ? 'характер сформирован' : `формирование ${Math.round(formationPct)}%`}
          </p>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-1 rounded-full"
          style={{
            background: pet.confusedState ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)',
            color: pet.confusedState ? '#DC2626' : '#059669',
          }}
        >
          variance {Math.round(variance)}
        </span>
      </div>

      {IS_DEV && (
        <div className="rounded-2xl px-3 py-3 space-y-2 bg-white/60 border border-white/70">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Debug time</p>
            <span className="text-[10px] text-gray-400">{apiMode === 'mock' ? `×${debugTimeScale}` : 'real api'}</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[1, 10, 60, 240].map(scale => (
              <button
                key={scale}
                type="button"
                disabled={apiMode !== 'mock'}
                onClick={() => setDebugTimeScale(scale)}
                className="rounded-lg py-1.5 text-[11px] font-semibold disabled:opacity-40"
                style={{
                  background: debugTimeScale === scale ? '#6366F1' : 'rgba(99,102,241,0.10)',
                  color: debugTimeScale === scale ? 'white' : '#4F46E5',
                }}
              >
                ×{scale}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={apiMode !== 'mock'}
              onClick={() => advanceDebugTime(1)}
              className="rounded-lg py-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 disabled:opacity-40"
            >
              +1ч + sync
            </button>
            <button
              type="button"
              disabled={apiMode !== 'mock'}
              onClick={() => syncPet()}
              className="rounded-lg py-1.5 text-[11px] font-semibold bg-gray-100 text-gray-600 disabled:opacity-40"
            >
              sync now
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="h-2 rounded-full overflow-hidden bg-gray-100">
          <motion.div
            className="h-full rounded-full"
            style={{ background: pet.formationComplete ? '#10B981' : '#6366F1' }}
            animate={{ width: `${formationPct}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>

        {target && (
          <div className="flex items-center justify-between text-[11px] rounded-xl px-3 py-2 bg-white/60">
            <span className="font-semibold text-gray-600">Цель: {target.emoji} {target.name}</span>
            <span className="text-gray-400">{pet.ticksInTargetZone ?? 0}/{STABILITY_SYNCS}</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl px-3 py-3 space-y-2 bg-white/60 border border-white/70">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Память пути</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {account.legacyDescription ?? 'Хранитель памяти ещё не появился'}
            </p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
            жизнь {account.legacyGeneration ?? 0}
          </span>
        </div>

        {guardian && (
          <div className="rounded-xl px-3 py-2 bg-emerald-50/70 border border-emerald-100">
            <p className="text-[11px] font-semibold text-emerald-700">Хранитель: {guardian.name}</p>
            {guardian.guidance.slice(0, 2).map((hint, index) => (
              <p key={index} className="text-[11px] text-emerald-700/80 mt-1 leading-snug">{hint}</p>
            ))}
          </div>
        )}

        {strongestLegacy && (
          <p className="text-[11px] text-gray-500">
            След: {TRAIT_LABELS[strongestLegacy].label} · коэффициент {Math.round((account.legacyCoefficient ?? 0.15) * 100)}%
          </p>
        )}

        <button
          type="button"
          disabled={!canBeginNewLife || actionLoading === 'new_life'}
          onClick={() => beginNewLife()}
          className="w-full rounded-xl py-2 text-[11px] font-semibold bg-emerald-600 text-white disabled:opacity-40"
        >
          {actionLoading === 'new_life' ? 'Сохраняем память...' : 'Новое тело'}
        </button>
      </div>

      <div className="space-y-2">
        {TRAIT_KEYS.map(key => {
          const meta = TRAIT_LABELS[key];
          const value = traitVector[key] ?? 50;
          const spent = dailyBudget[key] ?? 0;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-gray-500">{meta.label}</span>
                <span className="text-[10px] text-gray-400">
                  {fmt(value)} · {Math.round(spent)}/{DAILY_BUDGET[key]}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: meta.bg }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: meta.color }}
                  animate={{ width: `${pct(value)}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {proposal && (
        <div className="rounded-2xl px-3 py-3 space-y-2 bg-indigo-50 border border-indigo-100">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-indigo-700">
                {proposalTarget ? `${proposalTarget.emoji} ${proposalTarget.name}` : proposal.targetPersonalityId}
              </p>
              <p className="text-[11px] text-indigo-500">готовность {proposal.readiness}%</p>
            </div>
            <span className="text-[10px] text-indigo-400">depth {proposal.depth.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button disabled className="rounded-xl py-1.5 text-[11px] font-semibold bg-indigo-600/30 text-white">
              Принять
            </button>
            <button disabled className="rounded-xl py-1.5 text-[11px] font-semibold bg-white text-indigo-400 border border-indigo-100">
              Отложить
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Core Memories</p>
          <span className="text-[10px] text-gray-400">{memories.length}</span>
        </div>
        {memories.length === 0 ? (
          <p className="text-[11px] text-gray-400">Пока пусто</p>
        ) : (
          <div className="space-y-1.5">
            {memories.slice(0, 3).map(memory => (
              <div
                key={memory.id}
                className="rounded-xl px-3 py-2 text-[11px]"
                style={{
                  background: memory.tier === 'rare' ? 'rgba(245,158,11,0.12)' : 'rgba(243,244,246,0.9)',
                  border: memory.tier === 'rare' ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(229,231,235,0.9)',
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="shrink-0">{memory.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-600 leading-snug">{memory.text}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{memory.tier} · {memory.traitKey}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
