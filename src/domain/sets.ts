import type { Carriage, CarriageSet, Specialty } from './types'

export const MIN_SET_LENGTH = 2
export const MAX_SET_LENGTH = 6

export interface SetIssue {
  /** Errors make a set unusable as a train; warnings are worth knowing but allowed. */
  level: 'error' | 'warning'
  message: string
}

/**
 * Checks a carriage set's make-up: a driver carriage at the front, a guard carriage at the
 * back, and up to four carriages between them.
 */
export function validateSet(
  set: Pick<CarriageSet, 'id' | 'carriageIds'>,
  carriages: Carriage[],
  otherSets: CarriageSet[] = [],
): SetIssue[] {
  const issues: SetIssue[] = []
  const byId = new Map(carriages.map((c) => [c.id, c]))
  const ids = set.carriageIds
  const error = (message: string) => issues.push({ level: 'error', message })
  const warning = (message: string) => issues.push({ level: 'warning', message })

  if (ids.length < MIN_SET_LENGTH) error(`A set needs at least ${MIN_SET_LENGTH} carriages (driver and guard).`)
  if (ids.length > MAX_SET_LENGTH) error(`A set can have at most ${MAX_SET_LENGTH} carriages.`)

  const missing = ids.filter((id) => !byId.has(id))
  if (missing.length) error('The set includes a carriage that no longer exists.')

  const seen = new Set<string>()
  for (const id of ids) {
    const c = byId.get(id)
    if (seen.has(id) && c) error(`Carriage ${c.code} appears more than once.`)
    seen.add(id)
  }

  const first = byId.get(ids[0])
  const last = byId.get(ids[ids.length - 1])
  if (first && first.specialty !== 'driver') error(`The first carriage must be a driver carriage (${first.code} isn't).`)
  if (ids.length >= MIN_SET_LENGTH && last && last.specialty !== 'guard')
    error(`The last carriage must be a guard carriage (${last.code} isn't).`)

  for (const id of ids) {
    const c = byId.get(id)
    if (!c) continue
    if (c.specialty === 'crew') error(`Carriage ${c.code} is crew only and can't carry passengers.`)
    else if (!c.inService) warning(`Carriage ${c.code} is marked out of service.`)
  }

  ids.slice(1, -1).forEach((id) => {
    const c = byId.get(id)
    if (c && (c.specialty === 'driver' || c.specialty === 'guard'))
      warning(`Carriage ${c.code} is a ${c.specialty} carriage in the middle of the set.`)
  })

  for (const other of otherSets) {
    if (other.id === set.id) continue
    const shared = ids.filter((id) => other.carriageIds.includes(id)).map((id) => byId.get(id)?.code ?? '?')
    if (shared.length)
      warning(`Also in set "${other.name}": ${shared.join(', ')}. Only one of these sets can run at a time.`)
  }

  return issues
}

export const hasErrors = (issues: SetIssue[]) => issues.some((i) => i.level === 'error')

/** Driver carriages go to the front, guard carriages to the back, anything else just in front of the guard. */
export function insertCarriage<T extends { specialty: Specialty }>(cars: T[], car: T): T[] {
  if (car.specialty === 'driver') return [car, ...cars]
  if (car.specialty === 'guard') return [...cars, car]
  const last = cars.at(-1)
  return last?.specialty === 'guard' ? [...cars.slice(0, -1), car, last] : [...cars, car]
}
