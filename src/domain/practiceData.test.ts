import { describe, expect, it } from 'vitest'
import { generateSampleSeason, generateStaff, seededRandom } from './practiceData'
import { checkProgress, trainProblems } from './safetyCheck'
import { seedFleet } from './seed'
import { driverProblem, guardProblem } from './staff'
import { completionProblems, DEFAULT_TICKET_SETTINGS, reconcile } from './tickets'

let n = 0
const id = (prefix = 'x') => `${prefix}-${++n}`
const fleet = seedFleet()
const staff = generateStaff(fleet, id)
const season = generateSampleSeason(fleet, DEFAULT_TICKET_SETTINGS, staff, id, new Date(2026, 8, 28))

describe('seededRandom', () => {
  it('repeats for the same seed', () => {
    const a = seededRandom(3)
    const b = seededRandom(3)
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()])
  })
})

describe('generateStaff', () => {
  it('makes a realistic spread of roles with clearly fake phone numbers', () => {
    expect(staff.length).toBeGreaterThanOrEqual(20)
    for (const role of ['manager', 'cashier', 'guard', 'driver'] as const) expect(staff.filter((s) => s[role]).length).toBeGreaterThan(2)
    expect(staff.every((s) => s.mobile.startsWith('021 000 '))).toBe(true)
    expect(staff.filter((s) => s.driver).every((s) => s.guard && s.classA.length > 0)).toBe(true)
  })
})

describe('generateSampleSeason', () => {
  const { safetyChecks, ticketSheets } = season

  it('covers last year and this year', () => {
    const years = new Set(safetyChecks.map((c) => c.date.slice(0, 4)))
    expect([...years]).toEqual(['2025', '2026'])
    expect(safetyChecks.length).toBeGreaterThan(80)
  })

  it('produces safety checks that could really be signed off', () => {
    for (const check of safetyChecks) {
      expect(trainProblems(check)).toEqual([])
      const { done, total } = checkProgress(check)
      expect(done).toBe(total)
      for (const t of check.trains) {
        const driver = staff.find((s) => `${s.firstName} ${s.surname}` === t.driver)
        expect(driverProblem(driver, t.loco!.code)).toBeNull()
        expect(guardProblem(staff.find((s) => `${s.firstName} ${s.surname}` === t.guard))).toBeNull()
      }
    }
  })

  it('runs ticket numbers on from one sheet to the next at each station', () => {
    const victoriaReturns = ticketSheets
      .filter((s) => s.station === 'victoria' && s.kind === 'regular')
      .map((s) => s.tickets.find((t) => t.typeId === 'return')!)
    for (let i = 1; i < victoriaReturns.length; i++) expect(victoriaReturns[i].startSerial).toBe(victoriaReturns[i - 1].endSerial)
  })

  it('mostly balances, with the odd discrepancy', () => {
    const balances = ticketSheets.map((s) => reconcile(s).balance)
    const balanced = balances.filter((b) => b === 'balanced').length
    expect(balanced / balances.length).toBeGreaterThan(0.75)
    expect(balances).toContain('short')
  })

  it('has complete sheets, apart from the missing signature', () => {
    for (const sheet of ticketSheets) expect(completionProblems(sheet)).toEqual(['The shift manager needs to sign.'])
  })

  it('includes a special event', () => {
    expect(ticketSheets.some((s) => s.kind === 'event' && s.eventName)).toBe(true)
  })
})
