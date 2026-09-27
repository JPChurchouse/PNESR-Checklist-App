import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { switchMode } from '../lib/mode'
import { useMode } from '../lib/modeContext'

export function Layout() {
  const [logoMissing, setLogoMissing] = useState(false)
  const mode = useMode()
  return (
    <>
      {mode === 'practice' && (
        <div className="practice-banner" role="status">
          <span>
            <strong>Practice mode</strong>: nothing here is a real record.
          </span>
          <button type="button" onClick={() => switchMode('live')}>
            Leave practice mode
          </button>
        </div>
      )}
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/">
            {!logoMissing && <img src={`${import.meta.env.BASE_URL}brand/logo.webp`} alt="" onError={() => setLogoMissing(true)} />}
            <div>
              <div className="app-title">Palmerston North Esplanade Scenic Railway</div>
              <div className="app-subtitle">Safety checks and ticket sheets</div>
            </div>
          </Link>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
