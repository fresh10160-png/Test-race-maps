import type { SavedTrack } from './types'

const STORAGE_KEY = 'race-maps.tracks.v1'

export function loadTracks(): SavedTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function saveTracks(tracks: SavedTrack[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks))
}
