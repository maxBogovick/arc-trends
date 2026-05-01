export type UserRole = 'rider' | 'driver' | 'admin'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface Location {
  id: string
  label: string
  address: string
  point: GeoPoint
}

export interface User {
  id: string
  name: string
  role: UserRole
  phone?: string
  rating?: number
}

export interface Vehicle {
  make: string
  model: string
  plate: string
  color: string
  capacity: number
}

export type DriverAvailability = 'offline' | 'available' | 'busy'

export interface Driver {
  id: string
  name: string
  avatarColor: string
  rating: number
  vehicle: Vehicle
  location: GeoPoint
  availability: DriverAvailability
  currentRideId?: string | null
}

export interface RideType {
  id: string
  name: string
  description: string
  capacity: number
  baseFare: number
  pricePerKm: number
  pricePerMinute: number
  etaMinutes: number
  icon: string
}

export interface FareEstimate {
  rideTypeId: string
  currency: string
  minFare: number
  maxFare: number
  distanceKm: number
  durationMinutes: number
  surgeMultiplier: number
  expiresAt: string
}

export type RideStatus =
  | 'requested'
  | 'matching'
  | 'driver_assigned'
  | 'driver_arriving'
  | 'pickup'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface Ride {
  id: string
  riderId: string
  driverId?: string | null
  status: RideStatus
  pickup: Location
  destination: Location
  rideTypeId: string
  estimate: FareEstimate
  finalFare?: number | null
  route: GeoPoint[]
  createdAt: string
  updatedAt: string
  cancellationReason?: string | null
}

export interface RideEvent {
  id: string
  rideId: string
  type: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface DemandCell {
  id: string
  center: GeoPoint
  intensity: number
  surgeMultiplier: number
}

export interface AdminMetrics {
  activeRides: number
  availableDrivers: number
  avgWaitMinutes: number
  cancellationRate: number
  completedToday: number
}

export type ApiMode = 'mock' | 'real'
export type ConnectionStatus = 'mock' | 'connecting' | 'connected' | 'offline' | 'error'

export interface RequestLog {
  id: string
  method: string
  path: string
  status: number
  durationMs: number
  ts: string
}

export interface EventLog {
  id: string
  direction: 'in' | 'out'
  type: string
  payload: unknown
  ts: string
}
