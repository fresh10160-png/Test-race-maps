import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { PluginListenerHandle } from '@capacitor/core'
import MapView from './MapView'
import { formatDistance, haversineDistance, pathDistance } from './geo'
import {
  clearPointWatch,
  ensureLocationPermission,
  getCurrentPoint,
  watchPoint,
  type GeoSample,
} from './geolocation'
import { watchGForce } from './motion'
import { fetchRoute, type RouteProfile } from './routing'
import { loadTracks, saveTracks } from './storage'
import type { EditMode, LapRecord, LatLngPoint, SavedTrack } from './types'
import './app.css'

const MIN_RECORD_DISTANCE_M = 8
const ROUTE_DEBOUNCE_MS = 500
const MOBILE_QUERY = '(max-width: 720px)'
const MAX_PLAUSIBLE_SPEED_KMH = 400
const LAP_FINISH_RADIUS_M = 25
const MIN_LAP_SECONDS = 15

const PROFILE_OPTIONS: { id: RouteProfile; label: string; icon: string }[] = [
  { id: 'driving', label: 'Drive', icon: '🚗' },
  { id: 'cycling', label: 'Bike', icon: '🚴' },
  { id: 'walking', label: 'Walk', icon: '🚶' },
]

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

type LastSample = { point: LatLngPoint; timestamp: number }

function computeSpeedKmh(sample: GeoSample, lastSampleRef: MutableRefObject<LastSample | null>): number | null {
  let speedKmh: number | null =
    sample.speedMps !== null && sample.speedMps >= 0 ? sample.speedMps * 3.6 : null
  const prevSample = lastSampleRef.current
  if (speedKmh === null && prevSample) {
    const dtSeconds = (sample.timestamp - prevSample.timestamp) / 1000
    if (dtSeconds > 0) {
      const dMeters = haversineDistance(prevSample.point, sample.point)
      speedKmh = (dMeters / dtSeconds) * 3.6
    }
  }
  lastSampleRef.current = { point: sample.point, timestamp: sample.timestamp }
  return speedKmh
}

