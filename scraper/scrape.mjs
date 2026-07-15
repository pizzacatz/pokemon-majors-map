#!/usr/bin/env node
/**
 * Daily event-data refresh (PRD §5.3).
 *
 * Sources: championships.pokemon.com (official specifics) and pokedata.ovh
 * (community aggregator). Neither has a public API, so this scraper mines
 * embedded JSON out of their pages, with HTML link parsing as fallback.
 *
 * Fail-safe contract: on any validation failure this exits non-zero WITHOUT
 * touching public/data/events.json — the site keeps serving the last good
 * snapshot and the workflow files an issue. Exits 0 with no write when
 * nothing changed.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EVENTS_PATH = join(ROOT, 'public/data/events.json')
const GEOCACHE_PATH = join(ROOT, 'scraper/geocache.json')
const OVERRIDES_PATH = join(ROOT, 'scraper/overrides.json')

const USER_AGENT = 'pokemon-majors-map/0.1 (+https://github.com/pizzacatz/pokemon-majors-map)'

const REGION_BY_COUNTRY = {
  US: 'NA', CA: 'NA', MX: 'NA',
  BR: 'LATAM', AR: 'LATAM', CL: 'LATAM', CO: 'LATAM', PE: 'LATAM', EC: 'LATAM',
  UY: 'LATAM', PY: 'LATAM', BO: 'LATAM', CR: 'LATAM', PA: 'LATAM', GT: 'LATAM', DO: 'LATAM',
  GB: 'EU', DE: 'EU', FR: 'EU', ES: 'EU', IT: 'EU', NL: 'EU', BE: 'EU', PT: 'EU',
  IE: 'EU', PL: 'EU', CZ: 'EU', AT: 'EU', CH: 'EU', SE: 'EU', NO: 'EU', DK: 'EU',
  FI: 'EU', GR: 'EU', HU: 'EU', RO: 'EU', HR: 'EU', SK: 'EU', SI: 'EU', LT: 'EU',
  LV: 'EU', EE: 'EU', LU: 'EU', MT: 'EU', CY: 'EU', BG: 'EU', IS: 'EU',
  AU: 'OCE', NZ: 'OCE',
  JP: 'APAC', KR: 'APAC', SG: 'APAC', MY: 'APAC', PH: 'APAC', TW: 'APAC',
  HK: 'APAC', TH: 'APAC', ID: 'APAC', IN: 'APAC', VN: 'APAC', AE: 'APAC', ZA: 'APAC',
}

function log(...args) {
  console.log('[scrape]', ...args)
}

function fail(msg) {
  console.error('[scrape] FATAL:', msg)
  process.exit(2)
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

/* ---------------- generic embedded-JSON mining ---------------- */

/** Pull every JSON blob embedded in <script> tags (__NEXT_DATA__, state dumps…). */
function extractJsonBlobs(html) {
  const blobs = []
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = scriptRe.exec(html)) !== null) {
    const body = m[1].trim()
    if (!body) continue
    if (body.startsWith('{') || body.startsWith('[')) {
      try {
        blobs.push(JSON.parse(body))
        continue
      } catch { /* not pure JSON */ }
    }
    // window.__STATE__ = {...}; style assignments
    const assignRe = /=\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*;?\s*$/
    const am = assignRe.exec(body)
    if (am) {
      try {
        blobs.push(JSON.parse(am[1]))
      } catch { /* dynamic JS, skip */ }
    }
  }
  return blobs
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/

/**
 * Canonical key form: lowercase, Crafter-CMS type suffixes stripped — the
 * official site's API returns keys like eventName_s / startDate_dt / uRL_s.
 */
function canonKey(k) {
  return k.toLowerCase().replace(/_(s|i|l|f|d|b|dt|o|txt|html|smv|imv|dtmv)$/, '').replace(/_/g, '')
}

const NAME_KEYS = ['name', 'title', 'eventname']
const DATE_KEYS = ['startdate', 'datestart', 'start', 'eventdate', 'date']
const PLACE_KEYS = ['city', 'location', 'venue', 'address', 'eventlocation']

