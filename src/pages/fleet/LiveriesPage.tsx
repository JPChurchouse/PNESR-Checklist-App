import { useState } from 'react'
import type { Livery } from '../../domain/types'
import { newId } from '../../lib/ids'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice } from '../../ui/components'
import { useFleetData } from './fleetData'

function LiveryRow({ livery, usedBy }: { livery: Livery; usedBy: string[] }) {
  const repo = useRepository()
  const [name, setName] = useState(livery.name)
  const [error, setError] = useState<unknown>(null)
  const changed = name.trim() !== livery.name

  async function rename() {
    if (!name.trim()) return setName(livery.name)
    await repo.saveLivery({ ...livery, name: name.trim() })
  }

  async function remove() {
    setError(null)
    try {
      await repo.deleteLivery(livery.id)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <li>
      <div className="livery-row">
        <input type="text" aria-label="Livery name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename()} />
        <span className="count" title={usedBy.join(', ')}>
          {usedBy.length ? `Used by ${usedBy.join(', ')}` : 'Unused'}
        </span>
        {changed ? (
          <button type="button" className="btn primary" onClick={rename}>
            Save
          </button>
        ) : (
          <button type="button" className="btn danger" onClick={remove} disabled={usedBy.length > 0} title={usedBy.length ? 'Still in use' : undefined}>
            Delete
          </button>
        )}
      </div>
      <ErrorNotice error={error} />
    </li>
  )
}

export function LiveriesPage() {
  const fleet = useFleetData()
  const repo = useRepository()
  const [newName, setNewName] = useState('')

  const usedBy = (id: string) => [
    ...fleet.locomotives.filter((l) => l.liveryId === id).map((l) => l.code),
    ...fleet.carriages.filter((c) => c.liveryId === id).map((c) => c.code),
  ]

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await repo.saveLivery({ id: newId('livery'), name: newName.trim() })
    setNewName('')
  }

  return (
    <>
      <div className="page-head">
        <h1>Liveries</h1>
      </div>
      <p className="meta">Renaming a livery here updates every locomotive and carriage that uses it.</p>
      <ul className="set-list">
        {fleet.liveries.map((l) => (
          <LiveryRow key={l.id} livery={l} usedBy={usedBy(l.id)} />
        ))}
      </ul>
      <form className="livery-row" onSubmit={add} style={{ marginTop: '1rem' }}>
        <input type="text" placeholder="New livery name" aria-label="New livery name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="btn primary">
          Add livery
        </button>
      </form>
    </>
  )
}
