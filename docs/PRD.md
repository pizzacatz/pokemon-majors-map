# PRD — Pokémon Majors Map

**Version:** 1.0 · **Date:** 2026-07-15 · **Status:** Approved for v1 build

## 1. Overview

A mobile-first, single-page web app that shows all Play! Pokémon **major events** (Regional
Championships, Special Events, International Championships, and the World Championships)
on an interactive world map. The map defaults to a view of the continental United States;
once a user pins their home location it centers there instead. Each event pin carries the
information a competitor needs to plan a trip: what and when the event is, how many days
remain, when to book travel, where to register on RK9.gg, and a shortcut to hotels near
the venue.

There is **no backend**. The site is static (GitHub Pages). Event data lives in a JSON file
in the repository, refreshed by a scheduled GitHub Actions scraper. All personal state
(home pin, event checklist, itinerary) lives in the browser's `localStorage`.

## 2. Audience

- **Primary:** the repo owner, planning their own competitive season.
- **Secondary:** the public Play! Pokémon community (TCG, VGC, GO players). The app is
  public and must work well for anyone with no configuration.
- **Device:** phones first. All layouts are designed at 375 px width and scale up.

## 3. Goals / Non-goals

### Goals (v1)

1. See every announced major worldwide on one map, centered on home.
2. Answer at a glance: *how far away is it, how long until it, and when do I need to book?*
3. Plan a season: check/uncheck events, view a chronological schedule, export to calendar,
   share the plan as a URL.
4. Zero recurring cost: static hosting, no API keys, no paid services.

### Non-goals (v1)

- **No accounts or cross-device sync** — localStorage only.
- **No push/email notifications** — requires a backend.
- **No live airfare or hotel data** — travel timing is heuristic; hotels are deep links.
- **No affiliate monetization yet** — links are plain; an affiliate ID slot is reserved.
- **No league/local event coverage** — majors only.
- **No registration-open tracking in v1** — see §10 (v2). The schema reserves a field so
  the UI lights up when data appears.

## 4. Features (v1)

### 4.1 Map view

- Leaflet map with OpenStreetMap tiles; no API key.
- One pin per event, color-coded by event type (Regional / Special / International / Worlds)
  and grayed out when unchecked in the dashboard (§4.4) or when the event is in the past.
- Default viewport: continental US. If a home pin exists in localStorage, center on it.
- Tapping a pin opens an event card (bottom sheet on mobile, popup on desktop) — never a
  full-screen modal — with:
  - Event name, type badge, format availability (TCG / VGC / GO)
  - Dates (venue-local) and **days-left countdown**
  - Venue name + city/country, distance from home, travel-mode badge (drive / fly)
  - **Book-travel-by date** (§4.6)
  - Links: RK9.gg registration page, official event page, **Hotels nearby** (§4.7)
  - **Add to Google Calendar** button + **.ics download**
  - Checkbox: include/exclude from my season (syncs with dashboard)
- Events with announced location but unconfirmed dates render with a "Dates TBD" badge and
  no countdown.

### 4.2 Home pin

- "Set home" control: tap the map to drop a home pin, or use browser geolocation
  (permission-gated, never requested on load).
- Stored as `{lat, lng}` in localStorage; map centers there on every visit.
- Clearable. With no home pin, distance/travel-mode/book-by fields show a
  "set your home to see travel info" hint.

### 4.3 Filters

- Chips for event type (Regional / Special / International / Worlds) and game format
  (TCG / VGC / GO), plus a region selector (NA / EU / LATAM / OCE / APAC).
- Filters apply to map, schedule, and dashboard alike. Persisted in localStorage.

### 4.4 Season dashboard (checklist)

- A compact list of all (filtered) upcoming majors with a checkbox each.
- Unchecking grays the pin on the map and drops the event from the itinerary and share
  link. Everything starts checked.
- State persisted in localStorage keyed by event id.

### 4.5 Schedule (chronological view)

- A date-sorted list of upcoming majors — the phone-friendly alternative to panning a
  world map. Same cards, same data, grouped by month.
