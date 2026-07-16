# GeorgiaPlayEvents Majors Map

Part of the [GeorgiaPlayEvents](https://georgiaplayevents.com) family of Pokémon apps.

A mobile-first, single-page map of every Play! Pokémon **major event** — Regional
Championships, Special Events, International Championships, and Worlds — around the
globe. Pin your home, see how far each event is, how many days are left, and when to
book travel. Plan your season, export it to your calendar, and share it as a link.

**Live site:** https://pizzacatz.github.io/pokemon-majors-map/

> This is a fan project. Not affiliated with, endorsed, or sponsored by Nintendo,
> The Pokémon Company International, or Game Freak.

## Features

- 🗺️ **World map of majors** (Leaflet + OpenStreetMap), centered on your home pin —
  or the continental US until you set one. Your home is stored in `localStorage`,
  never sent anywhere.
- ⏳ **Countdowns & travel timing** — days until each event, plus a heuristic
  "book flights by" date based on your distance (domestic vs. international).
- 📅 **Schedule tab** — the whole season chronologically, with an "All events /
  My plan" toggle. Check events on any row; clashing weekends get a ⚠;
  share your plan or export a season .ics from the plan view.
- ✅ **My plan strip on the map** — your checked events at a glance; hovering a
  row highlights its pin, unchecking grays it out.
- 🏨 **Hotels nearby** — one tap to a Booking.com search pre-filled with the venue and
  event dates.
- 🔗 **Shareable plan** — your season selection encoded in a URL.
- 📱 **PWA** — installable, works offline with last-known data. No install nags.

## How the data works

There is no backend. Event data is a JSON file (`public/data/events.json`) refreshed
daily by a GitHub Actions scraper that reads [pokedata.ovh](https://www.pokedata.ovh/)
and [championships.pokemon.com](https://championships.pokemon.com/en-us/events/),
normalizes, geocodes new venues via Nominatim, and commits — only if the result
validates. If a source changes shape, the site keeps serving the last good data and the
workflow opens an issue instead.

The repo ships with a hand-verified seed so the site works before the first scraper run.

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build (dist/)
npm run scrape     # run the scraper locally (writes public/data/events.json)
```

Requires Node 22+.

## Project layout

```
docs/PRD.md            product requirements
public/data/events.json  event data (scraper-owned; edit overrides instead)
scraper/               scraper + geocode cache + manual overrides
src/                   the SPA (React 19 + TypeScript + Vite)
.github/workflows/     deploy.yml (Pages), scrape.yml (daily cron)
```

## Versioning

Semantic versioning, tracked in [CHANGELOG.md](CHANGELOG.md). The footer of the live
site shows the app version and the data snapshot date.
