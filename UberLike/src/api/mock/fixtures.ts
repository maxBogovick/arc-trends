import type { Driver, RideType, Location, Ride, RideEvent, DemandCell, AdminMetrics } from '@/shared/types'
import { generateRoute } from '@/shared/utils/geo'

export const MOCK_RIDE_TYPES: RideType[] = [
  { id: 'economy',  name: 'Economy',  description: 'Affordable everyday rides',   capacity: 4, baseFare: 15,  pricePerKm: 6,  pricePerMinute: 0.8, etaMinutes: 3, icon: 'car'     },
  { id: 'comfort',  name: 'Comfort',  description: 'Newer cars, more legroom',     capacity: 4, baseFare: 25,  pricePerKm: 9,  pricePerMinute: 1.2, etaMinutes: 5, icon: 'car'     },
  { id: 'xl',       name: 'XL',       description: 'Fits up to 6 passengers',      capacity: 6, baseFare: 35,  pricePerKm: 12, pricePerMinute: 1.5, etaMinutes: 7, icon: 'truck'   },
  { id: 'delivery', name: 'Delivery', description: 'Send a package across town',   capacity: 1, baseFare: 20,  pricePerKm: 7,  pricePerMinute: 1.0, etaMinutes: 4, icon: 'package' },
]

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4']
const MAKES  = [
  { make: 'Volkswagen', model: 'Passat' },   { make: 'Toyota',   model: 'Corolla' },
  { make: 'Renault',    model: 'Logan' },    { make: 'Skoda',    model: 'Octavia' },
  { make: 'Dacia',      model: 'Logan' },    { make: 'Hyundai',  model: 'Elantra' },
  { make: 'Kia',        model: 'Rio' },      { make: 'Ford',     model: 'Focus' },
]
const CAR_COLORS = ['White', 'Black', 'Silver', 'Gray', 'Blue', 'Beige']
const NAMES = [
  'Ion Popescu', 'Andrei Rusu', 'Mihai Cojocaru', 'Alexandru Munteanu', 'Valeriu Ionescu',
  'Dumitru Ababii', 'Sergiu Botnaru', 'Victor Ciobanu', 'Eugen Lungu', 'Tudor Morozan',
  'Radu Grigore', 'Cristian Popa', 'Vasile Balan', 'Octavian Rotaru', 'Stefan Enache',
  'Laurentiu Dima', 'Bogdan Sandu', 'Marius Luca', 'Florin Iliescu', 'Dan Costea',
]

function makePlate() {
  const regions = ['CU', 'CT', 'OR', 'FL', 'AN', 'HN', 'OC']
  const region = regions[Math.floor(Math.random() * regions.length)]
  const digits = String(Math.floor(100 + Math.random() * 900))
  const letters = 'ABCDEFGHJKLMNPRSTUVWXY'
  const l = () => letters[Math.floor(Math.random() * letters.length)]
  return `${region} ${digits} ${l()}${l()}`
}

// Drivers scattered around Chisinau
export const MOCK_DRIVERS: Driver[] = Array.from({ length: 20 }, (_, i) => {
  const car = MAKES[i % MAKES.length]
  const lat = 46.980 + Math.random() * 0.070
  const lng = 28.810 + Math.random() * 0.110
  return {
    id: `driver-${i + 1}`,
    name: NAMES[i],
    avatarColor: COLORS[i % COLORS.length],
    rating: 4.5 + Math.random() * 0.5,
    vehicle: {
      make: car.make, model: car.model,
      plate: makePlate(),
      color: CAR_COLORS[i % CAR_COLORS.length],
      capacity: i % 5 === 0 ? 6 : 4,
    },
    location: { lat, lng },
    availability: i < 14 ? 'available' : i < 17 ? 'busy' : 'offline',
    currentRideId: null,
  }
})

