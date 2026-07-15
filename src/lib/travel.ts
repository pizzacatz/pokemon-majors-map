import type { Home, PokeEvent } from '../types'
import { addDays, daysUntil, hasDates } from './dates'
import { haversineMiles } from './geo'

export interface TravelInfo {
  distanceMi: number
  mode: 'drive' | 'fly'
  international: boolean
  /** null when the event has no confirmed dates */
  bookByISO: string | null
  bookLabel: string
  urgency: 'future' | 'window' | 'asap' | null
}

const DRIVE_MAX_MI = 350
/** With no country info, treat long hauls as international bookings. */
const LONG_HAUL_MI = 2500

/**
 * PRD §4.7 heuristic. Lives here so a future live-fare source only replaces
 * this computation, never the UI.
 */
export function travelInfo(ev: PokeEvent, home: Home): TravelInfo {
  const distanceMi = haversineMiles(home, ev)
  const drive = distanceMi < DRIVE_MAX_MI
  const international =
    !drive && (home.country !== null ? home.country !== ev.country : distanceMi >= LONG_HAUL_MI)

  const leadDays = drive ? 30 : international ? 90 : 45
  const windowDays = drive ? 30 : international ? 150 : 75
  const bookLabel = drive ? 'Book hotel by' : 'Book flights by'

  if (!hasDates(ev)) {
    return { distanceMi, mode: drive ? 'drive' : 'fly', international, bookByISO: null, bookLabel, urgency: null }
  }

  const bookByISO = addDays(ev.startDate, -leadDays)
  const left = daysUntil(ev.startDate)
  const urgency: TravelInfo['urgency'] =
    left <= leadDays ? 'asap' : left <= windowDays ? 'window' : 'future'

  return { distanceMi, mode: drive ? 'drive' : 'fly', international, bookByISO, bookLabel, urgency }
}
