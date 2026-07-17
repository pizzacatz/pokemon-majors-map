# PRD — Map of Pokémon Championships

**Version:** 2.0 · **Updated:** 2026-07-17 · **Status:** Living document (reflects v0.12)

Part of the GeorgiaPlayEvents (GPE) network. Formerly "Pokémon Majors Map"; renamed
in v0.12 with the move to https://majors.georgiaplayevents.com/.

## 1. Overview

A mobile-first, single-page web app that shows all Play! Pokémon **major events**
(Regional Championships, Special Events, International Championships, and the World
Championships) on an interactive world map. The map defaults to a view of the
continental United States; once a user pins their home location it centers there
instead. Each event carries what a competitor needs to plan a trip: what and when the
event is, how many days remain, when to book travel, whether registration is open on
RK9.gg, and shortcuts to flights and hotels.

There is **no backend**. The site is static (GitHub Pages behind a custom domain).
Event data lives in a JSON file in the repository, refreshed by a scheduled GitHub
Actions scraper. All personal state (home pin, season plan, theme) lives in the
browser's `localStorage`.

Two tabs: **Map** (with the season timeline and plan strip) and **Schedule** (with an
All events / My plan toggle).

## 2. Audience

- **Primary:** the repo owner, planning their own competitive season.
- **Secondary:** the public Play! Pokémon community. The app is public and must work
  well for anyone with no configuration.
- **Device:** phones first. All layouts are designed at 375 px width and scale up;
  desktop gets a fit-to-width timeline and landscape gets a left-rail tab bar.

## 3. Goals / Non-goals

### Goals

1. See every announced major worldwide on one map, centered on home.
2. Answer at a glance: *how far away is it, how long until it, and when do I need to book?*
3. Plan a season deliberately: an opt-in plan, a chronological schedule, calendar
   export, weekend-conflict warnings, and a shareable plan URL.
4. Zero recurring cost: static hosting, no API keys, no paid services.

### Non-goals

- **No accounts or cross-device sync** — localStorage only.
- **No push/email notifications** — requires a backend (see §10).
- **No live airfare or hotel data** — travel timing is heuristic; flights/hotels are
  deep links.
- **No affiliate monetization yet** — links are plain; an affiliate ID slot is reserved.
- **No league/local event coverage** — majors only.

## 4. Features

### 4.1 Map view

- Leaflet map with OpenStreetMap tiles; no API key. (Tile config is isolated to one
  seam in `MapView.tsx` for a future keyed provider.)
- One pin per event, color-coded by event type (Regional / Special / International /
  Worlds). Past events gray out; once a plan exists, unplanned events recede at
  reduced opacity (type color kept). The open card's pin — or one hovered in the
  timeline/plan strip — enlarges and pulses.
- Default viewport: continental US. If a home pin exists, center on it. The top-bar
  🏠 Home button flies back to home at a wide zoom.
- Tapping a pin opens the event card in a content-height bottom sheet (drag down to
  dismiss; no expand state) with:
  - Type badge and the official event name on one auto-scaling line
  - Dates (venue-local), **days-left countdown**, a green **Reg open** badge when an
    RK9 registration link exists, and an **Add to calendar ▾** menu (Google / .ics)
  - Venue name (📍 = show on map) and one-line street address
  - Distance from home and **book-flights-by date** (§4.7)
  - ⚠ line if it clashes with another planned event
  - Buttons: **Register on RK9** (struck-through and inert until the link exists),
    Event page, **Flights**, **Hotels** (§4.8)
  - Checkbox: **In my plan** (§4.4)
- Events with announced location but unconfirmed dates render a "Dates TBD" badge and
  no countdown.
- Tabs and the open card live in the URL: Android back dismisses the card and walks
  tabs; every event is deep-linkable (`?event=<id>`).

### 4.2 Home pin

- "Set home" control: tap the map to drop a home pin, or use browser geolocation
  (permission-gated, never requested on load).
- Stored as `{lat, lng, country}` in localStorage; map centers there on every visit.
- The home marker's popup ("Home — distances measure from here") carries the
  **Move home** button. Clearable from the move-home banner. With no home pin,
  travel fields show a "set your home" hint.

