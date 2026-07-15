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

/** Walk arbitrary JSON and collect objects that look like championship events. */
function mineEventObjects(node, out = [], depth = 0) {
  if (depth > 12 || node === null || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) mineEventObjects(item, out, depth + 1)
    return out
  }
  const keys = Object.keys(node).map((k) => k.toLowerCase())
  const hasName = keys.some((k) => ['name', 'title', 'eventname'].includes(k))
  const hasDate = keys.some((k) => ['startdate', 'start_date', 'datestart', 'start'].includes(k))
  const hasPlace = keys.some((k) => ['city', 'location', 'venue', 'address'].includes(k))
  if (hasName && hasDate && hasPlace) out.push(node)
  for (const v of Object.values(node)) mineEventObjects(v, out, depth + 1)
  return out
}

function pick(obj, names) {
  for (const [k, v] of Object.entries(obj)) {
    if (names.includes(k.toLowerCase()) && v != null && v !== '') return v
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
  const name = String(pick(raw, ['name', 'title', 'eventname']) ?? '')
  const type = name ? inferType(name) : null
  if (!type) return null // majors only (PRD §3)

  const city = pick(raw, ['city']) ?? null
  const country = normalizeCountry(pick(raw, ['country', 'countrycode', 'country_code']))
  if (!city || !country) return null

  const startDate = toISODateOnly(pick(raw, ['startdate', 'start_date', 'datestart', 'start']))
  const endDate = toISODateOnly(pick(raw, ['enddate', 'end_date', 'dateend', 'end'])) ?? startDate

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
    region: REGION_BY_COUNTRY[country] ?? 'NA',
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

const US_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'])

/** "Merida, Mexico" / "Portland, OR" / "Melbourne, Australia" → {city, country} */
function parseLocation(text) {
  const m = /([A-Za-zÀ-ÿ'. -]{2,40}),\s*([A-Za-zÀ-ÿ'. -]{2,30})\s*$/.exec(text.trim())
  if (!m) return null
  const city = m[1].trim()
  const tail = m[2].trim()
  if (US_STATES.has(tail.toUpperCase())) return { city, country: 'US' }
  const country = normalizeCountry(tail)
  return country ? { city, country } : null
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
      // Name: longest cell mentioning a major keyword, else the link text.
      const name =
        cells.find((c) => /regional|international|special|world/i.test(c)) ??
        (link ? stripTags(row.slice(row.indexOf(link[1]))).split('|')[0] : '')
      const type = name ? inferType(name) : null
      if (!type) continue
      const loc = cells.map(parseLocation).find(Boolean) ?? parseLocation(rowText.split('|').pop() ?? '')
      if (!loc) continue
      found.push({
        id: slugify(`${type}-${dates?.startDate?.slice(0, 4) ?? 'tbd'}-${loc.city}-${name.slice(0, 40)}`),
        name: name.trim(),
        type,
        formats: ['tcg', 'vgc', 'go'],
        startDate: dates?.startDate ?? null,
        endDate: dates?.endDate ?? null,
        venue: null,
        city: loc.city,
        country: loc.country,
        region: REGION_BY_COUNTRY[loc.country] ?? 'NA',
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

async function scrapeOfficial() {
  const pages = [
    'https://championships.pokemon.com/en-us/events/',
    'https://championships.pokemon.com/en-us/events/regionals',
  ]
  const found = []
  for (const url of pages) {
    try {
      const html = await fetchText(url)
      for (const blob of extractJsonBlobs(html)) {
        for (const raw of mineEventObjects(blob)) {
          const ev = normalize(raw)
          if (ev) found.push(ev)
        }
      }
      if (found.length === 0) logEmptySource(`official ${url}`, html)
      log(`official: ${url} → ${found.length} cumulative`)
    } catch (err) {
      log(`official: ${url} failed (${err.message})`)
    }
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

async function geocodeMissing(events) {
  const cache = loadJson(GEOCACHE_PATH, {})
  let dirty = false
  for (const ev of events) {
    if (ev.lat != null && ev.lng != null) continue
    const query = [ev.venue, ev.city, ev.country].filter(Boolean).join(', ')
    if (!(query in cache)) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
        const hits = res.ok ? await res.json() : []
        cache[query] = hits[0] ? { lat: Number(hits[0].lat), lng: Number(hits[0].lon) } : null
        dirty = true
        await new Promise((r) => setTimeout(r, 1100)) // Nominatim usage policy
      } catch {
        cache[query] = null
      }
    }
    const hit = cache[query]
    if (hit) {
      ev.lat = hit.lat
      ev.lng = hit.lng
    }
  }
  if (dirty) writeFileSync(GEOCACHE_PATH, JSON.stringify(cache, null, 2) + '\n')
  return events.filter((ev) => ev.lat != null && ev.lng != null)
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
  // A dates-TBD placeholder is superseded once the same type+city has real dates.
  const out = [...byKey.values()]
  const dated = new Set(out.filter((e) => e.startDate).map((e) => `${e.type}|${e.city.toLowerCase()}`))
  return out.filter((e) => e.startDate || !dated.has(`${e.type}|${e.city.toLowerCase()}`))
}

/** Drop null/undefined so a sparse source never blanks a known-good field. */
function prune(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null))
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

  const official = await scrapeOfficial()
  const pokedata = await scrapePokedata()
  const rk9 = await scrapeRK9()
  log(`scraped: official=${official.length} pokedata=${pokedata.length} rk9=${rk9.length}`)

  if (official.length === 0 && pokedata.length === 0 && rk9.length === 0) {
    fail('all sources returned nothing — source formats may have changed')
  }

  let events = merge({ official, pokedata, rk9, existing: current.events, overrides })
  events = await geocodeMissing(events)
  events.sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'))

  validate(events, current.events.length)

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
