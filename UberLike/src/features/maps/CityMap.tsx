import React, { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Plus, Minus, Locate } from 'lucide-react'
import type { GeoPoint, Driver, DemandCell, Location } from '@/shared/types'
import { MAP_CENTER, distanceKm, generateRoute } from '@/shared/utils/geo'

interface CityMapProps {
  drivers?: Driver[]
  pickup?: GeoPoint | null
  destination?: GeoPoint | null
  route?: GeoPoint[]
  demandCells?: DemandCell[]
  activeDriverId?: string | null
  riderLocation?: GeoPoint | null
  locations?: Location[]
  selectionMode?: 'pickup' | 'destination' | null
  onLocationSelect?: (loc: Location) => void
  className?: string
}

// Inject CSS once at module level
if (typeof document !== 'undefined' && !document.getElementById('ridelab-map-css')) {
  const s = document.createElement('style')
  s.id = 'ridelab-map-css'
  s.textContent = `
    @keyframes ridelab-pulse {
      0%,100% { opacity:.8; transform:scale(1); }
      50%      { opacity:.1; transform:scale(1.7); }
    }
    @keyframes ridelab-surge-pulse {
      0%,100% { opacity:.22; }
      50%      { opacity:.06; }
    }
    .ridelab-hot-zone {
      animation: ridelab-surge-pulse 2.4s ease-in-out infinite;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 12px !important;
      box-shadow: 0 4px 20px rgba(0,0,0,.13) !important;
      padding: 0 !important;
      border: 1px solid #e2e8f0;
    }
    .leaflet-popup-content { margin: 0 !important; }
    .leaflet-popup-tip-container { display: none !important; }
  `
  document.head.appendChild(s)
}

type LL = [number, number]
const ll    = (p: GeoPoint): LL      => [p.lat, p.lng]
const llAll = (pts: GeoPoint[]): LL[] => pts.map(ll)

// ── Icon factories ────────────────────────────────────────────────────────

const DRIVER_ICONS: Record<Driver['availability'], L.DivIcon> = {
  available: L.divIcon({
    html: `<div style="width:14px;height:14px;background:#16a34a;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 5px rgba(0,0,0,.3);"></div>`,
    className: '', iconSize: [14, 14], iconAnchor: [7, 7],
  }),
  busy: L.divIcon({
    html: `<div style="width:14px;height:14px;background:#d97706;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 5px rgba(0,0,0,.3);"></div>`,
    className: '', iconSize: [14, 14], iconAnchor: [7, 7],
  }),
  offline: L.divIcon({
    html: `<div style="width:10px;height:10px;background:#94a3b8;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>`,
    className: '', iconSize: [10, 10], iconAnchor: [5, 5],
  }),
}

const ACTIVE_CAR_ICON = L.divIcon({
  html: `
    <div style="position:relative;width:44px;height:64px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;pointer-events:none;">
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);background:#16a34a;color:white;font-size:7px;font-weight:800;padding:2px 6px;border-radius:6px;white-space:nowrap;letter-spacing:.6px;box-shadow:0 1px 4px rgba(0,0,0,.2);">YOUR CAR</div>
      <div class="ridelab-car-body" style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;margin-top:16px;transform-origin:center center;transition:transform 0.9s ease;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(22,163,74,.2);animation:ridelab-pulse 2s ease-in-out infinite;"></div>
        <div style="width:32px;height:32px;border-radius:50%;background:#16a34a;border:3px solid white;box-shadow:0 4px 12px rgba(22,163,74,.45);display:flex;align-items:center;justify-content:center;">
          <svg width="15" height="15" viewBox="-7 -10 14 20" fill="none">
            <rect x="-5" y="-8" width="10" height="16" rx="2.5" fill="white" fill-opacity=".92"/>
            <rect x="-3.5" y="-7" width="7" height="3.5" rx="1" fill="#16a34a" fill-opacity=".55"/>
            <rect x="-3.5" y="4" width="7" height="3" rx="1" fill="#16a34a" fill-opacity=".55"/>
            <rect x="-7" y="-6" width="2.8" height="4" rx=".8" fill="#064e3b"/>
            <rect x="4.2" y="-6" width="2.8" height="4" rx=".8" fill="#064e3b"/>
            <rect x="-7" y="2.5" width="2.8" height="4" rx=".8" fill="#064e3b"/>
            <rect x="4.2" y="2.5" width="2.8" height="4" rx=".8" fill="#064e3b"/>
          </svg>
        </div>
      </div>
    </div>
  `,
  className: '', iconSize: [44, 64], iconAnchor: [22, 50],
})