// Real Chisinau locations
export const MOCK_LOCATIONS: Location[] = [
  { id: 'loc-central',  label: 'Piața Centrală',          address: 'Piața Centrală, Chișinău',           point: { lat: 47.0219, lng: 28.8320 } },
  { id: 'loc-stefan',   label: 'Bd. Ștefan cel Mare',     address: 'Bd. Ștefan cel Mare 148, Chișinău',  point: { lat: 47.0265, lng: 28.8335 } },
  { id: 'loc-gara',     label: 'Gara Feroviară',          address: 'Alecu Russo 1, Chișinău',            point: { lat: 47.0082, lng: 28.8520 } },
  { id: 'loc-teatru',   label: 'Teatrul Național',        address: 'Bd. Ștefan cel Mare 79, Chișinău',   point: { lat: 47.0249, lng: 28.8294 } },
  { id: 'loc-dendrari', label: 'Parcul Dendrariu',        address: 'Str. Puskin 2, Chișinău',            point: { lat: 47.0352, lng: 28.8215 } },
  { id: 'loc-ciuperca', label: 'Ciuperca (Centru)',       address: 'Str. Mihai Eminescu, Chișinău',      point: { lat: 47.0234, lng: 28.8560 } },
  { id: 'loc-botanic',  label: 'Grădina Botanică',        address: 'Str. Pădurii 18, Chișinău',          point: { lat: 46.9995, lng: 28.8575 } },
  { id: 'loc-mall',     label: 'MallDova',                address: 'Str. Dacia 65, Chișinău',            point: { lat: 47.0186, lng: 28.8743 } },
  { id: 'loc-aerop',    label: 'Aeroport Chișinău',      address: 'Str. Aeroportului 80, Chișinău',     point: { lat: 46.9741, lng: 28.9309 } },
  { id: 'loc-asem',     label: 'ASEM',                   address: 'Str. Bănulescu-Bodoni 61, Chișinău', point: { lat: 47.0349, lng: 28.8392 } },
  { id: 'loc-utm',      label: 'Universitatea Tehnică',  address: 'Bd. Ștefan cel Mare 168, Chișinău',  point: { lat: 47.0165, lng: 28.8166 } },
  { id: 'loc-riscani',  label: 'Râșcani (Nord)',         address: 'Calea Orheiului, Chișinău',          point: { lat: 47.0483, lng: 28.8591 } },
  { id: 'loc-buiucani', label: 'Buiucani',               address: 'Str. Florilor, Chișinău',            point: { lat: 47.0400, lng: 28.8090 } },
  { id: 'loc-ciocana',  label: 'Ciocana',                address: 'Bd. Mircea cel Bătrân, Chișinău',    point: { lat: 47.0148, lng: 28.8950 } },
  { id: 'loc-moldexpo', label: 'Moldexpo',               address: 'Bd. Ghioceilor 1, Chișinău',         point: { lat: 47.0483, lng: 28.8591 } },
]

