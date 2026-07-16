import type { Home, PokeEvent } from '../types'
import { addDays, daysUntil, hasDates } from './dates'
import { haversineMiles } from './geo'

export interface TravelInfo {
  distanceMi: number
  /** International trips need longer booking lead time (not shown in the UI). */
  international: boolean
  /** null when the event has no confirmed dates */
  bookByISO: string | null
  bookLabel: string
  urgency: 'future' | 'window' | 'asap' | null
}

/** With no country info, treat long hauls as international bookings. */
const LONG_HAUL_MI = 2500

/**
 * PRD §4.7 heuristic, flights-only: everyone books flights; international
 * ones just need more lead time. Lives here so a future live-fare source
 * only replaces this computation, never the UI.
 */
export function travelInfo(ev: PokeEvent, home: Home): TravelInfo {
  const distanceMi = haversineMiles(home, ev)
  const international =
    home.country !== null ? home.country !== ev.country : distanceMi >= LONG_HAUL_MI

  const leadDays = international ? 90 : 45
  const windowDays = international ? 150 : 75
  const bookLabel = 'Book flights by'

  if (!hasDates(ev)) {
    return { distanceMi, international, bookByISO: null, bookLabel, urgency: null }
  }

  const bookByISO = addDays(ev.startDate, -leadDays)
  const left = daysUntil(ev.startDate)
  const urgency: TravelInfo['urgency'] =
    left <= leadDays ? 'asap' : left <= windowDays ? 'window' : 'future'

  return { distanceMi, international, bookByISO, bookLabel, urgency }
}
