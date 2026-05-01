import type { RealtimeAdapter, IncomingEventName, EventHandler } from './types'
import type { ConnectionStatus } from '@/shared/types'
import { MOCK_COLLABORATORS, MOCK_NODES } from '@/api/mock/fixtures'

type HandlerMap = {
  [K in IncomingEventName]?: Set<EventHandler<K>>
}

export function createMockAdapter(): RealtimeAdapter {
  const handlers: HandlerMap = {}
  const statusListeners = new Set<(s: ConnectionStatus) => void>()
  let status: ConnectionStatus = 'mock'
  let timers: ReturnType<typeof setInterval>[] = []
  let currentFileId: string | null = null

  const collaborators = MOCK_COLLABORATORS.filter((c) => c.online).map((c) => ({ ...c }))

  function emit<K extends IncomingEventName>(event: K, data: Parameters<EventHandler<K>>[0]) {
    const set = handlers[event] as Set<EventHandler<K>> | undefined
    set?.forEach((h) => h(data as Parameters<EventHandler<K>>[0]))
  }

  function simulateCollaboration() {
    let tick = 0

    const cursorTimer = setInterval(() => {
      collaborators.forEach((c) => {
        const dx = (Math.random() - 0.5) * 120
        const dy = (Math.random() - 0.5) * 80
        c.cursor = {
          x: Math.max(20, Math.min(1400, (c.cursor?.x ?? 400) + dx)),
          y: Math.max(20, Math.min(900, (c.cursor?.y ?? 300) + dy)),
        }
        emit('cursor.updated', { userId: c.id, x: c.cursor.x, y: c.cursor.y })
      })
    }, 1800)

    const nodeTimer = setInterval(() => {
      tick++
      if (tick % 3 !== 0 || !currentFileId) return

      const fileNodes = MOCK_NODES[currentFileId]
      if (!fileNodes || fileNodes.length === 0) return

      const node = fileNodes[Math.floor(Math.random() * fileNodes.length)]
      const collab = collaborators[Math.floor(Math.random() * collaborators.length)]

      collaborators.forEach((c) => { c.selectedNodeId = null })
      collab.selectedNodeId = node.id

      emit('node.updated', {
        nodeId: node.id,
        changes: { opacity: 0.5 + Math.round(Math.random() * 5) / 10 },
      })
      emit('presence.updated', { collaborators: [...collaborators] })
    }, 4000)

    timers.push(cursorTimer, nodeTimer)
  }

  return {
    connect(fileId: string) {
      currentFileId = fileId
      status = 'mock'
      statusListeners.forEach((cb) => cb(status))

      setTimeout(() => {
        emit('presence.updated', { collaborators: [...collaborators] })
        simulateCollaboration()
      }, 400)
    },

    disconnect() {
      timers.forEach(clearInterval)
      timers = []
      currentFileId = null
    },

    send(_event, _data) {
      // Mock: fire-and-forget
    },

    on<K extends IncomingEventName>(event: K, handler: EventHandler<K>) {
      if (!handlers[event]) {
        (handlers as Record<string, Set<EventHandler<IncomingEventName>>>)[event] = new Set()
      }
      ;(handlers[event] as Set<EventHandler<K>>).add(handler)
      return () => {
        ;(handlers[event] as Set<EventHandler<K>>)?.delete(handler)
      }
    },

    getStatus() {
      return status
    },

    onStatusChange(cb) {
      statusListeners.add(cb)
      return () => statusListeners.delete(cb)
    },
  }
}
