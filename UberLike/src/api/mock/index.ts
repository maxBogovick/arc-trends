import type {
  ApiClient, EstimateInput, CreateRideInput, CancelRideInput, UpdateStatusInput,
} from '@/api/contracts'
import type { User, Driver, FareEstimate, Ride, RideEvent, Location, GeoPoint } from '@/shared/types'
import {
  MOCK_RIDE_TYPES, MOCK_DRIVERS, MOCK_LOCATIONS, MOCK_RIDES, MOCK_EVENTS,
  MOCK_DEMAND_CELLS, MOCK_METRICS,
} from './fixtures'
import { distanceKm, generateRoute } from '@/shared/utils/geo'
import { uid } from '@/shared/utils/time'

const delay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms))

const drivers: Driver[] = MOCK_DRIVERS.map((d) => ({ ...d }))
const rides: Ride[] = MOCK_RIDES.map((r) => ({ ...r }))
const events: RideEvent[] = [...MOCK_EVENTS]

const CURRENT_USER: User = { id: 'user-1', name: 'You', role: 'rider', rating: 4.9 }

function searchLocations(query: string): Location[] {
  const q = query.toLowerCase()
  return MOCK_LOCATIONS.filter(
    (l) => l.label.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
  ).slice(0, 6)
}

function calcFare(rideTypeId: string, from: GeoPoint, to: GeoPoint, surge = 1.0): FareEstimate {
  const rt = MOCK_RIDE_TYPES.find((r) => r.id === rideTypeId)!
  const km = distanceKm(from, to)
  const minutes = km * 3 + 5
  const base = rt.baseFare + km * rt.pricePerKm + minutes * rt.pricePerMinute
  return {
    rideTypeId,
    currency: 'USD',
    minFare: Math.round(base * surge * 0.9 * 100) / 100,
    maxFare: Math.round(base * surge * 1.1 * 100) / 100,
    distanceKm: Math.round(km * 10) / 10,
    durationMinutes: Math.round(minutes),
    surgeMultiplier: surge,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  }
}

export const mockApiClient: ApiClient = {
  async getMe() { await delay(); return CURRENT_USER },

  async searchLocations(query: string) { await delay(150); return searchLocations(query) },

  async getRideTypes() { await delay(); return [...MOCK_RIDE_TYPES] },

  async getEstimates(input: EstimateInput) {
    await delay(350)
    const surges = [1.0, 1.2, 1.5, 1.0]
    return MOCK_RIDE_TYPES.map((rt, i) => calcFare(rt.id, input.pickupPoint, input.destinationPoint, surges[i] ?? 1.0))
  },

  async createRide(input: CreateRideInput) {
    await delay(400)
    const pickup = MOCK_LOCATIONS.find((l) => l.id === input.pickupId) ?? MOCK_LOCATIONS[0]
    const destination = MOCK_LOCATIONS.find((l) => l.id === input.destinationId) ?? MOCK_LOCATIONS[1]
    const estimate = calcFare(input.rideTypeId, pickup.point, destination.point)
    const ride: Ride = {
      id: `ride-${uid()}`,
      riderId: CURRENT_USER.id,
      driverId: null,
      status: 'requested',
      pickup,
      destination,
      rideTypeId: input.rideTypeId,
      estimate,
      finalFare: null,
      route: generateRoute(pickup.point, destination.point),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    rides.push(ride)
    events.push({ id: uid(), rideId: ride.id, type: 'ride.created', payload: { idempotencyKey: input.idempotencyKey }, createdAt: new Date().toISOString() })
    return ride
  },

  async getRide(rideId: string) {
    await delay(150)
    const r = rides.find((r) => r.id === rideId)
    if (!r) throw new Error(`Ride ${rideId} not found`)
    return r
  },

  async cancelRide(rideId: string, input: CancelRideInput) {
    await delay(200)
    const r = rides.find((r) => r.id === rideId)
    if (!r) throw new Error(`Ride ${rideId} not found`)
    r.status = 'cancelled'
    r.cancellationReason = input.reason
    r.updatedAt = new Date().toISOString()
    events.push({ id: uid(), rideId, type: 'ride.cancelled', payload: { reason: input.reason }, createdAt: new Date().toISOString() })
    return r
  },

  async getRideEvents(rideId: string) {
    await delay(150)
    return events.filter((e) => e.rideId === rideId)
  },

  async getNearbyDrivers(lat: number, lng: number) {
    await delay(200)
    return drivers
      .filter((d) => d.availability !== 'offline')
      .sort((a, b) => distanceKm({ lat, lng }, a.location) - distanceKm({ lat, lng }, b.location))
      .slice(0, 10)
  },

  async setDriverAvailability(driverId: string, available: boolean) {
    await delay(200)
    const d = drivers.find((d) => d.id === driverId)
    if (!d) throw new Error('Driver not found')
    d.availability = available ? 'available' : 'offline'
    return d
  },

  async updateDriverLocation(driverId: string, point: GeoPoint) {
    await delay(100)
    const d = drivers.find((d) => d.id === driverId)
    if (d) d.location = point
  },

  async getDriverCurrentRide(driverId: string) {
    await delay(150)
    const d = drivers.find((d) => d.id === driverId)
    if (!d?.currentRideId) return null
    return rides.find((r) => r.id === d.currentRideId) ?? null
  },

  async acceptRide(driverId: string, rideId: string) {
    await delay(200)
    const ride = rides.find((r) => r.id === rideId)
    const driver = drivers.find((d) => d.id === driverId)
    if (!ride || !driver) throw new Error('Not found')
    ride.driverId = driverId
    ride.status = 'driver_assigned'
    ride.updatedAt = new Date().toISOString()
    driver.availability = 'busy'
    driver.currentRideId = rideId
    events.push({ id: uid(), rideId, type: 'ride.matched', payload: { driverId }, createdAt: new Date().toISOString() })
    return ride
  },

  async rejectRide(driverId: string, rideId: string) {
    await delay(150)
    const driver = drivers.find((d) => d.id === driverId)
    if (driver) driver.currentRideId = null
  },

  async updateRideStatus(driverId: string, rideId: string, input: UpdateStatusInput) {
    await delay(200)
    const ride = rides.find((r) => r.id === rideId)
    if (!ride) throw new Error('Ride not found')
    ride.status = input.status
    ride.updatedAt = new Date().toISOString()
    if (input.status === 'completed') {
      ride.finalFare = Math.round((ride.estimate.minFare + ride.estimate.maxFare) / 2 * 100) / 100
      const driver = drivers.find((d) => d.id === driverId)
      if (driver) { driver.availability = 'available'; driver.currentRideId = null }
    }
    events.push({ id: uid(), rideId, type: 'ride.status.updated', payload: { status: input.status }, createdAt: new Date().toISOString() })
    return ride
  },

  async getAdminRides() { await delay(300); return [...rides].reverse() },
  async getAdminDrivers() { await delay(200); return [...drivers] },
  async getAdminMetrics() { await delay(200); return { ...MOCK_METRICS } },
  async getAdminDemand() { await delay(200); return [...MOCK_DEMAND_CELLS] },
}
