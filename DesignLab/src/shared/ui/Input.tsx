import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-surface-300 border border-border hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 text-white text-sm rounded-lg px-3 py-2 placeholder:text-white/30 transition-colors ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
