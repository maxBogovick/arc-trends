export type PerformanceQuality = 'auto' | 'high' | 'low';

export interface PerformancePolicyInput {
  quality: PerformanceQuality;
  prefersReducedMotion: boolean;
  visible: boolean;
  userAgent: string;
}

export interface PerformancePolicy {
  requestedQuality: PerformanceQuality;
  effectiveQuality: 'high' | 'low';
  visible: boolean;
  isSafari: boolean;
  prefersReducedMotion: boolean;
  motionEnabled: boolean;
  canvasEffectsEnabled: boolean;
  auraEffectsEnabled: boolean;
  patrolEnabled: boolean;
  targetFps: number;
  maxCanvasEffects: number;
  particleMultiplier: number;
}

export const PERFORMANCE_QUALITY_STORAGE_KEY = 'zdesagochi:performance-quality:v1';

export function isSafariUserAgent(userAgent: string): boolean {
  return /Safari/i.test(userAgent)
    && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/i.test(userAgent);
}

export function normalizePerformanceQuality(value: unknown): PerformanceQuality {
  return value === 'high' || value === 'low' || value === 'auto' ? value : 'auto';
}

export function resolvePerformancePolicy(input: PerformancePolicyInput): PerformancePolicy {
  const isSafari = isSafariUserAgent(input.userAgent);
  const effectiveQuality = input.quality === 'high'
    ? 'high'
    : input.quality === 'low' || input.prefersReducedMotion || isSafari
      ? 'low'
      : 'high';

  const visible = input.visible;
  const motionEnabled = visible && !input.prefersReducedMotion;
  const low = effectiveQuality === 'low';

  return {
    requestedQuality: input.quality,
    effectiveQuality,
    visible,
    isSafari,
    prefersReducedMotion: input.prefersReducedMotion,
    motionEnabled,
    canvasEffectsEnabled: motionEnabled && !low,
    auraEffectsEnabled: motionEnabled && !low,
    patrolEnabled: visible && !input.prefersReducedMotion && !low,
    targetFps: low ? 24 : 60,
    maxCanvasEffects: low ? 1 : 3,
    particleMultiplier: low ? 0.45 : 1,
  };
}

