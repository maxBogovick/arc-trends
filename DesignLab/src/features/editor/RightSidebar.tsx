import { useEditorStore } from '@/store/editorStore'
import { useUpdateNode, useDeleteNode } from './useNodes'
import { DesignInsights } from './DesignInsights'
import { AlignCenter, AlignLeft, AlignRight, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { UpdateNodeInput } from '@/api/contracts'
import type { NodeShadow, TextAlign } from '@/shared/types'

interface NumInputProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}

const FILL_SWATCHES = ['#7c5cfc', '#38bdf8', '#f472b6', '#22c55e', '#f59e0b', '#ef4444', '#111827', '#ffffff']
const SHADOW_OPTIONS: { value: NodeShadow; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'soft', label: 'Soft' },
  { value: 'medium', label: 'Med' },
  { value: 'strong', label: 'Strong' },
]

const ALIGN_OPTIONS: { value: TextAlign; icon: React.ElementType; label: string }[] = [
  { value: 'left', icon: AlignLeft, label: 'Align left' },
  { value: 'center', icon: AlignCenter, label: 'Align center' },
  { value: 'right', icon: AlignRight, label: 'Align right' },
]

function clamp(value: number, min?: number, max?: number) {
  if (typeof min === 'number' && value < min) return min
  if (typeof max === 'number' && value > max) return max
  return value
}

function NumInput({ label, value, onChange, min, max, step = 1 }: NumInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-white/35 uppercase tracking-wider">{label}</label>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (Number.isNaN(next)) return
          onChange(clamp(next, min, max))
        }}
        min={min}
        max={max}
        step={step}
        className="bg-surface-400 border border-border hover:border-border-strong focus:border-accent focus:outline-none text-white text-xs rounded px-2 py-1.5 w-full"
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-3 border-b border-border">
      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}

function ColorField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const safeColor = value.startsWith('#') && (value.length === 4 || value.length === 7) ? value : '#ffffff'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safeColor}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-surface-400 border border-border focus:border-accent focus:outline-none text-white text-xs rounded px-2 py-1.5"
        />
      </div>
      <div className="grid grid-cols-8 gap-1">
        {FILL_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onChange(color)}
            className="h-5 rounded border border-white/15 hover:border-white/60 transition-colors"
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  )
}

