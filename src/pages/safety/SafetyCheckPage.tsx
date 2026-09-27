import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  buildChecklist,
  checkProgress,
  MAX_TRAINS,
  pruneResults,
  signOffState,
  trainProblems,
  type CheckResult,
  type SafetyCheck,
  type TrainCheck,
} from '../../domain/safetyCheck'
import type { Fleet } from '../../domain/types'
import { newId } from '../../lib/ids'
import { formatDate, formatDateTime } from '../../lib/dates'
import { useFleet, useRepository } from '../../storage/hooks'
import { ErrorNotice, Field } from '../../ui/components'
import { SignaturePad } from '../../ui/SignaturePad'
import { CheckGroupCard } from './CheckGroupCard'
import { TrainEditor } from './TrainEditor'

async function downloadPdf(check: SafetyCheck) {
  // Loaded on demand: the PDF library is large and only needed at the end.
  const { buildSafetyCheckPdf, safetyCheckFilename } = await import('../../pdf/safetyCheckPdf')
  buildSafetyCheckPdf(check).save(safetyCheckFilename(check))
}

export function SafetyCheckPage() {
  const { id } = useParams()
  const repo = useRepository()
  const fleetState = useFleet()
  const [check, setCheck] = useState<SafetyCheck | null>()
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    repo.getSafetyCheck(id!).then((c) => setCheck(c ?? null), setError)
  }, [repo, id])

  if (error) return <ErrorNotice error={error} />
  if (check === null)
    return (
      <p>
        That safety check doesn't exist. <Link to="/safety">Back to safety checks</Link>
      </p>
    )
  if (!check || fleetState.status !== 'ready') return <p className="meta">Loading…</p>
  return <SafetyCheckForm initial={check} fleet={fleetState.fleet} />
}

