import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatMoney } from '../../domain/money'
import { revisionChainOf } from '../../domain/revisions'
import {
  amendTicketSheet,
  balanceText,
  checkFloat,
  completionProblems,
  describeSheetChanges,
  reconcile,
  resolveEftpos,
  sheetTitle,
  startProblems,
  STATIONS,
  ticketLineResult,
  type EftposEntry,
  type StationId,
  type TicketLine,
  type TicketSheet,
} from '../../domain/tickets'
import { formatDate, formatDateTime } from '../../lib/dates'
import { newId } from '../../lib/ids'
import { resizePhoto } from '../../lib/photos'
import { cashierProblems, findStaff, fullName, managerProblem } from '../../domain/staff'
import { useRepository, useStaff } from '../../storage/hooks'
import { ErrorNotice, Field } from '../../ui/components'
import { ColourSwatch, MoneyInput, WholeInput } from '../../ui/inputs'
import { SignaturePad } from '../../ui/SignaturePad'
import { AddStaffSelect, StaffNameInput } from '../../ui/StaffInputs'
import { CashCount, FloatCheckList } from './CashCount'

/** `chain` is every revision up to and including `sheet`, oldest first. */
async function downloadPdf(sheet: TicketSheet, chain: TicketSheet[]) {
  // Loaded on demand: the PDF library is large and only needed at the end.
  const { buildTicketSheetPdf, ticketSheetFilename } = await import('../../pdf/ticketSheetPdf')
  buildTicketSheetPdf(sheet, chain).save(ticketSheetFilename(sheet))
}

export function TicketSheetPage() {
  const { id, station } = useParams()
  const repo = useRepository()
  const [all, setAll] = useState<TicketSheet[]>()
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (station && station in STATIONS) repo.listTicketSheets(station as StationId).then(setAll, setError)
  }, [repo, station, id])

  const sheet = all?.find((s) => s.id === id)
  if (error) return <ErrorNotice error={error} />
  if (!(station && station in STATIONS) || (all && !sheet))
    return (
      <p>
        That ticket sheet doesn't exist. <Link to="/">Back home</Link>
      </p>
    )
  if (!sheet || !all) return <p className="meta">Loading…</p>
  return <TicketSheetForm key={sheet.id} initial={sheet} all={all} />
}

const EFTPOS_FIELDS: [keyof EftposEntry, string, string][] = [
  ['takings', 'Takings', 'Amount for tickets and donations, without surcharge'],
  ['surcharge', 'Surcharge', 'Recorded only; not counted as takings'],
  ['totalCharged', 'Total charged', 'Takings + surcharge'],
]

