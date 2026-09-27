import { formatDenomination, formatMoney } from '../../domain/money'
import { checkFloat, countTotal, DENOMINATIONS, floatItemLabel, floatItemTotal, type Counts, type FloatCheckEntry, type FloatItem } from '../../domain/tickets'
import { WholeInput } from '../../ui/inputs'

/** Count of each NZ note and coin, with the running total. */
export function CashCount({ counts, onChange, readOnly }: { counts: Counts; onChange: (cents: number, count: number | null) => void; readOnly: boolean }) {
  const notesFirst = [...DENOMINATIONS].reverse()
  return (
    <table className="count-table">
      <thead>
        <tr>
          <th>Note / coin</th>
          <th>How many</th>
          <th className="num">Value</th>
        </tr>
      </thead>
      <tbody>
        {notesFirst.map(({ cents }) => {
          const n = counts[cents] ?? null
          return (
            <tr key={cents}>
              <th scope="row">{formatDenomination(cents)}</th>
              <td>
                <WholeInput
                  value={n}
                  readOnly={readOnly}
                  aria-label={`Number of ${formatDenomination(cents)}`}
                  onChange={(v) => onChange(cents, v)}
                />
              </td>
              <td className="num">{n ? formatMoney(n * cents) : ''}</td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <th colSpan={2}>Total cash</th>
          <td className="num total">{formatMoney(countTotal(counts))}</td>
        </tr>
      </tfoot>
    </table>
  )
}

/** Float check: tick each denomination once its bags are confirmed, or note what's wrong. */
export function FloatCheckList({
  float,
  entry,
  onToggle,
  onNote,
  readOnly,
}: {
  float: FloatItem[]
  entry: FloatCheckEntry
  onToggle: (cents: number) => void
  onNote: (note: string) => void
  readOnly: boolean
}) {
  const check = checkFloat(float, entry)
  return (
    <div className="float-count">
      {check.status === 'ok' && (
        <div className="float-banner ok" role="status">
          ✓ Float correct: {formatMoney(check.total)}. Good to go.
        </div>
      )}
      {check.status === 'issue' && (
        <div className="float-banner issue" role="status">
          <strong>✕ Float issue</strong>: {check.unticked.map((f) => formatDenomination(f.denominationCents)).join(', ')} not confirmed.
        </div>
      )}
      {check.status === 'pending' && (
        <div className="float-banner pending" role="status">
          Tick each part once it's checked. Float total {formatMoney(check.total)}.
        </div>
      )}
      <ul className="check-list card">
        {float.map((f) => {
          const ticked = Boolean(entry.ticks[f.denominationCents])
          return (
            <li key={f.denominationCents}>
              <button
                type="button"
                role="checkbox"
                aria-checked={ticked}
                className={`check-item ${ticked ? 'checked' : ''}`}
                disabled={readOnly}
                onClick={() => onToggle(f.denominationCents)}
              >
                <span className="tick" aria-hidden="true">
                  {ticked ? '✓' : ''}
                </span>
                <span className="check-label">{floatItemLabel(f)}</span>
                <span className="check-time">{formatMoney(floatItemTotal(f))}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {(check.unticked.length > 0 || entry.note) && (
        <label className="field">
          <span>
            What's wrong with the float? <span className="hint">(needed if anything can't be ticked)</span>
          </span>
          <textarea value={entry.note} readOnly={readOnly} rows={2} onChange={(e) => onNote(e.target.value)} />
        </label>
      )}
    </div>
  )
}
