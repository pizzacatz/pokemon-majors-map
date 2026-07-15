import type { Home, PokeEvent } from '../types'
import { EVENT_TYPE_LABEL } from '../types'
import { daysUntil, formatDate, formatDateRange, hasDates, isPast } from '../lib/dates'
import { travelInfo } from '../lib/travel'
import { googleCalendarUrl, downloadICS } from '../lib/calendar'
import { hotelsUrl } from '../lib/links'

interface Props {
  ev: PokeEvent
  home: Home | null
  checked: boolean
  onToggle: (id: string) => void
  onClose?: () => void
}

function Countdown({ ev }: { ev: PokeEvent }) {
  if (!hasDates(ev)) return <span className="badge badge-tbd">Dates TBD</span>
  if (isPast(ev)) return <span className="badge badge-past">Past</span>
  const left = daysUntil(ev.startDate)
  if (left === 0) return <span className="badge badge-now">Today!</span>
  if (left < 0) return <span className="badge badge-now">Happening now</span>
  return (
    <span className="badge badge-count">
      {left} day{left === 1 ? '' : 's'} left
    </span>
  )
}

function TravelLine({ ev, home }: { ev: PokeEvent; home: Home | null }) {
  if (!home) {
    return <p className="travel-hint">Set your home pin to see distance and booking dates.</p>
  }
  const t = travelInfo(ev, home)
  const miles = Math.round(t.distanceMi).toLocaleString()
  const mode = t.mode === 'drive' ? '🚗 drive' : t.international ? '✈️ fly (international)' : '✈️ fly'
  return (
    <div className="travel">
      <span>
        {miles} mi · {mode}
      </span>
      {t.bookByISO && !isPast(ev) && (
        <span className={`bookby bookby-${t.urgency}`}>
          {t.urgency === 'asap'
            ? `${t.bookLabel.replace(' by', '')} ASAP`
            : `${t.bookLabel} ${formatDate(t.bookByISO)}`}
        </span>
      )}
    </div>
  )
}

export default function EventCard({ ev, home, checked, onToggle, onClose }: Props) {
  const gcal = googleCalendarUrl(ev)
  const past = isPast(ev)
  return (
    <article className={`event-card${past ? ' event-card-past' : ''}`}>
      <header className="event-card-head">
        <span className={`badge type-${ev.type}`}>{EVENT_TYPE_LABEL[ev.type]}</span>
        <span className="formats">{ev.formats.map((f) => f.toUpperCase()).join(' · ')}</span>
        {onClose && (
          <button className="icon-btn close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
      </header>
      <h3 className="event-name">{ev.name}</h3>
      <p className="event-when">
        {hasDates(ev) ? formatDateRange(ev.startDate, ev.endDate) : 'Dates to be announced'}{' '}
        <Countdown ev={ev} />
      </p>
      <p className="event-where">
        📍 {[ev.venue, ev.city, ev.country].filter(Boolean).join(', ')}
      </p>
      <TravelLine ev={ev} home={home} />
      <div className="event-links">
        {ev.links.registration ? (
          <a href={ev.links.registration} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Register on RK9
          </a>
        ) : (
          <span className="btn btn-disabled" title="Registration link not posted yet">
            Registration TBA
          </span>
        )}
        {ev.links.official && (
          <a href={ev.links.official} target="_blank" rel="noopener noreferrer" className="btn">
            Official page
          </a>
        )}
        <a href={hotelsUrl(ev)} target="_blank" rel="noopener noreferrer" className="btn">
          Hotels nearby
        </a>
      </div>
      {!past && (
        <div className="event-links">
          {gcal && (
            <a href={gcal} target="_blank" rel="noopener noreferrer" className="btn btn-small">
              + Google Calendar
            </a>
          )}
          {hasDates(ev) && (
            <button className="btn btn-small" onClick={() => downloadICS([ev], `${ev.id}.ics`)}>
              ⬇ .ics
            </button>
          )}
        </div>
      )}
      {!past && (
        <label className="check-row">
          <input type="checkbox" checked={checked} onChange={() => onToggle(ev.id)} />
          In my season plan
        </label>
      )}
    </article>
  )
}
