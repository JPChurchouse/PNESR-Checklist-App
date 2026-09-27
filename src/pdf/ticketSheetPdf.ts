import type { jsPDF } from 'jspdf'
import { autoTable, type CellHookData } from 'jspdf-autotable'
import { formatDenomination, formatMoney } from '../domain/money'
import { balanceText, checkFloat, DENOMINATIONS, reconcile, resolveEftpos, STATIONS, type TicketSheet } from '../domain/tickets'
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
  ensureSpace,
  formatDate,
  formatDateTime,
  MARGIN,
  tableEnd,
  tableTheme,
} from './common'

const bold = { fontStyle: 'bold' as const }
const right = { halign: 'right' as const }

/** Bold red for the body cells listed in `failing`, as "row:column". */
const highlight = (failing: Set<string>) => (data: CellHookData) => {
  if (data.section === 'body' && failing.has(`${data.row.index}:${data.column.index}`)) {
    data.cell.styles.textColor = [...COLOURS.fail]
    data.cell.styles.fontStyle = 'bold'
  }
}

/**
 * @param compress false keeps the text readable in the raw bytes, for tests
 */
export function buildTicketSheetPdf(sheet: TicketSheet, { compress = true } = {}): jsPDF {
  const doc = createDoc(compress)
  const r = reconcile(sheet)
  const eftpos = resolveEftpos(sheet.eftpos)
  const station = STATIONS[sheet.station].name

  let y = drawHeader(doc, `Ticket Sales Sheet: ${station}`)
  y = drawFacts(doc, y, [
    ['Station', station],
    ['Date', formatDate(sheet.date)],
    ['Cashier', sheet.cashier || '—'],
    ['Completed', sheet.completedAt ? formatDateTime(sheet.completedAt) : 'NOT COMPLETED'],
  ])
  y = drawOutcome(doc, y + 2, r.balance === 'balanced', balanceText(r))

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
  const before = checkFloat(sheet.float, sheet.floatStart)
  const after = checkFloat(sheet.float, sheet.floatEnd)
  y = drawSectionTitle(doc, y, 'Float')
  const floatFailing = new Set<string>()
  const floatRows = before.rows.map((row, i) => {
    const a = after.rows[i]
    if (row.differenceCents) floatFailing.add(`${i}:2`)
    if (a.differenceCents) floatFailing.add(`${i}:3`)
    return [formatDenomination(row.denominationCents), String(row.expected), row.counted ?? '—', a.counted ?? '—']
  })
  const status = (c: typeof before) => (!c.complete ? 'Not counted' : c.ok ? 'Correct' : 'ISSUE')
  const statusRow = floatRows.length + 1 // after the Total row
  if (!before.ok) floatFailing.add(`${statusRow}:2`)
  if (!after.ok) floatFailing.add(`${statusRow}:3`)
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Note / coin', 'Expected', 'Before shift', 'After reset']],
    body: [
      ...floatRows,
      [{ content: 'Total', styles: bold }, formatMoney(before.expectedTotal), formatMoney(before.countedTotal), formatMoney(after.countedTotal)],
      [{ content: 'Status', styles: bold }, '', status(before), status(after)],
    ],
    columnStyles: { 1: right, 2: right, 3: right },
    didParseCell: highlight(floatFailing),
  })
  y = tableEnd(doc) + 4
  for (const [label, c] of [['Before shift', before], ['After reset', after]] as const)
    if (c.issues.length) y = drawParagraph(doc, y, `${label}: ${c.issues.join('; ')}`) - 4
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

  if (sheet.notes.trim()) {
    y = drawSectionTitle(doc, y, 'Notes')
    y = drawParagraph(doc, y, sheet.notes.trim())
  }

  if (sheet.eftposReceipt) {
    const props = doc.getImageProperties(sheet.eftposReceipt)
    const maxW = 80
    const maxH = 120
    const scale = Math.min(maxW / props.width, maxH / props.height)
    const w = props.width * scale
    const h = props.height * scale
    y = drawSectionTitle(doc, ensureSpace(doc, y, h + 14), 'EFTPOS receipt')
    doc.addImage(sheet.eftposReceipt, props.fileType, MARGIN, y + 3, w, h, undefined, 'FAST')
  }

  drawFooters(doc, `${station} ticket sheet ${sheet.date}`)
  return doc
}

export const ticketSheetFilename = (sheet: TicketSheet) => `tickets-${sheet.station}-${sheet.date}.pdf`
