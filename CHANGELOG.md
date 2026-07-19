# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.12.5] - 2026-07-19

### Documentation

- Project marked **complete**: the README and PRD now state the product is
  finished and in maintenance mode. The daily data scraper continues to run;
  no further feature development is planned.

## [0.12.4] - 2026-07-17

### Documentation

- README and PRD rewritten to match the shipped product (new name, domain,
  GPE branding, opt-in plan, two-tab layout, timeline scaling, theming,
  flights/reg-open, current scraper pipeline and schema). The PRD is now a
  living document (v2.0) with a release-history section; the UX audit is
  marked as a completed historical record.

## [0.12.3] - 2026-07-17

### Changed

- The first-run intro card leads with the tagline too: "Find every
  Pokémon Championship on one map! Pin your home, plan your season, and
  count down the days!"

## [0.12.2] - 2026-07-17

### Changed

- New tagline everywhere it unfurls (meta description, OG description,
  manifest, and a regenerated OG card that also carries the current app
  name): "Find every Pokémon Championship on one map! Pin your home,
  plan your season, and count down the days!"

## [0.12.1] - 2026-07-16

### Fixed

- **White page after moving to majors.georgiaplayevents.com.** The app was
  built for the old `/pokemon-majors-map/` sub-path; on a custom domain
  GitHub Pages serves from the root, so every asset URL 404'd. Vite base
  is now `/`, the manifest scope/start_url and OG URLs point at the new
  domain, and `public/CNAME` carries the domain through our force-push
  deploys (GitHub's auto-written CNAME would have been wiped on the next
  deploy, silently un-setting the domain). Old
  pizzacatz.github.io/pokemon-majors-map links redirect automatically.

## [0.12.0] - 2026-07-16

### Changed

- Renamed to **Map of Pokémon Championships** (browser title, OG title,
  installed-app name, and the header wordmark). A "part of the GPE
  network" subtitle under the header links to georgiaplayevents.com.
