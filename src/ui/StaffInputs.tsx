import { useId, type InputHTMLAttributes } from 'react'
import { fullName, hasRole, ROLE_LABELS, rolesOf, type StaffMember, type StaffRole } from '../domain/staff'

/**
 * Name box that suggests qualified staff from the imported list. Any name can still be typed,
 * e.g. for a visitor or before the list has been imported. `problem` shows a warning under it.
 */
export function StaffNameInput({
  staff,
  role,
  value,
  onChange,
  problem,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'> & {
  staff: StaffMember[]
  role: StaffRole
  value: string
  onChange: (name: string) => void
  problem?: string | null
}) {
  const listId = useId()
  const qualified = staff.filter((s) => hasRole(s, role))
  return (
    <span className="number-input">
      <input {...rest} type="text" list={listId} value={value} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
      <datalist id={listId}>
        {qualified.map((s) => (
          <option key={s.id} value={fullName(s)}>
            {s.displayName}
          </option>
        ))}
      </datalist>
      {problem && <span className="input-warning">⚠ {problem}</span>}
    </span>
  )
}

/** "Add from staff list…" dropdown for building up a list of names. */
export function AddStaffSelect({
  staff,
  role,
  exclude = [],
  onAdd,
  disabled,
}: {
  staff: StaffMember[]
  /** Only offer people with this qualification; all staff if omitted. */
  role?: StaffRole
  /** Names already added, so they aren't offered again. */
  exclude?: string[]
  onAdd: (person: StaffMember) => void
  disabled?: boolean
}) {
  if (!staff.length) return null
  const taken = new Set(exclude.map((n) => n.trim().toLowerCase()))
  const options = staff.filter((s) => (!role || hasRole(s, role)) && !taken.has(fullName(s).toLowerCase()) && !taken.has(s.displayName.toLowerCase()))
  return (
    <select
      className="add-staff"
      value=""
      disabled={disabled || !options.length}
      aria-label={`Add ${role ? ROLE_LABELS[role].toLowerCase() : 'staff member'} from the staff list`}
      onChange={(e) => {
        const person = staff.find((s) => s.id === e.target.value)
        if (person) onAdd(person)
      }}
    >
      <option value="">{options.length ? `+ Add ${role ? ROLE_LABELS[role].toLowerCase() : 'from staff list'}…` : 'Everyone on the list is added'}</option>
      {options.map((s) => (
        <option key={s.id} value={s.id}>
          {fullName(s)} ({rolesOf(s)})
        </option>
      ))}
    </select>
  )
}
