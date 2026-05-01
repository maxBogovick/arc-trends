import { useEditorStore } from '@/store/editorStore'

export function RemoteCursors() {
  const { collaborators, zoom, pan } = useEditorStore()

  return (
    <>
      {collaborators
        .filter((c) => c.online && c.cursor)
        .map((c) => {
          const sx = c.cursor!.x * zoom + pan.x
          const sy = c.cursor!.y * zoom + pan.y
          return (
            <div
              key={c.id}
              className="absolute pointer-events-none"
              style={{ left: sx, top: sy, transform: 'translate(-2px, -2px)', zIndex: 50 }}
            >
              {/* Cursor arrow */}
              <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                <path
                  d="M0 0L0 14L3.5 10.5L6 16L8 15L5.5 9.5L10.5 9.5L0 0Z"
                  fill={c.avatarColor}
                />
              </svg>
              {/* Name label */}
              <div
                className="mt-1 px-1.5 py-0.5 rounded text-white text-[10px] font-medium whitespace-nowrap"
                style={{ background: c.avatarColor }}
              >
                {c.name}
              </div>
            </div>
          )
        })}
    </>
  )
}
