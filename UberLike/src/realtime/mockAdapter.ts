import type { RealtimeAdapter, IncomingEventName, EventHandler } from './types'
import type { ConnectionStatus, GeoPoint, RideStatus } from '@/shared/types'
import { MOCK_DRIVERS, MOCK_DEMAND_CELLS, MOCK_METRICS, MOCK_RIDE_TYPES } from '@/api/mock/fixtures'
import { clampToBounds, moveToward, distanceKm, generateRoute } from '@/shared/utils/geo'
import { uid } from '@/shared/utils/time'
import type { Driver, Ride } from '@/shared/types'

type HandlerMap = { [K in IncomingEventName]?: Set<EventHandler<K>> }

interface SimDriver extends Driver {
  heading: number
  target: GeoPoint | null
  phase: 'idle' | 'to_pickup' | 'to_dest'
  rideId: string | null
}

let _instance: ReturnType<typeof createMockAdapter> | null = null

export function getMockAdapter() {
  if (!_instance) _instance = createMockAdapter()
  return _instance
}

export function resetMockAdapter() {
  _instance?.disconnect()
  _instance = null
}

export interface MockSimControls {
  latencyMs: number
  failureRate: number
}

export const mockSimControls: MockSimControls = { latencyMs: 200, failureRate: 0 }

