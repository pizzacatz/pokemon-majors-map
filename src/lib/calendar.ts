import type { PokeEvent } from '../types'
import { addDays, hasDates } from './dates'

function compact(iso: string): string {
  return iso.replaceAll('-', '')
}

function location(ev: PokeEvent): string {
  return [ev.venue, ev.address ?? `${ev.city}, ${ev.country}`].filter(Boolean).join(', ')
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

/* ---- registration-opens reminders (timed, from registrationOpens) ---- */

const RK9_LISTING = 'https://rk9.gg/events/pokemon'
const REG_REMINDER_MINUTES = 30

/** "20260805T230000Z" — registrationOpens carries an offset, so UTC is exact. */
function compactUTC(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z'
}

function regSummary(ev: PokeEvent): string {
  return `Registration opens — ${ev.name}`
}

function regDetails(ev: PokeEvent): string {
  return `Register: ${ev.links.registration ?? RK9_LISTING}\nVia Pokémon Majors Map`
}

/** Timed Google Calendar entry at the reg-open moment (alerts follow the user's defaults). */
export function regOpensGoogleUrl(ev: PokeEvent): string | null {
  if (!ev.registrationOpens) return null
  const start = compactUTC(ev.registrationOpens)
  const end = compactUTC(new Date(new Date(ev.registrationOpens).getTime() + REG_REMINDER_MINUTES * 60_000).toISOString())
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: regSummary(ev),
    dates: `${start}/${end}`,
    details: regDetails(ev),
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

/** Timed .ics with alarms at T-1h and at the moment itself. Covers Apple/Outlook. */
export function downloadRegOpensICS(ev: PokeEvent): void {
  if (!ev.registrationOpens) return
  const startMs = new Date(ev.registrationOpens).getTime()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//pokemon-majors-map//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.id}-reg-opens@pokemon-majors-map`,
    `DTSTART:${compactUTC(ev.registrationOpens)}`,
    `DTEND:${compactUTC(new Date(startMs + REG_REMINDER_MINUTES * 60_000).toISOString())}`,
    `SUMMARY:${icsEscape(regSummary(ev))}`,
    `DESCRIPTION:${icsEscape(regDetails(ev))}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(regSummary(ev))}`,
    'TRIGGER:-PT1H',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(regSummary(ev))}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ev.id}-reg-opens.ics`
  a.click()
  URL.revokeObjectURL(url)
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
