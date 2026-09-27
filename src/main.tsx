import Dexie from 'dexie'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/install.ts'
import { App } from './App.tsx'
import { generateStaff } from './domain/practiceData.ts'
import { newId } from './lib/ids.ts'
import { databaseName, getMode, takePracticeReset } from './lib/mode.ts'
import { DexieRepository } from './storage/dexieRepository.ts'

async function start() {
  const mode = getMode()
  if (takePracticeReset()) await Dexie.delete(databaseName('practice'))
  const repository = new DexieRepository(
    databaseName(mode),
    mode === 'practice' ? (fleet) => generateStaff(fleet, () => newId('staff')) : undefined,
  )

  // Ask the browser not to clear the app's data when the device is low on space.
  navigator.storage?.persist?.().catch(() => {})

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App repository={repository} mode={mode} />
    </StrictMode>,
  )
}

start()
