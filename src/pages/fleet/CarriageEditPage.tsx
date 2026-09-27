import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SPECIALTY_LABELS, type Carriage, type Specialty } from '../../domain/types'
import { newId } from '../../lib/ids'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice, Field } from '../../ui/components'
import { LiveryPicker, PhotoPicker } from './fields'
import { useFleetData } from './fleetData'

const blank = (): Carriage => ({
  id: newId('car'),
  code: '',
  specialty: 'standard',
  liveryId: null,
  inService: true,
  notes: '',
  photo: null,
})

const SPECIALTY_HINTS: Record<Specialty, string> = {
  standard: '',
  driver: 'Front of the set. Adds a fire extinguisher check.',
  guard: 'Back of the set. Adds extinguisher, tail light, signal button and first aid kit checks.',
  wheelchair: 'Adds removable seat and wheelchair tie-down strap checks.',
  crew: "Not a passenger carriage: can't be put in a set and isn't safety checked.",
}

export function CarriageEditPage() {
  const { id } = useParams()
  const fleet = useFleetData()
  const repo = useRepository()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const existing = fleet.carriages.find((c) => c.id === id)
  const [draft, setDraft] = useState<Carriage | undefined>(() => (isNew ? blank() : existing && { ...existing }))
  const [error, setError] = useState<unknown>(null)

  if (!draft) return <p>That carriage doesn't exist. <Link to="..">Back to carriages</Link></p>

  const set = <K extends keyof Carriage>(key: K, value: Carriage[K]) => setDraft({ ...draft, [key]: value })
  const inSets = fleet.sets.filter((s) => s.carriageIds.includes(draft.id))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const code = draft!.code.trim().toUpperCase()
    if (!code) return setError(new Error('Enter the carriage ID.'))
    if (fleet.carriages.some((c) => c.id !== draft!.id && c.code.toUpperCase() === code))
      return setError(new Error(`There is already a carriage ${code}.`))
    if (draft!.specialty === 'crew' && inSets.length)
      return setError(new Error(`Remove this carriage from set "${inSets[0].name}" before making it crew only.`))
    try {
      await repo.saveCarriage({ ...draft!, code, notes: draft!.notes.trim() })
      navigate('..')
    } catch (err) {
      setError(err)
    }
  }

  async function remove() {
    if (!confirm(`Delete carriage ${draft!.code}? This can't be undone.`)) return
    try {
      await repo.deleteCarriage(draft!.id)
      navigate('..')
    } catch (err) {
      setError(err)
    }
  }

  return (
    <form className="form" onSubmit={save}>
      <div>
        <Link className="back-link" to="..">
          ← Carriages
        </Link>
        <h1>{isNew ? 'New carriage' : `Carriage ${existing!.code}`}</h1>
      </div>
      <div className="form-grid">
        <Field label="ID">
          <input type="text" value={draft.code} onChange={(e) => set('code', e.target.value)} autoCapitalize="characters" required />
        </Field>
        <Field label="Specialty">
          <select value={draft.specialty} onChange={(e) => set('specialty', e.target.value as Specialty)}>
            {Object.entries(SPECIALTY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <LiveryPicker liveries={fleet.liveries} value={draft.liveryId} onChange={(v) => set('liveryId', v)} />
      </div>
      {SPECIALTY_HINTS[draft.specialty] && <p className="meta">{SPECIALTY_HINTS[draft.specialty]}</p>}
      {draft.specialty !== 'crew' && (
        <label className="check-row">
          <input type="checkbox" checked={draft.inService} onChange={(e) => set('inService', e.target.checked)} />
          In service
        </label>
      )}
      <Field label="Notes">
        <textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <PhotoPicker photo={draft.photo} alt={`Carriage ${draft.code}`} onChange={(p) => set('photo', p)} />
      <ErrorNotice error={error} />
      <div className="actions">
        <button type="submit" className="btn primary">
          Save
        </button>
        <Link className="btn" to="..">
          Cancel
        </Link>
        <span className="spacer" />
        {!isNew && (
          <button type="button" className="btn danger" onClick={remove}>
            Delete carriage
          </button>
        )}
      </div>
    </form>
  )
}
