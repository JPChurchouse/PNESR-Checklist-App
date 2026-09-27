import { useContext, useEffect, useState } from 'react'
import type { Fleet } from '../domain/types'
import { RepositoryContext } from './context'
import type { Repository } from './repository'

export function useRepository(): Repository {
  const repo = useContext(RepositoryContext)
  if (!repo) throw new Error('useRepository must be used inside a RepositoryProvider')
  return repo
}

export type FleetState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; fleet: Fleet }

/** The current fleet, kept up to date as it changes (including from other tabs). */
export function useFleet(): FleetState {
  const repo = useRepository()
  const [state, setState] = useState<FleetState>({ status: 'loading' })
  useEffect(
    () =>
      repo.watchFleet(
        (fleet) => setState({ status: 'ready', fleet }),
        (error) => setState({ status: 'error', error }),
      ),
    [repo],
  )
  return state
}
