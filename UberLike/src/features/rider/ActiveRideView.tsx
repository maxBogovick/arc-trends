import { useState } from 'react'
import { CheckCircle2, XCircle, Phone, MessageSquare, Share2, ChevronDown, ChevronUp, Star } from 'lucide-react'
import { CityMap } from '@/features/maps/CityMap'
import { useRideStore } from '@/store/rideStore'
import { useCancelRide, useRideEvents } from './useRide'
import { Button } from '@/shared/ui/Button'
import { RideStatusBadge } from '@/shared/ui/Badge'
import { Modal } from '@/shared/ui/Modal'
import { formatCurrency, formatDistanceToNow } from '@/shared/utils/time'
import type { RideStatus } from '@/shared/types'

const TIMELINE: { status: RideStatus; label: string; desc: string }[] = [
  { status: 'requested',       label: 'Ride requested',   desc: 'Looking for a driver' },
  { status: 'matching',        label: 'Finding driver',   desc: 'Matching algorithm running' },
  { status: 'driver_assigned', label: 'Driver assigned',  desc: 'Driver accepted your ride' },
  { status: 'driver_arriving', label: 'Driver on the way',desc: 'Heading to your location' },
  { status: 'pickup',          label: 'Driver arrived',   desc: 'Ready for pickup' },
  { status: 'in_progress',     label: 'Ride in progress', desc: 'Enjoy your ride!' },
  { status: 'completed',       label: 'Completed',        desc: 'Safe travels!' },
]

const STATUS_ORDER: RideStatus[] = [
  'requested','matching','driver_assigned','driver_arriving','pickup','in_progress','completed',
]

const CANCEL_REASONS = [
  'Driver is taking too long',
  'Changed my plans',
  'Ordered by mistake',
  'Found another way',
  'Other',
]

function statusIndex(s: RideStatus) { return STATUS_ORDER.indexOf(s) }

