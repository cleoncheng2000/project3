import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Everything lives in one SQLite file (Node's built-in driver, no install needed).
const file = process.env.DB_FILE || join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'trips.db')
mkdirSync(dirname(file), { recursive: true })

export const db = new DatabaseSync(file)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    token_hash  TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trips (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    start_date  TEXT NOT NULL,
    end_date    TEXT NOT NULL,
    created_by  TEXT NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    trip_id       TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id       TEXT NOT NULL REFERENCES users(id),
    display_name  TEXT NOT NULL,
    joined_at     TEXT NOT NULL,
    PRIMARY KEY (trip_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS slots (
    id          TEXT PRIMARY KEY,
    trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day         TEXT NOT NULL,
    start_time  TEXT NOT NULL,
    end_time    TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    UNIQUE (trip_id, day, start_time, end_time)
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id            TEXT PRIMARY KEY,
    trip_id       TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    slot_id       TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
    created_by    TEXT NOT NULL REFERENCES users(id),
    kind          TEXT NOT NULL,
    title         TEXT NOT NULL,
    notes         TEXT,
    address       TEXT, lat REAL, lng REAL,
    from_address  TEXT, from_lat REAL, from_lng REAL,
    to_address    TEXT, to_lat REAL, to_lng REAL,
    travel_mode   TEXT,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS votes (
    trip_id        TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    slot_id        TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
    user_id        TEXT NOT NULL REFERENCES users(id),
    suggestion_id  TEXT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    created_at     TEXT NOT NULL,
    PRIMARY KEY (slot_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS slots_trip ON slots (trip_id);
  CREATE INDEX IF NOT EXISTS suggestions_trip ON suggestions (trip_id);
  CREATE INDEX IF NOT EXISTS votes_trip ON votes (trip_id);
`)

// Only a SHA-256 of each login token is stored, so a copy of this file can't be used to sign in.
export const hashToken = (token) => createHash('sha256').update(token).digest('hex')

// v1: older databases stored raw tokens in users.token — hash them in place.
if (db.prepare('PRAGMA user_version').get().user_version < 1) {
  db.exec('BEGIN')
  if (db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'token')) {
    db.exec('ALTER TABLE users RENAME COLUMN token TO token_hash')
    const update = db.prepare('UPDATE users SET token_hash = ? WHERE id = ?')
    for (const u of db.prepare('SELECT id, token_hash FROM users').all()) update.run(hashToken(u.token_hash), u.id)
  }
  db.exec('PRAGMA user_version = 1')
  db.exec('COMMIT')
  // Don't leave copies of the raw tokens in free pages or old WAL frames.
  db.exec('VACUUM; PRAGMA wal_checkpoint(TRUNCATE);')
}
