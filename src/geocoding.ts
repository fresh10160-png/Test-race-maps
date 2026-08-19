import type { LatLngPoint } from './types'

const GEOCODE_TIMEOUT_MS = 10000

export interface GeocodeResult {
  point: LatLngPoint
  label: string
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`

  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), GEOCODE_TIMEOUT_MS)
  const onExternalAbort = () => timeoutController.abort()
  signal?.addEventListener('abort', onExternalAbort)

  try {
    const res = await fetch(url, { signal: timeoutController.signal })
    if (!res.ok) return []

    const data = await res.json()
    if (!Array.isArray(data)) return []

    return data.map((entry: { lat: string; lon: string; display_name: string }) => ({
      point: { lat: Number(entry.lat), lng: Number(entry.lon) },
      label: entry.display_name,
    }))
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}
