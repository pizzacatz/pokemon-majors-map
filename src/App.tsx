import { useEffect, useMemo, useRef, useState } from 'react'
import type { EventsFile, Home, PokeEvent } from './types'
import { EVENT_TYPES, EVENT_TYPE_LABEL } from './types'
import MapView, { type FlyTarget } from './components/MapView'
import TimelineView from './components/TimelineView'
import EventCard from './components/EventCard'
import EventSheet from './components/EventSheet'
import FilterPanel, { isFiltered } from './components/Filters'
import Dashboard from './components/Dashboard'
import ScheduleView, { type SchedView } from './components/ScheduleView'
import { reverseGeocodeCountry } from './lib/geo'
import { conflictIds, planEvents } from './lib/plan'
import {
  type Filters,
  loadFilters,
  loadHome,
  loadPlan,
  migratePlan,
  saveFilters,
  saveHome,
  savePlan,
} from './lib/storage'
import { clearPlanFromUrl, readPlanFromUrl } from './lib/share'
import { normalizeEvent } from './lib/normalize'
import { setFitCorpus } from './lib/textFit'

type Tab = 'map' | 'schedule'

function tabFromUrl(): Tab {
  const t = new URLSearchParams(window.location.search).get('tab')
  // 'itinerary' is the pre-0.8 name for the plan view of the schedule
  return t === 'schedule' || t === 'itinerary' ? 'schedule' : 'map'
}

function viewFromUrl(): SchedView {
  const p = new URLSearchParams(window.location.search)
  return p.get('view') === 'plan' || p.get('tab') === 'itinerary' ? 'plan' : 'all'
}

function eventFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('event')
}

type Theme = 'light' | 'dark'

const systemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

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
  const [schedView, setSchedView] = useState<SchedView>(viewFromUrl)
  const [selectedId, setSelectedId] = useState<string | null>(eventFromUrl)
  const pushedEvent = useRef(false)
  const [home, setHome] = useState<Home | null>(loadHome)
  const [settingHome, setSettingHome] = useState(false)
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [filterOpen, setFilterOpen] = useState(false)
  const [plan, setPlan] = useState<Set<string>>(() => loadPlan() ?? new Set())
  const [dashOpen, setDashOpen] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  // System theme by default; an explicit toggle choice persists (index.html
  // resolves the same rule before first paint to avoid a flash).
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('pmm.theme')
    return saved === 'light' || saved === 'dark' ? saved : systemTheme()
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // Keep the browser chrome (iOS status bar, Android address bar) in sync.
    document
      .querySelector('meta[name="theme-color"]:not([media])')
      ?.setAttribute('content', theme === 'dark' ? '#201812' : '#fdefdf')
  }, [theme])

  // Countdowns compute at render time — a PWA left open overnight would
  // show yesterday's numbers. Re-render when the tab becomes visible.
  const [, setDayTick] = useState(0)
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') setDayTick((n) => n + 1)
    }
    document.addEventListener('visibilitychange', tick)
    return () => document.removeEventListener('visibilitychange', tick)
  }, [])

  // A fresh service worker installed behind this session — offer a refresh.
  useEffect(() => {
    const onUpdate = () => setUpdateReady(true)
    window.addEventListener('pmm-sw-updated', onUpdate)
    return () => window.removeEventListener('pmm-sw-updated', onUpdate)
  }, [])

  // Track OS theme changes while the user hasn't chosen explicitly.
  useEffect(() => {
    if (localStorage.getItem('pmm.theme')) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const follow = () => setTheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', follow)
    return () => mq.removeEventListener('change', follow)
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('pmm.theme', next)
    setTheme(next)
  }
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
        setFitCorpus('title', events.map((ev) => ev.name))
        setFitCorpus('address', events.map((ev) => ev.address))
        // One-time migration from the pre-0.10 opt-out model.
        setPlan(migratePlan(events.map((ev) => ev.id)))
        setData({ ...json, events })
      })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    function onPop() {
      setTab(tabFromUrl())
      setSchedView(viewFromUrl())
      setSelectedId(eventFromUrl())
      pushedEvent.current = false
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const events = useMemo(() => data?.events ?? [], [data])

  // The map remounts on tab return; a stale fly target would replay its
  // flight. Coming back to the Map tab must not fly anywhere.
  useEffect(() => {
    if (tab !== 'map') setFlyTarget(null)
  }, [tab])

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

  const isPlanned = (id: string) => (sharedPlan ? sharedPlan.includes(id) : plan.has(id))
  // With no plan yet, nothing is de-emphasized — dimming only means something
  // once there's a plan to contrast against.
  const planSize = sharedPlan ? sharedPlan.length : plan.size
  const isEmphasized = (id: string) => planSize === 0 || isPlanned(id)

  // Weekend clashes within the plan — badged wherever the plan is visible.
  const conflicts = useMemo(
    () => conflictIds(planEvents(events, isPlanned)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, plan, sharedPlan],
  )

  function goTab(t: Tab) {
    if (t === tab) return
    window.history.pushState({}, '', urlWith({ tab: t === 'map' ? null : t, event: null, view: null }))
    setTab(t)
    setSchedView(viewFromUrl())
    setSelectedId(null)
    pushedEvent.current = false
  }

  function changeSchedView(v: SchedView) {
    window.history.replaceState({}, '', urlWith({ view: v === 'plan' ? 'plan' : null }))
    setSchedView(v)
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
    setPlan((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      savePlan(next)
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

  function flyHome() {
    if (!home) return
    if (tab !== 'map') goTab('map')
    if (selectedId !== null) closeEvent()
    // Wider view than an event close-up: home is a vantage point, not a venue.
    setFlyTarget((prev) => ({
      lat: home.lat,
      lng: home.lng,
      seq: (prev?.seq ?? 0) + 1,
      zoom: 4,
      offset: false,
    }))
  }

  function adoptSharedPlan() {
    if (!sharedPlan) return
    const next = new Set(sharedPlan)
    setPlan(next)
    savePlan(next)
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
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="logo" />
          <span className="topbar-title">Majors Map</span>
        </h1>
        <div className="topbar-actions">
          <button
            className="btn btn-small"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className={`btn btn-small${isFiltered(filters) ? ' btn-filtered' : ''}`}
            onClick={() => setFilterOpen(true)}
          >
            Filter{isFiltered(filters) ? ' •' : ''}
          </button>
          {home ? (
            <button className="btn btn-small" onClick={flyHome}>
              🏠 Home
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
        {updateReady && !offline && (
          <div className="status-pill status-pill-action" role="status">
            New version ready
            <button className="btn btn-small btn-primary" onClick={() => window.location.reload()}>
              Refresh
            </button>
          </div>
        )}
        {tab === 'map' && (
          <div className="map-wrap">
            <MapView
              events={filtered}
              home={home}
              isChecked={isEmphasized}
              settingHome={settingHome}
              onPickHome={setHomePin}
              onSelect={(id) => {
                openEvent(id)
                setSettingHome(false)
              }}
              onMoveHome={() => setSettingHome(true)}
              dataDate={dataDate}
              flyTarget={flyTarget}
              highlightIds={[selectedId, hoverId].filter((id): id is string => id !== null)}
            />
            <button className="dash-toggle btn" onClick={() => setDashOpen((v) => !v)}>
              {dashOpen ? '▾' : '▴'} My plan · {planEvents(filtered, isPlanned).length}
            </button>
            {dashOpen && (
              <div className="dash-panel">
                <Dashboard
                  events={filtered}
                  isChecked={isPlanned}
                  onToggle={toggle}
                  onSelect={openEvent}
                  onHover={setHoverId}
                  conflicts={conflicts}
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
                  is and when to book travel, then check events to build your plan.
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
                  checked={isPlanned(selected.id)}
                  conflict={conflicts.has(selected.id)}
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
            isChecked={isEmphasized}
            onFly={flyToEvent}
            onOpen={(ev) => openEvent(ev.id)}
            onHover={setHoverId}
          />
        )}
        {tab === 'schedule' && (
          <ScheduleView
            events={filtered}
            home={home}
            isChecked={isPlanned}
            onToggle={toggle}
            onFly={flyToEvent}
            view={schedView}
            onViewChange={changeSchedView}
            conflicts={conflicts}
          />
        )}
        {tab !== 'map' && (
          <footer className="footer">
            <p>
              <a href="https://georgiaplayevents.com">georgiaplayevents.com</a> · v
              {__APP_VERSION__}
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
      </nav>
    </div>
  )
}
