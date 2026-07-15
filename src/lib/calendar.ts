import type { PokeEvent } from '../types'
import { addDays, hasDates } from './dates'

function compact(iso: string): string {
  return iso.replaceAll('-', '')
}

function location(ev: PokeEvent): string {
  return [ev.venue, ev.city, ev.country].filter(Boolean).join(', ')
}

function details(ev: PokeEvent): string {
  const lines = [
    ev.links.registration && `Register: ${ev.links.registration}`,
    ev.links.official && `Official page: ${ev.links.official}`,
    'Via Pokémon Majors Map',
  ].filter(Boolean)
  return lines.join('\n')
}

/** All-day Google Calendar template URL (end date exclusive). No API needed. */
export function googleCalendarUrl(ev: PokeEvent): string | null {
  if (!hasDates(ev)) return null
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.name,
    dates: `${compact(ev.startDate)}/${compact(addDays(ev.endDate, 1))}`,
    location: location(ev),
    details: details(ev),
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function icsEvent(ev: PokeEvent & { startDate: string; endDate: string }): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${ev.id}@pokemon-majors-map`,
    `DTSTART;VALUE=DATE:${compact(ev.startDate)}`,
    `DTEND;VALUE=DATE:${compact(addDays(ev.endDate, 1))}`,
    `SUMMARY:${icsEscape(ev.name)}`,
    `LOCATION:${icsEscape(location(ev))}`,
    `DESCRIPTION:${icsEscape(details(ev))}`,
    'END:VEVENT',
  ]
}

/** Client-side .ics for one event or a whole season. Covers Apple/Outlook. */
export function downloadICS(events: PokeEvent[], filename: string): void {
  const dated = events.filter(hasDates)
  if (dated.length === 0) return
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//pokemon-majors-map//EN',
    'CALSCALE:GREGORIAN',
    ...dated.flatMap(icsEvent),
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
