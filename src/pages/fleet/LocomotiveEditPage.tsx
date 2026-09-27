import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Locomotive } from '../../domain/types'
import { newId } from '../../lib/ids'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice, Field } from '../../ui/components'
import { LiveryPicker, PhotoPicker } from './fields'
import { useFleetData } from './fleetData'

const blank = (): Locomotive => ({
  id: newId('loco'),
  code: '',
  year: null,
  liveryId: null,
  fuel: 'Diesel',
  inService: true,
  notes: '',
  photo: null,
})

export function LocomotiveEditPage() {
  const { id } = useParams()
  const fleet = useFleetData()
  const repo = useRepository()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const existing = fleet.locomotives.find((l) => l.id === id)
  const [draft, setDraft] = useState<Locomotive | undefined>(() => (isNew ? blank() : existing && { ...existing }))
  const [error, setError] = useState<unknown>(null)

  if (!draft) return <p>That locomotive doesn't exist. <Link to="..">Back to locomotives</Link></p>

  const set = <K extends keyof Locomotive>(key: K, value: Locomotive[K]) => setDraft({ ...draft, [key]: value })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const code = draft!.code.trim().toUpperCase()
    if (!code) return setError(new Error('Enter the locomotive ID.'))
    if (fleet.locomotives.some((l) => l.id !== draft!.id && l.code.toUpperCase() === code))
      return setError(new Error(`There is already a locomotive ${code}.`))
    try {
      await repo.saveLocomotive({ ...draft!, code, fuel: draft!.fuel.trim(), notes: draft!.notes.trim() })
      navigate('..')
    } catch (err) {
      setError(err)
    }
  }

  async function remove() {
    if (!confirm(`Delete locomotive ${draft!.code}? This can't be undone.`)) return
    try {
      await repo.deleteLocomotive(draft!.id)
      navigate('..')
    } catch (err) {
      setError(err)
    }
  }

  return (
    <form className="form" onSubmit={save}>
      <div>
        <Link className="back-link" to="..">
          ← Locomotives
        </Link>
        <h1>{isNew ? 'New locomotive' : `Locomotive ${existing!.code}`}</h1>
      </div>
      <div className="form-grid">
        <Field label="ID">
          <input type="text" value={draft.code} onChange={(e) => set('code', e.target.value)} autoCapitalize="characters" required />
        </Field>
        <Field label="Year built">
          <input
            type="number"
            inputMode="numeric"
            value={draft.year ?? ''}
            onChange={(e) => set('year', e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
        <LiveryPicker liveries={fleet.liveries} value={draft.liveryId} onChange={(v) => set('liveryId', v)} />
        <Field label="Fuel">
          <input type="text" value={draft.fuel} onChange={(e) => set('fuel', e.target.value)} />
        </Field>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={draft.inService} onChange={(e) => set('inService', e.target.checked)} />
        In service
      </label>
      <Field label="Notes" hint="special operating conditions, faults, etc.">
        <textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <PhotoPicker photo={draft.photo} alt={`Locomotive ${draft.code}`} onChange={(p) => set('photo', p)} />
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
            Delete locomotive
          </button>
        )}
      </div>
    </form>
  )
}
