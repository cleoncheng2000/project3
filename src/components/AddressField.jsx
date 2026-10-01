import { useState } from 'react'
import { searchAddress } from '../lib/geocode.js'

// Text input + "Find" button. Picking a result stores coordinates so it shows on the map.
// value: { address, lat, lng }
export default function AddressField({ label, value, onChange }) {
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  async function find() {
    if (!value.address.trim()) return
    setSearching(true)
    setError(null)
    try {
      const found = await searchAddress(value.address)
      setResults(found)
      if (found.length === 0) setError('No places found — try adding a city or country.')
    } catch (e) {
      setError(e.message)
    }
    setSearching(false)
  }

  return (
    <div className="address-field">
      <label>
        {label}
        <div className="row tight">
          <input
            value={value.address}
            onChange={(e) => {
              setResults(null)
              onChange({ address: e.target.value, lat: null, lng: null })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                find()
              }
            }}
            placeholder="Search a place or address"
          />
          <button type="button" onClick={find} disabled={searching}>
            {searching ? '…' : 'Find'}
          </button>
        </div>
      </label>
      {value.lat != null ? (
        <p className="small ok">On the map</p>
      ) : (
        value.address && !results && <p className="small muted">Press Find to put this on the map</p>
      )}
      {error && <p className="small error">{error}</p>}
      {results?.length > 0 && (
        <ul className="results">
          {results.map((r) => (
            <li key={r.lat + ',' + r.lng}>
              <button
                type="button"
                className="link"
                onClick={() => {
                  onChange({ address: r.label, lat: r.lat, lng: r.lng })
                  setResults(null)
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
