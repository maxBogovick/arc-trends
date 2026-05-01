import { Power, Navigation, CheckCircle2, MapPin, DollarSign, Clock, TrendingUp, Star } from 'lucide-react'
import { CityMap } from '@/features/maps/CityMap'
import { useRideStore } from '@/store/rideStore'
import { useDriverOnlineToggle, useDriverAcceptRide, useDriverRejectRide, useUpdateRideStatus, useDriverRealtime } from './useDriver'
import { Button } from '@/shared/ui/Button'
import { RideStatusBadge, DriverStatusBadge } from '@/shared/ui/Badge'
import { Modal } from '@/shared/ui/Modal'
import { formatCurrency, formatDistanceToNow } from '@/shared/utils/time'
import type { RideStatus } from '@/shared/types'

const STATUS_ACTIONS: { fromStatus: RideStatus; nextStatus: RideStatus; label: string; icon: React.ReactNode }[] = [
  { fromStatus: 'driver_assigned', nextStatus: 'driver_arriving', label: 'Start driving to pickup', icon: <Navigation size={15} /> },
  { fromStatus: 'driver_arriving', nextStatus: 'pickup',          label: 'Arrived at pickup',       icon: <MapPin      size={15} /> },
  { fromStatus: 'pickup',          nextStatus: 'in_progress',     label: 'Start trip',               icon: <Navigation size={15} /> },
  { fromStatus: 'in_progress',     nextStatus: 'completed',       label: 'Complete trip',            icon: <CheckCircle2 size={15} /> },
]

const EARNINGS = [
  { label: 'Today',     amount: 127.40, rides: 8,  trend: +12 },
  { label: 'This week', amount: 634.20, rides: 43, trend: +8  },
]

