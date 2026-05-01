import { useState, useEffect, useRef } from 'react'
import { Car, Users, Clock, TrendingDown, CheckCircle2, Activity, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useAdminMetrics, useAdminRealtime } from '@/features/admin/useAdmin'
import { useApiModeStore } from '@/store/apiModeStore'
import { requestLog } from '@/api/client'
import type { EventLog, RequestLog } from '@/shared/types'

type FeedEntry =
  | { kind: 'http'; entry: RequestLog }
  | { kind: 'ws';   entry: EventLog }

// ── Mini sparkline SVG ────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="w-14 h-5" />
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const W = 56, H = 20
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W
      const y = H - ((v - min) / range) * (H - 3) - 1.5
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={W} height={H} className="opacity-50" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────

function MetricCard({
  icon, label, value, sub, color = 'slate', sparkData, sparkColor,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: 'slate' | 'green' | 'amber' | 'red' | 'blue'
  sparkData?: number[]
  sparkColor?: string
}) {
  const accent: Record<string, string> = {
    slate: 'text-slate-400',
    green: 'text-green-600',
    amber: 'text-amber-500',
    red:   'text-red-500',
    blue:  'text-blue-600',
  }
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-slate-100 min-w-[140px]">
      <div className={`shrink-0 ${accent[color]}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-slate-900 font-black text-lg leading-none tabular-nums">{value}</p>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mt-0.5 font-medium">{label}</p>
        {sub && <p className="text-slate-300 text-[10px] mt-0.5">{sub}</p>}
      </div>
      {sparkData && sparkData.length >= 2 && (
        <Sparkline data={sparkData} color={sparkColor ?? '#94a3b8'} />
      )}
    </div>
  )
}

function HttpBadge({ status }: { status: number }) {
  const ok = status < 300
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
      {status}
    </span>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────

const MAX_HIST = 20

export function BottomBar() {
  useAdminRealtime()

  const { data: metrics } = useAdminMetrics()
  const { eventLog } = useApiModeStore()

  // Metric history for sparklines
  const hist = useRef<{
    activeRides: number[]
    drivers:     number[]
    wait:        number[]
    completed:   number[]
  }>({ activeRides: [], drivers: [], wait: [], completed: [] })

  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Accumulate metric history
  useEffect(() => {
    if (!metrics) return
    const h = hist.current
    const push = (arr: number[], v: number) => [...arr.slice(-(MAX_HIST - 1)), v]
    h.activeRides = push(h.activeRides, metrics.activeRides)
    h.drivers     = push(h.drivers,     metrics.availableDrivers)
    h.wait        = push(h.wait,        metrics.avgWaitMinutes)
    h.completed   = push(h.completed,   metrics.completedToday)
  }, [metrics])

  const combined: FeedEntry[] = [
    ...requestLog.map(e => ({ kind: 'http' as const, entry: e })),
    ...eventLog.map(e => ({ kind: 'ws' as const, entry: e })),
  ]
    .sort((a, b) => new Date(b.entry.ts).getTime() - new Date(a.entry.ts).getTime())
    .slice(0, 24)

  const h = hist.current

  return (
    <div className="h-[108px] border-t border-slate-200 bg-slate-50 flex items-stretch shrink-0 overflow-hidden">
      {/* Metrics */}
      <div
        className="flex items-center gap-2 px-4 overflow-x-auto shrink-0"
        style={{ scrollbarWidth: 'none', maxWidth: 740 }}
      >
        <MetricCard
          icon={<Car size={17} />}
          label="Active rides"
          value={metrics?.activeRides ?? '—'}
          color="blue"
          sparkData={h.activeRides}
          sparkColor="#3b82f6"
        />
        <MetricCard
          icon={<Users size={17} />}
          label="Drivers online"
          value={metrics?.availableDrivers ?? '—'}
          color="green"
          sparkData={h.drivers}
          sparkColor="#16a34a"
        />
        <MetricCard
          icon={<Clock size={17} />}
          label="Avg wait"
          value={metrics ? `${metrics.avgWaitMinutes} min` : '—'}
          color={metrics && metrics.avgWaitMinutes > 5 ? 'amber' : 'slate'}
          sparkData={h.wait}
          sparkColor={metrics && metrics.avgWaitMinutes > 5 ? '#f59e0b' : '#94a3b8'}
        />
        <MetricCard
          icon={<CheckCircle2 size={17} />}
          label="Completed today"
          value={metrics?.completedToday ?? '—'}
          color="green"
          sparkData={h.completed}
          sparkColor="#22c55e"
        />
        <MetricCard
          icon={<TrendingDown size={17} />}
          label="Cancellation"
          value={metrics ? `${(metrics.cancellationRate * 100).toFixed(0)}%` : '—'}
          color={metrics && metrics.cancellationRate > 0.1 ? 'red' : 'slate'}
        />
      </div>

      {/* Divider */}
      <div className="w-px bg-slate-200 mx-1 self-stretch" />

      {/* Live activity feed */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-3 overflow-hidden">
        <div className="flex items-center gap-2 mb-1.5">
          <Activity size={10} className="text-slate-400" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Live Activity</p>
          <span className="text-[9px] text-slate-300">{combined.length} events</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {combined.length === 0 && (
            <p className="text-slate-300 text-xs italic">No activity yet…</p>
          )}
          {combined.map(item =>
            item.kind === 'http' ? (
              <div
                key={item.entry.id}
                className="shrink-0 flex items-center gap-1.5 bg-white border border-slate-100 rounded-lg px-2 py-1.5"
              >
                <ArrowUpRight size={9} className="text-slate-300" />
                <span className="text-[10px] font-mono text-slate-500">{item.entry.method}</span>
                <span className="text-[10px] text-slate-600 max-w-[90px] truncate">
                  {item.entry.path.split('/').slice(-2).join('/')}
                </span>
                <HttpBadge status={item.entry.status} />
                <span className="text-[9px] text-slate-300">{item.entry.durationMs}ms</span>
              </div>
            ) : (
              <div
                key={item.entry.id}
                className="shrink-0 flex items-center gap-1.5 bg-white border border-slate-100 rounded-lg px-2 py-1.5"
              >
                <ArrowDownLeft size={9} className={item.entry.direction === 'in' ? 'text-brand-500' : 'text-slate-300'} />
                <span className="text-[10px] text-slate-600 max-w-[120px] truncate font-medium">
                  {item.entry.type}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
