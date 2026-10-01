import { useState } from 'react'
import { api } from '../lib/api.js'
import { formatTime } from '../lib/time.js'
import SuggestionForm from './SuggestionForm.jsx'

export default function SlotCard({ slot, trip, user, namesById, onChange }) {
  const [form, setForm] = useState(null) // null | 'add' | suggestion being edited
  const [error, setError] = useState(null)
  const [winner, ...others] = slot.ranked

  async function run(action) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    }
    onChange()
  }

  // Clicking your current vote again removes it.
  const vote = (s) => run(() => api.vote(slot.id, slot.myVote === s.id ? null : s.id))
  const remove = (s) => run(() => api.deleteSuggestion(s.id))

  function done() {
    setForm(null)
    onChange()
  }

  const renderSuggestion = (s, isWinner) =>
    form?.id === s.id ? (
      <SuggestionForm key={s.id} trip={trip} slot={slot} existing={s} onDone={done} onCancel={() => setForm(null)} />
    ) : (
      <Suggestion
        key={s.id}
        s={s}
        isWinner={isWinner}
        voted={slot.myVote === s.id}
        mine={s.created_by === user.id}
        author={namesById[s.created_by] || 'someone'}
        onVote={() => vote(s)}
        onEdit={() => setForm(s)}
        onDelete={() => remove(s)}
      />
    )

  return (
    <div className="slot">
      <div className="slot-time">
        <span className="time">{formatTime(slot.start_time)}</span>
        <span className="time end">{formatTime(slot.end_time)}</span>
      </div>
      <div className="slot-body">
        {renderSuggestion(winner, true)}
        {others.length > 0 && (
          <div className="alternatives">
            <p className="label">Other suggestions</p>
            {others.map((s) => renderSuggestion(s, false))}
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {form === 'add' ? (
          <SuggestionForm trip={trip} slot={slot} onDone={done} onCancel={() => setForm(null)} />
        ) : (
          <button className="ghost small" onClick={() => setForm('add')}>+ Suggest an alternative</button>
        )}
      </div>
    </div>
  )
}

function Suggestion({ s, isWinner, voted, mine, author, onVote, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={'suggestion' + (isWinner ? ' winner' : '')}>
      <div className="suggestion-main">
        <div className="suggestion-title">
          <span className={'kind ' + s.kind}>{s.kind === 'travel' ? s.travel_mode || 'travel' : 'activity'}</span>
          <strong>{s.title}</strong>
        </div>
        {s.kind === 'activity' && s.address && <p className="place">{s.address}</p>}
        {s.kind === 'travel' && (s.from_address || s.to_address) && (
          <p className="place">{s.from_address || '?'} → {s.to_address || '?'}</p>
        )}
        {s.notes && <p className="notes">{s.notes}</p>}
        <p className="meta">
          Suggested by {mine ? 'you' : author}
          {mine && !confirming && (
            <>
              {' · '}<button className="link" onClick={onEdit}>Edit</button>
              {' · '}<button className="link" onClick={() => setConfirming(true)}>Delete</button>
            </>
          )}
          {confirming && (
            <>
              {' · Delete this? '}
              <button className="link danger" onClick={onDelete}>Yes, delete</button>
              {' · '}<button className="link" onClick={() => setConfirming(false)}>Cancel</button>
            </>
          )}
        </p>
      </div>
      <div className="vote">
        <button className={voted ? 'voted' : ''} onClick={onVote} title={voted ? 'Remove your vote' : 'Vote for this'}>
          ▲ {s.voteCount}
        </button>
      </div>
    </div>
  )
}
