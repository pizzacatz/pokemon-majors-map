import { useState } from 'react'
import type { Home, PokeEvent } from '../types'
import { hasDates, isPast, rangesOverlap } from '../lib/dates'
import { downloadICS } from '../lib/calendar'
import { buildPlanUrl, copyText } from '../lib/share'
import EventCard from './EventCard'

interface Props {
  events: PokeEvent[]
  home: Home | null
  isChecked: (id: string) => boolean
  onToggle: (id: string) => void
}

/** Same-weekend clashes among checked events (PRD §4.6). */
function conflictIds(events: PokeEvent[]): Set<string> {
  const ids = new Set<string>()
  const dated = events.filter(hasDates)
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

export default function ItineraryView({ events, home, isChecked, onToggle }: Props) {
  const [copied, setCopied] = useState(false)
  const plan = events
    .filter((ev) => isChecked(ev.id) && !isPast(ev))
    .sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'))
  const conflicts = conflictIds(plan)

  async function share() {
    const ok = await copyText(buildPlanUrl(plan.map((ev) => ev.id)))
    setCopied(ok)
    setTimeout(() => setCopied(false), 2500)
  }

  if (plan.length === 0) {
    return (
      <div className="page">
        <p className="empty">
          Nothing planned yet. Check events on the map or schedule to build your season.
        </p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="itin-actions">
        <button className="btn btn-primary" onClick={share}>
          {copied ? 'Link copied!' : '🔗 Share my season'}
        </button>
        <button className="btn" onClick={() => downloadICS(plan, 'pokemon-season.ics')}>
          ⬇ Season .ics
        </button>
      </div>
      {plan.map((ev) => (
        <div key={ev.id}>
          {conflicts.has(ev.id) && (
            <p className="conflict">⚠️ Overlaps another event in your plan</p>
          )}
          <EventCard ev={ev} home={home} checked={isChecked(ev.id)} onToggle={onToggle} />
        </div>
      ))}
    </div>
  )
}
