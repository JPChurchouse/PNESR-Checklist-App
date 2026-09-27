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
