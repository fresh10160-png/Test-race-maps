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
  profile?: 'driving' | 'cycling' | 'walking'
  recorded?: boolean
  routeCoordinates?: LatLngPoint[]
}

export type EditMode = 'idle' | 'a' | 'b' | 'waypoint'
