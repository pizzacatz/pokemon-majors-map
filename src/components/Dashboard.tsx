import type { PokeEvent } from '../types'
import { daysUntil, formatDateRange, hasDates } from '../lib/dates'
import { shortLabel } from '../lib/labels'
import { planEvents } from '../lib/plan'

interface Props {
  events: PokeEvent[]
  isChecked: (id: string) => boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  /** Hovering/focusing a row highlights the event's map pin. */
  onHover: (id: string | null) => void
  conflicts: Set<string>
}

/**
 * Map-side plan strip (UX consolidation): just the checked events, compact,
 * for glancing at your season while looking at the map. Unchecking removes
 * the row (and grays the pin); building the plan happens on pins and the
 * Schedule tab.
 */
export default function Dashboard({ events, isChecked, onToggle, onSelect, onHover, conflicts }: Props) {
  const plan = planEvents(events, isChecked)
  if (plan.length === 0) {
    return (
      <p className="empty">
        Nothing planned yet. Check events on the map or the Schedule tab to build your season.
      </p>
    )
  }
  return (
    <ul className="dash-list">
      {plan.map((ev) => {
        const left = hasDates(ev) ? daysUntil(ev.startDate) : null
        return (
          <li
            key={ev.id}
            onMouseEnter={() => onHover(ev.id)}
            onMouseLeave={() => onHover(null)}
            onFocusCapture={() => onHover(ev.id)}
            onBlurCapture={() => onHover(null)}
          >
            <input
              type="checkbox"
              checked
              onChange={() => onToggle(ev.id)}
              aria-label={`Remove ${ev.name} from my plan`}
            />
            <button className="dash-name" onClick={() => onSelect(ev.id)}>
              <span className={`dot type-${ev.type}`} />
              <span className="dash-label">{shortLabel(ev)}</span>
              {conflicts.has(ev.id) && (
                <span className="conflict-mark" title="Overlaps another event in your plan">
                  ⚠
                </span>
              )}
              <span className="dash-when">
                {hasDates(ev) ? formatDateRange(ev.startDate, ev.endDate) : 'Dates TBD'}
                {left !== null && left >= 0 && <b> · {left}d</b>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
