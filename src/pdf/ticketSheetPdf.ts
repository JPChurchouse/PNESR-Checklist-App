import type { jsPDF } from 'jspdf'
import { autoTable, type CellHookData } from 'jspdf-autotable'
import { formatDenomination, formatMoney } from '../domain/money'
import {
  balanceText,
  checkFloat,
  DENOMINATIONS,
  describeSheetChanges,
  floatItemLabel,
  floatItemTotal,
  reconcile,
  resolveEftpos,
  sheetTitle,
  STATIONS,
  type FloatCheckEntry,
  type TicketSheet,
} from '../domain/tickets'
// Only characters in the built-in PDF fonts (WinAnsi) render: use '-' not '−', and no ticks or crosses.
import {
  COLOURS,
  createDoc,
  drawFacts,
  drawFooters,
  drawHeader,
  drawOutcome,
  drawParagraph,
  drawSectionTitle,
  drawSignOff,
  ensureSpace,
  formatDate,
  formatDateTime,
  MARGIN,
  tableEnd,
  tableTheme,
} from './common'

const bold = { fontStyle: 'bold' as const }
const right = { halign: 'right' as const }
const NOT_CONFIRMED = 'NOT CONFIRMED'

/** Bold red for any body cell reading "NOT CONFIRMED" or "ISSUE". */
function highlightProblems(data: CellHookData) {
  if (data.section === 'body' && (data.cell.raw === NOT_CONFIRMED || data.cell.raw === 'ISSUE')) {
    data.cell.styles.textColor = [...COLOURS.fail]
    data.cell.styles.fontStyle = 'bold'
  }
}

/**
 * @param chain every revision up to and including `sheet`, oldest first (just `[sheet]` if never corrected)
 * @param compress false keeps the text readable in the raw bytes, for tests
 */