/** Walk arbitrary JSON and collect objects that look like championship events. */
function mineEventObjects(node, out = [], depth = 0) {
  if (depth > 12 || node === null || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) mineEventObjects(item, out, depth + 1)
    return out
  }
  const keys = Object.keys(node).map(canonKey)
  const hasName = keys.some((k) => NAME_KEYS.includes(k))
  const hasDate = keys.some((k) => DATE_KEYS.includes(k))
  const hasPlace = keys.some((k) => PLACE_KEYS.includes(k))
  if (hasName && hasDate && hasPlace) out.push(node)
  for (const v of Object.values(node)) mineEventObjects(v, out, depth + 1)
  return out
}

function pick(obj, names) {
  for (const [k, v] of Object.entries(obj)) {
    if (names.includes(canonKey(k)) && v != null && v !== '') return v
  }
  return null
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferType(name) {
  const n = name.toLowerCase()
  if (n.includes('world championship')) return 'worlds'
  if (n.includes('international')) return 'international'
  if (n.includes('special')) return 'special'
  if (n.includes('regional')) return 'regional'
  return null
}

function toISODateOnly(value) {
  if (typeof value !== 'string') return null
  const m = DATE_RE.exec(value)
  if (m) return m[0]
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

/** Normalize a mined raw object into our schema; null if it can't qualify. */
function normalize(raw) {
  const name = cleanName(String(pick(raw, NAME_KEYS) ?? ''))
  const type = name ? inferType(name) : null
  if (!type) return null // majors only (PRD §3)

  let city = pick(raw, ['city']) ?? null
  let country = normalizeCountry(pick(raw, ['country', 'countrycode', 'countryname']))
  let geoQuery = null
  if (!city || !country) {
    // Sources often ship one "City, XX" string instead of separate fields.
    const locStr = pick(raw, ['location', 'address', 'eventlocation', 'venueaddress'])
    const loc = typeof locStr === 'string' ? parseLocation(locStr) : null
    if (loc) {
      city = city ?? loc.city
      country = country ?? loc.country // may stay null — geocoder resolves it
      geoQuery = loc.raw
    }
  }
  if (!city) return null

  const startDate = toISODateOnly(pick(raw, DATE_KEYS))
  const endDate = toISODateOnly(pick(raw, ['enddate', 'dateend', 'end'])) ?? startDate

  const lat = Number(pick(raw, ['lat', 'latitude']))
  const lng = Number(pick(raw, ['lng', 'lon', 'longitude']))

  const formats = []
  const rawFormats = JSON.stringify(raw).toLowerCase()
  if (rawFormats.includes('tcg') || rawFormats.includes('trading card')) formats.push('tcg')
  if (rawFormats.includes('vgc') || rawFormats.includes('video game')) formats.push('vgc')
  if (rawFormats.includes('"go"') || rawFormats.includes('pokemon go') || rawFormats.includes('pokémon go')) formats.push('go')

  const links = { official: null, registration: null }
  const url = pick(raw, ['url', 'link', 'href', 'website'])
  if (typeof url === 'string') {
    if (url.includes('rk9.gg')) links.registration = url
    else links.official = absoluteUrl(url)
  }
  const reg = pick(raw, ['registration', 'registrationurl', 'rk9', 'rk9url'])
  if (typeof reg === 'string' && reg.startsWith('http')) links.registration = reg

  const year = startDate ? startDate.slice(0, 4) : 'tbd'
  return {
    id: slugify(`${type}-${year}-${city}-${name.slice(0, 40)}`),
    name,
    type,
    formats: formats.length ? formats : ['tcg', 'vgc', 'go'],
    startDate,
    endDate,
    venue: pick(raw, ['venue', 'venuename']) ?? null,
    city: String(city),
    country,
    region: country ? (REGION_BY_COUNTRY[country] ?? 'NA') : null,
    geoQuery: geoQuery ?? undefined,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    links,
    registrationOpens: null,
  }
}

const COUNTRY_NAMES = {
  'united states': 'US', usa: 'US', 'united states of america': 'US',
  canada: 'CA', mexico: 'MX', brazil: 'BR', brasil: 'BR', argentina: 'AR',
  chile: 'CL', colombia: 'CO', peru: 'PE',
  'united kingdom': 'GB', uk: 'GB', england: 'GB', germany: 'DE', france: 'FR',
  spain: 'ES', italy: 'IT', netherlands: 'NL', belgium: 'BE', portugal: 'PT',
  ireland: 'IE', poland: 'PL', australia: 'AU', 'new zealand': 'NZ',
  japan: 'JP', 'south korea': 'KR', korea: 'KR', singapore: 'SG', malaysia: 'MY',
  philippines: 'PH', taiwan: 'TW', 'hong kong': 'HK', thailand: 'TH',
  indonesia: 'ID', india: 'IN',
}

function normalizeCountry(value) {
  if (typeof value !== 'string' || !value) return null
  const v = value.trim()
  if (/^uk$/i.test(v)) return 'GB' // common but not the ISO code
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase()
  return COUNTRY_NAMES[v.toLowerCase()] ?? null
}

function absoluteUrl(url) {
  if (url.startsWith('http')) return url
  if (url.startsWith('/')) return `https://championships.pokemon.com${url}`
  return null
}

function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function logEmptySource(name, html) {
  log(`${name}: mined 0 events; page starts: ${stripTags(html).slice(0, 300)}`)
}

/* ---------------- sources ---------------- */

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
}

/**
 * Parse "January 17-18, 2026", "Jan 31 – Feb 1, 2026", "March 7, 2026".
 * Returns {startDate, endDate} or null.
 */
function parseDateRange(text) {
  const m = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s*[-–—]\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2}))?,?\s+(\d{4})/.exec(text)
  if (!m) return null
  const [, m1, d1, m2, d2, year] = m
  const mon1 = MONTHS[m1.toLowerCase()]
  if (!mon1) return null
  const p = (n) => String(n).padStart(2, '0')
  const startDate = `${year}-${p(mon1)}-${p(d1)}`
  if (!d2) return { startDate, endDate: startDate }
  const mon2 = m2 ? MONTHS[m2.toLowerCase()] : mon1
  if (!mon2) return { startDate, endDate: startDate }
  return { startDate, endDate: `${year}-${p(mon2)}-${p(d2)}` }
}

