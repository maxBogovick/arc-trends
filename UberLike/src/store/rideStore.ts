import { create } from 'zustand'
import type { Location, FareEstimate, Ride, Driver, GeoPoint, DemandCell } from '@/shared/types'
import { uid } from '@/shared/utils/time'

export type RidePhase = 'booking' | 'matching' | 'active' | 'completed' | 'cancelled'

interface RideState {
  // Booking form
  pickupLocation: Location | null
  destinationLocation: Location | null
  selectedRideTypeId: string | null
  fareEstimates: FareEstimate[]
  idempotencyKey: string

  // Active ride
  currentRide: Ride | null
  ridePhase: RidePhase
  assignedDriver: Driver | null
  matchingProgress: number // 0-100
  cancelReason: string

  // Map / drivers
  nearbyDrivers: Driver[]
  riderLocation: GeoPoint
  demandCells: DemandCell[]
  surgeMultipliers: Record<string, number>

  // Driver console
  incomingRideRequest: Ride | null
  driverOnline: boolean
  currentDriverRide: Ride | null

  // Actions
  setPickup(loc: Location | null): void
  setDestination(loc: Location | null): void
  setSelectedRideType(id: string | null): void
  setFareEstimates(estimates: FareEstimate[]): void
  setCurrentRide(ride: Ride | null): void
  setRidePhase(phase: RidePhase): void
  setAssignedDriver(driver: Driver | null): void
  setMatchingProgress(p: number): void
  setCancelReason(r: string): void
  setNearbyDrivers(drivers: Driver[]): void
  setRiderLocation(p: GeoPoint): void
  setDemandCells(cells: DemandCell[]): void
  setSurgeMultiplier(rideTypeId: string, multiplier: number): void
  regenerateIdempotencyKey(): void
  setIncomingRideRequest(ride: Ride | null): void
  setDriverOnline(online: boolean): void
  setCurrentDriverRide(ride: Ride | null): void
  updateRideStatus(rideId: string, status: Ride['status']): void
}

export const useRideStore = create<RideState>()((set) => ({
  pickupLocation: null,
  destinationLocation: null,
  selectedRideTypeId: null,
  fareEstimates: [],
  idempotencyKey: uid(),

  currentRide: null,
  ridePhase: 'booking',
  assignedDriver: null,
  matchingProgress: 0,
  cancelReason: '',

  nearbyDrivers: [],
  riderLocation: { lat: 47.0228, lng: 28.8353 },
  demandCells: [],
  surgeMultipliers: {},

  incomingRideRequest: null,
  driverOnline: false,
  currentDriverRide: null,

  setPickup: (pickupLocation) => set({ pickupLocation }),
  setDestination: (destinationLocation) => set({ destinationLocation }),
  setSelectedRideType: (selectedRideTypeId) => set({ selectedRideTypeId }),
  setFareEstimates: (fareEstimates) => set({ fareEstimates }),
  setCurrentRide: (currentRide) => set({ currentRide }),
  setRidePhase: (ridePhase) => set({ ridePhase }),
  setAssignedDriver: (assignedDriver) => set({ assignedDriver }),
  setMatchingProgress: (matchingProgress) => set({ matchingProgress }),
  setCancelReason: (cancelReason) => set({ cancelReason }),
  setNearbyDrivers: (nearbyDrivers) => set({ nearbyDrivers }),
  setRiderLocation: (riderLocation) => set({ riderLocation }),
  setDemandCells: (demandCells) => set({ demandCells }),
  setSurgeMultiplier: (rideTypeId, multiplier) =>
    set((s) => ({ surgeMultipliers: { ...s.surgeMultipliers, [rideTypeId]: multiplier } })),
  regenerateIdempotencyKey: () => set({ idempotencyKey: uid() }),
  setIncomingRideRequest: (incomingRideRequest) => set({ incomingRideRequest }),
  setDriverOnline: (driverOnline) => set({ driverOnline }),
  setCurrentDriverRide: (currentDriverRide) => set({ currentDriverRide }),
  updateRideStatus: (rideId, status) =>
    set((s) => ({
      currentRide: s.currentRide?.id === rideId ? { ...s.currentRide, status } : s.currentRide,
      currentDriverRide: s.currentDriverRide?.id === rideId ? { ...s.currentDriverRide, status } : s.currentDriverRide,
    })),
}))
