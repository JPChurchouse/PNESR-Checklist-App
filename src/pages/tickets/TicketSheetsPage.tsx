import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatMoney } from '../../domain/money'
import { currentRecords } from '../../domain/revisions'
import { newTicketSheet, reconcile, STATIONS, type SheetKind, type StationId, type TicketSheet } from '../../domain/tickets'
import { formatDate, localDate } from '../../lib/dates'
import { newId } from '../../lib/ids'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice } from '../../ui/components'

function status(sheet: TicketSheet) {
  if (!sheet.completedAt)
    return <span className="badge warn">{sheet.revision > 1 ? 'Correcting' : sheet.startSavedAt ? 'Shift in progress' : 'Starting'}</span>
  const r = reconcile(sheet)
  return (
    <span className={`badge ${r.balance === 'balanced' ? 'ok' : 'danger'}`}>
      {r.balance === 'balanced' ? 'Balanced' : `${r.balance === 'over' ? 'Over' : 'Short'} ${formatMoney(Math.abs(r.difference))}`}
    </span>
  )
}

export function TicketSheetsPage() {
  const station = useParams().station as StationId
  const repo = useRepository()
  const navigate = useNavigate()
  const [sheets, setSheets] = useState<TicketSheet[]>()
  const [error, setError] = useState<unknown>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (station in STATIONS) repo.listTicketSheets(station).then(setSheets, setError)
  }, [repo, station])

  if (!(station in STATIONS)) return <p>Unknown station.</p>
  const openToday = (kind: SheetKind) => sheets?.find((s) => s.date === localDate() && !s.completedAt && s.revision === 1 && s.kind === kind)

  async function start(kind: SheetKind) {
    setStarting(true)
    try {
      const sheet = newTicketSheet(newId('sheet'), station, await repo.getTicketSettings(), kind)
      await repo.saveTicketSheet(sheet)
      navigate(sheet.id)
    } catch (err) {
      setError(err)
      setStarting(false)
    }
  }

  const startButton = (kind: SheetKind, label: string, primary: boolean) => {
    const open = openToday(kind)
    return open ? (
      <Link className={`btn ${primary ? 'primary' : ''}`} to={open.id}>
        Continue today's {kind === 'event' ? 'event sheet' : 'sheet'}
      </Link>
    ) : (
      <button type="button" className={`btn ${primary ? 'primary' : ''}`} onClick={() => start(kind)} disabled={starting}>
        {label}
      </button>
    )
  }

  return (
    <>
      <div className="page-head">
        <h1>{STATIONS[station].name} ticket sheets</h1>
        {sheets && (
          <div className="actions">
            {startButton('regular', "Start today's sheet", true)}
            {startButton('event', 'Start special event sheet', false)}
          </div>
        )}
      </div>
      <ErrorNotice error={error} />
      {sheets?.length === 0 && <p className="meta">No ticket sheets yet.</p>}
      <ul className="set-list">
        {sheets &&
          currentRecords(sheets).map((sheet) => {
            const r = reconcile(sheet)
            return (
              <li key={sheet.id}>
                <Link to={sheet.id} className="set-row history-row">
                  <div className="info">
                    <div className="code">
                      {formatDate(sheet.date)}
                      {sheet.kind === 'event' && ` · Special event${sheet.eventName ? `: ${sheet.eventName}` : ''}`}
                    </div>
                    <div className="meta">
                      {sheet.cashiers || 'No cashier yet'}
                      {sheet.completedAt && ` · ${r.ticketsSold} tickets · ${formatMoney(r.ticketValue)}`}
                    </div>
                  </div>
                  <span className="actions">
                    {sheet.revision > 1 && <span className="badge">Rev {sheet.revision}</span>}
                    {status(sheet)}
                  </span>
                </Link>
              </li>
            )
          })}
      </ul>
    </>
  )
}
