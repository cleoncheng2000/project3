import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useTripData } from '../lib/useTripData.js'
import { formatDay, tripDays } from '../lib/time.js'
import { rankSuggestions } from '../lib/winner.js'
import { getSavedName, saveName } from '../lib/name.js'
import DaySchedule from '../components/DaySchedule.jsx'
import DayMap from '../components/DayMap.jsx'

export default function Trip({ user }) {
  const { tripId } = useParams()
  const data = useTripData(tripId)

  if (data.status === 'loading') return <div className="page narrow">Loading trip…</div>
  if (data.status === 'not-found') return <div className="page narrow"><h2>Trip not found</h2><p>Check the invite link.</p></div>
  if (data.status === 'error') return <div className="page narrow"><p className="error">{data.error}</p></div>
  if (data.status === 'not-member') return <JoinTrip tripId={tripId} preview={data.preview} onJoined={data.reload} />

  return <TripView user={user} {...data} />
}

function JoinTrip({ tripId, preview, onJoined }) {
  const [name, setName] = useState(getSavedName())
  const [error, setError] = useState(null)

  async function join(e) {
    e.preventDefault()
    try {
      await api.joinTrip(tripId, name)
      saveName(name.trim())
      onJoined()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page narrow">
      <section className="card">
        <h2>You're invited: {preview.name}</h2>
        <p className="muted">{formatDay(preview.start_date)} – {formatDay(preview.end_date)}</p>
        <form onSubmit={join} className="form">
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoFocus />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary">Join trip</button>
        </form>
      </section>
    </div>
  )
}

function TripView({ user, trip, members, slots, suggestions, votes, reload }) {
  const days = useMemo(() => tripDays(trip.start_date, trip.end_date), [trip])
  const [day, setDay] = useState(days[0])
  const [copied, setCopied] = useState(false)

  const namesById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m.display_name])),
    [members],
  )

  // Attach ranked suggestions to each slot of the selected day.
  const daySlots = useMemo(
    () =>
      slots
        .filter((s) => s.day === day)
        .map((slot) => {
          const slotVotes = votes.filter((v) => v.slot_id === slot.id)
          return {
            ...slot,
            ranked: rankSuggestions(suggestions.filter((s) => s.slot_id === slot.id), slotVotes),
            myVote: slotVotes.find((v) => v.user_id === user.id)?.suggestion_id,
          }
        })
        .filter((slot) => slot.ranked.length > 0)
        .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time)),
    [slots, suggestions, votes, day, user.id],
  )

  function copyInvite() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="page wide">
      <div className="trip-header">
        <div>
          <h1>{trip.name}</h1>
          <p className="muted">
            {members.length} {members.length === 1 ? 'person' : 'people'}: {members.map((m) => m.display_name).join(', ')}
          </p>
        </div>
        <button onClick={copyInvite}>{copied ? 'Link copied!' : 'Copy invite link'}</button>
      </div>

      <nav className="day-tabs">
        {days.map((d, i) => (
          <button key={d} className={d === day ? 'active' : ''} onClick={() => setDay(d)}>
            <strong>Day {i + 1}</strong>
            <span>{formatDay(d)}</span>
          </button>
        ))}
      </nav>

      <div className="trip-body">
        <DaySchedule
          trip={trip}
          day={day}
          slots={daySlots}
          user={user}
          namesById={namesById}
          onChange={reload}
        />
        <DayMap slots={daySlots} />
      </div>
    </div>
  )
}
