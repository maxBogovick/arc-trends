import { Activity, CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { useApiActivityStore } from '@/store/apiActivityStore'
import { useApiModeStore } from '@/store/apiModeStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function StatusIcon({ status }: { status: 'pending' | 'success' | 'error' }) {
  if (status === 'pending') return <Clock3 size={12} className="text-yellow-400 animate-pulse" />
  if (status === 'success') return <CheckCircle2 size={12} className="text-green-400" />
  return <XCircle size={12} className="text-red-400" />
}

export function ApiActivityPanel() {
  const mode = useApiModeStore((state) => state.mode)
  const activities = useApiActivityStore((state) => state.activities)
  const clear = useApiActivityStore((state) => state.clear)
  const recent = activities.slice(0, 6)

  return (
    <div className="absolute left-4 bottom-4 w-[360px] max-w-[calc(100%-2rem)] bg-surface-200 border border-border rounded-lg shadow-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Activity size={13} className={mode === 'real' ? 'text-green-400' : 'text-white/35'} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white">Backend API calls</p>
          <p className="text-[10px] text-white/35 truncate">
            {mode === 'real' ? BASE_URL : 'Mock mode: switch to Real API to send HTTP requests'}
          </p>
        </div>
        {activities.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-[10px] text-white/35 hover:text-white transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {mode !== 'real' ? (
        <div className="px-3 py-2 text-xs text-white/45 leading-relaxed">
          Canvas actions use the same `apiClient` contract, but HTTP fetches are disabled while Mock is selected.
        </div>
      ) : recent.length === 0 ? (
        <div className="px-3 py-3 text-xs text-white/35">
          No REST calls yet. Move, resize, create, delete, or edit a layer.
        </div>
      ) : (
        <div className="max-h-44 overflow-y-auto">
          {recent.map((activity) => (
            <div key={activity.id} className="px-3 py-2 border-b border-border last:border-b-0">
              <div className="flex items-center gap-2">
                <StatusIcon status={activity.status} />
                <span className="text-[10px] font-semibold text-accent-light w-12">{activity.method}</span>
                <span className="text-xs text-white/70 truncate flex-1">{activity.path}</span>
                {activity.statusCode && (
                  <span className="text-[10px] text-white/35">{activity.statusCode}</span>
                )}
                {activity.durationMs !== undefined && (
                  <span className="text-[10px] text-white/35">{activity.durationMs}ms</span>
                )}
              </div>
              {activity.error && (
                <p className="text-[10px] text-red-300/80 mt-1 truncate">{activity.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
