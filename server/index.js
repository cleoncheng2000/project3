import express from 'express'
import { randomBytes, randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, TOKEN_TTL_MS } from './db.js'

const PROD = process.argv.includes('--prod')
const PORT = Number(process.env.PORT) || 5173
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const app = express()
app.use(express.json({ limit: '100kb' }))

const now = () => new Date().toISOString()

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

// ---------- Live updates (Server-Sent Events) ----------

const listeners = new Map() // tripId -> Set of responses

function broadcast(tripId) {
  for (const res of listeners.get(tripId) || []) res.write('data: change\n\n')
}

// ---------- Auth: each browser gets a random token, no passwords ----------
// Tokens only travel in the Authorization header (never in URLs, which end up in logs and
// history). They expire after TOKEN_TTL_MS without use and are swapped for a new one about
// once a day; the old token keeps working briefly so in-flight requests and other tabs don't fail.

const DAY = 86400000
const ROTATE_AFTER_MS = DAY
const PREV_TOKEN_GRACE_MS = 2 * 60000
const later = (ms) => new Date(Date.now() + ms).toISOString()
const newToken = () => randomBytes(24).toString('hex')

function userFromToken(token) {
  if (!token) return undefined
  return db
    .prepare(
      `SELECT id, token = :token AS current, token_issued_at, token_expires_at FROM users
       WHERE (token = :token AND token_expires_at > :now)
          OR (prev_token = :token AND prev_token_expires_at > :now)`,
    )
    .get({ token, now: now() })
}

function auth(req, _res, next) {
  const [, token] = (req.get('authorization') || '').match(/^Bearer (\S+)$/) || []
  const user = userFromToken(token)
  if (!user) return next(new HttpError(401, 'Not signed in'))
  // Sliding expiry: using the token pushes its expiry out (written at most once a day).
  if (user.current && user.token_expires_at < later(TOKEN_TTL_MS - DAY)) {
    db.prepare('UPDATE users SET token_expires_at = ? WHERE id = ?').run(later(TOKEN_TTL_MS), user.id)
  }
  req.user = user
  req.userId = user.id
  next()
}

// EventSource can't send headers, so the live-updates stream is opened with a short-lived,
// single-use ticket for one trip instead of the login token.
const TICKET_TTL_MS = 60000
const tickets = new Map() // ticket -> { tripId, userId, expires }

function issueTicket(tripId, userId) {
  for (const [t, v] of tickets) if (v.expires < Date.now()) tickets.delete(t)
  const ticket = newToken()
  tickets.set(ticket, { tripId, userId, expires: Date.now() + TICKET_TTL_MS })
  return ticket
}

function redeemTicket(ticket, tripId) {
  const t = typeof ticket === 'string' && tickets.get(ticket)
  if (t) tickets.delete(ticket)
  if (!t || t.expires < Date.now() || t.tripId !== tripId) throw new HttpError(401, 'Invalid or expired ticket')
  return t.userId
}

function requireMember(tripId, userId) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId)
  if (!trip) throw new HttpError(404, 'Trip not found')
  const member = db.prepare('SELECT 1 FROM members WHERE trip_id = ? AND user_id = ?').get(tripId, userId)
  if (!member) {
    const { name, start_date, end_date } = trip
    throw new HttpError(403, 'Not a member of this trip', { preview: { name, start_date, end_date } })
  }
  return trip
}

// ---------- Validation ----------

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d:00$|^24:00:00$/
const MODES = ['walk', 'car', 'train', 'bus', 'flight', 'boat', 'other']

function text(value, field, max, required = true) {
  const v = typeof value === 'string' ? value.trim() : ''
  if (required && !v) throw new HttpError(400, `${field} is required`)
  if (v.length > max) throw new HttpError(400, `${field} is too long`)
  return v || null
}

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function suggestionFields(body) {
  const kind = body.kind === 'travel' ? 'travel' : 'activity'
  const f = {
    kind,
    title: text(body.title, 'Title', 120),
    notes: text(body.notes, 'Notes', 2000, false),
    address: null, lat: null, lng: null,
    from_address: null, from_lat: null, from_lng: null,
    to_address: null, to_lat: null, to_lng: null,
    travel_mode: null,
  }
  if (kind === 'activity') {
    f.address = text(body.address, 'Address', 300, false)
    f.lat = num(body.lat)
    f.lng = num(body.lng)
  } else {
    f.from_address = text(body.from_address, 'From', 300, false)
    f.from_lat = num(body.from_lat)
    f.from_lng = num(body.from_lng)
    f.to_address = text(body.to_address, 'To', 300, false)
    f.to_lat = num(body.to_lat)
    f.to_lng = num(body.to_lng)
    f.travel_mode = MODES.includes(body.travel_mode) ? body.travel_mode : 'other'
  }
  return f
}

