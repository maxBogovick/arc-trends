import { useState, useEffect, useRef } from 'react'
import {
  Power, Navigation, CheckCircle2, MapPin, Clock, TrendingUp,
  AlertCircle, Phone, Star, BarChart2, Zap, ThumbsUp,
} from 'lucide-react'
import { useRideStore } from '@/store/rideStore'
import { useDriverOnlineToggle, useDriverAcceptRide, useDriverRejectRide, useUpdateRideStatus, useDriverRealtime } from './useDriver'
import { Button } from '@/shared/ui/Button'
import { RideStatusBadge } from '@/shared/ui/Badge'
import { formatCurrency, formatDistanceToNow } from '@/shared/utils/time'
import { toast } from '@/shared/ui/Toast'
import type { RideStatus } from '@/shared/types'

const STATUS_ACTIONS: { fromStatus: RideStatus; nextStatus: RideStatus; label: string }[] = [
  { fromStatus: 'driver_assigned', nextStatus: 'driver_arriving', label: 'Start driving to pickup' },
  { fromStatus: 'driver_arriving', nextStatus: 'pickup',          label: 'Arrived at pickup' },
  { fromStatus: 'pickup',          nextStatus: 'in_progress',     label: 'Start trip' },
  { fromStatus: 'in_progress',     nextStatus: 'completed',       label: 'Complete trip' },
]

// Rider name pool — deterministic by ride id hash
const RIDER_NAMES = [
  { name: 'Alex M.',    color: '#7c3aed' },
  { name: 'Sofia R.',   color: '#db2777' },
  { name: 'Dan P.',     color: '#0284c7' },
  { name: 'Maria L.',   color: '#059669' },
  { name: 'Ion C.',     color: '#d97706' },
  { name: 'Natalia V.', color: '#dc2626' },
  { name: 'Andrei S.',  color: '#16a34a' },
  { name: 'Elena B.',   color: '#9333ea' },
]

function riderFromId(id: string) {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return RIDER_NAMES[hash % RIDER_NAMES.length]
}

// Mock hourly earnings for the past 8 hours
const HOURLY_EARNINGS = [42, 0, 18, 55, 71, 38, 93, 127]

// ── Countdown ring ────────────────────────────────────────────────────────────

function CountdownRing({ seconds, total = 30 }: { seconds: number; total?: number }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const progress = (seconds / total) * circ
  const color = seconds > 15 ? '#f59e0b' : seconds > 8 ? '#f97316' : '#ef4444'
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ - progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="text-lg font-black relative z-10" style={{ color }}>{seconds}</span>
    </div>
  )
}

// ── Hourly earnings bar chart ─────────────────────────────────────────────────

