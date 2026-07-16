import { useMemo, useState } from 'react'
import type { PokeEvent } from '../types'
import { daysUntil, hasDates, isPast, parseISODate, formatDateRange } from '../lib/dates'

const PX_PER_DAY = 9
const RIGHT_PAD_DAYS = 10
const LANES = 3
const LANE_STEP = 38 // ≥ bubble height so stacked lanes never collide
const BASE_TICK = 16

/** Estimated bubble width for collision math (label chars + fly button). */
function bubbleWidth(label: string): number {
  return Math.min(96, label.length * 6.4) + 34
}

/**
 * Greedy interval packing: each item takes the lowest lane free at its x.
 * Same-day events get separate lanes instead of overlapping bubbles that
 * hide each other's fly buttons.
 */
function assignLanes(items: { x: number; width: number }[]): number[] {
  const laneEnds: number[] = []
  return items.map(({ x, width }) => {
    let lane = laneEnds.findIndex((end) => end <= x)
    if (lane === -1) lane = laneEnds.length < LANES ? laneEnds.length : 0
    laneEnds[lane] = x + width
    return lane
  })
}

interface Props {
  events: PokeEvent[]
  isChecked: (id: string) => boolean
  onFly: (ev: PokeEvent) => void
}

/** Month boundary marks from today through the last event. */
function monthMarks(lastDay: number): { x: number; label: string }[] {
  const marks = []
  const cursor = new Date()
  cursor.setDate(1)
  cursor.setMonth(cursor.getMonth() + 1) // first boundary after today
  for (;;) {
    const day = daysUntil(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`,
    )
    if (day > lastDay + RIGHT_PAD_DAYS) break
    marks.push({
      x: day * PX_PER_DAY,
      label: cursor.toLocaleDateString('en-US', {
        month: 'short',
        ...(cursor.getMonth() === 0 ? { year: 'numeric' } : {}),
      }),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return marks
}

/** Compact bubble label: "Worlds", "NAIC", "LAIC", "EUIC", "<City> Regional/Special". */
function shortLabel(ev: PokeEvent): string {
  if (ev.type === 'worlds') return 'Worlds'
  if (ev.type === 'international') {
    const n = ev.name.toLowerCase()
    if (n.includes('north america')) return 'NAIC'
    if (n.includes('latin america')) return 'LAIC'
    if (n.includes('europe')) return 'EUIC'
    if (n.includes('oceania')) return 'OCIC'
    return 'IC'
  }
  return `${ev.city} ${ev.type === 'special' ? 'Special' : 'Regional'}`
}

/**
 * Horizontal season timeline (PRD §4.12): today anchored at the far left,
 * scale runs to the farthest announced event. Ticks are type-colored; each
 * bubble's 📍 flies the map to the venue.
 */
export default function TimelineView({ events, isChecked, onFly }: Props) {
  const [open, setOpen] = useState(true)

  const dated = useMemo(
    () =>
      events
        .filter(hasDates)
        .filter((ev) => !isPast(ev))
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [events],
  )

  if (dated.length === 0) return null

  const lastDay = Math.max(...dated.map((ev) => daysUntil(ev.endDate)))
  const width = (lastDay + RIGHT_PAD_DAYS) * PX_PER_DAY
  const lanes = assignLanes(
    dated.map((ev) => {
      const x = Math.max(daysUntil(ev.startDate), 0) * PX_PER_DAY
      return { x, width: bubbleWidth(shortLabel(ev)) }
    }),
  )

  return (
    <section className="timeline" aria-label="Season timeline">
      <button className="tl-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} Season timeline
      </button>
      {open && (
        <div className="tl-scroll">
          <div className="tl-canvas" style={{ width }}>
            <div className="tl-today">Today</div>
            {monthMarks(lastDay).map((m) => (
              <div key={m.x} className="tl-month" style={{ left: m.x }}>
                {m.label}
              </div>
            ))}
            {dated.map((ev, i) => {
              const x = Math.max(daysUntil(ev.startDate), 0) * PX_PER_DAY
              return (
                <div
                  key={ev.id}
                  className={`tl-item${isChecked(ev.id) ? '' : ' tl-off'}`}
                  style={{ left: x }}
                >
                  <div className="tl-bubble">
                    <span
                      className="tl-name"
                      title={`${ev.name} — ${formatDateRange(ev.startDate, ev.endDate)}`}
                    >
                      {shortLabel(ev)}
                    </span>
                    <button
                      className="tl-fly"
                      onClick={() => onFly(ev)}
                      aria-label={`Fly to ${ev.city}`}
                      title={`Fly to ${ev.city}`}
                    >
                      📍
                    </button>
                  </div>
                  <div className={`tl-tick type-${ev.type}`} style={{ height: BASE_TICK + lanes[i] * LANE_STEP }} />
                  <div className="tl-date">
                    {parseISODate(ev.startDate).toLocaleDateString('en-US', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
