import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { getRealtimeAdapter } from '@/realtime'
import { useApiModeStore } from '@/store/apiModeStore'
import { useRideStore } from '@/store/rideStore'

export function useAdminRides(status?: string) {
  return useQuery({
    queryKey: ['admin', 'rides', status],
    queryFn: () => apiClient.getAdminRides(),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}

export function useAdminDrivers() {
  return useQuery({
    queryKey: ['admin', 'drivers'],
    queryFn: () => apiClient.getAdminDrivers(),
    refetchInterval: 8_000,
    staleTime: 4_000,
  })
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: () => apiClient.getAdminMetrics(),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}

export function useAdminDemand() {
  return useQuery({
    queryKey: ['admin', 'demand'],
    queryFn: () => apiClient.getAdminDemand(),
    refetchInterval: 15_000,
    staleTime: 8_000,
  })
}

export function useAdminRealtime() {
  const { pushEvent, setConnectionStatus } = useApiModeStore()
  const { setDemandCells, setNearbyDrivers } = useRideStore()

  useEffect(() => {
    const adapter = getRealtimeAdapter()
    const unsubs: (() => void)[] = []

    unsubs.push(adapter.onStatusChange(setConnectionStatus))
    adapter.connect('admin')

    unsubs.push(adapter.on('demand.updated', ({ cells }) => {
      setDemandCells(cells)
      pushEvent({ direction: 'in', type: 'demand.updated', payload: { count: cells.length } })
    }))

    unsubs.push(adapter.on('admin.metrics.updated', ({ metrics }) => {
      pushEvent({ direction: 'in', type: 'admin.metrics.updated', payload: metrics })
    }))

    unsubs.push(adapter.on('nearby.drivers.updated', ({ drivers }) => {
      setNearbyDrivers(drivers)
    }))

    return () => unsubs.forEach((u) => u())
  }, [])
}
