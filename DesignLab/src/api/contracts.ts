export type {
  DesignFile,
  DesignNode,
  NodeType,
  NodeShadow,
  TextAlign,
  Comment,
  CommentReply,
  Collaborator,
} from '@/shared/types'

export interface CreateFileInput {
  title: string
  templateId?: 'blank' | 'mobile-onboarding' | 'saas-dashboard' | 'landing-page' | 'design-system'
}

export interface UpdateFileInput {
  title?: string
}

export interface CreateNodeInput {
  type: import('@/shared/types').NodeType
  parentId?: string | null
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  opacity?: number
  fill?: string
  text?: string | null
  radius?: number
  stroke?: string | null
  strokeWidth?: number
  shadow?: import('@/shared/types').NodeShadow
  fontSize?: number | null
  fontWeight?: number | null
  textAlign?: import('@/shared/types').TextAlign
}

export interface UpdateNodeInput {
  name?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  opacity?: number
  fill?: string
  text?: string | null
  radius?: number
  stroke?: string | null
  strokeWidth?: number
  shadow?: import('@/shared/types').NodeShadow
  fontSize?: number | null
  fontWeight?: number | null
  textAlign?: import('@/shared/types').TextAlign
}

export interface CreateCommentInput {
  nodeId?: string | null
  x: number
  y: number
  body: string
  author: string
}

export interface CreateReplyInput {
  body: string
  author: string
}

export interface UpdateCommentInput {
  resolved?: boolean
}

export interface ApiClient {
  getFiles(): Promise<import('@/shared/types').DesignFile[]>
  createFile(input: CreateFileInput): Promise<import('@/shared/types').DesignFile>
  getFile(fileId: string): Promise<import('@/shared/types').DesignFile>
  updateFile(fileId: string, input: UpdateFileInput): Promise<import('@/shared/types').DesignFile>

  getNodes(fileId: string): Promise<import('@/shared/types').DesignNode[]>
  createNode(fileId: string, input: CreateNodeInput): Promise<import('@/shared/types').DesignNode>
  updateNode(fileId: string, nodeId: string, input: UpdateNodeInput): Promise<import('@/shared/types').DesignNode>
  deleteNode(fileId: string, nodeId: string): Promise<void>

  getComments(fileId: string): Promise<import('@/shared/types').Comment[]>
  createComment(fileId: string, input: CreateCommentInput): Promise<import('@/shared/types').Comment>
  createReply(fileId: string, commentId: string, input: CreateReplyInput): Promise<import('@/shared/types').Comment>
  updateComment(fileId: string, commentId: string, input: UpdateCommentInput): Promise<import('@/shared/types').Comment>
}
