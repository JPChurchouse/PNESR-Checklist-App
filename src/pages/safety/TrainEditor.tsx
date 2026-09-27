import { insertCarriage, MAX_SET_LENGTH } from '../../domain/sets'
import { snapshotCarriage, snapshotLoco, type TrainCheck } from '../../domain/safetyCheck'
import type { Fleet } from '../../domain/types'
import { Field, Photo, SpecialtyBadge } from '../../ui/components'

/**
 * Picks the loco and carriages for one train. Choosing a set fills in its carriages, which
 * can then be swapped for today only without changing the set itself.
 */
export function TrainEditor({
  index,
  train,
  fleet,
  usedIds,
  onChange,
  onRemove,
  readOnly,
}: {
  index: number
  train: TrainCheck
  fleet: Fleet
  /** Vehicles already in other trains today. */
  usedIds: Set<string>
  onChange: (train: TrainCheck) => void
  onRemove: () => void
  readOnly: boolean
}) {
  const fleetLoco = train.loco && fleet.locomotives.find((l) => l.id === train.loco!.id)
  const inThisTrain = new Set(train.carriages.map((c) => c.id))
  const available = fleet.carriages.filter((c) => c.specialty !== 'crew' && c.inService && !usedIds.has(c.id) && !inThisTrain.has(c.id))

  function chooseSet(setId: string) {
    const set = fleet.sets.find((s) => s.id === setId)
    if (!set) return onChange({ ...train, setName: null })
    const carriages = set.carriageIds.flatMap((id) => {
      const car = fleet.carriages.find((c) => c.id === id)
      return car ? [snapshotCarriage(fleet, car)] : []
    })
    onChange({ ...train, setName: set.name, carriages })
  }

  const setUnavailable = (carriageIds: string[]) =>
    carriageIds.some((id) => usedIds.has(id) || fleet.carriages.find((c) => c.id === id)?.inService === false)

  const currentSetId = fleet.sets.find((s) => s.name === train.setName)?.id ?? ''

  return (
    <div className="card train-card">
      <div className="title-row">
        <h3>Train {index + 1}</h3>
        {!readOnly && (
          <button type="button" className="btn danger" onClick={onRemove}>
            Remove train
          </button>
        )}
      </div>

      <div className="form-grid">
        <Field label="Locomotive">
          <select
            value={train.loco?.id ?? ''}
            disabled={readOnly}
            onChange={(e) => {
              const loco = fleet.locomotives.find((l) => l.id === e.target.value)
              onChange({ ...train, loco: loco ? snapshotLoco(fleet, loco) : null })
            }}
          >
            <option value="">Choose a locomotive…</option>
            {fleet.locomotives.map((l) => (
              <option key={l.id} value={l.id} disabled={!l.inService || usedIds.has(l.id)}>
                {l.code}
                {!l.inService ? ' (out of service)' : usedIds.has(l.id) ? ' (in another train)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Carriage set">
          <select value={currentSetId} disabled={readOnly} onChange={(e) => chooseSet(e.target.value)}>
            <option value="">{train.carriages.length ? 'Custom' : 'Choose a set…'}</option>
            {fleet.sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {setUnavailable(s.carriageIds) ? ' (some carriages unavailable)' : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {fleetLoco?.notes && (
        <div className="notice warning">
          <strong>{fleetLoco.code} notes:</strong> {fleetLoco.notes}
        </div>
      )}

      {train.carriages.length > 0 && (
        <ol className="set-list">
          {train.carriages.map((car, i) => {
            const fleetCar = fleet.carriages.find((c) => c.id === car.id)
            const clash = usedIds.has(car.id)
            const outOfService = fleetCar && !fleetCar.inService
            return (
              <li key={car.id} className="set-row">
                <span className="pos">{i + 1}</span>
                <Photo photo={fleetCar?.photo ?? null} alt="" className="thumb" />
                <div className="info">
                  <div>
                    <span className="code">{car.code}</span> <SpecialtyBadge specialty={car.specialty} />
                    {clash && <span className="badge danger">In another train</span>}
                    {outOfService && <span className="badge danger">Out of service</span>}
                  </div>
                  <div className="meta">{car.livery}</div>
                </div>
                {!readOnly && (
                  <div className="buttons">
                    <select
                      aria-label={`Swap carriage ${car.code}`}
                      className="swap-select"
                      value=""
                      onChange={(e) => {
                        const replacement = fleet.carriages.find((c) => c.id === e.target.value)
                        if (!replacement) return
                        const carriages = [...train.carriages]
                        carriages[i] = snapshotCarriage(fleet, replacement)
                        onChange({ ...train, carriages, setName: null })
                      }}
                    >
                      <option value="">Swap…</option>
                      {available.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                          {c.specialty !== 'standard' ? ` (${c.specialty})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn icon danger"
                      aria-label={`Remove ${car.code} from train`}
                      onClick={() => onChange({ ...train, carriages: train.carriages.filter((c) => c.id !== car.id), setName: null })}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {!readOnly && train.carriages.length > 0 && train.carriages.length < MAX_SET_LENGTH && (
        <Field label="Add a carriage">
          <select
            value=""
            onChange={(e) => {
              const car = fleet.carriages.find((c) => c.id === e.target.value)
              if (car) onChange({ ...train, carriages: insertCarriage(train.carriages, snapshotCarriage(fleet, car)), setName: null })
            }}
          >
            <option value="">Choose a carriage…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
                {c.specialty !== 'standard' ? ` (${c.specialty})` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  )
}
