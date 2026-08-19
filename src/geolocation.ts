import { Geolocation } from '@capacitor/geolocation'
import type { LatLngPoint } from './types'

export async function ensureLocationPermission(): Promise<boolean> {
  const status = await Geolocation.checkPermissions()
  if (status.location === 'granted') return true
  const requested = await Geolocation.requestPermissions()
  return requested.location === 'granted'
}

export async function getCurrentPoint(): Promise<LatLngPoint> {
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true })
  return { lat: pos.coords.latitude, lng: pos.coords.longitude }
}

export interface GeoSample {
  point: LatLngPoint
  speedMps: number | null
  timestamp: number
}

export async function watchPoint(
  onSample: (s: GeoSample) => void,
  onError: (err: unknown) => void,
): Promise<string> {
  return Geolocation.watchPosition({ enableHighAccuracy: true }, (position, err) => {
    if (err) {
      onError(err)
      return
    }
    if (position) {
      onSample({
        point: { lat: position.coords.latitude, lng: position.coords.longitude },
        speedMps: position.coords.speed ?? null,
        timestamp: position.timestamp,
      })
    }
  })
}

export async function clearPointWatch(watchId: string): Promise<void> {
  await Geolocation.clearWatch({ id: watchId })
}
