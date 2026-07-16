/**
 * One shared font size for every event address: each card scales its address
 * against the widest address in the dataset, not its own text. Otherwise the
 * size changes card-to-card and switching events jitters.
 */

let corpus: string[] = []
let cache: { font: string; px: number } | null = null
let canvas: HTMLCanvasElement | null = null

export function setAddressCorpus(addrs: (string | null)[]): void {
  corpus = addrs.filter((a): a is string => !!a)
  cache = null
}

/** Widest corpus address in px when rendered with the given CSS font. */
export function widestAddress(font: string): number {
  if (cache && cache.font === font) return cache.px
  canvas ??= document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = font
  const px = corpus.reduce((max, a) => Math.max(max, ctx.measureText(a).width), 0)
  cache = { font, px }
  return px
}
