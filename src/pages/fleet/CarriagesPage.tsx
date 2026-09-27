import { Link } from 'react-router-dom'
import { Photo, ServiceBadge, SpecialtyBadge } from '../../ui/components'
import { liveryName, useFleetData } from './fleetData'

export function CarriagesPage() {
  const fleet = useFleetData()
  const setOf = (id: string) => fleet.sets.filter((s) => s.carriageIds.includes(id)).map((s) => s.name)
  return (
    <>
      <div className="page-head">
        <h1>Carriages</h1>
        <Link className="btn primary" to="new">
          Add carriage
        </Link>
      </div>
      <div className="grid">
        {fleet.carriages.map((car) => {
          const sets = setOf(car.id)
          return (
            <Link key={car.id} to={car.id} className="card vehicle-card">
              <Photo photo={car.photo} alt={`Carriage ${car.code}`} />
              <div className="body">
                <div className="title-row">
                  <span className="code">{car.code}</span>
                  <span className="actions">
                    <SpecialtyBadge specialty={car.specialty} />
                    {car.specialty !== 'crew' && <ServiceBadge inService={car.inService} />}
                  </span>
                </div>
                <span className="meta">{liveryName(fleet, car.liveryId)}</span>
                <span className="meta">{sets.length ? `Set ${sets.join(', ')}` : 'Not in a set'}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
