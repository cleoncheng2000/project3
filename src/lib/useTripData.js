import { useCallback, useEffect, useRef, useState } from 'react'
import { api, subscribe } from './api.js'

// Loads everything for one trip and keeps it live: the server pings us on
// any change and we refetch (debounced). Trips are small, so this is simple and safe.
export function useTripData(tripId) {
  const [state, setState] = useState({ status: 'loading' })
  const [member, setMember] = useState(false)
  const timer = useRef(null)

  const load = useCallback(async () => {
    try {
      const data = await api.getTrip(tripId)
      setState({ status: 'ready', ...data })
      setMember(true)
    } catch (e) {
      if (e.status === 403) setState({ status: 'not-member', preview: e.body.preview })
      else if (e.status === 404) setState({ status: 'not-found' })
      else setState({ status: 'error', error: e.message })
    }
  }, [tripId])

  useEffect(() => {
    setState({ status: 'loading' })
    setMember(false)
    load()
  }, [load])

  // Only members can listen for changes, so subscribe once we've loaded as one.
  useEffect(() => {
    if (!member) return
    const unsubscribe = subscribe(tripId, () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(load, 100)
    })
    return () => {
      clearTimeout(timer.current)
      unsubscribe()
    }
  }, [member, tripId, load])

  return { ...state, reload: load }
}
