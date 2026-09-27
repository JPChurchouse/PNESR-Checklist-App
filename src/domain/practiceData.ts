// Made-up data for practice mode: a staff list and a sample season of signed-off records, so
// the forms, pickers and season stats can be tried (and demonstrated) without real information.
// Everything is generated from a seed, so the same seed always gives the same data.

import { buildChecklist, newSafetyCheck, newTrain, snapshotCarriage, snapshotLoco, type SafetyCheck } from './safetyCheck'
import { validateSet } from './sets'
import type { StaffMember } from './staff'
import { newTicketSheet, STATION_IDS, type Counts, type TicketSettings, type TicketSheet } from './tickets'
import type { Fleet } from './types'

/** Small seeded random number generator (mulberry32). */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: T[]) => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  }
}
type Random = ReturnType<typeof seededRandom>

const FIRST_NAMES = [
  'Aroha', 'Ben', 'Charlotte', 'Daniel', 'Ella', 'Finn', 'Grace', 'Hemi', 'Isla', 'Jack', 'Kiri', 'Liam',
  'Mere', 'Noah', 'Olivia', 'Paora', 'Quinn', 'Ruby', 'Sam', 'Tama', 'Tūī', 'Wiremu', 'Zoe', 'Māia',
]
const SURNAMES = ['Anderson', 'Brown', 'Campbell', 'Davies', 'Edwards', 'Fraser', 'Green', 'Harris', 'Ngata', 'Parata', 'Robertson', 'Smith', 'Taylor', 'Walker', 'Wilson']

/** A practice staff list: plausible names, clearly fake phone numbers, and a realistic spread of roles. */
export function generateStaff(fleet: Fleet, makeId: () => string, seed = 1): StaffMember[] {
  const rand = seededRandom(seed)
  const locoCodes = fleet.locomotives.map((l) => l.code)
  return FIRST_NAMES.map((firstName, i) => {
    const surname = SURNAMES[(i * 7) % SURNAMES.length]
    const driver = i % 3 === 0
    const guard = driver || i % 3 === 1 || rand.chance(0.2)
    const cashier = i % 2 === 1 || rand.chance(0.25)
    const manager = i % 6 === 0
    // Newer drivers aren't on every loco yet.
    const classA = driver ? locoCodes.filter((_, j) => j < 2 || rand.chance(0.6)) : []
    const code = `${cashier ? 'C' : ''}${driver ? 'D' : guard ? 'G' : ''}`
    return {
      id: makeId(),
      firstName,
      surname,
      displayName: `${firstName} ${surname[0]}${code ? ` (${code})` : ''}`,
      mobile: `021 000 ${String(1000 + i).padStart(4, '0')}`,
      landLine: '',
      manager,
      cashier,
      guard,
      driver,
      classA,
    }
  })
}

const fullName = (s: StaffMember) => `${s.firstName} ${s.surname}`

/** Running days: every Sunday, most Saturdays in summer, plus school-holiday Wednesdays. */
function isOperatingDay(d: Date, rand: Random) {
  const month = d.getMonth()
  const summer = month >= 10 || month <= 2
  const day = d.getDay()
  if (day === 0) return true
  if (day === 6) return summer ? rand.chance(0.8) : rand.chance(0.2)
  if (day === 3) return (month === 0 || month === 6 || month === 9) && rand.chance(0.7)
  return false
}

/** Rough busyness for a day: summer and weekends are busier; some days are rained out quieter. */
function demand(d: Date, rand: Random) {
  const month = d.getMonth()
  const seasonal = [1.6, 1.4, 1.1, 0.9, 0.6, 0.45, 0.6, 0.6, 0.8, 1.0, 1.2, 1.5][month]
  const weather = rand.chance(0.15) ? 0.35 : 0.8 + rand.next() * 0.5
  return seasonal * weather * (d.getDay() === 0 ? 1.2 : 1)
}

const at = (d: Date, hour: number, minute = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute).toISOString()

/** Pays an amount in the notes and coins a cash tin would realistically hold. */
function cashFor(cents: number, rand: Random): Counts {
  const counts: Counts = {}
  let left = Math.max(0, cents)
  for (const denom of [5000, 2000, 1000, 500, 200, 100, 50, 20, 10]) {
    const max = Math.floor(left / denom)
    const n = denom >= 2000 ? Math.floor(max * rand.next() * 0.6) : max
    if (n) counts[denom] = n
    left -= n * denom
  }
  return counts
}

export interface SampleSeason {
  safetyChecks: SafetyCheck[]
  ticketSheets: TicketSheet[]
}

/**
 * About 15 months of signed-off safety checks and ticket sheets up to `until`, with ticket
 * numbers running on from day to day, the odd shortfall, and a couple of special events.
 */
