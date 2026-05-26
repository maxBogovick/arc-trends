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
import { getTimeOfDayActivityDebugReport, getTimeOfDayActivitySuggestion } from '../personality/timeOfDayActivities';
import type { ActivityRule, DayPeriod } from '../personality/timeOfDayActivities';
import { DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG } from '../personality/timeOfDayActivityConfig';
import {
  DEFAULT_QUIET_HOURS,
  exportActivityAnalytics,
  fetchRemoteProactiveConfig,
  loadActivityAnalytics,
  loadDismissedActivities,
  loadEffectiveProactiveRuntimeSettings,
  loadPendingActivities,
  loadRemoteConfigUrl,
  loadScheduleLearningState,
  saveProactiveRuntimeSettings,
  saveRemoteConfigUrl,
  saveRemoteProactiveConfig,
  signRemoteProactiveConfig,
} from '../personality/proactiveSuggestionState';

type AssistantTab = 'mine' | 'timeline' | 'guide' | 'routine' | 'catalog';

const TABS: Array<{ id: AssistantTab; label: string }> = [
  { id: 'mine', label: 'Мой питомец' },
  { id: 'timeline', label: 'История' },
  { id: 'guide', label: 'Как управлять' },
  { id: 'routine', label: 'Режим дня' },
  { id: 'catalog', label: 'Справочник' },
];

const PHASE_LABELS: Record<TimelineEntry['phase'], string> = {
  early: 'начало',
  habit: 'привычки',
  formation: 'формирование',
  formed: 'после формирования',
  evolution: 'эволюция',
};

type RoutineSubTab = 'overview' | 'rules' | 'analytics' | 'remote';

const ROUTINE_TABS: Array<{ id: RoutineSubTab; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'analytics', label: 'Аналитика предложений' },
  { id: 'rules', label: 'Редактор правил' },
  { id: 'remote', label: 'Remote config' },
];

const DAY_PERIOD_LABELS: Record<DayPeriod, string> = {
  early_morning: 'Раннее утро',
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  night: 'Ночь',
};

type RoutineState = {
  settings: ReturnType<typeof loadEffectiveProactiveRuntimeSettings>;
  schedule: ReturnType<typeof loadScheduleLearningState>;
  analytics: ReturnType<typeof loadActivityAnalytics>;
  suggestion: ReturnType<typeof getTimeOfDayActivitySuggestion>;
  debug: ReturnType<typeof getTimeOfDayActivityDebugReport>;
  storedRemoteUrl: string;
};

