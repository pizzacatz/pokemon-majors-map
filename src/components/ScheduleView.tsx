import { useState } from 'react'
import type { Home, PokeEvent } from '../types'
import { daysUntil, formatDateRangeShort, hasDates, isPast, monthLabel } from '../lib/dates'
import { shortLabel } from '../lib/labels'
import { planEvents } from '../lib/plan'
import { downloadICS } from '../lib/calendar'
import { buildPlanUrl, sharePlanUrl } from '../lib/share'
import EventCard from './EventCard'

export type SchedView = 'all' | 'plan'

interface Props {
  events: PokeEvent[]
  home: Home | null
  isChecked: (id: string) => boolean
  onToggle: (id: string) => void
  onFly: (ev: PokeEvent) => void
  view: SchedView
  onViewChange: (v: SchedView) => void
  conflicts: Set<string>
}

/**
 * The season, one list, two views (UX consolidation): "All events" is the
 * chronological calendar; "My plan" filters to checked events and carries the
 * plan actions (share, season .ics). Compact rows with sticky month headers;
 * the checkbox lives on the row; tapping a row expands the full card.
 */
export default function ScheduleView({
  events,
  home,
  isChecked,
  onToggle,
  onFly,
  view,
  onViewChange,
  conflicts,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [query, setQuery] = useState('')

  const plan = planEvents(events, isChecked)
  const q = query.trim().toLowerCase()
  const matches = (ev: PokeEvent) =>
    q === '' ||
    ev.name.toLowerCase().includes(q) ||
    ev.city.toLowerCase().includes(q) ||
    (ev.venue ?? '').toLowerCase().includes(q) ||
    ev.country.toLowerCase().includes(q)
  const shown = (view === 'plan' ? events.filter((ev) => isChecked(ev.id) && !isPast(ev)) : events).filter(
    matches,
  )
  const dated = shown.filter(hasDates).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const upcoming = dated.filter((ev) => !isPast(ev))
  const past = dated.filter(isPast).reverse()
  const tbd = shown.filter((ev) => !hasDates(ev))

  const byMonth = new Map<string, PokeEvent[]>()
  for (const ev of upcoming) {
    const label = monthLabel(ev.startDate!)
    byMonth.set(label, [...(byMonth.get(label) ?? []), ev])
  }

  async function share() {
    const result = await sharePlanUrl(buildPlanUrl(plan.map((ev) => ev.id)))
    setCopied(result === 'copied')
    setTimeout(() => setCopied(false), 2500)
  }

  function row(ev: PokeEvent) {
    if (expandedId === ev.id) {
      return (
        <EventCard
          key={ev.id}
          ev={ev}
          home={home}
          checked={isChecked(ev.id)}
          conflict={conflicts.has(ev.id)}
          onToggle={onToggle}
          onFly={onFly}
          onClose={() => setExpandedId(null)}
          onTitleTap={() => setExpandedId(null)}
        />
      )
    }
    const left = hasDates(ev) && !isPast(ev) ? daysUntil(ev.startDate) : null
    return (
      <div key={ev.id} className="sched-row">
        {!isPast(ev) && (
          <input
            type="checkbox"
            checked={isChecked(ev.id)}
            onChange={() => onToggle(ev.id)}
            aria-label={`Include ${ev.name} in my plan`}
          />
        )}
        <button className="sched-main" onClick={() => setExpandedId(ev.id)}>
          <span className={`dot type-${ev.type}`} aria-hidden="true" />
          <span className="sched-title">{shortLabel(ev)}</span>
          {conflicts.has(ev.id) && (
            <span className="conflict-mark" title="Overlaps another event in your plan">
              ⚠
            </span>
          )}
          <span className="sched-when">
            {/* month header carries the year; rows keep it short */}
            {hasDates(ev) ? formatDateRangeShort(ev.startDate, ev.endDate) : 'Dates TBD'}
            {left !== null && <b> · {left}d</b>}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="seg-row">
        <div className="seg" role="tablist" aria-label="Schedule view">
          <button
            role="tab"
            aria-selected={view === 'all'}
            className={view === 'all' ? 'seg-on' : ''}
            onClick={() => onViewChange('all')}
          >
            All events
          </button>
          <button
            role="tab"
            aria-selected={view === 'plan'}
            className={view === 'plan' ? 'seg-on' : ''}
            onClick={() => onViewChange('plan')}
          >
            My plan · {plan.length}
          </button>
        </div>
        {view === 'plan' && plan.length > 0 && (
          <div className="plan-actions">
            <button className="btn btn-small btn-primary" onClick={share}>
              <span role="status">{copied ? 'Link copied!' : '🔗 Share'}</span>
            </button>
            <button className="btn btn-small" onClick={() => downloadICS(plan, 'pokemon-season.ics')}>
              ⬇ .ics
            </button>
          </div>
        )}
      </div>
      <input
        type="search"
        className="sched-search"
        placeholder="Search city, venue, event…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search events"
      />
      {upcoming.length === 0 && tbd.length === 0 && (
        <p className="empty">
          {q !== ''
            ? `Nothing matches “${query.trim()}”.`
            : view === 'plan'
              ? 'Nothing planned yet. Check events here or on the map to build your season.'
              : 'No upcoming events match your filters.'}
        </p>
      )}
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
      {view === 'all' && past.length > 0 && (
        <details className="past-section">
          <summary>Past events ({past.length})</summary>
          {past.map(row)}
        </details>
      )}
    </div>
  )
}
