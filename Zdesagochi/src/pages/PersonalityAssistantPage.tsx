import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { PERSONALITIES, getPersonalityGuidance } from '@zdesagochi/personality-pet-preset';
import type { PersonalityId } from '../personality/types';
import { usePetStore } from '../store/petStore';
import { ExplainabilityLog } from '../api/explainability';
import {
  BEHAVIOR_LABELS,
  TRAIT_LABELS,
  buildPersonalityAssistantReport,
  type ActionContribution,
  type TimelineEntry,
  type WeightedInsight,
} from '../personality/personalityAssistant';

type AssistantTab = 'mine' | 'timeline' | 'guide' | 'catalog';

const TABS: Array<{ id: AssistantTab; label: string }> = [
  { id: 'mine', label: 'Мой питомец' },
  { id: 'timeline', label: 'История' },
  { id: 'guide', label: 'Как управлять' },
  { id: 'catalog', label: 'Справочник' },
];

const PHASE_LABELS: Record<TimelineEntry['phase'], string> = {
  early: 'начало',
  habit: 'привычки',
  formation: 'формирование',
  formed: 'после формирования',
  evolution: 'эволюция',
};

export function PersonalityAssistantPage() {
  const pet = usePetStore(s => s.pet);
  const events = usePetStore(s => s.events);
  const [tab, setTab] = useState<AssistantTab>('mine');
  const [target, setTarget] = useState<PersonalityId>((pet?.personality ?? 'playful') as PersonalityId);

  const records = useMemo(() => {
    if (typeof window === 'undefined') return [];
    return new ExplainabilityLog(window.localStorage).list();
  }, [pet?.lastUpdated, pet?.formationProgress, events.length]);

  const telemetry = useMemo(() => records
    .map(record => record.personalityTelemetry)
    .filter((sample): sample is NonNullable<typeof sample> => Boolean(sample)), [records]);

  const report = useMemo(() => pet
    ? buildPersonalityAssistantReport({
      pet,
      records,
      telemetry,
      events,
      targetPersonalityId: target,
    })
    : null, [pet, records, telemetry, events, target]);

  if (!pet || !report) {
    return (
      <div className="glass rounded-3xl p-6 text-center">
        <h1 className="font-display font-bold text-xl text-lumio-text">Помощник характера</h1>
        <p className="text-sm text-lumio-muted mt-2">Питомец ещё загружается.</p>
      </div>
    );
  }

  const targetGuidance = getPersonalityGuidance(target);

  return (
    <div className="space-y-4">
      <section className="glass rounded-3xl p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-purple-500">Помощник характера</p>
            <h1 className="font-display font-bold text-2xl text-lumio-text mt-1">
              Почему питомец стал таким и как вести его дальше
            </h1>
            <p className="text-sm text-lumio-muted mt-2 max-w-2xl">{report.summary}</p>
          </div>
          <div className="rounded-2xl px-3 py-2 bg-white/70 border border-white/70 min-w-44">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Уверенность</p>
            <p className="text-sm font-bold text-lumio-text">{report.confidence.label} · {report.confidence.score}%</p>
            <p className="text-[11px] text-gray-500 mt-1 leading-snug">{report.confidence.explanation}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          {TABS.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
              style={{
                background: tab === item.id ? '#7C3AED' : 'rgba(255,255,255,0.65)',
                color: tab === item.id ? 'white' : '#6B7280',
                border: tab === item.id ? '1px solid #7C3AED' : '1px solid rgba(255,255,255,0.7)',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === 'mine' && (
        <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
          <Panel title="Текущее формирование">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold text-lumio-text mb-1">
                  <span>{report.formationStatus.label}</span>
                  <span>{Math.round(report.formationStatus.progress)}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500" style={{ width: `${report.formationStatus.progress}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-2">{report.formationStatus.explanation}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <InsightList title="Главные черты" items={report.dominantTraits} />
                <InsightList title="Главные привычки" items={report.dominantBehaviors} />
              </div>
            </div>
          </Panel>

          <Panel title="Ближайшие характеры">
            <div className="space-y-2">
              {report.nearestPersonalities.slice(0, 4).map(item => (
                <button
                  key={item.personalityId}
                  onClick={() => setTarget(item.personalityId)}
                  className="w-full text-left rounded-2xl px-3 py-2 transition-colors"
                  style={{
                    background: target === item.personalityId ? 'rgba(124,58,237,0.10)' : 'rgba(255,255,255,0.6)',
                    border: target === item.personalityId ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(255,255,255,0.65)',
                  }}
                >
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-bold text-lumio-text">{item.personalityId}</p>
                    <p className="text-xs font-bold text-purple-600">{item.closeness}%</p>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{item.summary}</p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Вклад действий">
            <ActionContributionList items={report.actionContributions} />
          </Panel>

          <Panel title="Предметный стиль">
            <p className="text-sm font-bold text-lumio-text">
              {report.itemContribution.style === 'diverse' ? 'Разнообразный'
                : report.itemContribution.style === 'repeated' ? 'Повторяемый'
                  : report.itemContribution.style === 'frequent' ? 'Частый'
                    : 'Почти нет данных'}
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{report.itemContribution.explanation}</p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Metric label="добавлено" value={report.itemContribution.totalAdds} />
              <Metric label="использовано" value={report.itemContribution.totalUses} />
              <Metric label="разных" value={report.itemContribution.uniqueItems} />
            </div>
            {report.itemContribution.repeatedItemId && (
              <p className="text-[11px] text-gray-500 mt-2">
                Частый повтор: <span className="font-bold text-lumio-text">{report.itemContribution.repeatedItemId}</span> ×{report.itemContribution.repeatedCount}
              </p>
            )}
          </Panel>
        </section>
      )}

      {tab === 'timeline' && (
        <Panel title="Полная история формирования">
          {report.formationTimeline.length === 0 ? (
            <p className="text-sm text-gray-500">Истории пока мало. Сделай несколько действий, и помощник начнёт объяснять вклад каждого.</p>
          ) : (
            <div className="space-y-3">
              {report.formationTimeline.map(entry => <TimelineCard key={entry.id} entry={entry} />)}
            </div>
          )}
        </Panel>
      )}

      {tab === 'guide' && (
        <section className="grid lg:grid-cols-[0.8fr_1.2fr] gap-4">
          <Panel title="Целевой характер">
            <select
              value={target}
              onChange={e => setTarget(e.target.value as PersonalityId)}
              className="w-full rounded-2xl px-3 py-2 text-sm font-bold text-lumio-text bg-white border border-gray-200 outline-none"
            >
              {PERSONALITIES.map(personality => (
                <option key={personality.id} value={personality.id}>{personality.name} · {personality.id}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">{targetGuidance.summary}</p>
          </Panel>
          <Panel title="Что делать дальше">
            <div className="grid sm:grid-cols-2 gap-4">
              <AdviceList title="Усиливать" items={report.nextBestActions} tone="good" />
              <AdviceList title="Избегать" items={report.avoidActions} tone="warn" />
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <InsightList title="Нужные черты" items={targetGuidance.traits.map(key => ({
                key,
                label: TRAIT_LABELS[key],
                value: pet.traitVector[key],
                direction: 'neutral',
                explanation: `Для "${target}" важна черта "${TRAIT_LABELS[key]}".`,
              })) as WeightedInsight[]} />
              <InsightList title="Нужные привычки" items={targetGuidance.behaviorAxes.map(key => ({
                key,
                label: BEHAVIOR_LABELS[key],
                value: pet.behaviorProfile?.axes[key] ?? 0,
                direction: 'neutral',
                explanation: `Для "${target}" важен профиль "${BEHAVIOR_LABELS[key]}".`,
              })) as WeightedInsight[]} />
            </div>
          </Panel>
        </section>
      )}

      {tab === 'catalog' && (
        <Panel title="Data-driven справочник по всем характерам">
          <div className="grid md:grid-cols-2 gap-3">
            {PERSONALITIES.map(personality => {
              const guidance = getPersonalityGuidance(personality.id);
              return (
                <div key={personality.id} className="rounded-2xl p-3 bg-white/65 border border-white/70">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{personality.emoji}</span>
                    <div>
                      <p className="text-sm font-bold text-lumio-text">{personality.name}</p>
                      <p className="text-[10px] text-gray-400">{personality.id}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">{guidance.summary}</p>
                  <div className="mt-2 space-y-1">
                    {guidance.aimFor.slice(0, 2).map(text => <p key={text} className="text-[11px] text-emerald-700">✓ {text}</p>)}
                    {guidance.avoid.slice(0, 1).map(text => <p key={text} className="text-[11px] text-rose-600">• {text}</p>)}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-4"
    >
      <h2 className="font-display font-bold text-lumio-text text-base mb-3">{title}</h2>
      {children}
    </motion.div>
  );
}

function InsightList({ title, items }: { title: string; items: WeightedInsight[] }) {
  return (
    <div className="rounded-2xl bg-white/60 border border-white/70 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">{title}</p>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-xs text-gray-500">Пока нет данных.</p>}
        {items.map(item => (
          <div key={item.key}>
            <div className="flex justify-between gap-2 text-xs">
              <span className="font-bold text-lumio-text">{item.label}</span>
              <span className="font-bold text-purple-600">{item.value}</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{item.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionContributionList({ items }: { items: ActionContribution[] }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">Действия ещё не накопили explainability-историю.</p>;
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.commandType} className="rounded-2xl p-3 bg-white/60 border border-white/70">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-lumio-text">{item.label}</p>
            <span className="text-[10px] font-bold text-purple-600">×{item.count}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{item.explanation}</p>
        </div>
      ))}
    </div>
  );
}

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  return (
    <div className="rounded-2xl p-3 bg-white/65 border border-white/70">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-lumio-text">{entry.title}</p>
          <p className="text-[10px] text-gray-400">{new Date(entry.at).toLocaleString()} · {PHASE_LABELS[entry.phase]}</p>
        </div>
        <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-purple-100 text-purple-700">
          {entry.confidence}%
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-2">{entry.summary}</p>
      {(entry.traitImpacts.length > 0 || entry.behaviorImpacts.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[...entry.traitImpacts, ...entry.behaviorImpacts].map(item => (
            <span key={`${entry.id}-${item.key}`} className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-indigo-50 text-indigo-700">
              {item.label} {item.value > 0 ? '+' : ''}{item.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AdviceList({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'warn' }) {
  return (
    <div>
      <p className={`text-xs font-bold mb-2 ${tone === 'good' ? 'text-emerald-700' : 'text-rose-600'}`}>{title}</p>
      <div className="space-y-1.5">
        {items.map(item => (
          <p key={item} className="text-xs text-gray-600 rounded-xl px-3 py-2 bg-white/60 border border-white/70">
            {tone === 'good' ? '✓' : '•'} {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/60 border border-white/70 px-2 py-2 text-center">
      <p className="text-sm font-bold text-lumio-text">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}
