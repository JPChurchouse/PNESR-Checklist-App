import { localDate } from '../lib/dates'
import { formatDenomination, formatMoney, type Cents } from './money'

export type StationId = 'victoria' | 'playground'

export const STATIONS: Record<StationId, { name: string }> = {
  victoria: { name: 'Victoria Station' },
  playground: { name: 'Playground Station' },
}
export const STATION_IDS = Object.keys(STATIONS) as StationId[]

/** NZ currency, smallest first. */
export const DENOMINATIONS: { cents: Cents; kind: 'coin' | 'note' }[] = [
  { cents: 10, kind: 'coin' },
  { cents: 20, kind: 'coin' },
  { cents: 50, kind: 'coin' },
  { cents: 100, kind: 'coin' },
  { cents: 200, kind: 'coin' },
  { cents: 500, kind: 'note' },
  { cents: 1000, kind: 'note' },
  { cents: 2000, kind: 'note' },
  { cents: 5000, kind: 'note' },
  { cents: 10000, kind: 'note' },
]

export interface TicketType {
  id: string
  name: string
  priceCents: Cents
  /** What the ticket covers, e.g. "Half circuit (one direction)". */
  note: string
  /** Ticket colour at each station, so it's clear where it was bought. */
  colours: Record<StationId, string>
}

export interface FloatItem {
  denominationCents: Cents
  perBag: number
  bags: number
}

export interface TicketSettings {
  ticketTypes: TicketType[]
  float: FloatItem[]
}

export const DEFAULT_TICKET_SETTINGS: TicketSettings = {
  ticketTypes: [
    { id: 'one-way', name: 'One-way', priceCents: 200, note: 'Half circuit (one direction)', colours: { victoria: 'Black', playground: 'White' } },
    { id: 'return', name: 'Return', priceCents: 300, note: 'Full circuit, back to the starting station', colours: { victoria: 'Blue', playground: 'Orange' } },
    {
      id: 'supporter',
      name: 'Supporter',
      priceCents: 0,
      note: 'Free return for people meeting the supporter criteria',
      colours: { victoria: 'Purple', playground: 'Purple' },
    },
    { id: 'concession', name: 'Concession', priceCents: 2000, note: 'Eight return trips (discounted)', colours: { victoria: 'Red', playground: 'Red' } },
  ],
  float: [
    { denominationCents: 100, perBag: 10, bags: 3 },
    { denominationCents: 200, perBag: 10, bags: 4 },
    { denominationCents: 500, perBag: 12, bags: 1 },
    { denominationCents: 1000, perBag: 8, bags: 1 },
  ],
}

/** Piece counts (coins or notes) keyed by denomination in cents. Missing or null = not entered. */
export type Counts = Record<string, number | null>

export interface TicketLine {
  typeId: string
  name: string
  priceCents: Cents
  colour: string
  /** First ticket on the roll at the start of the shift. */
  startSerial: number | null
  /** First ticket left on the roll at the end of the shift (the next one to be sold). */
  endSerial: number | null
}

/** Any two of these are entered from the EFTPOS receipt; the third is worked out (charged = takings + surcharge). */
export interface EftposEntry {
  takings: Cents | null
  totalCharged: Cents | null
  surcharge: Cents | null
}

export interface TicketSheet {
  id: string
  station: StationId
  date: string
  startedAt: string
  completedAt: string | null
  cashier: string
  tickets: TicketLine[]
  /** The float as set up in settings when the sheet was started. */
  float: FloatItem[]
  floatStart: Counts
  floatEnd: Counts
  /** Cash left after the float is reset. */
  cash: Counts
  eftpos: EftposEntry
  /** Photo of the EFTPOS totals receipt, as a data: URL. */
  eftposReceipt: string | null
  donations: { cash: Cents | null; eftpos: Cents | null }
  notes: string
}

