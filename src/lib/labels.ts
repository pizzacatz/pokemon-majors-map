import type { PokeEvent } from '../types'

/**
 * Compact display name: "Worlds", "NAIC", "LAIC", "EUIC",
 * "<City> Regional/Special". Cards use it as the title (the official name
 * becomes the subtitle); the timeline uses the bubble variant below.
 */
export function shortLabel(ev: PokeEvent): string {
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
 * Timeline-bubble variant: non-breaking spaces keep multi-word cities
 * ("Rio de Janeiro") on one line — min-content bubbles then wrap only
 * before the Regional/Special suffix.
 */
export function bubbleLabel(ev: PokeEvent): string {
  if (ev.type === 'worlds' || ev.type === 'international') return shortLabel(ev)
  return `${ev.city.replace(/ /g, '\u00A0')} ${ev.type === 'special' ? 'Special' : 'Regional'}`
}
