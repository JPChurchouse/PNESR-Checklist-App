import { formatDenomination, formatMoney } from '../../domain/money'
import { checkFloat, countTotal, DENOMINATIONS, type Counts, type FloatItem } from '../../domain/tickets'
import { WholeInput } from '../../ui/inputs'

/** Count of each NZ note and coin, with the running total. */
export function CashCount({ counts, onChange, readOnly }: { counts: Counts; onChange: (counts: Counts) => void; readOnly: boolean }) {
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
                  onChange={(v) => onChange({ ...counts, [cents]: v })}
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

/** Float count against what the float should hold, with a clear "good to go" or "issue" banner. */
export function FloatCount({
  float,
  counts,
  onChange,
  readOnly,
}: {
  float: FloatItem[]
  counts: Counts
  onChange: (counts: Counts) => void
  readOnly: boolean
}) {
  const check = checkFloat(float, counts)
  return (
    <div className="float-count">
      {check.complete ? (
        check.ok ? (
          <div className="float-banner ok" role="status">
            ✓ Float correct: {formatMoney(check.expectedTotal)}. Good to go.
          </div>
        ) : (
          <div className="float-banner issue" role="status">
            <strong>✕ Float issue</strong>: counted {formatMoney(check.countedTotal)}, expected {formatMoney(check.expectedTotal)}
            <ul>
              {check.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <div className="float-banner pending" role="status">
          Count each denomination. Expected total {formatMoney(check.expectedTotal)}.
        </div>
      )}
      <table className="count-table">
        <thead>
          <tr>
            <th>Note / coin</th>
            <th>Expected</th>
            <th>Counted</th>
            <th className="num">Status</th>
          </tr>
        </thead>
        <tbody>
          {check.rows.map((row) => {
            const item = float.find((f) => f.denominationCents === row.denominationCents)!
            const status = row.counted === null ? '' : row.differenceCents === 0 ? 'ok' : 'issue'
            return (
              <tr key={row.denominationCents} className={status}>
                <th scope="row">{formatDenomination(row.denominationCents)}</th>
                <td>
                  {row.expected}
                  <span className="meta bags">
                    {item.bags} bag{item.bags === 1 ? '' : 's'} × {item.perBag}
                  </span>
                </td>
                <td>
                  <WholeInput
                    value={row.counted}
                    readOnly={readOnly}
                    aria-label={`Number of ${formatDenomination(row.denominationCents)} in the float`}
                    onChange={(v) => onChange({ ...counts, [row.denominationCents]: v })}
                  />
                </td>
                <td className="num">
                  {status === 'ok' && <span className="badge ok">✓</span>}
                  {status === 'issue' && (
                    <span className="badge danger">
                      {row.differenceCents! < 0 ? '−' : '+'}
                      {formatMoney(Math.abs(row.differenceCents!))}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
