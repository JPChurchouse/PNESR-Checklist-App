import { Link } from 'react-router-dom'
import { Photo, ServiceBadge } from '../../ui/components'
import { liveryName, useFleetData } from './fleetData'

export function LocomotivesPage() {
  const fleet = useFleetData()
  return (
    <>
      <div className="page-head">
        <h1>Locomotives</h1>
        <Link className="btn primary" to="new">
          Add locomotive
        </Link>
      </div>
      <div className="grid">
        {fleet.locomotives.map((loco) => (
          <Link key={loco.id} to={loco.id} className="card vehicle-card">
            <Photo photo={loco.photo} alt={`Locomotive ${loco.code}`} />
            <div className="body">
              <div className="title-row">
                <span className="code">{loco.code}</span>
                <ServiceBadge inService={loco.inService} />
              </div>
              <span className="meta">
                {[loco.year, liveryName(fleet, loco.liveryId), loco.fuel].filter(Boolean).join(' · ')}
              </span>
              {loco.notes && <span className="meta">⚠ {loco.notes}</span>}
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
