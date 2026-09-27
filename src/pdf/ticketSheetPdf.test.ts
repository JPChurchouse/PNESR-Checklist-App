import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TICKET_SETTINGS, newTicketSheet, type TicketSheet } from '../domain/tickets'
import { buildTicketSheetPdf, ticketSheetFilename } from './ticketSheetPdf'

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function sampleSheet(): TicketSheet {
  const sheet = newTicketSheet('s', 'playground', DEFAULT_TICKET_SETTINGS, new Date(2026, 8, 27, 9, 0))
  const serials: Record<string, [number, number] | null> = {
    'one-way': [123456, 123476],
    return: [200100, 200130],
    supporter: [5000, 5005],
    concession: null, // roll not used today
  }
  return {
    ...sheet,
    cashier: 'Robin Example',
    completedAt: new Date(2026, 8, 27, 16, 30).toISOString(),
    tickets: sheet.tickets.map((t) => ({ ...t, startSerial: serials[t.typeId]?.[0] ?? null, endSerial: serials[t.typeId]?.[1] ?? null })),
    floatStart: { 100: 30, 200: 40, 500: 12, 1000: 8 },
    floatEnd: { 100: 30, 200: 38, 500: 12, 1000: 8 },
    cash: { 200: 10, 500: 4, 1000: 2 }, // $60
    eftpos: { takings: 7000, totalCharged: 7175, surcharge: null },
    donations: { cash: 0, eftpos: 500 },
    notes: 'Two $2 coins found in the tin after the float was bagged.',
    eftposReceipt: TINY_PNG,
  }
}

function text(sheet: TicketSheet) {
  const doc = buildTicketSheetPdf(sheet, { compress: false })
  if (process.env.PDF_PREVIEW) writeFileSync(`${process.env.PDF_PREVIEW}/ticket-sheet.pdf`, Buffer.from(doc.output('arraybuffer')))
  // PDF strings escape brackets as \( and \).
  return new TextDecoder('latin1').decode(doc.output('arraybuffer')).replace(/\\([()])/g, '$1')
}

describe('buildTicketSheetPdf', () => {
  it('states the outcome and shows each step of the calculation', () => {
    // Tickets: 20 × $2 + 30 × $3 = $130. Money: $60 cash + $70 EFTPOS − $5 donations = $125. Short $5.
    const pdf = text(sampleSheet())
    for (const expected of [
      'Ticket Sales Sheet: Playground Station',
      'Robin Example',
      'Short by $5.00',
      'Not used',
      '$130.00',
      '$125.00',
      '$1.75 (calculated)',
      'ISSUE',
      '$2: 38 counted, 40 expected ($4.00 short)',
      'Two $2 coins found',
      'EFTPOS receipt',
    ])
      expect(pdf).toContain(expected)
  })

  it('names the file after the station and date', () => {
    expect(ticketSheetFilename(sampleSheet())).toBe('tickets-playground-2026-09-27.pdf')
  })
})