// ---------- Routes ----------

const api = express.Router()

api.post('/session', (_req, res) => {
  const user = { id: randomUUID(), token: newToken() }
  db.prepare('INSERT INTO users (id, token, created_at, token_issued_at, token_expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(user.id, user.token, now(), now(), later(TOKEN_TTL_MS))
  res.json({ userId: user.id, token: user.token })
})

// Called on page load. Hands back a replacement token once the current one is a day old.
api.post('/session/refresh', auth, (req, res) => {
  const { user } = req
  if (!user.current || user.token_issued_at > later(-ROTATE_AFTER_MS)) return res.json({ userId: user.id })
  const token = newToken()
  db.prepare(
    `UPDATE users SET prev_token = token, prev_token_expires_at = ?,
       token = ?, token_issued_at = ?, token_expires_at = ? WHERE id = ?`,
  ).run(later(PREV_TOKEN_GRACE_MS), token, now(), later(TOKEN_TTL_MS), user.id)
  res.json({ userId: user.id, token })
})

api.get('/me', auth, (req, res) => res.json({ userId: req.userId }))

api.get('/trips', auth, (req, res) => {
  const trips = db
    .prepare(
      `SELECT t.id, t.name, t.start_date, t.end_date FROM trips t
       JOIN members m ON m.trip_id = t.id WHERE m.user_id = ? ORDER BY t.start_date`,
    )
    .all(req.userId)
  res.json(trips)
})

api.post('/trips', auth, (req, res) => {
  const name = text(req.body.name, 'Trip name', 100)
  const displayName = text(req.body.displayName, 'Your name', 40)
  const { startDate, endDate } = req.body
  if (!DATE.test(startDate) || !DATE.test(endDate)) throw new HttpError(400, 'Invalid dates')
  if (endDate < startDate) throw new HttpError(400, 'End date must be on or after the start date')
  if ((new Date(endDate) - new Date(startDate)) / 86400000 > 60) throw new HttpError(400, 'Trips can be at most 60 days')

  const id = randomUUID()
  db.prepare('INSERT INTO trips (id, name, start_date, end_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, startDate, endDate, req.userId, now())
  db.prepare('INSERT INTO members (trip_id, user_id, display_name, joined_at) VALUES (?, ?, ?, ?)')
    .run(id, req.userId, displayName, now())
  res.json({ id })
})

api.get('/trips/:id', auth, (req, res) => {
  const trip = requireMember(req.params.id, req.userId)
  const all = (table) => db.prepare(`SELECT * FROM ${table} WHERE trip_id = ?`).all(trip.id)
  res.json({
    trip,
    members: db.prepare('SELECT user_id, display_name, joined_at FROM members WHERE trip_id = ? ORDER BY joined_at').all(trip.id),
    slots: all('slots'),
    suggestions: all('suggestions'),
    votes: all('votes'),
  })
})

api.post('/trips/:id/join', auth, (req, res) => {
  const trip = db.prepare('SELECT id FROM trips WHERE id = ?').get(req.params.id)
  if (!trip) throw new HttpError(404, 'Trip not found')
  const displayName = text(req.body.displayName, 'Your name', 40)
  db.prepare(
    `INSERT INTO members (trip_id, user_id, display_name, joined_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (trip_id, user_id) DO UPDATE SET display_name = excluded.display_name`,
  ).run(trip.id, req.userId, displayName, now())
  broadcast(trip.id)
  res.json({ ok: true })
})

// Adds a suggestion to an existing slot (slotId) or to the slot with the given
// day/start/end, creating that slot if nobody has used those exact times yet.
api.post('/trips/:id/suggestions', auth, (req, res) => {
  const trip = requireMember(req.params.id, req.userId)
  const fields = suggestionFields(req.body)
  let slotId = req.body.slotId

  if (slotId) {
    if (!db.prepare('SELECT 1 FROM slots WHERE id = ? AND trip_id = ?').get(slotId, trip.id)) {
      throw new HttpError(404, 'Slot not found')
    }
  } else {
    const { day, start, end } = req.body
    if (!DATE.test(day) || day < trip.start_date || day > trip.end_date) throw new HttpError(400, 'Invalid day')
    if (!TIME.test(start) || !TIME.test(end)) throw new HttpError(400, 'Invalid time')
    if (end <= start) throw new HttpError(400, 'End time must be after start time')
    db.prepare(
      `INSERT INTO slots (id, trip_id, day, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (trip_id, day, start_time, end_time) DO NOTHING`,
    ).run(randomUUID(), trip.id, day, start, end, now())
    slotId = db.prepare('SELECT id FROM slots WHERE trip_id = ? AND day = ? AND start_time = ? AND end_time = ?')
      .get(trip.id, day, start, end).id
  }

  const id = randomUUID()
  db.prepare(
    `INSERT INTO suggestions (id, trip_id, slot_id, created_by, kind, title, notes, address, lat, lng,
       from_address, from_lat, from_lng, to_address, to_lat, to_lng, travel_mode, created_at)
     VALUES (:id, :trip_id, :slot_id, :created_by, :kind, :title, :notes, :address, :lat, :lng,
       :from_address, :from_lat, :from_lng, :to_address, :to_lat, :to_lng, :travel_mode, :created_at)`,
  ).run({ ...fields, id, trip_id: trip.id, slot_id: slotId, created_by: req.userId, created_at: now() })
  broadcast(trip.id)
  res.json({ id })
})

function ownSuggestion(id, userId) {
  const s = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id)
  if (!s) throw new HttpError(404, 'Suggestion not found')
  if (s.created_by !== userId) throw new HttpError(403, 'You can only change your own suggestions')
  return s
}

api.patch('/suggestions/:id', auth, (req, res) => {
  const s = ownSuggestion(req.params.id, req.userId)
  const fields = suggestionFields(req.body)
  db.prepare(
    `UPDATE suggestions SET kind = :kind, title = :title, notes = :notes, address = :address, lat = :lat, lng = :lng,
       from_address = :from_address, from_lat = :from_lat, from_lng = :from_lng,
       to_address = :to_address, to_lat = :to_lat, to_lng = :to_lng, travel_mode = :travel_mode
     WHERE id = :id`,
  ).run({ ...fields, id: s.id })
  broadcast(s.trip_id)
  res.json({ ok: true })
})

api.delete('/suggestions/:id', auth, (req, res) => {
  const s = ownSuggestion(req.params.id, req.userId)
  db.prepare('DELETE FROM suggestions WHERE id = ?').run(s.id)
  // A slot disappears with its last suggestion.
  db.prepare('DELETE FROM slots WHERE id = ? AND NOT EXISTS (SELECT 1 FROM suggestions WHERE slot_id = ?)')
    .run(s.slot_id, s.slot_id)
  broadcast(s.trip_id)
  res.json({ ok: true })
})

// One vote per person per slot. suggestionId = null removes your vote.
api.put('/slots/:id/vote', auth, (req, res) => {
  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id)
  if (!slot) throw new HttpError(404, 'Slot not found')
  requireMember(slot.trip_id, req.userId)
  const { suggestionId } = req.body
  if (suggestionId == null) {
    db.prepare('DELETE FROM votes WHERE slot_id = ? AND user_id = ?').run(slot.id, req.userId)
  } else {
    if (!db.prepare('SELECT 1 FROM suggestions WHERE id = ? AND slot_id = ?').get(suggestionId, slot.id)) {
      throw new HttpError(400, 'That suggestion is not in this slot')
    }
    db.prepare(
      `INSERT INTO votes (trip_id, slot_id, user_id, suggestion_id, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (slot_id, user_id) DO UPDATE SET suggestion_id = excluded.suggestion_id`,
    ).run(slot.trip_id, slot.id, req.userId, suggestionId, now())
  }
  broadcast(slot.trip_id)
  res.json({ ok: true })
})

api.post('/trips/:id/events/ticket', auth, (req, res) => {
  const trip = requireMember(req.params.id, req.userId)
  res.json({ ticket: issueTicket(trip.id, req.userId) })
})

api.get('/trips/:id/events', (req, res) => {
  const trip = requireMember(req.params.id, redeemTicket(req.query.ticket, req.params.id))
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()
  if (!listeners.has(trip.id)) listeners.set(trip.id, new Set())
  listeners.get(trip.id).add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25000)
  req.on('close', () => {
    clearInterval(ping)
    listeners.get(trip.id).delete(res)
  })
})

api.use((_req, _res, next) => next(new HttpError(404, 'Not found')))

// eslint-disable-next-line no-unused-vars
api.use((err, _req, res, _next) => {
  if (!(err instanceof HttpError)) console.error(err)
  const status = err.status || 500
  res.status(status).json({ error: status === 500 ? 'Server error' : err.message, ...err.extra })
})

app.use('/api', api)

// ---------- Frontend ----------

if (PROD) {
  app.use(express.static(join(root, 'dist')))
  app.get('*', (_req, res) => res.sendFile(join(root, 'dist', 'index.html')))
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
}

app.listen(PORT, () => console.log(`Trip Planner running at http://localhost:${PORT}`))
