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

  it('is applied to text drawn on the page', () => {
    const doc = createDoc(false)
    doc.text('Kia ora Tūī', 10, 10)
    expect(new TextDecoder('latin1').decode(doc.output('arraybuffer'))).toContain('Kia ora Tui')
  })
})