export function newTicketSheet(id: string, station: StationId, settings: TicketSettings, now = new Date()): TicketSheet {
  return {
    id,
    station,
    date: localDate(now),
    startedAt: now.toISOString(),
    completedAt: null,
    cashier: '',
    tickets: settings.ticketTypes.map((t) => ({
      typeId: t.id,
      name: t.name,
      priceCents: t.priceCents,
      colour: t.colours[station],
      startSerial: null,
      endSerial: null,
    })),
    float: structuredClone(settings.float),
    floatStart: {},
    floatEnd: {},
    cash: {},
    eftpos: { takings: null, totalCharged: null, surcharge: null },
    eftposReceipt: null,
    donations: { cash: null, eftpos: null },
    notes: '',
  }
}

// ---------- Tickets ----------

export interface TicketLineResult {
  /** null until both serials are entered. */
  sold: number | null
  valueCents: Cents
  problem: string | null
}

export function ticketLineResult(line: TicketLine): TicketLineResult {
  const { startSerial: start, endSerial: end } = line
  if (start === null && end === null) return { sold: null, valueCents: 0, problem: null }
  if (start === null) return { sold: null, valueCents: 0, problem: `${line.name}: enter the start number.` }
  if (end === null) return { sold: null, valueCents: 0, problem: null }
  if (end < start) return { sold: null, valueCents: 0, problem: `${line.name}: the end number is lower than the start number.` }
  const sold = end - start
  return { sold, valueCents: sold * line.priceCents, problem: null }
}

// ---------- Cash ----------

export const countTotal = (counts: Counts): Cents =>
  Object.entries(counts).reduce((sum, [cents, n]) => sum + Number(cents) * (n ?? 0), 0)

export const floatTotal = (float: FloatItem[]): Cents => float.reduce((sum, f) => sum + f.denominationCents * f.perBag * f.bags, 0)

export interface FloatRow {
  denominationCents: Cents
  expected: number
  counted: number | null
  /** Counted minus expected, in cents; null until counted. */
  differenceCents: Cents | null
}

export interface FloatCheck {
  rows: FloatRow[]
  expectedTotal: Cents
  countedTotal: Cents
  /** Every denomination counted. */
  complete: boolean
  ok: boolean
  /** e.g. "$2: 38 counted, 40 expected ($4.00 short)" */
  issues: string[]
}

export function checkFloat(float: FloatItem[], counts: Counts): FloatCheck {
  const rows: FloatRow[] = float.map((f) => {
    const expected = f.perBag * f.bags
    const counted = counts[f.denominationCents] ?? null
    return {
      denominationCents: f.denominationCents,
      expected,
      counted,
      differenceCents: counted === null ? null : (counted - expected) * f.denominationCents,
    }
  })
  const floatDenoms = new Set(float.map((f) => String(f.denominationCents)))
  const issues = rows
    .filter((r) => r.differenceCents)
    .map((r) => {
      const diff = r.differenceCents!
      return `${formatDenomination(r.denominationCents)}: ${r.counted} counted, ${r.expected} expected (${formatMoney(Math.abs(diff))} ${diff < 0 ? 'short' : 'over'})`
    })
  // Denominations that aren't part of the float at all.
  for (const [cents, n] of Object.entries(counts))
    if (!floatDenoms.has(cents) && n) issues.push(`${formatDenomination(Number(cents))}: ${n} counted, none expected in the float`)
  const complete = rows.every((r) => r.counted !== null)
  return { rows, expectedTotal: floatTotal(float), countedTotal: countTotal(counts), complete, ok: complete && issues.length === 0, issues }
}

// ---------- EFTPOS ----------

export interface ResolvedEftpos {
  takings: Cents | null
  totalCharged: Cents | null
  surcharge: Cents | null
  /** Which field was worked out from the other two, if any. */
  calculated: keyof EftposEntry | null
  problem: string | null
}

