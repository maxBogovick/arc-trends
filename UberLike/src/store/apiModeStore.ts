import { create } from 'zustand'
import type { ApiMode, ConnectionStatus, EventLog } from '@/shared/types'
import { setApiMode, getApiMode } from '@/api/client'
import { resetRealtimeAdapter } from '@/realtime'

interface ApiModeState {
  mode: ApiMode
  connectionStatus: ConnectionStatus
  eventLog: EventLog[]
  setMode(m: ApiMode): void
  setConnectionStatus(s: ConnectionStatus): void
  pushEvent(ev: Omit<EventLog, 'id' | 'ts'>): void
}

export const useApiModeStore = create<ApiModeState>()((set) => ({
  mode: getApiMode(),
  connectionStatus: getApiMode() === 'mock' ? 'mock' : 'connecting',
  eventLog: [],

  setMode(mode) {
    setApiMode(mode)
    resetRealtimeAdapter()
    set({ mode, connectionStatus: mode === 'mock' ? 'mock' : 'connecting' })
  },

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  pushEvent(ev) {
    set((s) => ({
      eventLog: [{ ...ev, id: Math.random().toString(36).slice(2), ts: new Date().toISOString() }, ...s.eventLog].slice(0, 30),
    }))
  },
}))