export function buildTicketSheetPdf(sheet: TicketSheet, chain: TicketSheet[] = [sheet], { compress = true } = {}): jsPDF {
  const doc = createDoc(compress)
  const r = reconcile(sheet)
  const eftpos = resolveEftpos(sheet.eftpos)

  let y = drawHeader(doc, sheet.kind === 'event' ? 'Special Event Ticket Sheet' : 'Ticket Sales Sheet')
  const facts: [string, string][] = [['Station', STATIONS[sheet.station].name]]
  if (sheet.kind === 'event') facts.push(['Event', sheet.eventName || '—'])
  facts.push(['Date', formatDate(sheet.date)])
  if (sheet.revision > 1) facts.push(['Revision', `${sheet.revision} (corrected)`])
  facts.push(
    ['Cashier(s)', sheet.cashiers || '—'],
    ['Shift started', sheet.startSavedAt ? formatDateTime(sheet.startSavedAt) : '—'],
    ['Signed off', sheet.completedAt ? formatDateTime(sheet.completedAt) : 'NOT SIGNED OFF'],
  )
  y = drawFacts(doc, y, facts)
  y = drawOutcome(doc, y + 2, r.balance === 'balanced', balanceText(r))

  if (chain.length > 1) {
    y = drawSectionTitle(doc, y, 'Revision history')
    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [['Rev', 'Signed off', 'Manager', 'Reason and changes']],
      body: chain.map((rev, i) => [
        String(rev.revision),
        rev.completedAt ? formatDateTime(rev.completedAt) : 'Not signed off',
        rev.managerName,
        i === 0 ? 'Original sheet' : [rev.amendmentReason, ...describeSheetChanges(chain[i - 1], rev)].filter(Boolean).join('\n'),
      ]),
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 34 }, 2: { cellWidth: 34 } },
    })
    y = tableEnd(doc) + 9
  }

  // Tickets
  y = drawSectionTitle(doc, y, 'Tickets sold')
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Ticket', 'Colour', 'Price', 'Start no.', 'End no.', 'Sold', 'Value']],
    body: r.lines.map((l) => [
      l.name,
      l.colour,
      formatMoney(l.priceCents),
      l.startSerial ?? '—',
      l.endSerial ?? '—',
      l.sold ?? (l.startSerial === null ? 'Not used' : '—'),
      formatMoney(l.valueCents),
    ]),
    foot: [[{ content: 'Total', colSpan: 5 }, { content: String(r.ticketsSold), styles: right }, { content: formatMoney(r.ticketValue), styles: right }]],
    footStyles: { fillColor: [...COLOURS.rowAlt], textColor: [...COLOURS.text], ...bold },
    columnStyles: { 2: right, 3: right, 4: right, 5: right, 6: right },
  })
  y = tableEnd(doc) + 9

  // Reconciliation, step by step
  y = drawSectionTitle(doc, y, 'Reconciliation')
  const diffLabel = r.balance === 'balanced' ? 'Balanced' : r.balance === 'over' ? 'OVER' : 'SHORT'
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    body: [
      ['Cash takings (after the float was reset)', formatMoney(r.cashTakings)],
      ['+ EFTPOS takings (surcharge excluded)', formatMoney(r.eftposTakings)],
      ['- Donations (cash and EFTPOS)', formatMoney(r.donations)],
      [{ content: '= Money for tickets', styles: bold }, { content: formatMoney(r.moneyForTickets), styles: bold }],
      ['Value of tickets sold', formatMoney(r.ticketValue)],
      [
        { content: `Difference: ${diffLabel}`, styles: bold },
        { content: `${r.difference > 0 ? '+' : ''}${formatMoney(r.difference)}`, styles: bold },
      ],
    ],
    columnStyles: { 1: { ...right, cellWidth: 40 } },
    didParseCell: (data) => {
      if (data.row.index === 5) data.cell.styles.textColor = [...(r.balance === 'balanced' ? COLOURS.ok : COLOURS.fail)]
    },
  })
  y = tableEnd(doc) + 9

  // Float
  y = drawSectionTitle(doc, y, 'Float')
  const ticked = (entry: FloatCheckEntry, cents: number) => (entry.ticks[cents] ? 'Correct' : NOT_CONFIRMED)
  const status = (entry: FloatCheckEntry) => {
    const s = checkFloat(sheet.float, entry).status
    return s === 'ok' ? 'Correct' : s === 'issue' ? 'ISSUE' : 'Not checked'
  }
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Float', 'Amount', 'Before shift', 'After reset']],
    body: [
      ...sheet.float.map((f) => [floatItemLabel(f), formatMoney(floatItemTotal(f)), ticked(sheet.floatStart, f.denominationCents), ticked(sheet.floatEnd, f.denominationCents)]),
      [
        { content: 'Float total', styles: bold },
        { content: formatMoney(checkFloat(sheet.float, sheet.floatStart).total), styles: { ...bold, ...right } },
        status(sheet.floatStart),
        status(sheet.floatEnd),
      ],
    ],
    columnStyles: { 1: right },
    didParseCell: highlightProblems,
  })
  y = tableEnd(doc) + 4
  for (const [label, entry] of [
    ['Float issue before the shift', sheet.floatStart],
    ['Float issue after the reset', sheet.floatEnd],
  ] as const)
    if (entry.note.trim()) y = drawParagraph(doc, y, `${label}: ${entry.note.trim()}`) - 4
  y += 5

  // Cash takings
  y = drawSectionTitle(doc, y, 'Cash takings')
  const cashRows = [...DENOMINATIONS]
    .reverse()
    .filter((d) => sheet.cash[d.cents])
    .map((d) => [formatDenomination(d.cents), String(sheet.cash[d.cents]), formatMoney(d.cents * sheet.cash[d.cents]!)])
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Note / coin', 'Count', 'Value']],
    body: cashRows.length ? cashRows : [['No cash takings', '', '']],
    foot: [[{ content: 'Total cash', colSpan: 2 }, { content: formatMoney(r.cashTakings), styles: right }]],
    footStyles: { fillColor: [...COLOURS.rowAlt], textColor: [...COLOURS.text], ...bold },
    columnStyles: { 1: right, 2: right },
  })
  y = tableEnd(doc) + 9

  // EFTPOS and donations
  y = drawSectionTitle(doc, y, 'EFTPOS and donations')
  const calc = (key: keyof typeof sheet.eftpos) => {
    const v = eftpos[key]
    return v === null ? '—' : `${formatMoney(v)}${eftpos.calculated === key ? ' (calculated)' : ''}`
  }
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    body: [
      ['EFTPOS takings', calc('takings')],
      ['EFTPOS surcharge (recorded only, not counted)', calc('surcharge')],
      ['EFTPOS total charged', calc('totalCharged')],
      ['Cash donations', formatMoney(sheet.donations.cash ?? 0)],
      ['EFTPOS donations', formatMoney(sheet.donations.eftpos ?? 0)],
    ],
    columnStyles: { 1: { ...right, cellWidth: 55 } },
  })
  y = tableEnd(doc) + 9

  y = drawSectionTitle(doc, y, 'Staff on shift')
  y = drawParagraph(doc, y, sheet.staff.trim() || '—')

  if (sheet.notes.trim()) {
    y = drawSectionTitle(doc, y, 'Notes')
    y = drawParagraph(doc, y, sheet.notes.trim())
  }

  y = drawSignOff(doc, y, sheet.managerName, sheet.completedAt, sheet.signature)

  if (sheet.eftposReceipt) {
    const props = doc.getImageProperties(sheet.eftposReceipt)
    const scale = Math.min(80 / props.width, 120 / props.height)
    const w = props.width * scale
    const h = props.height * scale
    y = drawSectionTitle(doc, ensureSpace(doc, y, h + 14), 'EFTPOS receipt')
    doc.addImage(sheet.eftposReceipt, props.fileType, MARGIN, y + 3, w, h, undefined, 'FAST')
  }

  drawFooters(doc, `${sheetTitle(sheet)} ${sheet.date}${sheet.revision > 1 ? ` rev ${sheet.revision}` : ''}`)
  return doc
}

export const ticketSheetFilename = (sheet: TicketSheet) =>
  `tickets-${sheet.station}${sheet.kind === 'event' ? '-event' : ''}-${sheet.date}${sheet.revision > 1 ? `-rev${sheet.revision}` : ''}.pdf`