- Past events are pruned from the data by the daily scraper (owner decision
  2026-07-15): the site carries future events only. The UI retains a collapsed
  "Past" section purely as graceful degradation for stale offline caches.

### 4.6 Itinerary tab

- Only **checked** events, in date order, presented as a season plan: for each event, the
  countdown, book-travel-by date, and calendar/registration/hotel links.
- **Weekend-conflict flag:** two checked events sharing a weekend get a warning badge
  (rare, but cheap to detect).
- **Share my season:** copies a URL encoding the checked event ids
  (`?plan=<ids>`). Opening a plan URL shows the shared selection with a banner offering
  "view only" or "make this my plan" — it must not silently overwrite local state.

### 4.7 Travel heuristics

Computed client-side from great-circle distance between home pin and venue:

| Distance from home       | Mode  | Guidance shown                                   |
| ------------------------ | ----- | ------------------------------------------------ |
| < 350 mi                 | Drive | "Book hotel by" = event − 30 days                |
| ≥ 350 mi, same country   | Fly   | "Book flights by" = event − 45 days (window 45–75) |
| Different country        | Fly   | "Book flights by" = event − 90 days (window 90–150) |

Dates already inside the window show "book now"; past-window shows "book ASAP".
The heuristic lives in one module (`src/lib/travel.ts`) so a future live-fare source only
replaces the computation, not the UI.

### 4.8 Hotels

No hotel data is fetched. "Hotels nearby" is a **deep link** to a Booking.com search
pre-filled with the venue coordinates and the event's check-in/check-out dates
(day before → day after). A single constant holds the (currently empty) affiliate ID so
monetization later is a one-line change.

### 4.9 Calendar export

- **Google Calendar:** templated `calendar.google.com/calendar/render?action=TEMPLATE`
  URL — no API.
- **.ics download:** generated client-side; covers Apple/Outlook. Itinerary tab also
  offers a single .ics containing every checked event.

### 4.10 PWA

- Web manifest + service worker (cache-first for the app shell, stale-while-revalidate
  for `events.json`), making the app installable and usable offline with last-known data.
- **No install prompt, modal, or nag.** Installation is left to the browser's native UI.

### 4.12 Season timeline (added 2026-07-15)

- Horizontal, scrollable timeline strip on the Map tab: **today anchored at
  the far left**, scale runs to the farthest announced event date.
- Each event is a tick colored by event type, with the event name in a bubble
  above it (staggered across three heights to limit overlap) and its date
  below the axis. Unchecked events gray out, consistent with the map.
- Every bubble has a 📍 **fly** button: the map animates (`flyTo`) to the
  event's venue and opens its event card.
- Collapsible; month boundaries are marked along the axis.

### 4.11 Versioning on the site

- Semantic versioning, tracked in `CHANGELOG.md` (Keep a Changelog format).
- The app version (from `package.json`) and the data snapshot date (from `events.json`
  metadata) render in the footer, e.g. `v0.1.0 · data 2026-07-15`.

## 5. Data

### 5.1 Sources

| Source                          | Used for                                        |
| ------------------------------- | ----------------------------------------------- |
| pokedata.ovh                    | General event listings (community aggregator)   |
| championships.pokemon.com       | Official specifics: names, dates, venues, links |
| rk9.gg                          | Registration page URLs                          |

Neither source has a public API; the scraper prefers the JSON endpoints the official
site's frontend fetches, with HTML parsing as fallback.

### 5.2 Event schema (`public/data/events.json`)

```jsonc
{
  "meta": {
    "generatedAt": "2026-07-15T00:00:00Z",
    "source": "seed | scraper",
    "schemaVersion": 1
  },
  "events": [
    {
      "id": "worlds-2026-san-francisco",       // stable slug
      "name": "2026 Pokémon World Championships",
      "type": "worlds",                        // regional | special | international | worlds
      "formats": ["tcg", "vgc", "go"],
      "startDate": "2026-08-28",               // venue-local, ISO; null if TBD
      "endDate": "2026-08-30",
      "venue": "Moscone Center",               // null if unconfirmed
      "city": "San Francisco",
      "country": "US",                         // ISO 3166-1 alpha-2
      "region": "NA",                          // NA | EU | LATAM | OCE | APAC
      "lat": 37.7842,                          // pre-geocoded; venue if known, else city
      "lng": -122.4016,
      "links": {
        "official": "https://championships.pokemon.com/...",
        "registration": "https://rk9.gg/..."   // null until posted
      },
      "registrationOpens": null                // reserved for v2 (ISO datetime)
    }
  ]
}
```

