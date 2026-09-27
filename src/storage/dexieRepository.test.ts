import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { DexieRepository } from './dexieRepository'
import { StorageRuleError } from './repository'

let dbCount = 0
const freshRepo = () => new DexieRepository(`test-${++dbCount}`)

describe('DexieRepository', () => {
  it('seeds the default fleet on first open', async () => {
    const fleet = await freshRepo().getFleet()
    expect(fleet.locomotives.map((l) => l.code)).toEqual(['DA', 'DG', 'DXC', 'DXR'])
    expect(fleet.carriages).toHaveLength(19)
    expect(fleet.sets.map((s) => s.name)).toEqual(['2', '3', 'CC'])
  })

  it('renaming a livery changes it everywhere it is used', async () => {
    const repo = freshRepo()
    const cc = (await repo.getFleet()).liveries.find((l) => l.name === 'Capital Connection')!
    await repo.saveLivery({ ...cc, name: 'Capital Connection (2025)' })
    const fleet = await repo.getFleet()
    const carB = fleet.carriages.find((c) => c.code === 'B')!
    expect(fleet.liveries.find((l) => l.id === carB.liveryId)?.name).toBe('Capital Connection (2025)')
  })

  it('refuses to delete a livery that is in use', async () => {
    const repo = freshRepo()
    await expect(repo.deleteLivery('livery-kiwirail')).rejects.toThrow(StorageRuleError)
    await expect(repo.deleteLivery('livery-kiwirail')).rejects.toThrow(/DXC, DXR/)
  })

  it('refuses to delete a carriage that is in a set', async () => {
    const repo = freshRepo()
    await expect(repo.deleteCarriage('car-b')).rejects.toThrow(/"CC"/)
    await repo.deleteCarriage('car-a')
    expect((await repo.getFleet()).carriages.some((c) => c.code === 'A')).toBe(false)
  })

  it('notifies watchers after a change', async () => {
    const repo = freshRepo()
    const seen: string[] = []
    const done = new Promise<void>((resolve) => {
      const stop = repo.watchFleet((fleet) => {
        seen.push(fleet.sets.find((s) => s.id === 'set-1')!.name)
        if (seen.includes('Capital')) {
          stop()
          resolve()
        }
      })
    })
    const set1 = (await repo.getFleet()).sets.find((s) => s.id === 'set-1')!
    await repo.saveSet({ ...set1, name: 'Capital' })
    await done
    expect(seen.at(-1)).toBe('Capital')
  })
})

describe('upgrading older saved data', () => {
  it('converts pass/fail results from version 2 into ticks', async () => {
    const { default: Dexie } = await import('dexie')
    const name = `test-upgrade-${++dbCount}`
    const old = new Dexie(name)
    old.version(2).stores({ liveries: 'id', locomotives: 'id', carriages: 'id', sets: 'id', safetyChecks: 'id, startedAt' })
    await old.table('safetyChecks').add({
      id: 'old',
      date: '2026-09-28',
      startedAt: '2026-09-28T01:00:00.000Z',
      completedAt: null,
      trains: [],
      results: { 'track:radio': { status: 'pass', note: '' }, 'track:run-around': { status: 'fail', note: 'x' } },
      managerName: '',
      signature: null,
      notes: '',
    })
    old.close()

    const check = await new DexieRepository(name).getSafetyCheck('old')
    expect(check).toMatchObject({
      results: { 'track:radio': { checkedAt: '2026-09-28T01:00:00.000Z' } },
      outcome: 'operate',
      revision: 1,
      amendsId: null,
    })
    expect(check!.results['track:run-around']).toBeUndefined()
  })
})

describe('ticket storage', () => {
  it('returns default ticket settings until saved', async () => {
    const repo = freshRepo()
    const settings = await repo.getTicketSettings()
    expect(settings.ticketTypes.map((t) => t.name)).toEqual(['One-way', 'Return', 'Supporter', 'Concession'])
    expect(settings.eventTicketTypes.map((t) => t.name)).toEqual(['Event'])
    settings.ticketTypes[0].priceCents = 250
    await repo.saveTicketSettings(settings)
    expect((await repo.getTicketSettings()).ticketTypes[0].priceCents).toBe(250)
  })

  it('lists sheets per station, newest first, and protects completed ones', async () => {
    const { newTicketSheet, DEFAULT_TICKET_SETTINGS } = await import('../domain/tickets')
    const repo = freshRepo()
    const v1 = newTicketSheet('v1', 'victoria', DEFAULT_TICKET_SETTINGS, 'regular', new Date(2026, 8, 26))
    const v2 = newTicketSheet('v2', 'victoria', DEFAULT_TICKET_SETTINGS, 'regular', new Date(2026, 8, 27))
    const p1 = newTicketSheet('p1', 'playground', DEFAULT_TICKET_SETTINGS, 'event', new Date(2026, 8, 27))
    for (const s of [v1, v2, p1]) await repo.saveTicketSheet(s)
    expect((await repo.listTicketSheets('victoria')).map((s) => s.id)).toEqual(['v2', 'v1'])
    expect((await repo.listTicketSheets('playground')).map((s) => s.id)).toEqual(['p1'])

    await repo.saveTicketSheet({ ...v1, completedAt: new Date().toISOString() })
    await expect(repo.deleteTicketSheet('v1')).rejects.toThrow(StorageRuleError)
    await repo.deleteTicketSheet('v2')
    expect((await repo.listTicketSheets('victoria')).map((s) => s.id)).toEqual(['v1'])
  })
})

describe('upgrading older ticket sheets', () => {
  it('turns float counts into ticks and fills in the new fields', async () => {
    const { default: Dexie } = await import('dexie')
    const name = `test-upgrade-${++dbCount}`
    const old = new Dexie(name)
    old.version(4).stores({ liveries: 'id', locomotives: 'id', carriages: 'id', sets: 'id', safetyChecks: 'id, startedAt', settings: 'id', ticketSheets: 'id, [station+startedAt]' })
    await old.table('ticketSheets').add({
      id: 'old',
      station: 'victoria',
      date: '2026-09-28',
      startedAt: '2026-09-28T01:00:00.000Z',
      completedAt: '2026-09-28T05:00:00.000Z',
      cashier: 'Robin',
      tickets: [],
      float: [
        { denominationCents: 100, perBag: 10, bags: 3 },
        { denominationCents: 200, perBag: 10, bags: 4 },
      ],
      floatStart: { 100: 30, 200: 40 },
      floatEnd: { 100: 30, 200: 38 },
      cash: {},
      eftpos: { takings: null, totalCharged: null, surcharge: null },
      eftposReceipt: null,
      donations: { cash: null, eftpos: null },
      notes: '',
    })
    old.close()

    const sheet = await new DexieRepository(name).getTicketSheet('old')
    expect(sheet).toMatchObject({
      cashiers: 'Robin',
      kind: 'regular',
      staff: '',
      startSavedAt: '2026-09-28T05:00:00.000Z',
      floatStart: { ticks: { 100: true, 200: true }, note: '' },
      floatEnd: { ticks: { 100: true, 200: false }, note: '' },
      revision: 1,
      amendsId: null,
    })
    expect(sheet).not.toHaveProperty('cashier')
  })
})
