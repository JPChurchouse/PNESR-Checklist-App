// Safety checks and ticket sheets are corrected by adding a new revision that points at the one
// it replaces (`amendsId`), so earlier signed-off versions are never altered.

export interface Revisable {
  id: string
  amendsId: string | null
  completedAt: string | null
}

/** The revisions a record amends, oldest first, ending with the record itself. */
export function revisionChainOf<T extends Revisable>(record: T, all: T[]): T[] {
  const byId = new Map(all.map((c) => [c.id, c]))
  const chain = [record]
  for (let c = record; c.amendsId && byId.has(c.amendsId); ) {
    c = byId.get(c.amendsId)!
    chain.unshift(c)
  }
  return chain
}

/** Records worth listing: all except those replaced by a signed-off correction. */
export function currentRecords<T extends Revisable>(all: T[]): T[] {
  const superseded = new Set(all.filter((c) => c.completedAt && c.amendsId).map((c) => c.amendsId))
  return all.filter((c) => !superseded.has(c.id))
}
