export type {
  User, Driver, Vehicle, RideType, FareEstimate, Ride, RideStatus,
  RideEvent, DemandCell, AdminMetrics, Location, GeoPoint, DriverAvailability,
} from '@/shared/types'

export interface SearchLocationsResult {
  locations: import('@/shared/types').Location[]
}

export interface EstimateInput {
  pickupPoint: import('@/shared/types').GeoPoint
  destinationPoint: import('@/shared/types').GeoPoint
}

export interface CreateRideInput {
  pickupId: string
  destinationId: string
  rideTypeId: string
  idempotencyKey: string
}

export interface CancelRideInput {
  reason: string
}

export interface UpdateStatusInput {
  status: import('@/shared/types').RideStatus
}

export interface ApiClient {
  getMe(): Promise<import('@/shared/types').User>
  searchLocations(query: string): Promise<import('@/shared/types').Location[]>
  getRideTypes(): Promise<import('@/shared/types').RideType[]>
  getEstimates(input: EstimateInput): Promise<import('@/shared/types').FareEstimate[]>

  createRide(input: CreateRideInput): Promise<import('@/shared/types').Ride>
  getRide(rideId: string): Promise<import('@/shared/types').Ride>
  cancelRide(rideId: string, input: CancelRideInput): Promise<import('@/shared/types').Ride>
  getRideEvents(rideId: string): Promise<import('@/shared/types').RideEvent[]>

  getNearbyDrivers(lat: number, lng: number): Promise<import('@/shared/types').Driver[]>
  setDriverAvailability(driverId: string, available: boolean): Promise<import('@/shared/types').Driver>
  updateDriverLocation(driverId: string, point: import('@/shared/types').GeoPoint): Promise<void>
  getDriverCurrentRide(driverId: string): Promise<import('@/shared/types').Ride | null>
  acceptRide(driverId: string, rideId: string): Promise<import('@/shared/types').Ride>
  rejectRide(driverId: string, rideId: string): Promise<void>
  updateRideStatus(driverId: string, rideId: string, input: UpdateStatusInput): Promise<import('@/shared/types').Ride>

  getAdminRides(): Promise<import('@/shared/types').Ride[]>
  getAdminDrivers(): Promise<import('@/shared/types').Driver[]>
  getAdminMetrics(): Promise<import('@/shared/types').AdminMetrics>
  getAdminDemand(): Promise<import('@/shared/types').DemandCell[]>
}
