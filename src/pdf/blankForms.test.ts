import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TICKET_SETTINGS } from '../domain/tickets'
import { buildBlankSafetyCheckPdf, buildBlankTicketSheetPdf } from './blankForms'

function text(doc: { output(type: 'arraybuffer'): ArrayBuffer }, previewName: string) {
  if (process.env.PDF_PREVIEW) writeFileSync(`${process.env.PDF_PREVIEW}/${previewName}.pdf`, Buffer.from(doc.output('arraybuffer')))
  return new TextDecoder('latin1').decode(doc.output('arraybuffer')).replace(/\\([()])/g, '$1')
}

describe('blank paper forms', () => {
  it('safety check has every check, a grid per train and a sign-off', () => {
    const pdf = text(buildBlankSafetyCheckPdf({ compress: false }), 'blank-safety-check')
    for (const expected of ['Pre-operation Safety Check', 'Radio checks', 'Sufficient fuel', 'Tail lights operating (guard carriage)', 'Train 3', 'Carriage ID (front to back)', 'Ready to operate', 'Signature:'])
      expect(pdf).toContain(expected)
  })

  it('ticket sheet uses the station colours, float and denominations from settings', () => {
    const pdf = text(buildBlankTicketSheetPdf(DEFAULT_TICKET_SETTINGS, 'playground', 'regular', { compress: false }), 'blank-ticket-sheet')
    for (const expected of ['Ticket Sales Sheet: Playground Station', 'Orange', '$20.00', '$2 coins: 4 bags', '$100', 'Money for tickets: A + B - C =', 'Short'])
      expect(pdf).toContain(expected)
  })

  it('special event version only lists the event ticket', () => {
    const pdf = text(buildBlankTicketSheetPdf(DEFAULT_TICKET_SETTINGS, 'victoria', 'event', { compress: false }), 'blank-event-sheet')
    expect(pdf).toContain('Special Event Ticket Sheet')
    expect(pdf).toContain('Event:')
    expect(pdf).not.toContain('Concession')
  })
})
