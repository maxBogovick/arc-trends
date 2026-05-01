import type { DesignNode, Comment, Collaborator } from '@/shared/types'

export interface OutgoingEvents {
  'cursor.update': { x: number; y: number }
  'node.update': { nodeId: string; changes: Partial<DesignNode> }
  'node.create': Partial<DesignNode>
  'node.delete': { nodeId: string }
  'comment.create': { x: number; y: number; body: string }
  'presence.join': { name: string; avatarColor: string }
  'presence.leave': Record<string, never>
}

export interface IncomingEvents {
  'presence.updated': { collaborators: Collaborator[] }
  'cursor.updated': { userId: string; x: number; y: number }
  'node.created': DesignNode
  'node.updated': { nodeId: string; changes: Partial<DesignNode> }
  'node.deleted': { nodeId: string }
  'comment.created': Comment
  'comment.updated': { commentId: string; changes: Partial<Comment> }
}

export type IncomingEventName = keyof IncomingEvents

export type EventHandler<K extends IncomingEventName> = (data: IncomingEvents[K]) => void

export interface RealtimeAdapter {
  connect(fileId: string): void
  disconnect(): void
  send<K extends keyof OutgoingEvents>(event: K, data: OutgoingEvents[K]): void
  on<K extends IncomingEventName>(event: K, handler: EventHandler<K>): () => void
  getStatus(): import('@/shared/types').ConnectionStatus
  onStatusChange(cb: (status: import('@/shared/types').ConnectionStatus) => void): () => void
}
