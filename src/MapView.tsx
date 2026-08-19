import { useEffect, useMemo, useRef } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import type { EditMode, LatLngPoint } from './types'

// Neutral fallback shown only until the user's real location resolves (or
// forever if they deny location access) — never a specific city.
const FALLBACK_CENTER: LatLngPoint = { lat: 20, lng: 10 }
const FALLBACK_ZOOM = 2

function tagIcon(label: string, color: string) {
  return L.divIcon({
    className: 'tag-icon',
    html: `<div class="tag-pin" style="background:${color}"><span>${label}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  })
}

const iconA = tagIcon('A', '#22c55e')
const iconB = tagIcon('B', '#ef4444')

interface MapClicksProps {
  mode: EditMode
  onMapClick: (p: LatLngPoint) => void
}

function MapClicks({ mode, onMapClick }: MapClicksProps) {
  useMapEvents({
    click(e) {
      if (mode === 'idle') return
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

interface FlyToProps {
  point: LatLngPoint
  requestId: number
}

function FlyToLocation({ point, requestId }: FlyToProps) {
  const map = useMap()
  useEffect(() => {
    if (requestId > 0) {
      map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 16))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])
  return null
}

function SetInitialView({ point }: { point: LatLngPoint }) {
  const map = useMap()
  const appliedRef = useRef(false)
  useEffect(() => {
    if (appliedRef.current) return
    appliedRef.current = true
    map.setView([point.lat, point.lng], 14)
  }, [point, map])
  return null
}

interface MapViewProps {
  mode: EditMode
  a: LatLngPoint | null
  b: LatLngPoint | null
  waypoints: LatLngPoint[]
  routeLine: LatLngPoint[] | null
  myLocation: LatLngPoint | null
  flyToRequestId: number
  initialLocation: LatLngPoint | null
  locked: boolean
  onMapClick: (p: LatLngPoint) => void
  onMoveA: (p: LatLngPoint) => void
  onMoveB: (p: LatLngPoint) => void
  onRemoveWaypoint: (index: number) => void
}

export default function MapView({
  mode,
  a,
  b,
  waypoints,
  routeLine,
  myLocation,
  flyToRequestId,
  initialLocation,
  locked,
  onMapClick,
  onMoveA,
  onMoveB,
  onRemoveWaypoint,
}: MapViewProps) {
  const fullPath = useMemo(() => {
    const pts: LatLngPoint[] = []
    if (a) pts.push(a)
    pts.push(...waypoints)
    if (b) pts.push(b)
    return pts
  }, [a, b, waypoints])

  const lineToDraw = routeLine && routeLine.length > 1 ? routeLine : fullPath

  return (
    <MapContainer
      center={[FALLBACK_CENTER.lat, FALLBACK_CENTER.lng]}
      zoom={FALLBACK_ZOOM}
      className={`map-root mode-${mode}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <MapClicks mode={mode} onMapClick={onMapClick} />
      {myLocation && <FlyToLocation point={myLocation} requestId={flyToRequestId} />}
      {initialLocation && <SetInitialView point={initialLocation} />}

      {lineToDraw.length > 1 && (
        <>
          <Polyline
            positions={lineToDraw.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }}
          />
          <Polyline
            positions={lineToDraw.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: '#f97316', weight: 5, opacity: 0.95 }}
          />
        </>
      )}

      {a && (
        <Marker
          position={[a.lat, a.lng]}
          icon={iconA}
          draggable={!locked}
          eventHandlers={{
            dragend: (e) => {
              const ll = e.target.getLatLng()
              onMoveA({ lat: ll.lat, lng: ll.lng })
            },
          }}
        />
      )}

      {waypoints.map((wp, i) => (
        <CircleMarker
          key={i}
          center={[wp.lat, wp.lng]}
          radius={6}
          pathOptions={{
            color: '#f97316',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2,
          }}
          eventHandlers={{
            click: () => {
              if (!locked) onRemoveWaypoint(i)
            },
          }}
        />
      ))}

      {b && (
        <Marker
          position={[b.lat, b.lng]}
          icon={iconB}
          draggable={!locked}
          eventHandlers={{
            dragend: (e) => {
              const ll = e.target.getLatLng()
              onMoveB({ lat: ll.lat, lng: ll.lng })
            },
          }}
        />
      )}

      {myLocation && (
        <CircleMarker
          center={[myLocation.lat, myLocation.lng]}
          radius={8}
          pathOptions={{
            color: '#ffffff',
            weight: 3,
            fillColor: '#3b82f6',
            fillOpacity: 1,
          }}
          interactive={false}
        />
      )}
    </MapContainer>
  )
}
