import type { PokeEvent } from '../types'
import { EVENT_TYPE_LABEL } from '../types'
import { formatDateRange, hasDates, isPast } from '../lib/dates'

interface Props {
  events: PokeEvent[]
  isChecked: (id: string) => boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}

/** Season checklist: uncheck an event and its pin grays out (PRD §4.4). */
export default function Dashboard({ events, isChecked, onToggle, onSelect }: Props) {
  const upcoming = events.filter((ev) => !isPast(ev))
  if (upcoming.length === 0) {
    return <p className="empty">No upcoming events match your filters.</p>
  }
  return (
    <ul className="dash-list">
      {upcoming.map((ev) => (
        <li key={ev.id} className={isChecked(ev.id) ? '' : 'dash-off'}>
          <input
            type="checkbox"
            checked={isChecked(ev.id)}
            onChange={() => onToggle(ev.id)}
            aria-label={`Include ${ev.name}`}
          />
          <button className="dash-name" onClick={() => onSelect(ev.id)}>
            <span className={`dot type-${ev.type}`} />
            <span>
              {ev.name}
              <small>
                {EVENT_TYPE_LABEL[ev.type]} ·{' '}
                {hasDates(ev) ? formatDateRange(ev.startDate, ev.endDate) : 'Dates TBD'}
              </small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
