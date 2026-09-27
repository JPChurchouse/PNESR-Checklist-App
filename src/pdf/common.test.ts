import { describe, expect, it } from 'vitest'
import { createDoc, pdfSafe } from './common'

describe('pdfSafe', () => {
  it('keeps everything the built-in fonts can draw', () => {
    expect(pdfSafe('Café — “quoted” · $1.50 ½')).toBe('Café — “quoted” · $1.50 ½')
  })

  it('drops macrons rather than garbling them', () => {
    expect(pdfSafe('Manawatū, Tūī, Māori')).toBe('Manawatu, Tui, Maori')
  })

  it('swaps symbols with no equivalent', () => {
    expect(pdfSafe('− ✓ 🚂')).toBe('- Y ?')
  })

  it('keeps line breaks in table cells', async () => {
    const { autoTable } = await import('jspdf-autotable')
    const doc = createDoc({ compress: false })
    autoTable(doc, { body: [['First line\nSecond Tūī line']] })
    const raw = new TextDecoder('latin1').decode(doc.output('arraybuffer'))
    expect(raw).toContain('(First line) Tj')
    expect(raw).toContain('(Second Tui line) Tj')
  })

  it('is applied to text drawn on the page', () => {
    const doc = createDoc({ compress: false })
    doc.text('Kia ora Tūī', 10, 10)
    expect(new TextDecoder('latin1').decode(doc.output('arraybuffer'))).toContain('Kia ora Tui')
  })
})

describe('practice documents', () => {
  it('are marked as practice in the header, footer and a watermark', async () => {
    const { drawFooters, drawHeader } = await import('./common')
    const doc = createDoc({ compress: false, practice: true })
    drawHeader(doc, 'Ticket Sales Sheet')
    drawFooters(doc, 'test')
    const raw = new TextDecoder('latin1').decode(doc.output('arraybuffer')).replace(/\\([()])/g, '$1')
    expect(raw).toContain('Ticket Sales Sheet (PRACTICE)')
    expect(raw).toContain('PRACTICE - NOT A REAL RECORD')
    expect(raw).toContain('(PRACTICE) Tj')
  })
})
