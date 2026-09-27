import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { amendSafetyCheck, buildChecklist, newSafetyCheck, snapshotCarriage, snapshotLoco, type SafetyCheck } from '../domain/safetyCheck'
import { seedFleet } from '../domain/seed'
import { buildSafetyCheckPdf, safetyCheckFilename } from './safetyCheckPdf'

/** Saves a copy for eyeballing the layout: PDF_PREVIEW=some/dir npx vitest run src/pdf */
function preview(name: string, doc: { output(type: 'arraybuffer'): ArrayBuffer }) {
  if (process.env.PDF_PREVIEW) writeFileSync(`${process.env.PDF_PREVIEW}/${name}.pdf`, Buffer.from(doc.output('arraybuffer')))
}

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
  for (const group of buildChecklist(check)) for (const row of group.rows) check.results[row.key] = { checkedAt: new Date(2026, 8, 27, 9, 45).toISOString() }
  return check
}

describe('buildSafetyCheckPdf', () => {
  it('produces a PDF containing the key details', () => {
    const doc = buildSafetyCheckPdf(sampleCheck(), undefined, { compress: false })
    const bytes = doc.output('arraybuffer')
    preview('safety-check', doc)

    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.startsWith('%PDF-')).toBe(true)
    for (const expected of ['Pre-operation Safety Check', 'Sam Example', 'Ready to operate: all 45 checks completed', '9:45 am', 'Crossing 2 alarm'])
      expect(text).toContain(expected)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it('shows the revision history for an amendment', () => {
    const rev1 = sampleCheck()
    const rev2: SafetyCheck = { ...amendSafetyCheck(rev1, 'rev2'), amendmentReason: 'DXC lost power', completedAt: new Date(2026, 8, 27, 13, 0).toISOString() }
    const fleet = seedFleet()
    rev2.trains[0] = { ...rev2.trains[0], loco: snapshotLoco(fleet, fleet.locomotives.find((l) => l.code === 'DA')!) }
    const doc = buildSafetyCheckPdf(rev2, [rev1, rev2], { compress: false })
    preview('safety-check-rev2', doc)
    const text = new TextDecoder('latin1').decode(doc.output('arraybuffer'))
    for (const expected of ['Revision history', 'DXC lost power', 'Train 1: locomotive DXC replaced by DA.', '3 checks not completed'])
      expect(text).toContain(expected)
    expect(safetyCheckFilename(rev2)).toBe('safety-check-2026-09-27-rev2.pdf')
  })

  it('states clearly when the railway is not operating', () => {
    const check: SafetyCheck = { ...sampleCheck(), outcome: 'cancelled', cancelReason: 'Tree down across the track near the lake.' }
    const text = new TextDecoder('latin1').decode(buildSafetyCheckPdf(check, undefined, { compress: false }).output('arraybuffer'))
    expect(text).toContain('Railway NOT operating')
    expect(text).toContain('Tree down across the track')
  })

  it('names the file after the date', () => {
    expect(safetyCheckFilename(sampleCheck())).toBe('safety-check-2026-09-27.pdf')
  })
})