/**
 * "Merida, Mexico" / "Portland, OR" / "Frankfurt am Main, DE" → {city, country, raw}.
 * Two-letter tails are ambiguous — DE is both Delaware and Germany, CA both
 * California and Canada — so country stays null and the geocoder resolves it
 * from the raw string (with addressdetails) instead of us guessing.
 */
function parseLocation(text) {
  const m = /([\p{L}\p{M}'. -]{2,40}),\s*([\p{L}\p{M}'. -]{2,30})\s*$/u.exec(text.trim())
  if (!m) return null
  const city = m[1].trim().replace(/\s*-\s*[A-Z]{2}$/, '') // "Campinas - SP" → "Campinas"
  const tail = m[2].trim()
  const raw = `${city}, ${tail}`
  if (/^[A-Za-z]{2}$/.test(tail) && tail.toUpperCase() !== 'UK') {
    return { city, country: null, raw }
  }
  const country = normalizeCountry(tail)
  return country ? { city, country, raw } : null
}

/** Strip trailing UI text RK9 renders after the event name. */
function cleanName(name) {
  return name.replace(/\s+(Registration|Register|Learn more|View|Details|Sold out).*$/i, '').trim()
}

/**
 * RK9 lists events in server-rendered table rows with /event/<slug> links —
 * also our only source of registration URLs.
 */
async function scrapeRK9() {
  const found = []
  let html = ''
  try {
    html = await fetchText('https://rk9.gg/events/pokemon')
    const rows = html.split(/<tr[\s>]/i).slice(1)
    for (const row of rows) {
      const link = /href="(\/event\/[^"]+)"/.exec(row)
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]))
      const rowText = cells.length ? cells.join(' | ') : stripTags(row)
      const dates = parseDateRange(rowText)
      // Name: the cell mentioning a major keyword, else the link text.
      const name = cleanName(
        cells.find((c) => /regional|international|special|world/i.test(c)) ??
          (link ? stripTags(row.slice(row.indexOf(link[1]))).split('|')[0] : ''),
      )
      const type = name ? inferType(name) : null
      if (!type) continue
      const loc = cells.map(parseLocation).find(Boolean) ?? parseLocation(rowText.split('|').pop() ?? '')
      if (!loc) continue
      found.push({
        id: slugify(`${type}-${dates?.startDate?.slice(0, 4) ?? 'tbd'}-${loc.city}-${name.slice(0, 40)}`),
        name,
        type,
        formats: ['tcg', 'vgc', 'go'],
        startDate: dates?.startDate ?? null,
        endDate: dates?.endDate ?? null,
        venue: null,
        city: loc.city,
        country: loc.country,
        region: loc.country ? (REGION_BY_COUNTRY[loc.country] ?? 'NA') : null,
        geoQuery: loc.raw,
        lat: null,
        lng: null,
        links: {
          official: null,
          registration: link ? `https://rk9.gg${link[1]}` : null,
        },
        registrationOpens: null,
      })
    }
    if (found.length === 0 && html) logEmptySource('rk9', html)
    log(`rk9: ${found.length} events`)
  } catch (err) {
    log(`rk9 failed (${err.message})`)
  }
  return found
}

