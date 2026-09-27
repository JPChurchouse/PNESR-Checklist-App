// Blank paper versions of the forms, generated from the same checklist and ticket settings as
// the app, for days when no device is available. Filled in by hand, then entered later if wanted.

import type { jsPDF } from 'jspdf'
import { autoTable, type CellHookData, type RowInput } from 'jspdf-autotable'
import { formatMoney, formatDenomination } from '../domain/money'
import { CARRIAGE_CHECKS, LOCO_CHECKS, MAX_TRAINS, SPECIALTY_CHECKS, TRACK_CHECKS } from '../domain/safetyCheck'
import { MAX_SET_LENGTH } from '../domain/sets'
import { DENOMINATIONS, floatItemLabel, STATIONS, type SheetKind, type StationId, type TicketSettings } from '../domain/tickets'
import { COLOURS, createDoc, drawFooters, drawHeader, drawSectionTitle, ensureSpace, MARGIN, tableEnd, tableTheme, type DocOptions } from './common'

/** Cell markers: a tick box, or a shaded "doesn't apply" cell. */
const BOX = '\u0001box'
const NA = '\u0001na'
const BOX_SIZE = 4.2

/** Draws tick boxes and shades cells that don't apply. */
function boxes(data: CellHookData) {
  if (data.section !== 'body') return
  if (data.cell.raw === BOX || data.cell.raw === NA) data.cell.text = ['']
  if (data.cell.raw === NA) data.cell.styles.fillColor = [225, 228, 214]
}
function drawBoxes(doc: jsPDF) {
  return (data: CellHookData) => {
    if (data.section !== 'body' || data.cell.raw !== BOX) return
    const { x, y, width, height } = data.cell
    doc.setDrawColor(...COLOURS.text)
    doc.setLineWidth(0.3)
    doc.rect(x + (width - BOX_SIZE) / 2, y + (height - BOX_SIZE) / 2, BOX_SIZE, BOX_SIZE)
  }
}

/** Label with a line to write on, across the page. Returns the y after it. */
function writeLine(doc: jsPDF, y: number, label: string, x = MARGIN, width = doc.internal.pageSize.getWidth() - MARGIN * 2) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(label, x, y)
  const start = x + doc.getTextWidth(label) + 2
  doc.setDrawColor(...COLOURS.muted)
  doc.setLineWidth(0.25)
  doc.line(start, y + 0.8, x + width, y + 0.8)
  return y + 9
}

/** Several labelled lines side by side. */
function writeLines(doc: jsPDF, y: number, labels: string[]) {
  const total = doc.internal.pageSize.getWidth() - MARGIN * 2
  const gap = 6
  const width = (total - gap * (labels.length - 1)) / labels.length
  labels.forEach((label, i) => writeLine(doc, y, label, MARGIN + i * (width + gap), width))
  return y + 9
}

function blankLines(doc: jsPDF, y: number, count: number) {
  doc.setDrawColor(...COLOURS.muted)
  for (let i = 0; i < count; i++) doc.line(MARGIN, y + i * 8, doc.internal.pageSize.getWidth() - MARGIN, y + i * 8)
  return y + count * 8 + 2
}

function tickOptions(doc: jsPDF, y: number, options: string[]) {
  let x = MARGIN
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setDrawColor(...COLOURS.text)
  for (const option of options) {
    doc.rect(x, y - 3.4, BOX_SIZE, BOX_SIZE)
    doc.text(option, x + BOX_SIZE + 2, y)
    x += BOX_SIZE + 2 + doc.getTextWidth(option) + 10
  }
  return y + 9
}

function signOff(doc: jsPDF, y: number) {
  y = drawSectionTitle(doc, ensureSpace(doc, y, 40), 'Sign-off') + 7
  y = writeLines(doc, y, ['Shift manager:', 'Time signed:'])
  return writeLine(doc, y + 6, 'Signature:')
}

// ---------- Safety check ----------

