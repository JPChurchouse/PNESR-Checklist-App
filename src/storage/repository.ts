import type { SafetyCheck } from '../domain/safetyCheck'
import type { StaffMember } from '../domain/staff'
import type { StationId, TicketSettings, TicketSheet } from '../domain/tickets'
import type { Carriage, CarriageSet, Fleet, Livery, Locomotive } from '../domain/types'

/**
 * Everything the UI needs from storage. The app talks only to this interface, so the
 * on-device store can later be swapped for a server (e.g. a Raspberry Pi on the club Wi-Fi)
 * without touching the screens.
 */
export interface Repository {
  getFleet(): Promise<Fleet>
  /** Calls `listener` with the current fleet now and after every change. Returns an unsubscribe function. */
  watchFleet(listener: (fleet: Fleet) => void, onError?: (error: unknown) => void): () => void

  saveLivery(livery: Livery): Promise<void>
  /** Rejects with a `StorageRuleError` if any loco or carriage still uses the livery. */
  deleteLivery(id: string): Promise<void>

  saveLocomotive(loco: Locomotive): Promise<void>
  deleteLocomotive(id: string): Promise<void>

  saveCarriage(carriage: Carriage): Promise<void>
  /** Rejects with a `StorageRuleError` if the carriage is in a set. */
  deleteCarriage(id: string): Promise<void>

  saveSet(set: CarriageSet): Promise<void>
  deleteSet(id: string): Promise<void>

  /** Newest first. */
  listSafetyChecks(): Promise<SafetyCheck[]>
  getSafetyCheck(id: string): Promise<SafetyCheck | undefined>
  saveSafetyCheck(check: SafetyCheck): Promise<void>
  /** Rejects with a `StorageRuleError` if the check has been completed. */
  deleteSafetyCheck(id: string): Promise<void>

  /** Ticket types, prices, colours and the float. Returns the defaults until first saved. */
  getTicketSettings(): Promise<TicketSettings>
  saveTicketSettings(settings: TicketSettings): Promise<void>

  /** Newest first. */
  listTicketSheets(station: StationId): Promise<TicketSheet[]>
  getTicketSheet(id: string): Promise<TicketSheet | undefined>
  saveTicketSheet(sheet: TicketSheet): Promise<void>
  /** Rejects with a `StorageRuleError` if the sheet has been completed. */
  deleteTicketSheet(id: string): Promise<void>

  /** Sorted by first name. */
  listStaff(): Promise<StaffMember[]>
  /** Replaces the whole list, e.g. with a fresh import from the club's spreadsheet. */
  replaceStaff(staff: StaffMember[]): Promise<void>
}

/** A write refused because it would leave the data inconsistent. The message is shown to the user. */
export class StorageRuleError extends Error {
  name = 'StorageRuleError'
}
