# UX/UI Audit — Map of Pokémon Championships (v0.2.4 audit)

> **Status (2026-07-17): complete — kept as a historical record.** Every P0/P1/P2
> item below shipped across v0.3.0–v0.5.0. A second audit (2026-07-16) drove the
> v0.8 plan-surface consolidation (Schedule ⊃ Itinerary + map plan strip) and the
> v0.10 opt-in plan model, plus search, OG meta, flights links, and the
> update-ready toast. See CHANGELOG.md for the mapping.

**Date:** 2026-07-16 · **Method:** hands-on walkthrough of every app state on
mobile viewports (390×844, 360×640, landscape 844×390), light + dark mode,
cold start through power-user flows, evaluated against mobile-first heuristics
(vertical budget, thumb reach, touch targets ≥44px, information hierarchy,
feedback, WCAG contrast). Screenshot evidence captured for each finding.

---

## The one structural problem behind most findings

**The map is the hero, but it gets the leftovers.** On a 390×844 phone the
fixed chrome consumes: top bar (~56px) + filter row (~44px) + timeline
(~230px) + tab bar (~60px) ≈ **390px — nearly half the screen** — before the
map draws a single tile. Open an event card and the map disappears entirely.
On a 360×640 phone the card itself gets clipped mid-content. In landscape the
map is a ~50px sliver. Most P0 items below are ways of giving that space back.

---

## P0 — Structural (do these first)

### 1. Reclaim the vertical budget
- **Timeline defaults to collapsed on phones** (expanded on ≥700px screens),
  and the open/closed choice persists in localStorage. When collapsed, show a
  slim one-line strip: "Next: Worlds · 43 days →" that expands on tap — the
  strip is *useful* while collapsed, not just a toggle.
- **Filters move off the map** into a single `Filter` button (top bar or map
  overlay) opening a bottom-sheet panel. Today's chip row costs 44px on every
  tab and reads as a wall of 12 active chips — it looks like a legend but
  isn't labeled as one, and "everything on" is indistinguishable from noise.
  Show a small "Filtered · 12" chip on the map only when filters deviate from
  default.

### 2. Real bottom sheet for event cards *(single biggest win)*
Today's sheet is a fixed panel: no drag handle, no swipe-dismiss, content
silently clipped on small screens (the season-plan checkbox is cut off at
360×640 with no scroll affordance).
- Snap points: **peek** (~35%: name, dates, countdown, Register button) and
  **full** (everything). Drag handle + swipe-down to dismiss.
- **Fly-to must land the pin in view.** Right now the flight ends with the
  destination pin hidden *behind* the sheet — the marquee interaction has no
  payoff. Offset the flyTo center by the sheet height (Leaflet
  `setView` with pixel offset) or open the sheet at peek height after flying.

### 3. First-run experience
Cold start is a wall of unlabeled colored pins over the US, an empty timeline
(first event is 43 days out, so the visible strip shows only "Today" and dead
space), and no explanation of what checking/unchecking does.
- One-time hint card: "📍 Set your home to see distances and booking dates"
  with a **Use my location** button right there (today geolocation is buried
  behind Set home → banner → second tap).
- **Pin color legend** (see P1-7 — merge it with filters).
- **Timeline auto-scrolls to the first upcoming event** on open; the today
  marker can sit at the left *edge of content*, not force 43 days of blank
  runway.

### 4. Back button / deep links
Tabs and the open card aren't in browser history: on Android, back from
Schedule *exits the app*; a shared plan is the only URL state that exists.
Push tab switches and card-opens into `history` (`?tab=schedule`,
`?event=id`), making back dismiss the sheet → return to map → then exit, and
making every event card **linkable** (nice side effect: share a single event).

---

## P1 — High value, medium effort

### 5. Event card hierarchy
The card presents 8 controls with near-equal visual weight. For a competitor
the hierarchy is: Register ≫ dates/countdown ≫ travel ≫ everything else.
- One primary button: **Register on RK9** (red). When registration isn't open,
  don't render a dead gray chip — show useful text: "Registration not open
  yet — typically ~2–3 months out." (Schema already reserves
  `registrationOpens` for when the scraper can fill it.)
