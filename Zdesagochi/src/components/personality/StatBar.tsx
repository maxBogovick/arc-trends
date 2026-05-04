import { motion } from 'framer-motion';
import type { StatBarTint } from '../../personality/types';

export interface StatConfig {
  key: string;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  warn: number;
}

export interface StatBarProps {
  config: StatConfig;
  value: number;
  tint?: StatBarTint;
}

function resolveBarColor(pct: number, base: string, tint?: StatBarTint): string {
  if (!tint) return pct <= 25 ? '#EF4444' : base;
  if (pct <= tint.criticalThreshold) return tint.criticalColor;
  if (pct <= tint.warningThreshold)  return tint.warningColor;
  return base;
}

export function StatBar({ config, value, tint }: StatBarProps) {
  const pct      = Math.max(0, Math.min(100, value));
  const warnPct  = tint ? tint.warningThreshold : config.warn;
  const isLow    = pct <= warnPct;
  const barColor = resolveBarColor(pct, config.color, tint);
  const shouldPulse = isLow && (tint?.pulseOnWarning ?? true);

  return (
    <motion.div
      className="flex items-center gap-2.5"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="text-lg w-6 shrink-0">{config.emoji}</span>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-xs font-semibold text-lumio-muted">{config.label}</span>
          <motion.span
            className="text-xs font-bold"
            style={{ color: barColor }}
            key={Math.floor(value / 5)}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {Math.round(pct)}
          </motion.span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: config.bg }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${barColor}BB, ${barColor})` }}
            initial={false}
            animate={shouldPulse
              ? { width: `${pct}%`, opacity: [1, 0.6, 1] }
              : { width: `${pct}%` }}
            transition={shouldPulse
              ? { width: { duration: 0.5, ease: 'easeOut' }, opacity: { duration: 1.2, repeat: Infinity } }
              : { duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>
      {isLow && (
        <motion.span
          className="text-sm"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >⚠️</motion.span>
      )}
    </motion.div>
  );
}