function ago(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

const _from = MOCK_LOCATIONS[1]   // Ștefan cel Mare
const _to   = MOCK_LOCATIONS[2]   // Gara

export const MOCK_RIDES: Ride[] = [
  {
    id: 'ride-001', riderId: 'user-1', driverId: 'driver-3', status: 'completed',
    pickup: _from, destination: _to, rideTypeId: 'economy',
    estimate: { rideTypeId: 'economy', currency: 'MDL', minFare: 45, maxFare: 55, distanceKm: 3.2, durationMinutes: 12, surgeMultiplier: 1.0, expiresAt: ago(-30) },
    finalFare: 49, route: generateRoute(_from.point, _to.point), createdAt: ago(45), updatedAt: ago(20),
  },
  {
    id: 'ride-002', riderId: 'user-2', driverId: 'driver-5', status: 'in_progress',
    pickup: MOCK_LOCATIONS[0], destination: MOCK_LOCATIONS[6], rideTypeId: 'comfort',
    estimate: { rideTypeId: 'comfort', currency: 'MDL', minFare: 80, maxFare: 100, distanceKm: 5.1, durationMinutes: 18, surgeMultiplier: 1.2, expiresAt: ago(-5) },
    finalFare: null, route: generateRoute(MOCK_LOCATIONS[0].point, MOCK_LOCATIONS[6].point), createdAt: ago(15), updatedAt: ago(3),
  },
  {
    id: 'ride-003', riderId: 'user-3', driverId: 'driver-7', status: 'driver_arriving',
    pickup: MOCK_LOCATIONS[3], destination: MOCK_LOCATIONS[7], rideTypeId: 'economy',
    estimate: { rideTypeId: 'economy', currency: 'MDL', minFare: 60, maxFare: 75, distanceKm: 4.0, durationMinutes: 15, surgeMultiplier: 1.0, expiresAt: ago(-2) },
    finalFare: null, route: generateRoute(MOCK_LOCATIONS[3].point, MOCK_LOCATIONS[7].point), createdAt: ago(8), updatedAt: ago(1),
  },
  {
    id: 'ride-004', riderId: 'user-4', driverId: 'driver-2', status: 'completed',
    pickup: MOCK_LOCATIONS[4], destination: MOCK_LOCATIONS[9], rideTypeId: 'xl',
    estimate: { rideTypeId: 'xl', currency: 'MDL', minFare: 120, maxFare: 150, distanceKm: 6.5, durationMinutes: 22, surgeMultiplier: 1.5, expiresAt: ago(-60) },
    finalFare: 135, route: generateRoute(MOCK_LOCATIONS[4].point, MOCK_LOCATIONS[9].point), createdAt: ago(70), updatedAt: ago(45),
  },
  {
    id: 'ride-005', riderId: 'user-1', driverId: null, status: 'cancelled',
    pickup: MOCK_LOCATIONS[11], destination: MOCK_LOCATIONS[5], rideTypeId: 'economy',
    estimate: { rideTypeId: 'economy', currency: 'MDL', minFare: 35, maxFare: 45, distanceKm: 2.3, durationMinutes: 10, surgeMultiplier: 1.0, expiresAt: ago(-90) },
    finalFare: null, route: [], createdAt: ago(100), updatedAt: ago(95), cancellationReason: 'Nu s-a găsit șofer',
  },
  {
    id: 'ride-006', riderId: 'user-6', driverId: 'driver-9', status: 'completed',
    pickup: MOCK_LOCATIONS[2], destination: MOCK_LOCATIONS[8], rideTypeId: 'comfort',
    estimate: { rideTypeId: 'comfort', currency: 'MDL', minFare: 180, maxFare: 220, distanceKm: 12.5, durationMinutes: 28, surgeMultiplier: 1.0, expiresAt: ago(-120) },
    finalFare: 195, route: generateRoute(MOCK_LOCATIONS[2].point, MOCK_LOCATIONS[8].point), createdAt: ago(150), updatedAt: ago(118),
  },
]

export const MOCK_EVENTS: RideEvent[] = [
  { id: 'ev-1', rideId: 'ride-001', type: 'ride.created',       payload: {},                            createdAt: ago(45) },
  { id: 'ev-2', rideId: 'ride-001', type: 'ride.matched',       payload: { driverId: 'driver-3' },      createdAt: ago(44) },
  { id: 'ev-3', rideId: 'ride-001', type: 'ride.status.updated',payload: { status: 'driver_assigned' }, createdAt: ago(44) },
  { id: 'ev-4', rideId: 'ride-001', type: 'ride.status.updated',payload: { status: 'driver_arriving' }, createdAt: ago(42) },
  { id: 'ev-5', rideId: 'ride-001', type: 'ride.status.updated',payload: { status: 'pickup' },          createdAt: ago(38) },
  { id: 'ev-6', rideId: 'ride-001', type: 'ride.status.updated',payload: { status: 'in_progress' },    createdAt: ago(36) },
  { id: 'ev-7', rideId: 'ride-001', type: 'ride.status.updated',payload: { status: 'completed' },      createdAt: ago(20) },
]

export const MOCK_DEMAND_CELLS: DemandCell[] = [
  { id: 'dc-1', center: { lat: 47.0219, lng: 28.8320 }, intensity: 0.90, surgeMultiplier: 1.8 },
  { id: 'dc-2', center: { lat: 47.0082, lng: 28.8520 }, intensity: 0.70, surgeMultiplier: 1.4 },
  { id: 'dc-3', center: { lat: 47.0265, lng: 28.8335 }, intensity: 0.55, surgeMultiplier: 1.2 },
  { id: 'dc-4', center: { lat: 47.0186, lng: 28.8743 }, intensity: 0.40, surgeMultiplier: 1.1 },
  { id: 'dc-5', center: { lat: 47.0349, lng: 28.8392 }, intensity: 0.75, surgeMultiplier: 1.5 },
  { id: 'dc-6', center: { lat: 46.9995, lng: 28.8575 }, intensity: 0.35, surgeMultiplier: 1.0 },
]

export const MOCK_METRICS: AdminMetrics = {
  activeRides: 5,
  availableDrivers: 14,
  avgWaitMinutes: 3.4,
  cancellationRate: 0.08,
  completedToday: 127,
}
