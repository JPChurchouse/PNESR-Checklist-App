import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatMoney } from '../../domain/money'
import {
  balanceText,
  checkFloat,
  completionProblems,
  reconcile,
  resolveEftpos,
  STATIONS,
  ticketLineResult,
  type EftposEntry,
  type TicketLine,
  type TicketSheet,
} from '../../domain/tickets'
import { formatDate, formatDateTime } from '../../lib/dates'
import { resizePhoto } from '../../lib/photos'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice, Field } from '../../ui/components'
import { ColourSwatch, MoneyInput, WholeInput } from '../../ui/inputs'
import { CashCount, FloatCount } from './CashCount'

async function downloadPdf(sheet: TicketSheet) {
  // Loaded on demand: the PDF library is large and only needed at the end.
  const { buildTicketSheetPdf, ticketSheetFilename } = await import('../../pdf/ticketSheetPdf')
  buildTicketSheetPdf(sheet).save(ticketSheetFilename(sheet))
}

export function TicketSheetPage() {
  const { id } = useParams()
  const repo = useRepository()
  const [sheet, setSheet] = useState<TicketSheet | null>()
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    repo.getTicketSheet(id!).then((s) => setSheet(s ?? null), setError)
  }, [repo, id])

  if (error) return <ErrorNotice error={error} />
  if (sheet === null)
    return (
      <p>
        That ticket sheet doesn't exist. <Link to="/">Back home</Link>
      </p>
    )
  if (!sheet) return <p className="meta">Loading…</p>
  return <TicketSheetForm key={sheet.id} initial={sheet} />
}

const EFTPOS_FIELDS: [keyof EftposEntry, string, string][] = [
  ['takings', 'Takings', 'Amount for tickets and donations, without surcharge'],
  ['surcharge', 'Surcharge', 'Recorded only; not counted as takings'],
  ['totalCharged', 'Total charged', 'Takings + surcharge'],
]

