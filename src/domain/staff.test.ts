import { describe, expect, it } from 'vitest'
import { cashierProblems, driverProblem, findStaff, guardProblem, importStaffCsv, managerProblem, parseCsv, rolesOf } from './staff'

// Made-up people in the same layout as the club's sheet export, including the columns the app ignores.
const EXPORT = `Name,Surname,Address,Land Line,Mobile,Subs,App. Fee,AGM,Publish,Roster,Email,Joined,Status,DOB,Key No.,DOS,Cashier,Guard,Driver,Class A,Trained as code,Roster Entry,DOS Cell,
Pat,Example,"1 Test Street, Town",06 555 0000,021 000 0001,Y,,,,,pat@example.com,23-Mar-17,Senior,1980-01-01,,Yes,Yes,Yes,Yes,"DA, DXC, DXR, DG",CD,Pat E (CD),021 000 0001,
Alan,Sample,,,021 000 0002,,,,,,,,,,,No,No,Yes,Yes,"DA, DXC, DXR",D,Alan S (D),,
Betty,Test,,,021 000 0003,,,,,,,,,,,No,Yes,No,No,,C,Betty T (C),,
Devon,Trial,,,021 000 0004,,,,,,,,,,,No,Yes,Yes,No,,CG,,,

*Trained as code
Staff must be trained as a guard before being trained as a driver.
`

let n = 0
const id = () => `staff-${++n}`

describe('parseCsv', () => {
  it('handles quoted commas, doubled quotes and Windows line endings', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\nd,e,f')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['d', 'e', 'f'],
    ])
  })
})

describe('importStaffCsv', () => {
  const { staff, skipped } = importStaffCsv(EXPORT, id)

  it('reads everyone up to the notes under the table', () => {
    expect(staff.map((s) => s.displayName)).toEqual(['Pat E (CD)', 'Alan S (D)', 'Betty T (C)', 'Devon T'])
    expect(skipped).toEqual([])
  })

  it('keeps names, phones and qualifications only', () => {
    expect(staff[0]).toEqual({
      id: expect.any(String),
      firstName: 'Pat',
      surname: 'Example',
      displayName: 'Pat E (CD)',
      mobile: '021 000 0001',
      landLine: '06 555 0000',
      manager: true,
      cashier: true,
      guard: true,
      driver: true,
      classA: ['DA', 'DXC', 'DXR', 'DG'],
    })
    expect(JSON.stringify(staff)).not.toMatch(/Test Street|example\.com|1980/)
  })

  it('reads roles', () => {
    expect(staff[2]).toMatchObject({ manager: false, cashier: true, guard: false, driver: false, classA: [] })
    expect(staff[3]).toMatchObject({ cashier: true, guard: true, driver: false })
  })

  it('finds the header even with a title line above it', () => {
    expect(importStaffCsv(`Raw Data:\n\n${EXPORT}`, id).staff).toHaveLength(4)
  })

  it('rejects a file that is not the staff list', () => {
    expect(() => importStaffCsv('a,b,c\n1,2,3', id)).toThrow(/doesn’t look like the staff list/)
  })
})

describe('qualification checks', () => {
  const { staff } = importStaffCsv(EXPORT, id)
  const [pat, alan, betty] = staff

  it('matches typed names against full or roster names', () => {
    expect(findStaff(staff, 'alan sample')).toBe(alan)
    expect(findStaff(staff, 'Pat E (CD)')).toBe(pat)
    expect(findStaff(staff, 'Someone Else')).toBeUndefined()
  })

  it('checks Class A for the loco being driven', () => {
    expect(driverProblem(pat, 'DG')).toBeNull()
    expect(driverProblem(alan, 'DG')).toBe("Alan Sample isn't Class A qualified on DG.")
    expect(driverProblem(betty, 'DA')).toBe("Betty Test isn't a qualified driver.")
    expect(driverProblem(undefined, 'DA')).toBeNull() // someone not on the list: nothing to check against
  })

  it('checks managers and cashiers', () => {
    expect(managerProblem(pat)).toBeNull()
    expect(managerProblem(alan)).toBe("Alan Sample isn't a qualified manager.")
    expect(cashierProblems(staff, 'Betty Test, Alan Sample, A Visitor')).toEqual(["Alan Sample isn't a qualified cashier."])
  })

  it('summarises roles, leaving out guard for drivers', () => {
    expect(staff.map(rolesOf)).toEqual(['manager, cashier, driver', 'driver', 'cashier', 'cashier, guard'])
  })

  it('checks guards', () => {
    expect(guardProblem(alan)).toBeNull()
    expect(guardProblem(betty)).toBe("Betty Test isn't a qualified guard.")
  })
})
