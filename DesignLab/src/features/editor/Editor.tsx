import { useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, LayoutGrid, MessageSquare, AlertTriangle } from 'lucide-react'
import { Toolbar } from './Toolbar'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'
import { Canvas } from './Canvas'
import { CollaboratorsStrip } from './CollaboratorsStrip'
import { ConnectionStatus } from './ConnectionStatus'
import { CommentsPanel } from '@/features/comments/CommentsPanel'
import { useNodes } from './useNodes'
import { useCollaboration } from '@/features/collaboration/useCollaboration'
import { useEditorStore } from '@/store/editorStore'
import { useApiModeStore } from '@/store/apiModeStore'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'

function EditorInner({ fileId }: { fileId: string }) {
  const { showComments, showLayers, toggleComments, toggleLayers, setFileId } = useEditorStore()
  const { mode, setMode, connectionStatus } = useApiModeStore()

  useNodes(fileId)
  useCollaboration(fileId)

  useEffect(() => {
    setFileId(fileId)
    return () => setFileId(null)
  }, [fileId, setFileId])

  const { data: file } = useQuery({
    queryKey: ['file', fileId, mode],
    queryFn: () => apiClient.getFile(fileId),
  })

  const showRealError = mode === 'real' && (connectionStatus === 'error' || connectionStatus === 'offline')

  return (
    <div className="h-screen bg-surface-400 flex flex-col overflow-hidden text-white">
      {/* Real backend error banner */}
      {showRealError && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2 text-red-400 text-xs">
          <AlertTriangle size={13} />
          <span>Cannot reach the backend server at <code className="bg-red-500/10 px-1 rounded">{import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}</code>. Switch to Mock mode or start your backend.</span>
          <button
            onClick={() => setMode('mock')}
            className="ml-auto underline hover:no-underline"
          >
            Switch to Mock
          </button>
        </div>
      )}

      {/* Top bar */}
      <header className="h-12 bg-surface-300 border-b border-border flex items-center px-3 gap-2 shrink-0 overflow-x-auto">
        <BackButton />

        <div className="w-px h-5 bg-border mx-1" />

        {/* File name */}
        <span className="text-white/70 text-sm truncate max-w-[160px]">
          {file?.title ?? '…'}
        </span>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Tools */}
        <Toolbar />

        <div className="ml-auto flex items-center gap-3">
          {/* Collaborators */}
          <CollaboratorsStrip />

          {/* Comments toggle */}
          <button
            onClick={toggleComments}
            title="Comments (⌘/)"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              showComments ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            <MessageSquare size={14} />
          </button>

          {/* Layers toggle (mobile) */}
          <button
            onClick={toggleLayers}
            title="Layers"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors md:hidden ${
              showLayers ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            <LayoutGrid size={14} />
          </button>

          <div className="w-px h-5 bg-border" />

          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-surface-400 border border-border rounded-lg p-0.5">
            {(['mock', 'real'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  mode === m ? 'bg-accent text-white' : 'text-white/30 hover:text-white/60'
                }`}
              >
                {m === 'mock' ? 'Mock' : 'Real'}
              </button>
            ))}
          </div>

          <ConnectionStatus />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        {showLayers && (
          <div className="w-56 bg-surface-300 border-r border-border shrink-0 hidden md:block">
            <LeftSidebar />
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <Canvas fileId={fileId} />
        </div>

        {/* Right sidebar — properties OR comments */}
        <div className="w-72 bg-surface-300 border-l border-border shrink-0 hidden md:block overflow-hidden">
          {showComments ? (
            <CommentsPanel fileId={fileId} />
          ) : (
            <RightSidebar fileId={fileId} />
          )}
        </div>
      </div>
    </div>
  )
}

function BackButton() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/')}
      className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors"
    >
      <ArrowLeft size={13} />
      <div className="w-5 h-5 rounded bg-accent flex items-center justify-center">
        <LayoutGrid size={10} className="text-white" />
      </div>
    </button>
  )
}

export function Editor() {
  const { fileId } = useParams<{ fileId: string }>()

  if (!fileId) {
    return <Navigate to="/" replace />
  }

  return <EditorInner fileId={fileId} />
}
