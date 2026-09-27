import { describe, expect, it } from 'vitest'
import { backupFilename, backupSummary, parseBackup, type Backup } from './backup'
import { seedFleet } from './seed'
import { DEFAULT_TICKET_SETTINGS } from './tickets'

const backup: Backup = {
  app: 'pnesr',
  version: 1,
  exportedAt: new Date(2026, 8, 28, 17, 0).toISOString(),
  mode: 'live',
  fleet: seedFleet(),
  ticketSettings: DEFAULT_TICKET_SETTINGS,
  safetyChecks: [],
  ticketSheets: [],
  staff: [],
}

describe('backups', () => {
  it('reads a backup back in', () => {
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup)
  })

  it('explains what is wrong with other files', () => {
    expect(() => parseBackup('not json')).toThrow(/couldn't be read/)
    expect(() => parseBackup('{"hello":1}')).toThrow(/isn't a backup from this app/)
    expect(() => parseBackup(JSON.stringify({ ...backup, version: 2 }))).toThrow(/newer version/)
    expect(() => parseBackup(JSON.stringify({ ...backup, staff: undefined }))).toThrow(/incomplete/)
  })

  it('names the file with the local date, not the UTC one', () => {
    // 23:30 on 1 March local time is still 1 March, whatever UTC says.
    expect(backupFilename({ mode: 'live', exportedAt: new Date(2026, 2, 1, 23, 30).toISOString() })).toBe('pnesr-backup-2026-03-01.json')
  })

  it('summarises and names the file', () => {
    expect(backupSummary(backup)).toBe('0 safety checks, 0 ticket sheets, 0 staff members, 4 locos and 19 carriages')
    expect(backupFilename(backup)).toBe('pnesr-backup-2026-09-28.json')
    expect(backupFilename({ ...backup, mode: 'practice' })).toBe('pnesr-practice-backup-2026-09-28.json')
  })
})
