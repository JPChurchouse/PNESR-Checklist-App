import { describe, expect, it } from 'vitest'
import { seedFleet } from './seed'
import { hasErrors, validateSet } from './sets'

const { carriages, sets } = seedFleet()
const ids = (codes: string) => codes.split('').map((c) => `car-${c.toLowerCase()}`)
const check = (codes: string, otherSets = sets) => validateSet({ id: 'test', carriageIds: ids(codes) }, carriages, otherSets)
const messages = (codes: string) => check(codes, []).map((i) => i.message).join('\n')

describe('validateSet', () => {
  it.each(sets.map((s) => [s.name, s]))('default set %s is valid and shares no carriages', (_, set) => {
    expect(validateSet(set, carriages, sets)).toEqual([])
  })

  it('accepts the shortest train: driver then guard', () => {
    expect(check('CI', [])).toEqual([])
  })

  it('rejects a train longer than six carriages', () => {
    expect(messages('CBDKMFI')).toMatch(/at most 6/)
  })

  it('rejects a lone carriage', () => {
    expect(messages('C')).toMatch(/at least 2/)
  })

  it('needs a driver carriage at the front and a guard at the back', () => {
    expect(messages('BI')).toMatch(/first carriage must be a driver/)
    expect(messages('CB')).toMatch(/last carriage must be a guard/)
  })

  it('rejects the crew-only carriage', () => {
    expect(hasErrors(check('CAI', []))).toBe(true)
  })

  it('rejects the same carriage twice', () => {
    expect(messages('CBBI')).toMatch(/more than once/)
  })

  it('warns, without blocking, when a carriage is also in another set', () => {
    const issues = check('CBI')
    expect(hasErrors(issues)).toBe(false)
    expect(issues.map((i) => i.message).join()).toMatch(/Also in set "CC": C, B, I/)
  })

  it('warns about a driver or guard carriage in the middle', () => {
    const issues = check('CEI', [])
    expect(hasErrors(issues)).toBe(false)
    expect(issues[0].message).toMatch(/E is a driver carriage in the middle/)
  })
})
