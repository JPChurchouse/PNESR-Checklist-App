import Dexie, { liveQuery, type EntityTable } from 'dexie'
import { seedFleet } from '../domain/seed'
import type { Carriage, CarriageSet, Fleet, Livery, Locomotive } from '../domain/types'
import { StorageRuleError, type Repository } from './repository'

class Db extends Dexie {
  liveries!: EntityTable<Livery, 'id'>
  locomotives!: EntityTable<Locomotive, 'id'>
  carriages!: EntityTable<Carriage, 'id'>
  sets!: EntityTable<CarriageSet, 'id'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      liveries: 'id',
      locomotives: 'id',
      carriages: 'id',
      sets: 'id',
    })
    this.on('populate', (tx) => {
      const fleet = seedFleet()
      tx.table('liveries').bulkAdd(fleet.liveries)
      tx.table('locomotives').bulkAdd(fleet.locomotives)
      tx.table('carriages').bulkAdd(fleet.carriages)
      tx.table('sets').bulkAdd(fleet.sets)
    })
  }
}

const byCode = <T extends { code: string }>(a: T, b: T) =>
  a.code.localeCompare(b.code, undefined, { numeric: true })

/** Stores everything in the browser's IndexedDB on this device. */
export class DexieRepository implements Repository {
  private db: Db

  constructor(name = 'pnesr') {
    this.db = new Db(name)
  }

  async getFleet(): Promise<Fleet> {
    const { db } = this
    return db.transaction('r', [db.liveries, db.locomotives, db.carriages, db.sets], async () => {
      const [liveries, locomotives, carriages, sets] = await Promise.all([
        db.liveries.toArray(),
        db.locomotives.toArray(),
        db.carriages.toArray(),
        db.sets.toArray(),
      ])
      return {
        liveries: liveries.sort((a, b) => a.name.localeCompare(b.name)),
        locomotives: locomotives.sort(byCode),
        carriages: carriages.sort(byCode),
        sets: sets.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      }
    })
  }

  watchFleet(listener: (fleet: Fleet) => void, onError?: (error: unknown) => void) {
    const sub = liveQuery(() => this.getFleet()).subscribe({ next: listener, error: onError })
    return () => sub.unsubscribe()
  }

  async saveLivery(livery: Livery) {
    await this.db.liveries.put(livery)
  }

  async deleteLivery(id: string) {
    const { db } = this
    await db.transaction('rw', [db.liveries, db.locomotives, db.carriages], async () => {
      const users = [
        ...(await db.locomotives.filter((l) => l.liveryId === id).toArray()),
        ...(await db.carriages.filter((c) => c.liveryId === id).toArray()),
      ]
      if (users.length)
        throw new StorageRuleError(
          `This livery is still used by ${users.map((u) => u.code).join(', ')}. Change their livery first.`,
        )
      await db.liveries.delete(id)
    })
  }

  async saveLocomotive(loco: Locomotive) {
    await this.db.locomotives.put(loco)
  }

  async deleteLocomotive(id: string) {
    await this.db.locomotives.delete(id)
  }

  async saveCarriage(carriage: Carriage) {
    await this.db.carriages.put(carriage)
  }

  async deleteCarriage(id: string) {
    const { db } = this
    await db.transaction('rw', [db.carriages, db.sets], async () => {
      const sets = await db.sets.filter((s) => s.carriageIds.includes(id)).toArray()
      if (sets.length)
        throw new StorageRuleError(
          `This carriage is in set ${sets.map((s) => `"${s.name}"`).join(', ')}. Remove it from the set first.`,
        )
      await db.carriages.delete(id)
    })
  }

  async saveSet(set: CarriageSet) {
    await this.db.sets.put(set)
  }

  async deleteSet(id: string) {
    await this.db.sets.delete(id)
  }
}
