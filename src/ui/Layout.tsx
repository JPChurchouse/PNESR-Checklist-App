import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'

export function Layout() {
  const [logoMissing, setLogoMissing] = useState(false)
  return (
    <>
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
