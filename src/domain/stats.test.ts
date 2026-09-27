import { describe, expect, it } from 'vitest'
import { newSafetyCheck, newTrain, snapshotCarriage, snapshotLoco } from './safetyCheck'
import { seedFleet } from './seed'
import { change, seasonStats } from './stats'
import { amendTicketSheet, DEFAULT_TICKET_SETTINGS, newTicketSheet, type StationId, type TicketSheet } from './tickets'

const fleet = seedFleet()

/** A signed-off sheet selling `returns` Return tickets ($3) and `oneWays` One-way ($2), paid in cash. */
function sheet(id: string, date: string, station: StationId, returns: number, oneWays = 0, cashCents?: number): TicketSheet {
  const [y, m, d] = date.split('-').map(Number)
  const s = newTicketSheet(id, station, DEFAULT_TICKET_SETTINGS, 'regular', new Date(y, m - 1, d, 9))
  s.tickets = s.tickets.map((t) =>
    t.typeId === 'return' ? { ...t, startSerial: 1000, endSerial: 1000 + returns } : t.typeId === 'one-way' ? { ...t, startSerial: 50, endSerial: 50 + oneWays } : t,
  )
  s.cash = { 100: (cashCents ?? returns * 300 + oneWays * 200) / 100 }
  return { ...s, completedAt: new Date(y, m - 1, d, 16).toISOString() }
}

function check(id: string, date: string, locoCode: string, outcome: 'operate' | 'cancelled' = 'operate') {
  const [y, m, d] = date.split('-').map(Number)
  const loco = fleet.locomotives.find((l) => l.code === locoCode)!
  return {
    ...newSafetyCheck(id, new Date(y, m - 1, d, 9)),
    trains: [{ ...newTrain('t'), loco: snapshotLoco(fleet, loco), carriages: ['car-c', 'car-i'].map((cid) => snapshotCarriage(fleet, fleet.carriages.find((c) => c.id === cid)!)) }],
    outcome,
    cancelReason: outcome === 'cancelled' ? 'Track flooded' : '',
    completedAt: new Date(y, m - 1, d, 10).toISOString(),
  }
}

const sheets = [
  sheet('a', '2026-01-04', 'victoria', 100, 20), // Sunday
  sheet('b', '2026-01-04', 'playground', 50),
  sheet('c', '2026-03-07', 'victoria', 30, 0, 30 * 300 - 500), // Saturday, $5 short
  sheet('d', '2025-01-05', 'victoria', 80), // last year, before the cut-off
  sheet('e', '2025-11-02', 'victoria', 500), // last year, after the cut-off
]
const checks = [check('k1', '2026-01-04', 'DA'), check('k2', '2026-03-07', 'DXC'), check('k3', '2026-02-01', 'DA', 'cancelled'), check('k4', '2025-01-05', 'DA')]
const TODAY = new Date(2026, 8, 28)

describe('seasonStats', () => {
  const stats = seasonStats(sheets, checks, { year: 2026, station: 'all' }, TODAY)

  it('totals the year from signed-off sheets', () => {
    expect(stats.current).toMatchObject({
      runningDays: 2,
      ticketsSold: 200,
      ticketTakings: 180 * 300 + 20 * 200,
      sheets: 3,
      balancedSheets: 2,
      netDifference: -500,
    })
    expect(stats.current.ticketsByMonth.slice(0, 3)).toEqual([170, 0, 30])
    expect(stats.current.ticketsByType).toEqual([
      { label: 'Return', value: 180 },
      { label: 'One-way', value: 20 },
    ])
    expect(stats.current.ticketsByStation).toEqual([
      { label: 'Victoria Station', value: 150 },
      { label: 'Playground Station', value: 50 },
    ])
  })

  it('finds the busiest days and weekday averages', () => {
    expect(stats.current.busiestDays.map((d) => [d.date, d.tickets])).toEqual([
      ['2026-01-04', 170],
      ['2026-03-07', 30],
    ])
    expect(stats.current.averageByWeekday).toEqual([null, null, null, null, null, 30, 170])
  })

  it('counts days each loco and carriage ran, and days not operating', () => {
    expect(stats.current.locoDays).toEqual([
      { label: 'DA', value: 1 },
      { label: 'DXC', value: 1 },
    ])
    expect(stats.current.carriageDays).toEqual([
      { label: 'C', value: 2 },
      { label: 'I', value: 2 },
    ])
    expect(stats.current.cancelledDays).toEqual([{ date: '2026-02-01', reason: 'Track flooded' }])
  })

  it('compares with last year only up to the same date', () => {
    expect(stats.comparedTo).toBe('28 September')
    expect(stats.previous.ticketsSold).toBe(80) // not the November sheet
    expect(stats.years).toEqual([2026, 2025])
  })

  it('uses the whole of a finished year', () => {
    const last = seasonStats(sheets, checks, { year: 2025, station: 'all' }, TODAY)
    expect(last.comparedTo).toBeNull()
    expect(last.current.ticketsSold).toBe(580)
  })

  it('filters by station', () => {
    expect(seasonStats(sheets, checks, { year: 2026, station: 'playground' }, TODAY).current.ticketsSold).toBe(50)
  })

  it('counts only the latest signed-off revision, and ignores unfinished sheets', () => {
    const corrected = { ...amendTicketSheet(sheets[1], 'b2'), tickets: sheets[1].tickets.map((t) => (t.typeId === 'return' ? { ...t, endSerial: 1060 } : t)), completedAt: '2026-01-05T00:00:00.000Z' }
    const draft = { ...sheet('z', '2026-04-05', 'victoria', 999), completedAt: null }
    const stats2 = seasonStats([...sheets, corrected, draft], checks, { year: 2026, station: 'all' }, TODAY)
    expect(stats2.current.ticketsSold).toBe(210)
  })
})

describe('change', () => {
  it('gives a rounded percentage, or nothing without a baseline', () => {
    expect(change(150, 100)).toBe(50)
    expect(change(90, 120)).toBe(-25)
    expect(change(5, 0)).toBeNull()
  })
})