export function resolveEftpos(entry: EftposEntry): ResolvedEftpos {
  const { takings, totalCharged, surcharge } = entry
  const given = [takings, totalCharged, surcharge].filter((v) => v !== null).length
  const base = { takings, totalCharged, surcharge, calculated: null, problem: null }
  if (given === 0) return base
  if (given === 1) return { ...base, problem: 'Enter two of the three EFTPOS amounts.' }
  if (given === 3)
    return takings! + surcharge! === totalCharged!
      ? base
      : { ...base, problem: `The EFTPOS amounts don't add up: takings ${formatMoney(takings!)} + surcharge ${formatMoney(surcharge!)} ≠ total charged ${formatMoney(totalCharged!)}.` }
  if (takings === null) {
    const derived = totalCharged! - surcharge!
    return derived < 0 ? { ...base, problem: 'The surcharge is more than the total charged.' } : { ...base, takings: derived, calculated: 'takings' }
  }
  if (surcharge === null) {
    const derived = totalCharged! - takings
    return derived < 0 ? { ...base, problem: 'The takings are more than the total charged.' } : { ...base, surcharge: derived, calculated: 'surcharge' }
  }
  return { ...base, totalCharged: takings + surcharge, calculated: 'totalCharged' }
}

// ---------- Reconciliation ----------

export type Balance = 'balanced' | 'over' | 'short'

export interface Reconciliation {
  lines: (TicketLine & TicketLineResult)[]
  ticketsSold: number
  ticketValue: Cents
  cashTakings: Cents
  eftposTakings: Cents
  donations: Cents
  /** Cash + EFTPOS (excluding surcharge) − donations: what should match the ticket value. */
  moneyForTickets: Cents
  /** moneyForTickets − ticketValue: positive means over, negative means short. */
  difference: Cents
  balance: Balance
}

export function reconcile(sheet: TicketSheet): Reconciliation {
  const lines = sheet.tickets.map((t) => ({ ...t, ...ticketLineResult(t) }))
  const ticketValue = lines.reduce((sum, l) => sum + l.valueCents, 0)
  const cashTakings = countTotal(sheet.cash)
  const eftposTakings = resolveEftpos(sheet.eftpos).takings ?? 0
  const donations = (sheet.donations.cash ?? 0) + (sheet.donations.eftpos ?? 0)
  const moneyForTickets = cashTakings + eftposTakings - donations
  const difference = moneyForTickets - ticketValue
  return {
    lines,
    ticketsSold: lines.reduce((sum, l) => sum + (l.sold ?? 0), 0),
    ticketValue,
    cashTakings,
    eftposTakings,
    donations,
    moneyForTickets,
    difference,
    balance: difference === 0 ? 'balanced' : difference > 0 ? 'over' : 'short',
  }
}

export function balanceText(r: Pick<Reconciliation, 'balance' | 'difference'>): string {
  if (r.balance === 'balanced') return 'Balanced: takings match tickets sold'
  return `${r.balance === 'over' ? 'Over' : 'Short'} by ${formatMoney(Math.abs(r.difference))}`
}

// ---------- Completion ----------

export function startProblems(sheet: TicketSheet): string[] {
  const problems: string[] = []
  if (!sheet.cashier.trim()) problems.push("Enter the cashier's name.")
  if (sheet.tickets.every((t) => t.startSerial === null)) problems.push('Enter the start number for each ticket roll in use.')
  if (!checkFloat(sheet.float, sheet.floatStart).complete) problems.push('Count the float before the shift.')
  return problems
}

/** Everything that must be sorted before the sheet can be completed. A discrepancy is allowed; it's reported. */
export function completionProblems(sheet: TicketSheet): string[] {
  const problems = startProblems(sheet)
  for (const t of sheet.tickets) {
    const r = ticketLineResult(t)
    if (r.problem) problems.push(r.problem)
    else if (t.startSerial !== null && t.endSerial === null) problems.push(`${t.name}: enter the end number.`)
  }
  if (!checkFloat(sheet.float, sheet.floatEnd).complete) problems.push('Count the float after resetting it.')
  const eftpos = resolveEftpos(sheet.eftpos)
  if (eftpos.problem) problems.push(eftpos.problem)
  return problems
}
