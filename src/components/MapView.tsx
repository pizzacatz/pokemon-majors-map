import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { divIcon } from 'leaflet'
import type { Home, PokeEvent } from '../types'
import { formatDateRange, hasDates, isPast } from '../lib/dates'
import { shortLabel } from '../lib/labels'

const US_CENTER: [number, number] = [39.5, -98.35]

export interface FlyTarget {
  lat: number
  lng: number
  /** monotonically increasing so repeat flights to the same place re-trigger */
  seq: number
}

interface Props {
  events: PokeEvent[]
  home: Home | null
  isChecked: (id: string) => boolean
  settingHome: boolean
  onPickHome: (lat: number, lng: number) => void
  onSelect: (id: string) => void
  dataDate: string | null
  flyTarget: FlyTarget | null
}

function eventIcon(ev: PokeEvent, checked: boolean) {
  const off = !checked || isPast(ev)
  return divIcon({
    className: '',
    html: `<div class="pin pin-${ev.type}${off ? ' pin-off' : ''}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

// Pure CSS marker — an emoji glyph here rendered doubled on some
// browser/zoom combinations (glyph + its drop-shadow as a second copy).
const homeIcon = divIcon({
  className: '',
  html: '<div class="pin-home" title="Home"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

/** Recenter when the home pin appears or moves. */
function CenterOnHome({ home }: { home: Home | null }) {
  const map = useMap()
  useEffect(() => {
    if (home) map.setView([home.lat, home.lng], Math.max(map.getZoom(), 5))
  }, [home, map])
  return null
}

/**
 * Animate to a requested event location (PRD §4.12). On phones the bottom
 * sheet covers the lower ~300px, so the flight targets a center offset below
 * the pin — the pin lands in the visible strip instead of behind the card.
 */
function FlyTo({ target }: { target: FlyTarget | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const zoom = 7
    const sheetOffset = window.innerWidth < 700 ? 130 : 0
    const point = map.project([target.lat, target.lng], zoom).add([0, sheetOffset])
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo(map.unproject(point, zoom), zoom, { duration: reduced ? 0 : 1.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.seq, map])
  return null
}

function HomePicker({ active, onPick }: { active: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (active) onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function MapView({ events, home, isChecked, settingHome, onPickHome, onSelect, dataDate, flyTarget }: Props) {
  const center: [number, number] = home ? [home.lat, home.lng] : US_CENTER
  const attribution = useMemo(() => {
    const data = dataDate ? ` · data ${dataDate}` : ''
    return `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · v${__APP_VERSION__}${data}`
  }, [dataDate])

  return (
    <MapContainer
      center={center}
      zoom={home ? 5 : 4}
      minZoom={2}
      className={`map${settingHome ? ' map-picking' : ''}`}
      worldCopyJump
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={attribution} />
      <CenterOnHome home={home} />
      <FlyTo target={flyTarget} />
      <HomePicker active={settingHome} onPick={onPickHome} />
      {events.map((ev) => (
        <Marker
          key={ev.id}
          position={[ev.lat, ev.lng]}
          icon={eventIcon(ev, isChecked(ev.id))}
          // title gives keyboard-focusable pins an accessible name (P2-17)
          title={`${shortLabel(ev)}${hasDates(ev) ? ` — ${formatDateRange(ev.startDate, ev.endDate)}` : ''}`}
          eventHandlers={{ click: () => onSelect(ev.id) }}
        />
      ))}
      {home && (
        <Marker position={[home.lat, home.lng]} icon={homeIcon} title="Home" zIndexOffset={1000}>
          <Popup>🏠 Home — distances and book-by dates measure from here.</Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