- Dark mode now matches TeamSheet (`team-sheet-builder`): neutral
  near-black page (#0d0d0e), gray panels (#2f2f33), warm off-white text
  (#f8efe5), and TeamSheet's peach accent (#ffb072). Primary buttons take
  dark text on the peach (per-theme `--red-contrast`), and the dark map
  frame matches the page. Light mode is unchanged.

## [0.11.1] - 2026-07-16

### Changed

- App icons, apple-touch-icon, the OG share card, and the top-bar logo are
  regenerated from the high-resolution brand logos (logoSQUARE.png /
  logo.png from the assets repo). The top-bar logo uses the natural
  sticker aspect instead of a square crop.

## [0.11.0] - 2026-07-16

GeorgiaPlayEvents rebrand, using assets from
`pizzacatz/GeorgiaPlayEventsAssets`.

### Changed

- Name: "GeorgiaPlayEvents Majors Map" (title, manifest, OG card); the
  header reads "Majors Map" with the peach logo; the footer links to
  georgiaplayevents.com.
- Logos/icons: the peach-Pokéball replaces the Pokéball everywhere —
  favicon.ico, apple-touch-icon, 192/512 app icons (full-bleed cream
  background doubles as maskable), header logo, and a rebuilt OG share
  card in the TeamSheet style.
- Light mode is warm cream (page #fdefdf, cards #fdf7ef, espresso text)
  with burnt-orange accent #c85c24 replacing the Pokéball red.
- Dark mode is the brand after dark: espresso browns (#201812 bg) with
  peach/orange accents; the pulse ring is warm white.
- Event-type colors warm-shifted but still mutually distinct: regional
  copper, special gold, international plum, worlds brick (new --worlds
  variable — worlds no longer shares the UI accent color).

## [0.10.0] - 2026-07-16

Audit №2: the plan becomes opt-in, plus a batch of polish.

### Changed

- **The plan is opt-in.** New users start with an empty plan and add
  events; previously everything was "planned" by default, which made the
  count meaningless and pre-flagged conflicts nobody created. Users who
  had unchecked events keep their effective plan (one-time migration);
  users who never engaged start fresh. Until a plan exists nothing is
  dimmed; once it has members, unplanned pins/bubbles recede (keeping
  their type color — past events stay gray).
- Schedule rows drop the year from dates (the month header carries it),
  so titles stop truncating; plan counts read "My plan · n" everywhere.
- Card label is "In my plan"; the intro mentions building a plan.

### Added

- Search box on the Schedule tab — filter by city, venue, event name, or
  country as you type.
- "Reg open" badge on cards whose RK9 registration link exists; the
  scraper now stamps `registrationSeenAt` the first day it sees a
  registration link (groundwork for change notifications).
- "Flights" button beside Hotels — a Google Flights search pre-filled
  with the destination and event dates (origin inferred by Google; no
  home data leaves the app).
- Social/OG meta tags + a share image, so plan links unfurl properly in
  Discord/WhatsApp/Slack.
- "New version ready — Refresh" pill when a new build installs behind a
  running session.
- Countdowns recompute when the tab becomes visible again (a PWA left
  open overnight no longer shows yesterday's numbers).
- iOS: status-bar styling meta and a dark-scheme theme-color that also
  tracks the in-app theme toggle.

### Internal

- Tile provider config isolated to one seam in MapView for a future
  keyed provider; decorative type dots marked aria-hidden (type names
  are already in the row text).

## [0.9.1] - 2026-07-16

### Fixed

- The highlighted-pin pulse ring is white in dark mode — the red ring was
  invisible against the inverted dark tiles.

## [0.9.0] - 2026-07-16

### Added

- Light/dark mode toggle (🌙/☀️ in the top bar). Defaults to the system
  theme — and keeps following the OS setting until you explicitly toggle,
  after which your choice persists. The theme resolves before first paint,
  so no flash on load.

## [0.8.1] - 2026-07-16

### Changed

- The "My plan" strip stays open when you select an event from it, so you
  can step through your season without reopening it each time.

## [0.8.0] - 2026-07-16

Plan-surface consolidation: My Season, Schedule, and Itinerary were one
list wearing three costumes. Now there are two surfaces with distinct
jobs — the Schedule tab (calendar) and a plan strip on the map.

### Changed

- Schedule has an "All events / My plan (n)" toggle. The plan view is the
  same compact month-grouped rows filtered to checked events, and carries
  the plan actions (Share, season .ics) that used to live in Itinerary.
  The view is in the URL (`?view=plan`).
- Every schedule row has the plan checkbox directly on it.
- Weekend clashes get a ⚠ on rows (schedule + map strip) and a warning
  line on the card — previously conflicts were only computed in Itinerary,
  after you'd already built the plan.
- The map's "My season" panel is now a slim "My plan · n" strip: checked
  events only, short labels, days-left, checkboxes, pin hover-highlight.
- One name for the concept everywhere: "My plan".

### Removed

- The Itinerary tab. Old `?tab=itinerary` links open the Schedule tab's
  plan view. Nothing else was lost: share, export, conflicts, and the
  full cards all live on in Schedule.

## [0.7.2] - 2026-07-16

### Changed

- Hovering (or focusing) a row in the "My season" checklist highlights
  that event's map pin, same as timeline bubbles.

## [0.7.1] - 2026-07-16

### Changed

- Home popup copy is "Home — distances measure from here"; the Move home
  button sits on its own line, centered.

## [0.7.0] - 2026-07-16

### Added

- Pin highlighting: the open event card's map pin enlarges and pulses,
  and hovering (or keyboard-focusing) a timeline bubble highlights that
  event's pin the same way.
- "Move home" lives in the home marker's popup now.

### Changed

- The top-bar button is "🏠 Home" and flies to your home pin at a wide
  zoom (closing any open event card); it no longer directly enters
  move-home mode.

## [0.6.5] - 2026-07-16

### Fixed

- Returning to the Map tab replayed the last fly-to animation (the map
  remounts and the stale fly target re-triggered). Leaving the Map tab
  now clears the target; explicit fly actions are unaffected.

## [0.6.4] - 2026-07-16

### Changed

- Event titles now use one shared font size too (sized against the widest
  official name in the dataset), finishing the jitter fix: switching
  events changes no font metrics anywhere on the card.

## [0.6.3] - 2026-07-16

### Changed

- The timeline scales to the screen: on desktop the whole season fits the
  strip's width exactly (no horizontal scrolling), and when a filtered
  list leaves few events, the timeline expands to fill the width on any
  device. Event date labels thin out when scaling packs them too tightly.
  Phones keep the scrollable strip for a full season.
- All event addresses render at one shared font size (sized against the
  widest address in the dataset), so switching between events no longer
  jitters from per-card font scaling.

## [0.6.2] - 2026-07-16

### Changed

- Schedule tab: tapping an expanded card's header/title collapses it back
  to a row, matching how tapping the row expanded it (the ✕ still works).

## [0.6.1] - 2026-07-16

### Changed

- Venue addresses scale to fit one line, like titles.
- Tapping an event's name in the timeline opens its card in place — only
  the 📍 flies the map to it.
- Calendar actions are one "Add to calendar ▾" button with the app choice
  (Google Calendar / Apple-Outlook .ics) in a small menu.
- Button labels: "Hotels nearby" → "Hotels", "Official page" → "Event page".

### Removed

- The "source" link in the footer.

## [0.6.0] - 2026-07-16

### Changed

- Event titles always fit one line: long official names scale down to fit
  the card width instead of wrapping.

### Removed

- TCG / VGC / GO everywhere — the format pills on cards, the "Game" filter
  group, and format-based filtering. Every major runs all three games, so
  they were noise. (The data schema keeps `formats` in case a
  single-format major ever appears; saved filters from older versions
  migrate automatically.)

## [0.5.4] - 2026-07-16

### Changed

- Event sheet no longer has an expanded state: it opens at exactly its
  content's height and tapping/dragging the handle up does nothing (drag
  down still dismisses). Expanding only ever revealed empty space.
- Tighter card spacing: no doubled padding inside the sheet, slimmer link
  buttons (all three fit one row on phones), smaller gaps between lines.
  A typical card sheet is ~280px, down from 339px.

### Fixed

- The sheet could never shrink below 300px: content was measured via
  `scrollHeight`, which is floored at the container's current height. The
  card itself is measured now.

## [0.5.3] - 2026-07-16

Card compression: a typical event card now fits entirely in the sheet's
peek state — no expanding needed.

### Changed

- Travel line is just "N mi from home · Book flights by <date>": the
  drive/fly badge and "(international)" tag are gone, and the booking
  heuristic assumes flights for every trip (international still gets the
  longer 90-day lead time under the hood).
- When registration isn't open, the card shows the Register on RK9 button
  grayed out with struck-through text instead of an explanatory paragraph
  (the explanation lives in its tooltip).
- Calendar chips are "GCal" / "iCal" (consistent, no stray plus sign).
- The sheet's peek height hugs the card content (capped at ~55% of the
  screen), and the bottom fade only appears when content is actually
  clipped.

## [0.5.2] - 2026-07-16

### Changed

- Event cards use a single title line — the official event name — instead
  of the short title plus official-name subtitle, saving a line per card.

## [0.5.1] - 2026-07-16

### Changed

- Timeline gap compression: the strip is ~40% shorter (1928px vs ~3150px).
  Days keep full resolution up to a week between events; longer empty
  stretches compress to a trickle, so width is spent on events instead of
  blank calendar. Month labels moved to their own axis row (below the event
  dates) and thin out where compression squeezes them together.

## [0.5.0] - 2026-07-16

UX Phase 3 (docs/UX-AUDIT.md P2 polish).

### Added

- PNG app icons (192/512 + maskable): Android's install prompt requires
  them; the manifest previously carried only the SVG.
- Loading indicator while event data fetches, and an "Offline — showing
  data from <date>" pill when the network drops (the service worker keeps
  the app usable offline).
- Landscape layout: the tab bar docks as a left rail so the map gets the
  full height; the event sheet's peek height caps at ~half the screen; the
  manifest no longer locks the app to portrait.
- Tapping the home marker explains what it is ("distances and book-by
  dates measure from here"); the travel line reads "1,354 mi *from home*".

### Changed

- The yellow "book soon" text is a darker, WCAG-passing shade in light
  mode; timeline date labels are slightly larger.

### Fixed

- The card's ✕ close button sat in the middle of the header instead of the
  top-right corner (a touch-target margin from 0.4.0 overrode the flex
  push; the intro card's ✕ drifted 6px off its corner for the same reason).

### Accessibility

- Map pins are keyboard-focusable with accessible names (event + dates).
- The event sheet and filter panel take focus when they open and close on
  Escape; "Link copied!" is announced to screen readers.

## [0.4.0] - 2026-07-16

UX Phase 2 (docs/UX-AUDIT.md P1 items) + data cleanup.

### Removed

- Los Angeles 2027 placeholder: it has no official source yet. It returns
  automatically when the official site announces it.

### Changed

- Event cards lead with a short title ("Baltimore Regional", "NAIC") with the
  official name as a subtitle; the dead "Registration TBA" chip is replaced by
  a useful note ("RK9 link typically appears 2–3 months before the event").
- Schedule is compact rows (title, dates, days-left) with sticky month
  headers; tapping a row expands the full card. ~70% less scrolling.
- Dark mode inverts the map tiles so the map matches the UI, and restyles
  the zoom/attribution controls.
- "Share my season" uses the native share sheet on mobile (clipboard
  fallback on desktop).
- Touch targets: close buttons and timeline fly pins now have ≥44px hit
  areas.

## [0.3.3] - 2026-07-16

### Changed

- Collapsed-timeline strip counts down to the next event in *your* season
  plan (next checked event), not just the next on the calendar; falls back
  to the next upcoming when nothing is checked.
- The 📍 next to the venue name is now the show-on-map action; the separate
  "Show on map" button is gone.
- Calendar actions are compact chips ("+ GCal", "iCal") on the date/countdown
  row instead of a separate button row.
- Timeline bubbles keep multi-word city names ("Rio de Janeiro") on one line.

## [0.3.2] - 2026-07-16

### Changed

- Removed the timeline hover-raise: lowest-on-top layering makes every
  bubble reachable without it, and stable stacking beats bubbles jumping
  around under the pointer.

### Fixed

- Utrecht's venue/address now parse (single-line comma-separated format);
  hub-link placeholders skip venue enrichment.

## [0.3.1] - 2026-07-16

### Changed

- Timeline bubbles hug their wrapped text instead of a uniform width, the
  vertically lowest bubbles layer on top when overlapping, and the strip's
  height grows/shrinks with the bubbles it actually holds.

### Fixed

- Utrecht and Milwaukee venues/addresses were missing: their detail pages
  wrap each address line in `<div>` rather than `<br>`, which the venue-block
  parser now understands. Both self-fill on the next scrape.

## [0.3.0] - 2026-07-16

UX Phase 1 (see docs/UX-AUDIT.md P0 items).

### Added

- Real bottom sheet for event cards: drag handle, peek/full snap points,
  swipe-down to dismiss; content scrolls when full, fades at peek.
- First-run intro card with pin-color legend and one-tap "Use my location".
- Tabs and the open event live in the URL: Android back dismisses the card
  and walks tabs instead of exiting the app; every event is deep-linkable
  (`?event=<id>` also centers the map on it).
- Collapsed timeline strip shows the next event at a glance
  ("Next: Worlds · 43d"); expanding auto-scrolls to the first upcoming event.

### Changed

- Timeline is collapsed by default on phones (persisted choice), returning
  ~230px to the map.
- Filters moved off the permanent chip row into a Filter panel behind a
  top-bar button (with active-filter indicator and Reset); type chips double
  as the pin-color legend.
- Fly-to now lands the pin in the visible strip above the sheet instead of
  behind it, and honors prefers-reduced-motion.
- Venue line drops the redundant city/country when a street address is shown.
- "Fly to map" → "Show on map"; "Season list" → "My season"; the wordmark
  hides on narrow phones so top-bar buttons never wrap; buttons get pressed
  states.

## [0.2.4] - 2026-07-16

### Fixed

- Recife and San Diego timeline bubbles were buried under dense clusters:
  four events can overlap but only three lanes existed, and overflow always
  landed on lane 0. Now four lanes, overflow takes the soonest-free lane,
  and hovering any bubble raises it above neighbors (the previous hover
  z-index was trapped inside the item's own stacking context).

### Changed

- Timeline bubbles are tighter (smaller font, padding, and fly button) to
  save horizontal space and reduce collisions.

## [0.2.3] - 2026-07-16

### Fixed

- Timeline bubbles for same-day events overlapped, showing stacked 📍 icons
  and making the covered bubble's fly button unclickable. Lanes are now
  assigned by collision-aware interval packing, transparent item containers
  no longer swallow clicks, and hovered bubbles raise above neighbors.
- Service worker serves navigations network-first, so deploys appear on the
  next load instead of lingering one version behind (the cause of "still
  broken" reports after fixes shipped).

## [0.2.2] - 2026-07-16

### Added

- Venue name and street address enrichment from the official event detail
  pages (content-store API, no browser needed). Event cards show the address;
  calendar exports carry it; geocoding is now address-first with named-venue
  and city-level fallbacks, so pins land on the actual building (e.g. Recife's
  Centro de Convenções de Pernambuco, which is in neighboring Olinda).

### Fixed

- Events whose official location uses full state or country names
  ("Chicago, Illinois", "Prague, Czechia") no longer drop: the Prague
  Regional was missing from the site entirely and NAIC's official link
  pointed at the generic events hub.

## [0.2.1] - 2026-07-16

### Added

- "📍 Fly to map" button on every event card (schedule, itinerary, and the
  map's own bottom sheet), not just timeline bubbles.

### Changed

- Timeline bubbles use compact wrapped labels: "Worlds", "NAIC"/"LAIC"/"EUIC",
  and "<City> Regional/Special"; full name and dates remain on hover.

### Fixed

- Home marker rendered as two stacked glyphs on some browser/zoom
  combinations (emoji + its drop-shadow); replaced with a pure CSS marker.
- Events at (0,0): missing coordinates from the official API were coerced to
  zero and skipped geocoding, putting pins (and fly-to) in the ocean — the
  cause of wrong Recife placement and distance/drive-vs-fly confusion.
  Coordinates now heal via re-geocoding and (0,0) can never publish again.
- Merge preference: freshly scraped values beat stale baseline fields, so
  NAIC's specific official page replaces the generic events-hub link the
  seed data carried.

## [0.2.0] - 2026-07-15

### Added

- **Season timeline**: horizontal scrollable strip on the Map tab — today at
  the far left, scale to the farthest announced event (currently NAIC,
  June 18–20, 2027). Type-colored ticks with staggered event-name bubbles and
  dates; each bubble's 📍 button flies the map to the event's location and
  opens its card. Collapsible, with month marks along the axis.
- Official championships.pokemon.com data source, now the primary one: the
  site's own events API is fetched directly (all 31 announced upcoming
  events with official links), with headless-Chrome capture of the page's
  network traffic as a self-healing fallback. Season-year dates (Sep–Dec
  belong to the prior calendar year), Special Event typing, and explicit
  region vocabulary are handled.

### Fixed

- Fresh-wins healing: stale baseline entries that disagree with freshly
  scraped data on (type, date) for the same city are dropped, so parsing
  fixes propagate instead of fossilizing.
- Geocode cache no longer permanently caches transient failures, and
  pre-country-format entries are refetched.

## [0.1.3] - 2026-07-15

### Changed

- Past events are pruned from the published data: the site now carries only
  events from today forward (plus dates-TBD announcements). The scraper's
  50%-drop fail-safe compares future events to future events so intentional
  pruning never trips it.

## [0.1.2] - 2026-07-15

### Fixed

- **Site crashed to a blank screen** when an event arrived with absent (not
  null) date keys — the scraper's null-pruning merge dropped the LA 2027
  placeholder's explicit null dates, and `undefined` slipped past the app's
  `!== null` date guards into date parsing. Events are now normalized to the
  full schema on load, date guards use `!= null`, and the scraper writes
  canonical records with every key explicitly present.

## [0.1.1] - 2026-07-15

### Fixed

- Scraper: RK9's two-letter location tails are no longer misread as US states
  (Frankfurt/Stuttgart landed in "US" via DE=Delaware, Toronto via CA=California);
  ambiguous countries are now resolved authoritatively by the geocoder.
- Scraper: city names with non-Latin-1 letters (Gdańsk) parse correctly.
- Scraper: UK normalizes to ISO GB so those events get region EU, not NA.
- Scraper: event names no longer swallow trailing RK9 UI text ("Registration…").
- Scraper: Brazilian "City - ST" strings drop the state suffix.
- Scraper: a dates-TBD placeholder is only superseded by an *upcoming* dated
  event in the same city — the announced LA 2027 Regional no longer disappears
  because LA 2026 exists; it is restored via overrides.
- Data: removed five malformed entries produced by the first scrape.

### Added

- Real event data: first successful CI scrape captured the full RK9 majors
  list (35 events) with registration links.
- Scrape workflow also runs on pushes touching scraper files.

## [0.1.0] - 2026-07-15

### Added

- Initial release: mobile-first single-page app on GitHub Pages.
- World map of Play! Pokémon majors (Leaflet + OpenStreetMap), pins color-coded by
  event type, grayed when excluded from the season plan or in the past.
- Home pin via map tap or geolocation, persisted in localStorage; map centers on home
  (continental US fallback).
- Event cards with dates, days-left countdown, distance and drive/fly badge,
  heuristic "book travel by" date, RK9 registration link, official page link,
  Booking.com hotel deep link, Google Calendar button, and .ics download.
- Filters by event type, game format, and region.
- Season dashboard checklist; unchecked events gray out everywhere.
- Chronological schedule view grouped by month.
- Itinerary tab with weekend-conflict warnings and whole-season .ics export.
- Shareable season plan via `?plan=` URL parameter.
- PWA: installable, offline app shell, cached event data. No install prompts.
- Daily GitHub Actions scraper (pokedata.ovh + championships.pokemon.com) with
  Nominatim geocoding cache, manual overrides file, validation, fail-safe commit
  gating, and auto-filed issues on failure.
- Hand-verified seed data: Worlds 2026 (San Francisco), LAIC 2027 (São Paulo),
  EUIC 2027 (London), NAIC 2027 (Chicago), Los Angeles Regional 2027 (dates TBD).
- App version + data snapshot date displayed in the site footer.
- PRD (docs/PRD.md), README, this changelog.

[Unreleased]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.12.4...HEAD
[0.12.4]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.12.3...v0.12.4
[0.12.3]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.12.2...v0.12.3
[0.12.2]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.12.1...v0.12.2
[0.12.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.11.1...v0.12.0
[0.11.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.7.2...v0.8.0
[0.7.2]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.6.5...v0.7.0
[0.6.5]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.5.4...v0.6.0
[0.5.4]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.2.4...v0.3.0
[0.2.4]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pizzacatz/pokemon-majors-map/releases/tag/v0.1.0
