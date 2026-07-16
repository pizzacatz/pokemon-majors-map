import type { Filters } from '../lib/storage'
import { ALL_FILTERS } from '../lib/storage'
import type { EventType, Format, Region } from '../types'
import { EVENT_TYPES, EVENT_TYPE_LABEL, FORMATS, REGIONS } from '../types'

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** True when any filter deviates from "everything on". */
export function isFiltered(f: Filters): boolean {
  return (
    f.types.length !== EVENT_TYPES.length ||
    f.formats.length !== FORMATS.length ||
    f.regions.length !== REGIONS.length
  )
}

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  onClose: () => void
}

/**
 * Filter panel behind the top-bar button (UX audit P0-1): the always-on chip
 * row cost 44px on every tab and read as noise. Type chips double as the pin
 * color legend (P1-7).
 */
export default function FilterPanel({ filters, onChange, onClose }: Props) {
  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <div className="filter-panel" role="dialog" aria-label="Filters">
        <div className="filter-head">
          <h2>Filters</h2>
          {isFiltered(filters) && (
            <button className="btn btn-small" onClick={() => onChange(ALL_FILTERS)}>
              Reset
            </button>
          )}
          <button className="btn btn-small btn-primary" onClick={onClose}>
            Done
          </button>
        </div>

        <h3 className="filter-group">Event type · pin colors</h3>
        <div className="filter-chips">
          {EVENT_TYPES.map((t: EventType) => (
            <button
              key={t}
              className={`chip chip-${t}${filters.types.includes(t) ? ' chip-on' : ''}`}
              onClick={() => onChange({ ...filters, types: toggle(filters.types, t) })}
            >
              <span className={`dot type-${t}`} /> {EVENT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <h3 className="filter-group">Game</h3>
        <div className="filter-chips">
          {FORMATS.map((f: Format) => (
            <button
              key={f}
              className={`chip${filters.formats.includes(f) ? ' chip-on' : ''}`}
              onClick={() => onChange({ ...filters, formats: toggle(filters.formats, f) })}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <h3 className="filter-group">Region</h3>
        <div className="filter-chips">
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
      </div>
    </>
  )
}
