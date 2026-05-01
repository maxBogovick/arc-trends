import type { RideStatus, DriverAvailability } from '@/shared/types'

const STATUS_CFG: Record<RideStatus, { bg: string; dot: string; text: string; label: string }> = {
  requested:       { bg: 'bg-amber-50   border border-amber-200',  dot: 'bg-amber-400',   text: 'text-amber-700',   label: 'Requested'        },
  matching:        { bg: 'bg-blue-50    border border-blue-200',   dot: 'bg-blue-500 animate-pulse', text: 'text-blue-700',    label: 'Matching…'        },
  driver_assigned: { bg: 'bg-violet-50  border border-violet-200', dot: 'bg-violet-500',  text: 'text-violet-700',  label: 'Driver assigned'  },
  driver_arriving: { bg: 'bg-cyan-50    border border-cyan-200',   dot: 'bg-cyan-500',    text: 'text-cyan-700',    label: 'Driver arriving'  },
  pickup:          { bg: 'bg-teal-50    border border-teal-200',   dot: 'bg-teal-500',    text: 'text-teal-700',    label: 'At pickup'        },
  in_progress:     { bg: 'bg-green-50   border border-green-200',  dot: 'bg-green-500 animate-pulse', text: 'text-green-700',  label: 'In progress'      },
  completed:       { bg: 'bg-slate-100  border border-slate-200',  dot: 'bg-slate-400',   text: 'text-slate-600',   label: 'Completed'        },
  cancelled:       { bg: 'bg-red-50     border border-red-200',    dot: 'bg-red-500',     text: 'text-red-700',     label: 'Cancelled'        },
}

const AVAIL_CFG: Record<DriverAvailability, { bg: string; dot: string; text: string }> = {
  available: { bg: 'bg-green-50  border border-green-200',  dot: 'bg-green-500 animate-pulse', text: 'text-green-700'  },
  busy:      { bg: 'bg-amber-50  border border-amber-200',  dot: 'bg-amber-500',               text: 'text-amber-700'  },
  offline:   { bg: 'bg-slate-100 border border-slate-200',  dot: 'bg-slate-400',               text: 'text-slate-500'  },
}

export function RideStatusBadge({ status }: { status: RideStatus }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export function DriverStatusBadge({ status }: { status: DriverAvailability }) {
  const cfg = AVAIL_CFG[status]
  const label = status === 'available' ? 'Available' : status === 'busy' ? 'On ride' : 'Offline'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {label}
    </span>
  )
}
