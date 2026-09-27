// Staff come from the club's Google Sheet, exported as CSV. Only what the app needs is kept:
// names, phone numbers (for contacting the shift later) and qualifications. Addresses, emails,
// dates of birth and membership details in the sheet are ignored.

export interface StaffMember {
  id: string
  firstName: string
  surname: string
  /** How they appear on the roster, e.g. "Jamie C (CD)". */
  displayName: string
  mobile: string
  landLine: string
  /** Qualified shift manager ("DOS" in the sheet). */
  manager: boolean
  cashier: boolean
  guard: boolean
  driver: boolean
  /** Locomotive codes they may drive with passengers ("Class A"). */
  classA: string[]
}

export type StaffRole = 'manager' | 'cashier' | 'guard' | 'driver'

export const ROLE_LABELS: Record<StaffRole, string> = {
  manager: 'Manager',
  cashier: 'Cashier',
  guard: 'Guard',
  driver: 'Driver',
}

/** Splits CSV text into rows of cells, handling quoted cells with commas, quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

const yes = (v: string | undefined) => /^(y|yes|true|1)$/i.test((v ?? '').trim())

export interface StaffImport {
  staff: StaffMember[]
  /** Rows that were skipped, and why. */
  skipped: string[]
}

/**
 * Reads the sheet's CSV export. Columns are found by their heading, so their order doesn't
 * matter and extra columns are ignored.
 */
export function importStaffCsv(text: string, makeId: () => string): StaffImport {
  const rows = parseCsv(text)
  const headerIndex = rows.findIndex((r) => r.some((c) => c.trim() === 'Name') && r.some((c) => c.trim() === 'Surname'))
  if (headerIndex === -1) throw new Error('This file doesn’t look like the staff list: no "Name" and "Surname" columns were found.')
  const header = rows[headerIndex].map((h) => h.trim().toLowerCase())
  const col = (...names: string[]) => names.map((n) => header.indexOf(n.toLowerCase())).find((i) => i >= 0) ?? -1
  const cols = {
    first: col('Name'),
    surname: col('Surname'),
    mobile: col('Mobile'),
    landLine: col('Land Line'),
    manager: col('DOS', 'Manager'),
    cashier: col('Cashier'),
    guard: col('Guard'),
    driver: col('Driver'),
    classA: col('Class A'),
    display: col('Roster Entry'),
  }

  const staff: StaffMember[] = []
  const skipped: string[] = []
  for (const [n, row] of rows.slice(headerIndex + 1).entries()) {
    const get = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')
    // A blank line ends the table; anything after it (notes, other tables) is ignored.
    if (row.every((c) => !c.trim())) {
      if (staff.length || skipped.length) break
      continue
    }
    const firstName = get(cols.first)
    const surname = get(cols.surname)
    if (!firstName || !surname) {
      skipped.push(`Row ${headerIndex + n + 2}: needs both a first name and a surname.`)
      continue
    }
    const driver = yes(get(cols.driver))
    staff.push({
      id: makeId(),
      firstName,
      surname,
      displayName: get(cols.display) || `${firstName} ${surname[0]}`,
      mobile: get(cols.mobile),
      landLine: get(cols.landLine),
      manager: yes(get(cols.manager)),
      cashier: yes(get(cols.cashier)),
      // Drivers are always trained as guards first.
      guard: driver || yes(get(cols.guard)),
      driver,
      classA: get(cols.classA)
        .split(/[,;/]/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    })
  }
  return { staff, skipped }
}

/** "manager, cashier, driver" (guard is left out for drivers, who are always guards too). */
export const rolesOf = (s: StaffMember) =>
  (['manager', 'cashier', 'driver', 'guard'] as const)
    .filter((r) => s[r] && !(r === 'guard' && s.driver))
    .map((r) => ROLE_LABELS[r].toLowerCase())
    .join(', ') || 'no roles'

export const hasRole = (s: StaffMember, role: StaffRole) => s[role]

export const fullName = (s: Pick<StaffMember, 'firstName' | 'surname'>) => `${s.firstName} ${s.surname}`

/** Finds a staff member by what was typed in a name box (full name or roster name, any case). */
export function findStaff(staff: StaffMember[], typed: string): StaffMember | undefined {
  const t = typed.trim().toLowerCase()
  if (!t) return undefined
  return staff.find((s) => fullName(s).toLowerCase() === t || s.displayName.toLowerCase() === t)
}

/** Why this person shouldn't drive this loco with passengers, or null if they can. */
export function driverProblem(person: StaffMember | undefined, locoCode: string | undefined): string | null {
  if (!person) return null
  if (!person.driver) return `${fullName(person)} isn't a qualified driver.`
  if (locoCode && !person.classA.includes(locoCode.toUpperCase())) return `${fullName(person)} isn't Class A qualified on ${locoCode}.`
  return null
}

export function managerProblem(person: StaffMember | undefined): string | null {
  if (!person) return null
  return person.manager ? null : `${fullName(person)} isn't a qualified manager.`
}

/** Warnings for names in a comma-separated cashier list who are on the staff list but not cashiers. */
export function cashierProblems(staff: StaffMember[], names: string): string[] {
  return names
    .split(',')
    .map((n) => findStaff(staff, n))
    .filter((p): p is StaffMember => Boolean(p) && !p!.cashier)
    .map((p) => `${fullName(p)} isn't a qualified cashier.`)
}

export function guardProblem(person: StaffMember | undefined): string | null {
  if (!person) return null
  return person.guard ? null : `${fullName(person)} isn't a qualified guard.`
}
