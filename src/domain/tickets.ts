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

const kindOf = (cents: Cents) => DENOMINATIONS.find((d) => d.cents === cents)?.kind ?? 'coin'

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
  /** Sold on normal running days. */
  ticketTypes: TicketType[]
  /** Sold on special runs instead of the normal tickets. */
  eventTicketTypes: TicketType[]
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
  eventTicketTypes: [{ id: 'event', name: 'Event', priceCents: 500, note: 'Special run', colours: { victoria: 'Purple', playground: 'Purple' } }],
  float: [
    { denominationCents: 100, perBag: 10, bags: 3 },
    { denominationCents: 200, perBag: 10, bags: 4 },
    { denominationCents: 500, perBag: 12, bags: 1 },
    { denominationCents: 1000, perBag: 8, bags: 1 },
  ],
}

/** Settings saved by an older version may lack newer fields. */
export const withSettingDefaults = (s: Partial<TicketSettings>): TicketSettings => ({ ...structuredClone(DEFAULT_TICKET_SETTINGS), ...s })

/** Piece counts (coins or notes) keyed by denomination in cents. Missing or null = not entered. */
export type Counts = Record<string, number | null>

/** Which float denominations have been confirmed correct, keyed by denomination in cents. */
export type FloatTicks = Record<string, boolean>

export interface FloatCheckEntry {
  ticks: FloatTicks
  /** Required when anything isn't ticked: what's wrong with the float. */
  note: string
}

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

export type SheetKind = 'regular' | 'event'

export interface TicketSheet {
  id: string
  kind: SheetKind
  /** For special runs, e.g. "Halloween night run". */
  eventName: string
  station: StationId
  date: string
  startedAt: string
  /** Set by "Save start of shift"; the end-of-shift part opens after this. */
  startSavedAt: string | null
  completedAt: string | null
  /** Names of whoever is selling tickets. */
  cashiers: string
  /** Everyone working the shift, free text for now. */
  staff: string
  tickets: TicketLine[]
  /** The float as set up in settings when the sheet was started. */
  float: FloatItem[]
  floatStart: FloatCheckEntry
  floatEnd: FloatCheckEntry
  /** Cash left after the float is reset. */
  cash: Counts
  eftpos: EftposEntry
  /** Photo of the EFTPOS totals receipt, as a data: URL. */
  eftposReceipt: string | null
  donations: { cash: Cents | null; eftpos: Cents | null }
  notes: string
  managerName: string
  /** PNG data: URL of the manager's signature. */
  signature: string | null
  /** 1 for the original sheet, 2+ for corrections. */
  revision: number
  amendsId: string | null
  amendmentReason: string
}

export function newTicketSheet(id: string, station: StationId, settings: TicketSettings, kind: SheetKind = 'regular', now = new Date()): TicketSheet {
  const types = kind === 'event' ? settings.eventTicketTypes : settings.ticketTypes
  return {
    id,
    kind,
    eventName: '',
    station,
    date: localDate(now),
    startedAt: now.toISOString(),
    startSavedAt: null,
    completedAt: null,
    cashiers: '',
    staff: '',
    tickets: types.map((t) => ({
      typeId: t.id,
      name: t.name,
      priceCents: t.priceCents,
      colour: t.colours[station],
      startSerial: null,
      endSerial: null,
    })),
    float: structuredClone(settings.float),
    floatStart: { ticks: {}, note: '' },
    floatEnd: { ticks: {}, note: '' },
    cash: {},
    eftpos: { takings: null, totalCharged: null, surcharge: null },
    eftposReceipt: null,
    donations: { cash: null, eftpos: null },
    notes: '',
    managerName: '',
    signature: null,
    revision: 1,
    amendsId: null,
    amendmentReason: '',
  }
}

export const sheetTitle = (sheet: Pick<TicketSheet, 'kind' | 'station' | 'eventName'>) =>
  sheet.kind === 'event'
    ? `${STATIONS[sheet.station].name} special event${sheet.eventName.trim() ? `: ${sheet.eventName.trim()}` : ''}`
    : STATIONS[sheet.station].name

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

export const floatItemTotal = (f: FloatItem): Cents => f.denominationCents * f.perBag * f.bags
export const floatTotal = (float: FloatItem[]): Cents => float.reduce((sum, f) => sum + floatItemTotal(f), 0)

/** "$1 coins: 3 bags × 10" */
export function floatItemLabel(f: FloatItem): string {
  const noun = kindOf(f.denominationCents) === 'note' ? 'notes' : 'coins'
  return `${formatDenomination(f.denominationCents)} ${noun}: ${f.bags} bag${f.bags === 1 ? '' : 's'} × ${f.perBag}`
}

export type FloatStatus = 'pending' | 'ok' | 'issue'

export interface FloatCheck {
  total: Cents
  /** Float items not ticked as correct. */
  unticked: FloatItem[]
  /**
   * - `ok`: everything ticked: good to go.
   * - `issue`: something isn't right and a note explains it.
   * - `pending`: not finished (something unticked, no note).
   */
  status: FloatStatus
}

