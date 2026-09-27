import type { Carriage, CarriageSet, Fleet, Livery, Locomotive, Specialty } from './types'

// Default fleet, loaded the first time the app opens. Everything here can be edited in the app.

const liveryNames = [
  'Red',
  'KiwiRail',
  'Burgundy',
  'Work Train',
  'Capital Connection',
  'Autism NZ',
  'Manawatu Turbos',
  'Wildbase Recovery',
  'Scouts NZ',
  'Lions Club',
  'Orange',
  'Freemasons NZ',
  'Emergency Services',
  'Central Energy Trust',
  'Kind Hearts Movement',
  'Esplanade Scenic Railway',
  'Cadet Forces',
]

const liveryId = (name: string) =>
  'livery-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

const liveries: Livery[] = liveryNames.map((name) => ({ id: liveryId(name), name }))

const loco = (code: string, year: number, livery: string): Locomotive => ({
  id: `loco-${code.toLowerCase()}`,
  code,
  year,
  liveryId: liveryId(livery),
  fuel: 'Diesel',
  inService: true,
  notes: '',
  photo: `fleet/loco-${code.toLowerCase()}.webp`,
})

const locomotives: Locomotive[] = [
  loco('DA', 1969, 'Red'),
  loco('DXC', 1975, 'KiwiRail'),
  loco('DXR', 1997, 'KiwiRail'),
  loco('DG', 2024, 'Burgundy'),
]

const car = (code: string, specialty: Specialty, livery: string, hasPhoto = true): Carriage => ({
  id: `car-${code.toLowerCase()}`,
  code,
  specialty,
  liveryId: liveryId(livery),
  inService: specialty !== 'crew',
  notes: specialty === 'crew' ? 'Retired from passenger service.' : '',
  photo: hasPhoto ? `fleet/car-${code.toLowerCase()}.webp` : null,
})

const carriages: Carriage[] = [
  car('A', 'crew', 'Work Train', false),
  car('B', 'standard', 'Capital Connection'),
  car('C', 'driver', 'Capital Connection'),
  car('D', 'standard', 'Capital Connection'),
  car('E', 'driver', 'Autism NZ'),
  car('F', 'standard', 'Manawatu Turbos'),
  car('G', 'standard', 'Wildbase Recovery'),
  car('H', 'guard', 'Scouts NZ'),
  car('I', 'guard', 'Capital Connection'),
  car('J', 'driver', 'Lions Club'),
  car('K', 'standard', 'Capital Connection'),
  car('L', 'guard', 'Orange'),
  car('M', 'standard', 'Capital Connection'),
  car('N', 'standard', 'Freemasons NZ'),
  car('O', 'standard', 'Emergency Services'),
  car('P', 'standard', 'Central Energy Trust'),
  car('Q', 'wheelchair', 'Kind Hearts Movement'),
  car('R', 'standard', 'Esplanade Scenic Railway'),
  car('S', 'standard', 'Cadet Forces'),
]

const set = (id: string, name: string, codes: string): CarriageSet => ({
  id,
  name,
  carriageIds: codes.split('').map((c) => `car-${c.toLowerCase()}`),
})

const sets: CarriageSet[] = [
  set('set-1', 'CC', 'CBDKMI'),
  set('set-2', '2', 'EFGNOH'),
  set('set-3', '3', 'JPRSQL'),
]

export function seedFleet(): Fleet {
  return structuredClone({ liveries, locomotives, carriages, sets })
}
