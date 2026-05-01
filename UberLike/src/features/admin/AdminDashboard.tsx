import { useState } from 'react'
import {
  Car, Users, Clock, TrendingUp, CheckCircle2, RefreshCw, Zap,
  ArrowUp, ArrowDown, BarChart3, Map, List,
} from 'lucide-react'
import { CityMap } from '@/features/maps/CityMap'
import { useAdminRides, useAdminDrivers, useAdminMetrics, useAdminDemand, useAdminRealtime } from './useAdmin'
import { useRideStore } from '@/store/rideStore'
import { useApiModeStore } from '@/store/apiModeStore'
import { RideStatusBadge, DriverStatusBadge } from '@/shared/ui/Badge'
import { formatCurrency, formatDistanceToNow } from '@/shared/utils/time'
import type { RideStatus } from '@/shared/types'

const STATUS_FILTERS: { label: string; value: RideStatus | 'all' }[] = [
  { label: 'All',        value: 'all'            },
  { label: 'Active',     value: 'in_progress'    },
  { label: 'Matching',   value: 'matching'       },
  { label: 'Arriving',   value: 'driver_arriving'},
  { label: 'Completed',  value: 'completed'      },
  { label: 'Cancelled',  value: 'cancelled'      },
]

interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  iconBg: string
  trend?: number
}

