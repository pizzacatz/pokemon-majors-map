import type { PokeEvent } from '../types'

/**
 * Coerce a raw events.json entry to the full schema. Scraper layers merge with
 * null-pruning, so a field can arrive *absent* rather than null — and an
 * absent startDate slipping into date parsing is a whole-app crash. Every
 * consumer downstream may assume the canonical shape.
 */
export function normalizeEvent(raw: unknown): PokeEvent | null {
  if (raw === null || typeof raw !== 'object') return null
  const ev = raw as Record<string, unknown> & { links?: Record<string, unknown> }
  if (typeof ev.id !== 'string' || typeof ev.lat !== 'number' || typeof ev.lng !== 'number') {
    return null
  }
  const startDate = typeof ev.startDate === 'string' ? ev.startDate : null
  const endDate = typeof ev.endDate === 'string' ? ev.endDate : startDate
  return {
    id: ev.id,
    name: typeof ev.name === 'string' ? ev.name : ev.id,
    type: ev.type === 'special' || ev.type === 'international' || ev.type === 'worlds' ? ev.type : 'regional',
    formats: Array.isArray(ev.formats) && ev.formats.length ? (ev.formats as PokeEvent['formats']) : ['tcg', 'vgc', 'go'],
    startDate,
    endDate,
    venue: typeof ev.venue === 'string' ? ev.venue : null,
    city: typeof ev.city === 'string' ? ev.city : '',
    country: typeof ev.country === 'string' ? ev.country : '',
    region: ev.region === 'EU' || ev.region === 'LATAM' || ev.region === 'OCE' || ev.region === 'APAC' ? ev.region : 'NA',
    lat: ev.lat,
    lng: ev.lng,
    links: {
      official: typeof ev.links?.official === 'string' ? (ev.links.official as string) : null,
      registration: typeof ev.links?.registration === 'string' ? (ev.links.registration as string) : null,
    },
    registrationOpens: typeof ev.registrationOpens === 'string' ? ev.registrationOpens : null,
  }
}
