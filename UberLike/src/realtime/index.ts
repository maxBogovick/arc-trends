import type { RealtimeAdapter } from './types'
import { getMockAdapter, resetMockAdapter } from './mockAdapter'
import { createRealAdapter } from './realAdapter'
import { getApiMode } from '@/api/client'

export type { RealtimeAdapter } from './types'
export { mockSimControls } from './mockAdapter'

let _realAdapter: RealtimeAdapter | null = null

export function getRealtimeAdapter(): RealtimeAdapter {
  if (getApiMode() === 'mock') return getMockAdapter()
  if (!_realAdapter) _realAdapter = createRealAdapter()
  return _realAdapter
}

export function resetRealtimeAdapter() {
  resetMockAdapter()
  _realAdapter?.disconnect()
  _realAdapter = null
}