export function PersonalityAssistantPage() {
  const pet = usePetStore(s => s.pet);
  const events = usePetStore(s => s.events);
  const inventory = usePetStore(s => s.inventory);
  const rooms = usePetStore(s => s.rooms);
  const shopItems = usePetStore(s => s.shopItems);
  const proactiveConfig = usePetStore(s => s.proactiveConfig);
  const proactiveAnalytics = usePetStore(s => s.proactiveAnalytics);
  const proactiveAudit = usePetStore(s => s.proactiveAudit);
  const loadProactiveAdminData = usePetStore(s => s.loadProactiveAdminData);
  const loadProactiveConfig = usePetStore(s => s.loadProactiveConfig);
  const publishProactiveConfig = usePetStore(s => s.publishProactiveConfig);
  const ingestProactiveAnalytics = usePetStore(s => s.ingestProactiveAnalytics);
  const [tab, setTab] = useState<AssistantTab>('mine');
  const [target, setTarget] = useState<PersonalityId>((pet?.personality ?? 'playful') as PersonalityId);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [configText, setConfigText] = useState('');
  const [analyticsText, setAnalyticsText] = useState('');
  const [signatureSecret, setSignatureSecret] = useState('');
  const [ruleSearch, setRuleSearch] = useState('');
  const [selectedRuleId, setSelectedRuleId] = useState('breakfast');

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

  const routineState = useMemo(() => {
    if (!pet || typeof window === 'undefined') return null;
    const settings = loadEffectiveProactiveRuntimeSettings(window.localStorage);
    const schedule = loadScheduleLearningState(window.localStorage);
    const analytics = loadActivityAnalytics(window.localStorage);
    const suggestion = getTimeOfDayActivitySuggestion({
      pet,
      inventory,
      rooms,
      shopItems,
      dismissedActivities: loadDismissedActivities(window.localStorage),
      pendingActivities: loadPendingActivities(window.localStorage),
      scheduleOffsetHours: schedule.learnedOffsetHours,
      quietHours: settings.quietHours,
      tuningConfig: settings.tuningConfig,
      configPatch: settings.configPatch,
      abCohort: settings.abCohort,
      copyVariantSeed: pet.id,
      includeDebug: true,
    });
    const debug = getTimeOfDayActivityDebugReport({
      pet,
      inventory,
      rooms,
      shopItems,
      dismissedActivities: loadDismissedActivities(window.localStorage),
      pendingActivities: loadPendingActivities(window.localStorage),
      scheduleOffsetHours: schedule.learnedOffsetHours,
      quietHours: settings.quietHours,
      tuningConfig: settings.tuningConfig,
      configPatch: settings.configPatch,
      abCohort: settings.abCohort,
      copyVariantSeed: pet.id,
    });
    const storedRemoteUrl = loadRemoteConfigUrl(window.localStorage);
    return { settings, schedule, analytics, suggestion, debug, storedRemoteUrl };
  }, [pet, inventory, rooms, shopItems, settingsVersion]);

  const allRoutineRules = useMemo(() => {
    const source = routineState?.settings.configPatch?.activityRules ?? DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG.activityRules;
    const overrides = routineState?.settings.configPatch?.activityRuleOverrides ?? {};
    return source.map(rule => ({ ...rule, ...(overrides[rule.activityId] ?? {}) }));
  }, [routineState?.settings.configPatch?.activityRuleOverrides, routineState?.settings.configPatch?.activityRules]);

  const visibleRules = useMemo(() => {
    const query = ruleSearch.trim().toLowerCase();
    return allRoutineRules
      .filter(rule => !query || rule.activityId.toLowerCase().includes(query) || rule.message.toLowerCase().includes(query))
      .slice(0, 40);
  }, [allRoutineRules, ruleSearch]);

  const selectedRule = useMemo(() => {
    return allRoutineRules.find(rule => rule.activityId === selectedRuleId)
      ?? allRoutineRules[0]
      ?? DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG.activityRules[0];
  }, [allRoutineRules, selectedRuleId]);

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

      {tab === 'routine' && routineState && (
        <RoutineWorkbench
          routineState={routineState}
          proactiveConfig={proactiveConfig}
          proactiveAnalyticsCount={proactiveAnalytics.length}
          proactiveAuditCount={proactiveAudit.length}
          remoteUrl={remoteUrl}
          configText={configText}
          analyticsText={analyticsText}
          signatureSecret={signatureSecret}
          visibleRules={visibleRules}
          selectedRule={selectedRule}
          selectedRuleId={selectedRuleId}
          ruleSearch={ruleSearch}
          onRemoteUrlChange={setRemoteUrl}
          onConfigTextChange={setConfigText}
          onAnalyticsTextChange={setAnalyticsText}
          onSignatureSecretChange={setSignatureSecret}
          onRuleSearchChange={setRuleSearch}
          onSelectedRuleChange={setSelectedRuleId}
          onRefresh={() => setSettingsVersion(value => value + 1)}
          loadProactiveConfig={loadProactiveConfig}
          publishProactiveConfig={publishProactiveConfig}
          ingestProactiveAnalytics={ingestProactiveAnalytics}
          loadProactiveAdminData={loadProactiveAdminData}
        />
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

function RoutineWorkbench({
  routineState,
  proactiveConfig,
  proactiveAnalyticsCount,
  proactiveAuditCount,
  remoteUrl,
  configText,
  analyticsText,
  signatureSecret,
  visibleRules,
  selectedRule,
  selectedRuleId,
  ruleSearch,
  onRemoteUrlChange,
  onConfigTextChange,
  onAnalyticsTextChange,
  onSignatureSecretChange,
  onRuleSearchChange,
  onSelectedRuleChange,
  onRefresh,
  loadProactiveConfig,
  publishProactiveConfig,
  ingestProactiveAnalytics,
  loadProactiveAdminData,
}: {
  routineState: RoutineState;
  proactiveConfig: ReturnType<typeof usePetStore.getState>['proactiveConfig'];
  proactiveAnalyticsCount: number;
  proactiveAuditCount: number;
  remoteUrl: string;
  configText: string;
  analyticsText: string;
  signatureSecret: string;
  visibleRules: ActivityRule[];
  selectedRule: ActivityRule;
  selectedRuleId: string;
  ruleSearch: string;
  onRemoteUrlChange: (value: string) => void;
  onConfigTextChange: (value: string) => void;
  onAnalyticsTextChange: (value: string) => void;
  onSignatureSecretChange: (value: string) => void;
  onRuleSearchChange: (value: string) => void;
  onSelectedRuleChange: (value: string) => void;
  onRefresh: () => void;
  loadProactiveConfig: () => Promise<void>;
  publishProactiveConfig: (config: unknown) => Promise<void>;
  ingestProactiveAnalytics: (payload: unknown) => Promise<void>;
  loadProactiveAdminData: () => Promise<void>;
}) {
  const [routineTab, setRoutineTab] = useState<RoutineSubTab>('overview');
  const configuredRulesCount = routineState.settings.configPatch?.activityRules?.length
    ?? DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG.activityRules.length;
  const activeRulesCount = configuredRulesCount - (routineState.settings.tuningConfig.disabledActivityIds?.length ?? 0);

  return (
    <section className="space-y-4">
      <div className="glass rounded-3xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-lg text-lumio-text">Режим дня</h2>
            <p className="text-xs text-gray-500 mt-1">
              {routineState.suggestion.activityId} · score {Math.round(routineState.suggestion.score)} · {activeRulesCount}/{configuredRulesCount} active · cohort {routineState.settings.abCohort}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ROUTINE_TABS.map(item => (
              <button
                key={item.id}
                onClick={() => setRoutineTab(item.id)}
                className="rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors"
                style={{
                  background: routineTab === item.id ? '#4F46E5' : 'rgba(255,255,255,0.72)',
                  color: routineTab === item.id ? 'white' : '#64748B',
                  borderColor: routineTab === item.id ? '#4F46E5' : 'rgba(226,232,240,0.9)',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {routineTab === 'overview' && (
        <section className="grid lg:grid-cols-[0.95fr_1.05fr] gap-4">
          <Panel title="Текущее предложение">
            <p className="text-sm font-bold text-lumio-text">{routineState.suggestion.message}</p>
            <p className="text-xs text-gray-500 mt-1">{routineState.suggestion.activityId} · {Math.round(routineState.suggestion.score)}</p>
            <div className="mt-3 space-y-1">
              {routineState.debug.candidates.slice(0, 6).map(candidate => (
                <div key={candidate.activityId} className="flex justify-between gap-2 rounded-xl bg-white/60 px-2 py-1 text-xs">
                  <span className="truncate text-gray-600">{candidate.activityId}</span>
                  <span className={candidate.blockedBy ? 'text-rose-500' : 'text-indigo-600'}>
                    {candidate.blockedBy ?? Math.round(candidate.score)}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Режим тишины">
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/65 border border-white/70 px-3 py-2">
                <span>
                  <span className="block text-sm font-bold text-lumio-text">Не предлагать routine ночью</span>
                  <span className="block text-[11px] text-gray-500">Критические нужды остаются выше.</span>
                </span>
                <input
                  type="checkbox"
                  checked={routineState.settings.quietHours.enabled}
                  onChange={event => {
                    if (typeof window === 'undefined') return;
                    saveProactiveRuntimeSettings(window.localStorage, {
                      ...routineState.settings,
                      quietHours: { ...routineState.settings.quietHours, enabled: event.target.checked },
                    });
                    onRefresh();
                  }}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <NumberSetting label="Начало" value={routineState.settings.quietHours.startHour} onChange={value => {
                  if (typeof window === 'undefined') return;
                  saveProactiveRuntimeSettings(window.localStorage, {
                    ...routineState.settings,
                    quietHours: { ...routineState.settings.quietHours, startHour: value },
                  });
                  onRefresh();
                }} />
                <NumberSetting label="Конец" value={routineState.settings.quietHours.endHour} onChange={value => {
                  if (typeof window === 'undefined') return;
                  saveProactiveRuntimeSettings(window.localStorage, {
                    ...routineState.settings,
                    quietHours: { ...routineState.settings.quietHours, endHour: value },
                  });
                  onRefresh();
                }} />
              </div>
              <button
                className="w-full rounded-2xl px-3 py-2 text-xs font-bold text-gray-600 bg-white/65 border border-white/70"
                onClick={() => {
                  if (typeof window === 'undefined') return;
                  saveProactiveRuntimeSettings(window.localStorage, {
                    ...routineState.settings,
                    quietHours: DEFAULT_QUIET_HOURS,
                    tuningConfig: {},
                  });
                  onRefresh();
                }}
              >
                Сбросить локальные настройки
              </button>
            </div>
          </Panel>

          <Panel title="Обучение расписанию">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="samples" value={routineState.schedule.samples.length} />
              <Metric label="offset" value={routineState.schedule.learnedOffsetHours} />
              <Metric label="timezone" value={routineState.schedule.samples[routineState.schedule.samples.length - 1]?.timezoneOffsetMinutes ?? 0} />
            </div>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">
              Смещение считается по первым открытиям приложения за последние дни и ограничено диапазоном от -2 до +2 часов.
            </p>
          </Panel>

          <Panel title="Состояние конфигурации">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="rules" value={configuredRulesCount} />
              <Metric label="active" value={activeRulesCount} />
              <Metric label="remote" value={routineState.settings.remoteConfig ? routineState.settings.remoteConfig.version : 'off'} />
              <Metric label="backend" value={proactiveConfig ? proactiveConfig.version : 'none'} />
            </div>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">
              Правила редактируются локальным config patch. Remote config и backend можно проверять отдельно, не смешивая это с аналитикой.
            </p>
          </Panel>
        </section>
      )}

      {routineTab === 'rules' && (
        <Panel title="Редактор правил">
          <RuleWorkbench
            rules={visibleRules}
            selectedRule={selectedRule}
            selectedRuleId={selectedRuleId}
            search={ruleSearch}
            settings={routineState.settings}
            debug={routineState.debug}
            onSearch={onRuleSearchChange}
            onSelect={onSelectedRuleChange}
            onChange={onRefresh}
          />
        </Panel>
      )}

      {routineTab === 'analytics' && (
        <Panel title="Аналитика предложений">
          <div className="grid lg:grid-cols-[1fr_0.8fr] gap-4">
            <div className="space-y-2">
              {Object.entries(routineState.analytics.activities).slice(0, 12).map(([activityId, value]) => (
                <div key={activityId} className="rounded-2xl bg-white/65 border border-white/70 px-3 py-2">
                  <p className="text-xs font-bold text-lumio-text">{activityId}</p>
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    <Metric label="show" value={value.shown} />
                    <Metric label="open" value={value.opened} />
                    <Metric label="skip" value={value.dismissed} />
                    <Metric label="done" value={value.completed} />
                  </div>
                </div>
              ))}
              {Object.keys(routineState.analytics.activities).length === 0 && (
                <p className="text-sm text-gray-500">Статистика появится после показов и действий с подсказками.</p>
              )}
            </div>
            <div className="space-y-2">
              <button className="w-full rounded-2xl px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100" onClick={() => {
                if (typeof window === 'undefined') return;
                onAnalyticsTextChange(exportActivityAnalytics(window.localStorage));
              }}>
                Экспорт JSON
              </button>
              <button className="w-full rounded-2xl px-3 py-2 text-xs font-bold text-white bg-slate-800" onClick={async () => {
                if (typeof window === 'undefined') return;
                await ingestProactiveAnalytics(JSON.parse(exportActivityAnalytics(window.localStorage)));
                await loadProactiveAdminData();
              }}>
                Отправить на backend
              </button>
              <button className="w-full rounded-2xl px-3 py-2 text-xs font-bold text-gray-600 bg-white/65 border border-white/70" onClick={loadProactiveAdminData}>
                Обновить backend данные
              </button>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="backend" value={proactiveAnalyticsCount} />
                <Metric label="audit" value={proactiveAuditCount} />
              </div>
              {analyticsText && (
                <textarea readOnly value={analyticsText} className="h-44 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-[10px] text-gray-600 outline-none" />
              )}
            </div>
          </div>
        </Panel>
      )}

      {routineTab === 'remote' && (
        <Panel title="Remote config">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
            <div className="space-y-2">
              <input value={remoteUrl || routineState.storedRemoteUrl} onChange={event => onRemoteUrlChange(event.target.value)} placeholder="https://example.com/proactive-config.json" className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs text-lumio-text outline-none" />
              <input type="password" value={signatureSecret} onChange={event => onSignatureSecretChange(event.target.value)} placeholder="Verify secret для signed config" className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs text-lumio-text outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-2xl px-3 py-2 text-xs font-bold text-white bg-indigo-600" onClick={async () => {
                  if (typeof window === 'undefined') return;
                  const url = remoteUrl || routineState.storedRemoteUrl;
                  if (!url) return;
                  await fetchRemoteProactiveConfig(window.localStorage, url, fetch, signatureSecret || undefined);
                  onRefresh();
                }}>
                  Загрузить URL
                </button>
                <button className="rounded-2xl px-3 py-2 text-xs font-bold text-gray-600 bg-white/65 border border-white/70" onClick={() => {
                  if (typeof window === 'undefined') return;
                  saveRemoteConfigUrl(window.localStorage, '');
                  onRemoteUrlChange('');
                  onRefresh();
                }}>
                  Отключить URL
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-2xl px-3 py-2 text-xs font-bold text-white bg-slate-800" onClick={async () => {
                  await loadProactiveConfig();
                  onRefresh();
                }}>
                  Загрузить backend
                </button>
                <button className="rounded-2xl px-3 py-2 text-xs font-bold text-white bg-emerald-600" onClick={async () => {
                  if (!configText.trim()) return;
                  await publishProactiveConfig(JSON.parse(configText));
                  onRefresh();
                }}>
                  Publish backend
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                Cohort: <span className="font-bold text-lumio-text">{routineState.settings.abCohort}</span>
                {routineState.settings.remoteConfig ? ` · config ${routineState.settings.remoteConfig.version}` : ''}
                {proactiveConfig ? ` · backend ${proactiveConfig.version}` : ''}
              </p>
            </div>
            <div className="space-y-2">
              <textarea value={configText} onChange={event => onConfigTextChange(event.target.value)} placeholder='{"version":"local-admin","tuningConfig":{"activityScoreMultipliers":{"breakfast":1.2}}}' className="h-56 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-[11px] text-lumio-text outline-none" />
              <button className="w-full rounded-2xl px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100" onClick={async () => {
                if (typeof window === 'undefined' || !configText.trim()) return;
                const parsed = JSON.parse(configText);
                if (signatureSecret) parsed.signature = await signRemoteProactiveConfig(parsed, signatureSecret);
                saveRemoteProactiveConfig(window.localStorage, parsed);
                onRefresh();
              }}>
                Применить JSON локально
              </button>
            </div>
          </div>
        </Panel>
      )}
    </section>
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

function RuleWorkbench({
  rules,
  selectedRule,
  selectedRuleId,
  search,
  settings,
  debug,
  onSearch,
  onSelect,
  onChange,
}: {
  rules: ActivityRule[];
  selectedRule: ActivityRule;
  selectedRuleId: string;
  search: string;
  settings: ReturnType<typeof loadEffectiveProactiveRuntimeSettings>;
  debug: ReturnType<typeof getTimeOfDayActivityDebugReport>;
  onSearch: (value: string) => void;
  onSelect: (value: string) => void;
  onChange: () => void;
}) {
  const override = settings.configPatch?.activityRuleOverrides?.[selectedRule.activityId] ?? {};
  const effectiveRule = { ...selectedRule, ...override };
  const disabled = settings.tuningConfig.disabledActivityIds?.includes(selectedRule.activityId) ?? false;
  const multiplier = settings.tuningConfig.activityScoreMultipliers?.[selectedRule.activityId] ?? 1;
  const candidate = debug.candidates.find(item => item.activityId === selectedRule.activityId);
  const baseRuleList = settings.configPatch?.activityRules ?? DEFAULT_TIME_OF_DAY_ACTIVITY_CONFIG.activityRules;

  const saveSettings = (nextSettings: typeof settings) => {
    if (typeof window === 'undefined') return;
    saveProactiveRuntimeSettings(window.localStorage, nextSettings);
    onChange();
  };
  const saveRulePatch = (patch: Partial<ActivityRule>) => {
    saveSettings({
      ...settings,
      configPatch: {
        ...(settings.configPatch ?? {}),
        activityRuleOverrides: {
          ...(settings.configPatch?.activityRuleOverrides ?? {}),
          [selectedRule.activityId]: {
            ...(settings.configPatch?.activityRuleOverrides?.[selectedRule.activityId] ?? {}),
            ...patch,
          },
        },
      },
    });
  };

  return (
    <div className="grid lg:grid-cols-[0.55fr_1fr] gap-3">
      <div className="space-y-2">
        <input
          value={search}
          onChange={event => onSearch(event.target.value)}
          placeholder="Найти правило"
          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs text-lumio-text outline-none"
        />
        <button
          className="w-full rounded-2xl px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100"
          onClick={() => {
            const id = `custom_${Date.now()}`;
            const newRule: ActivityRule = {
              id,
              activityId: id,
              target: { kind: 'action', actionId: 'bond' },
              baseScore: 20,
              periodWeights: { morning: 10, day: 10, evening: 10 },
              message: 'Новое предложение.',
              reason: 'Пользовательское правило.',
              hardGuards: [{ type: 'awake' }],
            };
            if (typeof window === 'undefined') return;
            saveProactiveRuntimeSettings(window.localStorage, {
              ...settings,
              configPatch: {
                ...(settings.configPatch ?? {}),
                activityRules: [...baseRuleList, newRule],
              },
            });
            onSelect(id);
            onChange();
          }}
        >
          Новое правило
        </button>
        <div className="space-y-1 max-h-[420px] overflow-auto pr-1">
          {rules.map(rule => (
            <button
              key={rule.activityId}
              onClick={() => onSelect(rule.activityId)}
              className="w-full text-left rounded-2xl px-3 py-2 border"
              style={{
                background: selectedRuleId === rule.activityId ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.65)',
                borderColor: selectedRuleId === rule.activityId ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.7)',
              }}
            >
              <p className="text-xs font-bold text-lumio-text truncate">{rule.activityId}</p>
              <p className="text-[11px] text-gray-500 line-clamp-1">{rule.message}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          <TextSetting label="Ключ правила" value={selectedRule.activityId} disabled />
          <TextSetting label="Название" value={effectiveRule.id} onChange={value => saveRulePatch({ id: value })} />
          <TextSetting label="Фраза питомца" value={effectiveRule.message} onChange={value => saveRulePatch({ message: value })} />
          <TextSetting label="Зачем срабатывает" value={effectiveRule.reason} onChange={value => saveRulePatch({ reason: value })} />
          <NumberSetting label="Базовый приоритет" value={effectiveRule.baseScore} onChange={value => saveRulePatch({ baseScore: value })} />
          <NumberSetting label="Множитель" value={multiplier} onChange={value => {
            saveSettings({
              ...settings,
              tuningConfig: {
                ...settings.tuningConfig,
                activityScoreMultipliers: {
                  ...(settings.tuningConfig.activityScoreMultipliers ?? {}),
                  [selectedRule.activityId]: value,
                },
              },
            });
          }} />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/65 border border-white/70 px-3 py-2">
          <span className="text-xs font-bold text-lumio-text">Отключить правило</span>
          <input
            type="checkbox"
            checked={disabled}
            onChange={event => {
              const disabledIds = new Set(settings.tuningConfig.disabledActivityIds ?? []);
              if (event.target.checked) disabledIds.add(selectedRule.activityId);
              else disabledIds.delete(selectedRule.activityId);
              saveSettings({
                ...settings,
                tuningConfig: { ...settings.tuningConfig, disabledActivityIds: [...disabledIds] },
              });
            }}
          />
        </label>

        <div className="rounded-2xl bg-white/65 border border-white/70 p-3">
          <p className="text-xs font-bold text-lumio-text">Когда срабатывает</p>
          <div className="grid sm:grid-cols-5 gap-1 mt-2">
            {(Object.entries(effectiveRule.periodWeights) as Array<[DayPeriod, number]>).map(([period, value]) => (
              <NumberSetting
                key={period}
                label={DAY_PERIOD_LABELS[period]}
                value={value}
                onChange={nextValue => saveRulePatch({
                  periodWeights: {
                    ...effectiveRule.periodWeights,
                    [period]: nextValue,
                  },
                })}
              />
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Условия: {(effectiveRule.hardGuards ?? []).map(guard => guard.type).join(', ') || 'нет жестких условий'}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Действие: {effectiveRule.target ? JSON.stringify(effectiveRule.target) : 'нет'}
          </p>
        </div>

        <div className="rounded-2xl bg-white/65 border border-white/70 p-3">
          <p className="text-xs font-bold text-lumio-text">Preview сейчас</p>
          <p className={`text-sm font-bold mt-1 ${candidate?.blockedBy ? 'text-rose-600' : 'text-indigo-600'}`}>
            {candidate ? candidate.blockedBy ?? `score ${Math.round(candidate.score)}` : 'не попало в top candidates'}
          </p>
          {candidate && (
            <div className="grid sm:grid-cols-3 gap-1 mt-2">
              <Metric label="base" value={candidate.factors.baseScore} />
              <Metric label="period" value={candidate.factors.periodWeight} />
              <Metric label="personality" value={candidate.factors.personalityWeight} />
              <Metric label="stats" value={Math.round(candidate.factors.statUrgencyWeight)} />
              <Metric label="availability" value={candidate.factors.availabilityMultiplier} />
              <Metric label="tuning" value={candidate.factors.tuningMultiplier} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TextSetting({ label, value, disabled = false, onChange }: { label: string; value: string; disabled?: boolean; onChange?: (value: string) => void }) {
  return (
    <label className="rounded-2xl bg-white/65 border border-white/70 px-3 py-2">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={event => onChange?.(event.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-lumio-text outline-none disabled:text-gray-400"
      />
    </label>
  );
}

function NumberSetting({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="rounded-2xl bg-white/65 border border-white/70 px-3 py-2">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
      <input
        type="number"
        min={0}
        max={23}
        value={value}
        onChange={event => onChange(Math.max(0, Math.min(23, Number(event.target.value) || 0)))}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-1 text-sm font-bold text-lumio-text outline-none"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/60 border border-white/70 px-2 py-2 text-center">
      <p className="text-sm font-bold text-lumio-text">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}
