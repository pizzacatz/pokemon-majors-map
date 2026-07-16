import { useState } from 'react'
import type { Home, PokeEvent } from '../types'
import { daysUntil, formatDateRange, hasDates, isPast, monthLabel } from '../lib/dates'
import { shortLabel } from '../lib/labels'
import EventCard from './EventCard'

interface Props {
  events: PokeEvent[]
  home: Home | null
  isChecked: (id: string) => boolean
  onToggle: (id: string) => void
  onFly: (ev: PokeEvent) => void
}

/**
 * Chronological alternative to the map (PRD §4.5). Compact rows with sticky
 * month headers (UX audit P1-6) — 30+ full cards was 10,000px of scrolling.
 * Tapping a row expands it into the full card.
 */
export default function ScheduleView({ events, home, isChecked, onToggle, onFly }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const dated = events.filter(hasDates).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const upcoming = dated.filter((ev) => !isPast(ev))
  const past = dated.filter(isPast).reverse()
  const tbd = events.filter((ev) => !hasDates(ev))

  const byMonth = new Map<string, PokeEvent[]>()
  for (const ev of upcoming) {
    const label = monthLabel(ev.startDate!)
    byMonth.set(label, [...(byMonth.get(label) ?? []), ev])
  }

  function row(ev: PokeEvent) {
    if (expandedId === ev.id) {
      return (
        <EventCard
          key={ev.id}
          ev={ev}
          home={home}
          checked={isChecked(ev.id)}
          onToggle={onToggle}
          onFly={onFly}
          onClose={() => setExpandedId(null)}
          onTitleTap={() => setExpandedId(null)}
        />
      )
    }
    const left = hasDates(ev) && !isPast(ev) ? daysUntil(ev.startDate) : null
    return (
      <button
        key={ev.id}
        className={`sched-row${isChecked(ev.id) ? '' : ' sched-off'}`}
        onClick={() => setExpandedId(ev.id)}
      >
        <span className={`dot type-${ev.type}`} />
        <span className="sched-title">{shortLabel(ev)}</span>
        <span className="sched-when">
          {hasDates(ev) ? formatDateRange(ev.startDate, ev.endDate) : 'Dates TBD'}
          {left !== null && <b> · {left}d</b>}
        </span>
      </button>
    )
  }

  return (
    <div className="page">
      {upcoming.length === 0 && <p className="empty">No upcoming events match your filters.</p>}
      {[...byMonth.entries()].map(([label, list]) => (
        <section key={label}>
          <h2 className="month-head">{label}</h2>
          {list.map(row)}
        </section>
      ))}
      {tbd.length > 0 && (
        <section>
          <h2 className="month-head">Announced — dates TBD</h2>
          {tbd.map(row)}
        </section>
      )}
      {past.length > 0 && (
        <details className="past-section">
          <summary>Past events ({past.length})</summary>
          {past.map(row)}
        </details>
      )}
    </div>
  )
}
