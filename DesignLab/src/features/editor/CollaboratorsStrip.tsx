import { useEditorStore } from '@/store/editorStore'

export function CollaboratorsStrip() {
  const collaborators = useEditorStore((s) => s.collaborators)
  const online = collaborators.filter((c) => c.online)

  if (online.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {online.map((c) => (
        <div
          key={c.id}
          title={c.name}
          className="relative group"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-surface-200 cursor-default"
            style={{ background: c.avatarColor }}
          >
            {c.name.charAt(0)}
          </div>
          {/* Tooltip */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-surface-100 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            {c.name}
          </div>
        </div>
      ))}
    </div>
  )
}