export function RightSidebar({ fileId }: { fileId: string }) {
  const { selectedNodeId, nodes } = useEditorStore()
  const updateNode = useEditorStore((s) => s.updateNode)
  const { mutate: saveUpdate } = useUpdateNode(fileId)
  const { mutate: deleteNode } = useDeleteNode(fileId)

  const node = nodes.find((n) => n.id === selectedNodeId)

  const update = (changes: UpdateNodeInput) => {
    if (!node) return
    updateNode(node.id, changes)
    saveUpdate({ nodeId: node.id, changes })
  }

  if (!node) {
    return (
      <div className="h-full overflow-y-auto">
        <DesignInsights fileId={fileId} />
        <div className="flex flex-col items-center justify-center gap-3 p-5 text-center">
          <div className="w-10 h-10 rounded-lg border border-border bg-white/[0.03] flex items-center justify-center text-white/30">
            <SlidersHorizontal size={16} />
          </div>
          <p className="text-white/35 text-xs leading-relaxed">
            Select a layer to edit layout, color, border, shadow, and typography.
          </p>
        </div>
      </div>
    )
  }

  const isText = node.type === 'text'
  const hasTextContent = node.type === 'text' || node.type === 'input' || node.type === 'button'
  const strokeWidth = node.strokeWidth ?? 0
  const strokeColor = node.stroke ?? '#111827'
  const shadow = node.shadow ?? 'none'
  const textAlign = node.textAlign ?? 'left'

  return (
    <div className="h-full overflow-y-auto">
      <Section title="Layer">
        <div className="space-y-2">
          <input
            type="text"
            value={node.name}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full bg-surface-400 border border-border focus:border-accent focus:outline-none text-white text-xs rounded px-2 py-1.5"
          />
          <div className="inline-flex items-center rounded bg-white/[0.04] border border-border px-2 py-1 text-[10px] text-white/45 uppercase tracking-wider">
            {node.type}
          </div>
        </div>
      </Section>

      <Section title="Position">
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="X" value={node.x} onChange={(x) => update({ x })} />
          <NumInput label="Y" value={node.y} onChange={(y) => update({ y })} />
        </div>
      </Section>

      <Section title="Size">
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="W" value={node.width} onChange={(width) => update({ width })} min={1} />
          <NumInput label="H" value={node.height} onChange={(height) => update({ height })} min={1} />
        </div>
      </Section>

      <Section title="Transform">
        <div className="grid grid-cols-2 gap-2">
          <NumInput
            label="Rotation"
            value={node.rotation}
            onChange={(rotation) => update({ rotation })}
            min={-360}
            max={360}
          />
          <NumInput
            label="Opacity"
            value={node.opacity * 100}
            onChange={(v) => update({ opacity: Math.min(1, Math.max(0, v / 100)) })}
            min={0}
            max={100}
          />
        </div>
      </Section>

      <Section title="Fill">
        <ColorField value={node.fill} onChange={(fill) => update({ fill })} />
      </Section>

      {!isText && (
        <Section title="Stroke & radius">
          <div className="space-y-3">
            <ColorField
              value={strokeColor}
              onChange={(stroke) =>
                update({ stroke, strokeWidth: Math.max(1, node.strokeWidth ?? 1) })
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <NumInput
                label="Stroke"
                value={strokeWidth}
                onChange={(value) =>
                  update({
                    strokeWidth: value,
                    stroke: value > 0 ? strokeColor : node.stroke,
                  })
                }
                min={0}
                max={24}
              />
              {node.type !== 'ellipse' ? (
                <NumInput
                  label="Radius"
                  value={node.radius ?? (node.type === 'frame' ? 16 : 8)}
                  onChange={(radius) => update({ radius })}
                  min={0}
                  max={160}
                />
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-white/35 uppercase tracking-wider">Radius</span>
                  <div className="bg-surface-400 border border-border text-white/35 text-xs rounded px-2 py-1.5">
                    Ellipse
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {!isText && (
        <Section title="Shadow">
          <div className="grid grid-cols-4 gap-1">
            {SHADOW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update({ shadow: option.value })}
                className={`rounded px-2 py-1.5 text-[10px] font-medium transition-colors ${
                  shadow === option.value
                    ? 'bg-accent/20 text-accent'
                    : 'bg-white/[0.03] text-white/35 hover:text-white/70 hover:bg-white/[0.06]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Section>
      )}

      {hasTextContent && (
        <Section title={isText ? 'Text' : 'Content'}>
          <div className="space-y-3">
            <textarea
              value={node.text ?? ''}
              onChange={(e) => update({ text: e.target.value })}
              rows={3}
              className="w-full bg-surface-400 border border-border focus:border-accent focus:outline-none text-white text-xs rounded px-2 py-1.5 resize-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <NumInput
                label="Size"
                value={node.fontSize ?? (isText ? Math.max(12, node.height * 0.6) : 15)}
                onChange={(fontSize) => update({ fontSize })}
                min={8}
                max={160}
              />
              <NumInput
                label="Weight"
                value={node.fontWeight ?? (node.type === 'button' ? 700 : 600)}
                onChange={(fontWeight) => update({ fontWeight })}
                min={100}
                max={900}
                step={100}
              />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => update({ textAlign: value })}
                  className={`h-8 rounded flex items-center justify-center transition-colors ${
                    textAlign === value
                      ? 'bg-accent/20 text-accent'
                      : 'bg-white/[0.03] text-white/40 hover:text-white/70'
                  }`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      <DesignInsights fileId={fileId} />

      <div className="p-3">
        <button
          onClick={() => deleteNode(node.id)}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 text-xs transition-colors"
        >
          <Trash2 size={12} />
          Delete layer
        </button>
      </div>
    </div>
  )
}
