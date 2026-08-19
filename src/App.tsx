import { useEffect, useMemo, useRef, useState } from 'react'
import MapView from './MapView'
import { formatDistance, haversineDistance, pathDistance } from './geo'
import {
  clearPointWatch,
  ensureLocationPermission,
  getCurrentPoint,
  watchPoint,
} from './geolocation'
import { loadTracks, saveTracks } from './storage'
import type { EditMode, LatLngPoint, SavedTrack } from './types'
import './app.css'

const MIN_RECORD_DISTANCE_M = 8
const MOBILE_QUERY = '(max-width: 720px)'

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function App() {
  const [mode, setMode] = useState<EditMode>('a')
  const [a, setA] = useState<LatLngPoint | null>(null)
  const [b, setB] = useState<LatLngPoint | null>(null)
  const [waypoints, setWaypoints] = useState<LatLngPoint[]>([])
  const [tracks, setTracks] = useState<SavedTrack[]>(() => loadTracks())
  const [trackName, setTrackName] = useState('')
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)

  const [recording, setRecording] = useState(false)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [myLocation, setMyLocation] = useState<LatLngPoint | null>(null)
  const [flyToRequestId, setFlyToRequestId] = useState(0)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [panelExpanded, setPanelExpanded] = useState(
    () => typeof window === 'undefined' || !window.matchMedia(MOBILE_QUERY).matches,
  )
  const watchIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [recording])

  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        clearPointWatch(watchIdRef.current)
      }
    }
  }, [])

  const distanceMeters = useMemo(() => {
    const pts: LatLngPoint[] = []
    if (a) pts.push(a)
    pts.push(...waypoints)
    if (b) pts.push(b)
    return pathDistance(pts)
  }, [a, b, waypoints])

  function handleMapClick(p: LatLngPoint) {
    if (mode === 'a') {
      setA(p)
      setMode(b ? 'idle' : 'b')
    } else if (mode === 'b') {
      setB(p)
      setMode('idle')
    } else if (mode === 'waypoint') {
      setWaypoints((prev) => [...prev, p])
    }
  }

  function handleRemoveWaypoint(index: number) {
    setWaypoints((prev) => prev.filter((_, i) => i !== index))
  }

  function handleClearTrack() {
    setA(null)
    setB(null)
    setWaypoints([])
    setTrackName('')
    setActiveTrackId(null)
    setMode('a')
  }

  function handleUndoWaypoint() {
    setWaypoints((prev) => prev.slice(0, -1))
  }

  function handleSaveTrack(e: React.FormEvent) {
    e.preventDefault()
    if (!a || !b) return
    const name = trackName.trim() || `Track ${tracks.length + 1}`

    const record: SavedTrack = {
      id: activeTrackId ?? makeId(),
      name,
      a,
      b,
      waypoints,
      distanceMeters,
      createdAt: Date.now(),
    }

    setTracks((prev) => {
      const exists = prev.some((t) => t.id === record.id)
      const next = exists
        ? prev.map((t) => (t.id === record.id ? record : t))
        : [record, ...prev]
      saveTracks(next)
      return next
    })
    setActiveTrackId(record.id)
    setTrackName(name)
  }

  function handleLoadTrack(track: SavedTrack) {
    setA(track.a)
    setB(track.b)
    setWaypoints(track.waypoints)
    setTrackName(track.name)
    setActiveTrackId(track.id)
    setMode('idle')
  }

  function handleDeleteTrack(id: string) {
    if (!confirm('Delete this track?')) return
    setTracks((prev) => {
      const next = prev.filter((t) => t.id !== id)
      saveTracks(next)
      return next
    })
    if (activeTrackId === id) {
      handleClearTrack()
    }
  }

  async function handleLocateMe() {
    setLocationError(null)
    try {
      const granted = await ensureLocationPermission()
      if (!granted) {
        setLocationError('Location permission was not granted.')
        return
      }
      const point = await getCurrentPoint()
      setMyLocation(point)
      setFlyToRequestId((n) => n + 1)
    } catch {
      setLocationError('Could not get your location.')
    }
  }

  async function handleStartRecording() {
    setLocationError(null)
    const granted = await ensureLocationPermission()
    if (!granted) {
      setLocationError('Location permission was not granted.')
      return
    }
    try {
      const start = await getCurrentPoint()
      setA(start)
      setB(null)
      setWaypoints([])
      setTrackName('')
      setActiveTrackId(null)
      setMyLocation(start)
      setFlyToRequestId((n) => n + 1)
      setMode('idle')
      setRecording(true)
      setRecordingStartedAt(Date.now())

      const id = await watchPoint(
        (p) => {
          setLocationError(null)
          setMyLocation(p)
          setWaypoints((prev) => {
            const last = prev.length > 0 ? prev[prev.length - 1] : start
            if (haversineDistance(last, p) < MIN_RECORD_DISTANCE_M) return prev
            return [...prev, p]
          })
        },
        () => setLocationError('Error while tracking your location.'),
      )
      watchIdRef.current = id
    } catch {
      setLocationError('Could not get your location. Check that GPS is turned on.')
      setRecording(false)
    }
  }

  async function handleStopRecording() {
    setRecording(false)
    setRecordingStartedAt(null)
    if (watchIdRef.current) {
      await clearPointWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    try {
      const end = await getCurrentPoint()
      setLocationError(null)
      setB(end)
      setMyLocation(end)
    } catch {
      setWaypoints((prev) => {
        if (prev.length === 0) return prev
        setB(prev[prev.length - 1])
        return prev.slice(0, -1)
      })
    }
  }

  const canSave = a !== null && b !== null
  const elapsedMs = recordingStartedAt ? now - recordingStartedAt : 0

  return (
    <div className="app-shell">
      <aside className={`sidebar ${panelExpanded ? 'expanded' : 'collapsed'}`}>
        <button
          type="button"
          className="sidebar-handle"
          onClick={() => setPanelExpanded((v) => !v)}
        >
          <span className="handle-grip" />
          <span className="handle-title">🏁 RACE MAPS</span>
          <span className="handle-chevron">{panelExpanded ? '▾' : '▴'}</span>
        </button>

        <div className="sidebar-body">
          <p className="sidebar-subtitle">
            Tag your track's start (A) and finish (B), optionally shape the route, then save it.
          </p>
          <div className="checkered-strip" />

          <section className="record-panel">
            {!recording ? (
              <button type="button" className="record-btn" onClick={handleStartRecording}>
                🔴 Record a live ride
              </button>
            ) : (
              <div className="recording-active">
                <button type="button" className="record-btn recording" onClick={handleStopRecording}>
                  ⏹ Stop recording
                </button>
                <div className="recording-stats">
                  <span className="pulse-dot" />
                  <span className="stat-readout">
                    {formatElapsed(elapsedMs)} · {formatDistance(distanceMeters)}
                  </span>
                </div>
              </div>
            )}
            {locationError && <div className="location-error">{locationError}</div>}
          </section>

          <section className="toolbar">
            <button
              type="button"
              className={`tool-btn tag-a ${mode === 'a' ? 'active' : ''}`}
              onClick={() => setMode('a')}
              disabled={recording}
            >
              🅰️ Set start
            </button>
            <button
              type="button"
              className={`tool-btn tag-b ${mode === 'b' ? 'active' : ''}`}
              onClick={() => setMode('b')}
              disabled={recording}
            >
              🏁 Set finish
            </button>
            <button
              type="button"
              className={`tool-btn ${mode === 'waypoint' ? 'active' : ''}`}
              onClick={() => setMode('waypoint')}
              disabled={recording}
            >
              ➕ Add route point
            </button>
          </section>

          <section className="status-panel">
            <div className="status-row">
              <span className={`dot ${a ? 'set' : ''}`} />
              Start (A): {a ? `${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}` : 'not set'}
            </div>
            <div className="status-row">
              <span className={`dot dot-b ${b ? 'set' : ''}`} />
              Finish (B): {b ? `${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}` : 'not set'}
            </div>
            <div className="status-row">
              📏 Track length: <strong className="stat-readout">{formatDistance(distanceMeters)}</strong>
            </div>
            {waypoints.length > 0 && (
              <div className="status-row muted">
                {waypoints.length} extra point{waypoints.length === 1 ? '' : 's'}
                {!recording && ' · tap a point on the map to remove it'}
              </div>
            )}
          </section>

          <section className="actions-row">
            <button
              type="button"
              className="ghost-btn"
              onClick={handleUndoWaypoint}
              disabled={waypoints.length === 0 || recording}
            >
              ↩️ Undo last point
            </button>
            <button type="button" className="ghost-btn danger" onClick={handleClearTrack} disabled={recording}>
              🗑️ New track
            </button>
          </section>

          <form className="save-form" onSubmit={handleSaveTrack}>
            <input
              type="text"
              placeholder="Track name (e.g. Sunday loop)"
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
            />
            <button type="submit" className="save-btn" disabled={!canSave}>
              💾 Save track
            </button>
          </form>

          <section className="tracks-list">
            <h2>Saved tracks ({tracks.length})</h2>
            {tracks.length === 0 && <p className="muted">No tracks saved yet.</p>}
            <ul>
              {tracks.map((t) => (
                <li key={t.id} className={t.id === activeTrackId ? 'active' : ''}>
                  <button type="button" className="track-item" onClick={() => handleLoadTrack(t)}>
                    <span className="track-name">{t.name}</span>
                    <span className="track-meta">{formatDistance(t.distanceMeters)}</span>
                  </button>
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => handleDeleteTrack(t.id)}
                    aria-label={`Delete ${t.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>

      <main className="map-pane">
        <MapView
          mode={mode}
          a={a}
          b={b}
          waypoints={waypoints}
          myLocation={myLocation}
          flyToRequestId={flyToRequestId}
          onMapClick={handleMapClick}
          onMoveA={setA}
          onMoveB={setB}
          onRemoveWaypoint={handleRemoveWaypoint}
        />
        <div className="map-hint">
          {recording && '🔴 Recording — following your ride live'}
          {!recording && mode === 'a' && 'Tap the map to set the start (A)'}
          {!recording && mode === 'b' && 'Tap the map to set the finish (B)'}
          {!recording && mode === 'waypoint' && 'Tap the map to add a route point'}
          {!recording && mode === 'idle' && 'Pick a tool to continue'}
        </div>
        <button type="button" className="locate-btn" onClick={handleLocateMe} aria-label="My location">
          📍
        </button>
      </main>
    </div>
  )
}
