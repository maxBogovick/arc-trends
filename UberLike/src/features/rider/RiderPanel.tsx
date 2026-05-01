import { useState, useRef, useEffect } from 'react'
import {
  MapPin, Clock, User, ArrowRight, Zap, X, CheckCircle2, XCircle,
  Star, Phone, MessageSquare, ChevronDown, ChevronUp, TrendingUp,
  CreditCard, RotateCcw, Navigation, Send,
} from 'lucide-react'
import { useRideStore } from '@/store/rideStore'
import { useRideTypes, useEstimates, useRequestRide, useCancelRide, useRideEvents, useRiderRealtime } from './useRide'
import { distanceKm } from '@/shared/utils/geo'
import { Button } from '@/shared/ui/Button'
import { RideStatusBadge } from '@/shared/ui/Badge'
import { Modal } from '@/shared/ui/Modal'
import { MOCK_LOCATIONS, MOCK_RIDES, MOCK_RIDE_TYPES } from '@/api/mock/fixtures'
import { isInBounds } from '@/shared/utils/geo'
import { formatCurrency, formatDistanceToNow } from '@/shared/utils/time'
import type { Location, RideType, RideStatus, FareEstimate, GeoPoint, Ride } from '@/shared/types'

const QUICK_PICKS = MOCK_LOCATIONS.filter(l => isInBounds(l.point))

const CANCEL_REASONS = [
  'Driver is taking too long',
  'Changed my plans',
  'Ordered by mistake',
  'Price is too high',
  'Other',
]

const TIMELINE: { status: RideStatus; label: string }[] = [
  { status: 'driver_assigned', label: 'Driver assigned'  },
  { status: 'driver_arriving', label: 'Driver on the way' },
  { status: 'pickup',          label: 'Driver arrived'   },
  { status: 'in_progress',     label: 'Ride in progress' },
  { status: 'completed',       label: 'Completed'        },
]
const STATUS_ORDER: RideStatus[] = [
  'requested','matching','driver_assigned','driver_arriving','pickup','in_progress','completed',
]
function statusIndex(s: RideStatus) { return STATUS_ORDER.indexOf(s) }

// Personal ride history — deduplicated
const MY_HISTORY: Ride[] = Array.from(
  new Map(MOCK_RIDES.map(r => [r.id, r])).values()
).slice(0, 6)

type RiderTab = 'book' | 'rides' | 'account'