function TicketSheetForm({ initial, all }: { initial: TicketSheet; all: TicketSheet[] }) {
  const repo = useRepository()
  const navigate = useNavigate()
  const staff = useStaff()
  const [sheet, setSheet] = useState(initial)
  // Latest version, so quick successive edits each build on the one before.
  const latest = useRef(initial)
  const [saveError, setSaveError] = useState<unknown>(null)
  const [otherError, setOtherError] = useState<unknown>(null)
  const completed = Boolean(sheet.completedAt)
  const startLocked = completed || Boolean(sheet.startSavedAt)
  const listPath = `/tickets/${sheet.station}`

  // Every change is saved straight away, so the sheet can be closed and finished later.
  function update(change: (current: TicketSheet) => TicketSheet) {
    const next = change(latest.current)
    latest.current = next
    setSheet(next)
    repo.saveTicketSheet(next).then(() => setSaveError(null), setSaveError)
  }
  // Changes are applied to the latest version, so quick taps never undo each other.
  const floatHandlers = (which: 'floatStart' | 'floatEnd') => ({
    onToggle: (cents: number) =>
      update((s) => ({ ...s, [which]: { ...s[which], ticks: { ...s[which].ticks, [cents]: !s[which].ticks[cents] } } })),
    onNote: (note: string) => update((s) => ({ ...s, [which]: { ...s[which], note } })),
  })
  const setLine = (index: number, patch: Partial<TicketLine>) =>
    update((s) => ({ ...s, tickets: s.tickets.map((t, i) => (i === index ? { ...t, ...patch } : t)) }))

  const chain = revisionChainOf(sheet, all)
  const previous = chain.at(-2)
  const amendment = all.find((s) => s.amendsId === sheet.id)
  const r = reconcile(sheet)
  const eftpos = resolveEftpos(sheet.eftpos)
  const toStart = startProblems(sheet)
  const toComplete = completionProblems(sheet)
  const floatStart = checkFloat(sheet.float, sheet.floatStart)
  const floatEnd = checkFloat(sheet.float, sheet.floatEnd)
  const changes = previous ? describeSheetChanges(previous, sheet) : []
  const pdf = (s: TicketSheet) => downloadPdf(s, revisionChainOf(s, [...all.filter((x) => x.id !== s.id), s])).catch(setOtherError)

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
    if (toComplete.length) return
    update((s) => ({ ...s, completedAt: new Date().toISOString() }))
    await pdf(latest.current)
  }

  async function amend() {
    const next = amendTicketSheet(sheet, newId('sheet'))
    await repo.saveTicketSheet(next)
    navigate(`${listPath}/${next.id}`)
  }

  async function discard() {
    const what = sheet.revision > 1 ? 'this correction' : 'this ticket sheet'
    if (!confirm(`Discard ${what}? Everything entered in it will be lost.`)) return
    await repo.deleteTicketSheet(sheet.id)
    navigate(previous ? `${listPath}/${previous.id}` : listPath)
  }

  return (
    <div className="form ticket-sheet">
      <div>
        <Link className="back-link" to={listPath}>
          ← {STATIONS[sheet.station].name} sheets
        </Link>
        <h1>
          {sheetTitle(sheet)} · {formatDate(sheet.date)} {sheet.revision > 1 && <span className="badge warn">Revision {sheet.revision}</span>}
        </h1>
      </div>

      {completed && (
        <div className="notice ok completed-banner">
          <span>
            Signed off {formatDateTime(sheet.completedAt!)} by {sheet.managerName}. <strong>{balanceText(r)}</strong>
          </span>
          <span className="actions">
            <button type="button" className="btn primary" onClick={() => pdf(sheet)}>
              Download PDF
            </button>
            {amendment ? (
              <Link className="btn" to={`${listPath}/${amendment.id}`}>
                {amendment.completedAt ? `See revision ${amendment.revision}` : 'Continue correction'}
              </Link>
            ) : (
              <button type="button" className="btn" onClick={amend}>
                Correct a mistake
              </button>
            )}
          </span>
        </div>
      )}
      {amendment?.completedAt && (
        <div className="notice warning">
          This sheet has been replaced by <Link to={`${listPath}/${amendment.id}`}>revision {amendment.revision}</Link>.
        </div>
      )}
      <ErrorNotice error={otherError} />
      {saveError != null && <ErrorNotice error={new Error(`Couldn't save: ${saveError instanceof Error ? saveError.message : saveError}`)} />}

      {previous && (
        <section className="card form amendment-card">
          <h2>Correcting revision {previous.revision}</h2>
          <p className="meta">
            Revision {previous.revision} was signed off {previous.completedAt && formatDateTime(previous.completedAt)} by {previous.managerName}. Fix what's
            wrong below; it needs signing again.
          </p>
          <Field label="Reason for correction" hint="e.g. miscounted $5 notes">
            <input type="text" value={sheet.amendmentReason} readOnly={completed} onChange={(e) => update((s) => ({ ...s, amendmentReason: e.target.value }))} />
          </Field>
          <div>
            <strong>Changes:</strong>{' '}
            {changes.length ? (
              <ul>
                {changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : (
              <span className="meta">none yet</span>
            )}
          </div>
        </section>
      )}

      <section className="form">
        <h2>1. Start of the shift</h2>
        {sheet.kind === 'event' && (
          <Field label="Event">
            <input type="text" value={sheet.eventName} readOnly={startLocked} onChange={(e) => update((s) => ({ ...s, eventName: e.target.value }))} />
          </Field>
        )}
        <div className="field">
          <Field label="Cashier(s)" hint="separate names with commas">
            <input type="text" value={sheet.cashiers} readOnly={startLocked} onChange={(e) => update((s) => ({ ...s, cashiers: e.target.value }))} />
          </Field>
          {cashierProblems(staff, sheet.cashiers).map((p) => (
            <span key={p} className="input-warning">
              ⚠ {p}
            </span>
          ))}
          {!startLocked && (
            <AddStaffSelect
              staff={staff}
              role="cashier"
              exclude={sheet.cashiers.split(',')}
              onAdd={(p) => update((s) => ({ ...s, cashiers: [s.cashiers.trim(), fullName(p)].filter(Boolean).join(', ') }))}
            />
          )}
        </div>
        <div className="field">
          <Field label="Staff on shift" hint="one per line, with their role if you like">
            <textarea value={sheet.staff} readOnly={startLocked} rows={4} onChange={(e) => update((s) => ({ ...s, staff: e.target.value }))} />
          </Field>
          {!startLocked && (
            <AddStaffSelect
              staff={staff}
              exclude={sheet.staff.split('\n')}
              onAdd={(p) => update((s) => ({ ...s, staff: [s.staff.trimEnd(), p.displayName].filter(Boolean).join('\n') }))}
            />
          )}
        </div>

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
                <WholeInput value={t.startSerial} readOnly={startLocked} onChange={(v) => setLine(i, { startSerial: v, carriedFrom: undefined })} />
              </Field>
              {t.carriedFrom && !startLocked && <span className="meta">From the end of the {t.carriedFrom} sheet. Check it matches the roll.</span>}
            </div>
          ))}
        </div>

        <h3>Float before the shift</h3>
        <FloatCheckList float={sheet.float} entry={sheet.floatStart} readOnly={startLocked} {...floatHandlers('floatStart')} />

        {!completed &&
          (sheet.startSavedAt ? (
            <div className="notice ok completed-banner">
              <span>Start of shift saved {formatDateTime(sheet.startSavedAt)}. Come back here at the end of the shift.</span>
              <button type="button" className="btn" onClick={() => update((s) => ({ ...s, startSavedAt: null }))}>
                Edit start of shift
              </button>
            </div>
          ) : (
            <>
              {toStart.length > 0 && (
                <div className="notice warning">
                  Before saving the start of the shift:
                  <ul>
                    {toStart.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={toStart.length > 0}
                  onClick={() => update((s) => ({ ...s, startSavedAt: new Date().toISOString() }))}
                >
                  Save start of shift
                </button>
              </div>
            </>
          ))}
      </section>

      {!sheet.startSavedAt ? (
        <section className="card locked-section">
          <h2>2. End of the shift</h2>
          <p className="meta">Opens once the start of the shift is saved.</p>
        </section>
      ) : (
        <>
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
                      <WholeInput value={t.endSerial} readOnly={completed} onChange={(v) => setLine(i, { endSerial: v })} />
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
            <FloatCheckList float={sheet.float} entry={sheet.floatEnd} readOnly={completed} {...floatHandlers('floatEnd')} />

            <h3>Cash takings</h3>
            <CashCount counts={sheet.cash} readOnly={completed} onChange={(cents, n) => update((s) => ({ ...s, cash: { ...s.cash, [cents]: n } }))} />

            <h3>EFTPOS</h3>
            <p className="meta">Enter any two of these from the EFTPOS totals receipt. The third is worked out.</p>
            <div className="form-grid">
              {EFTPOS_FIELDS.map(([key, label, hint]) => (
                <Field key={key} label={label} hint={hint}>
                  <MoneyInput
                    value={sheet.eftpos[key]}
                    readOnly={completed}
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
                {!completed && (
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
                <MoneyInput value={sheet.donations.cash} readOnly={completed} onChange={(v) => update((s) => ({ ...s, donations: { ...s.donations, cash: v } }))} />
              </Field>
              <Field label="EFTPOS donations">
                <MoneyInput value={sheet.donations.eftpos} readOnly={completed} onChange={(v) => update((s) => ({ ...s, donations: { ...s.donations, eftpos: v } }))} />
              </Field>
            </div>
          </section>

          <section className="form">
            <h2>3. Summary and sign-off</h2>
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
            {(floatStart.status === 'issue' || floatEnd.status === 'issue') && (
              <div className="notice warning">
                {floatStart.status === 'issue' && <div>Float issue before the shift: {sheet.floatStart.note}</div>}
                {floatEnd.status === 'issue' && <div>Float issue after the reset: {sheet.floatEnd.note}</div>}
              </div>
            )}
            <Field label="Notes" hint="optional: explain any discrepancy, etc.">
              <textarea value={sheet.notes} readOnly={completed} onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))} />
            </Field>
            <Field label="Shift manager">
              <StaffNameInput
                staff={staff}
                role="manager"
                value={sheet.managerName}
                readOnly={completed}
                problem={managerProblem(findStaff(staff, sheet.managerName))}
                onChange={(managerName) => update((s) => ({ ...s, managerName }))}
              />
            </Field>
            <div className="field">
              <span>Shift manager's signature</span>
              <SignaturePad value={sheet.signature} disabled={completed} onChange={(signature) => update((s) => ({ ...s, signature }))} />
            </div>

            {!completed && (
              <>
                {toComplete.length > 0 && (
                  <div className="notice warning">
                    Before signing off:
                    <ul>
                      {toComplete.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="actions">
                  <button type="button" className="btn primary" disabled={toComplete.length > 0} onClick={complete}>
                    Sign off and download PDF
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {!completed && (
        <div className="actions">
          <span className="spacer" />
          <button type="button" className="btn danger" onClick={discard}>
            {sheet.revision > 1 ? 'Discard correction' : 'Discard sheet'}
          </button>
        </div>
      )}

      {chain.length > 1 && (
        <section className="form">
          <h2>Revisions</h2>
          <ol className="set-list">
            {chain.map((s) => (
              <li key={s.id}>
                <Link className="set-row history-row" to={`${listPath}/${s.id}`} aria-current={s.id === sheet.id ? 'page' : undefined}>
                  <span className="pos">{s.revision}</span>
                  <div className="info">
                    <div className="code">{s.revision === 1 ? 'Original sheet' : s.amendmentReason || 'Correction'}</div>
                    <div className="meta">{s.completedAt ? `Signed off ${formatDateTime(s.completedAt)} by ${s.managerName}` : 'In progress'}</div>
                  </div>
                  {s.id === sheet.id && <span className="badge">Viewing</span>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
