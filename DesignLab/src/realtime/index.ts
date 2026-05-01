import type { RealtimeAdapter } from './types'
import { createMockAdapter } from './mockAdapter'
import { createRealAdapter } from './realAdapter'
import { getApiMode } from '@/api/client'

export type { RealtimeAdapter } from './types'

let _adapter: RealtimeAdapter | null = null

export function getRealtimeAdapter(): RealtimeAdapter {
  const mode = getApiMode()
  if (!_adapter) {
    _adapter = mode === 'mock' ? createMockAdapter() : createRealAdapter()
  }
  return _adapter
}

export function resetRealtimeAdapter() {
  _adapter?.disconnect()
  _adapter = null
}
