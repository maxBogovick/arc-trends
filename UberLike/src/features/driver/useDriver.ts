import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { getRealtimeAdapter } from '@/realtime'
import { useRideStore } from '@/store/rideStore'
import { useApiModeStore } from '@/store/apiModeStore'
import type { RideStatus } from '@/shared/types'

const DRIVER_ID = 'driver-1'

export function useDriverOnlineToggle() {
  const { driverOnline, setDriverOnline } = useRideStore()
  const { pushEvent } = useApiModeStore()

  return useMutation({
    mutationFn: (online: boolean) => apiClient.setDriverAvailability(DRIVER_ID, online),
    onSuccess: (_, online) => {
      setDriverOnline(online)
      pushEvent({ direction: 'out', type: 'driver.availability.update', payload: { available: online } })
      getRealtimeAdapter().send('driver.availability.update', { available: online })
    },
  })
}

export function useDriverAcceptRide() {
  const { incomingRideRequest, setIncomingRideRequest, setCurrentDriverRide } = useRideStore()
  const { pushEvent } = useApiModeStore()

  return useMutation({
    mutationFn: () => {
      if (!incomingRideRequest) throw new Error('No incoming ride')
      return apiClient.acceptRide(DRIVER_ID, incomingRideRequest.id)
    },
    onSuccess: (ride) => {
      setCurrentDriverRide(ride)
      setIncomingRideRequest(null)
      pushEvent({ direction: 'out', type: 'driver.ride.accepted', payload: { rideId: ride.id } })
      getRealtimeAdapter().send('driver.ride.accepted', { rideId: ride.id })
    },
  })
}

export function useDriverRejectRide() {
  const { incomingRideRequest, setIncomingRideRequest } = useRideStore()
  const { pushEvent } = useApiModeStore()

  return useMutation({
    mutationFn: () => {
      if (!incomingRideRequest) throw new Error('No incoming ride')
      return apiClient.rejectRide(DRIVER_ID, incomingRideRequest.id)
    },
    onSuccess: () => {
      const rideId = incomingRideRequest?.id ?? ''
      setIncomingRideRequest(null)
      pushEvent({ direction: 'out', type: 'driver.ride.rejected', payload: { rideId } })
    },
  })
}

export function useUpdateRideStatus() {
  const { currentDriverRide, setCurrentDriverRide } = useRideStore()
  const { pushEvent } = useApiModeStore()

  return useMutation({
    mutationFn: (status: RideStatus) => {
      if (!currentDriverRide) throw new Error('No current ride')
      return apiClient.updateRideStatus(DRIVER_ID, currentDriverRide.id, { status })
    },
    onSuccess: (ride) => {
      setCurrentDriverRide(ride)
      pushEvent({ direction: 'out', type: 'driver.ride.status.update', payload: { rideId: ride.id, status: ride.status } })
      getRealtimeAdapter().send('driver.ride.status.update', { rideId: ride.id, status: ride.status })
      if (ride.status === 'completed') setTimeout(() => setCurrentDriverRide(null), 3000)
    },
  })
}

export function useDriverRealtime() {
  const { setIncomingRideRequest, updateRideStatus, setNearbyDrivers } = useRideStore()
  const { pushEvent, setConnectionStatus } = useApiModeStore()

  useEffect(() => {
    const adapter = getRealtimeAdapter()
    const unsubs: (() => void)[] = []

    unsubs.push(adapter.onStatusChange(setConnectionStatus))
    adapter.connect(`driver/${DRIVER_ID}`)

    unsubs.push(adapter.on('ride.incoming_request', ({ ride }) => {
      setIncomingRideRequest(ride)
      pushEvent({ direction: 'in', type: 'ride.incoming_request', payload: { rideId: ride.id } })
    }))

    unsubs.push(adapter.on('ride.status.updated', ({ rideId, status }) => {
      updateRideStatus(rideId, status)
      pushEvent({ direction: 'in', type: 'ride.status.updated', payload: { rideId, status } })
    }))

    unsubs.push(adapter.on('nearby.drivers.updated', ({ drivers }) => {
      setNearbyDrivers(drivers)
    }))

    return () => unsubs.forEach((u) => u())
  }, [])
}
