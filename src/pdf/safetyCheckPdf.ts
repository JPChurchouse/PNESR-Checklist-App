import { jsPDF } from 'jspdf'
import { autoTable, type CellHookData, type RowInput } from 'jspdf-autotable'
import { buildChecklist, checkProgress, type ChecklistGroup, type SafetyCheck } from '../domain/safetyCheck'
import { SPECIALTY_LABELS } from '../domain/types'
import {
  COLOURS,
  drawFacts,
  drawFooters,
  drawHeader,
  drawOutcome,
  drawSectionTitle,
  ensureSpace,
  formatDate,
  formatDateTime,
  MARGIN,
  tableEnd,
  tableTheme,
} from './common'

const RESULT_TEXT = { pass: 'Pass', fail: 'FAIL' } as const

/** Colours the Result column (at `column`): green for pass, bold red for fail. */
const styleResult = (column: number) => (data: CellHookData) => {
  if (data.section !== 'body' || data.column.index !== column) return
  if (data.cell.raw === RESULT_TEXT.pass) data.cell.styles.textColor = [...COLOURS.ok]
  if (data.cell.raw === RESULT_TEXT.fail) {
    data.cell.styles.textColor = [...COLOURS.fail]
    data.cell.styles.fontStyle = 'bold'
  }
}

function groupRows(check: SafetyCheck, groups: ChecklistGroup[]): RowInput[] {
  return groups.flatMap((group) =>
    group.rows.map((row, i) => {
      const result = check.results[row.key]
      return [
        i === 0 ? { content: group.title.replace(/^(Locomotive|Carriage) /, ''), rowSpan: group.rows.length, styles: { fontStyle: 'bold', valign: 'top' } } : null,
        row.item.label,
        result?.status ? RESULT_TEXT[result.status] : 'Not checked',
        result?.note ?? '',
      ].filter((cell) => cell !== null) as RowInput
    }),
  )
}

/** `compress: false` keeps the text readable in the raw bytes, for tests. */
export function buildSafetyCheckPdf(check: SafetyCheck, { compress = true } = {}): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress })
  const groups = buildChecklist(check)
  const progress = checkProgress(check)

  let y = drawHeader(doc, 'Pre-operation Safety Check')
  y = drawFacts(doc, y, [
    ['Date', formatDate(check.date)],
    ['Completed', check.completedAt ? formatDateTime(check.completedAt) : 'NOT COMPLETED'],
    ['Shift manager', check.managerName || '—'],
    ['Trains', String(check.trains.length)],
  ])
  y += 2
  const allPassed = progress.failed === 0 && progress.answered === progress.total
  y = drawOutcome(
    doc,
    y,
    allPassed,
    allPassed
      ? `All ${progress.total} checks passed`
      : progress.failed
        ? `${progress.failed} check${progress.failed === 1 ? '' : 's'} failed: see notes below`
        : `${progress.total - progress.answered} checks not completed`,
  )

  const failures = groups.flatMap((g) =>
    g.rows.filter((row) => check.results[row.key]?.status === 'fail').map((row) => [g.title, row.item.label, check.results[row.key].note]),
  )
  if (failures.length) {
    y = drawSectionTitle(doc, y, 'Failed checks')
    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [['Where', 'Check', 'Note / action taken']],
      body: failures,
      headStyles: { ...tableTheme.headStyles, fillColor: [...COLOURS.fail] },
      columnStyles: { 0: { cellWidth: 38, fontStyle: 'bold' }, 1: { cellWidth: 62 } },
    })
    y = tableEnd(doc) + 9
  }

  y = drawSectionTitle(doc, y, 'Trains')
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Train', 'Locomotive', 'Carriages (front to back)', 'Set']],
    body: check.trains.map((t, i) => [
      String(i + 1),
      t.loco ? `${t.loco.code}${t.loco.livery ? ` (${t.loco.livery})` : ''}` : '—',
      t.carriages.map((c) => (c.specialty === 'standard' ? c.code : `${c.code} (${SPECIALTY_LABELS[c.specialty].toLowerCase()})`)).join(', '),
      t.setName ?? 'Custom',
    ]),
    columnStyles: { 0: { cellWidth: 14 }, 3: { cellWidth: 24 } },
  })
  y = tableEnd(doc) + 9

  const trackGroup = groups.filter((g) => g.kind === 'track')
  y = drawSectionTitle(doc, y, 'Track')
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Check', 'Result', 'Note']],
    body: trackGroup[0].rows.map((row) => {
      const r = check.results[row.key]
      return [row.item.label, r?.status ? RESULT_TEXT[r.status] : 'Not checked', r?.note ?? '']
    }),
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 20 } },
    didParseCell: styleResult(1),
  })
  y = tableEnd(doc) + 9

  check.trains.forEach((train, trainIndex) => {
    const trainGroups = groups.filter((g) => g.trainIndex === trainIndex)
    const title = `Train ${trainIndex + 1}: ${train.loco ? `loco ${train.loco.code}` : 'no loco'}${train.setName ? `, set ${train.setName}` : ''}`
    y = drawSectionTitle(doc, y, title)
    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [['Vehicle', 'Check', 'Result', 'Note']],
      body: groupRows(check, trainGroups),
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 82 }, 2: { cellWidth: 20 } },
      didParseCell: styleResult(2),
    })
    y = tableEnd(doc) + 9
  })

  if (check.notes.trim()) {
    y = drawSectionTitle(doc, y, 'Notes')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(check.notes.trim(), doc.internal.pageSize.getWidth() - MARGIN * 2)
    y = ensureSpace(doc, y + 3, lines.length * 5)
    doc.text(lines, MARGIN, y + 2)
    y += lines.length * 5 + 8
  }

  y = drawSectionTitle(doc, ensureSpace(doc, y, 55), 'Sign-off')
  y = drawFacts(doc, y + 5, [
    ['Shift manager', check.managerName || '—'],
    ['Completed', check.completedAt ? formatDateTime(check.completedAt) : 'NOT COMPLETED'],
  ])
  doc.setFont('helvetica', 'bold')
  doc.text('Signature:', MARGIN, y)
  const sigX = MARGIN + 38
  const sigTop = y - 3
  const sigH = 25
  if (check.signature) {
    const props = doc.getImageProperties(check.signature)
    const w = Math.min(90, (props.width / props.height) * sigH)
    doc.addImage(check.signature, 'PNG', sigX, sigTop, w, sigH, undefined, 'FAST')
  }
  doc.setDrawColor(...COLOURS.muted)
  doc.line(sigX, sigTop + sigH + 1, sigX + 90, sigTop + sigH + 1)

  drawFooters(doc, `Safety check ${check.date}`)
  return doc
}

export const safetyCheckFilename = (check: SafetyCheck) => `safety-check-${check.date}.pdf`
