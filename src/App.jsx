import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { ensureSession } from './lib/api.js'
import Home from './pages/Home.jsx'
import Trip from './pages/Trip.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    ensureSession()
      .then((s) => setUser({ id: s.userId }))
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="page narrow">
        <h1>Can't reach the server</h1>
        <p className="error">{error}</p>
      </div>
    )
  }
  if (!user) return <div className="page narrow">Loading…</div>

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Trip Planner</Link>
      </header>
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/trip/:tripId" element={<Trip user={user} />} />
      </Routes>
    </>
  )
}
