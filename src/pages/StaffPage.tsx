import { useEffect, useState } from 'react'
import { fullName, importStaffCsv, ROLE_LABELS, type StaffImport, type StaffMember, type StaffRole } from '../domain/staff'
import { newId } from '../lib/ids'
import { useRepository } from '../storage/hooks'
import { ErrorNotice } from '../ui/components'

const ROLES = Object.keys(ROLE_LABELS) as StaffRole[]

function RoleBadges({ person }: { person: StaffMember }) {
  return (
    <span className="actions">
      {ROLES.filter((r) => person[r]).map((r) => (
        <span key={r} className="badge role">
          {ROLE_LABELS[r]}
        </span>
      ))}
    </span>
  )
}

export function StaffPage() {
  const repo = useRepository()
  const [staff, setStaff] = useState<StaffMember[]>()
  const [preview, setPreview] = useState<StaffImport>()
  const [filter, setFilter] = useState<StaffRole | 'all'>('all')
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    repo.listStaff().then(setStaff, setError)
  }, [repo])

  async function readFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      setPreview(importStaffCsv(await file.text(), () => newId('staff')))
    } catch (err) {
      setError(err)
    }
  }

  async function confirmImport() {
    try {
      await repo.replaceStaff(preview!.staff)
      setStaff(await repo.listStaff())
      setPreview(undefined)
    } catch (err) {
      setError(err)
    }
  }

  const count = (list: StaffMember[], role: StaffRole) => list.filter((s) => s[role]).length
  const shown = staff?.filter((s) => filter === 'all' || s[filter]) ?? []

  return (
    <div className="form">
      <div className="page-head">
        <h1>Staff</h1>
        <label className="btn primary">
          Import staff list (CSV)
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => (readFile(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
      </div>
      <p className="meta">
        In the club's Google Sheet, choose File → Download → Comma-separated values (.csv), then import that file here. Only names, phone
        numbers and qualifications are kept, on this device only. Addresses, emails and other details are ignored.
      </p>
      <ErrorNotice error={error} />

      {preview && (
        <div className="card form">
          <h2>Import {preview.staff.length} people?</h2>
          <p>
            {ROLES.map((r) => `${count(preview.staff, r)} ${ROLE_LABELS[r].toLowerCase()}${count(preview.staff, r) === 1 ? '' : 's'}`).join(', ')}.
            This replaces the current list{staff?.length ? ` of ${staff.length}` : ''}.
          </p>
          {preview.skipped.length > 0 && (
            <div className="notice warning">
              Skipped:
              <ul>
                {preview.skipped.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="actions">
            <button type="button" className="btn primary" onClick={confirmImport} disabled={!preview.staff.length}>
              Replace staff list
            </button>
            <button type="button" className="btn" onClick={() => setPreview(undefined)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {staff?.length === 0 && !preview && <p>No staff list yet. Until one is imported, names are typed in by hand.</p>}

      {!!staff?.length && (
        <>
          <nav className="tabs" aria-label="Filter by role">
            {(['all', ...ROLES] as const).map((r) => (
              <a
                key={r}
                href="#"
                className={filter === r ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault()
                  setFilter(r)
                }}
              >
                {r === 'all' ? `Everyone (${staff.length})` : `${ROLE_LABELS[r]}s (${count(staff, r)})`}
              </a>
            ))}
          </nav>
          <ul className="set-list">
            {shown.map((s) => (
              <li key={s.id} className="set-row staff-row">
                <div className="info">
                  <div>
                    <span className="code">{fullName(s)}</span> <span className="meta">{s.displayName}</span>
                  </div>
                  <RoleBadges person={s} />
                  {s.classA.length > 0 && <div className="meta">Class A: {s.classA.join(', ')}</div>}
                </div>
                <div className="phones">
                  {s.mobile && <a href={`tel:${s.mobile.replace(/[^\d+]/g, '')}`}>{s.mobile}</a>}
                  {s.landLine && <a href={`tel:${s.landLine.replace(/[^\d+]/g, '')}`}>{s.landLine}</a>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
