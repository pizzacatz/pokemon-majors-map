import { useEffect, useRef, useState, type ReactNode } from 'react'

const FALLBACK_H = 300
const DISMISS_BELOW = 150

interface Props {
  onDismiss: () => void
  children: ReactNode
}

/**
 * Bottom sheet sized to its content (capped at ~55% of the map so a flown-to
 * pin stays visible). Cards are compact enough to show whole, so there is no
 * expanded state — drag the handle down to dismiss, and on the rare screen
 * where content doesn't fit, it scrolls internally.
 */
export default function EventSheet({ onDismiss, children }: Props) {
  const [dragH, setDragH] = useState<number | null>(null)
  // Height at which the whole card is visible (content + handle chrome).
  const [fitH, setFitH] = useState<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ y: number; h: number } | null>(null)

  const restH = () => {
    const wrap = sheetRef.current?.parentElement
    const cap = Math.round((wrap?.clientHeight ?? window.innerHeight) * 0.55)
    return Math.min(fitH ?? FALLBACK_H, cap)
  }

  useEffect(() => {
    const sheet = sheetRef.current
    const body = bodyRef.current
    // Measure the card itself — body.scrollHeight is floored at the body's
    // current height, which would stop the sheet from ever shrinking.
    const card = body?.firstElementChild as HTMLElement | null
    if (!sheet || !body || !card) return
    const chrome = sheet.offsetHeight - body.offsetHeight // handle + borders
    const pad = parseFloat(getComputedStyle(body).paddingBottom) || 0
    setFitH(card.offsetHeight + pad + chrome + 2)
  }, [children])

  // Move focus into the sheet on open so keyboard/screen-reader users land in
  // the card, and let Escape dismiss it (UX audit P2-17).
  useEffect(() => {
    sheetRef.current?.focus()
  }, [])

  function onPointerDown(e: React.PointerEvent) {
    start.current = { y: e.clientY, h: sheetRef.current?.offsetHeight ?? restH() }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return
    const dh = start.current.y - e.clientY
    // Only downward travel means anything — the sheet can't grow past fit.
    setDragH(Math.min(Math.max(start.current.h + dh, 60), restH()))
  }

  function onPointerUp() {
    if (!start.current) return
    const h = dragH ?? restH()
    start.current = null
    setDragH(null)
    if (h < Math.min(DISMISS_BELOW, restH() * 0.6)) onDismiss()
  }

  const height = dragH ?? restH()

  return (
    <div
      ref={sheetRef}
      className={`sheet${dragH !== null ? ' sheet-dragging' : ''}`}
      style={{ height }}
      role="dialog"
      aria-label="Event details"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss()
      }}
    >
      <div
        className="sheet-handle"
        role="button"
        aria-label="Drag down to dismiss event details"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet-pill" />
      </div>
      <div ref={bodyRef} className="sheet-body">
        {children}
      </div>
    </div>
  )
}
