import type { Carriage, Fleet, Locomotive, Specialty } from './types'

export interface CheckItem {
  id: string
  label: string
  /** Extra guidance shown under the label. */
  help?: string
}

export const TRACK_CHECKS: CheckItem[] = [
  { id: 'run-around', label: 'Complete track run-around with a train', help: 'Confirms the track is in working order.' },
  { id: 'signage-crossings', label: 'Operating signage deployed and crossing alarms working' },
  { id: 'radio', label: 'Radio checks' },
]

export const LOCO_CHECKS: CheckItem[] = [
  { id: 'fuel', label: 'Sufficient fuel' },
  { id: 'horn', label: 'Horn operating' },
  { id: 'lights', label: 'Lights operating' },
]

export const CARRIAGE_CHECKS: CheckItem[] = [
  {
    id: 'doors',
    label: 'Doors open and latch correctly',
    help: 'Latches closed, unlatch works, door swings out correctly, latch closes, and door stays latched when pushed.',
  },
  { id: 'coupling', label: 'Mechanical and electrical connections to the vehicle in front are secure' },
]

export const SPECIALTY_CHECKS: Record<Specialty, CheckItem[]> = {
  standard: [],
  crew: [],
  driver: [{ id: 'extinguisher', label: 'Fire extinguisher present' }],
  guard: [
    { id: 'extinguisher', label: 'Fire extinguisher present' },
    { id: 'tail-lights', label: 'Tail lights operating' },
    { id: 'signal-button', label: 'Signal button operating' },
    { id: 'first-aid', label: 'First aid kit present' },
  ],
  wheelchair: [
    { id: 'seats', label: 'Removable seats installed correctly' },
    { id: 'tie-downs', label: 'Wheelchair tie-down straps present and working' },
  ],
}

export const MAX_TRAINS = 3

/** Vehicle details copied into the check, so later fleet edits don't change a completed record. */
export interface VehicleSnapshot {
  id: string
  code: string
  livery: string
}
export interface LocoSnapshot extends VehicleSnapshot {
  notes: string
}
export interface CarriageSnapshot extends VehicleSnapshot {
  specialty: Specialty
}

export interface TrainCheck {
  id: string
  /** Name of the set the train was built from, if any. */
  setName: string | null
  loco: LocoSnapshot | null
  carriages: CarriageSnapshot[]
}

export type CheckStatus = 'pass' | 'fail'

export interface CheckResult {
  status: CheckStatus | null
  note: string
}

export interface SafetyCheck {
  id: string
  /** Local date the check is for, YYYY-MM-DD. */
  date: string
  startedAt: string
  /** ISO timestamp; set once signed off, after which the check is read-only. */
  completedAt: string | null
  trains: TrainCheck[]
  /** Keyed by `resultKey()`. */
  results: Record<string, CheckResult>
  managerName: string
  /** PNG data: URL of the manager's signature. */
  signature: string | null
  notes: string
}

export const resultKey = (scope: 'track' | string, itemId: string) => `${scope}:${itemId}`

export interface ChecklistRow {
  key: string
  item: CheckItem
}

export interface ChecklistGroup {
  /** e.g. "Track", "Loco DXC", "Carriage C (driver)" */
  title: string
  kind: 'track' | 'loco' | 'carriage'
  vehicleId: string | null
  trainIndex: number | null
  rows: ChecklistRow[]
}

export const carriageChecks = (specialty: Specialty) => [...CARRIAGE_CHECKS, ...SPECIALTY_CHECKS[specialty]]

/** Every check that applies to this day's trains, in the order they're done. */
export function buildChecklist(check: Pick<SafetyCheck, 'trains'>): ChecklistGroup[] {
  const groups: ChecklistGroup[] = [
    {
      title: 'Track',
      kind: 'track',
      vehicleId: null,
      trainIndex: null,
      rows: TRACK_CHECKS.map((item) => ({ key: resultKey('track', item.id), item })),
    },
  ]
  check.trains.forEach((train, trainIndex) => {
    if (train.loco) {
      const loco = train.loco
      groups.push({
        title: `Locomotive ${loco.code}`,
        kind: 'loco',
        vehicleId: loco.id,
        trainIndex,
        rows: LOCO_CHECKS.map((item) => ({ key: resultKey(loco.id, item.id), item })),
      })
    }
    for (const car of train.carriages) {
      groups.push({
        title: `Carriage ${car.code}`,
        kind: 'carriage',
        vehicleId: car.id,
        trainIndex,
        rows: carriageChecks(car.specialty).map((item) => ({ key: resultKey(car.id, item.id), item })),
      })
    }
  })
  return groups
}

