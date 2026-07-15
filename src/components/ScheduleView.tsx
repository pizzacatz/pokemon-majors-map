import type { Home, PokeEvent } from '../types'
import { hasDates, isPast, monthLabel } from '../lib/dates'
import EventCard from './EventCard'

interface Props {
  events: PokeEvent[]
  home: Home | null
  isChecked: (id: string) => boolean
  onToggle: (id: string) => void
}

/** Chronological alternative to the map — grouped by month (PRD §4.5). */
export default function ScheduleView({ events, home, isChecked, onToggle }: Props) {
  const dated = events.filter(hasDates).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const upcoming = dated.filter((ev) => !isPast(ev))
  const past = dated.filter(isPast).reverse()
  const tbd = events.filter((ev) => !hasDates(ev))

  const byMonth = new Map<string, PokeEvent[]>()
  for (const ev of upcoming) {
    const label = monthLabel(ev.startDate!)
    byMonth.set(label, [...(byMonth.get(label) ?? []), ev])
  }

  return (
    <div className="page">
      {upcoming.length === 0 && <p className="empty">No upcoming events match your filters.</p>}
      {[...byMonth.entries()].map(([label, list]) => (
        <section key={label}>
          <h2 className="month-head">{label}</h2>
          {list.map((ev) => (
            <EventCard key={ev.id} ev={ev} home={home} checked={isChecked(ev.id)} onToggle={onToggle} />
          ))}
        </section>
      ))}
      {tbd.length > 0 && (
        <section>
          <h2 className="month-head">Announced — dates TBD</h2>
          {tbd.map((ev) => (
            <EventCard key={ev.id} ev={ev} home={home} checked={isChecked(ev.id)} onToggle={onToggle} />
          ))}
        </section>
      )}
      {past.length > 0 && (
        <details className="past-section">
          <summary>Past events ({past.length})</summary>
          {past.map((ev) => (
            <EventCard key={ev.id} ev={ev} home={home} checked={isChecked(ev.id)} onToggle={onToggle} />
          ))}
        </details>
      )}
    </div>
  )
}
