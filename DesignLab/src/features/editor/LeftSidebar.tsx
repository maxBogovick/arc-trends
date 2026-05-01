import { ChevronRight, Frame, Square, Circle, Type, Layers, TextCursorInput, RectangleHorizontal } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import type { DesignNode } from '@/shared/types'

const NODE_ICONS: Record<string, React.ElementType> = {
  frame: Frame,
  rectangle: Square,
  ellipse: Circle,
  text: Type,
  input: TextCursorInput,
  button: RectangleHorizontal,
}

function LayerRow({ node, depth = 0 }: { node: DesignNode; depth?: number }) {
  const { selectedNodeId, setSelectedNodeId } = useEditorStore()
  const Icon = NODE_ICONS[node.type] ?? Square
  const isSelected = selectedNodeId === node.id

  return (
    <button
      onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors text-left group ${
        isSelected
          ? 'bg-accent/20 text-accent'
          : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      {node.type === 'frame' && (
        <ChevronRight size={10} className="text-white/30 shrink-0" />
      )}
      <Icon size={11} className="shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function LeftSidebar() {
  const nodes = useEditorStore((s) => s.nodes)
  const rootNodes = nodes.filter((n) => !n.parentId)
  const childrenOf = (parentId: string) => nodes.filter((n) => n.parentId === parentId)

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-white/40 font-medium uppercase tracking-wider">
          <Layers size={11} />
          Layers
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
        {nodes.length === 0 ? (
          <p className="px-4 py-4 text-xs text-white/25 italic">No layers yet</p>
        ) : (
          rootNodes.map((node) => (
            <div key={node.id}>
              <LayerRow node={node} depth={0} />
              {childrenOf(node.id).map((child) => (
                <LayerRow key={child.id} node={child} depth={1} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
