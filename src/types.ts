export interface LatLngPoint {
  lat: number
  lng: number
}

export interface SavedTrack {
  id: string
  name: string
  a: LatLngPoint
  b: LatLngPoint
  waypoints: LatLngPoint[]
  distanceMeters: number
  createdAt: number
}

export type EditMode = 'idle' | 'a' | 'b' | 'waypoint'
