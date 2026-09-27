import { Link } from 'react-router-dom'
import { validateSet } from '../../domain/sets'
import type { Carriage } from '../../domain/types'
import { useFleetData } from './fleetData'

export function Consist({ carriages }: { carriages: (Carriage | undefined)[] }) {
  return (
    <div className="consist" aria-label="Carriages from front to back">
      <span className="loco">Loco ▸</span>
      {carriages.map((c, i) => (
        <span key={i} className={`car ${c?.specialty ?? ''}`} title={c ? undefined : 'Missing carriage'}>
          {c?.code ?? '?'}
        </span>
      ))}
    </div>
  )
}

export function SetsPage() {
  const fleet = useFleetData()
  const byId = new Map(fleet.carriages.map((c) => [c.id, c]))
  return (
    <>
      <div className="page-head">
        <h1>Carriage sets</h1>
        <Link className="btn primary" to="new">
          Add set
        </Link>
      </div>
      <p className="meta">
        Driver carriage at the front, guard carriage at the back, and up to four carriages between. Highlighted
        carriages are driver and guard carriages.
      </p>
      <div className="grid">
        {fleet.sets.map((set) => {
          const issues = validateSet(set, fleet.carriages, fleet.sets)
          const errors = issues.filter((i) => i.level === 'error').length
          return (
            <Link key={set.id} to={set.id} className="card vehicle-card">
              <div className="body">
                <div className="title-row">
                  <span className="code">{set.name}</span>
                  {errors ? (
                    <span className="badge danger">Needs fixing</span>
                  ) : issues.length ? (
                    <span className="badge warn">
                      {issues.length} note{issues.length > 1 && 's'}
                    </span>
                  ) : (
                    <span className="badge ok">{set.carriageIds.length} carriages</span>
                  )}
                </div>
                <Consist carriages={set.carriageIds.map((id) => byId.get(id))} />
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
