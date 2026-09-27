import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  amendSafetyCheck,
  buildChecklist,
  checkProgress,
  describeTrainChanges,
  MAX_TRAINS,
  pruneResults,
  signOffState,
  trainProblems,
  type Outcome,
  type SafetyCheck,
  type TrainCheck,
} from '../../domain/safetyCheck'
import { revisionChainOf as revisionChain } from '../../domain/revisions'
import type { Fleet } from '../../domain/types'
import { formatDate, formatDateTime } from '../../lib/dates'
import { newId } from '../../lib/ids'
import { useFleet, useRepository } from '../../storage/hooks'
import { ErrorNotice, Field } from '../../ui/components'
import { SignaturePad } from '../../ui/SignaturePad'
import { CheckGroupCard } from './CheckGroupCard'
import { TrainEditor } from './TrainEditor'

/** `chain` is every revision up to and including `check`, oldest first. */
async function downloadPdf(check: SafetyCheck, chain: SafetyCheck[]) {
  // Loaded on demand: the PDF library is large and only needed at the end.
  const { buildSafetyCheckPdf, safetyCheckFilename } = await import('../../pdf/safetyCheckPdf')
  buildSafetyCheckPdf(check, chain).save(safetyCheckFilename(check))
}

export function SafetyCheckPage() {
  const { id } = useParams()
  const repo = useRepository()
  const fleetState = useFleet()
  const [all, setAll] = useState<SafetyCheck[]>()
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    repo.listSafetyChecks().then(setAll, setError)
  }, [repo, id])

  const check = all?.find((c) => c.id === id)
  if (error) return <ErrorNotice error={error} />
  if (all && !check)
    return (
      <p>
        That safety check doesn't exist. <Link to="/safety">Back to safety checks</Link>
      </p>
    )
  if (!check || !all || fleetState.status !== 'ready') return <p className="meta">Loading…</p>
  return <SafetyCheckForm key={check.id} initial={check} all={all} fleet={fleetState.fleet} />
}