- Collapse Google Calendar + .ics into one **Add to calendar** control.
  Official page / Hotels / Show on map become a compact secondary row.
- **De-noise titles**: every card says "2027 … Pokémon Regional
  Championships" — two lines of boilerplate per card. Show **"Baltimore
  Regional"** as the title (we already compute this for the timeline) with the
  full official name as small print.

### 6. Schedule scannability
32 tall cards ≈ 10,000px of scrolling. Convert to **compact rows** (title,
date, countdown, distance) that expand on tap; **sticky month headers**; a
month quick-jump strip at top. The full card stays for the expanded state.

### 7. Legend = filter
One control, two jobs: a row of the four type colors with labels
(🔵 Regional · 🟡 Special · 🟣 IC · 🔴 Worlds) where tapping a color toggles
that type. New users learn the colors; returning users filter in one tap.

### 8. Dark mode map
The UI goes dark but OSM tiles stay bright white — a flashbang around a dark
frame (verified in dark-mode capture). Apply the standard dark-tile CSS
(`filter: invert(1) hue-rotate(180deg) brightness(.95) contrast(.9)` on
`.leaflet-tile`) or a dark basemap style, and fix the light attribution strip.

### 9. Native share
`navigator.share()` for plan links on mobile — the OS share sheet beats
"link copied" for texting a season plan to friends. Clipboard stays as the
desktop fallback.

### 10. Touch targets
Close ✕ (~28px), the season-plan checkbox, and timeline fly pins (~20px) are
below the 44px minimum. Grow the *hit areas* with padding (visual size can
stay). Timeline bubbles should accept tap-anywhere to open the event card,
with the 📍 as a secondary affordance.

---

## P2 — Polish

11. **Contrast:** the yellow urgency text (`#f5b800` on white ≈ 1.9:1) fails
    WCAG; darken for text use (`#9a7400`-ish). Timeline date labels at
    0.62rem are below comfortable legibility — bump and/or thin them out.
12. **Press states:** buttons have `:hover` styling only; add `:active`
    feedback for touch.
13. **Home marker affordance:** the green ring means nothing without memory.
    Tapping it should say "Home". Consider a small "from home" label in the
    card travel line ("1,354 mi from home · ✈️").
14. **PWA install:** manifest has only an SVG icon — Android requires PNG
    192/512 (+ maskable) for the install prompt. Cheap and unlocks real
    installability.
15. **Landscape:** collapse the timeline and dock the tab bar as a left rail;
    today the map is a ~50px sliver.
16. **Loading & offline states:** events.json loads with no indicator (blank
    map moment on slow connections); when the SW serves cached data offline,
    say so ("Showing data from Jul 14 — offline").
17. **Accessibility:** map pins have no accessible names or keyboard access;
    "Link copied" isn't announced (aria-live); flyTo should respect
    `prefers-reduced-motion`; sheet needs focus management.
18. **Micro-copy:** "Season list" → "My season (31)"; "Fly to map" → "Show on
    map"; "Registration TBA" per §5.

---

## What already works well (keep)

- Timeline concept + fly-to is a genuinely distinctive planning tool.
- Countdown + book-by heuristic answers the core question instantly.
- Venue/street addresses with building-level pins.
- Checklist graying across map/timeline/itinerary is coherent shared state.
- Fast: 112KB gzipped, instant loads, no spinners needed *because* it's fast
  (loading states still matter for bad connections).
- Bottom tab bar with three clear destinations.

## Suggested sequencing

| Phase | Items | Theme |
| ----- | ----- | ----- |
| 1 | P0 1–4 | Space budget, sheet, first-run, back button |
| 2 | P1 5–7 | Card hierarchy, schedule rows, legend-filter |
| 3 | P1 8–10, P2 | Dark map, share, targets, polish, a11y |

Phase 1 alone transforms the phone experience: map visible by default,
cards that behave like native sheets, a first-run that teaches itself, and a
back button that doesn't eject the user.
