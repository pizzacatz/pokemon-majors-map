# Map of Pokémon Championships

Part of the [GeorgiaPlayEvents](https://georgiaplayevents.com) network of Pokémon apps.

Find every Pokémon Championship on one map! Pin your home, plan your season, and count
down the days! Covers every Play! Pokémon **major event** — Regional Championships,
Special Events, International Championships, and Worlds — worldwide.

**Live site:** https://majors.georgiaplayevents.com/

> This is a fan project. Not affiliated with, endorsed, or sponsored by Nintendo,
> The Pokémon Company International, or Game Freak.

## Features

- 🗺️ **World map of majors** (Leaflet + OpenStreetMap), centered on your home pin —
  or the continental US until you set one. Your home stays in `localStorage`, never
  sent anywhere. The open event's pin (or a hovered timeline/plan row) enlarges and
  pulses.
- 📆 **Season timeline** — a horizontal strip under the map, today on the left,
  gap-compressed so the width goes to events rather than empty calendar, and scaled
  to fit the screen on desktop. Tap a name to open its card; tap 📍 to fly the map
  to the venue.
- ✅ **Opt-in season plan** — check events to build "My plan"; everything else recedes
  on the map and timeline. A plan strip over the map shows what's next; clashing
  weekends get a ⚠ wherever the plan is visible.
- 📅 **Schedule tab** — the whole season chronologically in compact rows with sticky
  month headers, an *All events / My plan* toggle, and search-as-you-type. Share your
  plan as a URL or export a season `.ics` from the plan view.
- ⏳ **Countdowns & travel timing** — days until each event, plus a heuristic
  "book flights by" date (45 days domestic, 90 international).
- ✈️🏨 **Flights & Hotels** — one tap to a Google Flights search or a Booking.com
  search pre-filled with the destination and event dates.
- 🎟️ **Registration** — the RK9 button goes live (with a "Reg open" badge) as soon
  as the daily scrape sees a registration link.
- 🗓️ **Add to calendar** — Google Calendar or Apple/Outlook `.ics`, per event or for
  the whole plan.
- 🌗 **Light & dark mode** — follows your system until you toggle; dark matches the
  TeamSheet look (near-black with peach accents).
- 📱 **PWA** — installable, works offline with last-known data, offers a one-tap
  refresh when a new version ships. No install nags.

## How the data works

There is no backend. Event data is a JSON file (`public/data/events.json`) refreshed
daily by a GitHub Actions scraper:

1. **[championships.pokemon.com](https://championships.pokemon.com/en-us/events/)**
   is the primary source (its events API, with a headless-browser capture as a
   self-healing fallback), including per-event detail pages for venue names and
   street addresses.
2. **[rk9.gg](https://rk9.gg/events/pokemon)** supplies registration links; the
   scraper stamps the first day it sees one (`registrationSeenAt`).
3. **[pokedata.ovh](https://www.pokedata.ovh/)** fills gaps.

New venues are geocoded once via Nominatim (cached in the repo), manual overrides in
`scraper/overrides.json` win over everything, and past events are pruned. The commit
only lands if the result validates — if a source changes shape, the site keeps serving
the last good data and the workflow opens an issue instead.

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build (dist/)
npm run scrape     # run the scraper locally (writes public/data/events.json)
```

Requires Node 22+. The site is served from the domain root
(`majors.georgiaplayevents.com`, Vite `base: '/'`); `public/CNAME` keeps the custom
domain attached across deploys.

## Project layout

```
docs/PRD.md              product requirements (living document)
docs/UX-AUDIT.md         mobile-first UX audit (historical; all items shipped)
public/data/events.json  event data (scraper-owned; edit overrides instead)
public/CNAME             custom-domain binding for GitHub Pages
scraper/                 scraper + geocode cache + manual overrides
src/                     the SPA (React 19 + TypeScript + Vite)
.github/workflows/       deploy.yml (Pages), scrape.yml (daily cron)
```

Brand assets (logo, icons, OG imagery) come from
[`pizzacatz/GeorgiaPlayEventsAssets`](https://github.com/pizzacatz/GeorgiaPlayEventsAssets);
the dark palette matches
[`pizzacatz/team-sheet-builder`](https://github.com/pizzacatz/team-sheet-builder).

## Versioning

Semantic versioning, tracked in [CHANGELOG.md](CHANGELOG.md). The footer of the live
site shows the app version and the data snapshot date.
