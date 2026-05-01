import type { Driver, Ride, RideStatus, DemandCell, GeoPoint } from '@/shared/types'

export interface OutgoingEvents {
  'rider.location.update': GeoPoint
  'ride.requested': { rideId: string }
  'ride.cancel.requested': { rideId: string; reason: string }
  'driver.availability.update': { available: boolean }
  'driver.location.update': GeoPoint
  'driver.ride.accepted': { rideId: string }
  'driver.ride.rejected': { rideId: string }
  'driver.ride.status.update': { rideId: string; status: RideStatus }
}

export interface IncomingEvents {
  'driver.location.updated': { driverId: string; location: GeoPoint }
  'nearby.drivers.updated': { drivers: Driver[] }
  'ride.request.created': { rideId: string }
  'ride.matching.started': { rideId: string }
  'ride.matched': { rideId: string; driver: Driver }
  'ride.status.updated': { rideId: string; status: RideStatus }
  'ride.cancelled': { rideId: string; reason: string }
  'ride.completed': { rideId: string; finalFare: number }
  'pricing.updated': { surgeMultiplier: number; rideTypeId: string }
  'demand.updated': { cells: DemandCell[] }
  'admin.metrics.updated': { metrics: import('@/shared/types').AdminMetrics }
  'ride.incoming_request': { ride: Ride }
}

export type IncomingEventName = keyof IncomingEvents
export type EventHandler<K extends IncomingEventName> = (data: IncomingEvents[K]) => void

export interface RealtimeAdapter {
  connect(channel: string): void
  disconnect(): void
  send<K extends keyof OutgoingEvents>(event: K, data: OutgoingEvents[K]): void
  on<K extends IncomingEventName>(event: K, handler: EventHandler<K>): () => void
  getStatus(): import('@/shared/types').ConnectionStatus
  onStatusChange(cb: (s: import('@/shared/types').ConnectionStatus) => void): () => void
}
