import { useEffect, useMemo, useState } from 'react'
import type { EventsFile, Home, PokeEvent } from './types'
import MapView from './components/MapView'
import EventCard from './components/EventCard'
import FiltersBar from './components/Filters'
import Dashboard from './components/Dashboard'
import ScheduleView from './components/ScheduleView'
import ItineraryView from './components/ItineraryView'
import { reverseGeocodeCountry } from './lib/geo'
import {
  type Filters,
  loadExcluded,
  loadFilters,
  loadHome,
  saveExcluded,
  saveFilters,
  saveHome,
} from './lib/storage'
import { clearPlanFromUrl, readPlanFromUrl } from './lib/share'

type Tab = 'map' | 'schedule' | 'itinerary'

export default function App() {
  const [data, setData] = useState<EventsFile | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<Tab>('map')
  const [home, setHome] = useState<Home | null>(loadHome)
  const [settingHome, setSettingHome] = useState(false)
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [excluded, setExcluded] = useState<Set<string>>(loadExcluded)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dashOpen, setDashOpen] = useState(false)
  // A shared ?plan= link is view-only until adopted — it must not overwrite local state.
  const [sharedPlan, setSharedPlan] = useState<string[] | null>(readPlanFromUrl)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/events.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: EventsFile) => setData(json))
      .catch(() => setLoadError(true))
  }, [])

  const events = useMemo(() => data?.events ?? [], [data])

  const filtered = useMemo(
    () =>
      events.filter(
        (ev) =>
          filters.types.includes(ev.type) &&
          filters.regions.includes(ev.region) &&
          ev.formats.some((f) => filters.formats.includes(f)),
      ),
    [events, filters],
  )

  const isChecked = (id: string) =>
    sharedPlan ? sharedPlan.includes(id) : !excluded.has(id)

  function toggle(id: string) {
    if (sharedPlan) return // view-only until adopted
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveExcluded(next)
      return next
    })
  }

  function updateFilters(f: Filters) {
    setFilters(f)
    saveFilters(f)
  }

  function setHomePin(lat: number, lng: number) {
    const next: Home = { lat, lng, country: null }
    setHome(next)
    saveHome(next)
    setSettingHome(false)
    // One-time lookup so drive/domestic/international guidance is accurate; fails soft.
    reverseGeocodeCountry(lat, lng).then((country) => {
      if (country) {
        setHome((h) => {
          if (!h || h.lat !== lat || h.lng !== lng) return h
          const updated = { ...h, country }
          saveHome(updated)
          return updated
        })
      }
    })
  }

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setHomePin(pos.coords.latitude, pos.coords.longitude),
      () => setSettingHome(true), // denied/failed — fall back to tap-to-pin
      { timeout: 10_000 },
    )
  }

  function clearHome() {
    setHome(null)
    saveHome(null)
    setSettingHome(false)
  }

  function adoptSharedPlan() {
    if (!sharedPlan) return
    const next = new Set(events.filter((ev) => !sharedPlan.includes(ev.id)).map((ev) => ev.id))
    setExcluded(next)
    saveExcluded(next)
    setSharedPlan(null)
    clearPlanFromUrl()
  }

  function dismissSharedPlan() {
    setSharedPlan(null)
    clearPlanFromUrl()
  }

  const selected: PokeEvent | null = events.find((ev) => ev.id === selectedId) ?? null
  const dataDate = data ? data.meta.generatedAt.slice(0, 10) : null

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="logo" />
          Pokémon Majors Map
        </h1>
        <div className="topbar-actions">
          {home ? (
            <button className="btn btn-small" onClick={() => setSettingHome(true)}>
              🏠 Move home
            </button>
          ) : (
            <button className="btn btn-small btn-primary" onClick={() => setSettingHome(true)}>
              🏠 Set home
            </button>
          )}
        </div>
      </header>

      {sharedPlan && (
        <div className="banner banner-plan">
          Viewing a shared season plan ({sharedPlan.length} events).
          <button className="btn btn-small btn-primary" onClick={adoptSharedPlan}>
            Make it my plan
          </button>
          <button className="btn btn-small" onClick={dismissSharedPlan}>
            Dismiss
          </button>
        </div>
      )}

      {settingHome && (
        <div className="banner">
          Tap the map to set your home.
          <button className="btn btn-small" onClick={useMyLocation}>
            📡 Use my location
          </button>
          {home && (
            <button className="btn btn-small" onClick={clearHome}>
              Clear home
            </button>
          )}
          <button className="btn btn-small" onClick={() => setSettingHome(false)}>
            Cancel
          </button>
        </div>
      )}

      {loadError && <div className="banner banner-error">Couldn't load event data. Try again later.</div>}

      {(tab === 'map' || tab === 'schedule') && (
        <FiltersBar filters={filters} onChange={updateFilters} />
      )}

      <main className="content">
        {tab === 'map' && (
          <div className="map-wrap">
            <MapView
              events={filtered}
              home={home}
              isChecked={isChecked}
              settingHome={settingHome}
              onPickHome={setHomePin}
              onSelect={(id) => {
                setSelectedId(id)
                if (tab === 'map') setSettingHome(false)
              }}
              dataDate={dataDate}
            />
            <button className="dash-toggle btn" onClick={() => setDashOpen((v) => !v)}>
              {dashOpen ? '▾ Hide season list' : '▴ Season list'}
            </button>
            {dashOpen && (
              <div className="dash-panel">
                <Dashboard
                  events={filtered}
                  isChecked={isChecked}
                  onToggle={toggle}
                  onSelect={(id) => {
                    setSelectedId(id)
                    setDashOpen(false)
                  }}
                />
              </div>
            )}
            {selected && (
              <div className="sheet">
                <EventCard
                  ev={selected}
                  home={home}
                  checked={isChecked(selected.id)}
                  onToggle={toggle}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            )}
          </div>
        )}
        {tab === 'schedule' && (
          <ScheduleView events={filtered} home={home} isChecked={isChecked} onToggle={toggle} />
        )}
        {tab === 'itinerary' && (
          <ItineraryView events={events} home={home} isChecked={isChecked} onToggle={toggle} />
        )}
        {tab !== 'map' && (
          <footer className="footer">
            <p>
              v{__APP_VERSION__}
              {dataDate && <> · data {dataDate}</>} ·{' '}
              <a href="https://github.com/pizzacatz/pokemon-majors-map">source</a>
            </p>
            <p className="disclaimer">
              This is a fan project. Not affiliated with, endorsed, or sponsored by Nintendo, The
              Pokémon Company International, or Game Freak. Pokémon and all related media are
              trademarks of their respective owners.
            </p>
          </footer>
        )}
      </main>

      <nav className="tabbar">
        <button className={tab === 'map' ? 'tab-on' : ''} onClick={() => setTab('map')}>
          🗺️ Map
        </button>
        <button className={tab === 'schedule' ? 'tab-on' : ''} onClick={() => setTab('schedule')}>
          📅 Schedule
        </button>
        <button className={tab === 'itinerary' ? 'tab-on' : ''} onClick={() => setTab('itinerary')}>
          🧳 Itinerary
        </button>
      </nav>
    </div>
  )
}
