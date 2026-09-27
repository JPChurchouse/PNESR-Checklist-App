import { describe, expect, it } from 'vitest'
import {
  buildChecklist,
  checkProgress,
  newSafetyCheck,
  pruneResults,
  resultKey,
  signOffState,
  snapshotCarriage,
  snapshotLoco,
  trainProblems,
  type SafetyCheck,
  type TrainCheck,
} from './safetyCheck'
import { seedFleet } from './seed'

const fleet = seedFleet()
const car = (code: string) => snapshotCarriage(fleet, fleet.carriages.find((c) => c.code === code)!)
const loco = (code: string) => snapshotLoco(fleet, fleet.locomotives.find((l) => l.code === code)!)
const train = (locoCode: string, cars: string): TrainCheck => ({
  id: `t-${locoCode}`,
  setName: null,
  loco: loco(locoCode),
  carriages: cars.split('').map(car),
})

function passAll(check: SafetyCheck): SafetyCheck {
  const results = Object.fromEntries(
    buildChecklist(check).flatMap((g) => g.rows.map((r) => [r.key, { status: 'pass' as const, note: '' }])),
  )
  return { ...check, results }
}

describe('buildChecklist', () => {
  it('adds the right checks for each kind of carriage', () => {
    const groups = buildChecklist({ trains: [train('DXC', 'JPRSQL')] })
    const titles = groups.map((g) => `${g.title}: ${g.rows.length}`)
    expect(titles).toEqual([
      'Track: 3',
      'Locomotive DXC: 3',
      'Carriage J: 3', // driver: doors, coupling, extinguisher
      'Carriage P: 2',
      'Carriage R: 2',
      'Carriage S: 2',
      'Carriage Q: 4', // wheelchair: + seats, tie-downs
      'Carriage L: 6', // guard: + extinguisher, tail lights, signal button, first aid
    ])
  })

  it('counts every check across three full trains', () => {
    const check = { trains: [train('DA', 'CBDKMI'), train('DXC', 'EFGNOH'), train('DG', 'JPRSQL')] }
    // track 3 + 3 locos × 3 + 18 carriages × 2 + 3 drivers × 1 + 3 guards × 4 + 1 wheelchair × 2
    expect(checkProgress({ ...check, results: {} }).total).toBe(3 + 9 + 36 + 3 + 12 + 2)
  })
})

describe('checkProgress', () => {
  it('counts passes, fails and fails missing a note', () => {
    const check = { trains: [train('DA', 'CI')], results: {
      [resultKey('track', 'radio')]: { status: 'pass' as const, note: '' },
      [resultKey('loco-da', 'horn')]: { status: 'fail' as const, note: '' },
      [resultKey('loco-da', 'lights')]: { status: 'fail' as const, note: 'Left headlight out, replaced' },
      [resultKey('car-z', 'doors')]: { status: 'pass' as const, note: '' }, // not in any train: ignored
    } }
    expect(checkProgress(check)).toMatchObject({ answered: 3, passed: 1, failed: 2, failedWithoutNote: 1 })
  })
})

describe('trainProblems', () => {
  it('accepts a valid day', () => {
    expect(trainProblems({ trains: [train('DA', 'CBDKMI'), train('DXC', 'EFGNOH')] })).toEqual([])
  })

  it('needs at least one train', () => {
    expect(trainProblems({ trains: [] })).toEqual(['Add at least one train.'])
  })

  it('catches the same vehicle in two trains', () => {
    expect(trainProblems({ trains: [train('DA', 'CBI'), train('DA', 'EBH')] })).toEqual([
      'DA is in train 1 and train 2.',
      'B is in train 1 and train 2.',
    ])
  })

  it('checks driver and guard positions', () => {
    expect(trainProblems({ trains: [train('DA', 'BCI')] })).toEqual(['Train 1: the first carriage must be a driver carriage.'])
  })
})

describe('signOffState', () => {
  const base = { ...newSafetyCheck('x'), trains: [train('DA', 'CI')] }

  it('lists everything still needed', () => {
    const { canComplete, reasons } = signOffState(base)
    expect(canComplete).toBe(false)
    expect(reasons).toEqual([
      '15 checks still to do.', // track 3 + loco 3 + driver 3 + guard 6,
      "Enter the shift manager's name.",
      'The shift manager needs to sign.',
    ])
  })

  it('allows sign-off once every check is done and signed', () => {
    const done = { ...passAll(base), managerName: 'Alex', signature: 'data:image/png;base64,x' }
    expect(signOffState(done)).toEqual({ canComplete: true, reasons: [] })
  })

  it('allows a failed check only with a note', () => {
    const done = { ...passAll(base), managerName: 'Alex', signature: 'data:image/png;base64,x' }
    done.results[resultKey('car-c', 'extinguisher')] = { status: 'fail', note: '' }
    expect(signOffState(done).reasons).toEqual(['Add a note to the failed check.'])
    done.results[resultKey('car-c', 'extinguisher')].note = 'Swapped from spare, now present'
    expect(signOffState(done).canComplete).toBe(true)
  })
})

describe('pruneResults', () => {
  it('drops results for carriages taken out of the train', () => {
    const check = passAll({ ...newSafetyCheck('x'), trains: [train('DA', 'CBI')] })
    const swapped = pruneResults({ ...check, trains: [train('DA', 'CDI')] })
    expect(Object.keys(swapped.results).some((k) => k.startsWith('car-b:'))).toBe(false)
    expect(swapped.results[resultKey('car-c', 'doors')]).toBeDefined()
  })
})
