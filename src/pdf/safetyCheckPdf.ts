import type { jsPDF } from 'jspdf'
import { autoTable, type CellHookData, type RowInput } from 'jspdf-autotable'
import { buildChecklist, checkProgress, describeTrainChanges, type ChecklistGroup, type SafetyCheck } from '../domain/safetyCheck'
import { SPECIALTY_LABELS } from '../domain/types'
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
  formatDate,
  formatDateTime,
  formatTime,
  tableEnd,
  tableTheme,
} from './common'

const NOT_CHECKED = 'NOT CHECKED'


/** Colours the "Checked" column (at `column`): green tick times, bold red when not checked. */
const styleChecked = (column: number) => (data: CellHookData) => {
  if (data.section !== 'body' || data.column.index !== column) return
  if (data.cell.raw === NOT_CHECKED) {
    data.cell.styles.textColor = [...COLOURS.fail]
    data.cell.styles.fontStyle = 'bold'
  } else data.cell.styles.textColor = [...COLOURS.ok]
}

// The built-in PDF fonts have no tick glyph, so checked items show the time only.
const checkedCell = (check: SafetyCheck, key: string) => {
  const r = check.results[key]
  return r ? formatTime(r.checkedAt) : NOT_CHECKED
}

function vehicleRows(check: SafetyCheck, groups: ChecklistGroup[]): RowInput[] {
  return groups.flatMap((group) =>
    group.rows.map((row, i) => {
      const cells: RowInput = []
      if (i === 0)
        cells.push({
          content: group.title.replace(/^(Locomotive|Carriage) /, ''),
          rowSpan: group.rows.length,
          styles: { fontStyle: 'bold', valign: 'top' },
        })
      cells.push(row.item.label, checkedCell(check, row.key))
      return cells
    }),
  )
}

/**
 * @param chain every revision up to and including `check`, oldest first (just `[check]` if never amended)
 * @param compress false keeps the text readable in the raw bytes, for tests
 */
export function buildSafetyCheckPdf(check: SafetyCheck, chain: SafetyCheck[] = [check], { compress = true } = {}): jsPDF {
  const doc = createDoc(compress)
  const groups = buildChecklist(check)
  const progress = checkProgress(check)
  const cancelled = check.outcome === 'cancelled'

  let y = drawHeader(doc, 'Pre-operation Safety Check')
  const facts: [string, string][] = [['Date', formatDate(check.date)]]
  if (check.revision > 1) facts.push(['Revision', `${check.revision} (amended)`])
  facts.push(
    ['Signed off', check.completedAt ? formatDateTime(check.completedAt) : 'NOT SIGNED OFF'],
    ['Shift manager', check.managerName || '—'],
    ['Trains', String(check.trains.length)],
  )
  y = drawFacts(doc, y, facts) + 2

  if (cancelled) y = drawOutcome(doc, y, false, 'Railway NOT operating')
  else if (!check.completedAt) y = drawOutcome(doc, y, false, 'Not signed off')
  else if (progress.done === progress.total) y = drawOutcome(doc, y, true, `Ready to operate: all ${progress.total} checks completed`)
  else y = drawOutcome(doc, y, false, `${progress.total - progress.done} checks not completed`)

  if (cancelled) {
    y = drawSectionTitle(doc, y, 'Reason the railway is not operating')
    y = drawParagraph(doc, y, check.cancelReason || '—')
  }

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
        i === 0 ? 'Original check' : [rev.amendmentReason, ...describeTrainChanges(chain[i - 1], rev)].filter(Boolean).join('\n'),
      ]),
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 44 }, 2: { cellWidth: 34 } },
    })
    y = tableEnd(doc) + 9
  }

  if (check.trains.length) {
    y = drawSectionTitle(doc, y, 'Trains')
    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [['Train', 'Locomotive', 'Carriages (front to back)', 'Set', 'Driver', 'Guard']],
      body: check.trains.map((t, i) => [
        String(i + 1),
        t.loco ? `${t.loco.code}${t.loco.livery ? ` (${t.loco.livery})` : ''}` : '—',
        t.carriages.map((c) => (c.specialty === 'standard' ? c.code : `${c.code} (${SPECIALTY_LABELS[c.specialty].toLowerCase()})`)).join(', '),
        t.setName ?? 'Custom',
        t.driver.trim() || '—',
        t.guard.trim() || '—',
      ]),
      columnStyles: { 0: { cellWidth: 14 }, 3: { cellWidth: 16 } },
    })
    y = tableEnd(doc) + 9
  }

  y = drawSectionTitle(doc, y, 'Track')
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Check', 'Checked at']],
    body: groups[0].rows.map((row) => [row.item.label, checkedCell(check, row.key)]),
    columnStyles: { 1: { cellWidth: 30 } },
    didParseCell: styleChecked(1),
  })
  y = tableEnd(doc) + 9

  check.trains.forEach((train, trainIndex) => {
    const trainGroups = groups.filter((g) => g.trainIndex === trainIndex)
    if (!trainGroups.length) return
    const title = `Train ${trainIndex + 1}: ${train.loco ? `loco ${train.loco.code}` : 'no loco'}${train.setName ? `, set ${train.setName}` : ''}`
    y = drawSectionTitle(doc, y, title)
    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [['Vehicle', 'Check', 'Checked at']],
      body: vehicleRows(check, trainGroups),
      columnStyles: { 0: { cellWidth: 18 }, 2: { cellWidth: 30 } },
      didParseCell: styleChecked(2),
    })
    y = tableEnd(doc) + 9
  })

  if (check.notes.trim()) {
    y = drawSectionTitle(doc, y, 'Notes')
    y = drawParagraph(doc, y, check.notes.trim())
  }

  drawSignOff(doc, y, check.managerName, check.completedAt, check.signature)

  drawFooters(doc, `Safety check ${check.date}${check.revision > 1 ? ` rev ${check.revision}` : ''}`)
  return doc
}

export const safetyCheckFilename = (check: SafetyCheck) =>
  `safety-check-${check.date}${check.revision > 1 ? `-rev${check.revision}` : ''}.pdf`
