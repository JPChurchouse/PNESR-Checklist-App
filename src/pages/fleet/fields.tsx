import { useState } from 'react'
import type { Livery, Photo as PhotoValue } from '../../domain/types'
import { newId } from '../../lib/ids'
import { resizePhoto } from '../../lib/photos'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice, Field, Photo } from '../../ui/components'

const NEW = '__new'

/** Livery dropdown with an inline "new livery" option, so a livery can be added without leaving the form. */
export function LiveryPicker({
  liveries,
  value,
  onChange,
}: {
  liveries: Livery[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  const repo = useRepository()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  async function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    const existing = liveries.find((l) => l.name.toLowerCase() === trimmed.toLowerCase())
    const id = existing?.id ?? newId('livery')
    if (!existing) await repo.saveLivery({ id, name: trimmed })
    onChange(id)
    setAdding(false)
    setName('')
  }

  if (adding)
    return (
      <Field label="New livery name">
        <div className="livery-row">
          <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          <button type="button" className="btn primary" onClick={add}>
            Add
          </button>
          <button type="button" className="btn" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      </Field>
    )

  return (
    <Field label="Livery">
      <select
        value={value ?? ''}
        onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange(e.target.value || null))}
      >
        <option value="">No livery</option>
        {liveries.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
        <option value={NEW}>+ New livery…</option>
      </select>
    </Field>
  )
}

export function PhotoPicker({ photo, alt, onChange }: { photo: PhotoValue; alt: string; onChange: (photo: PhotoValue) => void }) {
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange(await resizePhoto(file))
    } catch {
      setError(new Error("That file couldn't be read as a photo."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field">
      <span>Reference photo</span>
      <div className="photo-field">
        <div className="preview">
          <Photo photo={photo} alt={alt} />
        </div>
        <div className="actions">
          <label className="btn">
            {busy ? 'Processing…' : photo ? 'Replace photo' : 'Add photo'}
            <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {photo && (
            <button type="button" className="btn danger" onClick={() => onChange(null)}>
              Remove photo
            </button>
          )}
        </div>
      </div>
      <ErrorNotice error={error} />
    </div>
  )
}
