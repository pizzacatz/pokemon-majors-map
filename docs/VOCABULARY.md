# Technical Vocabulary — this project, three ways

The same story told three times: (1) in full industry jargon, (2) in plain
language with the matching technical term after each phrase, (3) as a
glossary table anchoring every term to the moment it appears in this
project. Read 1 to test yourself, 2 to decode it, 3 to make it stick.

---

## 1. The jargon-dense version

### What it is

pokemon-majors-map is a **backendless SPA** (**React 19** + **TypeScript** +
**Vite**) that renders a world map of Play! Pokémon **major events**
(Regionals, Special Events, Internationals, Worlds). There is no server at
runtime: the app is a **static build** (`vite build`, output in `dist/`)
that fetches one **static data file**, `public/data/events.json`, and
everything else — filtering, the season plan, the timeline layout — happens
**client-side**. The **schema** for that file is a TypeScript `interface`
(`PokeEvent` in `src/types.ts`): `type` is a **discriminated union**
(`'regional' | 'special' | 'international' | 'worlds'`), and every consumer
downstream assumes the **canonical shape** the schema promises.

### The data pipeline

Because there's no backend, freshness comes from a **scraper**
(`scraper/scrape.mjs`) run daily by a **GitHub Actions** **cron job**
(`scrape.yml`, `cron: '17 9 * * *'`). It has no official API to call, so it
does **embedded-JSON mining**: regexing `<script>` tags out of HTML and
`JSON.parse`-ing anything that looks like `window.__STATE__ = {...}` or a
`__NEXT_DATA__` blob (`extractJsonBlobs`), then walking the resulting tree
for objects that quack like events (`mineEventObjects`) via **key
canonicalization** (`canonKey` strips CMS type suffixes like `_s`/`_dt` off
Crafter-CMS field names). When the primary source is **client-side-rendered**
(a plain `fetch` sees an empty shell), the scraper falls back to a
**headless browser** (`playwright-core`, Chromium) and does **response
interception** (`page.on('response')`) to capture the JSON payloads the
page's own frontend fetches — i.e., it **reverse-engineers the API** from
observed network traffic rather than an announced contract.

Three sources are combined with an explicit **precedence order** (official
site wins conflicts, `rk9.gg` and `pokedata.ovh` fill gaps, manual
`scraper/overrides.json` wins over all) via `mergeOne`/`merge`, followed by
**deduplication** on a `(type, startDate, city)` composite key with a
**freshness-wins** tiebreak (`dedupe`) so a stale cached entry can't
overwrite a freshly-scraped one — plus a second **fuzzy pass** that
collapses same-type/date entries whose city names are word-prefix related
("Frankfurt" / "Frankfurt am Main") or whose event names are identical,
since sources name the same city differently. Coordinates come from **geocoding**
(OpenStreetMap's **Nominatim**), which is **rate-limited** (1.1s between
requests per usage policy) and backed by a **cache file**
(`scraper/geocache.json`) so re-running the scraper doesn't re-geocode
unchanged venues. The whole pipeline is wrapped in a **fail-safe contract**:
`validate()` runs sanity checks (nonzero count, no >50% drop, every event
geocoded) and the script **exits non-zero without writing** on any failure,
so a broken upstream page never **blackholes** the live site — the last
good snapshot keeps serving and a **CI job** files a GitHub issue instead.
A separate `deploy.yml` **workflow** publishes `dist/` to a `gh-pages`
branch; because commits made with the scrape job's `GITHUB_TOKEN` don't
**cascade-trigger** other workflows, `scrape.yml` explicitly re-triggers
`deploy.yml` (`gh workflow run`) when data changed.

### Rendering, state, and the map

The UI is built from **function components** using **React hooks**
(`useState`, `useEffect`, `useMemo`, `useRef`) — no class components, no
external state library. The **source of truth** for navigation (active tab,
open event, schedule sub-view) is deliberately the **URL query string**, not
just component state: `App.tsx` reads it on mount and calls
`history.pushState`/`replaceState` on changes, with a `popstate` listener to
resync — this makes every event **deep-linkable** and gives the Android
back button a natural **navigation stack** (closes the sheet before it
exits the app) instead of default SPA history behavior.

