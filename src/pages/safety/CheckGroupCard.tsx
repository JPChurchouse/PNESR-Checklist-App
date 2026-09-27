import type { CheckResult, ChecklistGroup } from '../../domain/safetyCheck'
import type { Photo as PhotoValue, Specialty } from '../../domain/types'
import { formatTime } from '../../lib/dates'
import { Photo, SpecialtyBadge } from '../../ui/components'

/** One vehicle's (or the track's) checks. Each is ticked once it has been checked and is OK. */
export function CheckGroupCard({
  group,
  results,
  photo,
  specialty,
  subtitle,
  onToggle,
  readOnly,
}: {
  group: ChecklistGroup
  results: Record<string, CheckResult>
  photo?: PhotoValue
  specialty?: Specialty
  subtitle?: string
  onToggle: (key: string) => void
  readOnly: boolean
}) {
  const done = group.rows.filter((r) => results[r.key]).length
  const complete = done === group.rows.length
  return (
    <section className={`card check-group ${complete ? 'complete' : ''}`}>
      <header className="check-group-head">
        {photo !== undefined && <Photo photo={photo} alt="" className="thumb large" />}
        <div className="info">
          <h3>
            {group.title} {specialty && <SpecialtyBadge specialty={specialty} />}
          </h3>
          {subtitle && <div className="meta">{subtitle}</div>}
        </div>
        <span className={`badge ${complete ? 'ok' : ''}`}>
          {done}/{group.rows.length}
        </span>
      </header>
      <ul className="check-list">
        {group.rows.map(({ key, item }) => {
          const result = results[key]
          return (
            <li key={key}>
              <button
                type="button"
                role="checkbox"
                aria-checked={Boolean(result)}
                className={`check-item ${result ? 'checked' : ''}`}
                disabled={readOnly}
                onClick={() => onToggle(key)}
              >
                <span className="tick" aria-hidden="true">
                  {result ? '✓' : ''}
                </span>
                <span className="check-label">
                  <span>{item.label}</span>
                  {item.help && <span className="meta">{item.help}</span>}
                </span>
                {result && <span className="meta check-time">{formatTime(result.checkedAt)}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
