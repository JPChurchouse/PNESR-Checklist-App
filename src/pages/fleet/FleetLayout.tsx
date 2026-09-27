import { NavLink, Outlet } from 'react-router-dom'
import { useFleet } from '../../storage/hooks'
import { ErrorNotice } from '../../ui/components'

const tabs = [
  ['locomotives', 'Locomotives'],
  ['carriages', 'Carriages'],
  ['sets', 'Sets'],
  ['liveries', 'Liveries'],
] as const

export function FleetLayout() {
  const state = useFleet()
  return (
    <>
      <nav className="tabs" aria-label="Fleet">
        {tabs.map(([path, label]) => (
          <NavLink key={path} to={path}>
            {label}
          </NavLink>
        ))}
      </nav>
      {state.status === 'loading' && <p className="meta">Loading…</p>}
      {state.status === 'error' && <ErrorNotice error={state.error} />}
      {state.status === 'ready' && <Outlet context={state.fleet} />}
    </>
  )
}