export function ActiveRideView() {
  const { currentRide, assignedDriver, nearbyDrivers, ridePhase } = useRideStore()
  const { mutate: cancelRide, isPending: cancelling } = useCancelRide()
  const { data: events } = useRideEvents(currentRide?.id)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showEvents, setShowEvents] = useState(false)

  if (!currentRide) return null

  const isCompleted = ridePhase === 'completed'
  const isCancelled = ridePhase === 'cancelled'
  const currentIdx = statusIndex(currentRide.status)
  const driver = assignedDriver ?? nearbyDrivers.find((d) => d.id === currentRide.driverId)
  const canCancel = ['requested','matching','driver_assigned'].includes(currentRide.status)

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Map */}
      <div className="flex-1 min-h-0">
        <CityMap
          drivers={driver ? [driver] : []}
          pickup={currentRide.pickup.point}
          destination={currentRide.destination.point}
          route={currentRide.route}
          riderLocation={useRideStore.getState().riderLocation}
        />
      </div>

      {/* Side panel */}
      <div className="w-full md:w-[380px] bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col overflow-y-auto max-h-[60vh] md:max-h-none shadow-panel">

        {/* === COMPLETED === */}
        {isCompleted && (
          <div className="flex-1 flex flex-col items-center p-8 gap-6 slide-up">
            <div className="w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
              <CheckCircle2 size={36} className="text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-900 font-bold text-2xl">Ride complete!</p>
              {currentRide.finalFare && (
                <p className="text-brand-600 text-3xl font-black mt-2">{formatCurrency(currentRide.finalFare)}</p>
              )}
            </div>

            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5 text-sm">
              {[
                { label: 'Estimate', value: `${formatCurrency(currentRide.estimate.minFare)}–${formatCurrency(currentRide.estimate.maxFare)}` },
                { label: 'Distance', value: `${currentRide.estimate.distanceKm} km` },
                { label: 'Duration', value: `${currentRide.estimate.durationMinutes} min` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-slate-700 font-medium">{value}</span>
                </div>
              ))}
              {currentRide.estimate.surgeMultiplier > 1 && (
                <div className="flex justify-between text-orange-600 font-medium">
                  <span>Surge</span><span>{currentRide.estimate.surgeMultiplier}×</span>
                </div>
              )}
            </div>

            {/* Rating prompt */}
            <div className="w-full">
              <p className="text-slate-500 text-sm text-center mb-3">How was your ride?</p>
              <div className="flex justify-center gap-2">
                {[1,2,3,4,5].map((i) => (
                  <button key={i} className="w-10 h-10 rounded-xl hover:bg-amber-50 transition-colors flex items-center justify-center">
                    <Star size={22} className="text-amber-300 hover:text-amber-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === CANCELLED === */}
        {isCancelled && (
          <div className="flex-1 flex flex-col items-center p-8 gap-4 slide-up">
            <div className="w-20 h-20 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
              <XCircle size={36} className="text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-slate-900 font-bold text-xl">Ride cancelled</p>
              {currentRide.cancellationReason && (
                <p className="text-slate-500 text-sm mt-2 max-w-xs">{currentRide.cancellationReason}</p>
              )}
            </div>
            <p className="text-slate-400 text-sm">Returning to booking in a moment…</p>
          </div>
        )}

        {/* === ACTIVE === */}
        {!isCompleted && !isCancelled && (
          <div className="flex flex-col p-5 gap-4">
            {/* Status + time */}
            <div className="flex items-center justify-between">
              <RideStatusBadge status={currentRide.status} />
              <span className="text-slate-400 text-xs">{formatDistanceToNow(currentRide.updatedAt)}</span>
            </div>

            {/* Route card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <div className="w-px flex-1 h-5 bg-slate-200 my-1" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider">Pickup</p>
                    <p className="text-slate-800 text-sm font-medium truncate">{currentRide.pickup.label}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider">Destination</p>
                    <p className="text-slate-800 text-sm font-medium truncate">{currentRide.destination.label}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Driver card */}
            {driver && (
              <div className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-slate-200 shadow-card">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-sm"
                  style={{ background: driver.avatarColor }}
                >
                  {driver.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 font-semibold text-sm">{driver.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {driver.vehicle.make} {driver.vehicle.model}
                    <span className="mx-1.5 text-slate-200">·</span>
                    <span className="font-mono font-semibold text-slate-600">{driver.vehicle.plate}</span>
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors" title="Message driver">
                    <MessageSquare size={14} />
                  </button>
                  <button className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors" title="Call driver">
                    <Phone size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-0">
              {TIMELINE.map(({ status, label, desc }, idx) => {
                const sIdx = statusIndex(status)
                const done = sIdx < currentIdx
                const active = status === currentRide.status
                const future = sIdx > currentIdx
                return (
                  <div key={status} className={`flex gap-3 ${idx < TIMELINE.length - 1 ? 'pb-3' : ''}`}>
                    {/* Step indicator */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        active ? 'bg-brand-600 text-white shadow-sm ring-4 ring-brand-100' :
                        done   ? 'bg-brand-100 text-brand-700' :
                                 'bg-slate-100 text-slate-300'
                      }`}>
                        {done ? <CheckCircle2 size={12} className="text-brand-600" /> : sIdx + 1}
                      </div>
                      {idx < TIMELINE.length - 1 && (
                        <div className={`w-px flex-1 mt-1 ${done ? 'bg-brand-200' : 'bg-slate-100'}`} style={{ minHeight: 16 }} />
                      )}
                    </div>
                    {/* Label */}
                    <div className={`pt-0.5 ${future ? 'opacity-35' : ''}`}>
                      <p className={`text-sm font-medium ${active ? 'text-slate-900' : done ? 'text-slate-700' : 'text-slate-400'}`}>
                        {label}
                      </p>
                      {active && <p className="text-slate-400 text-xs mt-0.5">{desc}</p>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Cancel */}
            {canCancel && (
              <Button
                variant="secondary"
                full
                loading={cancelling}
                onClick={() => setShowCancel(true)}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                Cancel ride
              </Button>
            )}

            {/* Event log */}
            <button
              onClick={() => setShowEvents((v) => !v)}
              className="flex items-center gap-1.5 text-slate-400 text-xs hover:text-slate-600 transition-colors w-full pt-1"
            >
              {showEvents ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Event log ({events?.length ?? 0} events)
            </button>

            {showEvents && events && (
              <div className="space-y-px max-h-40 overflow-y-auto bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
                {events.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="text-brand-600 shrink-0 font-mono">→</span>
                    <span className="text-slate-600 flex-1 truncate">{e.type}</span>
                    <span className="text-slate-300 shrink-0 tabular-nums">{formatDistanceToNow(e.createdAt)}</span>
                  </div>
                ))}
                {events.length === 0 && (
                  <div className="px-3 py-4 text-center text-slate-400 text-xs">No events yet</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel modal */}
      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="Cancel ride">
        <div className="space-y-4">
          <p className="text-slate-500 text-sm">Please let us know why you're cancelling.</p>
          <div className="space-y-2">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setCancelReason(r)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  cancelReason === r
                    ? 'border-brand-400 bg-brand-50 text-brand-800 font-medium'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCancel(false)} full>Back</Button>
            <Button
              variant="danger"
              full
              disabled={!cancelReason}
              loading={cancelling}
              onClick={() => { cancelRide(cancelReason); setShowCancel(false) }}
            >
              Confirm cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