### 5.3 Scraper (`scraper/scrape.mjs`, Node 22, no heavy deps)

- Runs **daily** via GitHub Actions cron and on manual dispatch.
- Pipeline: fetch sources → parse → normalize to schema → **geocode new venues once**
  via Nominatim (1 req/s, cached in `scraper/geocache.json`, committed) → validate →
  diff against current file → commit only if changed.
- **Fail-safe rules:**
  - Schema validation failure, an empty event list, or a >50 % drop in event count
    aborts the commit — last good data stays live.
  - On abort, the workflow opens/updates a GitHub issue labeled `scraper` with the error.
- Merge strategy: official site wins on conflicts; pokedata fills gaps; manual overrides
  in `scraper/overrides.json` win over everything (escape hatch for wrong geocodes etc.).

### 5.4 Seed data

The repo ships with a hand-verified seed (Worlds 2026, LAIC/EUIC/NAIC 2027, announced
regionals) so the site works before the first scraper run. Development-environment
network limits mean the seed is compiled from search snapshots; the first CI scraper run
replaces it wholesale.

## 6. Architecture & stack

| Concern    | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Framework  | React 19 + TypeScript + Vite                              |
| Map        | Leaflet 1.9 + react-leaflet 5, OSM raster tiles           |
| Dates      | Native `Date`/`Intl` + small helpers (no moment/dayjs)    |
| State      | React state + localStorage (no state library)             |
| Styling    | Hand-rolled CSS (custom properties, dark-mode aware)      |
| Hosting    | GitHub Pages (`base: /pokemon-majors-map/`)               |
| CI         | Actions: `deploy.yml` (build → Pages), `scrape.yml` (cron) |

Tabs: **Map · Schedule · Itinerary** in a bottom nav (mobile) / top bar (desktop).
The dashboard checklist lives in a slide-up panel on the Map tab.

## 7. Legal

- Uses official Pokémon logos/artwork with a permanent footer disclaimer: *"This is a fan
  project. Not affiliated with, endorsed, or sponsored by Nintendo, The Pokémon Company
  International, or Game Freak. Pokémon and all related media are trademarks of their
  respective owners."*
- **Accepted risk** (owner decision, 2026-07-15): trademark/copyright takedown. Fallback
  plan: swap official assets for original iconography; the asset layer is isolated in
  `src/assets/` to make that a contained change.
- Scraping targets' ToS may prohibit automated access; volume is one fetch/day.

## 8. Success criteria (v1)

- Lighthouse mobile: Performance ≥ 90, PWA installable.
- Cold load ≤ 200 KB gzipped JS (excluding map tiles).
- All v1 features functional offline after first visit (with stale data).
- Scraper runs green daily; a source-format change degrades to stale data + an issue,
  never a broken site.

## 9. Release plan

- `0.1.0` — everything in §4, seed data, scraper + workflows. (This build.)
- `0.x` — scraper hardening against real-world source output, data corrections.
- `1.0.0` — first version validated against a full scraper cycle in production.

## 10. v2 backlog

1. **Registration-open tracking.** RK9 announces openings on X/Twitter, but the X API is
   paid and restrictive. Preferred approach instead: the daily scraper polls each known
   RK9 event page and flips `registrationOpens`/`links.registration` when a registration
   form appears — no Twitter dependency, uses infrastructure we already have. A cron
   reading tweets remains a fallback investigation.
2. **Affiliate monetization** — fill the reserved Booking.com affiliate ID; evaluate
   Stay22/Travelpayouts.
3. **Live airfare window** (Amadeus/Travelpayouts) replacing the heuristic in
   `src/lib/travel.ts`.
4. Sold-out / capacity status per event, if scrapeable from RK9.
5. Multi-home support (e.g., "home" and "parents' place").