function createMockAdapter(): RealtimeAdapter {
  const handlers: HandlerMap = {}
  const statusListeners = new Set<(s: ConnectionStatus) => void>()
  let status: ConnectionStatus = 'mock'
  const timers: ReturnType<typeof setInterval>[] = []

  const simDrivers: SimDriver[] = MOCK_DRIVERS.map((d) => ({
    ...d,
    heading: Math.random() * 360,
    target: null,
    phase: 'idle' as const,
    rideId: null,
  }))

  const demandCells = MOCK_DEMAND_CELLS.map((c) => ({ ...c }))
  let currentRide: Ride | null = null
  let assignedDriverId: string | null = null

  function emit<K extends IncomingEventName>(event: K, data: Parameters<EventHandler<K>>[0]) {
    const set = handlers[event] as Set<EventHandler<K>> | undefined
    set?.forEach((h) => {
      setTimeout(() => h(data as Parameters<EventHandler<K>>[0]), mockSimControls.latencyMs)
    })
  }

  function getDriversSnapshot(): Driver[] {
    return simDrivers.map(({ heading: _h, target: _t, phase: _p, rideId: _r, ...d }) => d)
  }

  // Main simulation tick
  const moveTick = setInterval(() => {
    simDrivers.forEach((d) => {
      if (d.availability === 'offline') return

      if (d.rideId && d.target) {
        const dist = distanceKm(d.location, d.target)
        if (dist < 0.05) {
          if (d.phase === 'to_pickup') {
            // Driver arrived at pickup — passenger boards, start heading to destination
            d.phase = 'to_dest'
            if (currentRide?.destination) {
              d.target = currentRide.destination.point
              const rideId = d.rideId
              emit('ride.status.updated', { rideId, status: 'pickup' })
              // Short pause then trip starts
              setTimeout(() => {
                emit('ride.status.updated', { rideId, status: 'in_progress' })
              }, 2000)
            }
          } else if (d.phase === 'to_dest') {
            // Driver arrived at destination — trip complete
            const rideId = d.rideId
            const fare = currentRide
              ? Math.round((currentRide.estimate.minFare + currentRide.estimate.maxFare) / 2 * 100) / 100
              : 0
            emit('ride.completed', { rideId, finalFare: fare })
            emit('ride.status.updated', { rideId, status: 'completed' })
            d.availability = 'available'
            d.target = null
            d.rideId = null
            d.phase = 'idle'
            currentRide = null
            assignedDriverId = null
          }
        } else {
          // Faster in-trip than driving to pickup
          const speed = d.phase === 'to_dest' ? 0.0010 : 0.0007
          d.location = moveToward(d.location, d.target, speed)
        }
        emit('driver.location.updated', { driverId: d.id, location: d.location })
      } else {
        d.heading += (Math.random() - 0.5) * 40
        const speed = 0.0002
        d.location = clampToBounds({
          lat: d.location.lat + Math.cos((d.heading * Math.PI) / 180) * speed,
          lng: d.location.lng + Math.sin((d.heading * Math.PI) / 180) * speed,
        })
      }
    })

    emit('nearby.drivers.updated', { drivers: getDriversSnapshot() })
  }, 1500)
  timers.push(moveTick)

  // Demand fluctuation
  const demandTick = setInterval(() => {
    demandCells.forEach((cell) => {
      cell.intensity = Math.max(0.1, Math.min(1.0, cell.intensity + (Math.random() - 0.5) * 0.1))
      cell.surgeMultiplier = Math.max(1.0, Math.min(3.0, cell.surgeMultiplier + (Math.random() - 0.5) * 0.2))
    })
    emit('demand.updated', { cells: [...demandCells] })

    const rt = MOCK_RIDE_TYPES[Math.floor(Math.random() * MOCK_RIDE_TYPES.length)]
    emit('pricing.updated', { rideTypeId: rt.id, surgeMultiplier: 1 + Math.random() * 1.2 })
  }, 8000)
  timers.push(demandTick)

  // Metrics fluctuation
  const metricsTick = setInterval(() => {
    emit('admin.metrics.updated', {
      metrics: {
        ...MOCK_METRICS,
        activeRides: Math.floor(3 + Math.random() * 8),
        availableDrivers: Math.floor(8 + Math.random() * 8),
        avgWaitMinutes: Math.round((2.5 + Math.random() * 3) * 10) / 10,
      },
    })
  }, 5000)
  timers.push(metricsTick)

  // Ride simulation entry point
  function simulateRide(ride: Ride) {
    currentRide = ride

    // Matching phase
    emit('ride.matching.started', { rideId: ride.id })

    setTimeout(() => {
      if (mockSimControls.failureRate > 0 && Math.random() < mockSimControls.failureRate) {
        emit('ride.cancelled', { rideId: ride.id, reason: 'Simulated failure' })
        return
      }

      // Find nearest available driver
      const available = simDrivers.filter((d) => d.availability === 'available')
      if (!available.length) {
        emit('ride.cancelled', { rideId: ride.id, reason: 'No drivers available' })
        return
      }

      const driver = available.reduce((best, d) =>
        distanceKm(d.location, ride.pickup.point) < distanceKm(best.location, ride.pickup.point) ? d : best
      )

      assignedDriverId = driver.id
      driver.availability = 'busy'
      driver.rideId = ride.id
      driver.phase = 'to_pickup'
      driver.target = ride.pickup.point

      const driverSnapshot = { ...driver } as Driver

      emit('ride.matched', { rideId: ride.id, driver: driverSnapshot })
      emit('ride.status.updated', { rideId: ride.id, status: 'driver_assigned' })

      // Notify driver console
      emit('ride.incoming_request', { ride })

      // After a few seconds of movement, show "driver arriving" status
      setTimeout(() => {
        if (driver.rideId === ride.id) {
          emit('ride.status.updated', { rideId: ride.id, status: 'driver_arriving' })
        }
      }, 3000)
    }, 2500 + Math.random() * 1500)
  }

  return {
    connect(_channel: string) {
      status = 'mock'
      statusListeners.forEach((cb) => cb(status))
      setTimeout(() => emit('nearby.drivers.updated', { drivers: getDriversSnapshot() }), 500)
      setTimeout(() => emit('demand.updated', { cells: [...demandCells] }), 600)
    },

    disconnect() {
      timers.forEach(clearInterval)
    },

    send(event, data) {
      if (event === 'ride.requested') {
        // Ride object must be in mock state — we look up by ID after creation
        setTimeout(() => {
          // The rideStore sets currentRide before sending this event
          // We check the store to get the full ride object
          import('@/store/rideStore').then(({ useRideStore }) => {
            const ride = useRideStore.getState().currentRide
            if (ride) simulateRide(ride)
          })
        }, 100)
      }
      if (event === 'ride.cancel.requested') {
        const { rideId, reason } = data as { rideId: string; reason: string }
        emit('ride.cancelled', { rideId, reason })
        emit('ride.status.updated', { rideId, status: 'cancelled' as RideStatus })
      }
      if (event === 'driver.ride.accepted') {
        // Manual driver accept — just continue simulation
      }
    },

    on<K extends IncomingEventName>(event: K, handler: EventHandler<K>) {
      if (!handlers[event]) {
        (handlers as Record<string, Set<EventHandler<IncomingEventName>>>)[event] = new Set()
      }
      ;(handlers[event] as Set<EventHandler<K>>).add(handler)
      return () => { ;(handlers[event] as Set<EventHandler<K>>)?.delete(handler) }
    },

    getStatus() { return status },
    onStatusChange(cb) { statusListeners.add(cb); return () => statusListeners.delete(cb) },
  }
}
