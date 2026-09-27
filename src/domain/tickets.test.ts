import { describe, expect, it } from 'vitest'
import { formatDenomination, formatMoney, parseMoney, parseWhole } from './money'
import { currentRecords, revisionChainOf } from './revisions'
import {
  amendTicketSheet,
  balanceText,
  checkFloat,
  completionProblems,
  countTotal,
  DEFAULT_TICKET_SETTINGS,
  describeSheetChanges,
  floatItemLabel,
  floatTotal,
  newTicketSheet,
  reconcile,
  resolveEftpos,
  sheetTitle,
  startProblems,
  ticketLineResult,
  type FloatCheckEntry,
  type TicketSheet,
} from './tickets'

const ALL_TICKED: FloatCheckEntry = { ticks: { 100: true, 200: true, 500: true, 1000: true }, note: '' }
const DAY = new Date(2026, 8, 27)

function sheet(patch: Partial<TicketSheet> = {}): TicketSheet {
  return { ...newTicketSheet('s', 'victoria', DEFAULT_TICKET_SETTINGS, 'regular', DAY), ...patch }
}

/** A finished Victoria shift: 20 one-way, 30 return, 5 supporter, 2 concession = $40 + $90 + $0 + $40 = $170. */
function finishedShift(): TicketSheet {
  const s = sheet({
    cashiers: 'Robin',
    staff: 'Sam (manager)\nAlex (driver)',
    floatStart: ALL_TICKED,
    floatEnd: ALL_TICKED,
    startSavedAt: new Date(2026, 8, 27, 9).toISOString(),
    managerName: 'Sam',
    signature: 'data:image/png;base64,x',
  })
  const serials: Record<string, [number, number]> = {
    'one-way': [123456, 123476],
    return: [200100, 200130],
    supporter: [5000, 5005],
    concession: [900, 902],
  }
  s.tickets = s.tickets.map((t) => ({ ...t, startSerial: serials[t.typeId][0], endSerial: serials[t.typeId][1] }))
  s.cash = { 200: 10, 500: 4, 1000: 3 } // $20 + $20 + $30 = $70
  s.eftpos = { takings: 11000, totalCharged: null, surcharge: 250 } // $110, surcharge $2.50
  s.donations = { cash: 500, eftpos: 500 } // $10 in donations
  return s
}

describe('money', () => {
  it('formats cents as NZ dollars', () => {
    expect(formatMoney(123450)).toBe('$1,234.50')
    expect(formatMoney(-300)).toBe('-$3.00')
    expect(formatDenomination(50)).toBe('50c')
    expect(formatDenomination(10000)).toBe('$100')
  })

  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['$12.50', 1250],
    ['1,200', 120000],
    ['.5', 50],
    ['', null],
  ])('parses %j', (text, cents) => {
    expect(parseMoney(text)).toBe(cents)
  })

  it.each(['12.345', 'abc', '.', '-5'])('rejects %j', (text) => {
    expect(parseMoney(text)).toBeNaN()
  })

  it('parses whole numbers only', () => {
    expect(parseWhole(' 123456 ')).toBe(123456)
    expect(parseWhole('')).toBeNull()
    expect(parseWhole('12.5')).toBeNaN()
  })
})

describe('ticketLineResult', () => {
  const line = sheet().tickets[1] // Return, $3

  it('sold = end − start, where end is the first ticket left on the roll', () => {
    expect(ticketLineResult({ ...line, startSerial: 123456, endSerial: 123789 })).toEqual({ sold: 333, valueCents: 99900, problem: null })
  })

  it('treats a roll that was never used as nothing sold', () => {
    expect(ticketLineResult(line)).toEqual({ sold: null, valueCents: 0, problem: null })
  })

  it('flags an end number lower than the start', () => {
    expect(ticketLineResult({ ...line, startSerial: 500, endSerial: 499 }).problem).toMatch(/lower than the start/)
  })
})