function HourlyChart({ data }: { data: number[] }) {
  const max = Math.max(...data) || 1
  const now = new Date().getHours()
  const labels = data.map((_, i) => {
    const h = (now - (data.length - 1 - i) + 24) % 24
    return h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`
  })

  return (
    <div className="flex items-end gap-1.5 h-16" title="Hourly earnings today">
      {data.map((v, i) => {
        const isNow = i === data.length - 1
        const pct = v / max
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex items-end" style={{ height: 44 }}>
              <div
                className={`w-full rounded-t-sm transition-all duration-700 ${isNow ? 'bg-brand-500' : 'bg-slate-200'}`}
                style={{ height: `${Math.max(pct * 100, v === 0 ? 0 : 8)}%` }}
              />
            </div>
            <span className={`text-[8px] tabular-nums leading-none ${isNow ? 'text-brand-600 font-bold' : 'text-slate-300'}`}>
              {labels[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Live fare meter (driver-side) ─────────────────────────────────────────────

function LiveFareMeter({ baseFare, pricePerMinute }: { baseFare: number; pricePerMinute: number }) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 500)
    return () => clearInterval(id)
  }, [])

  const fare = baseFare + (elapsed / 60000) * pricePerMinute
  const minutes = elapsed / 60000

  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl px-4 py-3">
      <div>
        <p className="text-green-700 text-xs font-semibold uppercase tracking-wide">Earning</p>
        <p className="text-green-500 text-[10px] mt-0.5 tabular-nums">{minutes.toFixed(1)} min elapsed</p>
      </div>
      <p className="text-green-800 font-black text-2xl tabular-nums">{formatCurrency(fare)}</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function DriverPanel() {
  useDriverRealtime()

  const { driverOnline, incomingRideRequest, currentDriverRide, nearbyDrivers } = useRideStore()
  const { mutate: toggleOnline, isPending: toggling }    = useDriverOnlineToggle()
  const { mutate: acceptRide,   isPending: accepting }   = useDriverAcceptRide()
  const { mutate: rejectRide,   isPending: rejecting }   = useDriverRejectRide()
  const { mutate: updateStatus, isPending: updatingStatus } = useUpdateRideStatus()

  const [countdown, setCountdown] = useState(30)
  const [todayEarnings, setTodayEarnings] = useState(HOURLY_EARNINGS[HOURLY_EARNINGS.length - 1])
  const [totalRides, setTotalRides] = useState(8)

  // Countdown on incoming request
  useEffect(() => {
    if (!incomingRideRequest) { setCountdown(30); return }
    setCountdown(30)
    const id = setInterval(() => setCountdown(prev => {
      if (prev <= 1) { clearInterval(id); return 0 }
      return prev - 1
    }), 1000)
    return () => clearInterval(id)
  }, [incomingRideRequest])

  // Toast + accumulate earnings when ride completes
  useEffect(() => {
    if (currentDriverRide?.status === 'completed' && currentDriverRide.finalFare) {
      const earned = currentDriverRide.finalFare
      toast('Trip completed!', 'success', `+${formatCurrency(earned)} earned`)
      setTodayEarnings(prev => prev + earned)
      setTotalRides(prev => prev + 1)
    }
  }, [currentDriverRide?.status])

  const nextAction = currentDriverRide
    ? STATUS_ACTIONS.find(a => a.fromStatus === currentDriverRide.status)
    : null

  const onlineCount = nearbyDrivers.filter(d => d.availability !== 'offline').length
  const isUrgent = !!incomingRideRequest
  const rider = currentDriverRide ? riderFromId(currentDriverRide.id) : null

  // accumulate hourly chart as today earnings change
  const hourlyData = [...HOURLY_EARNINGS.slice(0, -1), todayEarnings]

  return (
    <div className={`flex flex-col h-full transition-colors duration-300 ${isUrgent ? 'ring-2 ring-inset ring-amber-400' : ''}`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b flex items-center justify-between shrink-0 transition-colors duration-300 ${isUrgent ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Driver Console</p>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${driverOnline ? (currentDriverRide ? 'bg-amber-400' : 'bg-green-500 animate-pulse') : 'bg-slate-300'}`} />
            <span className="text-sm font-semibold text-slate-700">
              {driverOnline ? (currentDriverRide ? 'On ride' : `${onlineCount} drivers online`) : 'Offline'}
            </span>
          </div>
        </div>
        <Button
          variant={driverOnline ? 'secondary' : 'primary'}
          size="sm"
          loading={toggling}
          onClick={() => toggleOnline(!driverOnline)}
          className={driverOnline ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}
        >
          <Power size={12} />
          {driverOnline ? 'Go Offline' : 'Go Online'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* === INCOMING REQUEST === */}
        {incomingRideRequest && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" />
                <span className="text-amber-800 font-semibold text-sm">New Request!</span>
              </div>
              <CountdownRing seconds={countdown} />
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <div className="w-px h-6 bg-slate-200 my-1" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Pickup</p>
                    <p className="text-slate-800 font-semibold text-sm truncate">{incomingRideRequest.pickup.label}</p>
                    <p className="text-slate-400 text-xs truncate">{incomingRideRequest.pickup.address}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Destination</p>
                    <p className="text-slate-800 font-semibold text-sm truncate">{incomingRideRequest.destination.label}</p>
                    <p className="text-slate-400 text-xs truncate">{incomingRideRequest.destination.address}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Clock size={13} />,     label: 'ETA',      value: `${incomingRideRequest.estimate.durationMinutes} min` },
                { icon: <MapPin size={13} />,    label: 'Distance', value: `${incomingRideRequest.estimate.distanceKm} km` },
                { icon: <Zap size={13} />,       label: 'Fare',     value: `${formatCurrency(incomingRideRequest.estimate.minFare)}+` },
              ].map(({ icon, label, value }) => (
                <div key={label} className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <div className="flex justify-center text-slate-400 mb-1">{icon}</div>
                  <p className="text-slate-900 font-bold text-sm">{value}</p>
                  <p className="text-slate-400 text-[10px]">{label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" full size="lg" loading={rejecting} onClick={() => rejectRide()}
                className="text-red-600 border-red-200 hover:bg-red-50 rounded-2xl font-semibold">
                Decline
              </Button>
              <Button variant="primary" full size="lg" loading={accepting} onClick={() => acceptRide()}
                className="rounded-2xl font-semibold bg-green-600 hover:bg-green-700 shadow-md">
                Accept
              </Button>
            </div>
          </div>
        )}

        {/* === OFFLINE === */}
        {!driverOnline && !currentDriverRide && !incomingRideRequest && (
          <div className="flex flex-col items-center gap-4 py-10 px-5">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Power size={24} className="text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-slate-700 font-semibold">You're offline</p>
              <p className="text-slate-400 text-sm mt-1">Go online to receive ride requests</p>
            </div>
            <Button onClick={() => toggleOnline(true)} loading={toggling} size="lg" className="px-8">
              Go Online
            </Button>
          </div>
        )}

        {/* === ONLINE WAITING === */}
        {driverOnline && !currentDriverRide && !incomingRideRequest && (
          <div className="flex flex-col items-center gap-4 py-8 px-5">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-green-100 ripple-ring" />
              <div className="absolute inset-0 rounded-full bg-green-100 ripple-ring ripple-ring-2" />
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-elevated z-10 relative">
                <Navigation size={20} className="text-white" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-slate-900 font-semibold">Waiting for requests…</p>
              <p className="text-slate-400 text-sm mt-1">
                {nearbyDrivers.filter(d => d.availability === 'available').length} other drivers nearby
              </p>
            </div>
            {/* Quick stats while waiting */}
            <div className="w-full grid grid-cols-3 gap-2 pt-1">
              {[
                { icon: <TrendingUp size={11} />, label: 'Today',   value: formatCurrency(todayEarnings), color: 'text-brand-600' },
                { icon: <ThumbsUp size={11} />,   label: 'Accept',  value: '94%',                        color: 'text-green-600' },
                { icon: <Star size={11} />,        label: 'Rating',  value: '4.87',                       color: 'text-amber-500' },
              ].map(({ icon, label, value, color }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <div className={`flex justify-center mb-0.5 ${color}`}>{icon}</div>
                  <p className={`font-bold text-sm ${color}`}>{value}</p>
                  <p className="text-slate-400 text-[9px] uppercase tracking-wide">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === ON RIDE === */}
        {currentDriverRide && !incomingRideRequest && (
          <div className="p-4 space-y-3 slide-up">
            <div className="flex items-center justify-between">
              <RideStatusBadge status={currentDriverRide.status} />
              <span className="text-slate-400 text-xs">{formatDistanceToNow(currentDriverRide.updatedAt)}</span>
            </div>

            {/* Live fare during trip */}
            {currentDriverRide.status === 'in_progress' && (
              <LiveFareMeter
                baseFare={currentDriverRide.estimate.minFare}
                pricePerMinute={4.5}
              />
            )}

            {/* Route */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <div className="w-px h-5 bg-slate-200 my-1" />
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 space-y-2.5 min-w-0">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Pickup</p>
                    <p className="text-slate-800 font-semibold text-sm truncate">{currentDriverRide.pickup.label}</p>
                    <p className="text-slate-400 text-xs truncate">{currentDriverRide.pickup.address}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Destination</p>
                    <p className="text-slate-800 font-semibold text-sm truncate">{currentDriverRide.destination.label}</p>
                    <p className="text-slate-400 text-xs truncate">{currentDriverRide.destination.address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Fare estimate */}
            {currentDriverRide.status !== 'in_progress' && (
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <span className="flex items-center gap-1.5 text-slate-500 text-sm">
                  <Zap size={13} /> Est. fare
                </span>
                <span className="text-slate-900 font-black text-lg">
                  {currentDriverRide.finalFare
                    ? formatCurrency(currentDriverRide.finalFare)
                    : `${formatCurrency(currentDriverRide.estimate.minFare)}–${formatCurrency(currentDriverRide.estimate.maxFare)}`}
                </span>
              </div>
            )}

            {/* Rider contact */}
            {rider && currentDriverRide.status !== 'completed' && (
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: rider.color }}>
                  {rider.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 font-semibold text-sm">{rider.name}</p>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} size={9} className={i <= 4 ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'} />
                    ))}
                    <span className="text-slate-400 text-xs ml-0.5">4.9</span>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center hover:bg-brand-700 transition-colors">
                  <Phone size={13} className="text-white" />
                </button>
              </div>
            )}

            {/* Next action */}
            {nextAction && (
              <Button full size="lg" loading={updatingStatus}
                onClick={() => updateStatus(nextAction.nextStatus)}
                className="rounded-2xl font-semibold">
                {nextAction.label}
              </Button>
            )}

            {/* Completed */}
            {currentDriverRide.status === 'completed' && (
              <div className="flex flex-col items-center gap-2 py-5 bg-green-50 rounded-2xl border border-green-200">
                <CheckCircle2 size={28} className="text-green-600" />
                <p className="text-green-800 font-semibold">Trip completed!</p>
                <p className="text-green-700 text-2xl font-black">
                  {formatCurrency(currentDriverRide.finalFare ?? 0)}
                </p>
                <p className="text-green-600 text-xs">Added to today's earnings</p>
              </div>
            )}
          </div>
        )}

        {/* === Earnings section === */}
        {!incomingRideRequest && (
          <div className="px-4 pb-5 mt-2 space-y-3">
            {/* Summary row */}
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5">
                <BarChart2 size={10} /> Today's earnings
              </p>
              <span className="text-slate-500 text-[10px]">{totalRides} rides</span>
            </div>

            {/* Hourly chart */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
              <div className="flex items-end justify-between mb-1">
                <div>
                  <p className="text-slate-900 font-black text-xl">{formatCurrency(todayEarnings)}</p>
                  <p className="text-slate-400 text-[10px]">goal: 500 MDL</p>
                </div>
                <span className="text-green-600 text-xs font-medium flex items-center gap-0.5">
                  <TrendingUp size={9} /> +12%
                </span>
              </div>
              {/* Goal progress bar */}
              <div className="mt-2 mb-3">
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-700"
                    style={{ width: `${Math.min((todayEarnings / 500) * 100, 100).toFixed(0)}%` }}
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5 text-right">
                  {Math.min((todayEarnings / 500) * 100, 100).toFixed(0)}% of daily goal
                </p>
              </div>
              <HourlyChart data={hourlyData} />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <ThumbsUp size={11} />, label: 'Accept rate', value: '94%',  color: 'text-green-600' },
                { icon: <Star size={11} />,      label: 'Avg rating',  value: '4.87', color: 'text-amber-500' },
                { icon: <Clock size={11} />,     label: 'Online hrs',  value: '6.2h', color: 'text-blue-600'  },
              ].map(({ icon, label, value, color }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <div className={`flex justify-center mb-0.5 ${color}`}>{icon}</div>
                  <p className={`font-bold text-sm ${color}`}>{value}</p>
                  <p className="text-slate-400 text-[9px] uppercase tracking-wide leading-tight mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
