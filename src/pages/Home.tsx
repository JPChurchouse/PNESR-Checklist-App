import { Link } from 'react-router-dom'
import { STATION_IDS, STATIONS } from '../domain/tickets'
import { formatDateTime } from '../lib/dates'
import { backupOverdue, lastBackupAt } from '../lib/backupReminder'
import { useMode } from '../lib/modeContext'
import { InstallPrompt } from '../ui/AppUpdates'

const TOOLS: [path: string, title: string, description: string][] = [
  ['/fleet', 'Fleet', 'Locomotives, carriages, carriage sets and liveries.'],
  ['/staff', 'Staff', 'Import the staff list so names and qualifications can be picked on the forms.'],
  ['/settings/tickets', 'Tickets and float', 'Ticket prices and colours, event tickets, and what goes in the float.'],
  ['/backup', 'Backup and restore', 'Keep a copy of every record off this device.'],
  ['/forms', 'Printable forms', 'Blank paper versions of the forms, for when a device isn’t available.'],
  ['/practice', 'Practice mode', 'Try everything with made-up staff and records.'],
]

export function Home() {
  const mode = useMode()
  const last = lastBackupAt(mode)
  return (
    <>
      {mode === 'live' && backupOverdue(mode) && (
        <div className="notice warning completed-banner">
          <span>
            {last ? `Last backup ${formatDateTime(last)}.` : 'This device has never been backed up.'} Records only live on this device until
            they're backed up.
          </span>
          <Link className="btn" to="/backup">
            Back up now
          </Link>
        </div>
      )}

      <InstallPrompt />

      <h1>Today</h1>
      <div className="home-grid">
        <Link className="card home-card" to="/safety">
          <h2>Pre-operation safety check</h2>
          <p className="meta">Track, locomotive and carriage checks before passengers board.</p>
        </Link>
        {STATION_IDS.map((id) => (
          <Link key={id} className="card home-card" to={`/tickets/${id}`}>
            <h2>{STATIONS[id].name} tickets</h2>
            <p className="meta">Ticket numbers, float, takings and the end-of-day count.</p>
          </Link>
        ))}
        <Link className="card home-card stats-card" to="/stats">
          <h2>Season stats</h2>
          <p className="meta">Tickets, takings, busiest days and fleet use, compared with last year.</p>
        </Link>
      </div>

      <h2 className="section-heading">Setup and tools</h2>
      <div className="home-grid tools">
        {TOOLS.map(([path, title, description]) => (
          <Link key={path} className="card home-card" to={path}>
            <h3>{title}</h3>
            <p className="meta">{description}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
