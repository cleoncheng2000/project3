// Talks to our own server (server/index.js). Each browser keeps a random
// token in localStorage that identifies it — no passwords.

const TOKEN_KEY = 'tripPlannerToken'

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

let token = readToken()

export class ApiError extends Error {
  constructor(status, body) {
    super(body.error || 'Request failed')
    this.status = status
    this.body = body
  }
}

function saveToken(value) {
  token = value
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // private browsing: identity lasts for this tab only
  }
}

export async function request(method, path, body) {
  const send = () =>
    fetch('/api' + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  let res = await send()
  // Another tab may have rotated the token; pick up the new one and try again.
  if (res.status === 401) {
    const stored = readToken()
    if (stored && stored !== token) {
      token = stored
      res = await send()
    }
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

// Returns { userId }, creating a new identity for this browser if needed.
// Shared promise so simultaneous callers don't create two identities.
let sessionPromise = null
export function ensureSession() {
  sessionPromise ||= startSession()
  return sessionPromise
}

async function startSession() {
  if (token) {
    try {
      // Keeps the token alive, and the server swaps in a fresh one about once a day.
      const session = await request('POST', '/session/refresh')
      if (session.token) saveToken(session.token)
      return { userId: session.userId }
    } catch (e) {
      if (e.status !== 401) throw e
    }
  }
  const session = await request('POST', '/session')
  saveToken(session.token)
  return { userId: session.userId }
}

// Calls onChange whenever anything in the trip changes. Returns an unsubscribe function.
// The stream is opened with a single-use ticket (never the login token), so every
// reconnect fetches a new ticket and then calls onChange to catch up on missed changes.
export function subscribe(tripId, onChange) {
  let source = null
  let retry = null
  let closed = false

  async function connect(reconnecting) {
    try {
      const { ticket } = await request('POST', `/trips/${tripId}/events/ticket`)
      if (closed) return
      source = new EventSource(`/api/trips/${tripId}/events?ticket=${encodeURIComponent(ticket)}`)
      source.onmessage = onChange
      if (reconnecting) source.onopen = onChange
      source.onerror = () => {
        source.close()
        scheduleReconnect()
      }
    } catch {
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (!closed) retry = setTimeout(() => connect(true), 3000)
  }

  connect(false)
  return () => {
    closed = true
    clearTimeout(retry)
    source?.close()
  }
}

export const api = {
  listTrips: () => request('GET', '/trips'),
  createTrip: (body) => request('POST', '/trips', body),
  getTrip: (id) => request('GET', '/trips/' + id),
  joinTrip: (id, displayName) => request('POST', `/trips/${id}/join`, { displayName }),
  addSuggestion: (tripId, body) => request('POST', `/trips/${tripId}/suggestions`, body),
  updateSuggestion: (id, body) => request('PATCH', '/suggestions/' + id, body),
  deleteSuggestion: (id) => request('DELETE', '/suggestions/' + id),
  vote: (slotId, suggestionId) => request('PUT', `/slots/${slotId}/vote`, { suggestionId }),
}
