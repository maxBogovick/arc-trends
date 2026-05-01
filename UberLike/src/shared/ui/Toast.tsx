import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Info, X, Zap } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
}

type AddFn = (item: Omit<ToastItem, 'id'>) => void
let _add: AddFn | null = null

export function toast(title: string, type: ToastType = 'info', message?: string) {
  _add?.({ title, type, message })
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={15} className="text-green-600" />,
  error:   <AlertCircle  size={15} className="text-red-500"   />,
  warning: <Zap          size={15} className="text-amber-500" />,
  info:    <Info         size={15} className="text-blue-500"  />,
}

const BORDER: Record<ToastType, string> = {
  success: 'border-green-200 bg-white',
  error:   'border-red-200   bg-white',
  warning: 'border-amber-200 bg-white',
  info:    'border-slate-200  bg-white',
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setItems(p => p.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    _add = (item) => {
      const id = Math.random().toString(36).slice(2, 9)
      setItems(p => [...p.slice(-4), { ...item, id }])
      setTimeout(() => remove(id), 4200)
    }
    return () => { _add = null }
  }, [remove])

  if (items.length === 0) return null

  return (
    <div className="fixed top-[60px] right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {items.map(item => (
        <div
          key={item.id}
          className={`flex items-start gap-3 w-[300px] px-4 py-3 rounded-xl border shadow-elevated pointer-events-auto slide-up ${BORDER[item.type]}`}
        >
          <div className="shrink-0 mt-0.5">{ICONS[item.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 font-semibold text-sm leading-snug">{item.title}</p>
            {item.message && (
              <p className="text-slate-500 text-xs mt-0.5 leading-snug">{item.message}</p>
            )}
          </div>
          <button
            onClick={() => remove(item.id)}
            className="text-slate-300 hover:text-slate-500 shrink-0 mt-0.5 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
