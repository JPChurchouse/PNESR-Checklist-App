import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import { DexieRepository } from './storage/dexieRepository.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={new DexieRepository()} />
  </StrictMode>,
)
