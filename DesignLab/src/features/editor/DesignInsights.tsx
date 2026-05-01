import { AlertTriangle, CheckCircle2, MessageSquare, Palette, Target } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { useComments } from '@/features/comments/useComments'

function uniqueColors(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.startsWith('#') || value.startsWith('rgb'))
    )
  )
}

function scoreFromSignals(signals: {
  frameCount: number
  textCount: number
  colorCount: number
  openComments: number
  layerCount: number
}) {
  let score = 20
  if (signals.frameCount > 0) score += 20
  if (signals.layerCount >= 6) score += 18
  if (signals.textCount >= 2) score += 16
  if (signals.colorCount >= 2 && signals.colorCount <= 8) score += 14
  if (signals.openComments > 0) score += 8
  if (signals.openComments === 0 && signals.layerCount > 0) score += 4
  return Math.min(score, 100)
}

export function DesignInsights({ fileId }: { fileId: string }) {
  const nodes = useEditorStore((s) => s.nodes)
  const { data: comments } = useComments(fileId)

  const frameCount = nodes.filter((node) => node.type === 'frame').length
  const textCount = nodes.filter((node) => node.type === 'text' || node.type === 'input' || node.type === 'button').length
  const shapeCount = nodes.filter((node) => node.type === 'rectangle' || node.type === 'ellipse' || node.type === 'input' || node.type === 'button').length
  const colors = uniqueColors(nodes.flatMap((node) => [node.fill, node.stroke]))
  const openComments = (comments ?? []).filter((comment) => !comment.resolved).length
  const score = scoreFromSignals({
    frameCount,
    textCount,
    colorCount: colors.length,
    openComments,
    layerCount: nodes.length,
  })

  const nextSteps: string[] = []
  if (nodes.length === 0) nextSteps.push('Create from a starter template or add a frame before designing details.')
  if (frameCount === 0 && nodes.length > 0) nextSteps.push('Group the work into frames so the backend can store screen boundaries.')
  if (textCount < 2 && nodes.length > 0) nextSteps.push('Add real copy blocks to test content density and typography controls.')
  if (colors.length > 8) nextSteps.push('Reduce color drift or introduce token metadata before design-system work.')
  if (openComments > 0) nextSteps.push('Use open comments as acceptance criteria for the next backend task.')
  if (nextSteps.length === 0) nextSteps.push('Connect this file to real persistence and compare mock vs real behavior.')

  return (
    <section className="border-b border-border p-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Target size={13} className="text-cyan-300" />
          <p className="text-[10px] text-white/35 uppercase tracking-wider">Design audit</p>
        </div>
        <span className="text-[10px] text-white/35">{score}/100</span>
      </div>

      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded bg-white/[0.03] border border-border px-2 py-1.5">
          <p className="text-[10px] text-white/35">Layers</p>
          <p className="text-sm font-semibold">{nodes.length}</p>
        </div>
        <div className="rounded bg-white/[0.03] border border-border px-2 py-1.5">
          <p className="text-[10px] text-white/35">Frames</p>
          <p className="text-sm font-semibold">{frameCount}</p>
        </div>
        <div className="rounded bg-white/[0.03] border border-border px-2 py-1.5">
          <p className="text-[10px] text-white/35">Text</p>
          <p className="text-sm font-semibold">{textCount}</p>
        </div>
        <div className="rounded bg-white/[0.03] border border-border px-2 py-1.5">
          <p className="text-[10px] text-white/35">Shapes</p>
          <p className="text-sm font-semibold">{shapeCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2 text-xs text-white/55">
        <Palette size={12} />
        <span>{colors.length} colors</span>
        <MessageSquare size={12} className="ml-2" />
        <span>{openComments} open comments</span>
      </div>

      <div className="space-y-1.5">
        {nextSteps.slice(0, 3).map((step, index) => {
          const healthy = score >= 80 && index === 0
          const Icon = healthy ? CheckCircle2 : AlertTriangle
          return (
            <div key={step} className="flex gap-2 text-xs text-white/55 leading-relaxed">
              <Icon size={12} className={healthy ? 'text-green-400 shrink-0 mt-0.5' : 'text-yellow-400 shrink-0 mt-0.5'} />
              <span>{step}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