export interface CheckProgress {
  total: number
  answered: number
  passed: number
  failed: number
  /** Failed checks with no note explaining them. */
  failedWithoutNote: number
}

export function checkProgress(check: Pick<SafetyCheck, 'trains' | 'results'>): CheckProgress {
  const rows = buildChecklist(check).flatMap((g) => g.rows)
  const progress: CheckProgress = { total: rows.length, answered: 0, passed: 0, failed: 0, failedWithoutNote: 0 }
  for (const { key } of rows) {
    const result = check.results[key]
    if (!result?.status) continue
    progress.answered++
    if (result.status === 'pass') progress.passed++
    else {
      progress.failed++
      if (!result.note.trim()) progress.failedWithoutNote++
    }
  }
  return progress
}

/** Problems with the trains themselves (not the checks). */
export function trainProblems(check: Pick<SafetyCheck, 'trains'>): string[] {
  const problems: string[] = []
  if (!check.trains.length) problems.push('Add at least one train.')
  if (check.trains.length > MAX_TRAINS) problems.push(`No more than ${MAX_TRAINS} trains can run at once.`)
  const seen = new Map<string, number>()
  check.trains.forEach((train, i) => {
    const n = i + 1
    if (!train.loco) problems.push(`Train ${n} needs a locomotive.`)
    if (train.carriages.length < 2) problems.push(`Train ${n} needs at least a driver and a guard carriage.`)
    else {
      if (train.carriages[0].specialty !== 'driver') problems.push(`Train ${n}: the first carriage must be a driver carriage.`)
      if (train.carriages.at(-1)!.specialty !== 'guard') problems.push(`Train ${n}: the last carriage must be a guard carriage.`)
    }
    if (train.carriages.length > 6) problems.push(`Train ${n} has more than 6 carriages.`)
    for (const v of [train.loco, ...train.carriages]) {
      if (!v) continue
      if (seen.has(v.id)) problems.push(`${v.code} is in train ${seen.get(v.id)} and train ${n}.`)
      else seen.set(v.id, n)
    }
  })
  return problems
}

export interface SignOffState {
  canComplete: boolean
  reasons: string[]
}

export function signOffState(check: SafetyCheck): SignOffState {
  const reasons = [...trainProblems(check)]
  const p = checkProgress(check)
  if (p.answered < p.total) reasons.push(`${p.total - p.answered} check${p.total - p.answered === 1 ? '' : 's'} still to do.`)
  if (p.failedWithoutNote) reasons.push(`Add a note to ${p.failedWithoutNote === 1 ? 'the failed check' : `each of the ${p.failedWithoutNote} failed checks`}.`)
  if (!check.managerName.trim()) reasons.push("Enter the shift manager's name.")
  if (!check.signature) reasons.push('The shift manager needs to sign.')
  return { canComplete: reasons.length === 0, reasons }
}

const liveryOf = (fleet: Fleet, id: string | null) => fleet.liveries.find((l) => l.id === id)?.name ?? ''

export const snapshotLoco = (fleet: Fleet, loco: Locomotive): LocoSnapshot => ({
  id: loco.id,
  code: loco.code,
  livery: liveryOf(fleet, loco.liveryId),
  notes: loco.notes,
})

export const snapshotCarriage = (fleet: Fleet, car: Carriage): CarriageSnapshot => ({
  id: car.id,
  code: car.code,
  livery: liveryOf(fleet, car.liveryId),
  specialty: car.specialty,
})

/** Today's date on this device, as YYYY-MM-DD. */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function newSafetyCheck(id: string, now = new Date()): SafetyCheck {
  return {
    id,
    date: localDate(now),
    startedAt: now.toISOString(),
    completedAt: null,
    trains: [],
    results: {},
    managerName: '',
    signature: null,
    notes: '',
  }
}

/** Drops results for vehicles no longer in any train, so they don't linger in the record. */
export function pruneResults(check: SafetyCheck): SafetyCheck {
  const keys = new Set(buildChecklist(check).flatMap((g) => g.rows.map((r) => r.key)))
  const results = Object.fromEntries(Object.entries(check.results).filter(([k]) => keys.has(k)))
  return { ...check, results }
}
