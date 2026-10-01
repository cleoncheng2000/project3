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

export async function request(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
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
      return await request('GET', '/me')
    } catch (e) {
      if (e.status !== 401) throw e
    }
  }
  const session = await request('POST', '/session')
  token = session.token
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // private browsing: identity lasts for this tab only
  }
  return { userId: session.userId }
}

// Calls onChange whenever anything in the trip changes. Returns an unsubscribe function.
export function subscribe(tripId, onChange) {
  const source = new EventSource(`/api/trips/${tripId}/events?token=${encodeURIComponent(token)}`)
  source.onmessage = onChange
  return () => source.close()
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
