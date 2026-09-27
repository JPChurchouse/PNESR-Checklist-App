import { useOutletContext } from 'react-router-dom'
import type { Fleet } from '../../domain/types'

/** The loaded fleet, for pages rendered inside FleetLayout. */
export const useFleetData = () => useOutletContext<Fleet>()

export const liveryName = (fleet: Fleet, id: string | null) =>
  fleet.liveries.find((l) => l.id === id)?.name ?? 'No livery'