const OFFICIAL_PAGES = [
  'https://championships.pokemon.com/en-us/events/',
  'https://championships.pokemon.com/en-us/events/regionals',
]

async function launchBrowser() {
  const { chromium } = await import('playwright-core')
  const opts = { headless: true, args: ['--no-sandbox'] }
  if (process.env.CHROME_PATH) {
    return chromium.launch({ ...opts, executablePath: process.env.CHROME_PATH })
  }
  // GitHub-hosted runners ship Google Chrome; no browser download needed.
  return chromium.launch({ ...opts, channel: 'chrome' })
}

function mineBlobs(blobs, found) {
  for (const blob of blobs) {
    for (const raw of mineEventObjects(blob)) {
      const ev = normalize(raw)
      if (ev) found.push(ev)
    }
  }
}

/**
 * The official site is the first place events are announced (owner decision
 * 2026-07-16: primary source) but it is JS-rendered, so a plain fetch sees an
 * empty shell. Drive a real browser and capture the JSON the page itself
 * loads — that follows whatever endpoint the frontend uses today.
 */
// Endpoint the official site's own frontend fetches (discovered from the
// rendered page's network traffic, 2026-07-15). status=upcoming matches our
// future-events-only policy.
const OFFICIAL_API = 'https://championships.pokemon.com/api/events.json?locale=en-us&status=upcoming'

async function scrapeOfficial() {
  const found = []
  // Known API first: cheapest and most complete.
  try {
    const res = await fetch(OFFICIAL_API, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
    if (res.ok) {
      const body = await res.json()
      mineBlobs([body], found)
      const items = Array.isArray(body?.items) ? body.items : []
      log(`official api: ${items.length} items → ${found.length} events`)
      if (items.length > 0 && found.length === 0) {
        log(`official api: first item for diagnosis :: ${JSON.stringify(items[0]).slice(0, 900)}`)
      }
    } else {
      log(`official api: HTTP ${res.status}`)
    }
  } catch (err) {
    log(`official api failed (${err.message})`)
  }
  if (found.length > 0) return found

  // Endpoint may have moved — fall back to what the real page does today.

  try {
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage()
      const payloads = []
      page.on('response', (res) => {
        const ct = res.headers()['content-type'] ?? ''
        if (!ct.includes('json')) return
        res.json().then((body) => payloads.push({ url: res.url(), body })).catch(() => {})
      })
      for (const url of OFFICIAL_PAGES) {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 }).catch((err) => {
          log(`official rendered: ${url} navigation issue (${err.message})`)
        })
        mineBlobs(extractJsonBlobs(await page.content()), found)
      }
      mineBlobs(payloads.map((p) => p.body), found)
      log(`official rendered: ${found.length} events from ${payloads.length} json responses`)
      if (found.length === 0) {
        // Surface what the page actually fetched so the next fix is informed.
        for (const p of payloads.slice(0, 8)) {
          log(`  payload ${p.url} :: ${JSON.stringify(p.body).slice(0, 220)}`)
        }
      }
    } finally {
      await browser.close()
    }
  } catch (err) {
    log(`official rendered failed (${err.message})`)
  }
  return found
}

async function scrapePokedata() {
  const found = []
  try {
    const html = await fetchText('https://www.pokedata.ovh/')
    for (const blob of extractJsonBlobs(html)) {
      for (const raw of mineEventObjects(blob)) {
        const ev = normalize(raw)
        if (ev) found.push(ev)
      }
    }
    if (found.length === 0) logEmptySource('pokedata', html)
    log(`pokedata: ${found.length} events`)
  } catch (err) {
    log(`pokedata failed (${err.message})`)
  }
  return found
}

