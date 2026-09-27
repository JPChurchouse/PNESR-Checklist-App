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
}

/** A write refused because it would leave the data inconsistent. The message is shown to the user. */
export class StorageRuleError extends Error {
  name = 'StorageRuleError'
}
