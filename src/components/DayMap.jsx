import { Fragment, useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { formatTime } from '../lib/time.js'

const MODE_COLORS = {
  walk: '#2f9e44', car: '#e8590c', train: '#7048e8', bus: '#1971c2',
  flight: '#c2255c', boat: '#0c8599', other: '#495057',
}

const numberIcon = (n) =>
  L.divIcon({ className: 'pin', html: `<span>${n}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] })

const endIcon = (color) =>
  L.divIcon({ className: 'pin-end', html: `<span style="background:${color}"></span>`, iconSize: [12, 12], iconAnchor: [6, 6] })

// Shows the winning suggestion of each slot: numbered pins for activities,
// lines for travel.
export default function DayMap({ slots }) {
  const items = useMemo(
    () =>
      slots.map((slot, i) => ({
        n: i + 1,
        slot,
        s: slot.ranked[0],
      })),
    [slots],
  )

  const points = []
  for (const { s } of items) {
    if (s.kind === 'activity' && s.lat != null) points.push([s.lat, s.lng])
    if (s.kind === 'travel') {
      if (s.from_lat != null) points.push([s.from_lat, s.from_lng])
      if (s.to_lat != null) points.push([s.to_lat, s.to_lng])
    }
  }

  return (
    <div className="map-wrap">
      <MapContainer center={[20, 0]} zoom={2} className="map" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {items.map(({ n, slot, s }) => {
          const time = `${formatTime(slot.start_time)}–${formatTime(slot.end_time)}`
          if (s.kind === 'activity') {
            if (s.lat == null) return null
            return (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={numberIcon(n)}>
                <Popup><strong>{n}. {s.title}</strong><br />{time}<br />{s.address}</Popup>
              </Marker>
            )
          }
          const color = MODE_COLORS[s.travel_mode] || MODE_COLORS.other
          const ends = [
            s.from_lat != null && [s.from_lat, s.from_lng],
            s.to_lat != null && [s.to_lat, s.to_lng],
          ].filter(Boolean)
          const popup = <Popup><strong>{n}. {s.title}</strong> ({s.travel_mode})<br />{time}</Popup>
          return (
            <Fragment key={s.id}>
              {ends.length === 2 && (
                <Polyline positions={ends} pathOptions={{ color, weight: 4, dashArray: s.travel_mode === 'flight' ? '8 8' : null }}>
                  {popup}
                </Polyline>
              )}
              {ends.map((p, j) => (
                <Marker key={j} position={p} icon={endIcon(color)}>{popup}</Marker>
              ))}
            </Fragment>
          )
        })}
      </MapContainer>
      {points.length === 0 && (
        <p className="map-empty">Nothing on the map yet — use “Find” when adding an address.</p>
      )}
    </div>
  )
}

function FitBounds({ points }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14)
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 15 })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
