import { useLayoutEffect, useRef, useState } from 'react'
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
  /** Fly the map to this event (PRD §4.12); button hidden when absent */
  onFly?: (ev: PokeEvent) => void
  /** When set, tapping the header/title collapses the card (schedule rows). */
  onTitleTap?: () => void
}

/** One line always: long text shrinks to fit the card width. */
function FitLine({
  text,
  className,
  as: Tag = 'p',
  minPx = 9,
}: {
  text: string
  className: string
  as?: 'p' | 'h3'
  minPx?: number
}) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.fontSize = '' // reset to the CSS base before measuring
    const scale = el.clientWidth / el.scrollWidth
    if (scale < 1) {
      const base = parseFloat(getComputedStyle(el).fontSize)
      el.style.fontSize = `${Math.max(base * scale - 0.2, minPx)}px`
    }
  }, [text])
  return (
    <Tag className={className} ref={ref as React.RefObject<never>} title={text}>
      {text}
    </Tag>
  )
}

/** "Add to calendar ▾" split: one button, pick the app in a small menu. */
function CalendarMenu({ ev }: { ev: PokeEvent }) {
  const [open, setOpen] = useState(false)
  const gcal = googleCalendarUrl(ev)
  return (
    <span className="cal-menu">
      <button
        className="btn btn-mini"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Add to calendar ▾
      </button>
      {open && (
        <span className="cal-options" role="menu">
          {gcal && (
            <a
              role="menuitem"
              href={gcal}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              Google Calendar
            </a>
          )}
          <button
            role="menuitem"
            onClick={() => {
              downloadICS([ev], `${ev.id}.ics`)
              setOpen(false)
            }}
          >
            Apple / Outlook (.ics)
          </button>
        </span>
      )}
    </span>
  )
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
  return (
    <div className="travel">
      <span>{miles} mi from home</span>
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

export default function EventCard({ ev, home, checked, onToggle, onClose, onFly, onTitleTap }: Props) {
  const past = isPast(ev)
  return (
    <article className={`event-card${past ? ' event-card-past' : ''}`}>
      <div
        className={onTitleTap ? 'card-titlebar' : undefined}
        onClick={onTitleTap}
        {...(onTitleTap && {
          role: 'button',
          tabIndex: 0,
          'aria-label': 'Collapse event details',
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') onTitleTap()
          },
        })}
      >
        <header className="event-card-head">
          <span className={`badge type-${ev.type}`}>{EVENT_TYPE_LABEL[ev.type]}</span>
          {onClose && (
            <button
              className="icon-btn close-btn"
              onClick={(e) => {
                e.stopPropagation() // don't double-fire through the title bar
                onClose()
              }}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </header>
        <FitLine as="h3" className="event-name" text={ev.name} minPx={10.5} />
      </div>
      <p className="event-when">
        {hasDates(ev) ? formatDateRange(ev.startDate, ev.endDate) : 'Dates to be announced'}{' '}
        <Countdown ev={ev} />
        {!past && hasDates(ev) && <CalendarMenu ev={ev} />}
      </p>
      {/* With an address present, city/country are redundant on this line. */}
      <p className="event-where">
        {onFly ? (
          <button
            className="pin-btn"
            onClick={() => onFly(ev)}
            title={`Show ${ev.city} on the map`}
            aria-label={`Show ${ev.city} on the map`}
          >
            📍
          </button>
        ) : (
          <>📍 </>
        )}
        {ev.address
          ? (ev.venue ?? `${ev.city}, ${ev.country}`)
          : [ev.venue, ev.city, ev.country].filter(Boolean).join(', ')}
      </p>
      {ev.address && <FitLine className="event-addr" text={ev.address} />}
      <TravelLine ev={ev} home={home} />
      <div className="event-links">
        {ev.links.registration ? (
          <a href={ev.links.registration} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Register on RK9
          </a>
        ) : (
          !past && (
            <span
              className="btn btn-disabled"
              aria-disabled="true"
              title="Registration isn't open yet — the RK9 link typically appears 2–3 months before the event."
            >
              Register on RK9
            </span>
          )
        )}
        {ev.links.official && (
          <a href={ev.links.official} target="_blank" rel="noopener noreferrer" className="btn">
            Event page
          </a>
        )}
        <a href={hotelsUrl(ev)} target="_blank" rel="noopener noreferrer" className="btn">
          Hotels
        </a>
      </div>
      {!past && (
        <label className="check-row">
          <input type="checkbox" checked={checked} onChange={() => onToggle(ev.id)} />
          In my season plan
        </label>
      )}
    </article>
  )
}
