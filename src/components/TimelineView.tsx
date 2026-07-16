import { useEffect, useMemo, useRef, useState } from 'react'
import type { PokeEvent } from '../types'
import { daysUntil, hasDates, isPast, parseISODate, formatDateRange } from '../lib/dates'

const PX_PER_DAY = 9
const RIGHT_PAD_DAYS = 10
const LANES = 4
const BASE_TICK = 14
const LANE_GAP = 6

/**
 * Bubbles hug their wrapped text (width: min-content), so a bubble is as
 * wide as its longest word. Estimated width for collision math.
 */
function bubbleWidth(label: string): number {
  const longest = Math.max(...label.split(' ').map((w) => w.length))
  return Math.min(76, Math.max(longest * 6, 30)) + 26
}

/** Estimated rendered bubble height: one line per word at min-content. */
function bubbleHeight(label: string): number {
  return Math.min(label.split(' ').length, 4) * 12 + 8
}

/**
 * Greedy interval packing: each item takes the lowest lane free at its x.
 * When every lane is busy, take the one that frees up soonest — dumping
 * overflow on lane 0 buried Recife and San Diego under dense clusters.
 */
function assignLanes(items: { x: number; width: number }[]): number[] {
  const laneEnds: number[] = []
  return items.map(({ x, width }) => {
    let lane = laneEnds.findIndex((end) => end <= x)
    if (lane === -1) {
      lane = laneEnds.length < LANES ? laneEnds.length : laneEnds.indexOf(Math.min(...laneEnds))
    }
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
  // Collapsed by default on phones (UX audit P0-1): the strip costs ~230px of
  // map. The user's choice persists; larger screens default open.
  const [open, setOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('pmm.tlOpen')
    if (saved !== null) return saved === '1'
    return window.innerWidth >= 700 && window.innerHeight >= 500
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  function toggleOpen() {
    setOpen((o) => {
      localStorage.setItem('pmm.tlOpen', o ? '0' : '1')
      return !o
    })
  }

  const dated = useMemo(
    () =>
      events
        .filter(hasDates)
        .filter((ev) => !isPast(ev))
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [events],
  )

  // When opened, bring the first upcoming event into view — the runway
  // between today and the first event otherwise renders as dead space.
  useEffect(() => {
    if (!open || !scrollRef.current || dated.length === 0) return
    const firstX = Math.max(daysUntil(dated[0].startDate), 0) * PX_PER_DAY
    scrollRef.current.scrollLeft = Math.max(0, firstX - 32)
  }, [open, dated])

  if (dated.length === 0) return null

  const next = dated[0]
  const nextIn = daysUntil(next.startDate)
  const lastDay = Math.max(...dated.map((ev) => daysUntil(ev.endDate)))
  const width = (lastDay + RIGHT_PAD_DAYS) * PX_PER_DAY
  const labels = dated.map(shortLabel)
  const lanes = assignLanes(
    dated.map((ev, i) => {
      const x = Math.max(daysUntil(ev.startDate), 0) * PX_PER_DAY
      return { x, width: bubbleWidth(labels[i]) }
    }),
  )

  // Dynamic vertical layout: each lane's tick height clears the tallest
  // bubble of the lanes below it, and the strip grows/shrinks to match.
  const laneMax: number[] = []
  lanes.forEach((lane, i) => {
    laneMax[lane] = Math.max(laneMax[lane] ?? 0, bubbleHeight(labels[i]))
  })
  const tickHeights: number[] = []
  let stack = BASE_TICK
  for (let l = 0; l < laneMax.length; l++) {
    tickHeights[l] = stack
    stack += (laneMax[l] ?? 0) + LANE_GAP
  }
  const canvasH = 26 + stack + 8 // axis zone + stacked lanes + headroom

  return (
    <section className="timeline" aria-label="Season timeline">
      <button className="tl-toggle" onClick={toggleOpen}>
        <span>{open ? '▾' : '▸'} Season timeline</span>
        {!open && (
          <span className="tl-next">
            Next: {shortLabel(next)} · {nextIn === 0 ? 'today' : `${nextIn}d`}
          </span>
        )}
      </button>
      {open && (
        <div className="tl-scroll" ref={scrollRef}>
          <div className="tl-canvas" style={{ width, height: canvasH }}>
            <div className="tl-today" style={{ height: canvasH - 12 }}>
              Today
            </div>
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
                  // Vertically lowest bubbles layer on top of taller lanes.
                  style={{ left: x, zIndex: 30 - lanes[i] }}
                >
                  <div className="tl-bubble">
                    <span
                      className="tl-name"
                      title={`${ev.name} — ${formatDateRange(ev.startDate, ev.endDate)}`}
                    >
                      {labels[i]}
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
                  <div className={`tl-tick type-${ev.type}`} style={{ height: tickHeights[lanes[i]] }} />
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
