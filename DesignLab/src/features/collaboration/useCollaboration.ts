import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRealtimeAdapter, resetRealtimeAdapter } from '@/realtime'
import { useEditorStore } from '@/store/editorStore'
import { useApiModeStore } from '@/store/apiModeStore'

export function useCollaboration(fileId: string) {
  const { setCollaborators, updateCollaboratorCursor, updateNode } = useEditorStore()
  const { mode, setConnectionStatus } = useApiModeStore()
  const qc = useQueryClient()

  useEffect(() => {
    resetRealtimeAdapter()
    const adapter = getRealtimeAdapter()

    const unsubStatus = adapter.onStatusChange((status) => {
      setConnectionStatus(status)
    })

    const unsubPresence = adapter.on('presence.updated', ({ collaborators }) => {
      setCollaborators(collaborators)
    })

    const unsubCursor = adapter.on('cursor.updated', ({ userId, x, y }) => {
      updateCollaboratorCursor(userId, x, y)
    })

    const unsubNodeUpdated = adapter.on('node.updated', ({ nodeId, changes }) => {
      updateNode(nodeId, changes)
    })

    const unsubNodeCreated = adapter.on('node.created', () => {
      qc.invalidateQueries({ queryKey: ['nodes', fileId] })
    })

    const unsubNodeDeleted = adapter.on('node.deleted', ({ nodeId }) => {
      useEditorStore.getState().deleteNode(nodeId)
    })

    const unsubCommentCreated = adapter.on('comment.created', () => {
      qc.invalidateQueries({ queryKey: ['comments', fileId] })
    })

    adapter.connect(fileId)

    return () => {
      unsubStatus()
      unsubPresence()
      unsubCursor()
      unsubNodeUpdated()
      unsubNodeCreated()
      unsubNodeDeleted()
      unsubCommentCreated()
      adapter.disconnect()
    }
  }, [fileId, mode])
}
