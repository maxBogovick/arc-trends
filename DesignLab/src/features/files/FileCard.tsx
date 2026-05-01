import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from '@/shared/utils/time'
import type { DesignFile } from '@/shared/types'

interface FileCardProps {
  file: DesignFile
}

const PALETTES = [
  ['#7c5cfc', '#38bdf8', '#ffffff'],
  ['#111827', '#f472b6', '#f8fafc'],
  ['#0f172a', '#22c55e', '#e2e8f0'],
  ['#18181b', '#f59e0b', '#fafafa'],
]

function paletteFor(id: string) {
  const index = Math.abs(id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % PALETTES.length
  return PALETTES[index]
}

export function FileCard({ file }: FileCardProps) {
  const navigate = useNavigate()
  const [primary, secondary, paper] = paletteFor(file.id)

  return (
    <div
      onClick={() => navigate(`/editor/${file.id}`)}
      className="group bg-surface-200 border border-border hover:border-accent/50 rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:shadow-accent/10 hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="h-44 bg-surface-300 relative overflow-hidden flex items-center justify-center">
        {file.thumbnailUrl ? (
          <img src={file.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary}22, transparent 62%)` }} />
            <div className="relative w-[78%] h-[72%] rounded-md shadow-2xl border border-black/10 overflow-hidden" style={{ background: paper }}>
              <div className="h-7" style={{ background: primary }} />
              <div className="p-3 space-y-2">
                <div className="h-4 rounded w-1/2" style={{ background: secondary }} />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-16 rounded bg-slate-200" />
                  <div className="h-16 rounded bg-slate-100" />
                  <div className="h-16 rounded" style={{ background: `${secondary}44` }} />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="h-2 rounded"
                      style={{ background: i % 3 === 0 ? primary : 'rgba(15,23,42,0.12)' }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium bg-black/65 px-3 py-1.5 rounded-full">
            Open file
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-white font-medium text-sm truncate">{file.title}</h3>
        <p className="text-white/40 text-xs mt-1">
          {file.owner} · {formatDistanceToNow(file.updatedAt)}
        </p>

        {/* Collaborators */}
        {file.collaborators.length > 0 && (
          <div className="flex items-center gap-1 mt-3">
            {file.collaborators.slice(0, 4).map((c) => (
              <div
                key={c.id}
                title={c.name}
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-surface-200"
                style={{ background: c.avatarColor }}
              >
                {c.name.charAt(0)}
              </div>
            ))}
            {file.collaborators.length > 4 && (
              <span className="text-xs text-white/40 ml-1">+{file.collaborators.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