export function DriverConsole() {
  useDriverRealtime()

  const { driverOnline, incomingRideRequest, currentDriverRide, nearbyDrivers } = useRideStore()
  const { mutate: toggleOnline, isPending: toggling }    = useDriverOnlineToggle()
  const { mutate: acceptRide,   isPending: accepting }   = useDriverAcceptRide()
  const { mutate: rejectRide,   isPending: rejecting }   = useDriverRejectRide()
  const { mutate: updateStatus, isPending: updatingStatus } = useUpdateRideStatus()

  const nextAction = currentDriverRide
    ? STATUS_ACTIONS.find((a) => a.fromStatus === currentDriverRide.status)
    : null

  const driverStatusAttr = driverOnline ? (currentDriverRide ? 'busy' : 'available') : 'offline'
  const onlineCount = nearbyDrivers.filter((d) => d.availability !== 'offline').length

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Map */}
      <div className="flex-1 min-h-0">
        <CityMap
          drivers={nearbyDrivers}
          pickup={currentDriverRide?.pickup.point}
          destination={currentDriverRide?.destination.point}
          route={currentDriverRide?.route}
        />
      </div>

      {/* Driver panel */}
      <div className="w-full md:w-[380px] bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col overflow-y-auto max-h-[60vh] md:max-h-none shadow-panel">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-slate-900 font-bold text-lg">Driver Console</h2>
            </div>
            <div className="flex items-center gap-2">
              <DriverStatusBadge status={driverStatusAttr} />
              {driverOnline && (
                <span className="text-slate-400 text-xs">{onlineCount} online nearby</span>
              )}
            </div>
          </div>
          <Button
            variant={driverOnline ? 'secondary' : 'primary'}
            size="sm"
            loading={toggling}
            onClick={() => toggleOnline(!driverOnline)}
            className={driverOnline ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300' : ''}
          >
            <Power size={13} />
            {driverOnline ? 'Go Offline' : 'Go Online'}
          </Button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* === OFFLINE STATE === */}
          {!driverOnline && !currentDriverRide && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                <Power size={28} className="text-slate-300" />
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
          {driverOnline && !currentDriverRide && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-green-100 ripple-ring" />
                <div className="absolute inset-0 rounded-full bg-green-100 ripple-ring ripple-ring-2" />
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-elevated z-10 relative">
                  <Navigation size={24} className="text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-slate-900 font-semibold text-lg">Waiting for requests…</p>
                <p className="text-slate-400 text-sm mt-1">
                  {nearbyDrivers.filter((d) => d.availability === 'available').length} drivers active nearby
                </p>
              </div>
            </div>
          )}

          {/* === CURRENT RIDE === */}
          {currentDriverRide && (
            <div className="space-y-4 slide-up">
              <div className="flex items-center justify-between">
                <RideStatusBadge status={currentDriverRide.status} />
                <span className="text-slate-400 text-xs">{formatDistanceToNow(currentDriverRide.updatedAt)}</span>
              </div>

              {/* Route */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <div className="w-px flex-1 h-5 bg-slate-200 my-1" />
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                  </div>
                  <div className="flex-1 space-y-2.5 min-w-0">
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase tracking-wider font-medium">Pickup</p>
                      <p className="text-slate-800 font-semibold text-sm truncate">{currentDriverRide.pickup.label}</p>
                      <p className="text-slate-400 text-xs truncate">{currentDriverRide.pickup.address}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase tracking-wider font-medium">Destination</p>
                      <p className="text-slate-800 font-semibold text-sm truncate">{currentDriverRide.destination.label}</p>
                      <p className="text-slate-400 text-xs truncate">{currentDriverRide.destination.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fare */}
              <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
                <span className="flex items-center gap-2 text-slate-500 text-sm">
                  <DollarSign size={14} />Estimated fare
                </span>
                <span className="text-slate-900 font-bold text-base">
                  {currentDriverRide.finalFare
                    ? formatCurrency(currentDriverRide.finalFare)
                    : `${formatCurrency(currentDriverRide.estimate.minFare)}–${formatCurrency(currentDriverRide.estimate.maxFare)}`}
                </span>
              </div>

              {/* Next action */}
              {nextAction && (
                <Button
                  full size="lg"
                  loading={updatingStatus}
                  onClick={() => updateStatus(nextAction.nextStatus)}
                  className="rounded-2xl font-semibold"
                >
                  {nextAction.icon}
                  {nextAction.label}
                </Button>
              )}

              {currentDriverRide.status === 'completed' && (
                <div className="flex flex-col items-center gap-3 py-4 bg-green-50 rounded-2xl border border-green-200">
                  <CheckCircle2 size={32} className="text-green-600" />
                  <p className="text-green-800 font-semibold">Trip completed!</p>
                  <p className="text-green-700 text-2xl font-black">
                    {formatCurrency(currentDriverRide.finalFare ?? 0)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Earnings */}
          <div>
            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp size={11} />Earnings
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {EARNINGS.map((e) => (
                <div key={e.label} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                  <p className="text-slate-900 font-black text-xl">{formatCurrency(e.amount)}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{e.label}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-slate-400 text-xs">{e.rides} rides</span>
                    <span className="text-green-600 text-xs font-medium flex items-center gap-0.5">
                      <TrendingUp size={9} />+{e.trend}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Incoming ride request modal */}
      <Modal
        open={!!incomingRideRequest}
        onClose={() => {}}
        title="New Ride Request"
        size="md"
      >
        {incomingRideRequest && (
          <div className="space-y-4">
            {/* Urgency indicator */}
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Accept within 30 seconds
            </div>

            {/* Route */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <div className="w-px flex-1 h-5 bg-slate-200 my-1" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 space-y-2.5 min-w-0">
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider">Pickup</p>
                    <p className="text-slate-800 font-semibold text-sm truncate">{incomingRideRequest.pickup.label}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider">Destination</p>
                    <p className="text-slate-800 font-semibold text-sm truncate">{incomingRideRequest.destination.label}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Clock size={14} />,    label: 'Duration', value: `${incomingRideRequest.estimate.durationMinutes} min` },
                { icon: <MapPin size={14} />,   label: 'Distance', value: `${incomingRideRequest.estimate.distanceKm} km` },
                { icon: <DollarSign size={14}/>, label: 'Fare',    value: `${formatCurrency(incomingRideRequest.estimate.minFare)}+` },
              ].map(({ icon, label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <div className="flex justify-center text-slate-400 mb-1">{icon}</div>
                  <p className="text-slate-900 font-bold text-sm">{value}</p>
                  <p className="text-slate-400 text-[10px]">{label}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" full size="lg" loading={rejecting} onClick={() => rejectRide()}>
                Decline
              </Button>
              <Button variant="primary" full size="lg" loading={accepting} onClick={() => acceptRide()}>
                Accept
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
