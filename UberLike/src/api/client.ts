import type { ApiClient } from './contracts'
import { mockApiClient } from './mock'
import { realApiClient } from './real'
import type { RequestLog } from '@/shared/types'
import { uid } from '@/shared/utils/time'

type Mode = 'mock' | 'real'

let _mode: Mode = (localStorage.getItem('rl_api_mode') as Mode) ?? (import.meta.env.VITE_API_MODE as Mode) ?? 'mock'
export const requestLog: RequestLog[] = []

export function getApiMode(): Mode { return _mode }
export function setApiMode(m: Mode) { _mode = m; localStorage.setItem('rl_api_mode', m) }

function logged<T>(method: string, path: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  return fn().then(
    (v) => {
      requestLog.unshift({ id: uid(), method, path, status: 200, durationMs: Date.now() - start, ts: new Date().toISOString() })
      if (requestLog.length > 20) requestLog.length = 20
      return v
    },
    (e: Error) => {
      const code = parseInt(e.message.split(' ')[0]) || 500
      requestLog.unshift({ id: uid(), method, path, status: code, durationMs: Date.now() - start, ts: new Date().toISOString() })
      if (requestLog.length > 20) requestLog.length = 20
      throw e
    }
  )
}

export const apiClient: ApiClient = new Proxy({} as ApiClient, {
  get(_t, prop: string) {
    const client = _mode === 'mock' ? mockApiClient : realApiClient
    const fn = (client as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[prop]
    if (typeof fn !== 'function') return fn
    return (...args: unknown[]) => logged('*', String(prop), () => fn.apply(client, args))
  },
})
