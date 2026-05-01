import type { RealtimeAdapter, IncomingEventName, EventHandler, OutgoingEvents } from './types'
import type { ConnectionStatus } from '@/shared/types'

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws'

type HandlerMap = { [K in IncomingEventName]?: Set<EventHandler<K>> }

export function createRealAdapter(): RealtimeAdapter {
  const handlers: HandlerMap = {}
  const statusListeners = new Set<(s: ConnectionStatus) => void>()
  let status: ConnectionStatus = 'connecting'
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let channel: string | null = null

  function setStatus(s: ConnectionStatus) {
    status = s
    statusListeners.forEach((cb) => cb(s))
  }

  function emit<K extends IncomingEventName>(event: K, data: Parameters<EventHandler<K>>[0]) {
    const set = handlers[event] as Set<EventHandler<K>> | undefined
    set?.forEach((h) => h(data as Parameters<EventHandler<K>>[0]))
  }

  function connect(ch: string) {
    channel = ch
    setStatus('connecting')
    try {
      ws = new WebSocket(`${WS_BASE}/${ch}`)
      ws.onopen = () => setStatus('connected')
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { type: IncomingEventName; data: unknown }
          emit(msg.type, msg.data as Parameters<EventHandler<typeof msg.type>>[0])
        } catch { /* ignore */ }
      }
      ws.onclose = () => {
        setStatus('offline')
        if (channel) reconnectTimer = setTimeout(() => connect(ch), 3000)
      }
      ws.onerror = () => { setStatus('error'); ws?.close() }
    } catch { setStatus('error') }
  }

  return {
    connect,
    disconnect() {
      channel = null
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close(); ws = null
    },
    send<K extends keyof OutgoingEvents>(event: K, data: OutgoingEvents[K]) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: event, data }))
    },
    on<K extends IncomingEventName>(event: K, handler: EventHandler<K>) {
      if (!handlers[event]) (handlers as Record<string, Set<EventHandler<IncomingEventName>>>)[event] = new Set()
      ;(handlers[event] as Set<EventHandler<K>>).add(handler)
      return () => { ;(handlers[event] as Set<EventHandler<K>>)?.delete(handler) }
    },
    getStatus() { return status },
    onStatusChange(cb) { statusListeners.add(cb); return () => statusListeners.delete(cb) },
  }
}
