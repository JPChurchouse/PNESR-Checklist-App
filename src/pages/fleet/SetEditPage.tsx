import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { hasErrors, MAX_SET_LENGTH, validateSet } from '../../domain/sets'
import type { Carriage, CarriageSet } from '../../domain/types'
import { newId } from '../../lib/ids'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice, Field, Photo, SpecialtyBadge } from '../../ui/components'
import { liveryName, useFleetData } from './fleetData'
import { Consist } from './SetsPage'

/** Driver carriages go to the front, guard carriages to the back, anything else just in front of the guard. */
function insertCarriage(ids: string[], car: Carriage, byId: Map<string, Carriage>): string[] {
  if (car.specialty === 'driver') return [car.id, ...ids]
  if (car.specialty === 'guard') return [...ids, car.id]
  const lastIsGuard = byId.get(ids[ids.length - 1])?.specialty === 'guard'
  return lastIsGuard ? [...ids.slice(0, -1), car.id, ids[ids.length - 1]] : [...ids, car.id]
}

export function SetEditPage() {
  const { id } = useParams()
  const fleet = useFleetData()
  const repo = useRepository()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const existing = fleet.sets.find((s) => s.id === id)
  const [draft, setDraft] = useState<CarriageSet | undefined>(() =>
    isNew ? { id: newId('set'), name: '', carriageIds: [] } : existing && structuredClone(existing),
  )
  const [error, setError] = useState<unknown>(null)

  if (!draft) return <p>That set doesn't exist. <Link to="..">Back to carriage sets</Link></p>

  const byId = new Map(fleet.carriages.map((c) => [c.id, c]))
  const issues = validateSet(draft, fleet.carriages, fleet.sets)
  const available = fleet.carriages.filter((c) => c.specialty !== 'crew' && !draft.carriageIds.includes(c.id))
  const setIds = (carriageIds: string[]) => setDraft({ ...draft, carriageIds })

  function move(index: number, by: number) {
    const ids = [...draft!.carriageIds]
    ;[ids[index], ids[index + by]] = [ids[index + by], ids[index]]
    setIds(ids)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const name = draft!.name.trim()
    if (!name) return setError(new Error('Give the set a name.'))
    if (fleet.sets.some((s) => s.id !== draft!.id && s.name.toLowerCase() === name.toLowerCase()))
      return setError(new Error(`There is already a set called "${name}".`))
    try {
      await repo.saveSet({ ...draft!, name })
      navigate('..')
    } catch (err) {
      setError(err)
    }
  }

  async function remove() {
    if (!confirm(`Delete set "${draft!.name}"? The carriages themselves are kept.`)) return
    await repo.deleteSet(draft!.id)
    navigate('..')
  }

  return (
    <form className="form" onSubmit={save}>
      <div>
        <Link className="back-link" to="..">
          ← Carriage sets
        </Link>
        <h1>{isNew ? 'New carriage set' : `Set ${existing!.name}`}</h1>
      </div>
      <Field label="Set name">
        <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
      </Field>

      <div className="field">
        <span>Carriages, front to back</span>
        <Consist carriages={draft.carriageIds.map((cid) => byId.get(cid))} />
        <ol className="set-list">
          {draft.carriageIds.map((cid, i) => {
            const car = byId.get(cid)
            return (
              <li key={cid} className="set-row">
                <span className="pos">{i + 1}</span>
                <Photo photo={car?.photo ?? null} alt="" className="thumb" />
                <div className="info">
                  <div>
                    <span className="code">{car?.code ?? 'Missing carriage'}</span> {car && <SpecialtyBadge specialty={car.specialty} />}
                  </div>
                  {car && <div className="meta">{liveryName(fleet, car.liveryId)}</div>}
                </div>
                <div className="buttons">
                  <button type="button" className="btn icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${car?.code} forward`}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn icon"
                    onClick={() => move(i, 1)}
                    disabled={i === draft.carriageIds.length - 1}
                    aria-label={`Move ${car?.code} back`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn icon danger"
                    onClick={() => setIds(draft.carriageIds.filter((x) => x !== cid))}
                    aria-label={`Remove ${car?.code}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {draft.carriageIds.length < MAX_SET_LENGTH && (
        <Field label="Add a carriage">
          <select
            value=""
            onChange={(e) => {
              const car = byId.get(e.target.value)
              if (car) setIds(insertCarriage(draft.carriageIds, car, byId))
            }}
          >
            <option value="">Choose a carriage…</option>
            {available.map((c) => {
              const otherSet = fleet.sets.find((s) => s.id !== draft.id && s.carriageIds.includes(c.id))
              return (
                <option key={c.id} value={c.id}>
                  {c.code}
                  {c.specialty !== 'standard' && ` (${c.specialty})`}
                  {otherSet && `, in set ${otherSet.name}`}
                  {!c.inService && ', out of service'}
                </option>
              )
            })}
          </select>
        </Field>
      )}

      {issues.length > 0 && (
        <div className={`notice ${hasErrors(issues) ? 'error' : 'warning'}`}>
          <ul>
            {issues.map((issue) => (
              <li key={issue.message}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}
      <ErrorNotice error={error} />

      <div className="actions">
        <button type="submit" className="btn primary" disabled={hasErrors(issues)}>
          Save
        </button>
        <Link className="btn" to="..">
          Cancel
        </Link>
        <span className="spacer" />
        {!isNew && (
          <button type="button" className="btn danger" onClick={remove}>
            Delete set
          </button>
        )}
      </div>
    </form>
  )
}
