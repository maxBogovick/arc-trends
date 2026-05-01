import {
  MousePointer2,
  Square,
  Circle,
  Type,
  MessageSquare,
  Hand,
  Frame,
  TextCursorInput,
  RectangleHorizontal,
} from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import type { EditorTool } from '@/shared/types'

const TOOLS: { id: EditorTool; icon: React.ElementType; label: string; key: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)', key: 'V' },
  { id: 'frame', icon: Frame, label: 'Frame (F)', key: 'F' },
  { id: 'rectangle', icon: Square, label: 'Rectangle (R)', key: 'R' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse (O)', key: 'O' },
  { id: 'text', icon: Type, label: 'Text (T)', key: 'T' },
  { id: 'input', icon: TextCursorInput, label: 'Input (I)', key: 'I' },
  { id: 'button', icon: RectangleHorizontal, label: 'Button (B)', key: 'B' },
  { id: 'comment', icon: MessageSquare, label: 'Comment (C)', key: 'C' },
  { id: 'hand', icon: Hand, label: 'Hand (H)', key: 'H' },
]

export function Toolbar() {
  const { tool, setTool } = useEditorStore()

  return (
    <div className="flex items-center gap-0.5">
      {TOOLS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          title={label}
          onClick={() => setTool(id)}
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            tool === id
              ? 'bg-accent/20 text-accent'
              : 'text-white/50 hover:text-white hover:bg-white/10'
          }`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}
