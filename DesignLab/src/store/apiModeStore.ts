import { create } from 'zustand'
import type { ApiMode, ConnectionStatus } from '@/shared/types'
import { setApiMode, getApiMode } from '@/api/client'
import { resetRealtimeAdapter } from '@/realtime'

interface ApiModeState {
  mode: ApiMode
  connectionStatus: ConnectionStatus
  setMode: (mode: ApiMode) => void
  setConnectionStatus: (status: ConnectionStatus) => void
}

export const useApiModeStore = create<ApiModeState>()((set) => ({
  mode: getApiMode(),
  connectionStatus: getApiMode() === 'mock' ? 'mock' : 'connecting',

  setMode(mode: ApiMode) {
    setApiMode(mode)
    resetRealtimeAdapter()
    set({ mode, connectionStatus: mode === 'mock' ? 'mock' : 'connecting' })
  },

  setConnectionStatus(status: ConnectionStatus) {
    set({ connectionStatus: status })
  },
}))
