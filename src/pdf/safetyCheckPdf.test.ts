import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildChecklist, newSafetyCheck, resultKey, snapshotCarriage, snapshotLoco, type SafetyCheck } from '../domain/safetyCheck'
import { seedFleet } from '../domain/seed'
import { buildSafetyCheckPdf, safetyCheckFilename } from './safetyCheckPdf'

// 1×1 transparent PNG, standing in for a signature.
const SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function sampleCheck(): SafetyCheck {
  const fleet = seedFleet()
  const cars = (setName: string) =>
    fleet.sets.find((s) => s.name === setName)!.carriageIds.map((id) => snapshotCarriage(fleet, fleet.carriages.find((c) => c.id === id)!))
  const loco = (code: string) => snapshotLoco(fleet, fleet.locomotives.find((l) => l.code === code)!)
  const check: SafetyCheck = {
    ...newSafetyCheck('sample', new Date(2026, 8, 27, 9, 30)),
    trains: [
      { id: 't1', setName: 'CC', loco: loco('DXC'), carriages: cars('CC') },
      { id: 't2', setName: '3', loco: loco('DG'), carriages: cars('3') },
    ],
    managerName: 'Sam Example',
    signature: SIGNATURE,
    completedAt: new Date(2026, 8, 27, 10, 5).toISOString(),
    notes: 'Light drizzle early. Crossing 2 alarm slow to start but working.',
  }
  for (const group of buildChecklist(check)) for (const row of group.rows) check.results[row.key] = { status: 'pass', note: '' }
  check.results[resultKey('car-q', 'tie-downs')] = { status: 'fail', note: 'One strap frayed. Q running without wheelchair passengers today.' }
  return check
}

describe('buildSafetyCheckPdf', () => {
  it('produces a PDF containing the key details', () => {
    const doc = buildSafetyCheckPdf(sampleCheck(), { compress: false })
    const bytes = doc.output('arraybuffer')
    // Saves a copy for eyeballing the layout: PDF_PREVIEW=out.pdf npx vitest run src/pdf
    if (process.env.PDF_PREVIEW) writeFileSync(process.env.PDF_PREVIEW, Buffer.from(bytes))

    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.startsWith('%PDF-')).toBe(true)
    for (const expected of ['Pre-operation Safety Check', 'Sam Example', '1 check failed', 'Failed checks', 'One strap frayed', 'Crossing 2 alarm'])
      expect(text).toContain(expected)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it('names the file after the date', () => {
    expect(safetyCheckFilename(sampleCheck())).toBe('safety-check-2026-09-27.pdf')
  })
})