describe('float', () => {
  const float = DEFAULT_TICKET_SETTINGS.float

  it('matches the $250 float from the spec', () => {
    expect(floatTotal(float)).toBe(25000)
  })

  it('describes each part the way it is checked', () => {
    expect(float.map(floatItemLabel)).toEqual(['$1 coins: 3 bags × 10', '$2 coins: 4 bags × 10', '$5 notes: 1 bag × 12', '$10 notes: 1 bag × 8'])
  })

  it('is good to go once every part is ticked', () => {
    expect(checkFloat(float, ALL_TICKED)).toMatchObject({ status: 'ok', unticked: [] })
  })

  it('is unfinished while something is unticked and unexplained', () => {
    expect(checkFloat(float, { ticks: { 100: true }, note: '' }).status).toBe('pending')
  })

  it('records an issue when something is unticked with a note', () => {
    const check = checkFloat(float, { ticks: { ...ALL_TICKED.ticks, 200: false }, note: 'One $2 bag short by 2 coins' })
    expect(check.status).toBe('issue')
    expect(check.unticked.map((f) => f.denominationCents)).toEqual([200])
  })
})

describe('resolveEftpos', () => {
  it('works out total charged from takings and surcharge', () => {
    expect(resolveEftpos({ takings: 10000, totalCharged: null, surcharge: 150 })).toMatchObject({ totalCharged: 10150, calculated: 'totalCharged', problem: null })
  })

  it('works out takings from total charged and surcharge', () => {
    expect(resolveEftpos({ takings: null, totalCharged: 10150, surcharge: 150 })).toMatchObject({ takings: 10000, calculated: 'takings' })
  })

  it('works out the surcharge from total charged and takings', () => {
    expect(resolveEftpos({ takings: 10000, totalCharged: 10150, surcharge: null })).toMatchObject({ surcharge: 150, calculated: 'surcharge' })
  })

  it('accepts all three when they add up, and flags them when they don’t', () => {
    expect(resolveEftpos({ takings: 10000, totalCharged: 10150, surcharge: 150 }).problem).toBeNull()
    expect(resolveEftpos({ takings: 10000, totalCharged: 10200, surcharge: 150 }).problem).toMatch(/don't add up/)
  })

  it('needs two values, but none at all means no EFTPOS today', () => {
    expect(resolveEftpos({ takings: 5000, totalCharged: null, surcharge: null }).problem).toMatch(/two of the three/)
    expect(resolveEftpos({ takings: null, totalCharged: null, surcharge: null }).problem).toBeNull()
  })
})

describe('reconcile', () => {
  it('balances when money taken matches the tickets sold', () => {
    // $70 cash + $110 EFTPOS (surcharge excluded) − $10 donations = $170
    const r = reconcile(finishedShift())
    expect(r).toMatchObject({
      ticketsSold: 57,
      ticketValue: 17000,
      cashTakings: 7000,
      eftposTakings: 11000,
      donations: 1000,
      moneyForTickets: 17000,
      difference: 0,
      balance: 'balanced',
    })
    expect(balanceText(r)).toBe('Balanced: takings match tickets sold')
  })

  it('reports a shortfall', () => {
    const s = finishedShift()
    s.cash = { ...s.cash, 1000: 2 } // $10 less cash
    const r = reconcile(s)
    expect(r).toMatchObject({ difference: -1000, balance: 'short' })
    expect(balanceText(r)).toBe('Short by $10.00')
  })

  it('reports money over', () => {
    const s = finishedShift()
    s.donations = { cash: 0, eftpos: 500 } // $5 cash donation not recorded
    expect(balanceText(reconcile(s))).toBe('Over by $5.00')
  })

  it('counts total cash from piece counts', () => {
    expect(countTotal({ 10: 3, 20: 1, 50: 1, 10000: 1 })).toBe(10100)
  })
})

describe('start of shift and completion', () => {
  it('lists what is needed before saving the start of the shift', () => {
    expect(startProblems(sheet())).toEqual([
      'Enter the cashier name(s).',
      'List the staff on shift.',
      'Enter the start number for each ticket roll in use.',
      "Tick each part of the float before the shift, or note what's wrong with it.",
    ])
  })

  it('allows completion of a finished shift, even with a discrepancy', () => {
    expect(completionProblems(finishedShift())).toEqual([])
    const s = finishedShift()
    s.cash = {}
    expect(completionProblems(s)).toEqual([])
  })

  it('needs the start saved, end numbers, the float reset, EFTPOS figures and a signature', () => {
    const s = finishedShift()
    s.startSavedAt = null
    s.tickets[0] = { ...s.tickets[0], endSerial: null }
    s.floatEnd = { ticks: {}, note: '' }
    s.eftpos = { takings: 100, totalCharged: null, surcharge: null }
    s.signature = null
    expect(completionProblems(s)).toEqual([
      'Save the start of the shift first.',
      'One-way: enter the end number.',
      "Tick each part of the float after resetting it, or note what's wrong with it.",
      'Enter two of the three EFTPOS amounts.',
      'The shift manager needs to sign.',
    ])
  })

  it('accepts a float issue once it is explained', () => {
    const s = finishedShift()
    s.floatEnd = { ticks: { ...ALL_TICKED.ticks, 200: false }, note: '$2 bag short 2 coins, topped up from takings' }
    expect(completionProblems(s)).toEqual([])
  })
})

describe('special event sheets', () => {
  const event = newTicketSheet('e', 'playground', DEFAULT_TICKET_SETTINGS, 'event', DAY)

  it('only has the event ticket, purple at $5', () => {
    expect(event.tickets).toEqual([{ typeId: 'event', name: 'Event', priceCents: 500, colour: 'Purple', startSerial: null, endSerial: null }])
  })

  it('needs the event named', () => {
    expect(startProblems(event)[0]).toBe('Name the event.')
    expect(sheetTitle({ ...event, eventName: 'Halloween run' })).toBe('Playground Station special event: Halloween run')
  })

  it('reconciles the same way', () => {
    const done = { ...event, tickets: [{ ...event.tickets[0], startSerial: 100, endSerial: 140 }], cash: { 2000: 10 } }
    expect(reconcile(done)).toMatchObject({ ticketsSold: 40, ticketValue: 20000, balance: 'balanced' })
  })
})

describe('corrections', () => {
  const original = { ...finishedShift(), id: 'rev1', completedAt: new Date(2026, 8, 27, 16).toISOString() }

  it('copies everything, links to the original and needs a new signature and reason', () => {
    const rev2 = amendTicketSheet(original, 'rev2')
    expect(rev2).toMatchObject({ revision: 2, amendsId: 'rev1', completedAt: null, signature: null, managerName: 'Sam' })
    expect(completionProblems({ ...rev2, signature: 'x' })).toEqual(['Give a reason for the correction.'])
  })

  it('lists what was corrected', () => {
    const rev2 = amendTicketSheet(original, 'rev2')
    rev2.tickets[1] = { ...rev2.tickets[1], endSerial: 200131 }
    rev2.cash = { ...rev2.cash, 500: 5 }
    expect(describeSheetChanges(original, rev2)).toEqual(['Return end number: 200130 → 200131', 'Cash takings: $70.00 → $75.00'])
  })

  it('lists only the latest signed-off revision', () => {
    const rev2 = { ...amendTicketSheet(original, 'rev2'), completedAt: new Date(2026, 8, 28).toISOString() }
    expect(currentRecords([original, rev2]).map((s) => s.id)).toEqual(['rev2'])
    expect(revisionChainOf(rev2, [rev2, original]).map((s) => s.id)).toEqual(['rev1', 'rev2'])
  })
})
