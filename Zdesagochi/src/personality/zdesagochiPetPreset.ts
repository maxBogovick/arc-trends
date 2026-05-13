import { validateActionRules } from './actionRules';
import { validateDecayRules } from './decayRules';
import { PERSONALITY_ENGINE_VERSION, STATIC_REGISTRY_VERSION } from './engineVersion';
import {
  getIntensityMultiplier,
  STATIC_INFLUENCE_REGISTRY,
  validateInfluenceRegistry,
} from './influenceRegistry';
import { createMemoryTextGenerator } from './memoryTextGenerator';
import { validatePassiveRules } from './passiveRules';
import { validatePatternRules } from './patternRules';
import { validatePersonalitySpecialRules } from './personalities';
import type { PersonalityPreset } from './engineFactory';

export const zdesagochiPetPreset: PersonalityPreset = {
  id: 'zdesagochi-pet',
  name: 'Zdesagochi Pet',
  influenceRegistry: STATIC_INFLUENCE_REGISTRY,
  getIntensityMultiplier,
  memoryTextGenerator: createMemoryTextGenerator(),
  engineVersion: PERSONALITY_ENGINE_VERSION,
  registryVersion: STATIC_REGISTRY_VERSION,
  validate() {
    validateInfluenceRegistry(STATIC_INFLUENCE_REGISTRY);
    validateActionRules();
    validatePassiveRules();
    validateDecayRules();
    validatePatternRules();
    return validatePersonalitySpecialRules().map(issue => ({
      severity: issue.severity,
      message: `${issue.personalityId}.${issue.rule}: ${issue.message}`,
    }));
  },
};
