import { createContext, useContext } from 'react'
import type { AppMode } from './mode'

export const ModeContext = createContext<AppMode>('live')

/** Whether the app is running on real records or the practice database. */
export const useMode = () => useContext(ModeContext)
