import { createPersonalityEngine } from '../../packages/personality-core/src';
import { zdesagochiPetPreset } from '../../packages/personality-pet-preset/src';

export const appPersonalityEngine = createPersonalityEngine(zdesagochiPetPreset);
