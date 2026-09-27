import { Link } from 'react-router-dom'

export function Home() {
  return (
    <>
      <h1>Today</h1>
      <div className="home-grid">
        <div className="card home-card disabled" aria-disabled="true">
          <h2>Pre-operation safety check</h2>
          <p className="meta">Track, locomotive and carriage checks before passengers board. Coming soon.</p>
        </div>
        <div className="card home-card disabled" aria-disabled="true">
          <h2>Victoria Station tickets</h2>
          <p className="meta">Ticket numbers, float and takings. Coming soon.</p>
        </div>
        <div className="card home-card disabled" aria-disabled="true">
          <h2>Playground Station tickets</h2>
          <p className="meta">Ticket numbers, float and takings. Coming soon.</p>
        </div>
        <Link className="card home-card" to="/fleet">
          <h2>Fleet</h2>
          <p className="meta">Locomotives, carriages, carriage sets and liveries.</p>
        </Link>
      </div>
    </>
  )
}