/* ---------------- geocoding (Nominatim, cached, 1 req/s) ---------------- */

function loadJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback
}

/**
 * Fill lat/lng — and, for ambiguous locations (geoQuery), the true country —
 * from Nominatim, cached and rate-limited per usage policy. Mutates events.
 */
async function geocodeList(events, cache, dirty) {
  for (const ev of events) {
    const query = ev.geoQuery ?? [ev.venue, ev.city, ev.country].filter(Boolean).join(', ')
    delete ev.geoQuery
    if (ev.lat != null && ev.lng != null && ev.country) continue
    const stale =
      !(query in cache) ||
      cache[query] === null ||
      (!ev.country && cache[query] && cache[query].country == null)
    if (stale) {
      // Refetch no-result entries and pre-country-format entries: caching a
      // transient failure (or an answer that can't resolve the country the
      // event still needs) once blanked events forever.
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
        if (res.ok) {
          const hits = await res.json()
          cache[query] = hits[0]
            ? {
                lat: Number(hits[0].lat),
                lng: Number(hits[0].lon),
                country: (hits[0].address?.country_code ?? '').toUpperCase() || null,
              }
            : null // genuine no-result — kept, but retried next run
          dirty.v = true
        } else {
          log(`geocode: HTTP ${res.status} for "${query}" — not caching`)
        }
        await new Promise((r) => setTimeout(r, 1100)) // Nominatim usage policy
      } catch (err) {
        log(`geocode: "${query}" failed (${err.message}) — not caching`)
      }
    }
    const hit = cache[query]
    if (hit) {
      if (ev.lat == null || ev.lng == null) {
        ev.lat = hit.lat
        ev.lng = hit.lng
      }
      if (!ev.country && hit.country) ev.country = hit.country
      if (!ev.region && ev.country) ev.region = REGION_BY_COUNTRY[ev.country] ?? 'NA'
    }
  }
}

/* ---------------- merge + validate + write ---------------- */

/** Layer `add` over `base` without letting sparse fields blank known-good data. */
function mergeOne(base, add) {
  return {
    ...base,
    ...prune(add),
    links: { ...prune(base?.links ?? {}), ...prune(add?.links ?? {}) },
  }
}

/** Official wins on conflicts; pokedata/rk9 fill gaps; overrides win over all (PRD §5.3). */
function merge({ official, pokedata, rk9, existing, overrides }) {
  const byId = new Map()
  for (const ev of existing) byId.set(ev.id, ev) // keep last-good as baseline
  for (const layer of [pokedata, rk9, official]) {
    for (const ev of layer) byId.set(ev.id, mergeOne(byId.get(ev.id), ev))
  }
  for (const ov of overrides) {
    if (ov.remove) byId.delete(ov.id)
    else byId.set(ov.id, mergeOne(byId.get(ov.id), ov))
  }
  return dedupe([...byId.values()])
}

function richness(ev) {
  return (
    (ev.links?.registration ? 2 : 0) +
    (ev.links?.official ? 1 : 0) +
    (ev.venue ? 1 : 0) +
    (ev.startDate ? 1 : 0)
  )
}