// ─────────────────────────────────────────────────────────────────────────────
// Location picker
// ─────────────────────────────────────────────────────────────────────────────
function LocationPicker({ label, value, onSelect, onClear, accent, onMapMode }: {
  label: string
  value: Location | null
  onSelect: (loc: Location) => void
  onClear: () => void
  accent: 'green' | 'red'
  onMapMode: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const ring = accent === 'green'
    ? 'focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100'
    : 'focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100'
  const dot = accent === 'green' ? 'bg-green-500' : 'bg-red-500'

  const filtered = query
    ? QUICK_PICKS.filter(l =>
        l.label.toLowerCase().includes(query.toLowerCase()) ||
        l.address.toLowerCase().includes(query.toLowerCase()))
    : QUICK_PICKS

  const handleSelect = (loc: Location) => { onSelect(loc); setOpen(false); setQuery('') }

  return (
    <div className="relative">
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
        className={`flex items-center gap-2.5 bg-white border rounded-xl px-3.5 h-11 cursor-text transition-all border-slate-200 ${ring}`}
      >
        <div className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
        {value && !open ? (
          <span className="flex-1 text-slate-900 text-sm font-medium truncate">{value.label}</span>
        ) : (
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-slate-900 text-sm placeholder:text-slate-400 outline-none"
            placeholder={label}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        )}
        {value && (
          <button
            onMouseDown={e => { e.preventDefault(); onClear(); setQuery('') }}
            className="text-slate-300 hover:text-slate-500 transition-colors ml-auto shrink-0"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-panel z-30 slide-up">
          <button
            onMouseDown={e => { e.preventDefault(); setOpen(false); onMapMode() }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-500 hover:bg-slate-50 border-b border-slate-100 transition-colors"
          >
            <MapPin size={14} className={accent === 'green' ? 'text-green-500' : 'text-red-500'} />
            <span>Click on the map to select</span>
            <span className="ml-auto text-[10px] text-slate-300 border border-slate-200 rounded px-1.5 py-0.5">pin</span>
          </button>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map((loc, i) => (
              <button
                key={loc.id}
                onMouseDown={() => handleSelect(loc)}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors ${i > 0 ? 'border-t border-slate-50' : ''}`}
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={12} className="text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-slate-800 text-sm font-medium truncate">{loc.label}</p>
                  <p className="text-slate-400 text-xs truncate">{loc.address}</p>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-4 text-slate-400 text-sm text-center">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ride type card
// ─────────────────────────────────────────────────────────────────────────────
function RideCard({ rt, est, surge, selected, onClick }: {
  rt: RideType; est: FareEstimate | undefined; surge: number; selected: boolean; onClick: () => void
}) {
  const emoji = rt.id === 'xl' ? '🚐' : rt.id === 'comfort' ? '🚙' : rt.id === 'delivery' ? '📦' : '🚗'
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 transition-all text-left ${
        selected ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${selected ? 'bg-brand-100' : 'bg-slate-100'}`}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`font-semibold text-sm ${selected ? 'text-brand-800' : 'text-slate-800'}`}>{rt.name}</span>
          {surge > 1.1 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
              <Zap size={7}/>{surge.toFixed(1)}×
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
          <Clock size={9}/>
          <span>{est?.durationMinutes ?? rt.etaMinutes} min</span>
          {est && <><span className="text-slate-200 mx-0.5">·</span><span>{est.distanceKm} km</span></>}
        </div>
      </div>
      <div className="text-right shrink-0">
        {est ? (
          <p className={`text-sm font-bold ${selected ? 'text-brand-700' : 'text-slate-800'}`}>
            {formatCurrency(est.minFare)}–{formatCurrency(est.maxFare)}
          </p>
        ) : (
          <div className="w-16 h-4 bg-slate-100 rounded animate-pulse" />
        )}
        <p className="text-[10px] text-slate-400">{rt.description}</p>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching state
// ─────────────────────────────────────────────────────────────────────────────
function MatchingState({ onCancel }: { onCancel: () => void }) {
  const { matchingProgress, assignedDriver, nearbyDrivers } = useRideStore()
  const { mutate: cancelRide, isPending } = useCancelRide()
  const [elapsed, setElapsed] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => { const t = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(t) })

  if (assignedDriver) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 slide-up">
        <div className="relative">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-white shadow-elevated ring-4 ring-brand-100"
            style={{ background: assignedDriver.avatarColor }}>
            {assignedDriver.name.charAt(0)}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
            <CheckCircle2 size={11} className="text-white" />
          </div>
        </div>
        <div className="text-center">
          <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
            Driver matched!
          </span>
          <p className="text-slate-900 font-bold text-base mt-2">{assignedDriver.name}</p>
          <div className="flex items-center justify-center gap-0.5 mt-0.5">
            {[1,2,3,4,5].map(i => (
              <Star key={i} size={11} className={i <= Math.round(assignedDriver.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} />
            ))}
            <span className="text-slate-400 text-xs ml-1">{assignedDriver.rating.toFixed(1)}</span>
          </div>
        </div>
        <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          <p className="text-slate-800 font-semibold text-sm">{assignedDriver.vehicle.make} {assignedDriver.vehicle.model}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-slate-400 text-xs">{assignedDriver.vehicle.color}</span>
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">{assignedDriver.vehicle.plate}</span>
          </div>
        </div>
        <Button variant="secondary" full size="sm" loading={isPending}
          onClick={() => { cancelRide('Rider cancelled after match'); onCancel() }}
          className="border-red-200 text-red-500 hover:bg-red-50 text-xs">
          Cancel ride
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-green-100 ripple-ring"/>
        <div className="absolute inset-0 rounded-full bg-green-100 ripple-ring ripple-ring-2"/>
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center shadow-elevated z-10 relative text-xl">🚗</div>
      </div>
      <div className="text-center">
        <p className="text-slate-900 font-bold">Finding your driver…</p>
        <p className="text-slate-400 text-xs mt-1">
          {elapsed}s · {nearbyDrivers.filter(d => d.availability === 'available').length} drivers nearby
        </p>
      </div>
      <div className="w-full">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-300"
            style={{ width: `${matchingProgress}%` }} />
        </div>
      </div>
      <Button variant="secondary" full size="sm" loading={isPending}
        onClick={() => { cancelRide('Rider cancelled'); onCancel() }}
        className="border-red-200 text-red-500 hover:bg-red-50 text-xs">
        <X size={12}/> Cancel search
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Active ride
// ─────────────────────────────────────────────────────────────────────────────
// Live ETA display while driver is arriving
function LiveETA({ driverId, target }: { driverId: string; target: { lat: number; lng: number } }) {
  const driverLat = useRideStore(s => s.nearbyDrivers.find(d => d.id === driverId)?.location.lat)
  const driverLng = useRideStore(s => s.nearbyDrivers.find(d => d.id === driverId)?.location.lng)
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    setSecs(prev => {
      if (driverLat == null || driverLng == null) return prev
      const dist = distanceKm({ lat: driverLat, lng: driverLng }, target)
      // simulation speed: 0.0007 deg/1.5s ≈ 0.052 km/s
      return Math.max(1, Math.round(dist / 0.052))
    })
  }, [driverLat, driverLng, target])

  if (driverLat == null || driverLng == null) return null
  const dist = distanceKm({ lat: driverLat, lng: driverLng }, target)

  return (
    <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-brand-700">
        <Navigation size={14} className="animate-pulse" />
        <span className="text-sm font-semibold">Driver is on the way</span>
      </div>
      <div className="text-right">
        <p className="text-brand-800 font-black text-base leading-none">{secs}s</p>
        <p className="text-brand-500 text-[10px]">{dist.toFixed(2)} km away</p>
      </div>
    </div>
  )
}

type ChatMsg = { from: 'rider' | 'driver'; text: string; ts: string }

const DRIVER_QUICK_REPLIES = [
  'Sure, no problem!', 'On my way!', 'Almost there!',
  'Got it 👍', 'I understand.', 'OK!',
]

function ActiveRideView({ onReset }: { onReset: () => void }) {
  const store = useRideStore()
  const { currentRide, assignedDriver, nearbyDrivers, ridePhase } = store
  const { mutate: cancelRide, isPending: cancelling } = useCancelRide()
  const { data: events } = useRideEvents(currentRide?.id)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showEvents, setShowEvents] = useState(false)
  const [rating, setRating] = useState(0)
  const [tip, setTip] = useState<0 | 0.1 | 0.15 | 0.2>(0)

  // Chat state
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Fare meter (in_progress)
  const [fareElapsed, setFareElapsed] = useState(0)
  useEffect(() => {
    if (currentRide?.status !== 'in_progress') return
    const start = Date.now()
    const id = setInterval(() => setFareElapsed(Date.now() - start), 500)
    return () => clearInterval(id)
  }, [currentRide?.status])

  // Auto driver messages on status change
  useEffect(() => {
    if (!currentRide?.status || !assignedDriver) return
    const AUTO: Partial<Record<string, string>> = {
      driver_arriving: `On my way! I'll be there shortly.`,
      pickup: `I've arrived! Look for the ${assignedDriver.vehicle.color} ${assignedDriver.vehicle.make} — plate ${assignedDriver.vehicle.plate}.`,
      in_progress: `Let's go! Estimated ${currentRide.estimate.durationMinutes} min to destination.`,
    }
    const msg = AUTO[currentRide.status]
    if (msg) {
      const tid = setTimeout(() => {
        setChatMessages(prev => [...prev, { from: 'driver', text: msg, ts: new Date().toISOString() }])
        if (currentRide.status === 'driver_arriving') setChatOpen(true)
      }, 1200)
      return () => clearTimeout(tid)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRide?.status])

  // Scroll chat to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  function sendMessage() {
    const text = chatInput.trim()
    if (!text) return
    setChatMessages(prev => [...prev, { from: 'rider', text, ts: new Date().toISOString() }])
    setChatInput('')
    setTimeout(() => {
      const reply = DRIVER_QUICK_REPLIES[Math.floor(Math.random() * DRIVER_QUICK_REPLIES.length)]
      setChatMessages(prev => [...prev, { from: 'driver', text: reply, ts: new Date().toISOString() }])
    }, 700 + Math.random() * 900)
  }

  if (!currentRide) return null

  const isCompleted = ridePhase === 'completed'
  const isCancelled = ridePhase === 'cancelled'
  const currentIdx = statusIndex(currentRide.status)
  const driver = assignedDriver ?? nearbyDrivers.find(d => d.id === currentRide.driverId)
  const canCancel = ['requested','matching','driver_assigned'].includes(currentRide.status)
  const rideType  = MOCK_RIDE_TYPES.find(rt => rt.id === currentRide.rideTypeId)
  const runningFare = rideType
    ? currentRide.estimate.minFare + (fareElapsed / 60000) * rideType.pricePerMinute
    : currentRide.estimate.minFare

  if (isCompleted) {
    const dist = currentRide.estimate.distanceKm
    const dur  = currentRide.estimate.durationMinutes
    const surge = currentRide.estimate.surgeMultiplier
    const base = rideType?.baseFare ?? 0
    const distPortion = dist * (rideType?.pricePerKm ?? 0)
    const timePortion = dur  * (rideType?.pricePerMinute ?? 0)
    const subtotal = base + distPortion + timePortion
    const surgeExtra = Math.max(0, subtotal * (surge - 1))
    const speedKph = dur > 0 ? (dist / (dur / 60)).toFixed(0) : '—'
    const total = currentRide.finalFare ?? subtotal + surgeExtra

    return (
      <div className="flex flex-col gap-3 py-2 slide-up">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-green-600"/>
          </div>
          <div className="text-center">
            <p className="text-slate-900 font-bold text-lg">Ride complete!</p>
            <p className="text-slate-400 text-xs mt-0.5">{currentRide.pickup.label} → {currentRide.destination.label}</p>
          </div>
        </div>

        {/* Fare receipt */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 space-y-2">
            {[
              { label: 'Base fare',   value: formatCurrency(base) },
              { label: `Distance (${dist} km)`, value: formatCurrency(distPortion) },
              { label: `Time (${dur} min)`,     value: formatCurrency(timePortion) },
              ...(surgeExtra > 0 ? [{ label: `Surge (${surge.toFixed(1)}×)`, value: `+${formatCurrency(surgeExtra)}`, hot: true }] : []),
            ].map(({ label, value, hot }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className={hot ? 'text-orange-600 font-medium' : 'text-slate-500'}>{label}</span>
                <span className={hot ? 'text-orange-600 font-semibold' : 'text-slate-700 font-medium'}>{value}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white">
            <span className="text-slate-700 font-semibold text-sm">Total</span>
            <span className="text-brand-700 font-black text-xl">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Trip stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Distance', value: `${dist} km`  },
            { label: 'Duration', value: `${dur} min`  },
            { label: 'Avg speed', value: `${speedKph} km/h` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
              <p className="text-slate-900 font-bold text-sm">{value}</p>
              <p className="text-slate-400 text-[10px] uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div>
          <p className="text-slate-500 text-xs text-center mb-2">Add a tip?</p>
          <div className="flex gap-2">
            {([0, 0.1, 0.15, 0.2] as const).map(pct => {
              const amt = total * pct
              return (
                <button
                  key={pct}
                  onClick={() => setTip(pct)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    tip === pct
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                  }`}
                >
                  {pct === 0 ? 'No tip' : `${(pct * 100).toFixed(0)}%`}
                  {pct > 0 && <br />}
                  {pct > 0 && <span className="text-[9px] opacity-75">{formatCurrency(amt)}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Rating */}
        <div>
          <p className="text-center text-slate-500 text-xs mb-2">Rate your driver</p>
          <div className="flex justify-center gap-2">
            {[1,2,3,4,5].map(i => (
              <button key={i} onClick={() => setRating(i)} className="transition-transform hover:scale-110 active:scale-95">
                <Star size={26} className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}/>
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-brand-600 text-xs mt-1.5 font-medium">
              {rating === 5 ? 'Excellent! ⭐' : rating >= 4 ? 'Great ride!' : rating >= 3 ? 'Good, thanks' : 'Thanks for your feedback'}
            </p>
          )}
        </div>

        <Button full size="lg" onClick={onReset} className="rounded-xl">
          Book new ride
        </Button>
      </div>
    )
  }

  if (isCancelled) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 slide-up">
        <div className="w-14 h-14 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
          <XCircle size={28} className="text-red-500"/>
        </div>
        <p className="text-slate-900 font-semibold">Ride cancelled</p>
        {currentRide.cancellationReason && (
          <p className="text-slate-400 text-sm text-center">{currentRide.cancellationReason}</p>
        )}
        <Button full size="md" onClick={onReset} className="rounded-xl mt-1">
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <RideStatusBadge status={currentRide.status}/>
        <span className="text-slate-400 text-xs">{formatDistanceToNow(currentRide.updatedAt)}</span>
      </div>

      {/* Route card */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500"/>
            <div className="w-px h-5 bg-slate-200"/>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"/>
          </div>
          <div className="min-w-0 space-y-2">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Pickup</p>
              <p className="text-slate-800 font-semibold text-sm truncate">{currentRide.pickup.label}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Destination</p>
              <p className="text-slate-800 font-semibold text-sm truncate">{currentRide.destination.label}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live ETA when driver is arriving */}
      {currentRide.status === 'driver_arriving' && assignedDriver && (
        <LiveETA driverId={assignedDriver.id} target={currentRide.pickup.point} />
      )}

      {/* Running fare meter during trip */}
      {currentRide.status === 'in_progress' && (
        <div className="flex items-center justify-between bg-gradient-to-r from-brand-50 to-emerald-50 border border-brand-100 rounded-xl px-4 py-3">
          <div>
            <p className="text-brand-700 text-xs font-semibold uppercase tracking-wide">Running fare</p>
            <p className="text-brand-500 text-[10px] mt-0.5 tabular-nums">{(fareElapsed / 60000).toFixed(1)} min elapsed</p>
          </div>
          <p className="text-brand-800 font-black text-2xl tabular-nums">{formatCurrency(runningFare)}</p>
        </div>
      )}

      {/* Driver card */}
      {driver && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
          <div className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
              style={{ background: driver.avatarColor }}>
              {driver.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 font-semibold text-sm">{driver.name}</p>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} size={9} className={i <= Math.round(driver.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}/>
                  ))}
                </div>
                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{driver.vehicle.plate}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setChatOpen(v => !v)}
                title="Message"
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative ${
                  chatOpen ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <MessageSquare size={12} />
                {chatMessages.length > 0 && !chatOpen && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {chatMessages.filter(m => m.from === 'driver').length}
                  </span>
                )}
              </button>
              <button title="Call" className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                <Phone size={12} />
              </button>
            </div>
          </div>

          {/* Chat panel */}
          {chatOpen && (
            <div className="border-t border-slate-100 flex flex-col" style={{ height: 260 }}>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-center text-slate-300 text-xs py-6">No messages yet</p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.from === 'rider' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                      msg.from === 'rider'
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2 p-2 border-t border-slate-100 shrink-0">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
                  placeholder="Message driver…"
                  className="flex-1 text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim()}
                  className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center hover:bg-brand-700 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Send size={13} className="text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status timeline */}
      <div className="space-y-0.5">
        {TIMELINE.map(({ status, label }, idx) => {
          const sIdx = statusIndex(status)
          const done = sIdx < currentIdx
          const active = status === currentRide.status
          return (
            <div key={status} className="flex gap-3 items-center py-0.5">
              <div className="flex flex-col items-center shrink-0 w-5">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                  active ? 'bg-brand-600' : done ? 'bg-brand-100' : 'bg-slate-100'
                }`}>
                  {done
                    ? <CheckCircle2 size={10} className="text-brand-700"/>
                    : <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white animate-pulse' : 'bg-slate-300'}`}/>
                  }
                </div>
                {idx < TIMELINE.length - 1 && (
                  <div className={`w-px mt-0.5 ${done ? 'bg-brand-200' : 'bg-slate-100'}`} style={{ height: 10 }}/>
                )}
              </div>
              <span className={`text-xs ${active ? 'text-slate-900 font-semibold' : done ? 'text-slate-500' : 'text-slate-300'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Cancel */}
      {canCancel && (
        <Button variant="secondary" full size="sm" loading={cancelling}
          onClick={() => setShowCancel(true)}
          className="border-red-200 text-red-500 hover:bg-red-50 text-xs">
          Cancel ride
        </Button>
      )}

      {/* Event log */}
      {events && events.length > 0 && (
        <>
          <button onClick={() => setShowEvents(v => !v)}
            className="flex items-center gap-1 text-slate-300 text-xs hover:text-slate-500 transition-colors">
            {showEvents ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
            Event log ({events.length})
          </button>
          {showEvents && (
            <div className="bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-100 max-h-28 overflow-y-auto">
              {events.map(e => (
                <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <span className="text-brand-600 font-mono">→</span>
                  <span className="text-slate-500 flex-1 truncate">{e.type}</span>
                  <span className="text-slate-300">{formatDistanceToNow(e.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="Cancel ride">
        <div className="space-y-3">
          <p className="text-slate-500 text-sm">Why are you cancelling?</p>
          <div className="space-y-1.5">
            {CANCEL_REASONS.map(r => (
              <button key={r} onClick={() => setCancelReason(r)}
                className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                  cancelReason === r
                    ? 'border-brand-400 bg-brand-50 text-brand-800 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowCancel(false)} full size="sm">Back</Button>
            <Button variant="danger" full size="sm" disabled={!cancelReason} loading={cancelling}
              onClick={() => { cancelRide(cancelReason); setShowCancel(false) }}>
              Confirm cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Book tab
// ─────────────────────────────────────────────────────────────────────────────
function BookTab({
  onRequestMapMode,
  onReset,
}: {
  onRequestMapMode: (mode: 'pickup' | 'destination') => void
  onReset: () => void
}) {
  const store = useRideStore()
  const { data: rideTypes, isLoading: loadingTypes } = useRideTypes()
  const { isFetching: estimating } = useEstimates()
  const { mutate: requestRide, isPending: requesting } = useRequestRide()

  const phase = store.ridePhase
  const canRequest = !!store.pickupLocation && !!store.destinationLocation && !!store.selectedRideTypeId
  const selectedEst = store.fareEstimates.find(e => e.rideTypeId === store.selectedRideTypeId)

  if (phase === 'matching' || (phase === 'active' && !['completed','cancelled'].includes(phase))) {
    // show matching or active
  }

  if (phase === 'matching') {
    return <MatchingState onCancel={onReset}/>
  }
  if (['active','completed','cancelled'].includes(phase)) {
    return <ActiveRideView onReset={onReset}/>
  }

  return (
    <div className="space-y-4">
      {/* Route inputs */}
      <div className="space-y-2">
        <div className="relative">
          <LocationPicker
            label="Pickup location"
            value={store.pickupLocation}
            onSelect={loc => store.setPickup(loc)}
            onClear={() => store.setPickup(null)}
            accent="green"
            onMapMode={() => onRequestMapMode('pickup')}
          />
        </div>
        {/* Connector */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex flex-col items-center gap-0.5 ml-[13px]">
            <div className="w-px h-3 bg-slate-200"/>
          </div>
        </div>
        <LocationPicker
          label="Where to?"
          value={store.destinationLocation}
          onSelect={loc => store.setDestination(loc)}
          onClear={() => store.setDestination(null)}
          accent="red"
          onMapMode={() => onRequestMapMode('destination')}
        />
      </div>

      {/* Ride types */}
      {store.pickupLocation && store.destinationLocation && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Choose ride type</p>
            {estimating && (
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <div className="w-3 h-3 rounded-full border-2 border-slate-200 border-t-brand-500 animate-spin"/>
                Updating…
              </div>
            )}
          </div>
          {loadingTypes && (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse"/>)}
            </div>
          )}
          {(rideTypes ?? []).map(rt => {
            const est = store.fareEstimates.find(e => e.rideTypeId === rt.id)
            const surge = store.surgeMultipliers[rt.id] ?? est?.surgeMultiplier ?? 1
            return (
              <RideCard
                key={rt.id} rt={rt} est={est} surge={surge}
                selected={store.selectedRideTypeId === rt.id}
                onClick={() => store.setSelectedRideType(rt.id)}
              />
            )
          })}
        </div>
      )}

      {/* Fare summary */}
      {selectedEst && (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Trip summary</p>
          {[
            ['Distance', `${selectedEst.distanceKm} km`],
            ['Est. time', `${selectedEst.durationMinutes} min`],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-slate-500">{k}</span>
              <span className="text-slate-700 font-medium">{v}</span>
            </div>
          ))}
          {selectedEst.surgeMultiplier > 1 && (
            <div className="flex justify-between text-sm text-orange-600 font-medium">
              <span className="flex items-center gap-1"><Zap size={11}/>Surge pricing</span>
              <span>{selectedEst.surgeMultiplier}×</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
            <span>Estimated total</span>
            <span className="text-base">{formatCurrency(selectedEst.minFare)}–{formatCurrency(selectedEst.maxFare)}</span>
          </div>
        </div>
      )}

      <Button full size="lg" loading={requesting} disabled={!canRequest}
        onClick={() => requestRide()}
        className="rounded-xl font-semibold">
        {requesting
          ? 'Requesting…'
          : canRequest
            ? <><span>Request ride</span><ArrowRight size={16}/></>
            : 'Select pickup & destination'
        }
      </Button>

      {!store.pickupLocation && (
        <p className="text-center text-slate-400 text-xs">
          Choose locations above or click a pin on the map
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// My Rides tab
// ─────────────────────────────────────────────────────────────────────────────
function statusColor(status: RideStatus) {
  if (status === 'completed') return 'text-green-700 bg-green-50 border-green-200'
  if (status === 'cancelled') return 'text-red-600 bg-red-50 border-red-200'
  return 'text-blue-700 bg-blue-50 border-blue-200'
}

function statusLabel(status: RideStatus) {
  const map: Partial<Record<RideStatus, string>> = {
    completed: 'Completed',
    cancelled: 'Cancelled',
    in_progress: 'In progress',
    matching: 'Matching',
    driver_assigned: 'Driver assigned',
    driver_arriving: 'Arriving',
    pickup: 'Pickup',
    requested: 'Requested',
  }
  return map[status] ?? status
}

function RideHistoryCard({
  ride,
  onPreview,
  onRebook,
}: {
  ride: Ride
  onPreview: (route: { pickup: GeoPoint; destination: GeoPoint; route: GeoPoint[] }) => void
  onRebook: (ride: Ride) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(ride.createdAt)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
      <button
        className="w-full text-left p-4"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Route */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className="w-2 h-2 rounded-full bg-green-500"/>
                <div className="w-px h-3 bg-slate-200"/>
                <div className="w-2 h-2 rounded-full bg-red-500"/>
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-slate-800 font-medium text-sm truncate">{ride.pickup.label}</p>
                <p className="text-slate-500 text-xs truncate">{ride.destination.label}</p>
              </div>
            </div>
            {/* Meta */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor(ride.status)}`}>
                {statusLabel(ride.status)}
              </span>
              <span className="text-slate-400 text-xs">{dateStr} · {timeStr}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            {ride.finalFare ? (
              <p className="text-slate-900 font-bold">{formatCurrency(ride.finalFare)}</p>
            ) : (
              <p className="text-slate-400 text-sm">—</p>
            )}
            <p className="text-slate-400 text-xs">{ride.estimate.distanceKm} km</p>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 text-slate-400 text-xs">
          {expanded ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
          {expanded ? 'Hide details' : 'View details'}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3 slide-up">
          {/* Trip stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Duration', value: `${ride.estimate.durationMinutes} min` },
              { label: 'Distance', value: `${ride.estimate.distanceKm} km` },
              { label: 'Fare', value: ride.finalFare ? formatCurrency(ride.finalFare) : `${formatCurrency(ride.estimate.minFare)}+` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-slate-900 font-bold text-sm">{value}</p>
                <p className="text-slate-400 text-[10px]">{label}</p>
              </div>
            ))}
          </div>
          {/* Addresses */}
          <div className="text-xs text-slate-500 space-y-1">
            <p><span className="font-medium text-slate-700">From:</span> {ride.pickup.address}</p>
            <p><span className="font-medium text-slate-700">To:</span> {ride.destination.address}</p>
          </div>
          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {ride.route.length > 1 && (
              <Button variant="secondary" size="sm" full
                onClick={() => onPreview({ pickup: ride.pickup.point, destination: ride.destination.point, route: ride.route })}>
                <Navigation size={12}/> Show on map
              </Button>
            )}
            <Button variant="secondary" size="sm" full
              onClick={() => onRebook(ride)}>
              <RotateCcw size={12}/> Rebook
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function RidesTab({
  onPreview,
  onRebook,
}: {
  onPreview: (route: { pickup: GeoPoint; destination: GeoPoint; route: GeoPoint[] }) => void
  onRebook: (ride: Ride) => void
}) {
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all')

  const filtered = MY_HISTORY.filter(r => {
    if (filter === 'all') return true
    return r.status === filter
  })

  const totalSpent = MY_HISTORY.filter(r => r.finalFare).reduce((s, r) => s + (r.finalFare ?? 0), 0)
  const completed = MY_HISTORY.filter(r => r.status === 'completed').length

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-3">
          <p className="text-brand-900 font-black text-xl">{completed}</p>
          <p className="text-brand-600 text-xs font-medium mt-0.5">Completed rides</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <p className="text-slate-900 font-black text-xl">{formatCurrency(totalSpent)}</p>
          <p className="text-slate-500 text-xs font-medium mt-0.5">Total spent</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(['all','completed','cancelled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 h-7 rounded-lg text-xs font-medium capitalize transition-all ${
              filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Ride cards */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">No rides found</p>
        )}
        {filtered.map(ride => (
          <RideHistoryCard
            key={ride.id}
            ride={ride}
            onPreview={onPreview}
            onRebook={onRebook}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Account tab
// ─────────────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${on ? 'bg-brand-500' : 'bg-slate-200'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

function AccountTab() {
  const totalRides     = MY_HISTORY.length
  const completedRides = MY_HISTORY.filter(r => r.status === 'completed').length
  const totalSpent     = MY_HISTORY.filter(r => r.finalFare).reduce((s, r) => s + (r.finalFare ?? 0), 0)
  const avgFare        = completedRides > 0 ? totalSpent / completedRides : 0

  const [quietMode,     setQuietMode]     = useState(true)
  const [receiptEmails, setReceiptEmails] = useState(true)
  const [shareLocation, setShareLocation] = useState(false)

  return (
    <div className="space-y-5">
      {/* Profile card */}
      <div className="flex items-center gap-4 bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 text-white">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-black shrink-0">
          A
        </div>
        <div>
          <p className="font-bold text-lg">Alex Johnson</p>
          <div className="flex items-center gap-1 mt-0.5">
            {[1,2,3,4,5].map(i => (
              <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
            ))}
            <span className="text-white/80 text-xs ml-1">4.92 · Rider</span>
          </div>
          <p className="text-white/60 text-xs mt-1">Member since Jan 2024</p>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Your stats</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: <Navigation size={14}/>,   label: 'Total rides',  value: totalRides,                  color: 'text-blue-600'  },
            { icon: <CheckCircle2 size={14}/>,  label: 'Completed',    value: completedRides,              color: 'text-green-600' },
            { icon: <TrendingUp size={14}/>,   label: 'Total spent',  value: formatCurrency(totalSpent),  color: 'text-brand-600' },
            { icon: <Star size={14}/>,         label: 'Avg fare',     value: formatCurrency(avgFare),     color: 'text-amber-600' },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
              <div className={`${color} mb-1`}>{icon}</div>
              <p className="text-slate-900 font-bold text-base">{value}</p>
              <p className="text-slate-400 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Payment */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payment</p>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 shadow-card">
          <div className="w-10 h-7 rounded-md bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center shrink-0">
            <CreditCard size={14} className="text-white" />
          </div>
          <div>
            <p className="text-slate-800 font-semibold text-sm">Visa •••• 4242</p>
            <p className="text-slate-400 text-xs">Default · Expires 09/26</p>
          </div>
          <button className="ml-auto text-brand-600 text-xs font-medium hover:text-brand-700 transition-colors">Change</button>
        </div>
      </div>

      {/* Preferences */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Preferences</p>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-card">
          {[
            { label: 'Quiet mode',     desc: 'No conversation with driver', on: quietMode,     set: setQuietMode     },
            { label: 'Receipt emails', desc: 'Send after every ride',       on: receiptEmails, set: setReceiptEmails },
            { label: 'Share location', desc: 'Live location with driver',   on: shareLocation, set: setShareLocation },
          ].map(({ label, desc, on, set }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="text-slate-800 text-sm font-medium">{label}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
              <Toggle on={on} onChange={set} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export function RiderPanel({
  onRequestMapMode,
  onPreviewRoute,
}: {
  onRequestMapMode: (mode: 'pickup' | 'destination') => void
  onPreviewRoute: (preview: { pickup: GeoPoint; destination: GeoPoint; route: GeoPoint[] } | null) => void
}) {
  useRiderRealtime()

  const store = useRideStore()
  const [tab, setTab] = useState<RiderTab>('book')

  const phase = store.ridePhase
  const inActiveFlow = ['matching','active','completed','cancelled'].includes(phase)

  function resetBooking() {
    store.setRidePhase('booking')
    store.setCurrentRide(null)
    store.setAssignedDriver(null)
    store.setPickup(null)
    store.setDestination(null)
    store.setSelectedRideType(null)
    store.setFareEstimates([])
    store.regenerateIdempotencyKey()
  }

  function handleRebook(ride: Ride) {
    store.setPickup(ride.pickup)
    store.setDestination(ride.destination)
    onPreviewRoute(null)
    setTab('book')
  }

  const TABS = [
    { id: 'book' as RiderTab,    label: 'Book',     icon: <MapPin size={13}/> },
    { id: 'rides' as RiderTab,   label: 'My Rides', icon: <Clock size={13}/> },
    { id: 'account' as RiderTab, label: 'Account',  icon: <User size={13}/> },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-slate-100 shrink-0 bg-white">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-all border-b-2 ${
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.icon}
            {t.label}
            {t.id === 'book' && inActiveFlow && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 ml-0.5"/>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'book' && (
          <BookTab onRequestMapMode={onRequestMapMode} onReset={resetBooking}/>
        )}
        {tab === 'rides' && (
          <RidesTab onPreview={onPreviewRoute} onRebook={handleRebook}/>
        )}
        {tab === 'account' && (
          <AccountTab/>
        )}
      </div>
    </div>
  )
}
