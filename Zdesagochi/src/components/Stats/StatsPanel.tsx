import { usePetStore } from '../../store/petStore';
import { getPersonality } from '@zdesagochi/personality-pet-preset';
import { StatBar } from '../personality/StatBar';
import type { StatConfig } from '../personality/StatBar';
import type { ActiveEmergentState, EmergentStateLayer, StatKey } from '../../personality/types';

const LAYER_COLORS: Record<EmergentStateLayer, string> = {
  gameplay: '#F59E0B',
  evolution: '#8B5CF6',
  cognitive: '#3B82F6',
};

function getActiveStatesFromLayers(stateLayers?: import('../../personality/types').PetStateLayers): ActiveEmergentState[] {
  if (!stateLayers) return [];
  return Object.values(stateLayers)
    .flatMap((states): ActiveEmergentState[] => {
      if (!states) return [];
      if (Array.isArray(states)) return states as ActiveEmergentState[];
      return [states as ActiveEmergentState];
    });
}

const STATS: StatConfig[] = [
  { key: 'hunger',      label: 'Сытость',    emoji: '🍔', color: '#F59E0B', bg: '#FEF3C7', warn: 25 },
  { key: 'happiness',   label: 'Радость',    emoji: '😊', color: '#EC4899', bg: '#FCE7F3', warn: 20 },
  { key: 'energy',      label: 'Энергия',    emoji: '⚡', color: '#8B5CF6', bg: '#EDE9FE', warn: 20 },
  { key: 'health',      label: 'Здоровье',   emoji: '❤️', color: '#EF4444', bg: '#FEE2E2', warn: 30 },
  { key: 'cleanliness', label: 'Чистота',    emoji: '🛁', color: '#3B82F6', bg: '#DBEAFE', warn: 20 },
  { key: 'bond',        label: 'Связь',      emoji: '💜', color: '#7C3AED', bg: '#EDE9FE', warn: 15 },
];

export function StatsPanel() {
  const { pet } = usePetStore();
  if (!pet) return null;

  const overallHealth = Math.round(
    Object.values(pet.stats).reduce((a, b) => a + b, 0) / Object.values(pet.stats).length
  );
  const healthEmoji = overallHealth >= 80 ? '🌟' : overallHealth >= 60 ? '✨' : overallHealth >= 40 ? '😐' : '🚨';

  const personalityDef = pet.personality ? getPersonality(pet.personality as any) : null;
  const statTints = personalityDef?.visualProfile.statBarTints ?? {};
  const activeStates = getActiveStatesFromLayers(pet.stateLayers);

  return (
    <div
      className="rounded-3xl p-5 space-y-3"
      style={{
        background: 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(124,58,237,0.10), inset 0 1px 0 rgba(255,255,255,0.8)',
        border: '1px solid rgba(255,255,255,0.7)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display font-bold text-lumio-text text-sm">Параметры</h3>
        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
          {healthEmoji} <span className="text-lumio-purple">{overallHealth}%</span>
        </span>
      </div>

      {STATS.map(config => (
        <StatBar
          key={config.key}
          config={config}
          value={pet.stats[config.key as StatKey]}
          tint={statTints[config.key as StatKey]}
        />
      ))}

      {activeStates.length > 0 && (
        <div className="pt-1 flex flex-wrap gap-1">
          {activeStates.map(state => (
            <span
              key={`${state.layer}-${state.type}`}
              className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{ background: LAYER_COLORS[state.layer] }}
              title={`Layer: ${state.layer}`}
            >
              {state.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
