import { createContext } from 'react'
import type { Repository } from './repository'

export const RepositoryContext = createContext<Repository | null>(null)
