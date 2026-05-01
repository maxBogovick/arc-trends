import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  full?: boolean
  children: ReactNode
}

const V: Record<NonNullable<Props['variant']>, string> = {
  primary:
    'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-sm hover:shadow-md',
  secondary:
    'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm',
  danger:
    'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm hover:shadow-md',
  ghost:
    'hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900',
  outline:
    'border-2 border-brand-600 text-brand-700 hover:bg-brand-50 active:bg-brand-100',
}

const S: Record<NonNullable<Props['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs h-8 gap-1.5',
  md: 'px-4 py-2 text-sm h-9 gap-2',
  lg: 'px-5 py-2.5 text-sm h-11 gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  full,
  children,
  className = '',
  disabled,
  ...p
}: Props) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium rounded-xl
        transition-all duration-150 select-none
        disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
        ${V[variant]} ${S[size]} ${full ? 'w-full' : ''} ${className}
      `}
      disabled={disabled || loading}
      {...p}
    >
      {loading && (
        <span
          className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
          style={{ borderTopColor: 'transparent' }}
        />
      )}
      {children}
    </button>
  )
}
