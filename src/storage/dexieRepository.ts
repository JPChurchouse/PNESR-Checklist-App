import Dexie, { liveQuery, type EntityTable } from 'dexie'
import type { SafetyCheck } from '../domain/safetyCheck'
import { seedFleet } from '../domain/seed'
import type { StaffMember } from '../domain/staff'
import { withSettingDefaults, type StationId, type TicketSettings, type TicketSheet } from '../domain/tickets'
import type { Carriage, CarriageSet, Fleet, Livery, Locomotive } from '../domain/types'
import { StorageRuleError, type Repository } from './repository'

class Db extends Dexie {
  liveries!: EntityTable<Livery, 'id'>
  locomotives!: EntityTable<Locomotive, 'id'>
  carriages!: EntityTable<Carriage, 'id'>
  sets!: EntityTable<CarriageSet, 'id'>
  safetyChecks!: EntityTable<SafetyCheck, 'id'>
  settings!: EntityTable<{ id: string; value: unknown }, 'id'>
  ticketSheets!: EntityTable<TicketSheet, 'id'>
  staff!: EntityTable<StaffMember, 'id'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      liveries: 'id',
      locomotives: 'id',
      carriages: 'id',
      sets: 'id',
    })
    this.version(2).stores({
      safetyChecks: 'id, startedAt',
    })
    // v3: pass/fail replaced by a tick with a time, and revisions added.
    this.version(3).upgrade((tx) =>
      tx
        .table('safetyChecks')
        .toCollection()
        .modify((check: Record<string, unknown>) => {
          const old = check.results as Record<string, { status?: string; checkedAt?: string }>
          check.results = Object.fromEntries(
            Object.entries(old)
              .filter(([, r]) => r.checkedAt || r.status === 'pass')
              .map(([k, r]) => [k, { checkedAt: r.checkedAt ?? (check.completedAt as string) ?? (check.startedAt as string) }]),
          )
          check.outcome ??= 'operate'
          check.cancelReason ??= ''
          check.revision ??= 1
          check.amendsId ??= null
          check.amendmentReason ??= ''
        }),
    )
    this.version(4).stores({
      settings: 'id',
      ticketSheets: 'id, [station+startedAt]',
    })
    // v5: float counts become ticks, cashier becomes cashiers, and sheets gain staff, sign-off,
    // a saved start of shift, special events and revisions.
    this.version(5).upgrade((tx) =>
      tx
        .table('ticketSheets')
        .toCollection()
        .modify((sheet: Record<string, unknown>) => {
          const float = sheet.float as { denominationCents: number; perBag: number; bags: number }[]
          const toTicks = (counts: unknown) => {
            const c = (counts ?? {}) as Record<string, number | null>
            if ('ticks' in c) return c
            return {
              ticks: Object.fromEntries(float.map((f) => [f.denominationCents, c[f.denominationCents] === f.perBag * f.bags])),
              note: '',
            }
          }
          sheet.floatStart = toTicks(sheet.floatStart)
          sheet.floatEnd = toTicks(sheet.floatEnd)
          sheet.cashiers ??= (sheet.cashier as string | undefined) ?? ''
          delete sheet.cashier
          sheet.kind ??= 'regular'
          sheet.eventName ??= ''
          sheet.staff ??= ''
          sheet.startSavedAt ??= sheet.completedAt ?? null
          sheet.managerName ??= ''
          sheet.signature ??= null
          sheet.revision ??= 1
          sheet.amendsId ??= null
          sheet.amendmentReason ??= ''
        }),
    )
    // v6: staff list, and a driver and guard for each train.
    this.version(6)
      .stores({ staff: 'id' })
      .upgrade((tx) =>
        tx
          .table('safetyChecks')
          .toCollection()
          .modify((check: { trains: { driver?: string; guard?: string }[] }) => {
            for (const t of check.trains) {
              t.driver ??= ''
              t.guard ??= ''
            }
          }),
      )
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

  async listSafetyChecks() {
    return this.db.safetyChecks.orderBy('startedAt').reverse().toArray()
  }

  async getSafetyCheck(id: string) {
    return this.db.safetyChecks.get(id)
  }

  async saveSafetyCheck(check: SafetyCheck) {
    await this.db.safetyChecks.put(check)
  }

  async getTicketSettings() {
    const row = await this.db.settings.get('tickets')
    return withSettingDefaults((row?.value as Partial<TicketSettings> | undefined) ?? {})
  }

  async saveTicketSettings(settings: TicketSettings) {
    await this.db.settings.put({ id: 'tickets', value: settings })
  }

  async listTicketSheets(station: StationId) {
    return this.db.ticketSheets.where('[station+startedAt]').between([station, ''], [station, '￿']).reverse().toArray()
  }

  async getTicketSheet(id: string) {
    return this.db.ticketSheets.get(id)
  }

  async saveTicketSheet(sheet: TicketSheet) {
    await this.db.ticketSheets.put(sheet)
  }

  async deleteTicketSheet(id: string) {
    const { db } = this
    await db.transaction('rw', db.ticketSheets, async () => {
      const sheet = await db.ticketSheets.get(id)
      if (sheet?.completedAt) throw new StorageRuleError('A completed ticket sheet is a record and can’t be deleted.')
      await db.ticketSheets.delete(id)
    })
  }

  async listStaff() {
    return (await this.db.staff.toArray()).sort((a, b) => `${a.firstName} ${a.surname}`.localeCompare(`${b.firstName} ${b.surname}`))
  }

  async replaceStaff(staff: StaffMember[]) {
    const { db } = this
    await db.transaction('rw', db.staff, async () => {
      await db.staff.clear()
      await db.staff.bulkAdd(staff)
    })
  }

  async deleteSafetyCheck(id: string) {
    const { db } = this
    await db.transaction('rw', db.safetyChecks, async () => {
      const check = await db.safetyChecks.get(id)
      if (check?.completedAt) throw new StorageRuleError('A completed safety check is a record and can’t be deleted.')
      await db.safetyChecks.delete(id)
    })
  }
}
