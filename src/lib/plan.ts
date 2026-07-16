import type { PokeEvent } from '../types'
import { hasDates, isPast, rangesOverlap } from './dates'

/** The user's plan: checked, upcoming events in date order. */
export function planEvents(events: PokeEvent[], isChecked: (id: string) => boolean): PokeEvent[] {
  return events
    .filter((ev) => isChecked(ev.id) && !isPast(ev))
    .sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'))
}

/** Same-weekend clashes among the given (already plan-filtered) events (PRD §4.6). */
export function conflictIds(plan: PokeEvent[]): Set<string> {
  const ids = new Set<string>()
  const dated = plan.filter(hasDates)
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      const a = dated[i]
      const b = dated[j]
      if (rangesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) {
        ids.add(a.id)
        ids.add(b.id)
      }
    }
  }
  return ids
}