/** Sources slug names differently; collapse same-type/date/city entries. */
function dedupe(events) {
  const byKey = new Map()
  for (const ev of events) {
    const key = `${ev.type}|${ev.startDate ?? 'tbd'}|${ev.city.toLowerCase()}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, ev)
    } else {
      const [lo, hi] = richness(ev) >= richness(prev) ? [prev, ev] : [ev, prev]
      byKey.set(key, mergeOne(lo, hi))
    }
  }
  // A dates-TBD placeholder is superseded once the same type+city has real
  // UPCOMING dates — a past event in that city is a previous season's, not
  // this placeholder's, so it must not swallow it.
  const out = [...byKey.values()]
  const today = new Date().toISOString().slice(0, 10)
  const dated = new Set(
    out.filter((e) => e.startDate && e.startDate >= today).map((e) => `${e.type}|${e.city.toLowerCase()}`),
  )
  return out.filter((e) => e.startDate || !dated.has(`${e.type}|${e.city.toLowerCase()}`))
}

/** Drop null/undefined so a sparse source never blanks a known-good field. */
function prune(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null))
}

/**
 * Emit every schema key with an explicit null default. Merge layers prune
 * nulls, so without this an override's null startDate becomes an ABSENT key —
 * which reads as undefined in the app and once black-screened the site.
 */
function canonicalize(ev) {
  const startDate = ev.startDate ?? null
  return {
    id: ev.id,
    name: ev.name,
    type: ev.type,
    formats: Array.isArray(ev.formats) && ev.formats.length ? ev.formats : ['tcg', 'vgc', 'go'],
    startDate,
    endDate: ev.endDate ?? startDate,
    venue: ev.venue ?? null,
    city: ev.city,
    country: ev.country,
    region: ev.region,
    lat: ev.lat,
    lng: ev.lng,
    links: {
      official: ev.links?.official ?? null,
      registration: ev.links?.registration ?? null,
    },
    registrationOpens: ev.registrationOpens ?? null,
  }
}

function validate(events, previousCount) {
  if (events.length === 0) fail('zero events after merge')
  if (previousCount > 0 && events.length < previousCount * 0.5) {
    fail(`event count dropped ${previousCount} → ${events.length} (>50%): refusing to publish`)
  }
  for (const ev of events) {
    for (const field of ['id', 'name', 'type', 'city', 'country', 'region']) {
      if (!ev[field]) fail(`event missing ${field}: ${JSON.stringify(ev).slice(0, 200)}`)
    }
    if (typeof ev.lat !== 'number' || typeof ev.lng !== 'number') {
      fail(`event ${ev.id} not geocoded`)
    }
    if (!['regional', 'special', 'international', 'worlds'].includes(ev.type)) {
      fail(`event ${ev.id} bad type ${ev.type}`)
    }
  }
}

async function main() {
  const current = loadJson(EVENTS_PATH, { meta: {}, events: [] })
  const overrides = loadJson(OVERRIDES_PATH, [])

  // Official site first: it is where events are announced earliest and its
  // fields win the merge; rk9 fills registration links, pokedata fills gaps.
  const official = await scrapeOfficial()
  const pokedata = await scrapePokedata()
  const rk9 = await scrapeRK9()
  log(`scraped: official=${official.length} pokedata=${pokedata.length} rk9=${rk9.length}`)

  if (official.length === 0 && pokedata.length === 0 && rk9.length === 0) {
    fail('all sources returned nothing — source formats may have changed')
  }

  // Geocode BEFORE merging so corrected coordinates/countries overwrite any
  // stale values in the existing baseline instead of being pruned as nulls.
  const cache = loadJson(GEOCACHE_PATH, {})
  const dirty = { v: false }
  for (const list of [official, pokedata, rk9]) await geocodeList(list, cache, dirty)
  if (dirty.v) writeFileSync(GEOCACHE_PATH, JSON.stringify(cache, null, 2) + '\n')

  const unresolved = (ev) => typeof ev.lat !== 'number' || typeof ev.lng !== 'number' || !ev.country || !ev.region
  for (const list of [official, pokedata, rk9]) {
    for (const ev of list.filter(unresolved)) log(`dropping unresolved event: ${ev.id}`)
  }

  let events = merge({
    official: official.filter((ev) => !unresolved(ev)),
    pokedata: pokedata.filter((ev) => !unresolved(ev)),
    rk9: rk9.filter((ev) => !unresolved(ev)),
    existing: current.events,
    overrides,
  })
  events = events.map(canonicalize)

  // Future events only (owner decision 2026-07-15): drop anything already
  // over. Dates-TBD announcements stay; an event still running today stays.
  const today = new Date().toISOString().slice(0, 10)
  const isUpcoming = (ev) => ev.endDate === null || ev.endDate >= today
  events = events.filter(isUpcoming)
  events.sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'))

  // Compare like with like: the sanity check must not count baseline events
  // that this run intentionally pruned as past.
  validate(events, current.events.filter(isUpcoming).length)

  const next = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'scraper',
      schemaVersion: 1,
    },
    events,
  }

  const currentPayload = JSON.stringify(current.events)
  if (currentPayload === JSON.stringify(events)) {
    log('no changes — leaving events.json untouched')
    return
  }

  writeFileSync(EVENTS_PATH, JSON.stringify(next, null, 2) + '\n')
  log(`wrote ${events.length} events`)
}

main().catch((err) => fail(err.stack ?? String(err)))
