import { describe, expect, it } from 'vitest'
import {
  amendSafetyCheck,
  buildChecklist,
  checkProgress,
  describeTrainChanges,
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
import { currentRecords as currentChecks, revisionChainOf as revisionChain } from './revisions'
import { seedFleet } from './seed'

const fleet = seedFleet()
const car = (code: string) => snapshotCarriage(fleet, fleet.carriages.find((c) => c.code === code)!)
const loco = (code: string) => snapshotLoco(fleet, fleet.locomotives.find((l) => l.code === code)!)
const train = (locoCode: string, cars: string, id = `t-${locoCode}`): TrainCheck => ({
  id,
  setName: null,
  loco: loco(locoCode),
  carriages: cars.split('').map(car),
})
const TICK = { checkedAt: '2026-09-27T20:00:00.000Z' }

function tickAll(check: SafetyCheck): SafetyCheck {
  const results = { ...check.results }
  for (const g of buildChecklist(check)) for (const r of g.rows) results[r.key] ??= TICK
  return { ...check, results }
}
const signed = (check: SafetyCheck): SafetyCheck => ({ ...check, managerName: 'Alex', signature: 'data:image/png;base64,x' })

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
  it('counts ticks only for vehicles in today’s trains', () => {
    const results = { [resultKey('track', 'radio')]: TICK, [resultKey('loco-da', 'horn')]: TICK, [resultKey('car-z', 'doors')]: TICK }
    expect(checkProgress({ trains: [train('DA', 'CI')], results })).toEqual({ total: 15, done: 2 })
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
    expect(trainProblems({ trains: [train('DA', 'CBI', 't1'), train('DA', 'EBH', 't2')] })).toEqual([
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
      '15 checks still to do.', // track 3 + loco 3 + driver 3 + guard 6
      "Enter the shift manager's name.",
      'The shift manager needs to sign.',
    ])
  })

  it('allows sign-off once every check is ticked and signed', () => {
    expect(signOffState(signed(tickAll(base)))).toEqual({ canComplete: true, reasons: [] })
  })

  it("can record that the railway won't operate without finishing the checks", () => {
    const cancelled = signed({ ...base, outcome: 'cancelled' as const })
    expect(signOffState(cancelled).reasons).toEqual(["Explain why the railway can't operate."])
    expect(signOffState({ ...cancelled, cancelReason: 'Washout near the bridge' }).canComplete).toBe(true)
  })

  it('needs a reason for an amendment', () => {
    const amended = signed(tickAll(amendSafetyCheck({ ...signed(tickAll(base)), completedAt: TICK.checkedAt }, 'y')))
    expect(signOffState({ ...amended, signature: 'x' }).reasons).toEqual(['Give a reason for the amendment.'])
  })
})

describe('amendments', () => {
  const original: SafetyCheck = {
    ...signed(tickAll({ ...newSafetyCheck('rev1'), trains: [train('DA', 'CBDKMI', 't1'), train('DXR', 'EFGNOH', 't2')] })),
    completedAt: '2026-09-27T21:00:00.000Z',
  }

  it('carries ticks over, needs a fresh signature, and links to the original', () => {
    const rev2 = amendSafetyCheck(original, 'rev2')
    expect(rev2).toMatchObject({ revision: 2, amendsId: 'rev1', completedAt: null, signature: null, managerName: 'Alex' })
    expect(rev2.results).toEqual(original.results)
  })

  it('only the swapped-in loco needs checking', () => {
    const rev2 = amendSafetyCheck(original, 'rev2')
    rev2.trains[1] = { ...rev2.trains[1], loco: loco('DG') }
    const { total, done } = checkProgress(rev2)
    expect(total - done).toBe(3)
  })

  it('describes what changed', () => {
    const rev2 = amendSafetyCheck(original, 'rev2')
    rev2.trains[1] = { ...rev2.trains[1], loco: loco('DG') }
    rev2.trains.push(train('DXC', 'JPRSQL', 't3'))
    expect(describeTrainChanges(original, rev2)).toEqual([
      'Train 2: locomotive DXR replaced by DG.',
      'Train 3 added (DXC, J P R S Q L).',
    ])
    rev2.trains = [rev2.trains[0]]
    expect(describeTrainChanges(original, rev2)).toEqual(['A train was removed (DXR, E F G N O H).'])
  })

  it('follows the chain of revisions and lists only the latest signed-off one', () => {
    const rev2 = { ...amendSafetyCheck(original, 'rev2'), completedAt: '2026-09-28T01:00:00.000Z' }
    const rev3 = amendSafetyCheck(rev2, 'rev3')
    const all = [original, rev2, rev3]
    expect(revisionChain(rev3, all).map((c) => c.id)).toEqual(['rev1', 'rev2', 'rev3'])
    // rev3 is still in progress, so rev2 stays listed alongside it.
    expect(currentChecks(all).map((c) => c.id)).toEqual(['rev2', 'rev3'])
  })
})

describe('pruneResults', () => {
  it('drops ticks for carriages taken out of the train', () => {
    const check = tickAll({ ...newSafetyCheck('x'), trains: [train('DA', 'CBI')] })
    const swapped = pruneResults({ ...check, trains: [train('DA', 'CDI')] })
    expect(Object.keys(swapped.results).some((k) => k.startsWith('car-b:'))).toBe(false)
    expect(swapped.results[resultKey('car-c', 'doors')]).toBeDefined()
  })
})
