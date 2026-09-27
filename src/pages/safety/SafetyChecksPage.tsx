import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkProgress, currentChecks, newSafetyCheck, type SafetyCheck } from '../../domain/safetyCheck'
import { newId } from '../../lib/ids'
import { formatDate, localDate } from '../../lib/dates'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice } from '../../ui/components'

export function SafetyChecksPage() {
  const repo = useRepository()
  const navigate = useNavigate()
  const [checks, setChecks] = useState<SafetyCheck[]>()
  const [error, setError] = useState<unknown>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    repo.listSafetyChecks().then(setChecks, setError)
  }, [repo])

  const today = localDate()
  const openToday = checks?.find((c) => c.date === today && !c.completedAt && c.revision === 1)

  async function start() {
    setStarting(true)
    try {
      const check = newSafetyCheck(newId('check'))
      await repo.saveSafetyCheck(check)
      navigate(check.id)
    } catch (err) {
      setError(err)
      setStarting(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Pre-operation safety checks</h1>
        {checks &&
          (openToday ? (
            <Link className="btn primary" to={openToday.id}>
              Continue today's check
            </Link>
          ) : (
            <button type="button" className="btn primary" onClick={start} disabled={starting}>
              Start today's check
            </button>
          ))}
      </div>
      <ErrorNotice error={error} />
      {checks?.length === 0 && <p className="meta">No safety checks yet.</p>}
      <ul className="set-list">
        {checks && currentChecks(checks).map((check) => {
          const p = checkProgress(check)
          return (
            <li key={check.id}>
              <Link to={check.id} className="set-row history-row">
                <div className="info">
                  <div className="code">{formatDate(check.date)}</div>
                  <div className="meta">
                    {check.trains.length} train{check.trains.length === 1 ? '' : 's'}
                    {check.trains.some((t) => t.loco) && ` · ${check.trains.map((t) => t.loco?.code ?? '?').join(', ')}`}
                    {check.managerName && ` · ${check.managerName}`}
                  </div>
                </div>
                <span className="actions">
                  {check.revision > 1 && <span className="badge">Rev {check.revision}</span>}
                  {check.completedAt ? (
                    check.outcome === 'cancelled' ? (
                      <span className="badge danger">Not operating</span>
                    ) : (
                      <span className="badge ok">Signed off</span>
                    )
                  ) : (
                    <span className="badge warn">
                      {check.revision > 1 ? 'Amending' : 'In progress'} {p.done}/{p.total}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
