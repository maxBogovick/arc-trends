import { useState } from 'react'
import { Bug, X, Circle } from 'lucide-react'
import { useApiModeStore } from '@/store/apiModeStore'
import { useSessionStore } from '@/store/sessionStore'
import { useRideStore } from '@/store/rideStore'
import { requestLog } from '@/api/client'
import { mockSimControls } from '@/realtime'

type Tab = 'info' | 'requests' | 'events' | 'sim'

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('info')
  const { mode, connectionStatus, eventLog } = useApiModeStore()
  const { role, userId } = useSessionStore()
  const { currentRide, idempotencyKey } = useRideStore()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed z-40 w-9 h-9 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors shadow-card"
        style={{ bottom: '120px', left: '16px' }}
        title="Debug panel"
      >
        <Bug size={14} />
      </button>

      {open && (
        <div
          className="fixed z-50 w-80 bg-white border border-slate-200 rounded-2xl shadow-deep flex flex-col overflow-hidden slide-up"
          style={{ bottom: '120px', left: '56px', maxHeight: 'calc(100vh - 200px)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-slate-800 text-xs font-semibold flex items-center gap-1.5">
              <Bug size={12} className="text-slate-500" />
              Debug Panel
            </span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="flex border-b border-slate-100">
            {(['info', 'requests', 'events', 'sim'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-[10px] font-medium capitalize transition-colors border-b-2 ${
                  tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 p-3 text-[11px]">
            {tab === 'info' && (
              <div className="space-y-2">
                <Row label="API Mode">
                  <span className={`font-medium ${mode === 'mock' ? 'text-violet-600' : 'text-brand-600'}`}>{mode}</span>
                </Row>
                <Row label="WS Status">
                  <span className={`font-medium ${
                    connectionStatus === 'connected' ? 'text-green-600'
                    : connectionStatus === 'mock' ? 'text-violet-600'
                    : connectionStatus === 'error' ? 'text-red-600' : 'text-amber-600'
                  }`}>{connectionStatus}</span>
                </Row>
                <Row label="Role"><span className="text-slate-700 font-medium capitalize">{role}</span></Row>
                <Row label="User ID"><code className="text-slate-600">{userId}</code></Row>
                <Row label="Ride ID"><code className="text-slate-600">{currentRide?.id ?? '—'}</code></Row>
                <Row label="Ride Status"><span className="text-slate-700">{currentRide?.status ?? '—'}</span></Row>
                <div className="pt-2 mt-2 border-t border-slate-100 space-y-1.5">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider">Idempotency Key</p>
                  <code className="text-brand-700 text-[9px] break-all block leading-relaxed bg-brand-50 px-2 py-1.5 rounded-lg">
                    {idempotencyKey}
                  </code>
                </div>
                <div className="pt-1 border-t border-slate-100">
                  <p className="text-slate-400 text-[10px] mb-1">Backend URL</p>
                  <code className="text-slate-500 text-[9px] break-all">{import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}</code>
                </div>
              </div>
            )}

            {tab === 'requests' && (
              <div className="space-y-0.5">
                {requestLog.length === 0 && <p className="text-slate-400 italic py-2">No requests yet</p>}
                {requestLog.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-slate-50">
                    <span className={`w-8 shrink-0 font-mono font-semibold text-right ${r.status >= 400 ? 'text-red-500' : 'text-brand-600'}`}>
                      {r.status}
                    </span>
                    <span className="text-slate-500 truncate flex-1">{r.path}</span>
                    <span className="text-slate-300 shrink-0">{r.durationMs}ms</span>
                  </div>
                ))}
              </div>
            )}

            {tab === 'events' && (
              <div className="space-y-0.5">
                {eventLog.length === 0 && <p className="text-slate-400 italic py-2">No events yet</p>}
                {eventLog.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 py-1.5 border-b border-slate-50">
                    <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 ${
                      e.direction === 'in' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                    }`}>
                      {e.direction}
                    </span>
                    <div className="min-w-0">
                      <p className="text-slate-600 truncate font-medium">{e.type}</p>
                      <p className="text-slate-300 text-[9px]">{new Date(e.ts).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'sim' && (
              <div className="space-y-5 py-1">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-slate-500">Mock Latency</label>
                    <span className="text-slate-700 font-medium">{mockSimControls.latencyMs}ms</span>
                  </div>
                  <input
                    type="range" min={0} max={2000} step={50}
                    value={mockSimControls.latencyMs}
                    onChange={(e) => { mockSimControls.latencyMs = parseInt(e.target.value) }}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-slate-500">Failure Rate</label>
                    <span className="text-slate-700 font-medium">{Math.round(mockSimControls.failureRate * 100)}%</span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={mockSimControls.failureRate}
                    onChange={(e) => { mockSimControls.failureRate = parseFloat(e.target.value) }}
                    className="w-full"
                  />
                </div>
                <p className="text-slate-400 text-[10px] leading-relaxed bg-slate-50 rounded-lg p-2.5">
                  Latency adds artificial delay to mock events. Failure rate triggers random ride cancellations during simulation.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}
