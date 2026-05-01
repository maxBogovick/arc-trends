import { create } from 'zustand'
import type { DesignNode, EditorTool, EditorPan, Collaborator } from '@/shared/types'

interface DragState {
  nodeId: string
  startMouseX: number
  startMouseY: number
  startNodeX: number
  startNodeY: number
}

interface EditorState {
  fileId: string | null
  tool: EditorTool
  selectedNodeId: string | null
  nodes: DesignNode[]
  collaborators: Collaborator[]
  zoom: number
  pan: EditorPan
  drag: DragState | null
  showComments: boolean
  showLayers: boolean

  setFileId: (id: string | null) => void
  setTool: (tool: EditorTool) => void
  setSelectedNodeId: (id: string | null) => void
  setNodes: (nodes: DesignNode[]) => void
  updateNode: (id: string, changes: Partial<DesignNode>) => void
  addNode: (node: DesignNode) => void
  deleteNode: (id: string) => void
  setCollaborators: (collaborators: Collaborator[]) => void
  updateCollaboratorCursor: (userId: string, x: number, y: number) => void
  setZoom: (zoom: number) => void
  setPan: (pan: EditorPan) => void
  setDrag: (drag: DragState | null) => void
  toggleComments: () => void
  toggleLayers: () => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  fileId: null,
  tool: 'select',
  selectedNodeId: null,
  nodes: [],
  collaborators: [],
  zoom: 1,
  pan: { x: 80, y: 80 },
  drag: null,
  showComments: false,
  showLayers: true,

  setFileId: (fileId) => set({ fileId }),
  setTool: (tool) => set({ tool }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setNodes: (nodes) => set({ nodes }),

  updateNode: (id, changes) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...changes } : n)),
    })),

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id && n.parentId !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  setCollaborators: (collaborators) => set({ collaborators }),

  updateCollaboratorCursor: (userId, x, y) =>
    set((state) => ({
      collaborators: state.collaborators.map((c) =>
        c.id === userId ? { ...c, cursor: { x, y } } : c
      ),
    })),

  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setDrag: (drag) => set({ drag }),
  toggleComments: () => set((s) => ({ showComments: !s.showComments })),
  toggleLayers: () => set((s) => ({ showLayers: !s.showLayers })),
}))