function SafetyCheckForm({ initial, fleet }: { initial: SafetyCheck; fleet: Fleet }) {
  const repo = useRepository()
  const navigate = useNavigate()
  const [check, setCheck] = useState(initial)
  // Latest version, so quick successive taps each build on the one before rather than a stale render.
  const latest = useRef(initial)
  const [saveError, setSaveError] = useState<unknown>(null)
  const [pdfError, setPdfError] = useState<unknown>(null)
  const readOnly = Boolean(check.completedAt)

  // Every change is saved straight away, so nothing is lost if the tablet sleeps or the page reloads.
  function update(change: (current: SafetyCheck) => SafetyCheck) {
    const next = change(latest.current)
    latest.current = next
    setCheck(next)
    repo.saveSafetyCheck(next).then(() => setSaveError(null), setSaveError)
  }

  const setTrain = (index: number, train: TrainCheck) => update((c) => ({ ...c, trains: c.trains.map((t, i) => (i === index ? train : t)) }))
  const setResult = (key: string, patch: Partial<CheckResult>) =>
    update((c) => ({ ...c, results: { ...c.results, [key]: { ...(c.results[key] ?? { status: null, note: '' }), ...patch } } }))

  const groups = buildChecklist(check)
  const progress = checkProgress(check)
  const problems = trainProblems(check)
  const signOff = signOffState(check)
  const photoOf = (vehicleId: string | null) =>
    fleet.locomotives.find((l) => l.id === vehicleId)?.photo ?? fleet.carriages.find((c) => c.id === vehicleId)?.photo ?? null

  async function complete() {
    if (!signOff.canComplete) return
    update((c) => pruneResults({ ...c, completedAt: new Date().toISOString() }))
    const done = latest.current
    try {
      await downloadPdf(done)
    } catch (err) {
      setPdfError(err)
    }
  }

  async function discard() {
    if (!confirm('Discard this safety check? Everything entered will be lost.')) return
    await repo.deleteSafetyCheck(check.id)
    navigate('/safety')
  }

  return (
    <div className="form safety-check">
      <div>
        <Link className="back-link" to="/safety">
          ← Safety checks
        </Link>
        <h1>Safety check: {formatDate(check.date)}</h1>
      </div>

      <div className="progress-bar" aria-live="polite">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress.total ? (progress.answered / progress.total) * 100 : 0}%` }} />
        </div>
        <span>
          {progress.answered}/{progress.total} checks
          {progress.failed > 0 && <strong className="fail-text"> · {progress.failed} failed</strong>}
        </span>
      </div>

      {readOnly && (
        <div className="notice ok completed-banner">
          <span>
            Completed {formatDateTime(check.completedAt!)} by {check.managerName}.
          </span>
          <button type="button" className="btn primary" onClick={() => downloadPdf(check).catch(setPdfError)}>
            Download PDF
          </button>
        </div>
      )}
      <ErrorNotice error={pdfError} />
      {saveError != null && <ErrorNotice error={new Error(`Couldn't save: ${saveError instanceof Error ? saveError.message : saveError}`)} />}

      <section className="form">
        <h2>1. Trains running today</h2>
        {check.trains.map((train, i) => (
          <TrainEditor
            key={train.id}
            index={i}
            train={train}
            fleet={fleet}
            readOnly={readOnly}
            usedIds={new Set(check.trains.filter((_, j) => j !== i).flatMap((t) => [t.loco?.id ?? '', ...t.carriages.map((c) => c.id)]))}
            onChange={(t) => setTrain(i, t)}
            onRemove={() => update((c) => ({ ...c, trains: c.trains.filter((_, j) => j !== i) }))}
          />
        ))}
        {!readOnly && check.trains.length < MAX_TRAINS && (
          <div>
            <button
              type="button"
              className="btn"
              onClick={() => update((c) => ({ ...c, trains: [...c.trains, { id: newId('train'), setName: null, loco: null, carriages: [] }] }))}
            >
              + Add train
            </button>
          </div>
        )}
        {problems.length > 0 && check.trains.length > 0 && (
          <div className="notice warning">
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="form">
        <h2>2. Track</h2>
        {groups
          .filter((g) => g.kind === 'track')
          .map((g) => (
            <CheckGroupCard key={g.title} group={g} results={check.results} onChange={setResult} readOnly={readOnly} />
          ))}
      </section>

      {check.trains.map((train, i) => (
        <section className="form" key={train.id}>
          <h2>
            {3 + i}. Train {i + 1}
            {train.loco && `: ${train.loco.code}`}
            {train.setName && `, set ${train.setName}`}
          </h2>
          {groups
            .filter((g) => g.trainIndex === i)
            .map((g) => {
              const car = train.carriages.find((c) => c.id === g.vehicleId)
              return (
                <CheckGroupCard
                  key={g.vehicleId}
                  group={g}
                  results={check.results}
                  photo={photoOf(g.vehicleId)}
                  specialty={car?.specialty}
                  subtitle={g.kind === 'loco' ? train.loco?.livery : car?.livery}
                  onChange={setResult}
                  readOnly={readOnly}
                />
              )
            })}
          {groups.every((g) => g.trainIndex !== i) && <p className="meta">Choose a locomotive and carriages above.</p>}
        </section>
      ))}

      <section className="form">
        <h2>{3 + check.trains.length}. Sign-off</h2>
        <Field label="General notes" hint="optional: weather, track conditions, anything else">
          <textarea value={check.notes} readOnly={readOnly} onChange={(e) => update((c) => ({ ...c, notes: e.target.value }))} />
        </Field>
        <Field label="Shift manager">
          <input type="text" value={check.managerName} readOnly={readOnly} autoComplete="name" onChange={(e) => update((c) => ({ ...c, managerName: e.target.value }))} />
        </Field>
        <div className="field">
          <span>Signature</span>
          <SignaturePad value={check.signature} disabled={readOnly} onChange={(signature) => update((c) => ({ ...c, signature }))} />
        </div>

        {!readOnly && (
          <>
            {signOff.reasons.length > 0 && (
              <div className="notice warning">
                Before signing off:
                <ul>
                  {signOff.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {signOff.canComplete && progress.failed > 0 && (
              <div className="notice error">
                {progress.failed} check{progress.failed === 1 ? '' : 's'} failed. By signing off you confirm each has been dealt with as
                described in its note.
              </div>
            )}
            <div className="actions">
              <button type="button" className="btn primary" disabled={!signOff.canComplete} onClick={complete}>
                Complete and download PDF
              </button>
              <span className="spacer" />
              <button type="button" className="btn danger" onClick={discard}>
                Discard check
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
