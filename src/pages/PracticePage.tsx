import { useState } from 'react'
import { generateSampleSeason } from '../domain/practiceData'
import { newId } from '../lib/ids'
import { requestPracticeReset, switchMode } from '../lib/mode'
import { useMode } from '../lib/modeContext'
import { useRepository } from '../storage/hooks'
import { ErrorNotice } from '../ui/components'

export function PracticePage() {
  const mode = useMode()
  const repo = useRepository()
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  async function addSampleSeason() {
    setBusy(true)
    setError(null)
    try {
      const [fleet, settings, staff] = await Promise.all([repo.getFleet(), repo.getTicketSettings(), repo.listStaff()])
      if (!staff.some((s) => s.manager) || !staff.some((s) => s.driver)) throw new Error('The practice staff list needs managers and drivers first.')
      const season = generateSampleSeason(fleet, settings, staff, (prefix) => newId(`sample-${prefix}`), new Date(), Date.now() % 100000)
      await repo.addRecords(season)
      setMessage(`Added ${season.safetyChecks.length} running days of made-up safety checks and ${season.ticketSheets.length} ticket sheets. Have a look at Season stats.`)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    if (!confirm('Delete all practice data and start again? Real records are not affected.')) return
    requestPracticeReset()
  }

  if (mode === 'live')
    return (
      <div className="form">
        <h1>Practice mode</h1>
        <p>
          Practice mode is a separate copy of the app for learning and demonstrating. It has its own made-up staff list, and anything
          done there stays there. Real records are never touched, and practice PDFs are clearly marked as practice.
        </p>
        <p>It's ideal for training new volunteers, or for running alongside the paper forms for a few weeks before switching over.</p>
        <div>
          <button type="button" className="btn primary" onClick={() => switchMode('practice')}>
            Start practice mode
          </button>
        </div>
      </div>
    )

  return (
    <div className="form">
      <h1>Practice mode</h1>
      <p>You're in practice mode. Try anything: fill in safety checks and ticket sheets, sign them off, correct them, make PDFs.</p>
      <section className="card form">
        <h2>Sample season</h2>
        <p className="meta">
          Fills practice mode with about 15 months of made-up running days (safety checks and ticket sheets for both stations), so Season
          stats has something to show.
        </p>
        <div>
          <button type="button" className="btn primary" disabled={busy} onClick={addSampleSeason}>
            {busy ? 'Adding…' : 'Add a sample season'}
          </button>
        </div>
      </section>
      <section className="card form">
        <h2>Start again</h2>
        <p className="meta">Deletes everything in practice mode, including the practice staff list, which is regenerated.</p>
        <div>
          <button type="button" className="btn danger" onClick={reset}>
            Reset practice data
          </button>
        </div>
      </section>
      <div>
        <button type="button" className="btn" onClick={() => switchMode('live')}>
          Leave practice mode
        </button>
      </div>
      {message && <div className="notice ok">{message}</div>}
      <ErrorNotice error={error} />
    </div>
  )
}
