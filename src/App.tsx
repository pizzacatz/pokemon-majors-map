import { useEffect, useMemo, useRef, useState } from 'react'
import type { EventsFile, Home, PokeEvent } from './types'
import { EVENT_TYPES, EVENT_TYPE_LABEL } from './types'
import MapView, { type FlyTarget } from './components/MapView'
import TimelineView from './components/TimelineView'
import EventCard from './components/EventCard'
import EventSheet from './components/EventSheet'
import FilterPanel, { isFiltered } from './components/Filters'
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
import { normalizeEvent } from './lib/normalize'
import { setAddressCorpus } from './lib/addrFit'

type Tab = 'map' | 'schedule' | 'itinerary'

function tabFromUrl(): Tab {
  const t = new URLSearchParams(window.location.search).get('tab')
  return t === 'schedule' || t === 'itinerary' ? t : 'map'
}

function eventFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('event')
}

function urlWith(params: Record<string, string | null>): string {
  const u = new URL(window.location.href)
  for (const [k, v] of Object.entries(params)) {
    if (v === null) u.searchParams.delete(k)
    else u.searchParams.set(k, v)
  }
  return u.toString()
}

export default function App() {
  const [data, setData] = useState<EventsFile | null>(null)
  const [loadError, setLoadError] = useState(false)
  // Tabs and the open event live in the URL (UX audit P0-4): Android back
  // walks tab history and dismisses the sheet instead of exiting the app,
  // and every event card is deep-linkable.
  const [tab, setTab] = useState<Tab>(tabFromUrl)
  const [selectedId, setSelectedId] = useState<string | null>(eventFromUrl)
  const pushedEvent = useRef(false)
  const [home, setHome] = useState<Home | null>(loadHome)
  const [settingHome, setSettingHome] = useState(false)
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [filterOpen, setFilterOpen] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(loadExcluded)
  const [dashOpen, setDashOpen] = useState(false)
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null)
  const [introSeen, setIntroSeen] = useState<boolean>(
    () => localStorage.getItem('pmm.seenIntro') === '1',
  )
  // A shared ?plan= link is view-only until adopted — it must not overwrite local state.
  const [sharedPlan, setSharedPlan] = useState<string[] | null>(readPlanFromUrl)
  const [offline, setOffline] = useState(() => !navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/events.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: EventsFile) => {
        const events = json.events.map(normalizeEvent).filter((ev): ev is PokeEvent => ev !== null)
        setAddressCorpus(events.map((ev) => ev.address))
        setData({ ...json, events })
      })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    function onPop() {
      setTab(tabFromUrl())
      setSelectedId(eventFromUrl())
      pushedEvent.current = false
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const events = useMemo(() => data?.events ?? [], [data])

  // Deep link: center the map on the linked event once data arrives.
  useEffect(() => {
    if (!data) return
    const id = eventFromUrl()
    if (!id) return
    const ev = data.events.find((e) => e.id === id)
    if (ev) setFlyTarget({ lat: ev.lat, lng: ev.lng, seq: 1 })
  }, [data])

  const filtered = useMemo(
    () =>
      events.filter(
        (ev) => filters.types.includes(ev.type) && filters.regions.includes(ev.region),
      ),
    [events, filters],
  )

  const isChecked = (id: string) => (sharedPlan ? sharedPlan.includes(id) : !excluded.has(id))

  function goTab(t: Tab) {
    if (t === tab) return
    window.history.pushState({}, '', urlWith({ tab: t === 'map' ? null : t, event: null }))
    setTab(t)
    setSelectedId(null)
    pushedEvent.current = false
  }

  function openEvent(id: string) {
    if (selectedId === null) {
      window.history.pushState({}, '', urlWith({ event: id }))
      pushedEvent.current = true
    } else {
      window.history.replaceState({}, '', urlWith({ event: id }))
    }
    setSelectedId(id)
  }

  function closeEvent() {
    if (pushedEvent.current) {
      window.history.back() // popstate clears state
    } else {
      window.history.replaceState({}, '', urlWith({ event: null }))
      setSelectedId(null)
    }
  }

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

  function dismissIntro() {
    localStorage.setItem('pmm.seenIntro', '1')
    setIntroSeen(true)
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
    dismissIntro()
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

  function flyToEvent(ev: PokeEvent) {
    if (tab !== 'map') goTab('map')
    openEvent(ev.id)
    setFlyTarget((prev) => ({ lat: ev.lat, lng: ev.lng, seq: (prev?.seq ?? 0) + 1 }))
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
  const showIntro = !introSeen && !home && !sharedPlan && data !== null && tab === 'map'

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="logo" />
          <span className="topbar-title">Pokémon Majors Map</span>
        </h1>
        <div className="topbar-actions">
          <button
            className={`btn btn-small${isFiltered(filters) ? ' btn-filtered' : ''}`}
            onClick={() => setFilterOpen(true)}
          >
            Filter{isFiltered(filters) ? ' •' : ''}
          </button>
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

      <main className="content">
        {/* Loading/offline status (UX audit P2-16); role="status" announces politely */}
        {!data && !loadError && (
          <div className="status-pill" role="status">
            Loading events…
          </div>
        )}
        {offline && dataDate && (
          <div className="status-pill" role="status">
            Offline — showing data from {dataDate}
          </div>
        )}
        {tab === 'map' && (
          <div className="map-wrap">
            <MapView
              events={filtered}
              home={home}
              isChecked={isChecked}
              settingHome={settingHome}
              onPickHome={setHomePin}
              onSelect={(id) => {
                openEvent(id)
                setSettingHome(false)
              }}
              dataDate={dataDate}
              flyTarget={flyTarget}
            />
            <button className="dash-toggle btn" onClick={() => setDashOpen((v) => !v)}>
              {dashOpen ? '▾ My season' : '▴ My season'}
            </button>
            {dashOpen && (
              <div className="dash-panel">
                <Dashboard
                  events={filtered}
                  isChecked={isChecked}
                  onToggle={toggle}
                  onSelect={(id) => {
                    openEvent(id)
                    setDashOpen(false)
                  }}
                />
              </div>
            )}
            {showIntro && (
              <div className="intro-card">
                <button className="icon-btn intro-close" onClick={dismissIntro} aria-label="Dismiss">
                  ✕
                </button>
                <p className="intro-lead">
                  <b>Plan your Play! Pokémon season.</b> Pin your home to see how far each event
                  is and when to book travel.
                </p>
                <div className="intro-legend">
                  {EVENT_TYPES.map((t) => (
                    <span key={t}>
                      <span className={`dot type-${t}`} /> {EVENT_TYPE_LABEL[t]}
                    </span>
                  ))}
                </div>
                <div className="intro-actions">
                  <button className="btn btn-primary" onClick={useMyLocation}>
                    📡 Use my location
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      dismissIntro()
                      setSettingHome(true)
                    }}
                  >
                    Tap the map instead
                  </button>
                </div>
              </div>
            )}
            {selected && (
              <EventSheet onDismiss={closeEvent}>
                <EventCard
                  ev={selected}
                  home={home}
                  checked={isChecked(selected.id)}
                  onToggle={toggle}
                  onClose={closeEvent}
                  onFly={flyToEvent}
                />
              </EventSheet>
            )}
          </div>
        )}
        {tab === 'map' && (
          <TimelineView
            events={filtered}
            isChecked={isChecked}
            onFly={flyToEvent}
            onOpen={(ev) => openEvent(ev.id)}
          />
        )}
        {tab === 'schedule' && (
          <ScheduleView events={filtered} home={home} isChecked={isChecked} onToggle={toggle} onFly={flyToEvent} />
        )}
        {tab === 'itinerary' && (
          <ItineraryView events={events} home={home} isChecked={isChecked} onToggle={toggle} onFly={flyToEvent} />
        )}
        {tab !== 'map' && (
          <footer className="footer">
            <p>
              v{__APP_VERSION__}
              {dataDate && <> · data {dataDate}</>}
            </p>
            <p className="disclaimer">
              This is a fan project. Not affiliated with, endorsed, or sponsored by Nintendo, The
              Pokémon Company International, or Game Freak. Pokémon and all related media are
              trademarks of their respective owners.
            </p>
          </footer>
        )}
      </main>

      {filterOpen && (
        <FilterPanel filters={filters} onChange={updateFilters} onClose={() => setFilterOpen(false)} />
      )}

      <nav className="tabbar">
        <button className={tab === 'map' ? 'tab-on' : ''} onClick={() => goTab('map')}>
          🗺️ Map
        </button>
        <button className={tab === 'schedule' ? 'tab-on' : ''} onClick={() => goTab('schedule')}>
          📅 Schedule
        </button>
        <button className={tab === 'itinerary' ? 'tab-on' : ''} onClick={() => goTab('itinerary')}>
          🧳 Itinerary
        </button>
      </nav>
    </div>
  )
}
