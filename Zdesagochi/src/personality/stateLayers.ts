import type { Pet } from '../api/types';
import { EMERGENT_STATE_MAP } from './emergentStates';
import type { ActiveEmergentState, EmergentStateLayer, EmergentStateType } from './types';

const EVOLUTION_STATES = new Set<EmergentStateType>(['singularity', 'identity_crisis', 'shadow_form']);
const COGNITIVE_STATES = new Set<EmergentStateType>(['confused']);

export function getEmergentStateLayer(type: EmergentStateType): EmergentStateLayer {
  if (EVOLUTION_STATES.has(type)) return 'evolution';
  if (COGNITIVE_STATES.has(type)) return 'cognitive';
  return 'gameplay';
}

export function setLayeredEmergentState(
  pet: Pet,
  type: EmergentStateType,
  enteredAt: string,
): void {
  const layer = getEmergentStateLayer(type);
  const def = EMERGENT_STATE_MAP.get(type);
  const nextState: ActiveEmergentState = { type, layer, enteredAt };
  const currentStates = getLayerStates(pet, layer).filter(state => state.type !== type);
  const hasExclusiveState = currentStates.some(state => EMERGENT_STATE_MAP.get(state.type)?.exclusive);

  pet.stateLayers ??= {};
  pet.stateLayers[layer] = def?.exclusive || hasExclusiveState
    ? [nextState]
    : [...currentStates, nextState];
  syncLegacyEmergentState(pet);
}

export function clearLayeredEmergentState(
  pet: Pet,
  type: EmergentStateType,
): void {
  const layer = getEmergentStateLayer(type);
  const remaining = getLayerStates(pet, layer).filter(state => state.type !== type);
  if (remaining.length > 0) {
    pet.stateLayers ??= {};
    pet.stateLayers[layer] = remaining;
  } else if (pet.stateLayers?.[layer]) {
    delete pet.stateLayers[layer];
  }
  syncLegacyEmergentState(pet);
}

export function clearEmergentStateLayer(pet: Pet, layer: EmergentStateLayer): void {
  if (pet.stateLayers?.[layer]) delete pet.stateLayers[layer];
  syncLegacyEmergentState(pet);
}

export function isEvolutionManagedState(state: EmergentStateType | null | undefined): boolean {
  return state ? EVOLUTION_STATES.has(state) : false;
}

export function getActiveEmergentStates(pet: Pet): ActiveEmergentState[] {
  syncLayeredStatesFromLegacy(pet);
  return Object.values(pet.stateLayers ?? {})
    .flatMap(states => normalizeLayerValue(states))
    .sort((a, b) => getPriority(a.type) - getPriority(b.type));
}

export function getActiveEmergentStateTypes(pet: Pet): EmergentStateType[] {
  return getActiveEmergentStates(pet).map(state => state.type);
}

export function syncLayeredStatesFromLegacy(pet: Pet): void {
  pet.stateLayers ??= {};
  normalizeAllLayers(pet);

  if (pet.emergentState) {
    const layer = getEmergentStateLayer(pet.emergentState);
    const states = getLayerStates(pet, layer);
    if (!states.some(state => state.type === pet.emergentState)) {
      pet.stateLayers[layer] = [
        ...states,
        {
          type: pet.emergentState,
          layer,
          enteredAt: pet.emergentStateEnteredAt ?? pet.lastUpdated,
        },
      ];
    }
  }

  if (pet.confusedState) {
    const states = getLayerStates(pet, 'cognitive');
    if (!states.some(state => state.type === 'confused')) {
      pet.stateLayers.cognitive = [
        ...states,
        {
          type: 'confused',
          layer: 'cognitive',
          enteredAt: pet.lastUpdated,
        },
      ];
    }
  } else {
    const remaining = getLayerStates(pet, 'cognitive').filter(state => state.type !== 'confused');
    if (remaining.length > 0) pet.stateLayers.cognitive = remaining;
    else if (pet.stateLayers.cognitive) delete pet.stateLayers.cognitive;
  }

  syncLegacyEmergentState(pet);
}

export function syncLegacyEmergentState(pet: Pet): void {
  normalizeAllLayers(pet);
  const active = Object.values(pet.stateLayers ?? {}).flatMap(states => normalizeLayerValue(states));
  const primary = active
    .sort((a, b) => getPriority(a.type) - getPriority(b.type))[0];

  pet.emergentState = primary?.type ?? null;
  pet.emergentStateEnteredAt = primary?.enteredAt;
}

function getLayerStates(pet: Pet, layer: EmergentStateLayer): ActiveEmergentState[] {
  pet.stateLayers ??= {};
  const states = normalizeLayerValue(pet.stateLayers[layer]);
  pet.stateLayers[layer] = states;
  return states;
}

function normalizeAllLayers(pet: Pet): void {
  pet.stateLayers ??= {};
  for (const layer of Object.keys(pet.stateLayers) as EmergentStateLayer[]) {
    const states = normalizeLayerValue(pet.stateLayers[layer]);
    if (states.length > 0) pet.stateLayers[layer] = states;
    else delete pet.stateLayers[layer];
  }
}

function normalizeLayerValue(value: ActiveEmergentState[] | ActiveEmergentState | undefined): ActiveEmergentState[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getPriority(type: EmergentStateType): number {
  return EMERGENT_STATE_MAP.get(type)?.priority ?? 999;
}
