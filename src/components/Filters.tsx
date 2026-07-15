import type { Filters } from '../lib/storage'
import type { EventType, Format, Region } from '../types'
import { EVENT_TYPES, EVENT_TYPE_LABEL, FORMATS, REGIONS } from '../types'

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export default function FiltersBar({ filters, onChange }: Props) {
  return (
    <div className="filters" role="group" aria-label="Filters">
      {EVENT_TYPES.map((t: EventType) => (
        <button
          key={t}
          className={`chip chip-${t}${filters.types.includes(t) ? ' chip-on' : ''}`}
          onClick={() => onChange({ ...filters, types: toggle(filters.types, t) })}
        >
          {EVENT_TYPE_LABEL[t]}
        </button>
      ))}
      <span className="chip-sep" />
      {FORMATS.map((f: Format) => (
        <button
          key={f}
          className={`chip${filters.formats.includes(f) ? ' chip-on' : ''}`}
          onClick={() => onChange({ ...filters, formats: toggle(filters.formats, f) })}
        >
          {f.toUpperCase()}
        </button>
      ))}
      <span className="chip-sep" />
      {REGIONS.map((r: Region) => (
        <button
          key={r}
          className={`chip${filters.regions.includes(r) ? ' chip-on' : ''}`}
          onClick={() => onChange({ ...filters, regions: toggle(filters.regions, r) })}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
