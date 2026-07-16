import type { PokeEvent } from '../types'
import { addDays, hasDates } from './dates'

/**
 * Reserved Booking.com affiliate ID (PRD §4.8). Empty = plain links.
 * Filling this in is the entire v2 monetization change.
 */
export const BOOKING_AFFILIATE_ID = ''

/**
 * Hotel deep link: a Booking.com search pre-filled with the venue area and the
 * event's check-in/check-out (day before → day after). No hotel data fetched.
 */
export function hotelsUrl(ev: PokeEvent): string {
  const params = new URLSearchParams({
    ss: [ev.venue, ev.city].filter(Boolean).join(', '),
  })
  if (hasDates(ev)) {
    params.set('checkin', addDays(ev.startDate, -1))
    params.set('checkout', addDays(ev.endDate, 1))
  }
  params.set('group_adults', '1')
  if (BOOKING_AFFILIATE_ID) params.set('aid', BOOKING_AFFILIATE_ID)
  return `https://www.booking.com/searchresults.html?${params}`
}

/**
 * Flight deep link: Google Flights natural-language query with destination
 * and dates (day before → day after). Google infers the origin from the
 * user, so no home data leaves the app.
 */
export function flightsUrl(ev: PokeEvent): string {
  const dates = hasDates(ev)
    ? ` on ${addDays(ev.startDate, -1)} through ${addDays(ev.endDate, 1)}`
    : ''
  const q = `Flights to ${ev.city}, ${ev.country}${dates}`
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`
}
