import { useEffect, useMemo, useState } from 'react';
import {
  PERFORMANCE_QUALITY_STORAGE_KEY,
  normalizePerformanceQuality,
  resolvePerformancePolicy,
  type PerformancePolicy,
  type PerformanceQuality,
} from './performancePolicy';

function readStoredQuality(): PerformanceQuality {
  if (typeof window === 'undefined') return 'auto';
  return normalizePerformanceQuality(window.localStorage.getItem(PERFORMANCE_QUALITY_STORAGE_KEY));
}

function getUserAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

function getDocumentVisible(): boolean {
  return typeof document === 'undefined' ? true : !document.hidden;
}

function getReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function usePerformancePolicy(): PerformancePolicy & {
  setQuality: (quality: PerformanceQuality) => void;
} {
  const [quality, setQualityState] = useState<PerformanceQuality>(readStoredQuality);
  const [visible, setVisible] = useState(getDocumentVisible);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getReducedMotion);

  useEffect(() => {
    const onVisibility = () => setVisible(getDocumentVisible());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setQuality = (next: PerformanceQuality) => {
    const normalized = normalizePerformanceQuality(next);
    setQualityState(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PERFORMANCE_QUALITY_STORAGE_KEY, normalized);
    }
  };

  return {
    ...useMemo(() => resolvePerformancePolicy({
      quality,
      prefersReducedMotion,
      visible,
      userAgent: getUserAgent(),
    }), [quality, prefersReducedMotion, visible]),
    setQuality,
  };
}

