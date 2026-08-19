import type { LatLngPoint } from './types'

export type RouteProfile = 'driving' | 'cycling' | 'walking'

const ROUTE_FETCH_TIMEOUT_MS = 10000

const PROFILE_PATH: Record<RouteProfile, string> = {
  driving: 'driving',
  cycling: 'cycling',
  walking: 'foot',
}

export interface RouteResult {
  coordinates: LatLngPoint[]
  distanceMeters: number
  durationSeconds: number
}

export async function fetchRoute(
  points: LatLngPoint[],
  profile: RouteProfile,
  signal?: AbortSignal,
): Promise<RouteResult | null> {
  if (points.length < 2) return null

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/${PROFILE_PATH[profile]}/${coords}?overview=full&geometries=geojson`

  // Compose the caller's cancellation signal with our own timeout, so a
  // hung request (accepted but never answered) can't leave the UI stuck
  // in a "finding route" state forever.
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), ROUTE_FETCH_TIMEOUT_MS)
  const onExternalAbort = () => timeoutController.abort()
  signal?.addEventListener('abort', onExternalAbort)

  try {
    const res = await fetch(url, { signal: timeoutController.signal })
    if (!res.ok) return null

    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.[0]) return null

    const route = data.routes[0]
    const coordinates: LatLngPoint[] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng }),
    )

    return { coordinates, distanceMeters: route.distance, durationSeconds: route.duration }
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}
