import { useEffect, useMemo, useRef, useState } from 'react'
import type { PokeEvent } from '../types'
import { daysUntil, hasDates, isPast, parseISODate, formatDateRange } from '../lib/dates'
import { bubbleLabel, shortLabel } from '../lib/labels'

const PX_PER_DAY = 9
const RIGHT_PAD_DAYS = 10
const LANES = 4
const BASE_TICK = 14
const LANE_GAP = 6
// Gap compression: full resolution up to a week between events, then empty
// stretches shrink to a trickle — a 40-day dead gap costs ~88px, not 360px.
const GAP_CAP_DAYS = 7
const SLOW_PX_PER_DAY = 0.75
const MIN_MONTH_GAP_PX = 44

/**
 * Piecewise-linear day→x scale anchored on event days. Within GAP_CAP_DAYS of
 * the previous anchor, days get PX_PER_DAY; beyond it they get SLOW_PX_PER_DAY,
 * so the strip spends its width on events instead of empty calendar.
 */
function buildScale(eventDays: number[]): (day: number) => number {
  const anchors = [...new Set([0, ...eventDays])].sort((a, b) => a - b)
  const seg = (gap: number) =>
    gap <= GAP_CAP_DAYS
      ? gap * PX_PER_DAY
      : GAP_CAP_DAYS * PX_PER_DAY + (gap - GAP_CAP_DAYS) * SLOW_PX_PER_DAY
  const xs = [0]
  for (let i = 1; i < anchors.length; i++) {
    xs.push(xs[i - 1] + seg(anchors[i] - anchors[i - 1]))
  }
  return (day: number) => {
    if (day <= 0) return 0
    let i = anchors.length - 1
    while (anchors[i] > day) i--
    return xs[i] + seg(day - anchors[i])
  }
}

/**
 * Bubbles hug their wrapped text (width: min-content), so a bubble is as
 * wide as its longest word. Estimated width for collision math.
 */
function bubbleWidth(label: string): number {
  const longest = Math.max(...label.split(' ').map((w) => w.length))
  return Math.min(96, Math.max(longest * 6, 30)) + 26
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
  /** Open the event card without moving the map (bubble-name tap). */
  onOpen: (ev: PokeEvent) => void
}

/** Month boundary marks from today through the last event. */
function monthMarks(lastDay: number): { day: number; label: string }[] {
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
      day,
      label: cursor.toLocaleDateString('en-US', {
        month: 'short',
        ...(cursor.getMonth() === 0 ? { year: 'numeric' } : {}),
      }),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return marks
}

/**
 * Horizontal season timeline (PRD §4.12): today anchored at the far left,
 * scale runs to the farthest announced event. Ticks are type-colored; each
 * bubble's 📍 flies the map to the venue.
 */
export default function TimelineView({ events, isChecked, onFly, onOpen }: Props) {
  // Collapsed by default on phones (UX audit P0-1): the strip costs ~230px of
  // map. The user's choice persists; larger screens default open.
  const [open, setOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('pmm.tlOpen')
    if (saved !== null) return saved === '1'
    return window.innerWidth >= 700 && window.innerHeight >= 500
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  // Desktop fits the whole season in view (no horizontal scroll): track the
  // strip's width and scale the day→x mapping to fill it exactly.
  const [availW, setAvailW] = useState<number | null>(null)

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

  const toX = useMemo(
    () =>
      buildScale(
        dated.flatMap((ev) => [
          Math.max(daysUntil(ev.startDate), 0),
          Math.max(daysUntil(ev.endDate), 0),
        ]),
      ),
    [dated],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!open || !el) return
    const ro = new ResizeObserver(() => setAvailW(el.clientWidth))
    ro.observe(el)
    setAvailW(el.clientWidth)
    return () => ro.disconnect()
    // dated.length: the strip mounts only once events load — re-attach then.
  }, [open, dated.length])

  // When opened, bring the first upcoming event into view — the runway
  // between today and the first event otherwise renders as dead space.
  useEffect(() => {
    if (!open || !scrollRef.current || dated.length === 0) return
    const firstX = toX(Math.max(daysUntil(dated[0].startDate), 0))
    scrollRef.current.scrollLeft = Math.max(0, firstX - 32)
  }, [open, dated, toX])

  if (dated.length === 0) return null

  // The strip shows the next event in YOUR season plan — if you're skipping
  // Worlds, its countdown isn't the one you care about. Falls back to the
  // next upcoming event when nothing is checked.
  const next = dated.find((ev) => isChecked(ev.id)) ?? dated[0]
  const nextIn = daysUntil(next.startDate)
  const lastDay = Math.max(...dated.map((ev) => daysUntil(ev.endDate)))
  const naturalW = toX(lastDay + RIGHT_PAD_DAYS)
  // Scale the season to the strip's exact width: shrink-to-fit on desktop
  // (≥700px), and expand-to-fill everywhere when few events leave the strip
  // narrower than the screen. Phones keep scrolling for a full season.
  const target = availW !== null ? Math.max(availW - 24, 100) : null // 24 = margins
  const k = target !== null && (availW! >= 700 || naturalW < target) ? target / naturalW : 1
  const dayX = (day: number) => toX(day) * k
  const width = naturalW * k
  const labels = dated.map(bubbleLabel)
  const lanes = assignLanes(
    dated.map((ev, i) => {
      const x = dayX(Math.max(daysUntil(ev.startDate), 0))
      return { x, width: bubbleWidth(labels[i]) }
    }),
  )

  // Date labels share one row: when scaling packs events tightly, show a
  // date only if it clears the previous one (same-day events share anyway).
  const dateShow: boolean[] = []
  {
    let lastX = -Infinity
    dated.forEach((ev, i) => {
      const x = dayX(Math.max(daysUntil(ev.startDate), 0))
      dateShow[i] = x - lastX >= 30
      if (dateShow[i]) lastX = x
    })
  }

  // Compressed stretches squeeze month boundaries together — keep only the
  // labels with room to breathe (they render on their own row below the dates).
  const months: { x: number; label: string }[] = []
  for (const m of monthMarks(lastDay)) {
    const x = dayX(m.day)
    if (x - (months[months.length - 1]?.x ?? -Infinity) >= MIN_MONTH_GAP_PX) {
      months.push({ x, label: m.label })
    }
  }

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
  const canvasH = 42 + stack + 8 // axis zone (dates + months rows) + lanes + headroom

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
            {months.map((m) => (
              <div key={m.x} className="tl-month" style={{ left: m.x }}>
                {m.label}
              </div>
            ))}
            {dated.map((ev, i) => {
              const x = dayX(Math.max(daysUntil(ev.startDate), 0))
              return (
                <div
                  key={ev.id}
                  className={`tl-item${isChecked(ev.id) ? '' : ' tl-off'}`}
                  // Vertically lowest bubbles layer on top of taller lanes.
                  style={{ left: x, zIndex: 30 - lanes[i] }}
                >
                  <div className="tl-bubble">
                    <button
                      className="tl-name"
                      onClick={() => onOpen(ev)}
                      title={`${ev.name} — ${formatDateRange(ev.startDate, ev.endDate)}`}
                    >
                      {labels[i]}
                    </button>
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
                  {dateShow[i] && (
                    <div className="tl-date">
                      {parseISODate(ev.startDate).toLocaleDateString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