const PICKUP_ICON = L.divIcon({
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#16a34a;border:3px solid white;box-shadow:0 2px 10px rgba(22,163,74,.4);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;font-family:system-ui,sans-serif;">A</div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 16],
})

const DESTINATION_ICON = L.divIcon({
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#dc2626;border:3px solid white;box-shadow:0 2px 10px rgba(220,38,38,.4);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;font-family:system-ui,sans-serif;">B</div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 16],
})

const RIDER_ICON = L.divIcon({
  html: `
    <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,.25);animation:ridelab-pulse 2s ease-in-out infinite;"></div>
      <div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2.5px solid white;box-shadow:0 1px 5px rgba(59,130,246,.5);"></div>
    </div>
  `,
  className: '', iconSize: [24, 24], iconAnchor: [12, 12],
})

function makeLocationIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
        <div style="background:white;border-radius:5px;padding:2px 7px;font-size:9.5px;font-weight:600;color:${color};white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,.15);border:1px solid ${color}30;max-width:110px;overflow:hidden;text-overflow:ellipsis;">${label}</div>
        <div style="width:9px;height:9px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>
      </div>
    `,
    className: '', iconSize: [110, 34], iconAnchor: [55, 34],
  })
}

function makeSurgeIcon(multiplier: number): L.DivIcon {
  const hot = multiplier >= 2.0
  return L.divIcon({
    html: `<div style="background:${hot ? 'rgba(220,38,38,.85)' : 'rgba(234,88,12,.8)'};color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:7px;white-space:nowrap;pointer-events:none;">⚡ ${multiplier.toFixed(1)}×</div>`,
    className: '', iconSize: [60, 20], iconAnchor: [30, 10],
  })
}

// ── Route split ───────────────────────────────────────────────────────────

function splitRoute(route: GeoPoint[], carPos: GeoPoint): { done: GeoPoint[]; todo: GeoPoint[] } {
  let splitIdx = 0
  let minDist = Infinity
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1]
    const dx = b.lat - a.lat, dy = b.lng - a.lng
    const lenSq = dx * dx + dy * dy
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((carPos.lat - a.lat) * dx + (carPos.lng - a.lng) * dy) / lenSq)) : 0
    const dist = (carPos.lat - (a.lat + t * dx)) ** 2 + (carPos.lng - (a.lng + t * dy)) ** 2
    if (dist < minDist) { minDist = dist; splitIdx = i }
  }
  return { done: route.slice(0, splitIdx + 2), todo: route.slice(splitIdx) }
}

// ── Map controller (auto-pan, fit-bounds) — must be inside MapContainer ──

function MapController({ activeDriverId, route, drivers, onMapReady }: {
  activeDriverId?: string | null
  route?: GeoPoint[]
  drivers: Driver[]
  onMapReady: (m: L.Map) => void
}) {
  const map = useMap()
  const prevActiveId  = useRef<string | null>(null)
  const hasFitRoute   = useRef(false)
  const routeLen      = route?.length ?? 0

  useEffect(() => { onMapReady(map) }, [map, onMapReady])

  // Fit map to route bounds when a route first appears
  useEffect(() => {
    if (routeLen >= 2 && !hasFitRoute.current) {
      hasFitRoute.current = true
      const bounds = L.latLngBounds(route!.map(p => [p.lat, p.lng] as LL))
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
    }
    if (routeLen < 2) hasFitRoute.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLen])

  // Fly to driver when first assigned
  useEffect(() => {
    if (activeDriverId && activeDriverId !== prevActiveId.current) {
      const d = drivers.find(x => x.id === activeDriverId)
      if (d) map.flyTo([d.location.lat, d.location.lng], 14, { duration: 1.5 })
    }
    prevActiveId.current = activeDriverId ?? null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDriverId])

  return null
}

// ── Zoom controls inside MapContainer ────────────────────────────────────

function ZoomControls() {
  const map = useMap()
  return (
    <div style={{ position: 'absolute', bottom: 100, right: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[
        { icon: '+', fn: () => map.zoomIn()  },
        { icon: '−', fn: () => map.zoomOut() },
      ].map(({ icon, fn }) => (
        <button
          key={icon}
          onClick={fn}
          style={{
            width: 34, height: 34,
            background: 'rgba(255,255,255,.95)',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 1px 4px rgba(0,0,0,.12)',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 300,
            color: '#475569',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}

// ── Click-to-select handler ───────────────────────────────────────────────

function LocationClickHandler({ locations, selectionMode, onLocationSelect }: {
  locations: Location[]
  selectionMode?: 'pickup' | 'destination' | null
  onLocationSelect?: (loc: Location) => void
}) {
  const map = useMap()
  useEffect(() => {
    if (!selectionMode || !onLocationSelect) return
    const handler = (e: L.LeafletMouseEvent) => {
      const click = { lat: e.latlng.lat, lng: e.latlng.lng }
      let nearest: Location | null = null
      let minKm = 0.9
      for (const loc of locations) {
        const d = distanceKm(click, loc.point)
        if (d < minKm) { minKm = d; nearest = loc }
      }
      if (nearest) onLocationSelect(nearest)
    }
    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [map, selectionMode, onLocationSelect, locations])
  return null
}

// ── Active driver marker (smooth CSS transition + heading rotation) ────────

function ActiveDriverMarker({ driver }: { driver: Driver }) {
  const markerRef = useRef<L.Marker | null>(null)
  const initPos   = useRef<LL>(ll(driver.location))
  const prevLoc   = useRef(driver.location)

  // Add smooth position transition on mount
  useEffect(() => {
    const el = markerRef.current?.getElement()
    if (el) el.style.transition = 'transform 1.4s linear'
  }, [])

  // Update position + rotate car body toward heading
  useEffect(() => {
    const prev = prevLoc.current
    const curr = driver.location
    const dlat = curr.lat - prev.lat
    const dlng = curr.lng - prev.lng

    if (Math.abs(dlat) + Math.abs(dlng) > 1e-9) {
      const heading = Math.atan2(dlng, dlat) * 180 / Math.PI
      const body = markerRef.current?.getElement()?.querySelector<HTMLElement>('.ridelab-car-body')
      if (body) body.style.transform = `rotate(${heading}deg)`
      prevLoc.current = curr
    }

    markerRef.current?.setLatLng([curr.lat, curr.lng])
  }, [driver.location.lat, driver.location.lng])

  return (
    <Marker ref={markerRef} position={initPos.current} icon={ACTIVE_CAR_ICON} zIndexOffset={1000} />
  )
}

// ── Driver popup content ──────────────────────────────────────────────────

function DriverPopupContent({ driver }: { driver: Driver }) {
  const avail = driver.availability === 'available' ? '#16a34a' : driver.availability === 'busy' ? '#d97706' : '#94a3b8'
  const availLabel = driver.availability === 'available' ? 'Available' : driver.availability === 'busy' ? 'On ride' : 'Offline'
  return (
    <div style={{ padding: '12px 14px', minWidth: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: driver.avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0,
        }}>
          {driver.name.charAt(0)}
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', margin: 0, lineHeight: 1.3 }}>{driver.name}</p>
          <p style={{ fontSize: 11, color: '#f59e0b', margin: 0 }}>{'★'.repeat(Math.round(driver.rating))} {driver.rating.toFixed(1)}</p>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        <p style={{ fontSize: 11, color: '#475569', margin: '0 0 3px' }}>
          <b style={{ color: '#1e293b' }}>{driver.vehicle.make} {driver.vehicle.model}</b>
        </p>
        <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 3px' }}>
          {driver.vehicle.color} ·{' '}
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>{driver.vehicle.plate}</span>
        </p>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: avail + '18', color: avail,
          fontSize: 10, fontWeight: 700, padding: '2px 7px',
          borderRadius: 6, marginTop: 2,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: avail, display: 'inline-block' }} />
          {availLabel}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export function CityMap({
  drivers = [],
  pickup,
  destination,
  route = [],
  demandCells = [],
  riderLocation,
  locations = [],
  selectionMode,
  onLocationSelect,
  activeDriverId,
  className = '',
}: CityMapProps) {
  const mapRef     = useRef<L.Map | null>(null)
  const activeDriver = activeDriverId ? (drivers.find(d => d.id === activeDriverId) ?? null) : null
  const modeColor   = selectionMode === 'pickup' ? '#16a34a' : '#dc2626'
  const locationColor = selectionMode === 'pickup' ? '#16a34a' : selectionMode === 'destination' ? '#dc2626' : '#64748b'

  const locationIcons = useMemo(
    () => locations.map(loc => ({ loc, icon: makeLocationIcon(loc.label, locationColor) })),
    [locations, locationColor],
  )

  const surgeIcons = useMemo(
    () => demandCells
      .filter(c => c.surgeMultiplier >= 1.15)
      .map(c => ({ cell: c, icon: makeSurgeIcon(c.surgeMultiplier) })),
    [demandCells],
  )

  const routeSegments = useMemo(() => {
    if (route.length < 2) return null
    if (!activeDriver) return { done: [] as GeoPoint[], todo: route }
    return splitRoute(route, activeDriver.location)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, activeDriver?.location.lat, activeDriver?.location.lng])

  // Booking preview route (shown when pickup+destination set but no active ride yet)
  const bookingPreview = useMemo(() => {
    if (!pickup || !destination || route.length > 0) return null
    return generateRoute(pickup, destination, 8)
  }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng, route.length])

  const handleMapReady = useRef((m: L.Map) => { mapRef.current = m }).current

  function focusOnCar() {
    if (activeDriver && mapRef.current) {
      mapRef.current.flyTo(
        [activeDriver.location.lat, activeDriver.location.lng], 15,
        { duration: 1.2 },
      )
    }
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        center={[MAP_CENTER.lat, MAP_CENTER.lng]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <MapController
          activeDriverId={activeDriverId}
          route={route.length >= 2 ? route : undefined}
          drivers={drivers}
          onMapReady={handleMapReady}
        />

        <ZoomControls />

        <LocationClickHandler
          locations={locations}
          selectionMode={selectionMode}
          onLocationSelect={onLocationSelect}
        />

        {/* Demand heatmap circles */}
        {demandCells.map(cell => {
          const hot = cell.surgeMultiplier >= 1.5
          const color = cell.surgeMultiplier >= 2.0 ? '#dc2626' : cell.surgeMultiplier >= 1.5 ? '#ea580c' : '#f97316'
          return (
            <React.Fragment key={cell.id}>
              <Circle
                center={ll(cell.center)}
                radius={450}
                pathOptions={{
                  color: 'transparent',
                  fillColor: color,
                  fillOpacity: cell.intensity * 0.32,
                  weight: 0,
                }}
              />
              {hot && (
                <Circle
                  center={ll(cell.center)}
                  radius={680}
                  pathOptions={{
                    color: color,
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    weight: 1.5,
                    opacity: 0.22,
                    className: 'ridelab-hot-zone',
                  }}
                />
              )}
            </React.Fragment>
          )
        })}

        {/* Surge multiplier badges */}
        {surgeIcons.map(({ cell, icon }) => (
          <Marker
            key={`surge-${cell.id}`}
            position={ll(cell.center)}
            icon={icon}
            interactive={false}
            zIndexOffset={-100}
          />
        ))}

        {/* Route — completed portion (green solid) */}
        {routeSegments && routeSegments.done.length >= 2 && (
          <Polyline
            positions={llAll(routeSegments.done)}
            pathOptions={{ color: '#22c55e', weight: 5, lineCap: 'round', lineJoin: 'round', opacity: 0.9 }}
          />
        )}

        {/* Route — remaining portion (blue glow + dashed) */}
        {routeSegments && routeSegments.todo.length >= 2 && (
          <>
            <Polyline
              positions={llAll(routeSegments.todo)}
              pathOptions={{ color: '#93c5fd', weight: 9, opacity: 0.3, lineCap: 'round' }}
            />
            <Polyline
              positions={llAll(routeSegments.todo)}
              pathOptions={{ color: '#2563eb', weight: 3.5, dashArray: '10 6', lineCap: 'round', opacity: 0.9 }}
            />
          </>
        )}

        {/* Booking preview route (dashed, before a ride is placed) */}
        {bookingPreview && (
          <>
            <Polyline
              positions={llAll(bookingPreview)}
              pathOptions={{ color: '#c4b5fd', weight: 8, opacity: 0.25, lineCap: 'round' }}
            />
            <Polyline
              positions={llAll(bookingPreview)}
              pathOptions={{ color: '#7c3aed', weight: 2.5, dashArray: '8 5', lineCap: 'round', opacity: 0.65 }}
            />
          </>
        )}

        {/* Driver markers with popup on click */}
        {drivers
          .filter(d => d.id !== activeDriverId)
          .map(d => (
            <Marker
              key={d.id}
              position={ll(d.location)}
              icon={DRIVER_ICONS[d.availability] ?? DRIVER_ICONS.offline}
            >
              <Popup closeButton={false} offset={[0, -6]}>
                <DriverPopupContent driver={d} />
              </Popup>
            </Marker>
          ))}

        {/* Location pins */}
        {locationIcons.map(({ loc, icon }) => (
          <Marker
            key={loc.id}
            position={ll(loc.point)}
            icon={icon}
            eventHandlers={{ click: () => selectionMode && onLocationSelect?.(loc) }}
          />
        ))}

        {/* Rider dot */}
        {riderLocation && (
          <Marker position={ll(riderLocation)} icon={RIDER_ICON} />
        )}

        {/* Pickup (A) and destination (B) pins */}
        {pickup      && <Marker position={ll(pickup)}      icon={PICKUP_ICON}      zIndexOffset={500} />}
        {destination && <Marker position={ll(destination)} icon={DESTINATION_ICON} zIndexOffset={500} />}

        {/* Active car with smooth CSS-transition movement */}
        {activeDriver && (
          <ActiveDriverMarker key={activeDriver.id} driver={activeDriver} />
        )}
      </MapContainer>

      {/* Focus-on-car button (outside MapContainer, uses mapRef) */}
      {activeDriver && (
        <button
          onClick={focusOnCar}
          title="Center on car"
          className="absolute z-[1000] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-2.5 py-2 shadow-card hover:bg-slate-50 transition-colors flex items-center gap-1.5 text-xs font-medium text-slate-600"
          style={{ top: 56, left: 12 }}
        >
          <Locate size={13} className="text-brand-600" />
          Follow car
        </button>
      )}

      {/* Selection mode pill */}
      {selectionMode && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none z-[1000]">
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium"
            style={{ background: modeColor, boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}
          >
            <span className="w-2 h-2 rounded-full bg-white/70 animate-pulse" />
            Click a location to set {selectionMode === 'pickup' ? 'pickup' : 'destination'}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-2.5 shadow-card space-y-1.5">
        {([
          { color: '#16a34a', label: 'Available' },
          { color: '#d97706', label: 'On ride'   },
          { color: '#ea580c', label: 'Surge zone' },
        ] as const).map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 text-[10px] text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Driver count chip */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-2 shadow-card">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-semibold text-slate-900">
            {drivers.filter(d => d.availability === 'available').length}
          </span>
          <span>drivers available</span>
        </div>
      </div>
    </div>
  )
}
