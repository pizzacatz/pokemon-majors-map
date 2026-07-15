import type { PokeEvent } from '../types'

/** Parse an ISO date string as a local-time midnight Date. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function localMidnight(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Whole days from today until the given date (negative if past). */
export function daysUntil(iso: string): number {
  const ms = parseISODate(iso).getTime() - localMidnight().getTime()
  return Math.round(ms / 86_400_000)
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// != null (not !== null) — a field absent from scraped JSON is undefined, and
// letting it through here means .split on undefined and a blank site.
export function isPast(ev: PokeEvent): boolean {
  return ev.endDate != null && daysUntil(ev.endDate) < 0
}

export function hasDates(ev: PokeEvent): ev is PokeEvent & { startDate: string; endDate: string } {
  return ev.startDate != null && ev.endDate != null
}

/** "Aug 28–30, 2026" or "Nov 20 – Dec 2, 2026" */
export function formatDateRange(startISO: string, endISO: string): string {
  const start = parseISODate(startISO)
  const end = parseISODate(endISO)
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' })
  const year = end.getFullYear()
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    if (start.getDate() === end.getDate()) return `${month(start)} ${start.getDate()}, ${year}`
    return `${month(start)} ${start.getDate()}–${end.getDate()}, ${year}`
  }
  return `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}, ${year}`
}

export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "August 2026" grouping label */
export function monthLabel(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Two date ranges overlap (inclusive) — used for weekend-conflict detection. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}
