import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePetStore } from '../../store/petStore';

const MOOD_COLOR: Record<string, string> = {
  ecstatic: '#F59E0B',
  happy:    '#10B981',
  content:  '#60A5FA',
  sad:      '#8B5CF6',
  tired:    '#6B7280',
  sick:     '#EF4444',
  sleeping: '#A78BFA',
};

const MOOD_LABEL: Record<string, string> = {
  ecstatic: 'Восторг',
  happy:    'Радость',
  content:  'Спокойствие',
  sad:      'Грусть',
  tired:    'Усталость',
  sick:     'Болезнь',
  sleeping: 'Сон',
};

export function MoodGraph() {
  const pet = usePetStore(s => s.pet);
  const history = useMemo(() => [...(pet?.moodHistory ?? [])].reverse(), [pet?.moodHistory]);
  const recent = useMemo(() => history.slice(-48), [history]);

  const dayLabels = useMemo(() => {
    const seen = new Set<string>();
    return recent.map((s, i) => {
      const day = s.timestamp.slice(5, 10); // MM-DD
      if (!seen.has(day)) { seen.add(day); return { i, label: day.replace('-', '/') }; }
      return null;
    }).filter((d): d is { i: number; label: string } => d !== null);
  }, [recent]);

  const hasEnoughData = recent.length >= 2;

  const W = 280;
  const H = 64;
  const pad = 4;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  // Нормализация avgStats 0–100 → 0–innerH
  const points = hasEnoughData ? recent.map((s, i) => {
    const x = pad + (i / (recent.length - 1)) * innerW;
    const y = pad + innerH - (s.avgStats / 100) * innerH;
    return { x, y, mood: s.mood, avg: s.avgStats };
  }) : [];

  const pathD = points.reduce((d, p, i) =>
    i === 0 ? `M ${p.x} ${p.y}` : `${d} L ${p.x} ${p.y}`, '');

  const fillD = points.length >= 2
    ? `${pathD} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`
    : '';

  // Текущее настроение
  const current = pet?.moodHistory?.[0];
  const currentColor = MOOD_COLOR[current?.mood ?? 'content'] ?? '#60A5FA';

  if (!pet || !hasEnoughData) {
    return (
      <div className="rounded-3xl p-5 glass">
        <h3 className="font-bold text-lumio-text text-sm mb-3">📈 История настроения</h3>
        <p className="text-xs text-lumio-muted text-center py-6">
          Данные появятся после нескольких синхронизаций
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl p-5 glass space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lumio-text text-sm">📈 История настроения</h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${currentColor}20`, color: currentColor }}>
          {MOOD_LABEL[current?.mood ?? 'content']}
        </span>
      </div>

      {/* SVG График */}
      <div className="relative overflow-hidden rounded-xl" style={{ background: 'rgba(248,245,255,0.8)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 72 }}>
          {/* Сетка */}
          {[25, 50, 75].map(v => (
            <line key={v}
              x1={pad} y1={pad + innerH - (v / 100) * innerH}
              x2={W - pad} y2={pad + innerH - (v / 100) * innerH}
              stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" strokeDasharray="3,3"
            />
          ))}

          {/* Заливка под кривой */}
          <defs>
            <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={currentColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={currentColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {fillD && <path d={fillD} fill="url(#moodFill)" />}

          {/* Линия */}
          {pathD && (
            <motion.path
              d={pathD}
              fill="none"
              stroke={currentColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          )}

          {/* Цветные точки по mood */}
          {points.filter((_, i) => i % 6 === 0).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.5}
              fill={MOOD_COLOR[p.mood] ?? '#60A5FA'}
              stroke="white" strokeWidth="1"
            />
          ))}
        </svg>

        {/* Метки дней */}
        {dayLabels.slice(0, 3).map((d) => d && (
          <span key={d.label}
            className="absolute bottom-0.5 text-[8px] text-gray-400 font-medium"
            style={{ left: `${(d.i / recent.length) * 100}%` }}>
            {d.label}
          </span>
        ))}
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(MOOD_COLOR).map(([mood, color]) => (
          <span key={mood} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            {MOOD_LABEL[mood]}
          </span>
        ))}
      </div>
    </div>
  );
}
