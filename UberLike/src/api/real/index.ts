import type { ApiClient, EstimateInput, CreateRideInput, CancelRideInput, UpdateStatusInput } from '@/api/contracts'
import type { GeoPoint } from '@/shared/types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status} ${text}`)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export const realApiClient: ApiClient = {
  getMe: () => req('/api/me'),
  searchLocations: (q: string) => req(`/api/locations/search?q=${encodeURIComponent(q)}`),
  getRideTypes: () => req('/api/ride-types'),
  getEstimates: (input: EstimateInput) =>
    req('/api/estimates', { method: 'POST', body: JSON.stringify(input) }),
  createRide: (input: CreateRideInput) =>
    req('/api/rides', { method: 'POST', body: JSON.stringify(input) }),
  getRide: (rideId: string) => req(`/api/rides/${rideId}`),
  cancelRide: (rideId: string, input: CancelRideInput) =>
    req(`/api/rides/${rideId}/cancel`, { method: 'PATCH', body: JSON.stringify(input) }),
  getRideEvents: (rideId: string) => req(`/api/rides/${rideId}/events`),
  getNearbyDrivers: (lat: number, lng: number) =>
    req(`/api/drivers/nearby?lat=${lat}&lng=${lng}`),
  setDriverAvailability: (driverId: string, available: boolean) =>
    req(`/api/drivers/${driverId}/availability`, { method: 'POST', body: JSON.stringify({ available }) }),
  updateDriverLocation: (driverId: string, point: GeoPoint) =>
    req(`/api/drivers/${driverId}/location`, { method: 'POST', body: JSON.stringify(point) }),
  getDriverCurrentRide: (driverId: string) => req(`/api/drivers/${driverId}/rides/current`),
  acceptRide: (driverId: string, rideId: string) =>
    req(`/api/drivers/${driverId}/rides/${rideId}/accept`, { method: 'POST' }),
  rejectRide: (driverId: string, rideId: string) =>
    req(`/api/drivers/${driverId}/rides/${rideId}/reject`, { method: 'POST' }),
  updateRideStatus: (driverId: string, rideId: string, input: UpdateStatusInput) =>
    req(`/api/drivers/${driverId}/rides/${rideId}/status`, { method: 'POST', body: JSON.stringify(input) }),
  getAdminRides: () => req('/api/admin/rides'),
  getAdminDrivers: () => req('/api/admin/drivers'),
  getAdminMetrics: () => req('/api/admin/metrics'),
  getAdminDemand: () => req('/api/admin/demand'),
}
