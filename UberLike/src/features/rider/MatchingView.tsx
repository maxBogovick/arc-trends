import { useEffect, useState } from 'react'
import { X, Star, MapPin } from 'lucide-react'
import { CityMap } from '@/features/maps/CityMap'
import { useRideStore } from '@/store/rideStore'
import { useCancelRide } from './useRide'
import { Button } from '@/shared/ui/Button'

export function MatchingView() {
  const { nearbyDrivers, currentRide, matchingProgress, assignedDriver, demandCells } = useRideStore()
  const { mutate: cancelRide, isPending } = useCancelRide()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const isMatched = !!assignedDriver
  const availableCount = nearbyDrivers.filter((d) => d.availability === 'available').length

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Map */}
      <div className="flex-1 min-h-0">
        <CityMap
          drivers={nearbyDrivers}
          pickup={currentRide?.pickup.point}
          demandCells={demandCells}
          riderLocation={useRideStore.getState().riderLocation}
        />
      </div>

      {/* Status panel */}
      <div className="w-full md:w-[380px] bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col shadow-panel">
        {!isMatched ? (
          <div className="flex-1 flex flex-col p-6 gap-5">
            {/* Animated search */}
            <div className="flex flex-col items-center gap-5 py-8">
              {/* Ripple rings */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-green-100 ripple-ring" />
                <div className="absolute inset-0 rounded-full bg-green-100 ripple-ring ripple-ring-2" />
                <div className="absolute inset-0 rounded-full bg-green-100 ripple-ring ripple-ring-3" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-elevated z-10">
                  <span className="text-2xl">🚗</span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-slate-900 font-bold text-xl">Finding your driver…</p>
                <p className="text-slate-400 text-sm mt-1.5">
                  {elapsed}s elapsed · {availableCount} driver{availableCount !== 1 ? 's' : ''} nearby
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-300"
                    style={{ width: `${matchingProgress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-slate-400 text-xs">Matching in progress</span>
                  <span className="text-slate-400 text-xs">{matchingProgress}%</span>
                </div>
              </div>
            </div>

            {/* Ride info */}
            {currentRide && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Your trip</p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                    <span className="text-slate-700 text-sm truncate">{currentRide.pickup.label}</span>
                  </div>
                  <div className="pl-[5px] flex items-center gap-1">
                    <div className="flex flex-col gap-0.5">
                      <div className="w-px h-1.5 bg-slate-200 ml-[0px]" />
                      <div className="w-px h-1.5 bg-slate-200 ml-[0px]" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                    <span className="text-slate-700 text-sm truncate">{currentRide.destination.label}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-auto">
              <Button
                variant="secondary"
                full
                size="lg"
                loading={isPending}
                onClick={() => cancelRide('Rider cancelled')}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-xl"
              >
                <X size={15} />
                Cancel request
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-6 gap-5 slide-up">
            {/* Driver matched header */}
            <div className="text-center py-4 border-b border-slate-100">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Driver matched!
              </div>
              <div
                className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl font-bold text-white mb-3 shadow-elevated"
                style={{ background: assignedDriver.avatarColor }}
              >
                {assignedDriver.name.charAt(0)}
              </div>
              <h3 className="text-slate-900 font-bold text-xl">{assignedDriver.name}</h3>
              <div className="flex items-center justify-center gap-0.5 mt-1.5">
                {[1,2,3,4,5].map((i) => (
                  <Star key={i} size={13} className={i <= Math.round(assignedDriver.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} />
                ))}
                <span className="text-slate-500 text-xs ml-1.5">{assignedDriver.rating.toFixed(1)}</span>
              </div>
            </div>

            {/* Vehicle info */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-900 font-semibold text-sm">
                    {assignedDriver.vehicle.make} {assignedDriver.vehicle.model}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">{assignedDriver.vehicle.color}</p>
                </div>
                <div
                  className="px-3.5 py-2 rounded-xl font-mono font-bold text-sm shadow-sm border"
                  style={{
                    background: `${assignedDriver.avatarColor}15`,
                    color: assignedDriver.avatarColor,
                    borderColor: `${assignedDriver.avatarColor}30`,
                  }}
                >
                  {assignedDriver.vehicle.plate}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-500 text-sm bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <span className="text-lg">🚗</span>
              <span>Your driver is heading to you</span>
            </div>

            <div className="mt-auto">
              <Button
                variant="secondary"
                full
                loading={isPending}
                onClick={() => cancelRide('Rider cancelled after match')}
              >
                Cancel ride
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
