import { describe, expect, it } from 'vitest'
import { formatDenomination, formatMoney, parseMoney, parseWhole } from './money'
import {
  balanceText,
  checkFloat,
  completionProblems,
  countTotal,
  DEFAULT_TICKET_SETTINGS,
  floatTotal,
  newTicketSheet,
  reconcile,
  resolveEftpos,
  startProblems,
  ticketLineResult,
  type Counts,
  type TicketSheet,
} from './tickets'

const FULL_FLOAT: Counts = { 100: 30, 200: 40, 500: 12, 1000: 8 }

function sheet(patch: Partial<TicketSheet> = {}): TicketSheet {
  return { ...newTicketSheet('s', 'victoria', DEFAULT_TICKET_SETTINGS, new Date(2026, 8, 27)), ...patch }
}

/** A finished Victoria shift: 20 one-way, 30 return, 5 supporter, 2 concession = $40 + $90 + $0 + $40 = $170. */
function finishedShift(): TicketSheet {
  const s = sheet({ cashier: 'Robin', floatStart: FULL_FLOAT, floatEnd: FULL_FLOAT })
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
  it('matches the $250 float from the spec', () => {
    expect(floatTotal(DEFAULT_TICKET_SETTINGS.float)).toBe(25000)
  })

  it('is good to go when every denomination matches', () => {
    const check = checkFloat(DEFAULT_TICKET_SETTINGS.float, FULL_FLOAT)
    expect(check).toMatchObject({ complete: true, ok: true, issues: [], countedTotal: 25000 })
  })

  it('names each denomination that is off, and by how much', () => {
    const check = checkFloat(DEFAULT_TICKET_SETTINGS.float, { ...FULL_FLOAT, 200: 38, 1000: 9 })
    expect(check.ok).toBe(false)
    expect(check.issues).toEqual(['$2: 38 counted, 40 expected ($4.00 short)', '$10: 9 counted, 8 expected ($10.00 over)'])
  })

  it('is incomplete until every denomination is counted', () => {
    expect(checkFloat(DEFAULT_TICKET_SETTINGS.float, { 100: 30 })).toMatchObject({ complete: false, ok: false })
  })

  it('flags money that should not be in the float', () => {
    expect(checkFloat(DEFAULT_TICKET_SETTINGS.float, { ...FULL_FLOAT, 2000: 1 }).issues).toEqual(['$20: 1 counted, none expected in the float'])
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

describe('completion', () => {
  it('lists what is needed before the shift', () => {
    expect(startProblems(sheet())).toEqual([
      "Enter the cashier's name.",
      'Enter the start number for each ticket roll in use.',
      'Count the float before the shift.',
    ])
  })

  it('allows completion of a finished shift, even with a discrepancy', () => {
    expect(completionProblems(finishedShift())).toEqual([])
    const s = finishedShift()
    s.cash = {}
    expect(completionProblems(s)).toEqual([])
  })

  it('needs end numbers, the float reset, and consistent EFTPOS figures', () => {
    const s = finishedShift()
    s.tickets[0] = { ...s.tickets[0], endSerial: null }
    s.floatEnd = {}
    s.eftpos = { takings: 100, totalCharged: null, surcharge: null }
    expect(completionProblems(s)).toEqual([
      'One-way: enter the end number.',
      'Count the float after resetting it.',
      'Enter two of the three EFTPOS amounts.',
    ])
  })
})