export function generateSampleSeason(
  fleet: Fleet,
  settings: TicketSettings,
  staff: StaffMember[],
  makeId: (prefix: string) => string,
  until = new Date(),
  seed = 7,
): SampleSeason {
  const rand = seededRandom(seed)
  const safetyChecks: SafetyCheck[] = []
  const ticketSheets: TicketSheet[] = []
  const managers = staff.filter((s) => s.manager)
  const cashiers = staff.filter((s) => s.cashier)
  const guards = staff.filter((s) => s.guard)
  const drivers = staff.filter((s) => s.driver)
  const locos = fleet.locomotives.filter((l) => l.inService)
  const sets = fleet.sets.filter((s) => !validateSet(s, fleet.carriages).some((i) => i.level === 'error'))
  const serials = new Map<string, number>() // "station:typeId" → next ticket on the roll
  const serial = (station: string, typeId: string) => serials.get(`${station}:${typeId}`) ?? 100000 + rand.int(0, 50000)

  const start = new Date(until.getFullYear() - 1, 0, 1)
  let eventsLeft = 2
  for (let d = new Date(start); d < until; d.setDate(d.getDate() + 1)) {
    if (!isOperatingDay(d, rand)) continue
    const busy = demand(d, rand)
    const manager = rand.pick(managers)

    // Safety check: more trains on busier days.
    const trainCount = Math.min(busy > 1.3 ? 3 : busy > 0.8 ? 2 : 1, locos.length, sets.length)
    const usedLocos = [...locos].sort(() => rand.next() - 0.5).slice(0, trainCount)
    const trains = usedLocos.map((loco, i) => {
      const set = sets[i]
      const driver = drivers.find((s) => s.classA.includes(loco.code)) ?? rand.pick(drivers)
      return {
        ...newTrain(makeId('train')),
        setName: set.name,
        loco: snapshotLoco(fleet, loco),
        carriages: set.carriageIds.map((id) => snapshotCarriage(fleet, fleet.carriages.find((c) => c.id === id)!)),
        driver: fullName(driver),
        guard: fullName(rand.pick(guards.filter((g) => g !== driver))),
      }
    })
    const check: SafetyCheck = {
      ...newSafetyCheck(makeId('check'), new Date(at(d, 9))),
      trains,
      managerName: fullName(manager),
      signature: null,
      completedAt: at(d, 10, rand.int(0, 20)),
    }
    for (const g of buildChecklist(check)) for (const row of g.rows) check.results[row.key] = { checkedAt: at(d, 9, rand.int(10, 55)) }
    safetyChecks.push(check)

    // One special event a year, in October, at Victoria Station.
    const isEvent = d.getMonth() === 9 && d.getDay() === 6 && eventsLeft > 0 && rand.chance(0.5)
    if (isEvent) eventsLeft--

    for (const station of isEvent ? (['victoria'] as const) : STATION_IDS) {
      const kind = isEvent ? 'event' : 'regular'
      const sheet = newTicketSheet(makeId('sheet'), station, settings, kind, new Date(at(d, 9, 30)))
      const stationShare = station === 'victoria' ? 0.6 : 0.4
      sheet.tickets = sheet.tickets.map((t) => {
        const startSerial = serial(station, t.typeId)
        const base = isEvent ? 180 : { 'one-way': 30, return: 110, supporter: 8, concession: 1.5 }[t.typeId] ?? 5
        const sold = Math.max(0, Math.round(base * busy * stationShare * (0.7 + rand.next() * 0.6)))
        serials.set(`${station}:${t.typeId}`, startSerial + sold)
        return { ...t, startSerial, endSerial: startSerial + sold }
      })
      const ticketValue = sheet.tickets.reduce((sum, t) => sum + (t.endSerial! - t.startSerial!) * t.priceCents, 0)
      const donations = { cash: rand.chance(0.5) ? rand.int(1, 6) * 500 : 0, eftpos: rand.chance(0.3) ? rand.int(1, 4) * 500 : 0 }
      const eftposShare = 0.35 + rand.next() * 0.25
      const eftposTakings = Math.round((ticketValue * eftposShare) / 100) * 100 + donations.eftpos
      // Usually balances; now and then a few dollars out either way.
      const error = rand.chance(0.12) ? rand.pick([-1000, -500, -200, 200, 500]) : 0
      const cashTakings = ticketValue - (eftposTakings - donations.eftpos) + donations.cash + error
      const ticks = Object.fromEntries(sheet.float.map((f) => [f.denominationCents, true]))
      ticketSheets.push({
        ...sheet,
        eventName: isEvent ? 'Spooky Night Run' : '',
        cashiers: fullName(rand.pick(cashiers)),
        staff: [manager, ...trains.flatMap(() => [rand.pick(drivers), rand.pick(guards)])].map((s) => s.displayName).join('\n'),
        startSavedAt: at(d, 9, 45),
        floatStart: { ticks, note: '' },
        floatEnd: { ticks, note: '' },
        cash: cashFor(cashTakings, rand),
        eftpos: { takings: eftposTakings, totalCharged: null, surcharge: Math.round(eftposTakings * 0.015) },
        donations,
        managerName: fullName(manager),
        completedAt: at(d, 16, rand.int(0, 45)),
        notes: error ? 'Recounted twice; difference stands.' : '',
      })
    }
  }
  return { safetyChecks, ticketSheets }
}
