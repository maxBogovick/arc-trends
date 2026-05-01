import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { useApiModeStore } from '@/store/apiModeStore'
import type { CreateFileInput } from '@/api/contracts'

export function useFiles() {
  const mode = useApiModeStore((s) => s.mode)

  return useQuery({
    queryKey: ['files', mode],
    queryFn: () => apiClient.getFiles(),
    staleTime: 30_000,
  })
}

export function useCreateFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFileInput) => apiClient.createFile(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
    },
  })
}
