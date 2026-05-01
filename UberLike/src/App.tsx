import { useState, useMemo } from 'react'
import { Car, Radio, WifiOff, X } from 'lucide-react'
import { CityMap } from '@/features/maps/CityMap'
import { RiderPanel } from '@/features/rider/RiderPanel'
import { DriverPanel } from '@/features/driver/DriverPanel'
import { BottomBar } from '@/shared/ui/BottomBar'
import { DebugPanel } from '@/shared/ui/DebugPanel'
import { ToastContainer } from '@/shared/ui/Toast'
import { useApiModeStore } from '@/store/apiModeStore'
import { useRideStore } from '@/store/rideStore'
import { MOCK_LOCATIONS } from '@/api/mock/fixtures'
import { generateRoute } from '@/shared/utils/geo'
import type { Location, GeoPoint } from '@/shared/types'

function StatusDot() {
  const { mode, connectionStatus } = useApiModeStore()

  if (mode === 'mock') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
        <Radio size={11} className="text-violet-500" />
        <span>Mock</span>
      </div>
    )
  }

  const cfg = {
    connecting: { color: 'text-amber-700 bg-amber-50 border-amber-200',  dot: 'bg-amber-400',              label: 'Connecting' },
    connected:  { color: 'text-green-700 bg-green-50 border-green-200',  dot: 'bg-green-500 animate-pulse', label: 'Live'       },
    offline:    { color: 'text-red-700   bg-red-50   border-red-200',    dot: 'bg-red-500',                 label: 'Offline'    },
    error:      { color: 'text-red-700   bg-red-50   border-red-200',    dot: 'bg-red-500',                 label: 'Error'      },
  } as const
  const c = cfg[connectionStatus as keyof typeof cfg] ?? cfg.connecting

  return (
    <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </div>
  )
}

function ApiModeToggle() {
  const { mode, setMode } = useApiModeStore()
  return (
    <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5">
      {(['mock', 'real'] as const).map(m => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-3 h-7 rounded-lg text-xs font-medium capitalize transition-all ${
            mode === m ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}

function OfflineBanner() {
  const { mode, connectionStatus } = useApiModeStore()
  if (mode !== 'real' || connectionStatus === 'connected' || connectionStatus === 'connecting') return null
  return (
    <div className="absolute top-[52px] inset-x-0 z-40 flex justify-center pointer-events-none">
      <div className="bg-red-600 text-white text-xs px-5 py-2 rounded-b-2xl shadow-elevated flex items-center gap-2">
        <WifiOff size={13} />
        Backend unreachable — mock data in use
      </div>
    </div>
  )
}

export default function App() {
  const [mapSelectionMode, setMapSelectionMode] = useState<'pickup' | 'destination' | null>(null)
  const [previewRoute, setPreviewRoute] = useState<{
    pickup: GeoPoint; destination: GeoPoint; route: GeoPoint[]
  } | null>(null)

  const pickup         = useRideStore(s => s.pickupLocation)
  const destination    = useRideStore(s => s.destinationLocation)
  const nearbyDrivers  = useRideStore(s => s.nearbyDrivers)
  const currentRide    = useRideStore(s => s.currentRide)
  const assignedDriver = useRideStore(s => s.assignedDriver)
  const riderLocation  = useRideStore(s => s.riderLocation)
  const demandCells    = useRideStore(s => s.demandCells)

  const activeDriverId = assignedDriver?.id ?? currentRide?.driverId ?? null

  // Preview route line on the map while booking (before a ride is requested)
  const bookingPreviewRoute = useMemo(() => {
    if (currentRide || !pickup || !destination) return []
    return generateRoute(pickup.point, destination.point, 8)
  }, [pickup?.id, destination?.id, !!currentRide])

  function handleLocationSelect(loc: Location) {
    const { setPickup, setDestination } = useRideStore.getState()
    if (mapSelectionMode === 'pickup') {
      setPickup(loc)
      setMapSelectionMode(null)
    } else if (mapSelectionMode === 'destination') {
      setDestination(loc)
      setMapSelectionMode(null)
    }
  }

  const mapPickup      = previewRoute?.pickup ?? pickup?.point
  const mapDestination = previewRoute?.destination ?? destination?.point
  const mapRoute       = previewRoute?.route ?? currentRide?.route ?? bookingPreviewRoute

  return (
    <div className="h-screen flex flex-col bg-slate-100 relative overflow-hidden">
      {/* Nav */}
      <header className="h-[52px] shrink-0 flex items-center justify-between px-5 bg-white border-b border-slate-200 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
            <Car size={16} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">RideLab</span>
            <span className="hidden sm:inline text-slate-400 text-xs ml-2">System Design Platform</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-slate-200 ml-1" />
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Live Simulation
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot />
          <ApiModeToggle />
        </div>
      </header>

      <OfflineBanner />

      {/* Main: map + sidebar */}
      <main className="flex-1 flex min-h-0">
        {/* Map */}
        <div className="flex-1 min-w-0 relative">
          <CityMap
            drivers={nearbyDrivers}
            pickup={mapPickup}
            destination={mapDestination}
            route={mapRoute}
            riderLocation={riderLocation}
            demandCells={demandCells}
            locations={MOCK_LOCATIONS}
            selectionMode={mapSelectionMode}
            onLocationSelect={handleLocationSelect}
            activeDriverId={previewRoute ? null : activeDriverId}
          />
          {/* Preview banner */}
          {previewRoute && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-elevated text-sm">
              <span className="text-slate-600">Previewing past route</span>
              <button onClick={() => setPreviewRoute(null)}
                className="text-slate-400 hover:text-slate-700 transition-colors ml-1">
                <X size={13}/>
              </button>
            </div>
          )}
        </div>

        {/* Sidebar: Rider + Driver stacked */}
        <div className="w-[400px] shrink-0 flex flex-col border-l border-slate-200 bg-white overflow-hidden">
          {/* Rider panel — 60% */}
          <div className="flex-[3] min-h-0 overflow-y-auto border-b border-slate-100">
            <RiderPanel
              onRequestMapMode={mode => setMapSelectionMode(mode)}
              onPreviewRoute={setPreviewRoute}
            />
          </div>

          {/* Divider label */}
          <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 border-y border-slate-100 shrink-0">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Driver</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Driver panel — bottom half */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <DriverPanel />
          </div>
        </div>
      </main>

      {/* Bottom bar */}
      <BottomBar />

      <DebugPanel />
      <ToastContainer />
    </div>
  )
}
