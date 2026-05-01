import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { useCreateFile } from './useFiles'
import { FILE_TEMPLATES, type FileTemplateId } from '@/shared/templates'

interface NewFileModalProps {
  open: boolean
  onClose: () => void
}

export function NewFileModal({ open, onClose }: NewFileModalProps) {
  const [title, setTitle] = useState('')
  const [templateId, setTemplateId] = useState<FileTemplateId>('mobile-onboarding')
  const navigate = useNavigate()
  const { mutate, isPending } = useCreateFile()

  const selectTemplate = (nextTemplateId: FileTemplateId) => {
    const template = FILE_TEMPLATES.find((t) => t.id === nextTemplateId)
    setTemplateId(nextTemplateId)
    if (!title.trim() && template && template.id !== 'blank') {
      setTitle(template.name)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    mutate(
      { title: title.trim(), templateId },
      {
        onSuccess: (file) => {
          setTitle('')
          setTemplateId('mobile-onboarding')
          onClose()
          navigate(`/editor/${file.id}`)
        },
      }
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="New design file">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="File name"
          placeholder="Untitled"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div className="space-y-2">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Starter scenario</p>
          <div className="grid grid-cols-1 gap-2">
            {FILE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template.id)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  templateId === template.id
                    ? 'border-accent/60 bg-accent/10'
                    : 'border-border bg-surface-300 hover:border-border-strong'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">{template.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-white/35">
                    {template.nodeCount} layers
                  </span>
                </div>
                <p className="text-xs text-white/45 leading-relaxed mt-1">{template.summary}</p>
                <p className="text-[10px] text-accent-light mt-2">{template.bestFor}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={!title.trim()}>
            Create file
          </Button>
        </div>
      </form>
    </Modal>
  )
}
