import { motion } from 'framer-motion';
import { usePetStore } from '../../store/petStore';

interface StatConfig {
  key: keyof import('../../api').PetStats;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  warn: number;
}

const STATS: StatConfig[] = [
  { key: 'hunger',      label: 'Сытость',    emoji: '🍔', color: '#F59E0B', bg: '#FEF3C7', warn: 25 },
  { key: 'happiness',   label: 'Радость',    emoji: '😊', color: '#EC4899', bg: '#FCE7F3', warn: 20 },
  { key: 'energy',      label: 'Энергия',    emoji: '⚡', color: '#8B5CF6', bg: '#EDE9FE', warn: 20 },
  { key: 'health',      label: 'Здоровье',   emoji: '❤️', color: '#EF4444', bg: '#FEE2E2', warn: 30 },
  { key: 'cleanliness', label: 'Чистота',    emoji: '🛁', color: '#3B82F6', bg: '#DBEAFE', warn: 20 },
  { key: 'bond',        label: 'Связь',      emoji: '💜', color: '#7C3AED', bg: '#EDE9FE', warn: 15 },
];

function StatBar({ config, value }: { config: StatConfig; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const isLow = pct <= config.warn;
  const barColor = isLow ? '#EF4444' : config.color;

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
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
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

export function StatsPanel() {
  const { pet } = usePetStore();
  if (!pet) return null;

  const overallHealth = Math.round(
    Object.values(pet.stats).reduce((a, b) => a + b, 0) / Object.values(pet.stats).length
  );

  const healthEmoji = overallHealth >= 80 ? '🌟' : overallHealth >= 60 ? '✨' : overallHealth >= 40 ? '😐' : '🚨';

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
        <StatBar key={config.key} config={config} value={pet.stats[config.key]} />
      ))}
    </div>
  );
}