function formatDuration(totalSecondsInput: number): string {
  const totalSeconds = Math.max(0, Math.round(totalSecondsInput))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatElapsed(ms: number): string {
  return formatDuration(ms / 1000)
}

function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(1)} km/h`
}

function formatGForce(g: number): string {
  return `${g.toFixed(2)} g`
}

function TelemetryTiles({ speedKmh, gForce }: { speedKmh: number | null; gForce: number | null }) {
  return (
    <div className="telemetry-row">
      <div className="telemetry-tile">
        <span className="telemetry-label">Speed</span>
        <span className="telemetry-value stat-readout">
          {speedKmh !== null ? formatSpeed(speedKmh) : '—'}
        </span>
      </div>
      <div className="telemetry-tile">
        <span className="telemetry-label">G-force</span>
        <span className="telemetry-value stat-readout">{gForce !== null ? formatGForce(gForce) : '—'}</span>
      </div>
    </div>
  )
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
  const [profile, setProfile] = useState<RouteProfile>('driving')
  const [recordedTrack, setRecordedTrack] = useState(false)
  const [routedPath, setRoutedPath] = useState<LatLngPoint[] | null>(null)
  const [routedDistance, setRoutedDistance] = useState<number | null>(null)
  const [routing, setRouting] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [routedDurationSeconds, setRoutedDurationSeconds] = useState<number | null>(null)
  const [liveSpeedKmh, setLiveSpeedKmh] = useState<number | null>(null)
  const [liveGForce, setLiveGForce] = useState<number | null>(null)
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState<number | null>(null)
  const [sessionAvgSpeedKmh, setSessionAvgSpeedKmh] = useState<number | null>(null)
  const [sessionMaxSpeedKmh, setSessionMaxSpeedKmh] = useState<number | null>(null)
  const [sessionMaxGForce, setSessionMaxGForce] = useState<number | null>(null)
  const [lapRunning, setLapRunning] = useState(false)
  const [lapStartedAt, setLapStartedAt] = useState<number | null>(null)
  const watchIdRef = useRef<string | null>(null)
  const motionHandleRef = useRef<PluginListenerHandle | null>(null)
  const lastSampleRef = useRef<LastSample | null>(null)
  const maxSpeedRef = useRef(0)
  const maxGForceRef = useRef(0)
  const finishLapRef = useRef<(() => void) | null>(null)

  const busy = recording || lapRunning

  useEffect(() => {
    if (!busy) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [busy])

  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        clearPointWatch(watchIdRef.current)
      }
      if (motionHandleRef.current) {
        motionHandleRef.current.remove()
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

  const canRoute = a !== null && b !== null && !busy && !recordedTrack

  useEffect(() => {
    if (!canRoute) return

    const points: LatLngPoint[] = [a as LatLngPoint, ...waypoints, b as LatLngPoint]
    const controller = new AbortController()

    const timer = setTimeout(async () => {
      setRouting(true)
      setRouteError(null)
      try {
        const result = await fetchRoute(points, profile, controller.signal)
        if (result) {
          setRoutedPath(result.coordinates)
          setRoutedDistance(result.distanceMeters)
          setRoutedDurationSeconds(result.durationSeconds)
        } else {
          setRoutedPath(null)
          setRoutedDistance(null)
          setRoutedDurationSeconds(null)
          setRouteError("Couldn't find a route on the roads — showing a straight line.")
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setRoutedPath(null)
          setRoutedDistance(null)
          setRoutedDurationSeconds(null)
          setRouteError("Couldn't reach the routing service — showing a straight line.")
        }
      } finally {
        setRouting(false)
      }
    }, ROUTE_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [a, b, waypoints, profile, canRoute])

  // Whether the last-fetched route still applies to the current a/b/waypoints.
  // Unlike canRoute (which also gates *fetching* a new route), this stays true
  // while busy so a locked-in route keeps showing its real distance/time
  // during an active recording or lap instead of falling back to a straight line.
  const routeIsCurrent = a !== null && b !== null && !recordedTrack
  const routedPathForDisplay = routeIsCurrent ? routedPath : null
  const displayDistanceMeters = routeIsCurrent && routedDistance !== null ? routedDistance : distanceMeters

  function handleMapClick(p: LatLngPoint) {
    if (busy) return
    setRecordedTrack(false)
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
    setRecordedTrack(false)
    setWaypoints((prev) => prev.filter((_, i) => i !== index))
  }

  function handleMoveA(p: LatLngPoint) {
    setRecordedTrack(false)
    setA(p)
  }

  function handleMoveB(p: LatLngPoint) {
    setRecordedTrack(false)
    setB(p)
  }

  function handleClearTrack() {
    setA(null)
    setB(null)
    setWaypoints([])
    setTrackName('')
    setActiveTrackId(null)
    setRecordedTrack(false)
    setRoutedPath(null)
    setRoutedDistance(null)
    setRoutedDurationSeconds(null)
    setRouteError(null)
    setRouting(false)
    setSessionDurationSeconds(null)
    setSessionAvgSpeedKmh(null)
    setSessionMaxSpeedKmh(null)
    setSessionMaxGForce(null)
    setLiveSpeedKmh(null)
    setLiveGForce(null)
    setLapRunning(false)
    setLapStartedAt(null)
    finishLapRef.current = null
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
      distanceMeters: displayDistanceMeters,
      createdAt: Date.now(),
      profile,
      recorded: recordedTrack,
      routeCoordinates: routedPath ?? undefined,
      durationSeconds: recordedTrack ? sessionDurationSeconds ?? undefined : routedDurationSeconds ?? undefined,
      avgSpeedKmh: sessionAvgSpeedKmh ?? undefined,
      maxSpeedKmh: sessionMaxSpeedKmh ?? undefined,
      maxGForce: sessionMaxGForce ?? undefined,
      laps: activeTrackId ? tracks.find((t) => t.id === activeTrackId)?.laps : undefined,
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
    setProfile(track.profile ?? 'driving')
    setRecordedTrack(track.recorded ?? false)
    setRoutedPath(track.routeCoordinates ?? null)
    setRoutedDistance(track.routeCoordinates ? track.distanceMeters : null)
    setRoutedDurationSeconds(!track.recorded ? track.durationSeconds ?? null : null)
    setRouteError(null)
    setRouting(false)
    setSessionDurationSeconds(track.recorded ? track.durationSeconds ?? null : null)
    setSessionAvgSpeedKmh(track.avgSpeedKmh ?? null)
    setSessionMaxSpeedKmh(track.maxSpeedKmh ?? null)
    setSessionMaxGForce(track.maxGForce ?? null)
    setLiveSpeedKmh(null)
    setLiveGForce(null)
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
    if (busy) return
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
      setRecordedTrack(true)
      setRecordingStartedAt(Date.now())
      setLiveSpeedKmh(null)
      setLiveGForce(null)
      setSessionDurationSeconds(null)
      setSessionAvgSpeedKmh(null)
      setSessionMaxSpeedKmh(null)
      setSessionMaxGForce(null)
      maxSpeedRef.current = 0
      maxGForceRef.current = 0
      lastSampleRef.current = { point: start, timestamp: Date.now() }

      const id = await watchPoint(
        (sample: GeoSample) => {
          setLocationError(null)
          setMyLocation(sample.point)

          const speedKmh = computeSpeedKmh(sample, lastSampleRef)
          if (speedKmh !== null && speedKmh <= MAX_PLAUSIBLE_SPEED_KMH) {
            setLiveSpeedKmh(speedKmh)
            maxSpeedRef.current = Math.max(maxSpeedRef.current, speedKmh)
            setSessionMaxSpeedKmh(maxSpeedRef.current)
          }

          setWaypoints((prev) => {
            const last = prev.length > 0 ? prev[prev.length - 1] : start
            if (haversineDistance(last, sample.point) < MIN_RECORD_DISTANCE_M) return prev
            return [...prev, sample.point]
          })
        },
        () => setLocationError('Error while tracking your location.'),
      )
      watchIdRef.current = id

      motionHandleRef.current = await watchGForce((g) => {
        setLiveGForce(g)
        maxGForceRef.current = Math.max(maxGForceRef.current, g)
        setSessionMaxGForce(maxGForceRef.current)
      })
    } catch {
      setLocationError('Could not get your location. Check that GPS is turned on.')
      setRecording(false)
    }
  }

  async function handleStopRecording() {
    const startedAt = recordingStartedAt
    setRecording(false)
    setRecordingStartedAt(null)
    setLiveSpeedKmh(null)
    setLiveGForce(null)
    if (watchIdRef.current) {
      await clearPointWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (motionHandleRef.current) {
      await motionHandleRef.current.remove()
      motionHandleRef.current = null
    }

    let finalB: LatLngPoint | null = null
    try {
      const end = await getCurrentPoint()
      setLocationError(null)
      setB(end)
      setMyLocation(end)
      finalB = end
    } catch {
      if (waypoints.length > 0) {
        finalB = waypoints[waypoints.length - 1]
        setB(finalB)
        setWaypoints((prev) => prev.slice(0, -1))
      }
    }

    if (startedAt && finalB) {
      const durationSeconds = (Date.now() - startedAt) / 1000
      const finalDistance = pathDistance([a as LatLngPoint, ...waypoints, finalB])
      setSessionDurationSeconds(durationSeconds)
      setSessionAvgSpeedKmh(durationSeconds > 0 ? (finalDistance / durationSeconds) * 3.6 : 0)
    }
  }

  async function handleStartLap() {
    if (busy || !a || !b || !activeTrackId) return
    setLocationError(null)
    const granted = await ensureLocationPermission()
    if (!granted) {
      setLocationError('Location permission was not granted.')
      return
    }

    const trackId = activeTrackId
    const targetB = b
    const lapDistance = displayDistanceMeters

    try {
      const startPoint = await getCurrentPoint()
      const lapStart = Date.now()
      setMode('idle')
      setMyLocation(startPoint)
      setFlyToRequestId((n) => n + 1)
      setLapRunning(true)
      setLapStartedAt(lapStart)
      setLiveSpeedKmh(null)
      setLiveGForce(null)
      setSessionMaxSpeedKmh(null)
      setSessionMaxGForce(null)
      maxSpeedRef.current = 0
      maxGForceRef.current = 0
      lastSampleRef.current = { point: startPoint, timestamp: lapStart }

      let finished = false
      const finishLap = async () => {
        if (finished) return
        finished = true
        finishLapRef.current = null
        setLapRunning(false)
        setLapStartedAt(null)
        setLiveSpeedKmh(null)
        setLiveGForce(null)
        if (watchIdRef.current) {
          await clearPointWatch(watchIdRef.current)
          watchIdRef.current = null
        }
        if (motionHandleRef.current) {
          await motionHandleRef.current.remove()
          motionHandleRef.current = null
        }

        const durationSeconds = (Date.now() - lapStart) / 1000
        const avgSpeedKmh = durationSeconds > 0 ? (lapDistance / durationSeconds) * 3.6 : 0
        const lap: LapRecord = {
          id: makeId(),
          durationSeconds,
          avgSpeedKmh,
          maxSpeedKmh: maxSpeedRef.current,
          maxGForce: maxGForceRef.current,
          completedAt: Date.now(),
        }

        setTracks((prev) => {
          const next = prev.map((t) => (t.id === trackId ? { ...t, laps: [lap, ...(t.laps ?? [])] } : t))
          saveTracks(next)
          return next
        })
      }

      const id = await watchPoint(
        (sample: GeoSample) => {
          setLocationError(null)
          setMyLocation(sample.point)

          const speedKmh = computeSpeedKmh(sample, lastSampleRef)
          if (speedKmh !== null && speedKmh <= MAX_PLAUSIBLE_SPEED_KMH) {
            setLiveSpeedKmh(speedKmh)
            maxSpeedRef.current = Math.max(maxSpeedRef.current, speedKmh)
            setSessionMaxSpeedKmh(maxSpeedRef.current)
          }

          const elapsedSoFar = (sample.timestamp - lapStart) / 1000
          const distToFinish = haversineDistance(sample.point, targetB)
          if (elapsedSoFar > MIN_LAP_SECONDS && distToFinish < LAP_FINISH_RADIUS_M) {
            finishLap()
          }
        },
        () => setLocationError('Error while tracking your location.'),
      )
      watchIdRef.current = id

      motionHandleRef.current = await watchGForce((g) => {
        setLiveGForce(g)
        maxGForceRef.current = Math.max(maxGForceRef.current, g)
        setSessionMaxGForce(maxGForceRef.current)
      })

      finishLapRef.current = finishLap
    } catch {
      setLocationError('Could not get your location. Check that GPS is turned on.')
      setLapRunning(false)
      setLapStartedAt(null)
    }
  }

  const canSave = a !== null && b !== null
  const canStartLap = a !== null && b !== null && activeTrackId !== null && !busy
  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null
  const lapCount = activeTrack?.laps?.length ?? 0
  const bestLapSeconds =
    activeTrack?.laps && activeTrack.laps.length > 0
      ? Math.min(...activeTrack.laps.map((l) => l.durationSeconds))
      : null
  const elapsedMs = recordingStartedAt ? now - recordingStartedAt : 0
  const lapElapsedMs = lapStartedAt ? now - lapStartedAt : 0

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
            Create a track — start (A), finish (B), shape the route — save it, then start a lap to
            time yourself with live speed and G-force.
          </p>
          <div className="checkered-strip" />

          <section className="record-panel">
            {!recording && !lapRunning && (
              <button type="button" className="record-btn" onClick={handleStartRecording}>
                🔴 Record a live ride
              </button>
            )}
            {recording && (
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
                <TelemetryTiles speedKmh={liveSpeedKmh} gForce={liveGForce} />
              </div>
            )}
            {locationError && <div className="location-error">{locationError}</div>}
          </section>

          <section className="lap-panel">
            {!busy && canStartLap && (
              <button type="button" className="lap-btn" onClick={handleStartLap}>
                🏁 Start Lap
              </button>
            )}
            {!busy && a && b && !activeTrackId && (
              <p className="lap-hint">💾 Save this track first to start timing laps.</p>
            )}
            {lapRunning && (
              <div className="recording-active">
                <button
                  type="button"
                  className="record-btn recording"
                  onClick={() => finishLapRef.current?.()}
                >
                  🏁 Finish Lap
                </button>
                <div className="recording-stats">
                  <span className="pulse-dot" />
                  <span className="stat-readout">{formatElapsed(lapElapsedMs)}</span>
                </div>
                <TelemetryTiles speedKmh={liveSpeedKmh} gForce={liveGForce} />
              </div>
            )}
            {!busy && lapCount > 0 && (
              <div className="lap-info">
                🏆 Best lap: <strong className="stat-readout">{formatDuration(bestLapSeconds ?? 0)}</strong> ·{' '}
                {lapCount} lap{lapCount === 1 ? '' : 's'}
              </div>
            )}
          </section>

          <section className="toolbar">
            <button
              type="button"
              className={`tool-btn tag-a ${mode === 'a' ? 'active' : ''}`}
              onClick={() => setMode('a')}
              disabled={busy}
            >
              🅰️ Set start
            </button>
            <button
              type="button"
              className={`tool-btn tag-b ${mode === 'b' ? 'active' : ''}`}
              onClick={() => setMode('b')}
              disabled={busy}
            >
              🏁 Set finish
            </button>
            <button
              type="button"
              className={`tool-btn ${mode === 'waypoint' ? 'active' : ''}`}
              onClick={() => setMode('waypoint')}
              disabled={busy}
            >
              ➕ Add route point
            </button>
          </section>

          <section className="profile-row">
            {PROFILE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`profile-btn ${profile === opt.id ? 'active' : ''}`}
                onClick={() => setProfile(opt.id)}
                disabled={busy}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
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
              📏 Track length: <strong className="stat-readout">{formatDistance(displayDistanceMeters)}</strong>
            </div>
            {!busy && !recordedTrack && routing && (
              <div className="status-row muted">🔄 Finding route on the roads…</div>
            )}
            {!busy && !recordedTrack && routeError && (
              <div className="status-row muted">{routeError}</div>
            )}
            {routeIsCurrent && routedDurationSeconds !== null && (
              <div className="status-row">
                ⏱ Est. time: <strong className="stat-readout">{formatDuration(routedDurationSeconds)}</strong>
              </div>
            )}
            {recordedTrack && !busy && (
              <div className="status-row muted">📡 Recorded from GPS — showing the actual path ridden</div>
            )}
            {recordedTrack && !busy && sessionDurationSeconds !== null && (
              <div className="telemetry-summary">
                <div className="telemetry-summary-item">
                  <span className="telemetry-label">Time</span>
                  <span className="stat-readout">{formatDuration(sessionDurationSeconds)}</span>
                </div>
                <div className="telemetry-summary-item">
                  <span className="telemetry-label">Avg speed</span>
                  <span className="stat-readout">
                    {sessionAvgSpeedKmh !== null ? formatSpeed(sessionAvgSpeedKmh) : '—'}
                  </span>
                </div>
                <div className="telemetry-summary-item">
                  <span className="telemetry-label">Max speed</span>
                  <span className="stat-readout">
                    {sessionMaxSpeedKmh !== null ? formatSpeed(sessionMaxSpeedKmh) : '—'}
                  </span>
                </div>
                <div className="telemetry-summary-item">
                  <span className="telemetry-label">Peak G</span>
                  <span className="stat-readout">
                    {sessionMaxGForce !== null ? formatGForce(sessionMaxGForce) : '—'}
                  </span>
                </div>
              </div>
            )}
            {waypoints.length > 0 && (
              <div className="status-row muted">
                {waypoints.length} extra point{waypoints.length === 1 ? '' : 's'}
                {!busy && ' · tap a point on the map to remove it'}
              </div>
            )}
          </section>

          <section className="actions-row">
            <button
              type="button"
              className="ghost-btn"
              onClick={handleUndoWaypoint}
              disabled={waypoints.length === 0 || busy}
            >
              ↩️ Undo last point
            </button>
            <button type="button" className="ghost-btn danger" onClick={handleClearTrack} disabled={busy}>
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
                  <button
                    type="button"
                    className="track-item"
                    onClick={() => handleLoadTrack(t)}
                    disabled={busy}
                  >
                    <span className="track-name">{t.name}</span>
                    <span className="track-meta">{formatDistance(t.distanceMeters)}</span>
                  </button>
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => handleDeleteTrack(t.id)}
                    aria-label={`Delete ${t.name}`}
                    disabled={busy}
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
          routeLine={routedPathForDisplay}
          myLocation={myLocation}
          flyToRequestId={flyToRequestId}
          locked={busy}
          onMapClick={handleMapClick}
          onMoveA={handleMoveA}
          onMoveB={handleMoveB}
          onRemoveWaypoint={handleRemoveWaypoint}
        />
        <div className="map-hint">
          {recording && '🔴 Recording — following your ride live'}
          {lapRunning && '🏁 Lap in progress — drive to the finish (B)'}
          {!busy && mode === 'a' && 'Tap the map to set the start (A)'}
          {!busy && mode === 'b' && 'Tap the map to set the finish (B)'}
          {!busy && mode === 'waypoint' && 'Tap the map to add a route point'}
          {!busy && mode === 'idle' && 'Pick a tool to continue'}
        </div>
        <button type="button" className="locate-btn" onClick={handleLocateMe} aria-label="My location">
          📍
        </button>
      </main>
    </div>
  )
}