The map itself is **Leaflet** wrapped by **react-leaflet** —
`MapContainer`/`TileLayer`/`Marker`/`Popup` **declarative components** over
an **imperative** Leaflet map instance, reached via the `useMap()`/
`useMapEvents()` **escape-hatch hooks** when a behavior (recentering,
click-to-place, animated `flyTo`) can't be expressed declaratively.
Pins are **custom DOM markers** (`divIcon`, not image sprites) so they can
be styled and animated with plain CSS. Flying to a pin respects
`prefers-reduced-motion` (skips the animation entirely for users who've
opted out of motion). Distance from the user's pinned "home" is a
**haversine (great-circle) distance** calculation (`geo.ts`), and
international-vs-domestic booking guidance is a documented **heuristic**,
not live fare data.

Persistent user state — home pin, season **plan** (a `Set` of event ids),
filters — lives in **`localStorage`**, read/written through a small
**typed storage layer** (`storage.ts`) that fails soft if storage is
blocked. A **one-time data migration** (`migratePlan`) converts an old
**opt-out model** (`pmm.excluded`) to the current **opt-in model**
(`pmm.plan`) the first time a returning user's data loads. Sharing a plan
is **state serialized into a URL** (`?plan=id,id,id`), read back with the
**Web Share API** (`navigator.share`) or a **clipboard-API** fallback
(`copyText`).

### The hard parts

The **season timeline** strip (`TimelineView.tsx`) is a hand-rolled
**piecewise-linear scale**: dense clusters of events render at full
resolution while long **gaps get compressed** (`GAP_CAP_DAYS`), so screen
width goes to events instead of empty calendar. Overlapping event bubbles
are placed by a **greedy interval-packing / lane-assignment** algorithm
(`assignLanes`) — the same family of problem as calendar-app "which row does
this meeting go in." Card typography avoids layout **jitter** by computing
one **shared font size per text role** across the whole dataset up front
(`textFit.ts`, using an off-screen `<canvas>` and `measureText` to find the
widest string in the **corpus**), instead of each card sizing itself
independently. **PWA** offline support is a hand-written **service worker**
(`public/sw.js`) implementing two caching strategies side by side:
**network-first** for the app shell and `events.json` (so deploys and fresh
data aren't shadowed by a stale cache) and **stale-while-revalidate** for
hashed static assets. Version bumps use **cache invalidation by name**
(`CACHE = 'pmm-v3'`; `activate` deletes any other key) plus an
**`updatefound`/`statechange` lifecycle listener** that dispatches a custom
DOM event so the UI can offer a one-tap refresh instead of silently serving
stale code underneath a running session.

### The build

**TypeScript** project references (`tsc -b`) type-check before **Vite**
bundles for production; a build-time **`define`** injects the app version
from `package.json` as a global constant (`__APP_VERSION__`) so it can be
shown in the footer without a runtime fetch. Calendar export supports both
a **Google Calendar template URL** (no API call, just query params) and a
client-generated **`.ics` file** (**iCalendar format**, `VCALENDAR`/`VEVENT`
records) built as a **`Blob`** and downloaded via an **object URL**
(`URL.createObjectURL`) — covering Apple/Outlook without a server round trip.

---

## 2. The plain-language version

This app has no server behind it (**backendless**) — it's a single web
app (**SPA**, built with **React** and **TypeScript**, packaged by a build
tool called **Vite**) that just loads one JSON data file and does
everything else — filtering, your season plan, the timeline drawing — in
your browser (**client-side**). The shape that data file must follow is
written down as a type in the code (**schema**), and the "what kind of
event is this" field can only ever be one of four exact values (a
**discriminated union**) — Regional, Special Event, International, or
Worlds.

