/**
 * One shared font size per text role: every card scales its title/address
 * against the widest string of that role in the dataset, not its own text.
 * Otherwise the size changes card-to-card and switching events jitters.
 */

export type FitRole = 'title' | 'address'

const corpora: Record<FitRole, string[]> = { title: [], address: [] }
const cache = new Map<string, number>()
let canvas: HTMLCanvasElement | null = null

export function setFitCorpus(role: FitRole, texts: (string | null)[]): void {
  corpora[role] = texts.filter((t): t is string => !!t)
  cache.clear()
}

/** Widest corpus string of the role in px when rendered with the CSS font. */
export function widestText(role: FitRole, font: string): number {
  const key = `${role}|${font}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  canvas ??= document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = font
  const px = corpora[role].reduce((max, t) => Math.max(max, ctx.measureText(t).width), 0)
  cache.set(key, px)
  return px
}
