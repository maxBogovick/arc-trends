import type { ApiClient } from './contracts'
import { mockApiClient } from './mock'
import { realApiClient } from './real'

type ApiMode = 'mock' | 'real'

let _mode: ApiMode = (localStorage.getItem('dl_api_mode') as ApiMode) ?? (import.meta.env.VITE_API_MODE as ApiMode) ?? 'mock'

export function getApiMode(): ApiMode {
  return _mode
}

export function setApiMode(mode: ApiMode) {
  _mode = mode
  localStorage.setItem('dl_api_mode', mode)
}

export const apiClient: ApiClient = new Proxy({} as ApiClient, {
  get(_target, prop) {
    const client = _mode === 'mock' ? mockApiClient : realApiClient
    return (client as unknown as Record<string | symbol, unknown>)[prop]
  },
})
