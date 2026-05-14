export * from '../../packages/personality-core/src/TraitEvolutionEngine';

import {
  acceptEvolution as acceptCoreEvolution,
  checkEvolution as checkCoreEvolution,
  checkThresholdCrossings as checkCoreThresholdCrossings,
  checkWeeklyDrift as checkCoreWeeklyDrift,
  collapseSingularity as collapseCoreSingularity,
  completeFormation as completeCoreFormation,
  detectSingularity as detectCoreSingularity,
  recordLegacy as recordCoreLegacy,
  type TraitEvolutionContext,
} from '../../packages/personality-core/src/TraitEvolutionEngine';
import type {
  PersonalityAccount,
  PersonalityNamedState,
  PersonalityState,
} from '../../packages/personality-core/src/coreState';
import type { TraitVector } from '../../packages/personality-core/src/types';
import { getIntensityMultiplier } from './influenceRegistry';
import { createMemoryTextGenerator } from './memoryTextGenerator';
import { PERSONALITIES } from './personalities';

export function completeFormation(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  completeCoreFormation(pet, withZdesagochiEvolutionDefaults(ctx));
}

export function checkEvolution(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  checkCoreEvolution(pet, withZdesagochiEvolutionDefaults(ctx));
}

export function acceptEvolution(pet: PersonalityState, ctx: TraitEvolutionContext = {}): boolean {
  return acceptCoreEvolution(pet, withZdesagochiEvolutionDefaults(ctx));
}

export function detectSingularity(pet: PersonalityState, ctx: TraitEvolutionContext = {}) {
  return detectCoreSingularity(pet, withZdesagochiEvolutionDefaults(ctx));
}

export function collapseSingularity(pet: PersonalityState, ctx: TraitEvolutionContext = {}): void {
  collapseCoreSingularity(pet, withZdesagochiEvolutionDefaults(ctx));
}

export function recordLegacy(
  account: PersonalityAccount,
  pet: PersonalityNamedState,
  ctx: TraitEvolutionContext = {},
): PersonalityAccount {
  return recordCoreLegacy(account, pet, withZdesagochiEvolutionDefaults(ctx));
}

export function checkThresholdCrossings(
  pet: PersonalityState,
  prevVector: TraitVector,
  ctx: TraitEvolutionContext = {},
): Promise<void> {
  return checkCoreThresholdCrossings(pet, prevVector, withZdesagochiEvolutionDefaults(ctx));
}

export function checkWeeklyDrift(
  pet: PersonalityState,
  ctx: TraitEvolutionContext = {},
): Promise<void> {
  return checkCoreWeeklyDrift(pet, withZdesagochiEvolutionDefaults(ctx));
}

function withZdesagochiEvolutionDefaults(ctx: TraitEvolutionContext): TraitEvolutionContext {
  return {
    ...ctx,
    personalities: ctx.personalities ?? PERSONALITIES,
    getIntensityMultiplier: ctx.getIntensityMultiplier ?? getIntensityMultiplier,
    memoryTextGenerator: ctx.memoryTextGenerator ?? createMemoryTextGenerator(),
  };
}