function SafetyCheckForm({ initial, all, fleet }: { initial: SafetyCheck; all: SafetyCheck[]; fleet: Fleet }) {
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
  const toggle = (key: string) =>
    update((c) => {
      const results = { ...c.results }
      if (results[key]) delete results[key]
      else results[key] = { checkedAt: new Date().toISOString() }
      return { ...c, results }
    })

  const chain = revisionChain(check, all)
  const previous = chain.at(-2)
  const amendment = all.find((c) => c.amendsId === check.id)
  const groups = buildChecklist(check)
  const progress = checkProgress(check)
  const problems = trainProblems(check)
  const signOff = signOffState(check)
  const changes = previous ? describeTrainChanges(previous, check) : []
  const photoOf = (vehicleId: string | null) =>
    fleet.locomotives.find((l) => l.id === vehicleId)?.photo ?? fleet.carriages.find((c) => c.id === vehicleId)?.photo ?? null
  const pdf = (c: SafetyCheck) => downloadPdf(c, revisionChain(c, [...all.filter((x) => x.id !== c.id), c])).catch(setPdfError)

  async function complete() {
    if (!signOff.canComplete) return
    update((c) => pruneResults({ ...c, completedAt: new Date().toISOString() }))
    await pdf(latest.current)
  }

  async function amend() {
    const next = amendSafetyCheck(check, newId('check'))
    await repo.saveSafetyCheck(next)
    navigate(`/safety/${next.id}`)
  }

  async function discard() {
    const what = check.revision > 1 ? 'this amendment' : 'this safety check'
    if (!confirm(`Discard ${what}? Everything entered in it will be lost.`)) return
    await repo.deleteSafetyCheck(check.id)
    navigate(previous ? `/safety/${previous.id}` : '/safety')
  }

  return (
    <div className="form safety-check">
      <div>
        <Link className="back-link" to="/safety">
          ← Safety checks
        </Link>
        <h1>
          Safety check: {formatDate(check.date)} {check.revision > 1 && <span className="badge warn">Revision {check.revision}</span>}
        </h1>
      </div>

      <div className="progress-bar" aria-live="polite">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
        </div>
        <span>
          {progress.done}/{progress.total} checked
        </span>
      </div>

      {readOnly && (
        <div className={`notice ${check.outcome === 'cancelled' ? 'error' : 'ok'} completed-banner`}>
          <span>
            {check.outcome === 'cancelled' ? 'Railway not operating. ' : ''}
            Signed off {formatDateTime(check.completedAt!)} by {check.managerName}.
          </span>
          <span className="actions">
            <button type="button" className="btn primary" onClick={() => pdf(check)}>
              Download PDF
            </button>
            {amendment ? (
              <Link className="btn" to={`/safety/${amendment.id}`}>
                {amendment.completedAt ? `See revision ${amendment.revision}` : 'Continue amendment'}
              </Link>
            ) : (
              <button type="button" className="btn" onClick={amend}>
                Amend
              </button>
            )}
          </span>
        </div>
      )}
      {amendment?.completedAt && (
        <div className="notice warning">
          This revision has been replaced by <Link to={`/safety/${amendment.id}`}>revision {amendment.revision}</Link>.
        </div>
      )}
      <ErrorNotice error={pdfError} />
      {saveError != null && <ErrorNotice error={new Error(`Couldn't save: ${saveError instanceof Error ? saveError.message : saveError}`)} />}

      {previous && (
        <section className="card form amendment-card">
          <h2>Amending revision {previous.revision}</h2>
          <p className="meta">
            Revision {previous.revision} was signed off {previous.completedAt && formatDateTime(previous.completedAt)} by {previous.managerName}. Everything
            ticked then is carried over. Change the trains below and check any new vehicles.
          </p>
          <Field label="Reason for amendment" hint="e.g. DXR broke down, swapped for DG">
            <input
              type="text"
              value={check.amendmentReason}
              readOnly={readOnly}
              onChange={(e) => update((c) => ({ ...c, amendmentReason: e.target.value }))}
            />
          </Field>
          <div>
            <strong>Changes to the trains:</strong>{' '}
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
        <h2>1. Trains running</h2>
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
        <p className="meta">Tick each item once it has been checked and is OK. If a vehicle can't be fixed, swap it out above.</p>
        {groups
          .filter((g) => g.kind === 'track')
          .map((g) => (
            <CheckGroupCard key={g.title} group={g} results={check.results} onToggle={toggle} readOnly={readOnly} />
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
                  onToggle={toggle}
                  readOnly={readOnly}
                />
              )
            })}
          {groups.every((g) => g.trainIndex !== i) && <p className="meta">Choose a locomotive and carriages above.</p>}
        </section>
      ))}

      <section className="form">
        <h2>{3 + check.trains.length}. Sign-off</h2>
        <div className="field" role="radiogroup" aria-label="Outcome">
          <span>Outcome</span>
          <div className="outcome-options">
            {(
              [
                ['operate', 'Ready to operate', 'All checks done'],
                ['cancelled', "Can't operate today", 'Records why the railway is not running'],
              ] as [Outcome, string, string][]
            ).map(([value, label, hint]) => (
              <label key={value} className={`outcome-option ${check.outcome === value ? `selected ${value}` : ''}`}>
                <input
                  type="radio"
                  name="outcome"
                  value={value}
                  checked={check.outcome === value}
                  disabled={readOnly}
                  onChange={() => update((c) => ({ ...c, outcome: value }))}
                />
                <span>
                  <strong>{label}</strong>
                  <span className="meta">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        {check.outcome === 'cancelled' && (
          <Field label="Why can't the railway operate?">
            <textarea value={check.cancelReason} readOnly={readOnly} onChange={(e) => update((c) => ({ ...c, cancelReason: e.target.value }))} />
          </Field>
        )}
        <Field label="General notes" hint="optional: weather, repairs made, anything else">
          <textarea value={check.notes} readOnly={readOnly} onChange={(e) => update((c) => ({ ...c, notes: e.target.value }))} />
        </Field>
        <Field label="Shift manager">
          <input
            type="text"
            value={check.managerName}
            readOnly={readOnly}
            autoComplete="name"
            onChange={(e) => update((c) => ({ ...c, managerName: e.target.value }))}
          />
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
            <div className="actions">
              <button type="button" className="btn primary" disabled={!signOff.canComplete} onClick={complete}>
                {check.outcome === 'cancelled' ? 'Sign off as not operating and download PDF' : 'Sign off and download PDF'}
              </button>
              <span className="spacer" />
              <button type="button" className="btn danger" onClick={discard}>
                {check.revision > 1 ? 'Discard amendment' : 'Discard check'}
              </button>
            </div>
          </>
        )}
      </section>

      {chain.length > 1 && (
        <section className="form">
          <h2>Revisions</h2>
          <ol className="set-list">
            {chain.map((c) => (
              <li key={c.id}>
                <Link className="set-row history-row" to={`/safety/${c.id}`} aria-current={c.id === check.id ? 'page' : undefined}>
                  <span className="pos">{c.revision}</span>
                  <div className="info">
                    <div className="code">{c.revision === 1 ? 'Original check' : c.amendmentReason || 'Amendment'}</div>
                    <div className="meta">{c.completedAt ? `Signed off ${formatDateTime(c.completedAt)} by ${c.managerName}` : 'In progress'}</div>
                  </div>
                  {c.id === check.id && <span className="badge">Viewing</span>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
