import type {
  ApiClient,
  CreateFileInput,
  UpdateFileInput,
  CreateNodeInput,
  UpdateNodeInput,
  CreateCommentInput,
  CreateReplyInput,
  UpdateCommentInput,
} from '@/api/contracts'
import { useApiActivityStore } from '@/store/apiActivityStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const activityId = useApiActivityStore.getState().begin(method, path)
  let res: Response

  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error'
    useApiActivityStore.getState().fail(activityId, message)
    throw new Error(`Network error: ${message}`)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    useApiActivityStore.getState().fail(activityId, text || res.statusText, res.status)
    throw new Error(`${res.status} ${text}`)
  }

  useApiActivityStore.getState().complete(activityId, res.status)

  if (res.status === 204) return undefined as T

  const text = await res.text()
  if (!text) return undefined as T

  return JSON.parse(text) as T
}

export const realApiClient: ApiClient = {
  getFiles: () => request('/api/files'),

  createFile: (input: CreateFileInput) =>
    request('/api/files', { method: 'POST', body: JSON.stringify(input) }),

  getFile: (fileId: string) => request(`/api/files/${fileId}`),

  updateFile: (fileId: string, input: UpdateFileInput) =>
    request(`/api/files/${fileId}`, { method: 'PATCH', body: JSON.stringify(input) }),

  getNodes: (fileId: string) => request(`/api/files/${fileId}/nodes`),

  createNode: (fileId: string, input: CreateNodeInput) =>
    request(`/api/files/${fileId}/nodes`, { method: 'POST', body: JSON.stringify(input) }),

  updateNode: (fileId: string, nodeId: string, input: UpdateNodeInput) =>
    request(`/api/files/${fileId}/nodes/${nodeId}`, { method: 'PATCH', body: JSON.stringify(input) }),

  deleteNode: (fileId: string, nodeId: string) =>
    request(`/api/files/${fileId}/nodes/${nodeId}`, { method: 'DELETE' }),

  getComments: (fileId: string) => request(`/api/files/${fileId}/comments`),

  createComment: (fileId: string, input: CreateCommentInput) =>
    request(`/api/files/${fileId}/comments`, { method: 'POST', body: JSON.stringify(input) }),

  createReply: (fileId: string, commentId: string, input: CreateReplyInput) =>
    request(`/api/files/${fileId}/comments/${commentId}/replies`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateComment: (fileId: string, commentId: string, input: UpdateCommentInput) =>
    request(`/api/files/${fileId}/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
}
