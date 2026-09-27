import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { CarriageEditPage } from './pages/fleet/CarriageEditPage'
import { CarriagesPage } from './pages/fleet/CarriagesPage'
import { FleetLayout } from './pages/fleet/FleetLayout'
import { LiveriesPage } from './pages/fleet/LiveriesPage'
import { LocomotiveEditPage } from './pages/fleet/LocomotiveEditPage'
import { LocomotivesPage } from './pages/fleet/LocomotivesPage'
import { SetEditPage } from './pages/fleet/SetEditPage'
import { SetsPage } from './pages/fleet/SetsPage'
import { BackupPage } from './pages/BackupPage'
import { Home } from './pages/Home'
import { PracticePage } from './pages/PracticePage'
import { StaffPage } from './pages/StaffPage'
import { SafetyCheckPage } from './pages/safety/SafetyCheckPage'
import { SafetyChecksPage } from './pages/safety/SafetyChecksPage'
import { TicketSettingsPage } from './pages/settings/TicketSettingsPage'
import { TicketSheetPage } from './pages/tickets/TicketSheetPage'
import { TicketSheetsPage } from './pages/tickets/TicketSheetsPage'
import type { AppMode } from './lib/mode'
import { ModeContext } from './lib/modeContext'
import type { Repository } from './storage/repository'
import { RepositoryProvider } from './storage/RepositoryProvider'
import { Layout } from './ui/Layout'

// Hash routing works on any static host (or a Pi) without server-side rewrite rules.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'safety', element: <SafetyChecksPage /> },
      { path: 'safety/:id', element: <SafetyCheckPage /> },
      { path: 'tickets/:station', element: <TicketSheetsPage /> },
      { path: 'tickets/:station/:id', element: <TicketSheetPage /> },
      { path: 'settings/tickets', element: <TicketSettingsPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'backup', element: <BackupPage /> },
      { path: 'practice', element: <PracticePage /> },
      {
        path: 'fleet',
        element: <FleetLayout />,
        children: [
          { index: true, element: <Navigate to="locomotives" replace /> },
          { path: 'locomotives', element: <LocomotivesPage /> },
          { path: 'locomotives/:id', element: <LocomotiveEditPage /> },
          { path: 'carriages', element: <CarriagesPage /> },
          { path: 'carriages/:id', element: <CarriageEditPage /> },
          { path: 'sets', element: <SetsPage /> },
          { path: 'sets/:id', element: <SetEditPage /> },
          { path: 'liveries', element: <LiveriesPage /> },
        ],
      },
    ],
  },
])

export function App({ repository, mode }: { repository: Repository; mode: AppMode }) {
  return (
    <ModeContext.Provider value={mode}>
      <RepositoryProvider repository={repository}>
        <RouterProvider router={router} />
      </RepositoryProvider>
    </ModeContext.Provider>
  )
}
