import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { useEditorStore } from '@/store/editorStore'
import { useApiModeStore } from '@/store/apiModeStore'
import { getRealtimeAdapter } from '@/realtime'
import type { CreateNodeInput, UpdateNodeInput } from '@/api/contracts'

function collectNodeAndDescendants(nodeId: string) {
  const nodes = useEditorStore.getState().nodes
  const result: string[] = []
  const visit = (id: string) => {
    nodes.filter((node) => node.parentId === id).forEach((child) => visit(child.id))
    result.push(id)
  }
  visit(nodeId)
  return result
}

export function useNodes(fileId: string) {
  const setNodes = useEditorStore((s) => s.setNodes)
  const mode = useApiModeStore((s) => s.mode)

  const query = useQuery({
    queryKey: ['nodes', fileId, mode],
    queryFn: () => apiClient.getNodes(fileId),
    staleTime: 10_000,
  })

  useEffect(() => {
    setNodes(query.data ?? [])
  }, [fileId, query.data, setNodes])

  return query
}

export function useCreateNode(fileId: string) {
  const addNode = useEditorStore((s) => s.addNode)
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateNodeInput) => apiClient.createNode(fileId, input),
    onSuccess: (node) => {
      addNode(node)
      setSelectedNodeId(node.id)
      getRealtimeAdapter().send('node.create', node)
      qc.invalidateQueries({ queryKey: ['nodes', fileId] })
    },
  })
}

export function useUpdateNode(fileId: string) {
  const updateNode = useEditorStore((s) => s.updateNode)

  return useMutation({
    mutationFn: ({ nodeId, changes }: { nodeId: string; changes: UpdateNodeInput }) =>
      apiClient.updateNode(fileId, nodeId, changes),
    onMutate: ({ nodeId, changes }) => {
      updateNode(nodeId, changes)
    },
    onSuccess: (_node, { nodeId, changes }) => {
      getRealtimeAdapter().send('node.update', { nodeId, changes })
    },
  })
}

export function useDeleteNode(fileId: string) {
  const deleteNode = useEditorStore((s) => s.deleteNode)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (nodeId: string) => {
      const ids = collectNodeAndDescendants(nodeId)
      for (const id of ids) {
        await apiClient.deleteNode(fileId, id)
      }
      return ids
    },
    onSuccess: (deletedIds, nodeId) => {
      deleteNode(nodeId)
      deletedIds.forEach((id) => getRealtimeAdapter().send('node.delete', { nodeId: id }))
      qc.invalidateQueries({ queryKey: ['nodes', fileId] })
    },
  })
}
