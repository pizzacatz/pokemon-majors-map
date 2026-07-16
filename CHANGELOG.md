# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.3.1...HEAD
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