### 4.3 Filters

- A Filter panel behind a top-bar button (with active-filter indicator and Reset):
  event type chips that double as the pin-color legend, plus region
  (NA / EU / LATAM / OCE / APAC). Persisted in localStorage.
- Game-format filtering was removed in v0.6 — every major runs TCG/VGC/GO, so the
  data field is kept but not surfaced.

### 4.4 Season plan (opt-in)

- The plan starts empty; users add events via row/card checkboxes ("In my plan").
- Until a plan exists nothing on the map is de-emphasized; once it has members,
  unplanned pins/timeline bubbles recede (type color kept, reduced opacity).
- The map carries a "My plan · n" strip (checked events, days-left, conflicts,
  hover-highlights its pin, stays open while browsing); the Schedule tab has an
  All events / My plan toggle with share + season-.ics actions.
- **Weekend-conflict flag:** two planned events sharing a weekend get a ⚠ on rows,
  strip, and card.
- **Share my plan:** native share sheet (clipboard fallback) with a URL encoding the
  planned event ids (`?plan=<ids>`). Opening a plan URL shows the shared selection
  with a banner offering "make it my plan" — it never silently overwrites local state.
- State persisted in localStorage (`pmm.plan`, event ids). Pre-0.10 opt-out state
  (`pmm.excluded`) migrates once: engaged users keep their effective plan.

### 4.5 Schedule tab

- Date-sorted compact rows (checkbox, type dot, short title, dates without year,
  days-left) under sticky month headers; tapping a row expands the full event card
  in place (title bar or ✕ collapses it).
- **All events / My plan (· n)** segmented toggle — the plan view carries Share and
  season-.ics actions. The view is in the URL (`?view=plan`; legacy `?tab=itinerary`
  links land there).
- **Search-as-you-type** across city, venue, event name, and country.
- Past events are pruned from published data by the daily scraper; the UI retains a
  collapsed "Past" section purely as graceful degradation for stale offline caches.

### 4.6 Season timeline

- Horizontal strip on the Map tab: **today anchored at the far left**, scale runs to
  the farthest announced event.
- **Gap compression:** days within a week of the previous event get full resolution;
  longer empty stretches compress to a trickle, so width goes to events. On desktop
  (or whenever the season fits) the strip scales to the exact screen width — no
  horizontal scrolling; phones scroll a full season.
- Each event is a type-colored tick with a min-content name bubble, packed into
  collision-aware lanes (lowest bubbles layer on top). Date labels sit under the
  axis with month labels on their own row; both thin out when packed.
- Tapping a bubble's **name** opens the card in place; the 📍 flies the map to the
  venue. Hovering a bubble highlights the event's pin. Unplanned events dim once a
  plan exists.
- Collapsed by default on phones (persisted): a one-line strip counts down to the
  next event **in your plan** ("Next: Worlds · 43d").

### 4.7 Travel heuristics

Computed client-side from great-circle distance between home pin and venue.
Flights-only (no drive/fly mode shown):

| Trip              | Guidance shown                                       |
| ----------------- | ---------------------------------------------------- |
| Same country      | "Book flights by" = event − 45 days (window 45–75)   |
| Different country | "Book flights by" = event − 90 days (window 90–150)  |

Dates inside the window show "book now"; past-window shows "book ASAP". The heuristic
lives in `src/lib/travel.ts` so a future live-fare source only replaces the
computation, never the UI.

### 4.8 Flights & hotels

No travel data is fetched; both are **deep links**:

- **Flights:** Google Flights natural-language query with the destination and the
  event's dates (day before → day after). Origin is inferred by Google — no home
  data leaves the app.
- **Hotels:** Booking.com search pre-filled with the venue and check-in/check-out.
  A single constant holds the (currently empty) affiliate ID so monetization later
  is a one-line change.

### 4.9 Calendar export

- **Add to calendar ▾** menu on each card: Google Calendar (templated URL, no API)
  or client-side `.ics` (Apple/Outlook). The plan view offers a single `.ics` with
  every planned event.

