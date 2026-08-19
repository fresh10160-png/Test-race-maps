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

export async function watchPoint(
  onPoint: (p: LatLngPoint) => void,
  onError: (err: unknown) => void,
): Promise<string> {
  return Geolocation.watchPosition({ enableHighAccuracy: true }, (position, err) => {
    if (err) {
      onError(err)
      return
    }
    if (position) {
      onPoint({ lat: position.coords.latitude, lng: position.coords.longitude })
    }
  })
}

export async function clearPointWatch(watchId: string): Promise<void> {
  await Geolocation.clearWatch({ id: watchId })
}
