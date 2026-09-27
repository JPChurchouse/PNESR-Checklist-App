import { GState, jsPDF } from 'jspdf'

import { formatDateTime } from '../lib/dates'

export { formatDate, formatDateTime, formatTime } from '../lib/dates'

export const ORG_NAME = 'Palmerston North Esplanade Scenic Railway'

// Printed colours, from the app theme. Pass/fail use plain green/red so they read on any printer.
export const COLOURS = {
  fern: [74, 90, 34] as const,
  fernDark: [43, 51, 20] as const,
  red: [215, 25, 32] as const,
  ok: [29, 122, 58] as const,
  fail: [179, 38, 30] as const,
  muted: [91, 97, 73] as const,
  text: [31, 36, 18] as const,
  rowAlt: [245, 246, 236] as const,
  practice: [217, 119, 6] as const,
}

export const MARGIN = 14

// The built-in PDF fonts only cover the Windows-1252 character set. Anything else (e.g. macrons,
// the − sign) is swapped for the nearest character so it never comes out garbled.
const WIN_ANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const REPLACEMENTS: Record<string, string> = { '−': '-', '→': '->', '✓': 'Y', '✕': 'X', '≠': '!=', ' ': ' ', ' ': ' ' }

export function pdfSafe(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || ch === '\n' || WIN_ANSI_EXTRAS.includes(ch)) out += ch
    else if (REPLACEMENTS[ch]) out += REPLACEMENTS[ch]
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
      out += base !== ch && [...base].every((c) => c.codePointAt(0)! < 0x100) ? base : '?'
    }
  }
  return out
}

/** Documents made in practice mode: orange header, "PRACTICE" watermark and footer. */
const practiceDocs = new WeakSet<jsPDF>()

export interface DocOptions {
  /** false keeps the text readable in the raw bytes, for tests */
  compress?: boolean
  /** Made in practice mode, so marked as not a real record. */
  practice?: boolean
}

/** A4 document whose text (including tables) is passed through `pdfSafe`. */
export function createDoc({ compress = true, practice = false }: DocOptions = {}): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress })
  if (practice) practiceDocs.add(doc)
  const text = doc.text.bind(doc)
  const splitTextToSize = doc.splitTextToSize.bind(doc)
  const clean = (t: unknown): unknown => (typeof t === 'string' ? pdfSafe(t) : Array.isArray(t) ? t.map(clean) : t)
  doc.text = ((t: string | string[], ...rest: Parameters<jsPDF['text']> extends [unknown, ...infer R] ? R : never) =>
    text(clean(t) as string | string[], ...rest)) as jsPDF['text']
  // autotable passes a list of lines here, not just a single string.
  doc.splitTextToSize = ((t: string | string[], ...rest: [number, object?]) => splitTextToSize(clean(t) as string, ...rest)) as jsPDF['splitTextToSize']
  return doc
}

/** Where the last autoTable finished on the page. */
export const tableEnd = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

/** Green band across the top of the first page with the document title. */
export function drawHeader(doc: jsPDF, title: string) {
  const width = doc.internal.pageSize.getWidth()
  const practice = practiceDocs.has(doc)
  const [r, g, b] = practice ? COLOURS.practice : COLOURS.fernDark
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, width, 26, 'F')
  doc.setFillColor(...COLOURS.red)
  doc.rect(0, 26, width, 1.2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(ORG_NAME, MARGIN, 10)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(practice ? `${title} (PRACTICE)` : title, MARGIN, 20)
  doc.setTextColor(...COLOURS.text)
  return 36
}

/** "Label: value" lines. Returns the y position after the block. */
export function drawFacts(doc: jsPDF, y: number, facts: [string, string][]) {
  doc.setFontSize(10.5)
  for (const [label, value] of facts) {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, MARGIN + 38, y)
    y += 6
  }
  return y
}

export function drawSectionTitle(doc: jsPDF, y: number, title: string) {
  y = ensureSpace(doc, y, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...COLOURS.fernDark)
  doc.text(title, MARGIN, y)
  doc.setTextColor(...COLOURS.text)
  return y + 3
}

/** Starts a new page if fewer than `needed` mm are left. */
export function ensureSpace(doc: jsPDF, y: number, needed: number) {
  const bottom = doc.internal.pageSize.getHeight() - 16
  if (y + needed <= bottom) return y
  doc.addPage()
  return 18
}

/** Wrapped body text. Returns the y position after it. */
export function drawParagraph(doc: jsPDF, y: number, text: string) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const lines: string[] = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - MARGIN * 2)
  y = ensureSpace(doc, y + 3, lines.length * 5)
  doc.text(lines, MARGIN, y + 2)
  return y + lines.length * 5 + 8
}

/** Shift manager's name, sign-off time and signature, at the end of a document. */
export function drawSignOff(doc: jsPDF, y: number, managerName: string, completedAt: string | null, signature: string | null) {
  y = drawSectionTitle(doc, ensureSpace(doc, y, 55), 'Sign-off')
  y = drawFacts(doc, y + 5, [
    ['Shift manager', managerName || '—'],
    ['Signed off', completedAt ? formatDateTime(completedAt) : 'NOT SIGNED OFF'],
  ])
  doc.setFont('helvetica', 'bold')
  doc.text('Signature:', MARGIN, y)
  const x = MARGIN + 38
  const top = y - 3
  const h = 25
  if (signature) {
    const props = doc.getImageProperties(signature)
    doc.addImage(signature, 'PNG', x, top, Math.min(90, (props.width / props.height) * h), h, undefined, 'FAST')
  }
  doc.setDrawColor(...COLOURS.muted)
  doc.line(x, top + h + 1, x + 90, top + h + 1)
  return top + h + 8
}

/** A coloured banner stating the overall outcome, so it can't be missed. */
export function drawOutcome(doc: jsPDF, y: number, ok: boolean, text: string) {
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2
  const [r, g, b] = ok ? COLOURS.ok : COLOURS.fail
  doc.setFillColor(r, g, b)
  doc.roundedRect(MARGIN, y, width, 11, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(text, MARGIN + 4, y + 7.3)
  doc.setTextColor(...COLOURS.text)
  return y + 17
}

export function drawFooters(doc: jsPDF, label: string) {
  const pages = doc.getNumberOfPages()
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...COLOURS.muted)
    doc.text(`${practiceDocs.has(doc) ? 'PRACTICE - NOT A REAL RECORD · ' : ''}${ORG_NAME} · ${label}`, MARGIN, height - 8)
    doc.text(`Page ${i} of ${pages}`, width - MARGIN, height - 8, { align: 'right' })
    if (practiceDocs.has(doc)) {
      doc.saveGraphicsState()
      doc.setGState(new GState({ opacity: 0.12 }))
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(96)
      doc.setTextColor(...COLOURS.practice)
      doc.text('PRACTICE', width / 2, height / 2, { align: 'center', angle: 45, baseline: 'middle' })
      doc.restoreGraphicsState()
    }
  }
  doc.setTextColor(...COLOURS.text)
}

export const tableTheme = {
  theme: 'grid' as const,
  margin: { left: MARGIN, right: MARGIN, top: 18, bottom: 18 },
  styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 1.8, textColor: [...COLOURS.text] as [number, number, number], lineColor: [211, 215, 192] as [number, number, number], lineWidth: 0.2 },
  headStyles: { fillColor: [...COLOURS.fern] as [number, number, number], textColor: 255, fontStyle: 'bold' as const },
  alternateRowStyles: { fillColor: [...COLOURS.rowAlt] as [number, number, number] },
}
