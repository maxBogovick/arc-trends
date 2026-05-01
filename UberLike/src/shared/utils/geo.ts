import type { GeoPoint } from '@/shared/types'

// Chisinau city bounds
export const MAP_BOUNDS = {
  minLat: 46.960,
  maxLat: 47.075,
  minLng: 28.800,
  maxLng: 28.950,
}

export const MAP_CENTER: GeoPoint = { lat: 47.0228, lng: 28.8353 }

export function latlngToSvg(lat: number, lng: number, svgW: number, svgH: number) {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * svgW
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * svgH
  return { x, y }
}

export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sin_dLat = Math.sin(dLat / 2)
  const sin_dLng = Math.sin(dLng / 2)
  const h =
    sin_dLat * sin_dLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sin_dLng * sin_dLng
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function randomInBounds(): GeoPoint {
  return {
    lat: MAP_BOUNDS.minLat + Math.random() * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat),
    lng: MAP_BOUNDS.minLng + Math.random() * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng),
  }
}

export function clampToBounds(p: GeoPoint): GeoPoint {
  return {
    lat: Math.max(MAP_BOUNDS.minLat + 0.002, Math.min(MAP_BOUNDS.maxLat - 0.002, p.lat)),
    lng: Math.max(MAP_BOUNDS.minLng + 0.002, Math.min(MAP_BOUNDS.maxLng - 0.002, p.lng)),
  }
}

export function moveToward(from: GeoPoint, to: GeoPoint, speed: number): GeoPoint {
  const dlat = to.lat - from.lat
  const dlng = to.lng - from.lng
  const dist = Math.sqrt(dlat * dlat + dlng * dlng)
  if (dist < speed) return to
  return { lat: from.lat + (dlat / dist) * speed, lng: from.lng + (dlng / dist) * speed }
}

export function generateRoute(from: GeoPoint, to: GeoPoint, steps = 6): GeoPoint[] {
  const route: GeoPoint[] = [from]
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    route.push({
      lat: from.lat + (to.lat - from.lat) * t + (Math.random() - 0.5) * 0.003,
      lng: from.lng + (to.lng - from.lng) * t + (Math.random() - 0.5) * 0.003,
    })
  }
  route.push(to)
  return route
}

export function isInBounds(p: GeoPoint): boolean {
  return p.lat >= MAP_BOUNDS.minLat && p.lat <= MAP_BOUNDS.maxLat &&
         p.lng >= MAP_BOUNDS.minLng && p.lng <= MAP_BOUNDS.maxLng
}
