import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { useApiModeStore } from '@/store/apiModeStore'
import type { CreateCommentInput, CreateReplyInput, UpdateCommentInput } from '@/api/contracts'

export function useComments(fileId: string) {
  const mode = useApiModeStore((s) => s.mode)

  return useQuery({
    queryKey: ['comments', fileId, mode],
    queryFn: () => apiClient.getComments(fileId),
    staleTime: 15_000,
  })
}

export function useCreateComment(fileId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCommentInput) => apiClient.createComment(fileId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', fileId] }),
  })
}

export function useCreateReply(fileId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, input }: { commentId: string; input: CreateReplyInput }) =>
      apiClient.createReply(fileId, commentId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', fileId] }),
  })
}

export function useUpdateComment(fileId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, input }: { commentId: string; input: UpdateCommentInput }) =>
      apiClient.updateComment(fileId, commentId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', fileId] }),
  })
}
