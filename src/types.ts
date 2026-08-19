export interface LatLngPoint {
  lat: number
  lng: number
}

export interface LapRecord {
  id: string
  durationSeconds: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  maxGForce: number
  completedAt: number
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
  durationSeconds?: number
  avgSpeedKmh?: number
  maxSpeedKmh?: number
  maxGForce?: number
  laps?: LapRecord[]
}

export type EditMode = 'idle' | 'a' | 'b' | 'waypoint'