function TicketSheetForm({ initial }: { initial: TicketSheet }) {
  const repo = useRepository()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState(initial)
  // Latest version, so quick successive edits each build on the one before.
  const latest = useRef(initial)
  const [saveError, setSaveError] = useState<unknown>(null)
  const [otherError, setOtherError] = useState<unknown>(null)
  const readOnly = Boolean(sheet.completedAt)
  const station = STATIONS[sheet.station]

  // Every change is saved straight away.
  function update(change: (current: TicketSheet) => TicketSheet) {
    const next = change(latest.current)
    latest.current = next
    setSheet(next)
    repo.saveTicketSheet(next).then(() => setSaveError(null), setSaveError)
  }
  const setLine = (index: number, patch: Partial<TicketLine>) =>
    update((s) => ({ ...s, tickets: s.tickets.map((t, i) => (i === index ? { ...t, ...patch } : t)) }))

  const r = reconcile(sheet)
  const eftpos = resolveEftpos(sheet.eftpos)
  const problems = completionProblems(sheet)
  const floatStart = checkFloat(sheet.float, sheet.floatStart)
  const floatEnd = checkFloat(sheet.float, sheet.floatEnd)

  async function addReceipt(file: File | undefined) {
    if (!file) return
    try {
      const photo = await resizePhoto(file)
      update((s) => ({ ...s, eftposReceipt: photo }))
    } catch {
      setOtherError(new Error("That file couldn't be read as a photo."))
    }
  }

  async function complete() {
    if (problems.length) return
    update((s) => ({ ...s, completedAt: new Date().toISOString() }))
    await downloadPdf(latest.current).catch(setOtherError)
  }

  async function discard() {
    if (!confirm('Discard this ticket sheet? Everything entered will be lost.')) return
    await repo.deleteTicketSheet(sheet.id)
    navigate(`/tickets/${sheet.station}`)
  }

  return (
    <div className="form ticket-sheet">
      <div>
        <Link className="back-link" to={`/tickets/${sheet.station}`}>
          ← {station.name} sheets
        </Link>
        <h1>
          {station.name}: {formatDate(sheet.date)}
        </h1>
      </div>

      {readOnly && (
        <div className="notice ok completed-banner">
          <span>
            Completed {formatDateTime(sheet.completedAt!)} by {sheet.cashier}. <strong>{balanceText(r)}</strong>
          </span>
          <button type="button" className="btn primary" onClick={() => downloadPdf(sheet).catch(setOtherError)}>
            Download PDF
          </button>
        </div>
      )}
      <ErrorNotice error={otherError} />
      {saveError != null && <ErrorNotice error={new Error(`Couldn't save: ${saveError instanceof Error ? saveError.message : saveError}`)} />}

      <section className="form">
        <h2>1. Before the shift</h2>
        <Field label="Cashier">
          <input type="text" value={sheet.cashier} readOnly={readOnly} autoComplete="name" onChange={(e) => update((s) => ({ ...s, cashier: e.target.value }))} />
        </Field>

        <h3>Ticket start numbers</h3>
        <p className="meta">The number on the first ticket of each roll. Leave a roll blank if it isn't being used today.</p>
        <div className="ticket-grid">
          {sheet.tickets.map((t, i) => (
            <div key={t.typeId} className="card ticket-card">
              <div className="title-row">
                <strong>{t.name}</strong>
                <span className="meta">{formatMoney(t.priceCents)}</span>
              </div>
              <ColourSwatch colour={t.colour} />
              <Field label="Start number">
                <WholeInput value={t.startSerial} readOnly={readOnly} onChange={(v) => setLine(i, { startSerial: v })} />
              </Field>
            </div>
          ))}
        </div>

        <h3>Float before the shift</h3>
        <FloatCount float={sheet.float} counts={sheet.floatStart} readOnly={readOnly} onChange={(floatStart) => update((s) => ({ ...s, floatStart }))} />
      </section>

      <section className="form">
        <h2>2. End of the shift</h2>

        <h3>Ticket end numbers</h3>
        <p className="meta">The number on the first ticket left on each roll (the next one that would be sold).</p>
        <div className="ticket-grid">
          {r.lines.map((t, i) => {
            const result = ticketLineResult(t)
            return (
              <div key={t.typeId} className="card ticket-card">
                <div className="title-row">
                  <strong>{t.name}</strong>
                  <ColourSwatch colour={t.colour} />
                </div>
                <div className="meta">Started at {t.startSerial ?? '—'}</div>
                <Field label="End number">
                  <WholeInput value={t.endSerial} readOnly={readOnly} onChange={(v) => setLine(i, { endSerial: v })} />
                </Field>
                {result.problem ? (
                  <div className="input-error">{result.problem}</div>
                ) : (
                  result.sold !== null && (
                    <div className="sold">
                      {result.sold} sold × {formatMoney(t.priceCents)} = <strong>{formatMoney(result.valueCents)}</strong>
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>

        <h3>Reset the float</h3>
        <p className="meta">Make up the float again first. Whatever cash is left over is the takings.</p>
        <FloatCount float={sheet.float} counts={sheet.floatEnd} readOnly={readOnly} onChange={(floatEnd) => update((s) => ({ ...s, floatEnd }))} />

        <h3>Cash takings</h3>
        <CashCount counts={sheet.cash} readOnly={readOnly} onChange={(cash) => update((s) => ({ ...s, cash }))} />

        <h3>EFTPOS</h3>
        <p className="meta">Enter any two of these from the EFTPOS totals receipt. The third is worked out.</p>
        <div className="form-grid">
          {EFTPOS_FIELDS.map(([key, label, hint]) => (
            <Field key={key} label={label} hint={hint}>
              <MoneyInput
                value={sheet.eftpos[key]}
                readOnly={readOnly}
                placeholder={eftpos.calculated === key ? `${(eftpos[key]! / 100).toFixed(2)} (calculated)` : ''}
                onChange={(v) => update((s) => ({ ...s, eftpos: { ...s.eftpos, [key]: v } }))}
              />
            </Field>
          ))}
        </div>
        {eftpos.problem && <div className="notice warning">{eftpos.problem}</div>}

        <div className="field">
          <span>EFTPOS receipt photo (optional)</span>
          <div className="photo-field">
            {sheet.eftposReceipt && <img className="receipt" src={sheet.eftposReceipt} alt="EFTPOS totals receipt" />}
            {!readOnly && (
              <div className="actions">
                <label className="btn">
                  {sheet.eftposReceipt ? 'Retake photo' : 'Take photo'}
                  <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => addReceipt(e.target.files?.[0])} />
                </label>
                {sheet.eftposReceipt && (
                  <button type="button" className="btn danger" onClick={() => update((s) => ({ ...s, eftposReceipt: null }))}>
                    Remove photo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <h3>Donations</h3>
        <div className="form-grid">
          <Field label="Cash donations">
            <MoneyInput value={sheet.donations.cash} readOnly={readOnly} onChange={(v) => update((s) => ({ ...s, donations: { ...s.donations, cash: v } }))} />
          </Field>
          <Field label="EFTPOS donations">
            <MoneyInput value={sheet.donations.eftpos} readOnly={readOnly} onChange={(v) => update((s) => ({ ...s, donations: { ...s.donations, eftpos: v } }))} />
          </Field>
        </div>
      </section>

      <section className="form">
        <h2>3. Summary</h2>
        <div className={`balance-banner ${r.balance}`} role="status">
          {balanceText(r)}
        </div>
        <table className="summary-table">
          <tbody>
            <tr>
              <th scope="row">Tickets sold ({r.ticketsSold})</th>
              <td className="num">{formatMoney(r.ticketValue)}</td>
            </tr>
            <tr>
              <th scope="row">Cash takings</th>
              <td className="num">{formatMoney(r.cashTakings)}</td>
            </tr>
            <tr>
              <th scope="row">+ EFTPOS takings (excluding surcharge)</th>
              <td className="num">{formatMoney(r.eftposTakings)}</td>
            </tr>
            <tr>
              <th scope="row">− Donations (cash and EFTPOS)</th>
              <td className="num">{formatMoney(r.donations)}</td>
            </tr>
            <tr className="total">
              <th scope="row">= Money for tickets</th>
              <td className="num">{formatMoney(r.moneyForTickets)}</td>
            </tr>
            <tr className={`total ${r.balance}`}>
              <th scope="row">Difference (money − tickets)</th>
              <td className="num">
                {r.difference > 0 ? '+' : ''}
                {formatMoney(r.difference)}
              </td>
            </tr>
          </tbody>
        </table>
        {(!floatStart.ok || !floatEnd.ok) && (floatStart.complete || floatEnd.complete) && (
          <div className="notice warning">
            {!floatStart.ok && floatStart.complete && <div>The float didn't match before the shift.</div>}
            {!floatEnd.ok && floatEnd.complete && <div>The float didn't match after the reset.</div>}
          </div>
        )}
        <Field label="Notes" hint="optional: explain any discrepancy, float issues, etc.">
          <textarea value={sheet.notes} readOnly={readOnly} onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))} />
        </Field>

        {!readOnly && (
          <>
            {problems.length > 0 && (
              <div className="notice warning">
                Before completing:
                <ul>
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="actions">
              <button type="button" className="btn primary" disabled={problems.length > 0} onClick={complete}>
                Complete and download PDF
              </button>
              <span className="spacer" />
              <button type="button" className="btn danger" onClick={discard}>
                Discard sheet
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
