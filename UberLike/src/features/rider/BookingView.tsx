import { useState, useEffect } from 'react'
import { MapPin, Navigation, Search, Car, Package, Loader2, TrendingUp, AlertTriangle, ArrowRight, Clock, Zap } from 'lucide-react'
import { CityMap } from '@/features/maps/CityMap'
import { useRideStore } from '@/store/rideStore'
import { useRideTypes, useLocationSearch, useEstimates, useRequestRide } from './useRide'
import { Button } from '@/shared/ui/Button'
import type { Location, RideType } from '@/shared/types'
import { formatCurrency } from '@/shared/utils/time'

function LocationInput({
  placeholder,
  value,
  onSelect,
  accent,
}: {
  placeholder: string
  value: string
  onSelect: (loc: Location) => void
  accent: 'pickup' | 'destination'
}) {
  const [query, setQuery] = useState(value)
  const [focused, setFocused] = useState(false)
  const { data: results } = useLocationSearch(query)

  useEffect(() => { setQuery(value) }, [value])

  const dotColor = accent === 'pickup' ? 'bg-green-500' : 'bg-red-500'
  const ringColor = accent === 'pickup' ? 'focus-within:ring-green-100 focus-within:border-green-400' : 'focus-within:ring-red-100 focus-within:border-red-400'

  return (
    <div className="relative">
      <div className={`flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3.5 h-12 transition-all duration-150 focus-within:ring-2 focus-within:shadow-sm ${ringColor}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
        <input
          className="flex-1 bg-transparent text-slate-900 text-sm placeholder:text-slate-400 outline-none"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {query.length > 0 && <Search size={13} className="text-slate-300 shrink-0" />}
      </div>

      {focused && results && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-panel z-20 slide-up">
          {results.map((loc, i) => (
            <button
              key={loc.id}
              onMouseDown={() => { onSelect(loc); setQuery(loc.label) }}
              className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left ${i > 0 ? 'border-t border-slate-50' : ''}`}
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin size={12} className="text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-slate-900 text-sm font-medium truncate">{loc.label}</p>
                <p className="text-slate-400 text-xs truncate">{loc.address}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const RIDE_ICONS: Record<string, React.ReactNode> = {
  economy:  <Car     size={18} className="text-slate-500" />,
  comfort:  <Car     size={18} className="text-blue-500"  />,
  xl:       <Car     size={20} className="text-purple-500"/>,
  delivery: <Package size={18} className="text-amber-500" />,
}

function RideTypeCard({ rt, est, surge, selected, onClick }: {
  rt: RideType
  est: { minFare: number; maxFare: number; distanceKm: number; durationMinutes: number } | undefined
  surge: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all duration-150 text-left ${
        selected
          ? 'border-brand-500 bg-brand-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-brand-100' : 'bg-slate-100'}`}>
        {RIDE_ICONS[rt.id] ?? <Car size={18} className="text-slate-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm ${selected ? 'text-brand-800' : 'text-slate-800'}`}>{rt.name}</span>
          {surge > 1.1 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
              <TrendingUp size={9} />{surge.toFixed(1)}×
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-slate-400 text-xs">{rt.description}</span>
          {est && (
            <>
              <span className="text-slate-200 text-xs">·</span>
              <span className="flex items-center gap-1 text-slate-400 text-xs">
                <Clock size={10} />{est.durationMinutes} min
              </span>
            </>
          )}
        </div>
      </div>
      {est ? (
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${selected ? 'text-brand-700' : 'text-slate-800'}`}>
            {formatCurrency(est.minFare)}–{formatCurrency(est.maxFare)}
          </p>
          <p className="text-slate-400 text-[11px]">{est.distanceKm} km</p>
        </div>
      ) : (
        <div className="w-14 h-8 bg-slate-100 rounded-lg animate-pulse" />
      )}
    </button>
  )
}

export function BookingView() {
  const store = useRideStore()
  const { data: rideTypes } = useRideTypes()
  const { isFetching: estimating, isError: estimateError } = useEstimates()
  const { mutate: requestRide, isPending: requesting } = useRequestRide()

  const pickupLabel = store.pickupLocation?.label ?? ''
  const destLabel = store.destinationLocation?.label ?? ''
  const selectedEstimate = store.fareEstimates.find((e) => e.rideTypeId === store.selectedRideTypeId)
  const canRequest = !!store.pickupLocation && !!store.destinationLocation && !!store.selectedRideTypeId

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        <CityMap
          drivers={store.nearbyDrivers}
          pickup={store.pickupLocation?.point}
          destination={store.destinationLocation?.point}
          demandCells={store.demandCells}
          riderLocation={store.riderLocation}
        />
      </div>

      {/* Booking panel */}
      <div className="w-full md:w-[380px] bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col overflow-y-auto max-h-[55vh] md:max-h-none shadow-panel">
        {/* Panel header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-100">
          <h2 className="text-slate-900 font-bold text-xl mb-1">Where to?</h2>
          <p className="text-slate-400 text-sm">
            {store.nearbyDrivers.filter((d) => d.availability === 'available').length} drivers available nearby
          </p>
        </div>

        <div className="p-6 space-y-5 flex-1">
          {/* Location inputs */}
          <div className="space-y-1.5">
            <LocationInput
              placeholder="Pickup location"
              value={pickupLabel}
              onSelect={store.setPickup}
              accent="pickup"
            />
            {/* Connector */}
            <div className="flex items-center gap-3 pl-[14px]">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-px h-2 bg-slate-200" />
                <div className="w-px h-2 bg-slate-200" />
              </div>
            </div>
            <LocationInput
              placeholder="Where to?"
              value={destLabel}
              onSelect={store.setDestination}
              accent="destination"
            />
          </div>

          {/* Ride type + estimates */}
          {store.pickupLocation && store.destinationLocation && (
            <div>
              {estimating && (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
                  <Loader2 size={14} className="animate-spin text-brand-500" />
                  Getting estimates…
                </div>
              )}
              {estimateError && (
                <div className="flex items-center gap-2 text-red-600 text-sm py-3 bg-red-50 rounded-xl px-4 border border-red-100">
                  <AlertTriangle size={14} />
                  Failed to load estimates
                </div>
              )}
              {!estimating && rideTypes && (
                <div className="space-y-2">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Choose your ride</p>
                  {rideTypes.map((rt) => {
                    const est = store.fareEstimates.find((e) => e.rideTypeId === rt.id)
                    const surge = store.surgeMultipliers[rt.id] ?? est?.surgeMultiplier ?? 1
                    return (
                      <RideTypeCard
                        key={rt.id}
                        rt={rt}
                        est={est}
                        surge={surge}
                        selected={store.selectedRideTypeId === rt.id}
                        onClick={() => store.setSelectedRideType(rt.id)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Price summary */}
          {selectedEstimate && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Trip summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Distance</span>
                  <span className="text-slate-700 font-medium">{selectedEstimate.distanceKm} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Est. time</span>
                  <span className="text-slate-700 font-medium">{selectedEstimate.durationMinutes} min</span>
                </div>
                {selectedEstimate.surgeMultiplier > 1 && (
                  <div className="flex justify-between text-orange-600">
                    <span className="flex items-center gap-1"><Zap size={12} />Surge pricing</span>
                    <span className="font-semibold">{selectedEstimate.surgeMultiplier}×</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-800 font-semibold">Estimated fare</span>
                  <span className="text-slate-900 font-bold text-base">
                    {formatCurrency(selectedEstimate.minFare)}–{formatCurrency(selectedEstimate.maxFare)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="pt-1">
            <Button
              full
              size="lg"
              loading={requesting}
              disabled={!canRequest}
              onClick={() => requestRide()}
              className="rounded-2xl text-base font-semibold h-13 py-3.5"
            >
              {requesting ? 'Requesting…' : (
                <>
                  Request ride
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
            {!canRequest && !requesting && (
              <p className="text-center text-slate-400 text-xs mt-2">
                {!store.pickupLocation ? 'Add a pickup location' : !store.destinationLocation ? 'Add a destination' : 'Choose a ride type'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
