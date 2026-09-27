import { Link } from 'react-router-dom'
import { STATION_IDS, STATIONS } from '../domain/tickets'

export function Home() {
  return (
    <>
      <h1>Today</h1>
      <div className="home-grid">
        <Link className="card home-card" to="/safety">
          <h2>Pre-operation safety check</h2>
          <p className="meta">Track, locomotive and carriage checks before passengers board.</p>
        </Link>
        {STATION_IDS.map((id) => (
          <Link key={id} className="card home-card" to={`/tickets/${id}`}>
            <h2>{STATIONS[id].name} tickets</h2>
            <p className="meta">Ticket numbers, float, takings and the end-of-day count.</p>
          </Link>
        ))}
        <Link className="card home-card" to="/fleet">
          <h2>Fleet</h2>
          <p className="meta">Locomotives, carriages, carriage sets and liveries.</p>
        </Link>
        <Link className="card home-card" to="/settings/tickets">
          <h2>Tickets and float</h2>
          <p className="meta">Ticket prices and colours, and what goes in the float.</p>
        </Link>
      </div>
    </>
  )
}
