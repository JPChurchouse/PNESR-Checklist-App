// Season statistics, worked out from signed-off records only. Nothing here is stored; it's
// recalculated whenever the stats page is opened.

import type { Cents } from './money'
import { currentRecords } from './revisions'
import type { SafetyCheck } from './safetyCheck'
import { reconcile, type StationId, type TicketSheet } from './tickets'

export interface StatsFilter {
  year: number
  station: StationId | 'all'
}

export interface DayTotal {
  date: string
  tickets: number
  takings: Cents
}

export interface CountRow {
  label: string
  value: number
}

export interface PeriodStats {
  runningDays: number
  ticketsSold: number
  /** Value of tickets sold. */
  ticketTakings: Cents
  donations: Cents
  sheets: number
  balancedSheets: number
  /** Sum of every sheet's over/short difference. */
  netDifference: Cents
  /** Tickets sold in each month, January first. */
  ticketsByMonth: number[]
  /** Tickets sold per ticket type, biggest first. */
  ticketsByType: CountRow[]
  ticketsByStation: CountRow[]
  /** Average tickets per running day for each weekday, Monday first; null where it never ran. */
  averageByWeekday: (number | null)[]
  busiestDays: DayTotal[]
  /** Running days per locomotive and carriage, from signed-off safety checks. */
  locoDays: CountRow[]
  carriageDays: CountRow[]
  /** Days the railway was recorded as not operating. */
  cancelledDays: { date: string; reason: string }[]
}

export interface SeasonStats {
  current: PeriodStats
  /** Last year, over the same stretch of the year (up to the same date if the year is still going). */
  previous: PeriodStats
  /** The comparison cut-off, e.g. "28 September", or null for a full year. */
  comparedTo: string | null
  years: number[]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const WEEKDAY_LABELS = WEEKDAYS
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const weekdayIndex = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

const countRows = (counts: Map<string, number>): CountRow[] =>
  [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))

function periodStats(sheets: TicketSheet[], checks: SafetyCheck[]): PeriodStats {
  const byDay = new Map<string, DayTotal>()
  const byType = new Map<string, number>()
  const byStation = new Map<string, number>()
  const ticketsByMonth = Array<number>(12).fill(0)
  let ticketsSold = 0
  let ticketTakings = 0
  let donations = 0
  let balancedSheets = 0
  let netDifference = 0

  for (const sheet of sheets) {
    const r = reconcile(sheet)
    ticketsSold += r.ticketsSold
    ticketTakings += r.ticketValue
    donations += r.donations
    netDifference += r.difference
    if (r.balance === 'balanced') balancedSheets++
    ticketsByMonth[Number(sheet.date.slice(5, 7)) - 1] += r.ticketsSold
    const day = byDay.get(sheet.date) ?? { date: sheet.date, tickets: 0, takings: 0 }
    day.tickets += r.ticketsSold
    day.takings += r.ticketValue
    byDay.set(sheet.date, day)
    const station = sheet.station === 'victoria' ? 'Victoria Station' : 'Playground Station'
    byStation.set(station, (byStation.get(station) ?? 0) + r.ticketsSold)
    for (const line of r.lines) if (line.sold) byType.set(line.name, (byType.get(line.name) ?? 0) + line.sold)
  }

  const operating = checks.filter((c) => c.outcome === 'operate')
  const runningDates = new Set([...byDay.keys(), ...operating.map((c) => c.date)])

  const weekdayTickets = Array<number>(7).fill(0)
  const weekdayDays = Array<number>(7).fill(0)
  for (const day of byDay.values()) {
    const w = weekdayIndex(day.date)
    weekdayTickets[w] += day.tickets
    weekdayDays[w]++
  }

  const locoDays = new Map<string, Set<string>>()
  const carriageDays = new Map<string, Set<string>>()
  const addDay = (map: Map<string, Set<string>>, code: string, date: string) => map.set(code, (map.get(code) ?? new Set()).add(date))
  for (const check of operating)
    for (const train of check.trains) {
      if (train.loco) addDay(locoDays, train.loco.code, check.date)
      for (const car of train.carriages) addDay(carriageDays, car.code, check.date)
    }
  const dayCounts = (map: Map<string, Set<string>>) => countRows(new Map([...map].map(([code, dates]) => [code, dates.size])))

  return {
    runningDays: runningDates.size,
    ticketsSold,
    ticketTakings,
    donations,
    sheets: sheets.length,
    balancedSheets,
    netDifference,
    ticketsByMonth,
    ticketsByType: countRows(byType),
    ticketsByStation: countRows(byStation),
    averageByWeekday: weekdayTickets.map((t, i) => (weekdayDays[i] ? Math.round(t / weekdayDays[i]) : null)),
    busiestDays: [...byDay.values()].sort((a, b) => b.tickets - a.tickets || a.date.localeCompare(b.date)).slice(0, 5),
    locoDays: dayCounts(locoDays),
    carriageDays: dayCounts(carriageDays),
    cancelledDays: checks.filter((c) => c.outcome === 'cancelled').map((c) => ({ date: c.date, reason: c.cancelReason })),
  }
}

/** Signed-off records only, and only the latest revision of anything corrected. */
const signedOff = <T extends { completedAt: string | null; amendsId: string | null; id: string }>(all: T[]) =>
  currentRecords(all).filter((r) => r.completedAt)

export function seasonStats(allSheets: TicketSheet[], allChecks: SafetyCheck[], filter: StatsFilter, today = new Date()): SeasonStats {
  const sheets = signedOff(allSheets).filter((s) => filter.station === 'all' || s.station === filter.station)
  const checks = signedOff(allChecks)
  const years = [...new Set([...sheets, ...checks].map((r) => Number(r.date.slice(0, 4))))].sort((a, b) => b - a)

  // Part-way through the year, compare with the same stretch of last year so the numbers are fair.
  const ongoing = filter.year === today.getFullYear()
  const cutoff = ongoing ? `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` : '12-31'
  const inYear = (date: string, year: number, upTo = '12-31') => date.startsWith(`${year}-`) && date.slice(5) <= upTo

  return {
    current: periodStats(
      sheets.filter((s) => inYear(s.date, filter.year)),
      checks.filter((c) => inYear(c.date, filter.year)),
    ),
    previous: periodStats(
      sheets.filter((s) => inYear(s.date, filter.year - 1, cutoff)),
      checks.filter((c) => inYear(c.date, filter.year - 1, cutoff)),
    ),
    comparedTo: ongoing ? today.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long' }) : null,
    years,
  }
}

/** Percentage change, or null when there's nothing to compare with. */
export const change = (now: number, before: number): number | null => (before ? Math.round(((now - before) / before) * 100) : null)