Since there's no server to keep data fresh live, a separate small program
(the **scraper**) runs once a day on a timer (**cron job**, via **GitHub
Actions**, GitHub's free automation runner) and rewrites that JSON file.
None of these Pokémon event websites offer an official feed to read, so the
scraper does something scrappier: it pulls the raw data the *page itself*
already downloaded and hid inside `<script>` tags (**embedded-JSON
mining**), and cleans up the inconsistent field names those sites use
(**key normalization**). One of the three sites doesn't even send its data
in the first page load — it's built by JavaScript running in your browser
(**client-rendered**) — so for that one the scraper opens a real, invisible
browser (**headless browser**) and watches what network requests the page
makes, then reads those responses directly (**reverse-engineering the
API** from what it observes, rather than reading a published one).

The scraper combines three different sources with a pecking order (one site
wins disagreements, the others just fill in blanks, and a small manual
override file always wins), then merges same-event entries that got listed
slightly differently by each site (**deduplication**), always trusting the
freshest data over old cached data. Turning "Providence, RI" into map
coordinates is **geocoding**, done via a free service (**Nominatim**) that
asks to be used politely (one request per second), so results are saved to
a cache file so the same place is never looked up twice. Crucially, if
anything about this whole process looks broken — way fewer events than
before, a page failed to load — the scraper refuses to publish anything
(a **fail-safe**): it exits with an error and leaves the old, good data file
untouched, and a robot-filed GitHub issue tells a human. A second automation
publishes the built site to GitHub Pages, and because commits made by the
scraper's own robot account don't automatically wake up that second
automation, the scraper explicitly tells it to run.

On the frontend, the interface is built from small reusable pieces
(**components**) that use React's built-in tools for remembering things
between renders and reacting to change (**hooks**: `useState`,
`useEffect`, and friends) — there's no separate state-management library.
Interestingly, which tab you're on and which event card is open isn't just
kept in memory — it's written into the page's own web address (**the URL is
the source of truth**), so every event has a real shareable link
(**deep-linkable**) and the phone's physical Back button closes the popup
card first instead of instantly leaving the app.

The map is drawn with a mapping library called **Leaflet**, wrapped in
React-friendly components (**react-leaflet**); a few behaviors (recentering,
click-to-place-your-pin, the "fly to this venue" animation) have to reach
past those wrapper components straight into the underlying map object
(an **escape hatch**), because the wrapper doesn't expose everything.
Map pins are drawn as plain colored HTML/CSS shapes rather than image
files, so they're easy to restyle. If your phone is set to reduce motion,
the fly-to animation is skipped outright rather than just made shorter. The
straight-line distance from your pinned home to a venue is computed with
basic trigonometry that accounts for the Earth being a sphere (the
**haversine formula**) — the same math that underlies "as the crow flies"
distances.

Things you set — your home location, which events you've added to your
plan, your filters — are saved right in the browser (**`localStorage`**),
behind a small wrapper that quietly does nothing if that storage is
unavailable rather than crashing. An early version of "my plan" worked
backwards (everything included by default, you unchecked what you didn't
want); the app detects that old saved data once and converts it to the
current, opposite default so nobody's data silently vanishes. Sharing your
plan with a friend works by stuffing your event list right into the URL
you send them; copying that link uses the phone's native share sheet when
available, falling back to just copying it to the clipboard.

The trickiest bits of UI: the horizontal season timeline doesn't scale time
evenly — busy stretches get full detail and long empty gaps get visually
squeezed, so the whole season fits without wasting space on nothing
happening. When several event labels would land in the same place, a
simple packing algorithm — the same kind used by calendar apps deciding
which row to draw a meeting on — spreads them into separate rows so they
don't overlap. Card text sizes itself once against the *widest* label in
the whole dataset (using an invisible canvas to measure pixel widths) so
switching between cards doesn't make the text visibly resize
(**jitter**). The offline support is a small background script
(**service worker**) that intercepts your app's network requests: it always
tries the network first for the live event data and app shell (so today's
fixes and today's data actually show up when you're online), but serves
cached copies of everything else immediately while quietly checking for
updates behind the scenes. When a new version of the app finishes
installing in the background, it doesn't just swap in silently — it fires a
custom signal the UI listens for and shows a "new version ready, tap to
refresh" banner instead.

At build time, TypeScript checks the whole codebase for type errors before
Vite bundles everything for production, and the current app version gets
baked in as a constant so the footer can show it without a network
request. Adding an event to your calendar works two ways: a plain link to
Google Calendar's own "add event" page (no login or API key needed), or a
downloadable standard calendar file (**`.ics`**) built right there in your
browser and handed to the browser's download mechanism — covering
Apple/Outlook users without needing a server at all.

---

## 3. Glossary — term → meaning → where it happens here

### Architecture & data model

| Term | Plain meaning | In this project |
|---|---|---|
| **backendless / no backend** | the app has no server at runtime | just a static build + one static JSON file (`public/data/events.json`) |
| **SPA (single-page app)** | one HTML page, JS swaps the content | `src/App.tsx`; no page reloads for tab/event navigation |
| **static build** | pre-compiled output, no server rendering | `vite build` → `dist/`, published as-is to GitHub Pages |
| **schema** | the agreed shape of a piece of data | `PokeEvent` interface, `src/types.ts` |
| **discriminated union** | a type that's only ever one of a fixed set of tags | `EventType = 'regional' \| 'special' \| 'international' \| 'worlds'` |
| **canonical shape / defensive coercion** | normalizing untrusted input to the trusted shape | `normalizeEvent()`, `src/lib/normalize.ts` — every field is type-checked before use |
| **client-side** | computed in the browser, not on a server | filtering, plan logic, timeline layout all run in-browser |

### Data pipeline & scraping

| Term | Plain meaning | In this project |
|---|---|---|
| **scraper** | a program that extracts data from pages not built for it | `scraper/scrape.mjs` |
| **cron job** | a task run on a recurring schedule | `.github/workflows/scrape.yml`, `cron: '17 9 * * *'` |
| **embedded-JSON mining** | pulling structured data out of a page's own `<script>` tags | `extractJsonBlobs`/`mineEventObjects` in `scrape.mjs` |
| **key canonicalization** | normalizing inconsistent field names to one vocabulary | `canonKey()` strips Crafter-CMS suffixes (`_s`, `_dt`, …) |
| **client-side-rendered (CSR)** | the page is empty until JS builds it | why `championships.pokemon.com` needs a real browser to scrape |
| **headless browser** | a real browser engine run with no visible window | `playwright-core` Chromium in `launchBrowser()` |
| **response interception** | capturing network responses a page makes, from outside it | `page.on('response', …)` in `scrapeOfficial()` |
| **reverse-engineering an API** | inferring an unpublished endpoint from observed traffic | `OFFICIAL_API` constant, discovered from the rendered page's network calls |
| **source precedence / merge** | rules for which source wins when data conflicts | `merge()`: official > pokedata/rk9 > `scraper/overrides.json` |
| **deduplication** | collapsing entries that represent the same real thing | `dedupe()`, keyed on `type\|startDate\|city`, plus a fuzzy city/name second pass |
| **geocoding** | turning a place name into map coordinates | Nominatim lookups in `lookupQuery()` |
| **rate limiting** | deliberately slowing requests to respect a service's limits | 1.1s sleep between geocode calls (Nominatim usage policy) |
| **cache file** | saved results reused instead of recomputing | `scraper/geocache.json` |
| **fail-safe / fail-closed** | on error, do nothing rather than do something wrong | `validate()` exits non-zero, never writes a bad `events.json` |
| **CI (continuous integration)** | automation that runs on code/data changes | the two GitHub Actions workflows |
| **workflow_dispatch** | a workflow triggerable by hand, not just by its trigger event | both `deploy.yml` and `scrape.yml` |
| **cascade trigger** | one automated event kicking off another | `scrape.yml` calls `gh workflow run deploy.yml` because bot commits don't auto-trigger Pages |

### Frontend architecture & state

| Term | Plain meaning | In this project |
|---|---|---|
| **function component** | a UI piece defined as a plain function | every file in `src/components/` |
| **hooks** | React's tools for state/effects in function components | `useState`, `useEffect`, `useMemo`, `useRef` throughout `App.tsx` |
| **URL as source of truth** | app state lives in the address bar, not just memory | tab/event/view all read from `URLSearchParams`, written via History API |
| **History API** | browser API for manipulating navigation history | `history.pushState`/`replaceState`, `popstate` listener in `App.tsx` |
| **deep link** | a URL that opens directly to a specific piece of content | `?event=<id>` opens that event's card straight from a shared link |
| **`localStorage`** | small browser-native persistent key/value storage | `src/lib/storage.ts` — home, plan, filters |
| **one-time migration** | converting old saved data to a new format, once | `migratePlan()` converts the pre-0.10 opt-out plan to opt-in |
| **state serialization to URL** | encoding app state as a shareable link | `buildPlanUrl`/`readPlanFromUrl`, `src/lib/share.ts` |
| **Web Share API** | the OS-native "share to…" sheet | `navigator.share` in `sharePlanUrl()` |
| **Clipboard API** | programmatic copy-to-clipboard | `navigator.clipboard.writeText`, fallback path in `share.ts` |

### Mapping & geo

| Term | Plain meaning | In this project |
|---|---|---|
| **Leaflet** | the JS mapping library actually drawing the map | via `react-leaflet` in `MapView.tsx` |
| **declarative vs imperative** | describing the result vs issuing step-by-step commands | `<Marker>`/`<TileLayer>` (declarative) vs the raw Leaflet map object reached via hooks (imperative) |
| **escape-hatch hook** | a hook that reaches past a wrapper into the underlying instance | `useMap()`, `useMapEvents()` for recenter/click/flyTo logic |
| **custom DOM marker** | a map pin drawn from HTML/CSS instead of an image | `divIcon()` in `eventIcon()`/`homeIcon` |
| **tile layer** | the map's background imagery, served in small image squares | OpenStreetMap tiles via `TILE_URL` |
| **`prefers-reduced-motion`** | a browser setting for users who don't want animation | checked before `flyTo` in `FlyTo` |
| **haversine formula** | great-circle distance between two lat/lng points | `haversineMiles()`, `src/lib/geo.ts` |
| **reverse geocoding** | coordinates → place name/country | `reverseGeocodeCountry()`, run once when the user pins home |
| **heuristic** | a rule-of-thumb approximation, not exact/live data | the 45/90-day flight-booking guidance in `src/lib/travel.ts` |

### PWA & offline

| Term | Plain meaning | In this project |
|---|---|---|
| **PWA (progressive web app)** | a web app installable and usable offline like a native app | `public/manifest.webmanifest`, `public/sw.js` |
| **service worker** | a background script that can intercept a site's network requests | `public/sw.js`, registered in `src/main.tsx` |
| **network-first** | try the network, fall back to cache | `events.json` and page navigations in `sw.js` |
| **stale-while-revalidate** | serve the cached copy instantly, refresh the cache in the background | everything else in `sw.js`'s `fetch` handler |
| **Cache API** | the browser storage service workers use for offline assets | `caches.open`/`match`/`put` in `sw.js` |
| **cache invalidation by name** | forcing a clean cache by changing its key | `CACHE = 'pmm-v3'`; `activate` deletes any other key |
| **service worker lifecycle** | install → activate → fetch, plus update detection | `skipWaiting()`/`clients.claim()`; `updatefound`/`statechange` listeners in `main.tsx` |
| **custom DOM event** | an app-defined event dispatched for other code to listen for | `pmm-sw-updated`, dispatched on update, drives the "new version ready" banner |
| **online/offline detection** | reacting to connectivity changes | `navigator.onLine` + `online`/`offline` listeners in `App.tsx` |

### The hard parts (layout & rendering)

| Term | Plain meaning | In this project |
|---|---|---|
| **piecewise-linear scale** | a mapping built from several straight-line segments, not one | `buildScale()` in `TimelineView.tsx` — dense vs compressed time regions |
| **gap compression** | shrinking visually "empty" spans so detail gets the space instead | `GAP_CAP_DAYS`/`SLOW_PX_PER_DAY` in `TimelineView.tsx` |
| **greedy interval packing / lane assignment** | placing overlapping items into the fewest non-overlapping rows | `assignLanes()` in `TimelineView.tsx` |
| **`ResizeObserver`** | a browser API that reacts to an element's size changing | used to keep the timeline scaled to its container width |
| **layout jitter** | visible size/position shift between renders of similar content | why `textFit.ts` computes one shared font size instead of per-card sizing |
| **canvas text measurement** | using `<canvas>`'s `measureText` to get exact rendered text width | `widestText()` in `src/lib/textFit.ts` |
| **corpus** | the full set of text samples measured together | the `title`/`address` string sets registered via `setFitCorpus()` |

### Build & export

| Term | Plain meaning | In this project |
|---|---|---|
| **TypeScript project build (`tsc -b`)** | type-checking (and incremental compilation) before bundling | `npm run build` runs `tsc -b && vite build` |
| **Vite** | the dev server / production bundler | `vite.config.ts` |
| **build-time `define`** | baking a constant into the bundle at build time | `__APP_VERSION__`, injected from `package.json` in `vite.config.ts` |
| **iCalendar / `.ics`** | the standard file format calendar apps import | `downloadICS()`, `src/lib/calendar.ts` |
| **`Blob` + object URL download** | building a file in-browser and triggering its download | `URL.createObjectURL(blob)` in `downloadICS()` |
| **calendar template URL** | a prefilled "add event" link needing no API access | `googleCalendarUrl()` |
