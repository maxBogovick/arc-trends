import { validateActionRules } from '../../personality-core/src/actionRules';
import { validateDecayRules } from '../../personality-core/src/decayRules';
import { PERSONALITY_ENGINE_VERSION, STATIC_REGISTRY_VERSION } from '../../personality-core/src/engineVersion';
import {
  getIntensityMultiplier,
  STATIC_INFLUENCE_REGISTRY,
  validateInfluenceRegistry,
} from './influenceRegistry';
import { createMemoryTextGenerator } from './memoryTextGenerator';
import { validatePassiveRules } from '../../personality-core/src/passiveRules';
import { validatePatternRules } from '../../personality-core/src/patternRules';
import { PERSONALITIES, validatePersonalitySpecialRules } from './personalities';
import type { PersonalityPreset } from '../../personality-core/src/engineFactory';

export const zdesagochiPetPreset: PersonalityPreset = {
  id: 'zdesagochi-pet',
  name: 'Zdesagochi Pet',
  personalities: PERSONALITIES,
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
