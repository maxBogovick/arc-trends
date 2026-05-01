import { useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { useCreateNode, useUpdateNode, useDeleteNode } from './useNodes'
import { useCreateComment } from '@/features/comments/useComments'
import { useComments } from '@/features/comments/useComments'
import { CommentBubble } from '@/features/comments/CommentBubble'
import { RemoteCursors } from '@/features/collaboration/RemoteCursors'
import { ApiActivityPanel } from './ApiActivityPanel'
import { getRealtimeAdapter } from '@/realtime'
import type { DesignNode, EditorTool } from '@/shared/types'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'

interface CanvasProps {
  fileId: string
}

type CreationTool = Extract<EditorTool, 'frame' | 'rectangle' | 'ellipse' | 'text' | 'input' | 'button'>
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface ResizeState {
  nodeId: string
  handle: ResizeHandle
  startMouseX: number
  startMouseY: number
  startNodeX: number
  startNodeY: number
  startNodeWidth: number
  startNodeHeight: number
}

const SHADOWS = {
  none: 'none',
  soft: '0 10px 24px rgba(15, 23, 42, 0.12)',
  medium: '0 18px 42px rgba(15, 23, 42, 0.18)',
  strong: '0 28px 70px rgba(15, 23, 42, 0.28)',
}

const TEXT_JUSTIFY: Record<NonNullable<DesignNode['textAlign']>, React.CSSProperties['justifyContent']> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

function isCreationTool(tool: EditorTool): tool is CreationTool {
  return (
    tool === 'frame' ||
    tool === 'rectangle' ||
    tool === 'ellipse' ||
    tool === 'text' ||
    tool === 'input' ||
    tool === 'button'
  )
}

function defaultSizeFor(tool: CreationTool) {
  if (tool === 'frame') return [320, 220] as const
  if (tool === 'text') return [180, 40] as const
  if (tool === 'input') return [240, 44] as const
  if (tool === 'button') return [160, 48] as const
  return [128, 96] as const
}

function defaultFillFor(tool: CreationTool) {
  if (tool === 'text') return '#111827'
  if (tool === 'frame') return '#ffffff'
  if (tool === 'ellipse') return '#38bdf8'
  if (tool === 'input') return '#ffffff'
  if (tool === 'button') return '#7c5cfc'
  return '#e5e7eb'
}

function defaultRadiusFor(type: DesignNode['type']) {
  if (type === 'ellipse') return 9999
  if (type === 'frame') return 16
  if (type === 'rectangle' || type === 'input' || type === 'button') return 8
  return 0
}

function defaultTextFor(tool: CreationTool) {
  if (tool === 'text') return 'Text'
  if (tool === 'input') return 'Email address'
  if (tool === 'button') return 'Continue'
  return null
}

function defaultStrokeFor(tool: CreationTool) {
  if (tool === 'input') return '#cbd5e1'
  return null
}

function defaultStrokeWidthFor(tool: CreationTool) {
  if (tool === 'input') return 1
  return 0
}

function NodeElement({
  node,
  isSelected,
  remoteSelectedBy,
  onMouseDown,
}: {
  node: DesignNode
  isSelected: boolean
  remoteSelectedBy: string | null
  onMouseDown: (e: React.MouseEvent, node: DesignNode) => void
}) {
  const selColor = remoteSelectedBy ?? (isSelected ? '#7c5cfc' : null)
  const radius = node.type === 'ellipse' ? 9999 : node.radius ?? defaultRadiusFor(node.type)
  const strokeWidth = node.strokeWidth ?? 0
  const stroke = strokeWidth > 0 && node.stroke ? `${strokeWidth}px solid ${node.stroke}` : undefined
  const shadow = SHADOWS[node.shadow ?? 'none']

  const commonStyle: React.CSSProperties = {
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    transform: `rotate(${node.rotation}deg)`,
    opacity: node.opacity,
    cursor: 'move',
    boxSizing: 'border-box',
    borderRadius: radius,
    boxShadow: shadow,
  }

  if (node.type === 'text') {
    const textAlign = node.textAlign ?? 'left'

    return (
      <div
        data-node-id={node.id}
        onMouseDown={(e) => onMouseDown(e, node)}
        style={{
          ...commonStyle,
          color: node.fill,
          display: 'flex',
          alignItems: 'center',
          justifyContent: TEXT_JUSTIFY[textAlign],
          fontSize: node.fontSize ?? Math.max(12, node.height * 0.6),
          fontWeight: node.fontWeight ?? 600,
          lineHeight: 1.1,
          textAlign,
          overflow: 'hidden',
          padding: '0 2px',
          whiteSpace: 'pre-wrap',
          userSelect: 'none',
          outline: selColor ? `2px solid ${selColor}` : 'none',
          outlineOffset: '2px',
        }}
      >
        {node.text ?? node.name}
      </div>
    )
  }

  if (node.type === 'input' || node.type === 'button') {
    const textAlign = node.textAlign ?? (node.type === 'button' ? 'center' : 'left')
    const isButton = node.type === 'button'

    return (
      <div
        data-node-id={node.id}
        onMouseDown={(e) => onMouseDown(e, node)}
        style={{
          ...commonStyle,
          background: node.fill,
          border: stroke ?? (isButton ? undefined : '1px solid #cbd5e1'),
          outline: selColor ? `2px solid ${selColor}` : 'none',
          outlineOffset: '2px',
          color: isButton ? '#ffffff' : '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: TEXT_JUSTIFY[textAlign],
          fontSize: node.fontSize ?? 15,
          fontWeight: node.fontWeight ?? (isButton ? 700 : 500),
          lineHeight: 1.1,
          overflow: 'hidden',
          padding: isButton ? '0 16px' : '0 14px',
          userSelect: 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.text ?? (isButton ? 'Button' : 'Placeholder')}
        </span>
      </div>
    )
  }

  if (node.type === 'frame') {
    return (
      <div
        data-node-id={node.id}
        onMouseDown={(e) => onMouseDown(e, node)}
        style={{
          ...commonStyle,
          background: node.fill,
          border: stroke ?? '1.5px dashed rgba(15,23,42,0.18)',
          outline: selColor ? `2px solid ${selColor}` : 'none',
          outlineOffset: '2px',
        }}
      />
    )
  }

  // rectangle or ellipse
  return (
    <div
      data-node-id={node.id}
      onMouseDown={(e) => onMouseDown(e, node)}
      style={{
        ...commonStyle,
        background: node.fill,
        border: stroke,
        outline: selColor ? `2px solid ${selColor}` : 'none',
        outlineOffset: '2px',
      }}
    />
  )
}

export function Canvas({ fileId }: CanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const {
    tool, zoom, pan, nodes, selectedNodeId, drag,
    setSelectedNodeId, setZoom, setPan, setDrag, updateNode,
  } = useEditorStore()

  const { mutate: createNode } = useCreateNode(fileId)
  const { mutate: updateNodeMutation } = useUpdateNode(fileId)
  const { mutate: deleteNodeMutation } = useDeleteNode(fileId)
  const { mutate: createComment } = useCreateComment(fileId)
  const { data: comments } = useComments(fileId)
  const collaborators = useEditorStore((s) => s.collaborators)

  const isPanning = useRef(false)
  const panStart = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 })
  const isCreating = useRef(false)
  const createStart = useRef({ cx: 0, cy: 0 })
  const createParentId = useRef<string | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  const screenToCanvas = useCallback((sx: number, sy: number) => {
    const rect = viewportRef.current!.getBoundingClientRect()
    return {
      x: (sx - rect.left - pan.x) / zoom,
      y: (sy - rect.top - pan.y) / zoom,
    }
  }, [pan, zoom])

  const canvasToScreen = useCallback((cx: number, cy: number) => {
    return { x: cx * zoom + pan.x, y: cy * zoom + pan.y }
  }, [pan, zoom])

  const beginCreate = (e: React.MouseEvent, parentId: string | null = null) => {
    const cc = screenToCanvas(e.clientX, e.clientY)
    isCreating.current = true
    createStart.current = { cx: cc.x, cy: cc.y }
    createParentId.current = parentId
    e.preventDefault()
  }

  // Wheel zoom
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const factor = e.deltaY < 0 ? 1.08 : 0.93
        const newZoom = Math.min(8, Math.max(0.1, zoom * factor))
        const newPanX = mx - (mx - pan.x) * (newZoom / zoom)
        const newPanY = my - (my - pan.y) * (newZoom / zoom)
        setZoom(newZoom)
        setPan({ x: newPanX, y: newPanY })
      } else {
        setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, pan, setZoom, setPan])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const store = useEditorStore.getState()
      if (e.key === 'v' || e.key === 'V') store.setTool('select')
      if (e.key === 'f' || e.key === 'F') store.setTool('frame')
      if (e.key === 'r' || e.key === 'R') store.setTool('rectangle')
      if (e.key === 'o' || e.key === 'O') store.setTool('ellipse')
      if (e.key === 't' || e.key === 'T') store.setTool('text')
      if (e.key === 'i' || e.key === 'I') store.setTool('input')
      if (e.key === 'b' || e.key === 'B') store.setTool('button')
      if (e.key === 'c' || e.key === 'C') store.setTool('comment')
      if (e.key === 'h' || e.key === 'H') store.setTool('hand')
      if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedNodeId) {
        e.preventDefault()
        deleteNodeMutation(store.selectedNodeId)
      }
      if (e.key === 'Escape') store.setSelectedNodeId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteNodeMutation])

  const handleViewportMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    const nodeId = target.closest('[data-node-id]')?.getAttribute('data-node-id')

    if (tool === 'hand' || (tool === 'select' && !nodeId && e.button === 0 && !e.altKey)) {
      if (tool === 'hand' || (!nodeId)) {
        if (tool !== 'select' || !nodeId) {
          isPanning.current = true
          panStart.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y }
          if (!nodeId) setSelectedNodeId(null)
          return
        }
      }
    }

    if (isCreationTool(tool) && !nodeId) {
      beginCreate(e)
    }

    if (tool === 'comment' && !nodeId) {
      const cc = screenToCanvas(e.clientX, e.clientY)
      createComment({
        x: Math.round(cc.x),
        y: Math.round(cc.y),
        body: 'New comment',
        author: 'You',
        nodeId: null,
      })
      getRealtimeAdapter().send('comment.create', {
        x: Math.round(cc.x),
        y: Math.round(cc.y),
        body: 'New comment',
      })
    }
  }

  const handleNodeMouseDown = (e: React.MouseEvent, node: DesignNode) => {
    e.stopPropagation()

    if (isCreationTool(tool)) {
      beginCreate(e, node.type === 'frame' ? node.id : node.parentId)
      return
    }

    if (tool === 'comment') {
      const cc = screenToCanvas(e.clientX, e.clientY)
      createComment({
        x: Math.round(cc.x),
        y: Math.round(cc.y),
        body: 'New comment',
        author: 'You',
        nodeId: node.id,
      })
      getRealtimeAdapter().send('comment.create', {
        x: Math.round(cc.x),
        y: Math.round(cc.y),
        body: 'New comment',
      })
      return
    }

    if (tool === 'select' || tool === 'hand') {
      setSelectedNodeId(node.id)
      if (tool === 'select') {
        setDrag({
          nodeId: node.id,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startNodeX: node.x,
          startNodeY: node.y,
        })
        e.preventDefault()
      }
    }
  }

  const handleResizeMouseDown = (e: React.MouseEvent, node: DesignNode, handle: ResizeHandle) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedNodeId(node.id)
    resizeRef.current = {
      nodeId: node.id,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
      startNodeWidth: node.width,
      startNodeHeight: node.height,
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.mouseX
      const dy = e.clientY - panStart.current.mouseY
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy })
      return
    }

    if (resizeRef.current) {
      const resize = resizeRef.current
      const dx = (e.clientX - resize.startMouseX) / zoom
      const dy = (e.clientY - resize.startMouseY) / zoom
      const minSize = 8

      let x = resize.startNodeX
      let y = resize.startNodeY
      let width = resize.startNodeWidth
      let height = resize.startNodeHeight

      if (resize.handle.includes('e')) {
        width = Math.max(minSize, resize.startNodeWidth + dx)
      }
      if (resize.handle.includes('s')) {
        height = Math.max(minSize, resize.startNodeHeight + dy)
      }
      if (resize.handle.includes('w')) {
        width = Math.max(minSize, resize.startNodeWidth - dx)
        x = resize.startNodeX + resize.startNodeWidth - width
      }
      if (resize.handle.includes('n')) {
        height = Math.max(minSize, resize.startNodeHeight - dy)
        y = resize.startNodeY + resize.startNodeHeight - height
      }

      updateNode(resize.nodeId, {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      })
      return
    }

    if (drag) {
      const dx = (e.clientX - drag.startMouseX) / zoom
      const dy = (e.clientY - drag.startMouseY) / zoom
      updateNode(drag.nodeId, {
        x: Math.round(drag.startNodeX + dx),
        y: Math.round(drag.startNodeY + dy),
      })
      return
    }

    // emit cursor to realtime
    const cc = screenToCanvas(e.clientX, e.clientY)
    getRealtimeAdapter().send('cursor.update', { x: cc.x, y: cc.y })
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false
      return
    }

    if (resizeRef.current) {
      const resize = resizeRef.current
      const node = nodes.find((n) => n.id === resize.nodeId)
      if (node) {
        const changes = { x: node.x, y: node.y, width: node.width, height: node.height }
        updateNodeMutation({ nodeId: node.id, changes })
      }
      resizeRef.current = null
      return
    }

    if (drag) {
      const node = nodes.find((n) => n.id === drag.nodeId)
      if (node) {
        updateNodeMutation({ nodeId: node.id, changes: { x: node.x, y: node.y } })
      }
      setDrag(null)
      return
    }

    if (isCreating.current) {
      isCreating.current = false
      if (!isCreationTool(tool)) return

      const cc = screenToCanvas(e.clientX, e.clientY)
      const x = Math.round(Math.min(createStart.current.cx, cc.x))
      const y = Math.round(Math.min(createStart.current.cy, cc.y))
      const w = Math.round(Math.abs(cc.x - createStart.current.cx))
      const h = Math.round(Math.abs(cc.y - createStart.current.cy))

      if (w < 4 && h < 4) {
        const [dw, dh] = defaultSizeFor(tool)
        createNode({
          type: tool,
          parentId: createParentId.current,
          name: `${tool.charAt(0).toUpperCase() + tool.slice(1)}`,
          x: Math.round(createStart.current.cx - dw / 2),
          y: Math.round(createStart.current.cy - dh / 2),
          width: dw,
          height: dh,
          fill: defaultFillFor(tool),
          text: defaultTextFor(tool),
          radius: defaultRadiusFor(tool),
          shadow: tool === 'text' ? 'none' : 'soft',
          stroke: defaultStrokeFor(tool),
          strokeWidth: defaultStrokeWidthFor(tool),
          fontSize: tool === 'text' ? 24 : tool === 'input' || tool === 'button' ? 15 : null,
          fontWeight: tool === 'text' ? 600 : tool === 'button' ? 700 : tool === 'input' ? 500 : null,
          textAlign: tool === 'button' ? 'center' : 'left',
        })
      } else {
        createNode({
          type: tool,
          parentId: createParentId.current,
          name: `${tool.charAt(0).toUpperCase() + tool.slice(1)}`,
          x, y, width: Math.max(10, w), height: Math.max(10, h),
          fill: defaultFillFor(tool),
          text: defaultTextFor(tool),
          radius: defaultRadiusFor(tool),
          shadow: tool === 'text' ? 'none' : 'soft',
          stroke: defaultStrokeFor(tool),
          strokeWidth: defaultStrokeWidthFor(tool),
          fontSize: tool === 'text' ? 24 : tool === 'input' || tool === 'button' ? 15 : null,
          fontWeight: tool === 'text' ? 600 : tool === 'button' ? 700 : tool === 'input' ? 500 : null,
          textAlign: tool === 'button' ? 'center' : 'left',
        })
      }
      createParentId.current = null
    }
  }

  // Cursor style
  const cursorMap: Record<string, string> = {
    select: drag || resizeRef.current ? 'grabbing' : 'default',
    hand: isPanning.current ? 'grabbing' : 'grab',
    frame: 'crosshair',
    rectangle: 'crosshair',
    ellipse: 'crosshair',
    text: 'crosshair',
    input: 'crosshair',
    button: 'crosshair',
    comment: 'crosshair',
  }

  const remoteSelection = new Map<string, string>()
  collaborators.forEach((c) => {
    if (c.selectedNodeId) remoteSelection.set(c.selectedNodeId, c.avatarColor)
  })

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#1a1a1a]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      {/* Canvas viewport */}
      <div
        ref={viewportRef}
        className="absolute inset-0"
        style={{ cursor: cursorMap[tool] ?? 'default' }}
        onMouseDown={handleViewportMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Transformed world */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {nodes.map((node) => (
            <NodeElement
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              remoteSelectedBy={remoteSelection.get(node.id) ?? null}
              onMouseDown={handleNodeMouseDown}
            />
          ))}

          {/* Selection border */}
          {selectedNodeId && (() => {
            const n = nodes.find((x) => x.id === selectedNodeId)
            if (!n) return null
            const boxWidth = n.width + 4
            const boxHeight = n.height + 4
            const handles: Array<{ id: ResizeHandle; x: number; y: number; cursor: string }> = [
              { id: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
              { id: 'n', x: boxWidth / 2, y: 0, cursor: 'ns-resize' },
              { id: 'ne', x: boxWidth, y: 0, cursor: 'nesw-resize' },
              { id: 'e', x: boxWidth, y: boxHeight / 2, cursor: 'ew-resize' },
              { id: 'se', x: boxWidth, y: boxHeight, cursor: 'nwse-resize' },
              { id: 's', x: boxWidth / 2, y: boxHeight, cursor: 'ns-resize' },
              { id: 'sw', x: 0, y: boxHeight, cursor: 'nesw-resize' },
              { id: 'w', x: 0, y: boxHeight / 2, cursor: 'ew-resize' },
            ]
            return (
              <div
                style={{
                  position: 'absolute',
                  left: n.x - 2,
                  top: n.y - 2,
                  width: boxWidth,
                  height: boxHeight,
                  border: '2px solid #7c5cfc',
                  borderRadius: n.type === 'ellipse' ? 9999 : n.radius ?? 1,
                  pointerEvents: 'none',
                  transform: `rotate(${n.rotation}deg)`,
                }}
              >
                {handles.map((handle) => (
                  <div
                    key={handle.id}
                    onMouseDown={(e) => handleResizeMouseDown(e, n, handle.id)}
                    style={{
                      position: 'absolute',
                      left: handle.x,
                      top: handle.y,
                      width: 8,
                      height: 8,
                      background: '#fff',
                      border: '1.5px solid #7c5cfc',
                      borderRadius: 2,
                      cursor: handle.cursor,
                      pointerEvents: 'auto',
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                ))}
              </div>
            )
          })()}
        </div>

        {/* Comment bubbles — screen space */}
        {(comments ?? []).map((c) => {
          const sp = canvasToScreen(c.x, c.y)
          return (
            <CommentBubble
              key={c.id}
              comment={c}
              screenX={sp.x}
              screenY={sp.y}
              fileId={fileId}
            />
          )
        })}

        {/* Remote cursors — screen space */}
        <RemoteCursors />
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-surface-200 border border-border rounded-lg p-1">
        <button
          onClick={() => setZoom(Math.max(0.1, zoom / 1.2))}
          className="w-7 h-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={13} />
        </button>
        <span
          onClick={() => setZoom(1)}
          className="text-white/50 text-xs font-medium cursor-pointer hover:text-white px-1 min-w-[44px] text-center"
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(Math.min(8, zoom * 1.2))}
          className="w-7 h-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={13} />
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 80, y: 80 }) }}
          className="w-7 h-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Reset view"
        >
          <Maximize size={12} />
        </button>
      </div>

      {/* Tool hint */}
      {tool !== 'select' && tool !== 'hand' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface-200 border border-border rounded-full px-3 py-1.5 text-xs text-white/50 pointer-events-none">
          {tool === 'comment' ? 'Click on canvas or a layer to add comment' : `Click or drag on canvas or inside a frame to create ${tool}`}
        </div>
      )}

      <ApiActivityPanel />
    </div>
  )
}
