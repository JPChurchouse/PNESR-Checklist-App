import { localDate } from '../lib/dates'
import type { SafetyCheck } from './safetyCheck'
import type { StaffMember } from './staff'
import type { TicketSettings, TicketSheet } from './tickets'
import type { Fleet } from './types'

/** Everything the app stores, as one JSON file. */
export interface Backup {
  app: 'pnesr'
  version: 1
  exportedAt: string
  /** Which database it came from, so a practice backup isn't mistaken for real records. */
  mode: 'live' | 'practice'
  fleet: Fleet
  ticketSettings: TicketSettings
  safetyChecks: SafetyCheck[]
  ticketSheets: TicketSheet[]
  staff: StaffMember[]
}

export type BackupContents = Omit<Backup, 'app' | 'version' | 'exportedAt' | 'mode'>

/** Reads a backup file, with a plain-English error if it isn't one. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't a backup from this app (it couldn't be read).")
  }
  const b = data as Partial<Backup>
  if (b?.app !== 'pnesr') throw new Error("That file isn't a backup from this app.")
  if (b.version !== 1) throw new Error('That backup was made by a newer version of the app. Update the app first.')
  const lists = [b.safetyChecks, b.ticketSheets, b.staff, b.fleet?.locomotives, b.fleet?.carriages, b.fleet?.sets, b.fleet?.liveries]
  if (!lists.every(Array.isArray) || !b.ticketSettings) throw new Error('That backup file is incomplete or damaged.')
  return b as Backup
}

export function backupSummary(b: Pick<Backup, 'safetyChecks' | 'ticketSheets' | 'staff' | 'fleet'>): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return [
    plural(b.safetyChecks.length, 'safety check'),
    plural(b.ticketSheets.length, 'ticket sheet'),
    plural(b.staff.length, 'staff member'),
    `${plural(b.fleet.locomotives.length, 'loco')} and ${plural(b.fleet.carriages.length, 'carriage')}`,
  ].join(', ')
}

export const backupFilename = (b: Pick<Backup, 'exportedAt' | 'mode'>) =>
  `pnesr-${b.mode === 'practice' ? 'practice-' : ''}backup-${localDate(new Date(b.exportedAt))}.json`
