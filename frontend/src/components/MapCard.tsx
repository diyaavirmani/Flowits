import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { AllocationResponse } from '../types'

interface MapCardProps {
  allocation: AllocationResponse
}

const RED = '#d4351c'
const BLUE = '#1d70b8'
const ORANGE = '#c2570a'

interface Marker {
  lat: number
  lng: number
  label: string
  type: 'incident' | 'officer' | 'barricade'
}

export default function MapCard({ allocation }: MapCardProps) {
  const { deployment_plan, diversion } = allocation
  const [mode, setMode] = useState<'map' | 'schematic'>('map')
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapObj = useRef<L.Map | null>(null)

  const incident = useMemo(() => {
    if (diversion.blocked_latitude == null || diversion.blocked_longitude == null) return null
    return { lat: diversion.blocked_latitude, lng: diversion.blocked_longitude }
  }, [diversion])

  const markers = useMemo<Marker[]>(() => {
    const list: Marker[] = []
    if (incident) {
      list.push({ ...incident, label: diversion.blocked_junction, type: 'incident' })
    }
    deployment_plan.forEach((n) => {
      list.push({
        lat: n.latitude,
        lng: n.longitude,
        label: n.node_label,
        type: n.resource_type === 'officer' ? 'officer' : 'barricade',
      })
    })
    return list.filter((m) => m.lat && m.lng)
  }, [deployment_plan, incident, diversion.blocked_junction])

  const routeLatLng = useMemo(
    () => diversion.route_points.map((p) => [p.latitude, p.longitude] as [number, number]),
    [diversion.route_points],
  )

  useEffect(() => {
    if (mode !== 'map' || !mapEl.current || markers.length === 0) return

    const map = L.map(mapEl.current, { scrollWheelZoom: false, attributionControl: false })
    mapObj.current = map

    let tilesFailed = false
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 })
    tiles.on('tileerror', () => {
      if (!tilesFailed) {
        tilesFailed = true
        setMode('schematic')
      }
    })
    tiles.addTo(map)

    if (routeLatLng.length > 1) {
      L.polyline(routeLatLng, { color: ORANGE, weight: 4, dashArray: '8 6' }).addTo(map)
    }

    markers.forEach((m) => {
      const color = m.type === 'incident' ? RED : m.type === 'officer' ? BLUE : ORANGE
      L.circleMarker([m.lat, m.lng], {
        radius: m.type === 'incident' ? 9 : 7,
        color: '#0b0c0c',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(`${m.label} · ${m.type}`, { direction: 'top' })
    })

    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      mapObj.current = null
    }
  }, [mode, markers, routeLatLng])

  // ── Schematic projection ──
  const schematic = useMemo(() => {
    if (markers.length === 0) return null
    const W = 600
    const H = 340
    const pad = 48
    const lats = markers.map((m) => m.lat)
    const lngs = markers.map((m) => m.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const sx = (lng: number) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - 2 * pad)
    const sy = (lat: number) => pad + ((maxLat - lat) / (maxLat - minLat || 1)) * (H - 2 * pad)
    return { W, H, sx, sy }
  }, [markers])

  if (markers.length === 0) return null

  return (
    <section className="border-t-4 border-ink pt-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Deployment and diversion map</h2>
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'map' ? 'schematic' : 'map'))}
          className="gv-button gv-button-secondary text-sm"
        >
          {mode === 'map' ? 'Switch to schematic' : 'Switch to map'}
        </button>
      </div>

      {mode === 'map' ? (
        <div ref={mapEl} className="w-full h-[360px] border-2 border-ink" />
      ) : (
        schematic && (
          <div className="w-full border-2 border-ink bg-grey-light">
            <svg viewBox={`0 0 ${schematic.W} ${schematic.H}`} className="w-full h-auto">
              {routeLatLng.length > 1 && (
                <polyline
                  points={routeLatLng
                    .map(([lat, lng]) => `${schematic.sx(lng)},${schematic.sy(lat)}`)
                    .join(' ')}
                  fill="none"
                  stroke={ORANGE}
                  strokeWidth={3}
                  strokeDasharray="8 6"
                />
              )}
              {markers.map((m, i) => {
                const color = m.type === 'incident' ? RED : m.type === 'officer' ? BLUE : ORANGE
                return (
                  <g key={i}>
                    <circle
                      cx={schematic.sx(m.lng)}
                      cy={schematic.sy(m.lat)}
                      r={m.type === 'incident' ? 9 : 7}
                      fill={color}
                      stroke="#0b0c0c"
                      strokeWidth={1.5}
                    />
                    <text
                      x={schematic.sx(m.lng)}
                      y={schematic.sy(m.lat) - 12}
                      textAnchor="middle"
                      fontSize={10}
                      fontFamily="'Public Sans', sans-serif"
                      fill="#0b0c0c"
                    >
                      {m.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: RED }} /> Incident
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: BLUE }} /> Officer
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: ORANGE }} /> Barricade
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 border-t-2 border-dashed" style={{ borderColor: ORANGE }} /> Diversion route
        </span>
      </div>
    </section>
  )
}
