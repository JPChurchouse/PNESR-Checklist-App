export type Specialty = 'standard' | 'driver' | 'guard' | 'wheelchair' | 'crew'

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  standard: 'Standard',
  driver: 'Driver',
  guard: 'Guard',
  wheelchair: 'Wheelchair',
  crew: 'Crew only',
}

export interface Livery {
  id: string
  name: string
}

/**
 * A photo is either a path to a bundled image under public/ (e.g. "fleet/loco-da.webp")
 * or a data: URL for a photo uploaded in the app. Both serialise as plain JSON, so any
 * storage backend can hold them.
 */
export type Photo = string | null

export interface Locomotive {
  /** Internal key. Never shown; stays fixed if the code is changed. */
  id: string
  /** The ID painted on the loco, e.g. "DXC". */
  code: string
  year: number | null
  liveryId: string | null
  fuel: string
  inService: boolean
  notes: string
  photo: Photo
}

export interface Carriage {
  id: string
  code: string
  specialty: Specialty
  liveryId: string | null
  inService: boolean
  notes: string
  photo: Photo
}

export interface CarriageSet {
  id: string
  name: string
  /** Front (driver) to back (guard). */
  carriageIds: string[]
}

export interface Fleet {
  liveries: Livery[]
  locomotives: Locomotive[]
  carriages: Carriage[]
  sets: CarriageSet[]
}
