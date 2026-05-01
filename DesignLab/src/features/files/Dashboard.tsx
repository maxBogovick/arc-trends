import { useState } from 'react'
import {
  Search,
  Plus,
  Clock,
  Users,
  FileText,
  AlertCircle,
  LayoutGrid,
  List,
  BookOpen,
  Boxes,
  Server,
  Radio,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import { useFiles } from './useFiles'
import { FileCard } from './FileCard'
import { NewFileModal } from './NewFileModal'
import { useApiModeStore } from '@/store/apiModeStore'
import { Button } from '@/shared/ui/Button'
import { FILE_TEMPLATES } from '@/shared/templates'

type Filter = 'recent' | 'shared' | 'drafts'

const FILTER_LABELS: Record<Filter, string> = {
  recent: 'Recent',
  shared: 'Shared with me',
  drafts: 'My drafts',
}

const FILTER_ICONS = { recent: Clock, shared: Users, drafts: FileText }

const DEVELOPMENT_TRACKS = [
  {
    icon: Server,
    title: 'REST contract',
    status: 'Ready to implement',
    detail: '12 endpoints for files, nodes, comments, and replies.',
  },
  {
    icon: Radio,
    title: 'Realtime',
    status: 'Mocked locally',
    detail: 'Presence, cursor movement, node updates, and comment events.',
  },
  {
    icon: ShieldCheck,
    title: 'Production gaps',
    status: 'Next sprint',
    detail: 'Auth, persistence, permissions, and conflict handling.',
  },
]

export function Dashboard() {
  const [filter, setFilter] = useState<Filter>('recent')
  const [search, setSearch] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const { data: files, isPending, isError, refetch } = useFiles()
  const { mode, setMode } = useApiModeStore()

  const allFiles = files ?? []
  const filterCounts: Record<Filter, number> = {
    recent: allFiles.length,
    shared: allFiles.filter((f) => f.owner !== 'You').length,
    drafts: allFiles.filter((f) => f.owner === 'You' && f.collaborators.length === 0).length,
  }
  const activeCollaborators = new Set(allFiles.flatMap((f) => f.collaborators.map((c) => c.id))).size
  const sharedRatio = allFiles.length > 0 ? Math.round((filterCounts.shared / allFiles.length) * 100) : 0

  const filtered = allFiles.filter((f) => {
    const matchSearch = f.title.toLowerCase().includes(search.toLowerCase())
    if (filter === 'shared') return matchSearch && f.owner !== 'You'
    if (filter === 'drafts') return matchSearch && f.owner === 'You' && f.collaborators.length === 0
    return matchSearch
  })

  return (
    <div className="min-h-screen bg-[#141416] text-white flex flex-col">
      {/* Top Nav */}
      <header className="min-h-16 bg-surface-300 border-b border-border flex items-center px-4 sm:px-6 py-3 gap-3 shrink-0 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
            <LayoutGrid size={14} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-white tracking-tight text-sm block">DesignLab</span>
            <span className="text-[10px] uppercase tracking-wider text-white/30 hidden sm:block">Workspace</span>
          </div>
        </div>

        {/* Search */}
        <div className="order-last sm:order-none w-full sm:w-auto sm:flex-1 sm:max-w-xl relative sm:ml-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-400 border border-border focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/30 transition-colors"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-surface-400 border border-border rounded-lg p-1">
            {(['mock', 'real'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  mode === m
                    ? 'bg-accent text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {m === 'mock' ? 'Mock' : 'Real API'}
              </button>
            ))}
          </div>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
            Y
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside className="w-60 bg-surface-300 border-r border-border p-4 shrink-0 hidden md:flex flex-col gap-1">
          <p className="text-white/30 text-xs uppercase tracking-widest font-semibold px-2 mb-2">
            Files
          </p>
          {(['recent', 'shared', 'drafts'] as const).map((f) => {
            const Icon = FILTER_ICONS[f]
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors ${
                  filter === f
                    ? 'bg-accent/15 text-accent'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={15} />
                <span className="flex-1 text-left">{FILTER_LABELS[f]}</span>
                <span className="text-[10px] text-white/30">{filterCounts[f]}</span>
              </button>
            )
          })}

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-white/30 text-xs uppercase tracking-widest font-semibold px-2 mb-2">
              Build tracks
            </p>
            <div className="space-y-2">
              {DEVELOPMENT_TRACKS.map(({ icon: Icon, title, status }) => (
                <div key={title} className="px-2 py-2 rounded-lg bg-white/[0.03] border border-border">
                  <div className="flex items-center gap-2 text-white/70 text-xs font-medium">
                    <Icon size={13} className="text-accent-light" />
                    {title}
                  </div>
                  <p className="text-[10px] text-white/35 mt-1">{status}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">{FILTER_LABELS[filter]}</h1>
                <p className="text-white/40 text-sm mt-1">
                  {filtered.length} files visible in this workspace
                </p>
              </div>
              <Button onClick={() => setShowNewModal(true)} size="md">
                <Plus size={15} />
                New file
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-surface-300 border border-border rounded-lg p-4">
                <p className="text-white/35 text-[10px] uppercase tracking-wider">Files</p>
                <p className="text-xl font-semibold mt-1">{allFiles.length}</p>
              </div>
              <div className="bg-surface-300 border border-border rounded-lg p-4">
                <p className="text-white/35 text-[10px] uppercase tracking-wider">Shared</p>
                <p className="text-xl font-semibold mt-1 text-cyan-300">{filterCounts.shared}</p>
              </div>
              <div className="bg-surface-300 border border-border rounded-lg p-4">
                <p className="text-white/35 text-[10px] uppercase tracking-wider">Collaborators</p>
                <p className="text-xl font-semibold mt-1 text-pink-300">{activeCollaborators}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-4 mt-4">
              <section className="bg-surface-300 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-accent-light" />
                    <h2 className="text-sm font-semibold text-white">Project intelligence</h2>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-white/35">
                    Mock data with purpose
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white/[0.03] border border-border p-3">
                    <p className="text-[10px] text-white/35 uppercase tracking-wider">API surface</p>
                    <p className="text-lg font-semibold mt-1">12 endpoints</p>
                    <p className="text-xs text-white/45 mt-1">Enough to build a real CRUD backend.</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] border border-border p-3">
                    <p className="text-[10px] text-white/35 uppercase tracking-wider">Collaboration</p>
                    <p className="text-lg font-semibold mt-1">{sharedRatio}% shared</p>
                    <p className="text-xs text-white/45 mt-1">Useful for permissions and presence tests.</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] border border-border p-3">
                    <p className="text-[10px] text-white/35 uppercase tracking-wider">Scenarios</p>
                    <p className="text-lg font-semibold mt-1">{FILE_TEMPLATES.length} starters</p>
                    <p className="text-xs text-white/45 mt-1">Create files that exercise real product states.</p>
                  </div>
                </div>
              </section>

              <section className="bg-surface-300 border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Workflow size={16} className="text-cyan-300" />
                  <h2 className="text-sm font-semibold text-white">Next useful work</h2>
                </div>
                <div className="space-y-2">
                  {DEVELOPMENT_TRACKS.map(({ icon: Icon, title, detail }) => (
                    <div key={title} className="flex gap-2">
                      <div className="w-7 h-7 rounded bg-white/[0.04] border border-border flex items-center justify-center shrink-0 text-white/50">
                        <Icon size={13} />
                      </div>
                      <div>
                        <p className="text-xs text-white font-medium">{title}</p>
                        <p className="text-xs text-white/45 leading-relaxed">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="mt-4 bg-surface-300 border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Boxes size={16} className="text-pink-300" />
                <h2 className="text-sm font-semibold text-white">Starter scenarios</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
                {FILE_TEMPLATES.map((template) => (
                  <div key={template.id} className="rounded-lg bg-white/[0.03] border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-white truncate">{template.name}</p>
                      <span className="text-[10px] text-white/30 shrink-0">{template.nodeCount}</span>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed mt-1 line-clamp-2">
                      {template.bestFor}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Mobile filter tabs */}
          <div className="flex gap-2 mb-5 md:hidden">
            {(['recent', 'shared', 'drafts'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f ? 'bg-accent text-white' : 'bg-surface-200 text-white/50'
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {/* States */}
          {isPending && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-surface-200 border border-border rounded-lg overflow-hidden animate-pulse">
                  <div className="h-44 bg-surface-300" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-surface-300 rounded w-3/4" />
                    <div className="h-3 bg-surface-300 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-white/50">
              <AlertCircle size={40} className="text-red-400" />
              <p className="text-white font-medium">Failed to load files</p>
              <p className="text-sm">
                {mode === 'real' ? 'Cannot reach the backend server.' : 'Unexpected error.'}
              </p>
              <Button variant="secondary" onClick={() => refetch()} size="sm">
                Retry
              </Button>
            </div>
          )}

          {!isPending && !isError && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-white/50">
              <List size={40} />
              <p className="text-white font-medium">
                {search ? `No files matching "${search}"` : 'No files here yet'}
              </p>
              {!search && (
                <Button onClick={() => setShowNewModal(true)} size="sm">
                  <Plus size={14} />
                  Create your first file
                </Button>
              )}
            </div>
          )}

          {!isPending && !isError && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((f) => (
                <FileCard key={f.id} file={f} />
              ))}
            </div>
          )}
        </main>
      </div>

      <NewFileModal open={showNewModal} onClose={() => setShowNewModal(false)} />
    </div>
  )
}
