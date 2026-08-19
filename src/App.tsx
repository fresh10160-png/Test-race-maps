import { useMemo, useState } from 'react'
import MapView from './MapView'
import { formatDistance, pathDistance } from './geo'
import { loadTracks, saveTracks } from './storage'
import type { EditMode, LatLngPoint, SavedTrack } from './types'
import './app.css'

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function App() {
  const [mode, setMode] = useState<EditMode>('a')
  const [a, setA] = useState<LatLngPoint | null>(null)
  const [b, setB] = useState<LatLngPoint | null>(null)
  const [waypoints, setWaypoints] = useState<LatLngPoint[]>([])
  const [tracks, setTracks] = useState<SavedTrack[]>(() => loadTracks())
  const [trackName, setTrackName] = useState('')
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)

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
    const name = trackName.trim() || `Staza ${tracks.length + 1}`

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
    if (!confirm('Obrisati ovu stazu?')) return
    setTracks((prev) => {
      const next = prev.filter((t) => t.id !== id)
      saveTracks(next)
      return next
    })
    if (activeTrackId === id) {
      handleClearTrack()
    }
  }

  const canSave = a !== null && b !== null

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>🏁 Race Maps</h1>
          <p>Obeleži start (A) i cilj (B) svoje staze, po želji dodaj tačke da oblikuješ trasu, pa je sačuvaj.</p>
        </header>

        <section className="toolbar">
          <button
            type="button"
            className={`tool-btn tag-a ${mode === 'a' ? 'active' : ''}`}
            onClick={() => setMode('a')}
          >
            🅰️ Postavi start
          </button>
          <button
            type="button"
            className={`tool-btn tag-b ${mode === 'b' ? 'active' : ''}`}
            onClick={() => setMode('b')}
          >
            🏁 Postavi cilj
          </button>
          <button
            type="button"
            className={`tool-btn ${mode === 'waypoint' ? 'active' : ''}`}
            onClick={() => setMode('waypoint')}
          >
            ➕ Dodaj tačku staze
          </button>
        </section>

        <section className="status-panel">
          <div className="status-row">
            <span className={`dot ${a ? 'set' : ''}`} />
            Start (A): {a ? `${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}` : 'nije postavljen'}
          </div>
          <div className="status-row">
            <span className={`dot dot-b ${b ? 'set' : ''}`} />
            Cilj (B): {b ? `${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}` : 'nije postavljen'}
          </div>
          <div className="status-row">
            📏 Dužina staze: <strong>{formatDistance(distanceMeters)}</strong>
          </div>
          {waypoints.length > 0 && (
            <div className="status-row muted">
              {waypoints.length} dodatn{waypoints.length === 1 ? 'a tačka' : 'ih tačaka'} · klikni na tačku na mapi da je ukloniš
            </div>
          )}
        </section>

        <section className="actions-row">
          <button type="button" className="ghost-btn" onClick={handleUndoWaypoint} disabled={waypoints.length === 0}>
            ↩️ Ukloni poslednju tačku
          </button>
          <button type="button" className="ghost-btn danger" onClick={handleClearTrack}>
            🗑️ Nova staza
          </button>
        </section>

        <form className="save-form" onSubmit={handleSaveTrack}>
          <input
            type="text"
            placeholder="Naziv staze (npr. Ada Ciganlija krug)"
            value={trackName}
            onChange={(e) => setTrackName(e.target.value)}
          />
          <button type="submit" className="save-btn" disabled={!canSave}>
            💾 Sačuvaj stazu
          </button>
        </form>

        <section className="tracks-list">
          <h2>Sačuvane staze ({tracks.length})</h2>
          {tracks.length === 0 && <p className="muted">Još nema sačuvanih staza.</p>}
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
                  aria-label={`Obriši ${t.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <main className="map-pane">
        <MapView
          mode={mode}
          a={a}
          b={b}
          waypoints={waypoints}
          onMapClick={handleMapClick}
          onMoveA={setA}
          onMoveB={setB}
          onRemoveWaypoint={handleRemoveWaypoint}
        />
        <div className="map-hint">
          {mode === 'a' && 'Klikni na mapu da postaviš start (A)'}
          {mode === 'b' && 'Klikni na mapu da postaviš cilj (B)'}
          {mode === 'waypoint' && 'Klikni na mapu da dodaš tačku staze'}
          {mode === 'idle' && 'Izaberi alat sa leve strane da nastaviš'}
        </div>
      </main>
    </div>
  )
}
