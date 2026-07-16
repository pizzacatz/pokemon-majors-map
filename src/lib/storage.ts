import type { EventType, Home, Region } from '../types'
import { EVENT_TYPES, REGIONS } from '../types'

const KEYS = {
  home: 'pmm.home',
  excluded: 'pmm.excluded', // pre-0.10 opt-out model, read only for migration
  plan: 'pmm.plan',
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

/** Event ids the user has added to their plan. Opt-in: empty by default (PRD §4.4). */
export function loadPlan(): Set<string> | null {
  const p = read<string[]>(KEYS.plan)
  return p ? new Set(p) : null
}

export function savePlan(plan: Set<string>): void {
  write(KEYS.plan, [...plan])
}

/**
 * Pre-0.10 the plan was opt-out (everything checked, pmm.excluded held the
 * unchecked). Users who engaged with that model keep their effective plan;
 * users who never unchecked anything start fresh with an empty plan — an
 * all-31-event "plan" was noise, not intent. Needs the event list, so it
 * runs once data arrives.
 */
export function migratePlan(allIds: string[]): Set<string> {
  const existing = loadPlan()
  if (existing) return existing
  const excluded = read<string[]>(KEYS.excluded)
  const plan =
    excluded && excluded.length > 0
      ? new Set(allIds.filter((id) => !excluded.includes(id)))
      : new Set<string>()
  savePlan(plan)
  localStorage.removeItem(KEYS.excluded)
  return plan
}

export interface Filters {
  types: EventType[]
  regions: Region[]
}

export const ALL_FILTERS: Filters = { types: EVENT_TYPES, regions: REGIONS }

export function loadFilters(): Filters {
  const f = read<Filters>(KEYS.filters)
  if (!f || !Array.isArray(f.types) || !Array.isArray(f.regions)) {
    return ALL_FILTERS
  }
  // Saved filters from before v0.6.0 carried a formats key — ignore it.
  return { types: f.types, regions: f.regions }
}

export function saveFilters(filters: Filters): void {
  write(KEYS.filters, filters)
}