export function checkFloat(float: FloatItem[], entry: FloatCheckEntry): FloatCheck {
  const unticked = float.filter((f) => !entry.ticks[f.denominationCents])
  const status: FloatStatus = unticked.length === 0 ? 'ok' : entry.note.trim() ? 'issue' : 'pending'
  return { total: floatTotal(float), unticked, status }
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

export function reconcile(sheet: Pick<TicketSheet, 'tickets' | 'cash' | 'eftpos' | 'donations'>): Reconciliation {
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

// ---------- Saving the start, and completing ----------

const floatProblem = (float: FloatItem[], entry: FloatCheckEntry, when: string) =>
  checkFloat(float, entry).status === 'pending' ? [`Tick each part of the float ${when}, or note what's wrong with it.`] : []

/** What's needed before "Save start of shift". */
export function startProblems(sheet: TicketSheet): string[] {
  const problems: string[] = []
  if (sheet.kind === 'event' && !sheet.eventName.trim()) problems.push('Name the event.')
  if (!sheet.cashiers.trim()) problems.push('Enter the cashier name(s).')
  if (!sheet.staff.trim()) problems.push('List the staff on shift.')
  if (sheet.tickets.every((t) => t.startSerial === null)) problems.push('Enter the start number for each ticket roll in use.')
  problems.push(...floatProblem(sheet.float, sheet.floatStart, 'before the shift'))
  return problems
}

/** Everything that must be sorted before the sheet can be completed. A discrepancy is allowed; it's reported. */
export function completionProblems(sheet: TicketSheet): string[] {
  const problems = startProblems(sheet)
  if (!sheet.startSavedAt) problems.push('Save the start of the shift first.')
  for (const t of sheet.tickets) {
    const r = ticketLineResult(t)
    if (r.problem) problems.push(r.problem)
    else if (t.startSerial !== null && t.endSerial === null) problems.push(`${t.name}: enter the end number.`)
  }
  problems.push(...floatProblem(sheet.float, sheet.floatEnd, 'after resetting it'))
  const eftpos = resolveEftpos(sheet.eftpos)
  if (eftpos.problem) problems.push(eftpos.problem)
  if (sheet.revision > 1 && !sheet.amendmentReason.trim()) problems.push('Give a reason for the correction.')
  if (!sheet.managerName.trim()) problems.push("Enter the shift manager's name.")
  if (!sheet.signature) problems.push('The shift manager needs to sign.')
  return problems
}

// ---------- Corrections (revisions) ----------

/** Starts a correction of a completed sheet. Everything carries over; it must be signed again. */
export function amendTicketSheet(previous: TicketSheet, id: string, now = new Date()): TicketSheet {
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

/** Plain-English list of what a correction changed. */
export function describeSheetChanges(before: TicketSheet, after: TicketSheet): string[] {
  const changes: string[] = []
  const change = (label: string, a: string, b: string) => a !== b && changes.push(`${label}: ${a || '(blank)'} → ${b || '(blank)'}`)
  const num = (n: number | null) => (n === null ? '' : String(n))
  const money = (n: Cents | null) => (n === null ? '' : formatMoney(n))

  change('Event', before.eventName, after.eventName)
  change('Cashiers', before.cashiers.trim(), after.cashiers.trim())
  change('Staff', before.staff.trim(), after.staff.trim())
  for (const t of after.tickets) {
    const old = before.tickets.find((b) => b.typeId === t.typeId)
    if (!old) continue
    change(`${t.name} start number`, num(old.startSerial), num(t.startSerial))
    change(`${t.name} end number`, num(old.endSerial), num(t.endSerial))
  }
  const floatText = (e: FloatCheckEntry, float: FloatItem[]) => {
    const c = checkFloat(float, e)
    return c.status === 'ok' ? 'correct' : `${c.unticked.map((f) => formatDenomination(f.denominationCents)).join(', ')} not confirmed${e.note ? ` (${e.note})` : ''}`
  }
  change('Float before the shift', floatText(before.floatStart, before.float), floatText(after.floatStart, after.float))
  change('Float after reset', floatText(before.floatEnd, before.float), floatText(after.floatEnd, after.float))
  change('Cash takings', formatMoney(countTotal(before.cash)), formatMoney(countTotal(after.cash)))
  change('EFTPOS takings', money(before.eftpos.takings), money(after.eftpos.takings))
  change('EFTPOS surcharge', money(before.eftpos.surcharge), money(after.eftpos.surcharge))
  change('EFTPOS total charged', money(before.eftpos.totalCharged), money(after.eftpos.totalCharged))
  change('Cash donations', money(before.donations.cash), money(after.donations.cash))
  change('EFTPOS donations', money(before.donations.eftpos), money(after.donations.eftpos))
  if (before.eftposReceipt !== after.eftposReceipt) changes.push('EFTPOS receipt photo changed')
  return changes
}
