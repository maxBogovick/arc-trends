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
import type { DesignFile, DesignNode, Comment } from '@/shared/types'
import { createTemplateNodes } from '@/shared/templates'
import { MOCK_FILES, MOCK_NODES, MOCK_COMMENTS } from './fixtures'

const delay = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms))

const files: DesignFile[] = [...MOCK_FILES]
const nodes: Record<string, DesignNode[]> = Object.fromEntries(
  Object.entries(MOCK_NODES).map(([k, v]) => [k, [...v]])
)
const comments: Record<string, Comment[]> = Object.fromEntries(
  Object.entries(MOCK_COMMENTS).map(([k, v]) => [k, [...v]])
)

let idCounter = 1000

function uid() {
  return `gen-${++idCounter}-${Math.random().toString(36).slice(2, 7)}`
}

function nodeDefaults(input: CreateNodeInput) {
  return {
    radius:
      input.radius ??
      (input.type === 'ellipse'
        ? 9999
        : input.type === 'frame'
          ? 16
          : input.type === 'rectangle' || input.type === 'input' || input.type === 'button'
            ? 8
            : 0),
    stroke: input.stroke ?? null,
    strokeWidth: input.strokeWidth ?? 0,
    shadow: input.shadow ?? 'none',
    fontSize: input.fontSize ?? (input.type === 'text' ? 24 : input.type === 'input' || input.type === 'button' ? 15 : null),
    fontWeight: input.fontWeight ?? (input.type === 'text' ? 600 : input.type === 'button' ? 700 : 500),
    textAlign: input.textAlign ?? (input.type === 'button' ? 'center' : 'left'),
  } satisfies Partial<DesignNode>
}

export const mockApiClient: ApiClient = {
  async getFiles() {
    await delay()
    return [...files]
  },

  async createFile(input: CreateFileInput) {
    await delay(300)
    const file: DesignFile = {
      id: uid(),
      title: input.title,
      owner: 'You',
      updatedAt: new Date().toISOString(),
      thumbnailUrl: null,
      collaborators: [],
    }
    files.unshift(file)
    nodes[file.id] = createTemplateNodes(input.templateId ?? 'blank').map((node) => ({
      ...node,
      id: uid(),
      fileId: file.id,
    }))
    comments[file.id] =
      input.templateId && input.templateId !== 'blank'
        ? [
            {
              id: uid(),
              fileId: file.id,
              nodeId: null,
              x: 120,
              y: 120,
              author: 'DesignLab',
              body: 'Start here: inspect the layer structure, adjust the visual style, then decide which backend endpoint should persist each change.',
              createdAt: new Date().toISOString(),
              resolved: false,
              replies: [],
            },
          ]
        : []
    return file
  },

  async getFile(fileId: string) {
    await delay()
    const f = files.find((f) => f.id === fileId)
    if (!f) throw new Error(`File ${fileId} not found`)
    return f
  },

  async updateFile(fileId: string, input: UpdateFileInput) {
    await delay()
    const idx = files.findIndex((f) => f.id === fileId)
    if (idx < 0) throw new Error(`File ${fileId} not found`)
    files[idx] = { ...files[idx], ...input, updatedAt: new Date().toISOString() }
    return files[idx]
  },

  async getNodes(fileId: string) {
    await delay()
    return nodes[fileId] ?? []
  },

  async createNode(fileId: string, input: CreateNodeInput) {
    await delay(150)
    const node: DesignNode = {
      id: uid(),
      fileId,
      type: input.type,
      parentId: input.parentId ?? null,
      name: input.name,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      rotation: input.rotation ?? 0,
      opacity: input.opacity ?? 1,
      fill:
        input.fill ??
        (input.type === 'text'
          ? '#1a1a2e'
          : input.type === 'input'
            ? '#ffffff'
            : input.type === 'button'
              ? '#7c5cfc'
              : '#e5e7eb'),
      text: input.text ?? null,
      ...nodeDefaults(input),
    }
    if (!nodes[fileId]) nodes[fileId] = []
    nodes[fileId].push(node)
    return node
  },

  async updateNode(fileId: string, nodeId: string, input: UpdateNodeInput) {
    await delay(100)
    const list = nodes[fileId] ?? []
    const idx = list.findIndex((n) => n.id === nodeId)
    if (idx < 0) throw new Error(`Node ${nodeId} not found`)
    list[idx] = { ...list[idx], ...input }
    return list[idx]
  },

  async deleteNode(fileId: string, nodeId: string) {
    await delay(100)
    if (nodes[fileId]) {
      nodes[fileId] = nodes[fileId].filter((n) => n.id !== nodeId && n.parentId !== nodeId)
    }
  },

  async getComments(fileId: string) {
    await delay()
    return comments[fileId] ?? []
  },

  async createComment(fileId: string, input: CreateCommentInput) {
    await delay(200)
    const comment: Comment = {
      id: uid(),
      fileId,
      nodeId: input.nodeId ?? null,
      x: input.x,
      y: input.y,
      author: input.author,
      body: input.body,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    }
    if (!comments[fileId]) comments[fileId] = []
    comments[fileId].push(comment)
    return comment
  },

  async createReply(fileId: string, commentId: string, input: CreateReplyInput) {
    await delay(150)
    const list = comments[fileId] ?? []
    const idx = list.findIndex((c) => c.id === commentId)
    if (idx < 0) throw new Error(`Comment ${commentId} not found`)
    list[idx].replies.push({
      id: uid(),
      author: input.author,
      body: input.body,
      createdAt: new Date().toISOString(),
    })
    return list[idx]
  },

  async updateComment(fileId: string, commentId: string, input: UpdateCommentInput) {
    await delay(100)
    const list = comments[fileId] ?? []
    const idx = list.findIndex((c) => c.id === commentId)
    if (idx < 0) throw new Error(`Comment ${commentId} not found`)
    list[idx] = { ...list[idx], ...input }
    return list[idx]
  },
}
