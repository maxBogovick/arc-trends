import { create } from 'zustand'

export type ApiActivityStatus = 'pending' | 'success' | 'error'

export interface ApiActivity {
  id: string
  method: string
  path: string
  status: ApiActivityStatus
  startedAt: number
  durationMs?: number
  statusCode?: number
  error?: string
}

interface ApiActivityState {
  activities: ApiActivity[]
  begin: (method: string, path: string) => string
  complete: (id: string, statusCode: number) => void
  fail: (id: string, error: string, statusCode?: number) => void
  clear: () => void
}

function activityId() {
  return `api-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useApiActivityStore = create<ApiActivityState>()((set) => ({
  activities: [],

  begin(method, path) {
    const id = activityId()
    const activity: ApiActivity = {
      id,
      method,
      path,
      status: 'pending',
      startedAt: Date.now(),
    }
    set((state) => ({ activities: [activity, ...state.activities].slice(0, 30) }))
    return id
  },

  complete(id, statusCode) {
    set((state) => ({
      activities: state.activities.map((activity) =>
        activity.id === id
          ? {
              ...activity,
              status: 'success',
              statusCode,
              durationMs: Date.now() - activity.startedAt,
            }
          : activity
      ),
    }))
  },

  fail(id, error, statusCode) {
    set((state) => ({
      activities: state.activities.map((activity) =>
        activity.id === id
          ? {
              ...activity,
              status: 'error',
              statusCode,
              error,
              durationMs: Date.now() - activity.startedAt,
            }
          : activity
      ),
    }))
  },

  clear() {
    set({ activities: [] })
  },
}))
