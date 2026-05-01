import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useApiModeStore } from '@/store/apiModeStore'

const CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  mock: { label: 'Mock', color: 'text-purple-400', icon: CheckCircle2 },
  connecting: { label: 'Connecting…', color: 'text-yellow-400', icon: RefreshCw },
  connected: { label: 'Connected', color: 'text-green-400', icon: Wifi },
  offline: { label: 'Offline', color: 'text-white/30', icon: WifiOff },
  error: { label: 'Error', color: 'text-red-400', icon: AlertCircle },
}

export function ConnectionStatus() {
  const { connectionStatus } = useApiModeStore()
  const cfg = CONFIG[connectionStatus] ?? CONFIG.offline
  const Icon = cfg.icon

  return (
    <div className={`flex items-center gap-1.5 text-xs ${cfg.color}`}>
      <Icon size={12} className={connectionStatus === 'connecting' ? 'animate-spin' : ''} />
      <span>{cfg.label}</span>
    </div>
  )
}
