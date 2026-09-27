import type { ReactNode } from 'react'
import { RepositoryContext } from './context'
import type { Repository } from './repository'

export function RepositoryProvider({ repository, children }: { repository: Repository; children: ReactNode }) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>
}
