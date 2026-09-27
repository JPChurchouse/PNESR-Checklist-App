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
  /** Kept across revisions, so an amendment can say what changed in each train. */
  id: string
  /** Name of the set the train was built from, if any. */
  setName: string | null
  loco: LocoSnapshot | null
  carriages: CarriageSnapshot[]
}

/**
 * A ticked check. Anything wrong is fixed before ticking, or the vehicle is swapped out,
 * so there is no "fail" state.
 */
export interface CheckResult {
  checkedAt: string
}

/**
 * - `operate`: everything checked; the railway runs.
 * - `cancelled`: the railway can't run today (e.g. a track fault); records why.
 */
export type Outcome = 'operate' | 'cancelled'

export interface SafetyCheck {
  id: string
  /** Local date the check is for, YYYY-MM-DD. */
  date: string
  startedAt: string
  /** ISO timestamp; set once signed off, after which this revision is read-only. */
  completedAt: string | null
  trains: TrainCheck[]
  /** Keyed by `resultKey()`. A key is present only when the item is ticked. */
  results: Record<string, CheckResult>
  outcome: Outcome
  cancelReason: string
  managerName: string
  /** PNG data: URL of the manager's signature. */
  signature: string | null
  notes: string
  /** 1 for the original check, 2+ for amendments. */
  revision: number
  /** The revision this one amends. */
  amendsId: string | null
  /** Why the amendment was made, e.g. "DXR broke down". */
  amendmentReason: string
}

export const resultKey = (scope: 'track' | string, itemId: string) => `${scope}:${itemId}`

export interface ChecklistRow {
  key: string
  item: CheckItem
}

export interface ChecklistGroup {
  /** e.g. "Track", "Locomotive DXC", "Carriage C" */
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
  done: number
}

export function checkProgress(check: Pick<SafetyCheck, 'trains' | 'results'>): CheckProgress {
  const rows = buildChecklist(check).flatMap((g) => g.rows)
  return { total: rows.length, done: rows.filter((r) => check.results[r.key]).length }
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
  const reasons: string[] = []
  if (check.outcome === 'cancelled') {
    if (!check.cancelReason.trim()) reasons.push("Explain why the railway can't operate.")
  } else {
    reasons.push(...trainProblems(check))
    const { total, done } = checkProgress(check)
    if (done < total) reasons.push(`${total - done} check${total - done === 1 ? '' : 's'} still to do.`)
  }
  if (check.revision > 1 && !check.amendmentReason.trim()) reasons.push('Give a reason for the amendment.')
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
    outcome: 'operate',
    cancelReason: '',
    managerName: '',
    signature: null,
    notes: '',
    revision: 1,
    amendsId: null,
    amendmentReason: '',
  }
}

/**
 * Starts a new revision of a signed-off check. Everything already ticked carries over;
 * only vehicles added in the amendment need checking. It must be signed again.
 */
export function amendSafetyCheck(previous: SafetyCheck, id: string, now = new Date()): SafetyCheck {
  return {
    ...structuredClone(previous),
    id,
    startedAt: now.toISOString(),
    completedAt: null,
    signature: null,
    revision: previous.revision + 1,
    amendsId: previous.id,
    amendmentReason: '',
  }
}

/** Plain-English list of what changed in the trains between two revisions. */
export function describeTrainChanges(before: Pick<SafetyCheck, 'trains'>, after: Pick<SafetyCheck, 'trains'>): string[] {
  const changes: string[] = []
  const codes = (t: TrainCheck) => t.carriages.map((c) => c.code).join(' ')
  const summary = (t: TrainCheck) => [t.loco?.code ?? 'no loco', t.setName ? `set ${t.setName}` : codes(t)].join(', ')

  after.trains.forEach((train, i) => {
    const old = before.trains.find((t) => t.id === train.id)
    const label = `Train ${i + 1}`
    if (!old) return changes.push(`${label} added (${summary(train)}).`)
    if (old.loco?.id !== train.loco?.id)
      changes.push(`${label}: locomotive ${old.loco?.code ?? 'none'} replaced by ${train.loco?.code ?? 'none'}.`)
    if (codes(old) !== codes(train)) changes.push(`${label}: carriages changed from ${codes(old) || 'none'} to ${codes(train) || 'none'}.`)
  })
  before.trains.forEach((train) => {
    if (!after.trains.some((t) => t.id === train.id)) changes.push(`A train was removed (${summary(train)}).`)
  })
  return changes
}

/** Drops ticks for vehicles no longer in any train, so they don't linger in the record. */
export function pruneResults(check: SafetyCheck): SafetyCheck {
  const keys = new Set(buildChecklist(check).flatMap((g) => g.rows.map((r) => r.key)))
  const results = Object.fromEntries(Object.entries(check.results).filter(([k]) => keys.has(k)))
  return { ...check, results }
}

/** The revisions a check amends, oldest first, ending with the check itself. */
export function revisionChain(check: SafetyCheck, all: SafetyCheck[]): SafetyCheck[] {
  const byId = new Map(all.map((c) => [c.id, c]))
  const chain = [check]
  for (let c = check; c.amendsId && byId.has(c.amendsId); ) {
    c = byId.get(c.amendsId)!
    chain.unshift(c)
  }
  return chain
}

/** Checks worth listing: every check except those replaced by a signed-off amendment. */
export function currentChecks(all: SafetyCheck[]): SafetyCheck[] {
  const superseded = new Set(all.filter((c) => c.completedAt && c.amendsId).map((c) => c.amendsId))
  return all.filter((c) => !superseded.has(c.id))
}
