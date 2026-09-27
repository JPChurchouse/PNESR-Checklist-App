import type { CheckResult, ChecklistGroup } from '../../domain/safetyCheck'
import type { Photo as PhotoValue, Specialty } from '../../domain/types'
import { Photo, SpecialtyBadge } from '../../ui/components'

const EMPTY: CheckResult = { status: null, note: '' }

/** One vehicle's (or the track's) checks, each with Pass / Fail and a note when failed. */
export function CheckGroupCard({
  group,
  results,
  photo,
  specialty,
  subtitle,
  onChange,
  readOnly,
}: {
  group: ChecklistGroup
  results: Record<string, CheckResult>
  photo?: PhotoValue
  specialty?: Specialty
  subtitle?: string
  onChange: (key: string, patch: Partial<CheckResult>) => void
  readOnly: boolean
}) {
  const done = group.rows.filter((r) => results[r.key]?.status).length
  const failed = group.rows.some((r) => results[r.key]?.status === 'fail')
  return (
    <section className={`card check-group ${failed ? 'has-fail' : done === group.rows.length ? 'complete' : ''}`}>
      <header className="check-group-head">
        {photo !== undefined && <Photo photo={photo} alt="" className="thumb large" />}
        <div className="info">
          <h3>
            {group.title} {specialty && <SpecialtyBadge specialty={specialty} />}
          </h3>
          {subtitle && <div className="meta">{subtitle}</div>}
        </div>
        <span className={`badge ${failed ? 'danger' : done === group.rows.length ? 'ok' : ''}`}>
          {done}/{group.rows.length}
        </span>
      </header>
      <ul className="check-list">
        {group.rows.map(({ key, item }) => {
          const result = results[key] ?? EMPTY
          const set = (patch: Partial<CheckResult>) => onChange(key, patch)
          const noteMissing = result.status === 'fail' && !result.note.trim()
          return (
            <li key={key} className={`check-item ${result.status ?? ''}`}>
              <div className="check-label">
                <span>{item.label}</span>
                {item.help && <span className="meta">{item.help}</span>}
              </div>
              <div className="pass-fail" role="radiogroup" aria-label={item.label}>
                {(['pass', 'fail'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    role="radio"
                    aria-checked={result.status === status}
                    className={`pf ${status} ${result.status === status ? 'selected' : ''}`}
                    disabled={readOnly}
                    onClick={() => set({ status: result.status === status ? null : status })}
                  >
                    {status === 'pass' ? '✓ Pass' : '✕ Fail'}
                  </button>
                ))}
              </div>
              {(result.status === 'fail' || result.note) && (
                <label className="field check-note">
                  <span>
                    {result.status === 'fail' ? 'What is wrong, and what was done about it?' : 'Note'}
                    {noteMissing && <span className="hint"> (required)</span>}
                  </span>
                  <textarea
                    value={result.note}
                    readOnly={readOnly}
                    rows={2}
                    className={noteMissing ? 'invalid' : ''}
                    onChange={(e) => set({ note: e.target.value })}
                  />
                </label>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