function MetricCard({ label, value, sub, icon, iconBg, trend }: MetricCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-card hover:shadow-elevated transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
            trend >= 0 ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
          }`}>
            {trend >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-slate-400 text-xs font-medium">{label}</p>
        <p className="text-slate-900 font-black text-2xl mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
        active
          ? 'border-brand-600 text-brand-700'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function RideRow({ ride }: { ride: ReturnType<typeof useAdminRides>['data'] extends (infer T)[] | undefined ? T : never }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td className="px-5 py-3.5">
        <code className="text-slate-400 text-xs font-mono bg-slate-50 px-2 py-0.5 rounded group-hover:bg-white">
          {ride.id.slice(-8)}
        </code>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <p className="text-slate-800 text-sm font-medium truncate max-w-[140px]">{ride.pickup.label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              <p className="text-slate-400 text-xs truncate max-w-[140px]">{ride.destination.label}</p>
            </div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-slate-500 text-xs capitalize bg-slate-100 px-2 py-1 rounded-lg">{ride.rideTypeId}</span>
      </td>
      <td className="px-5 py-3.5">
        <RideStatusBadge status={ride.status} />
      </td>
      <td className="px-5 py-3.5 text-slate-500 text-xs tabular-nums whitespace-nowrap">
        {formatDistanceToNow(ride.createdAt)}
      </td>
      <td className="px-5 py-3.5 text-right">
        {ride.finalFare ? (
          <span className="text-brand-700 font-bold text-sm">{formatCurrency(ride.finalFare)}</span>
        ) : (
          <span className="text-slate-300 text-sm">—</span>
        )}
      </td>
    </tr>
  )
}

export function AdminDashboard() {
  useAdminRealtime()

  const [statusFilter, setStatusFilter] = useState<RideStatus | 'all'>('all')
  const [activeTab, setActiveTab] = useState<'rides' | 'drivers' | 'map'>('rides')

  const { data: rides, isFetching: ridesLoading, refetch: refetchRides } = useAdminRides()
  const { data: drivers } = useAdminDrivers()
  const { data: metrics } = useAdminMetrics()
  const { data: demandCells } = useAdminDemand()
  const { nearbyDrivers, eventLog } = { ...useRideStore(), eventLog: useApiModeStore().eventLog }

  const filteredRides = (rides ?? []).filter((r) => statusFilter === 'all' || r.status === statusFilter)
  const mapDrivers = drivers ?? nearbyDrivers ?? []

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      {/* Metrics */}
      <div className="px-6 pt-5 pb-1 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-slate-900 font-bold text-xl">Operations Dashboard</h1>
            <p className="text-slate-400 text-sm mt-0.5">Real-time platform overview</p>
          </div>
          <button
            onClick={() => refetchRides()}
            className="flex items-center gap-1.5 text-slate-500 text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors shadow-card"
          >
            <RefreshCw size={11} className={ridesLoading ? 'animate-spin text-brand-500' : ''} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Active Rides"
            value={metrics?.activeRides ?? '—'}
            icon={<Car size={16} className="text-brand-600" />}
            iconBg="bg-brand-50"
            trend={5}
          />
          <MetricCard
            label="Available Drivers"
            value={metrics?.availableDrivers ?? '—'}
            icon={<Users size={16} className="text-blue-600" />}
            iconBg="bg-blue-50"
            sub={`of ${drivers?.length ?? '?'} total`}
          />
          <MetricCard
            label="Avg. Wait Time"
            value={metrics ? `${metrics.avgWaitMinutes}m` : '—'}
            icon={<Clock size={16} className="text-amber-600" />}
            iconBg="bg-amber-50"
            trend={-8}
          />
          <MetricCard
            label="Cancel Rate"
            value={metrics ? `${Math.round(metrics.cancellationRate * 100)}%` : '—'}
            icon={<TrendingUp size={16} className="text-red-500" />}
            iconBg="bg-red-50"
            trend={-3}
          />
          <MetricCard
            label="Completed Today"
            value={metrics?.completedToday ?? '—'}
            icon={<CheckCircle2 size={16} className="text-green-600" />}
            iconBg="bg-green-50"
            trend={12}
          />
        </div>
      </div>

      {/* Tabs + content */}
      <div className="flex-1 min-h-0 flex flex-col px-6 pb-4">
        <div className="flex items-center border-b border-slate-200 bg-white rounded-t-2xl mt-4 px-2">
          <TabButton active={activeTab === 'rides'}   onClick={() => setActiveTab('rides')}   icon={<List      size={14} />} label="Rides"   />
          <TabButton active={activeTab === 'drivers'} onClick={() => setActiveTab('drivers')} icon={<Car       size={14} />} label="Drivers" />
          <TabButton active={activeTab === 'map'}     onClick={() => setActiveTab('map')}     icon={<Map       size={14} />} label="Live Map"/>

          <div className="ml-auto flex items-center gap-2 pr-2 pb-2">
            {ridesLoading && (
              <span className="flex items-center gap-1.5 text-xs text-brand-600 font-medium">
                <RefreshCw size={10} className="animate-spin" />Syncing
              </span>
            )}
            <span className="text-slate-300 text-xs tabular-nums">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {/* === RIDES TAB === */}
        {activeTab === 'rides' && (
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-b-2xl border border-t-0 border-slate-100 shadow-card overflow-hidden">
            {/* Status filter */}
            <div className="flex gap-1.5 px-5 py-3 border-b border-slate-100 overflow-x-auto no-scrollbar shrink-0">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    statusFilter === f.value
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                  {f.value !== 'all' && (
                    <span className={`ml-1.5 ${statusFilter === f.value ? 'text-white/70' : 'text-slate-400'}`}>
                      {(rides ?? []).filter((r) => r.status === f.value).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {ridesLoading && filteredRides.length === 0 ? (
                <div className="p-5 space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr>
                      {['ID', 'Route', 'Type', 'Status', 'Time', 'Fare'].map((h) => (
                        <th key={h} className="px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRides.map((ride) => (
                      <RideRow key={ride.id} ride={ride} />
                    ))}
                  </tbody>
                </table>
              )}

              {filteredRides.length === 0 && !ridesLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <BarChart3 size={22} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-sm">No rides found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === DRIVERS TAB === */}
        {activeTab === 'drivers' && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-b-2xl border border-t-0 border-slate-100 shadow-card">
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(drivers ?? []).map((driver) => (
                  <div key={driver.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 hover:shadow-card transition-all">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm"
                      style={{ background: driver.avatarColor }}
                    >
                      {driver.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-900 font-semibold text-sm truncate">{driver.name}</span>
                        <span className="flex items-center gap-0.5 text-amber-500 text-xs">
                          <span>★</span>
                          <span>{driver.rating.toFixed(1)}</span>
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs truncate mt-0.5">
                        {driver.vehicle.make} {driver.vehicle.model} · <span className="font-mono">{driver.vehicle.plate}</span>
                      </p>
                    </div>
                    <DriverStatusBadge status={driver.availability} />
                  </div>
                ))}
                {(drivers ?? []).length === 0 && (
                  <div className="col-span-full flex flex-col items-center py-12 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Car size={22} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 text-sm">No drivers found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === MAP TAB === */}
        {activeTab === 'map' && (
          <div className="flex-1 min-h-0 flex overflow-hidden bg-white rounded-b-2xl border border-t-0 border-slate-100 shadow-card">
            <div className="flex-1 min-h-0 min-w-0 rounded-bl-2xl overflow-hidden">
              <CityMap
                drivers={mapDrivers}
                demandCells={demandCells ?? []}
              />
            </div>

            {/* Live event stream */}
            <div className="w-72 border-l border-slate-200 flex flex-col overflow-hidden hidden md:flex shrink-0">
              <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={13} className="text-brand-600" />
                  <span className="text-slate-700 text-xs font-semibold">Live Events</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-slate-400 text-[10px]">streaming</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {eventLog.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-slate-400 text-xs">Waiting for events…</p>
                  </div>
                )}
                {eventLog.map((e) => (
                  <div key={e.id} className="px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        e.direction === 'in'
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}>
                        {e.direction === 'in' ? '← IN' : '→ OUT'}
                      </span>
                      <span className="text-[9px] text-slate-400 tabular-nums ml-auto">
                        {new Date(e.ts).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-700 text-xs font-medium truncate">{e.type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
