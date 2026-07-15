# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/pizzacatz/pokemon-majors-map/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pizzacatz/pokemon-majors-map/releases/tag/v0.1.0