export function buildBlankSafetyCheckPdf(options: DocOptions = {}): jsPDF {
  const doc = createDoc(options)
  let y = drawHeader(doc, 'Pre-operation Safety Check')
  y = writeLines(doc, y + 2, ['Date:', 'Shift manager:'])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...COLOURS.muted)
  doc.text(
    doc.splitTextToSize(
      'Tick each item once it has been checked and is OK. If something can’t be fixed, swap the vehicle out and write down the change.',
      doc.internal.pageSize.getWidth() - MARGIN * 2,
    ),
    MARGIN,
    y - 2,
  )
  doc.setTextColor(...COLOURS.text)
  y += 8

  y = drawSectionTitle(doc, y, 'Track')
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Check', 'Done']],
    body: TRACK_CHECKS.map((c) => [c.label, BOX]),
    columnStyles: { 1: { cellWidth: 16 } },
    bodyStyles: { minCellHeight: 8, valign: 'middle' },
    didParseCell: boxes,
    didDrawCell: drawBoxes(doc),
  })
  y = tableEnd(doc) + 9

  // One grid per train: rows are checks, columns are the loco and carriage positions.
  const positions = Array.from({ length: MAX_SET_LENGTH }, (_, i) => i + 1)
  const carriageColumn = (pos: number, applies: (pos: number) => boolean) => (applies(pos) ? BOX : NA)
  const first = (pos: number) => pos === 1
  const last = (pos: number) => pos === MAX_SET_LENGTH
  const middle = (pos: number) => !first(pos) && !last(pos)
  const guardChecks = SPECIALTY_CHECKS.guard.filter((c) => c.id !== 'extinguisher')

  const rows: RowInput[] = [
    ...LOCO_CHECKS.map((c) => [c.label, BOX, ...positions.map(() => NA)]),
    ...CARRIAGE_CHECKS.map((c) => [c.label, NA, ...positions.map(() => BOX)]),
    ['Fire extinguisher present (driver and guard carriages)', NA, ...positions.map((p) => carriageColumn(p, (q) => first(q) || last(q)))],
    ...guardChecks.map((c) => [`${c.label} (guard carriage)`, NA, ...positions.map((p) => carriageColumn(p, last))]),
    ...SPECIALTY_CHECKS.wheelchair.map((c) => [`${c.label} (wheelchair carriage only)`, NA, ...positions.map((p) => carriageColumn(p, middle))]),
  ]

  for (let train = 1; train <= MAX_TRAINS; train++) {
    y = drawSectionTitle(doc, ensureSpace(doc, y, 128), `Train ${train}`) + 7
    y = writeLines(doc, y, ['Loco:', 'Set:', 'Driver:', 'Guard:'])
    autoTable(doc, {
      ...tableTheme,
      startY: y - 3,
      head: [
        ['Check', 'Loco', ...positions.map((p) => (p === 1 ? '1 Driver' : p === MAX_SET_LENGTH ? `${p} Guard` : String(p)))],
        [{ content: 'Carriage ID (front to back)', styles: { fontStyle: 'italic' } }, '', ...positions.map(() => '')],
      ],
      body: rows,
      columnStyles: { 0: { cellWidth: 'auto' }, ...Object.fromEntries([1, ...positions].map((c) => [c, { cellWidth: 13, halign: 'center' as const }])) },
      bodyStyles: { minCellHeight: 7, valign: 'middle', fontSize: 8.5 },
      didParseCell: (data) => {
        boxes(data)
        if (data.section === 'head' && data.row.index === 1) {
          data.cell.styles.fillColor = [255, 255, 255]
          data.cell.styles.textColor = [...COLOURS.text]
          data.cell.styles.minCellHeight = 9
        }
      },
      didDrawCell: drawBoxes(doc),
    })
    y = tableEnd(doc) + 3
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...COLOURS.muted)
    doc.text('Shorter trains: leave unused middle columns blank. The guard carriage always goes in column 6.', MARGIN, y + 2)
    doc.setTextColor(...COLOURS.text)
    y += 11
  }

  y = drawSectionTitle(doc, ensureSpace(doc, y, 60), 'Outcome') + 7
  y = tickOptions(doc, y, ['Ready to operate: every check done', 'Can’t operate today (reason below)'])
  doc.setFont('helvetica', 'bold')
  doc.text('Reason / notes:', MARGIN, y)
  y = blankLines(doc, y + 8, 3)
  signOff(doc, y)

  drawFooters(doc, 'Safety check (paper form)')
  return doc
}

// ---------- Ticket sheet ----------