### 4.10 PWA

- Web manifest (PNG 192/512 + maskable icons) + service worker: network-first for
  navigations and `events.json` (deploys and fresh data appear on next load),
  stale-while-revalidate for hashed assets.
- When a new version installs behind a running session, a "New version ready —
  Refresh" pill offers a one-tap reload.
- **No install prompt, modal, or nag.** Installation is left to the browser's UI.
- Countdowns recompute when the tab becomes visible again.

### 4.11 Versioning on the site

- Semantic versioning, tracked in `CHANGELOG.md` (Keep a Changelog format).
- The footer (Schedule tab) shows the app version, the data snapshot date, and links
  to georgiaplayevents.com, alongside the non-affiliation disclaimer.

### 4.12 Branding & theming

- Named **Map of Pokémon Championships**, "part of the GPE network" subtitle in the
  header linking to georgiaplayevents.com. Brand assets (peach-Pokéball logo, icons,
  OG card) come from `pizzacatz/GeorgiaPlayEventsAssets`.
- **Light mode:** warm cream (`#fdefdf`) with burnt-orange accent (`#c85c24`).
- **Dark mode:** matches TeamSheet (`pizzacatz/team-sheet-builder`) — near-black
  `#0d0d0e` page, gray `#2f2f33` panels, peach `#ffb072` accent with dark button
  text; map tiles CSS-inverted.
- 🌗 toggle in the top bar; defaults to (and live-follows) the system theme until
  explicitly toggled, resolved before first paint. The browser theme-color follows.
- OG/Twitter meta + share card so links unfurl with the tagline: *"Find every
  Pokémon Championship on one map! Pin your home, plan your season, and count down
  the days!"*

## 5. Data

### 5.1 Sources (priority order)

| Source                          | Used for                                                     |
| ------------------------------- | ------------------------------------------------------------ |
| championships.pokemon.com       | **Primary** — announcements, names, dates, official links; per-event detail pages for venue + street address |
| rk9.gg                          | Registration page URLs (first-seen date stamped)              |
| pokedata.ovh                    | Gap-filling (community aggregator)                            |

The official site's own events API is fetched directly, with a headless-browser
network capture as a self-healing fallback; venue/address enrichment reads the same
content-store API the site's frontend uses. RK9 is HTML-parsed.

### 5.2 Event schema (`public/data/events.json`)

```jsonc
{
  "meta": {
    "generatedAt": "2026-07-16T00:00:00Z",
    "source": "seed | scraper",
    "schemaVersion": 1
  },
  "events": [
    {
      "id": "worlds-2026-san-francisco",       // stable slug
      "name": "2026 Pokémon World Championships",
      "type": "worlds",                        // regional | special | international | worlds
      "formats": ["tcg", "vgc", "go"],         // kept in data; not surfaced in UI
      "startDate": "2026-08-28",               // venue-local, ISO; null if TBD
      "endDate": "2026-08-30",
      "venue": "Moscone Center",               // null if unconfirmed
      "address": "747 Howard St., San Francisco, CA 94103, United States", // from official detail page
      "city": "San Francisco",
      "country": "US",                         // ISO 3166-1 alpha-2
      "region": "NA",                          // NA | EU | LATAM | OCE | APAC
      "lat": 37.7842,                          // geocoded: address > venue > city
      "lng": -122.4016,
      "links": {
        "official": "https://championships.pokemon.com/...",
        "registration": "https://rk9.gg/..."   // null until posted
      },
      "registrationOpens": null,               // reserved (ISO datetime)
      "registrationSeenAt": "2026-07-16"       // first day the scraper saw a reg link
    }
  ]
}
```

Every key is always present (explicit nulls): the merge layers prune nulls, and an
absent date key once black-screened the site. The client re-normalizes on load as a
second guard.

### 5.3 Scraper (`scraper/scrape.mjs`, Node 22, no heavy deps)

- Runs **daily** via GitHub Actions cron, on manual dispatch, and on pushes touching
  scraper files. A successful data commit triggers the deploy workflow.
