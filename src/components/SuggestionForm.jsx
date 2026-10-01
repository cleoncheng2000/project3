import { useState } from 'react'
import { api } from '../lib/api.js'
import { formatTime, inputToTime } from '../lib/time.js'
import { TRAVEL_MODES } from '../lib/winner.js'
import AddressField from './AddressField.jsx'

const place = (address, lat, lng) => ({ address: address || '', lat: lat ?? null, lng: lng ?? null })

// Three uses:
//  - new slot:     pass day + start + end (times editable)
//  - alternative:  pass slot
//  - edit:         pass slot + existing
export default function SuggestionForm({ trip, day, start, end, slot, existing, onDone, onCancel }) {
  const [kind, setKind] = useState(existing?.kind || 'activity')
  const [title, setTitle] = useState(existing?.title || '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [where, setWhere] = useState(place(existing?.address, existing?.lat, existing?.lng))
  const [from, setFrom] = useState(place(existing?.from_address, existing?.from_lat, existing?.from_lng))
  const [to, setTo] = useState(place(existing?.to_address, existing?.to_lat, existing?.to_lng))
  const [mode, setMode] = useState(existing?.travel_mode || 'walk')
  const [startInput, setStartInput] = useState(formatTime(start || slot.start_time))
  const [endInput, setEndInput] = useState(formatTime(end || slot.end_time))
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const fields = () => {
    const blank = { address: null, lat: null, lng: null, from_address: null, from_lat: null, from_lng: null, to_address: null, to_lat: null, to_lng: null, travel_mode: null }
    const common = { kind, title: title.trim(), notes: notes.trim() || null }
    if (kind === 'activity') {
      return { ...blank, ...common, address: where.address.trim() || null, lat: where.lat, lng: where.lng }
    }
    return {
      ...blank,
      ...common,
      from_address: from.address.trim() || null, from_lat: from.lat, from_lng: from.lng,
      to_address: to.address.trim() || null, to_lat: to.lat, to_lng: to.lng,
      travel_mode: mode,
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (existing) {
        await api.updateSuggestion(existing.id, fields())
      } else if (slot) {
        await api.addSuggestion(trip.id, { ...fields(), slotId: slot.id })
      } else {
        // The server reuses the slot if someone already picked these exact times.
        const startTime = inputToTime(startInput, false)
        const endTime = inputToTime(endInput, true)
        if (endTime <= startTime) throw new Error('End time must be after start time.')
        await api.addSuggestion(trip.id, { ...fields(), day, start: startTime, end: endTime })
      }
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="suggestion-form form" onSubmit={submit}>
      <div className="row">
        <div className="segmented">
          <button type="button" className={kind === 'activity' ? 'active' : ''} onClick={() => setKind('activity')}>Activity</button>
          <button type="button" className={kind === 'travel' ? 'active' : ''} onClick={() => setKind('travel')}>Travel</button>
        </div>
        {slot ? (
          <span className="muted">{formatTime(slot.start_time)}–{formatTime(slot.end_time)}</span>
        ) : (
          <div className="row tight">
            <input type="time" value={startInput} onChange={(e) => setStartInput(e.target.value)} required step={900} />
            <span>–</span>
            <input type="time" value={endInput} onChange={(e) => setEndInput(e.target.value)} required step={900} />
          </div>
        )}
      </div>

      <label>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
          autoFocus
          placeholder={kind === 'activity' ? 'Visit Fushimi Inari' : 'Train to Kyoto'}
        />
      </label>

      {kind === 'activity' ? (
        <AddressField label="Address" value={where} onChange={setWhere} />
      ) : (
        <>
          <label>
            Travel mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {TRAVEL_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <AddressField label="From" value={from} onChange={setFrom} />
          <AddressField label="To" value={to} onChange={setTo} />
        </>
      )}

      <label>
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />
      </label>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" disabled={busy}>{existing ? 'Save' : 'Suggest'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
