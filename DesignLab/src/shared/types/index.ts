export type NodeType = 'frame' | 'rectangle' | 'ellipse' | 'text' | 'input' | 'button'
export type NodeShadow = 'none' | 'soft' | 'medium' | 'strong'
export type TextAlign = 'left' | 'center' | 'right'

export interface DesignFile {
  id: string
  title: string
  owner: string
  updatedAt: string
  thumbnailUrl: string | null
  collaborators: Collaborator[]
}

export interface DesignNode {
  id: string
  fileId: string
  type: NodeType
  parentId: string | null
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  fill: string
  text: string | null
  radius?: number
  stroke?: string | null
  strokeWidth?: number
  shadow?: NodeShadow
  fontSize?: number | null
  fontWeight?: number | null
  textAlign?: TextAlign
}

export interface Comment {
  id: string
  fileId: string
  nodeId: string | null
  x: number
  y: number
  author: string
  body: string
  createdAt: string
  resolved: boolean
  replies: CommentReply[]
}

export interface CommentReply {
  id: string
  author: string
  body: string
  createdAt: string
}

export interface Collaborator {
  id: string
  name: string
  avatarColor: string
  cursor: { x: number; y: number } | null
  selectedNodeId: string | null
  online: boolean
}

export type ApiMode = 'mock' | 'real'

export type ConnectionStatus = 'mock' | 'connecting' | 'connected' | 'offline' | 'error'

export type EditorTool =
  | 'select'
  | 'frame'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'input'
  | 'button'
  | 'comment'
  | 'hand'

export interface EditorPan {
  x: number
  y: number
}
