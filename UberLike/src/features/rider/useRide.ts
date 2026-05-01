import { useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { getRealtimeAdapter } from '@/realtime'
import { useRideStore } from '@/store/rideStore'
import { useApiModeStore } from '@/store/apiModeStore'
import { useSessionStore } from '@/store/sessionStore'
import { toast } from '@/shared/ui/Toast'

export function useRideTypes() {
  return useQuery({ queryKey: ['rideTypes'], queryFn: () => apiClient.getRideTypes(), staleTime: Infinity })
}

export function useLocationSearch(query: string) {
  return useQuery({
    queryKey: ['locations', query],
    queryFn: () => apiClient.searchLocations(query),
    enabled: query.length > 1,
    staleTime: 30_000,
  })
}

export function useEstimates() {
  const { pickupLocation, destinationLocation, setFareEstimates } = useRideStore()
  const q = useQuery({
    queryKey: ['estimates', pickupLocation?.id, destinationLocation?.id],
    queryFn: () => apiClient.getEstimates({
      pickupPoint: pickupLocation!.point,
      destinationPoint: destinationLocation!.point,
    }),
    enabled: !!pickupLocation && !!destinationLocation,
    staleTime: 60_000,
  })
  useEffect(() => { if (q.data) setFareEstimates(q.data) }, [q.data, setFareEstimates])
  return q
}

export function useRequestRide() {
  const store = useRideStore()
  const { pushEvent } = useApiModeStore()
  const { userId } = useSessionStore()

  return useMutation({
    mutationFn: () => {
      if (!store.pickupLocation || !store.destinationLocation || !store.selectedRideTypeId)
        throw new Error('Missing booking inputs')
      return apiClient.createRide({
        pickupId: store.pickupLocation.id,
        destinationId: store.destinationLocation.id,
        rideTypeId: store.selectedRideTypeId,
        idempotencyKey: store.idempotencyKey,
      })
    },
    onSuccess: (ride) => {
      store.setCurrentRide(ride)
      store.setRidePhase('matching')
      pushEvent({ direction: 'out', type: 'ride.requested', payload: { rideId: ride.id } })
      getRealtimeAdapter().send('ride.requested', { rideId: ride.id })
      store.regenerateIdempotencyKey()
    },
  })
}

export function useCancelRide() {
  const { currentRide, setRidePhase, setCurrentRide, setCancelReason, setAssignedDriver } = useRideStore()
  const { pushEvent } = useApiModeStore()

  return useMutation({
    mutationFn: (reason: string) => {
      if (!currentRide) throw new Error('No active ride')
      return apiClient.cancelRide(currentRide.id, { reason })
    },
    onSuccess: (ride, reason) => {
      setCurrentRide(ride)
      setRidePhase('cancelled')
      setCancelReason(reason)
      pushEvent({ direction: 'out', type: 'ride.cancel.requested', payload: { rideId: ride.id, reason } })
      getRealtimeAdapter().send('ride.cancel.requested', { rideId: ride.id, reason })
      setTimeout(() => {
        setRidePhase('booking')
        setCurrentRide(null)
        setAssignedDriver(null)
      }, 3000)
    },
  })
}

export function useRideEvents(rideId: string | undefined) {
  return useQuery({
    queryKey: ['rideEvents', rideId],
    queryFn: () => apiClient.getRideEvents(rideId!),
    enabled: !!rideId,
    refetchInterval: 5000,
  })
}

export function useRiderRealtime() {
  const store = useRideStore()
  const { pushEvent, setConnectionStatus } = useApiModeStore()
  const { userId } = useSessionStore()
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const adapter = getRealtimeAdapter()
    const unsubs: (() => void)[] = []

    unsubs.push(adapter.onStatusChange(setConnectionStatus))
    adapter.connect(`rider/${userId}`)

    unsubs.push(adapter.on('nearby.drivers.updated', ({ drivers }) => {
      store.setNearbyDrivers(drivers)
    }))

    unsubs.push(adapter.on('demand.updated', ({ cells }) => {
      store.setDemandCells(cells)
      pushEvent({ direction: 'in', type: 'demand.updated', payload: { count: cells.length } })
    }))

    unsubs.push(adapter.on('pricing.updated', ({ rideTypeId, surgeMultiplier }) => {
      store.setSurgeMultiplier(rideTypeId, surgeMultiplier)
    }))

    unsubs.push(adapter.on('ride.matching.started', ({ rideId }) => {
      pushEvent({ direction: 'in', type: 'ride.matching.started', payload: { rideId } })
      store.setMatchingProgress(0)
      if (progressTimer.current) clearInterval(progressTimer.current)
      progressTimer.current = setInterval(() => {
        store.setMatchingProgress(Math.min(95, store.matchingProgress + 3))
      }, 150)
    }))

    unsubs.push(adapter.on('ride.matched', ({ rideId, driver }) => {
      store.setAssignedDriver(driver)
      store.setMatchingProgress(100)
      if (progressTimer.current) clearInterval(progressTimer.current)
      pushEvent({ direction: 'in', type: 'ride.matched', payload: { rideId, driverId: driver.id } })
      toast('Driver found!', 'success', `${driver.name} · ${driver.vehicle.make} ${driver.vehicle.model}`)
    }))

    unsubs.push(adapter.on('ride.status.updated', ({ rideId, status }) => {
      store.updateRideStatus(rideId, status)
      if (status === 'driver_assigned' || status === 'driver_arriving' || status === 'pickup' || status === 'in_progress') {
        store.setRidePhase('active')
      }
      if (status === 'completed') store.setRidePhase('completed')
      if (status === 'cancelled') { store.setRidePhase('cancelled'); setTimeout(() => { store.setRidePhase('booking'); store.setCurrentRide(null) }, 4000) }
      pushEvent({ direction: 'in', type: 'ride.status.updated', payload: { rideId, status } })

      if (status === 'driver_arriving') toast('Driver on the way!', 'info', 'Your driver is heading to pickup')
      if (status === 'pickup')          toast('Driver arrived', 'success', 'Your driver is waiting at pickup')
      if (status === 'in_progress')     toast('Trip started', 'info', 'Enjoy your ride!')
      if (status === 'completed')       toast('Ride complete!', 'success', 'Thank you for riding with us')
      if (status === 'cancelled')       toast('Ride cancelled', 'error')
    }))

    unsubs.push(adapter.on('ride.completed', ({ rideId, finalFare }) => {
      if (store.currentRide?.id === rideId) {
        store.setCurrentRide({ ...store.currentRide, finalFare, status: 'completed' })
      }
    }))

    unsubs.push(adapter.on('ride.cancelled', ({ rideId, reason }) => {
      pushEvent({ direction: 'in', type: 'ride.cancelled', payload: { rideId, reason } })
    }))

    unsubs.push(adapter.on('driver.location.updated', ({ driverId, location }) => {
      store.setNearbyDrivers(
        store.nearbyDrivers.map((d) => d.id === driverId ? { ...d, location } : d)
      )
    }))

    return () => { unsubs.forEach((u) => u()); if (progressTimer.current) clearInterval(progressTimer.current) }
  }, [userId])
}
