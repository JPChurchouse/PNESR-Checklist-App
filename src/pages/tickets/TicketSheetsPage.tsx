import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatMoney } from '../../domain/money'
import { newTicketSheet, reconcile, STATIONS, type StationId, type TicketSheet } from '../../domain/tickets'
import { formatDate, localDate } from '../../lib/dates'
import { newId } from '../../lib/ids'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice } from '../../ui/components'

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
  const openToday = sheets?.find((s) => s.date === localDate() && !s.completedAt)

  async function start() {
    setStarting(true)
    try {
      const sheet = newTicketSheet(newId('sheet'), station, await repo.getTicketSettings())
      await repo.saveTicketSheet(sheet)
      navigate(sheet.id)
    } catch (err) {
      setError(err)
      setStarting(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>{STATIONS[station].name} ticket sheets</h1>
        {sheets &&
          (openToday ? (
            <Link className="btn primary" to={openToday.id}>
              Continue today's sheet
            </Link>
          ) : (
            <button type="button" className="btn primary" onClick={start} disabled={starting}>
              Start today's sheet
            </button>
          ))}
      </div>
      <ErrorNotice error={error} />
      {sheets?.length === 0 && <p className="meta">No ticket sheets yet.</p>}
      <ul className="set-list">
        {sheets?.map((sheet) => {
          const r = reconcile(sheet)
          return (
            <li key={sheet.id}>
              <Link to={sheet.id} className="set-row history-row">
                <div className="info">
                  <div className="code">{formatDate(sheet.date)}</div>
                  <div className="meta">
                    {sheet.cashier || 'No cashier yet'}
                    {sheet.completedAt && ` · ${r.ticketsSold} tickets · ${formatMoney(r.ticketValue)}`}
                  </div>
                </div>
                {sheet.completedAt ? (
                  <span className={`badge ${r.balance === 'balanced' ? 'ok' : 'danger'}`}>
                    {r.balance === 'balanced' ? 'Balanced' : `${r.balance === 'over' ? 'Over' : 'Short'} ${formatMoney(Math.abs(r.difference))}`}
                  </span>
                ) : (
                  <span className="badge warn">In progress</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
