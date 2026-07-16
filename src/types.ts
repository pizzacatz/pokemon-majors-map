export type EventType = 'regional' | 'special' | 'international' | 'worlds'
export type Format = 'tcg' | 'vgc' | 'go'
export type Region = 'NA' | 'EU' | 'LATAM' | 'OCE' | 'APAC'

export interface PokeEvent {
  id: string
  name: string
  type: EventType
  formats: Format[]
  /** ISO date, venue-local. null = announced but dates TBD */
  startDate: string | null
  endDate: string | null
  venue: string | null
  /** Street address from the official event detail page, when announced */
  address: string | null
  city: string
  country: string
  region: Region
  lat: number
  lng: number
  links: {
    official: string | null
    registration: string | null
  }
  /** Reserved for v2 registration-open tracking */
  registrationOpens: string | null
}

export interface EventsFile {
  meta: {
    generatedAt: string
    source: string
    schemaVersion: number
  }
  events: PokeEvent[]
}

export interface Home {
  lat: number
  lng: number
  /** ISO 3166-1 alpha-2, from one-time reverse geocode; null if lookup failed */
  country: string | null
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  regional: 'Regional',
  special: 'Special Event',
  international: 'International',
  worlds: 'Worlds',
}

export const REGIONS: Region[] = ['NA', 'EU', 'LATAM', 'OCE', 'APAC']
export const EVENT_TYPES: EventType[] = ['regional', 'special', 'international', 'worlds']
export const FORMATS: Format[] = ['tcg', 'vgc', 'go']
