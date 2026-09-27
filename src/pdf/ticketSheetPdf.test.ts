import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { amendTicketSheet, DEFAULT_TICKET_SETTINGS, newTicketSheet, type TicketSheet } from '../domain/tickets'
import { buildTicketSheetPdf, ticketSheetFilename } from './ticketSheetPdf'

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const ALL = { 100: true, 200: true, 500: true, 1000: true }

function sampleSheet(): TicketSheet {
  const sheet = newTicketSheet('s', 'playground', DEFAULT_TICKET_SETTINGS, 'regular', new Date(2026, 8, 27, 9, 0))
  const serials: Record<string, [number, number] | null> = {
    'one-way': [123456, 123476],
    return: [200100, 200130],
    supporter: [5000, 5005],
    concession: null, // roll not used today
  }
  return {
    ...sheet,
    cashiers: 'Robin Example, Tūī Example',
    staff: 'Sam Example (manager)\nAlex Example (driver)\nJo Example (guard)',
    startSavedAt: new Date(2026, 8, 27, 9, 30).toISOString(),
    completedAt: new Date(2026, 8, 27, 16, 30).toISOString(),
    tickets: sheet.tickets.map((t) => ({ ...t, startSerial: serials[t.typeId]?.[0] ?? null, endSerial: serials[t.typeId]?.[1] ?? null })),
    floatStart: { ticks: ALL, note: '' },
    floatEnd: { ticks: { ...ALL, 200: false }, note: 'One $2 bag was 2 coins short.' },
    cash: { 200: 10, 500: 4, 1000: 2 }, // $60
    eftpos: { takings: 7000, totalCharged: 7175, surcharge: null },
    donations: { cash: 0, eftpos: 500 },
    notes: 'Two $2 coins found in the tin after the float was bagged.',
    eftposReceipt: TINY_PNG,
    managerName: 'Sam Example',
    signature: TINY_PNG,
  }
}

function text(sheet: TicketSheet, chain?: TicketSheet[], previewName?: string) {
  const doc = buildTicketSheetPdf(sheet, chain, { compress: false })
  if (process.env.PDF_PREVIEW && previewName) writeFileSync(`${process.env.PDF_PREVIEW}/${previewName}.pdf`, Buffer.from(doc.output('arraybuffer')))
  // PDF strings escape brackets as \( and \).
  return new TextDecoder('latin1').decode(doc.output('arraybuffer')).replace(/\\([()])/g, '$1')
}

describe('buildTicketSheetPdf', () => {
  it('states the outcome and shows each step of the calculation', () => {
    // Tickets: 20 × $2 + 30 × $3 = $130. Money: $60 cash + $70 EFTPOS − $5 donations = $125. Short $5.
    const pdf = text(sampleSheet(), undefined, 'ticket-sheet')
    for (const expected of [
      'Ticket Sales Sheet',
      'Robin Example, Tui Example',
      '2026-09-27 09:30',
      'Short by $5.00',
      'Not used',
      '$130.00',
      '$125.00',
      '$1.75 (calculated)',
      '$2 coins: 4 bags × 10',
      'NOT CONFIRMED',
      'One $2 bag was 2 coins short.',
      'Jo Example (guard)',
      'Sign-off',
      'EFTPOS receipt',
    ])
      expect(pdf).toContain(expected)
  })

  it('shows the revision history of a corrected sheet', () => {
    const rev1 = sampleSheet()
    const rev2: TicketSheet = {
      ...amendTicketSheet(rev1, 'rev2'),
      amendmentReason: 'Miscounted $10 notes',
      cash: { ...rev1.cash, 1000: 3 },
      completedAt: new Date(2026, 8, 28, 10).toISOString(),
    }
    const pdf = text(rev2, [rev1, rev2], 'ticket-sheet-rev2')
    for (const expected of ['Revision history', 'Miscounted $10 notes', 'Cash takings: $60.00 -> $70.00', 'Over by $5.00']) expect(pdf).toContain(expected)
    expect(ticketSheetFilename(rev2)).toBe('tickets-playground-2026-09-27-rev2.pdf')
  })

  it('makes a special event sheet', () => {
    const event = newTicketSheet('e', 'victoria', DEFAULT_TICKET_SETTINGS, 'event', new Date(2026, 9, 31))
    const pdf = text({ ...event, eventName: 'Halloween run', tickets: [{ ...event.tickets[0], startSerial: 100, endSerial: 160 }] }, undefined, 'event-sheet')
    for (const expected of ['Special Event Ticket Sheet', 'Halloween run', 'Event', 'Purple', '$300.00']) expect(pdf).toContain(expected)
    expect(ticketSheetFilename(event)).toBe('tickets-victoria-event-2026-10-31.pdf')
  })

  it('names the file after the station and date', () => {
    expect(ticketSheetFilename(sampleSheet())).toBe('tickets-playground-2026-09-27.pdf')
  })
})
