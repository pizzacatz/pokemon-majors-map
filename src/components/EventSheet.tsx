import { useEffect, useRef, useState, type ReactNode } from 'react'

const PEEK = 300
const DISMISS_BELOW = 170

interface Props {
  onDismiss: () => void
  children: ReactNode
}

/**
 * Bottom sheet with peek/full snap points (UX audit P0-2). Drag the handle to
 * resize, fling/drag down to dismiss, tap the handle to toggle snaps. Content
 * scrolls internally when full; at peek it's clipped with a fade hint.
 */
export default function EventSheet({ onDismiss, children }: Props) {
  const [snap, setSnap] = useState<'peek' | 'full'>(() =>
    window.innerWidth >= 700 ? 'full' : 'peek',
  )
  const [dragH, setDragH] = useState<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null)

  const maxH = () => {
    const wrap = sheetRef.current?.parentElement
    return Math.max(360, (wrap?.clientHeight ?? window.innerHeight) - 56)
  }

  // On short (landscape) screens a 300px peek is basically full — cap it.
  const peekH = () => {
    const wrap = sheetRef.current?.parentElement
    return Math.min(PEEK, Math.round(((wrap?.clientHeight ?? window.innerHeight) * 0.55)))
  }

  // Move focus into the sheet on open so keyboard/screen-reader users land in
  // the card, and let Escape dismiss it (UX audit P2-17).
  useEffect(() => {
    sheetRef.current?.focus()
  }, [])

  function onPointerDown(e: React.PointerEvent) {
    start.current = { y: e.clientY, h: sheetRef.current?.offsetHeight ?? PEEK, moved: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return
    const dh = start.current.y - e.clientY
    if (Math.abs(dh) > 6) start.current.moved = true
    setDragH(Math.min(Math.max(start.current.h + dh, 90), maxH()))
  }

  function onPointerUp() {
    if (!start.current) return
    const { moved } = start.current
    const h = dragH ?? (snap === 'peek' ? peekH() : maxH())
    start.current = null
    setDragH(null)
    if (!moved) {
      setSnap((s) => (s === 'peek' ? 'full' : 'peek'))
      return
    }
    if (h < DISMISS_BELOW) {
      onDismiss()
      return
    }
    setSnap(h > (peekH() + maxH()) / 2 ? 'full' : 'peek')
  }

  const height = dragH ?? (snap === 'peek' ? peekH() : maxH())

  return (
    <div
      ref={sheetRef}
      className={`sheet sheet-${snap}${dragH !== null ? ' sheet-dragging' : ''}`}
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
        aria-label={snap === 'peek' ? 'Expand event details' : 'Collapse event details'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet-pill" />
      </div>
      <div className={`sheet-body${snap === 'peek' && dragH === null ? ' sheet-body-peek' : ''}`}>
        {children}
      </div>
    </div>
  )
}