- Pipeline: fetch sources → parse → normalize to schema → **geocode new venues**
  via Nominatim (1 req/s, cached in `scraper/geocache.json`, committed;
  address-first, venue and city fallbacks; (0,0) treated as ungeocoded) → merge →
  stamp `registrationSeenAt` → prune past events → validate → diff → commit only
  if changed.
- **Merge strategy:** official site wins on conflicts; RK9 fills registration
  links; pokedata fills gaps; manual overrides in `scraper/overrides.json` win over
  everything (also the escape hatch for removing unsourced events). Freshly scraped
  values beat stale baseline fields, and stale baseline entries that disagree with
  fresh data on (type, date) for the same city are dropped.
- **Fail-safe rules:** schema-validation failure, an empty event list, or a >50%
  drop in (future) event count aborts the commit — last good data stays live, and
  the workflow opens/updates a GitHub issue labeled `scraper`.

## 6. Architecture & stack

| Concern    | Choice                                                       |
| ---------- | ------------------------------------------------------------ |
| Framework  | React 19 + TypeScript + Vite                                 |
| Map        | Leaflet 1.9 + react-leaflet 5, OSM raster tiles              |
| Dates      | Native `Date`/`Intl` + small helpers (no moment/dayjs)       |
| State      | React state + localStorage (no state library)                |
| Styling    | Hand-rolled CSS (custom properties; `data-theme` light/dark) |
| Hosting    | GitHub Pages, custom domain majors.georgiaplayevents.com (`base: '/'`, `public/CNAME`) |
| CI         | Actions: `deploy.yml` (build → gh-pages), `scrape.yml` (cron) |

Tabs: **Map · Schedule** in a bottom nav (left rail in phone landscape). The plan
strip lives in a slide-down panel on the Map tab.

## 7. Legal

- GPE's own peach-Pokéball branding; permanent footer disclaimer: *"This is a fan
  project. Not affiliated with, endorsed, or sponsored by Nintendo, The Pokémon
  Company International, or Game Freak. Pokémon and all related media are trademarks
  of their respective owners."*
- **Accepted risk** (owner decision, 2026-07-15): trademark/copyright takedown.
- Scraping targets' ToS may prohibit automated access; volume is one fetch/day.

## 8. Success criteria

- Lighthouse mobile: Performance ≥ 90, PWA installable.
- Cold load ≤ 200 KB gzipped JS (excluding map tiles). (Currently ~118 KB.)
- All features functional offline after first visit (with stale data).
- Scraper runs green daily; a source-format change degrades to stale data + an
  issue, never a broken site.

## 9. Release history (major beats)

- `0.1.x` — v1 build: map, cards, plan, schedule, itinerary, PWA, scraper + workflows.
- `0.2.x` — real data hardening: official-site-first scraping, geocoding fixes,
  venue/address enrichment, season timeline.
- `0.3–0.5` — mobile UX overhaul (bottom sheet, space budget, first-run, history,
  card compression, timeline gap compression).
- `0.6–0.9` — refinements: one-line scaling text, pin highlighting, theme toggle,
  Schedule/Itinerary consolidation.
- `0.10` — opt-in plan model + audit №2 batch (search, OG meta, flights link,
  update toast, reg-open groundwork).
- `0.11–0.12` — GPE rebrand, TeamSheet dark palette, rename, custom domain.

## 10. v2 backlog

1. **Registration-open notifications.** The scraper already stamps
   `registrationSeenAt` when an RK9 link appears and the UI shows "Reg open";
   remaining work is alerting (web push needs a backend; a public RSS/JSON feed of
   changes is a zero-backend alternative).
2. **Affiliate monetization** — fill the reserved Booking.com affiliate ID; evaluate
   Stay22/Travelpayouts.
3. **Live airfare window** (Amadeus/Travelpayouts) replacing the heuristic in
   `src/lib/travel.ts`.
4. Sold-out / capacity status per event, if scrapeable from RK9.
5. Multi-home support (e.g., "home" and "parents' place").
6. Keyed tile provider (MapTiler/Stadia) if traffic outgrows OSM's public tiles.
7. Per-day event info (TCG/VGC/GO day schedules) if it becomes scrapeable.
