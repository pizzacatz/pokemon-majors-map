import type { EventType, Format, Home, Region } from '../types'
import { EVENT_TYPES, FORMATS, REGIONS } from '../types'

const KEYS = {
  home: 'pmm.home',
  excluded: 'pmm.excluded',
  filters: 'pmm.filters',
} as const

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full/blocked — app still works, state just won't persist
  }
}

export function loadHome(): Home | null {
  const h = read<Home>(KEYS.home)
  return h && typeof h.lat === 'number' && typeof h.lng === 'number' ? h : null
}

export function saveHome(home: Home | null): void {
  if (home === null) localStorage.removeItem(KEYS.home)
  else write(KEYS.home, home)
}

/** Event ids the user has unchecked. Everything starts checked (PRD §4.4). */
export function loadExcluded(): Set<string> {
  return new Set(read<string[]>(KEYS.excluded) ?? [])
}

export function saveExcluded(excluded: Set<string>): void {
  write(KEYS.excluded, [...excluded])
}

export interface Filters {
  types: EventType[]
  formats: Format[]
  regions: Region[]
}

export const ALL_FILTERS: Filters = { types: EVENT_TYPES, formats: FORMATS, regions: REGIONS }

export function loadFilters(): Filters {
  const f = read<Filters>(KEYS.filters)
  if (!f || !Array.isArray(f.types) || !Array.isArray(f.formats) || !Array.isArray(f.regions)) {
    return ALL_FILTERS
  }
  return f
}

export function saveFilters(filters: Filters): void {
  write(KEYS.filters, filters)
}