export function buildBlankTicketSheetPdf(settings: TicketSettings, station: StationId, kind: SheetKind = 'regular', options: DocOptions = {}): jsPDF {
  const doc = createDoc(options)
  const types = kind === 'event' ? settings.eventTicketTypes : settings.ticketTypes
  let y = drawHeader(doc, `${kind === 'event' ? 'Special Event Ticket Sheet' : 'Ticket Sales Sheet'}: ${STATIONS[station].name}`)
  y = writeLines(doc, y + 2, ['Date:', kind === 'event' ? 'Event:' : 'Cashier(s):'])
  if (kind === 'event') y = writeLine(doc, y, 'Cashier(s):')
  doc.setFont('helvetica', 'bold')
  doc.text('Staff on shift:', MARGIN, y)
  y = blankLines(doc, y + 7, 2) + 3

  y = drawSectionTitle(doc, y, 'Tickets')
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Ticket', 'Colour', 'Price', 'Start no.', 'End no.', 'Sold (end - start)', 'Value (sold x price)']],
    body: [...types.map((t) => [t.name, t.colours[station], formatMoney(t.priceCents), '', '', '', '']), [{ content: 'Total', colSpan: 5, styles: { fontStyle: 'bold' } }, '', '']],
    bodyStyles: { minCellHeight: 9, valign: 'middle' },
    columnStyles: { 2: { halign: 'right' }, 3: { cellWidth: 26 }, 4: { cellWidth: 26 } },
  })
  y = tableEnd(doc) + 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOURS.muted)
  doc.text('Start no. = first ticket on the roll. End no. = first ticket left on the roll at the end (the next one to be sold).', MARGIN, y + 2)
  doc.setTextColor(...COLOURS.text)
  y += 11

  y = drawSectionTitle(doc, ensureSpace(doc, y, 60), 'Float: tick each part once confirmed')
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Float', 'Amount', 'Before shift', 'After reset']],
    body: settings.float.map((f) => [floatItemLabel(f), formatMoney(f.denominationCents * f.perBag * f.bags), BOX, BOX]),
    bodyStyles: { minCellHeight: 8, valign: 'middle' },
    columnStyles: { 1: { halign: 'right' }, 2: { cellWidth: 28 }, 3: { cellWidth: 28 } },
    didParseCell: boxes,
    didDrawCell: drawBoxes(doc),
  })
  y = tableEnd(doc) + 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Anything wrong with the float:', MARGIN, y)
  y = blankLines(doc, y + 7, 1) + 5

  y = drawSectionTitle(doc, ensureSpace(doc, y, 110), 'Cash takings (after the float is reset)')
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Note / coin', 'How many', 'Value']],
    body: [...[...DENOMINATIONS].reverse().map((d) => [formatDenomination(d.cents), '', '']), [{ content: 'Total cash (A)', colSpan: 2, styles: { fontStyle: 'bold' } }, '']],
    bodyStyles: { minCellHeight: 7.5, valign: 'middle' },
    columnStyles: { 0: { cellWidth: 40 } },
  })
  y = tableEnd(doc) + 9

  y = drawSectionTitle(doc, ensureSpace(doc, y, 60), 'EFTPOS and donations')
  y = writeLines(doc, y + 7, ['EFTPOS takings (B):', 'Surcharge:'])
  y = writeLine(doc, y, 'EFTPOS total charged:')
  y = writeLines(doc, y, ['Cash donations:', 'EFTPOS donations:'])
  y = writeLine(doc, y, 'Total donations (C):') + 3

  y = drawSectionTitle(doc, ensureSpace(doc, y, 70), 'Reconciliation')
  y = writeLine(doc, y + 7, 'Money for tickets: A + B - C =')
  y = writeLine(doc, y, 'Value of tickets sold (ticket total above) =')
  y = writeLine(doc, y, 'Difference (money - tickets) =')
  y = tickOptions(doc, y, ['Balanced', 'Over', 'Short'])
  doc.setFont('helvetica', 'bold')
  doc.text('Notes:', MARGIN, y)
  y = blankLines(doc, y + 8, 2)
  signOff(doc, y)

  drawFooters(doc, `${STATIONS[station].name} ${kind === 'event' ? 'special event ' : ''}ticket sheet (paper form)`)
  return doc
}
