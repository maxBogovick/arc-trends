import { useState } from 'react';
import { motion } from 'framer-motion';
import { DAILY_BUDGET, FORMATION_THRESHOLD, SINGULARITY_THRESHOLD_SYNCS, STABILITY_SYNCS } from '../../personality/TraitEvolutionEngine';
import { getPersonality } from '@zdesagochi/personality-pet-preset';
import { BEHAVIOR_AXES, TRAIT_KEYS, type BehaviorAxis, type TraitKey } from '../../personality/types';
import { usePetStore } from '../../store/petStore';

const TRAIT_LABELS: Record<TraitKey, { label: string; color: string; bg: string }> = {
  vitality: { label: 'Активность', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  sociality: { label: 'Социальность', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)' },
  order: { label: 'Порядок', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  appetite: { label: 'Аппетит', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
  caution: { label: 'Осторожность', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  curiosity: { label: 'Любопытство', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
};

const BEHAVIOR_LABELS: Record<BehaviorAxis, { label: string; color: string; bg: string }> = {
  care: { label: 'Забота', color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
  play: { label: 'Игра', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  social: { label: 'Связь', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)' },
  order: { label: 'Режим', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  exploration: { label: 'Поиск', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  disruption: { label: 'Срыв', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  recovery: { label: 'Восстановление', color: '#84CC16', bg: 'rgba(132,204,22,0.12)' },
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
  const [newLifeOpen, setNewLifeOpen] = useState(false);
  const pet = usePetStore(s => s.pet);
  const account = usePetStore(s => s.account);
  const apiMode = usePetStore(s => s.apiMode);
  const actionLoading = usePetStore(s => s.actionLoading);
  const debugTimeScale = usePetStore(s => s.debugTimeScale);
  const setDebugTimeScale = usePetStore(s => s.setDebugTimeScale);
  const advanceDebugTime = usePetStore(s => s.advanceDebugTime);
  const syncPet = usePetStore(s => s.syncPet);
  const acceptEvolution = usePetStore(s => s.acceptEvolution);
  const rejectEvolution = usePetStore(s => s.rejectEvolution);
  const beginNewLife = usePetStore(s => s.beginNewLife);
  if (!pet) return null;

  const traitVector = pet.traitVector ?? {};
  const dailyBudget = pet.dailyTraitBudget ?? {};
  const memories = pet.coreMemories ?? [];
  const target = pet.currentTargetZone ? getPersonality(pet.currentTargetZone) : null;
  const readinessTarget = pet.evolutionReadinessTarget ? getPersonality(pet.evolutionReadinessTarget) : null;
  const behaviorProfile = pet.behaviorProfile;
  const behaviorAxes = behaviorProfile?.axes;
  const dominantBehaviorAxis = behaviorAxes
    ? BEHAVIOR_AXES.reduce((best, axis) => behaviorAxes[axis] > behaviorAxes[best] ? axis : best, BEHAVIOR_AXES[0])
    : null;
  const dominantBehaviorMeta = dominantBehaviorAxis ? BEHAVIOR_LABELS[dominantBehaviorAxis] : null;
  const evolutionReadiness = pet.evolutionReadiness ?? 0;
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
  const singularityZones = pet.singularityZones ?? [];
  const singularityProgress = pct(pet.ticksInSingularity ?? 0, SINGULARITY_THRESHOLD_SYNCS);
  const inShadowForm = pet.emergentState === 'shadow_form';
  const traumaLevel = pet.traumaLevel ?? 0;
  const traumaToShadow = Math.max(0, 75 - traumaLevel);
  const showCatharsis = inShadowForm || traumaLevel >= 50 || pet.catharsisProgress > 0;
  const catharsisPct = pct(pet.catharsisProgress ?? 0);
  const rareMemories = memories.filter(memory => memory.tier === 'rare').slice(0, 3);
  const guardianPreviewHints = [
    pet.confusedState || variance >= 25
      ? 'Хранитель запомнит: после насыщенного дня помогает непрерывный сон.'
      : 'Хранитель запомнит устойчивый ритм заботы.',
    pet.traumaLevel >= 40 || pet.catharsisAchieved
      ? 'Мягкие действия останутся главным способом восстанавливать доверие.'
      : 'Новая форма начнёт путь спокойнее благодаря накопленному опыту.',
  ];

  const confirmNewLife = async () => {
    await beginNewLife();
    setNewLifeOpen(false);
  };

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

      {singularityZones.length > 0 && (
        <div
          className="rounded-2xl px-3 py-3 space-y-3 border"
          style={{
            background: pet.emergentState === 'singularity'
              ? 'rgba(99,102,241,0.12)'
              : 'rgba(16,185,129,0.10)',
            borderColor: pet.emergentState === 'singularity'
              ? 'rgba(99,102,241,0.25)'
              : 'rgba(16,185,129,0.22)',
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">Точка сингулярности</p>
              <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">
                {pet.emergentState === 'singularity'
                  ? 'Три пути раскрылись. Следующее движение может закрепить редкую метаморфозу.'
                  : 'Характер балансирует между несколькими путями.'}
              </p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white/70 text-indigo-600">
              {pet.ticksInSingularity ?? 0}/{SINGULARITY_THRESHOLD_SYNCS}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {singularityZones.slice(0, 3).map(zone => {
              const zoneDef = getPersonality(zone);
              return (
                <div key={zone} className="rounded-xl px-2 py-2 bg-white/70 border border-white/80 text-center min-w-0">
                  <p className="text-xl">{zoneDef?.emoji ?? '✨'}</p>
                  <p className="text-[10px] font-semibold text-gray-600 truncate mt-0.5">
                    {zoneDef?.name ?? zone}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="h-2 rounded-full overflow-hidden bg-white/70">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: pet.emergentState === 'singularity'
                  ? 'linear-gradient(90deg,#6366F1,#10B981,#F59E0B)'
                  : '#10B981',
              }}
              animate={{ width: `${singularityProgress}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {showCatharsis && (
        <div
          className="rounded-2xl px-3 py-3 space-y-3 border"
          style={{
            background: inShadowForm
              ? 'rgba(30,41,59,0.08)'
              : 'rgba(245,158,11,0.10)',
            borderColor: inShadowForm
              ? 'rgba(30,41,59,0.18)'
              : 'rgba(245,158,11,0.22)',
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Катарсис</p>
              <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">
                {inShadowForm
                  ? 'Идёт восстановление: обнимай или лечи питомца, пока шкала не дойдёт до 100.'
                  : `Это ещё не восстановление, а риск. Снизь trauma ниже 50: обнять -3, лечить -2, не будить рано.`}
              </p>
            </div>
            <span
              className="text-[10px] font-semibold px-2 py-1 rounded-full"
              style={{
                background: inShadowForm ? 'rgba(15,23,42,0.08)' : 'rgba(245,158,11,0.14)',
                color: inShadowForm ? '#334155' : '#B45309',
              }}
            >
              trauma {Math.round(traumaLevel)}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-500">
                {inShadowForm ? 'Прогресс восстановления' : 'До теневой формы'}
              </span>
              <span className="text-[10px] text-gray-400">
                {inShadowForm
                  ? `${Math.round(pet.catharsisProgress ?? 0)}/100`
                  : traumaToShadow > 0 ? `ещё ${Math.round(traumaToShadow)} trauma` : 'риск активен'}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-white/70">
              <motion.div
                className="h-full rounded-full"
                style={{ background: inShadowForm ? '#475569' : '#F59E0B' }}
                animate={{ width: `${inShadowForm ? catharsisPct : pct(traumaLevel, 75)}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-xl px-2 py-2 bg-white/70 border border-white/80">
              <p className="text-[11px] font-semibold text-gray-600">Обнять</p>
              <p className="text-[10px] text-gray-400">{inShadowForm ? '+25 катарсис' : '-3 trauma'}</p>
            </div>
            <div className="rounded-xl px-2 py-2 bg-white/70 border border-white/80">
              <p className="text-[11px] font-semibold text-gray-600">Лечить</p>
              <p className="text-[10px] text-gray-400">{inShadowForm ? '+20 катарсис' : '-2 trauma'}</p>
            </div>
          </div>
        </div>
      )}

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
          onClick={() => setNewLifeOpen(true)}
          className="w-full rounded-xl py-2 text-[11px] font-semibold bg-emerald-600 text-white disabled:opacity-40"
        >
          {actionLoading === 'new_life' ? 'Сохраняем память...' : 'Новое тело'}
        </button>
      </div>

      {newLifeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/35">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl border border-white/80 space-y-4"
          >
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Память сохранится</p>
              <h3 className="text-lg font-bold text-gray-800">Новое тело для {pet.name}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Питомец сохранит память пути и станет Хранителем для новой формы. Опыт прошлого мягко повлияет на стартовые черты.
              </p>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="rounded-2xl px-3 py-3 bg-gray-50 border border-gray-100 text-center">
                <p className="text-2xl">{getPersonality(pet.personality as any)?.emoji ?? '✨'}</p>
                <p className="text-[11px] font-semibold text-gray-600 mt-1 truncate">{pet.name}</p>
                <p className="text-[10px] text-gray-400">{getPersonality(pet.personality as any)?.name ?? pet.personality}</p>
              </div>
              <span className="text-emerald-500 font-bold">→</span>
              <div className="rounded-2xl px-3 py-3 bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-2xl">🌱</p>
                <p className="text-[11px] font-semibold text-emerald-700 mt-1">Новая форма</p>
                <p className="text-[10px] text-emerald-600">с памятью пути</p>
              </div>
            </div>

            {strongestLegacy && (
              <div className="rounded-2xl px-3 py-3 bg-white border border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Сильнейший след</p>
                <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: TRAIT_LABELS[strongestLegacy].bg }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct(legacyVector?.[strongestLegacy] ?? 50)}%`,
                      background: TRAIT_LABELS[strongestLegacy].color,
                    }}
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {TRAIT_LABELS[strongestLegacy].label} · будущий echo {Math.round((account.legacyCoefficient ?? 0.15) * 100)}%
                </p>
              </div>
            )}

            <div className="rounded-2xl px-3 py-3 bg-emerald-50/80 border border-emerald-100 space-y-2">
              <p className="text-[11px] font-semibold text-emerald-700">Хранитель памяти</p>
              {guardianPreviewHints.map((hint, index) => (
                <p key={index} className="text-[11px] text-emerald-700/85 leading-snug">{hint}</p>
              ))}
              {rareMemories.length > 0 && (
                <div className="pt-1 space-y-1">
                  {rareMemories.map(memory => (
                    <p key={memory.id} className="text-[11px] text-emerald-700/80 truncate">
                      {memory.emoji} {memory.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewLifeOpen(false)}
                className="rounded-xl py-2 text-[12px] font-semibold bg-gray-100 text-gray-600"
              >
                Остаться
              </button>
              <button
                type="button"
                disabled={actionLoading === 'new_life'}
                onClick={() => void confirmNewLife()}
                className="rounded-xl py-2 text-[12px] font-semibold bg-emerald-600 text-white disabled:opacity-40"
              >
                Обрести новое тело
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
          {proposal.narrativeText && (
            <p className="text-[11px] text-indigo-600 leading-snug">{proposal.narrativeText}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={actionLoading === 'accept_evolution' || actionLoading === 'reject_evolution'}
              onClick={() => acceptEvolution()}
              className="rounded-xl py-1.5 text-[11px] font-semibold bg-indigo-600 text-white disabled:opacity-40"
            >
              Принять
            </button>
            <button
              type="button"
              disabled={actionLoading === 'accept_evolution' || actionLoading === 'reject_evolution'}
              onClick={() => rejectEvolution()}
              className="rounded-xl py-1.5 text-[11px] font-semibold bg-white text-indigo-500 border border-indigo-100 disabled:opacity-40"
            >
              Отложить
            </button>
          </div>
        </div>
      )}

      {pet.formationComplete && (
        <div className="rounded-2xl px-3 py-3 space-y-3 bg-white/70 border border-white/80">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Character signal</p>
              <p className="text-[12px] font-bold text-gray-700 mt-0.5">
                {dominantBehaviorMeta ? dominantBehaviorMeta.label : 'Нет сигнала'}
              </p>
            </div>
            <span className="text-[10px] text-gray-400">
              samples {behaviorProfile?.sampleCount ?? 0}
            </span>
          </div>

          {dominantBehaviorAxis && dominantBehaviorMeta && (
            <div className="space-y-1">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: dominantBehaviorMeta.bg }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: dominantBehaviorMeta.color }}
                  animate={{ width: `${pct(behaviorAxes?.[dominantBehaviorAxis] ?? 0)}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[11px] text-gray-500">
                {dominantBehaviorMeta.label} · {fmt(behaviorAxes?.[dominantBehaviorAxis])}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl px-3 py-2 bg-gray-50 border border-gray-100">
              <p className="text-[10px] text-gray-400">Цель</p>
              <p className="text-[11px] font-semibold text-gray-600 truncate">
                {target ? `${target.emoji} ${target.name}` : 'нет'}
              </p>
            </div>
            <div className="rounded-xl px-3 py-2 bg-gray-50 border border-gray-100">
              <p className="text-[10px] text-gray-400">Готовность</p>
              <p className="text-[11px] font-semibold text-gray-600 truncate">
                {readinessTarget ? `${readinessTarget.emoji} ${readinessTarget.name}` : 'нет'} · {Math.round(evolutionReadiness)}%
              </p>
            </div>
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
