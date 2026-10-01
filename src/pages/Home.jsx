import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { formatDay } from '../lib/time.js'
import { getSavedName, saveName } from '../lib/name.js'

export default function Home({ user }) {
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [displayName, setDisplayName] = useState(getSavedName())
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.listTrips().then(setTrips).catch(() => setTrips([]))
  }, [user.id])

  async function createTrip(e) {
    e.preventDefault()
    if (endDate < startDate) return setError('End date must be on or after the start date.')
    setBusy(true)
    setError(null)
    try {
      const { id } = await api.createTrip({ name, startDate, endDate, displayName })
      saveName(displayName.trim())
      navigate('/trip/' + id)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="page narrow">
      <section className="card">
        <h2>My trips</h2>
        {trips.length === 0 ? (
          <p className="muted">No trips yet. Create one below, or open an invite link from a friend.</p>
        ) : (
          <ul className="trip-list">
            {trips.map((t) => (
              <li key={t.id}>
                <Link to={'/trip/' + t.id}>{t.name}</Link>
                <span className="muted"> · {formatDay(t.start_date)} – {formatDay(t.end_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>New trip</h2>
        <form onSubmit={createTrip} className="form">
          <label>
            Trip name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="Japan 2027" />
          </label>
          <div className="row">
            <label>
              Start date
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </label>
            <label>
              End date
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </label>
          </div>
          <label>
            Your name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={busy}>Create trip</button>
        </form>
      </section>
    </div>
  )
}
