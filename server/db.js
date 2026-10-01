import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Everything lives in one SQLite file (Node's built-in driver, no install needed).
const file = process.env.DB_FILE || join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'trips.db')
mkdirSync(dirname(file), { recursive: true })

export const db = new DatabaseSync(file)

// A login token stops working after this long without being used.
export const TOKEN_TTL_MS = 90 * 86400000

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    token                  TEXT NOT NULL UNIQUE,
    created_at             TEXT NOT NULL,
    token_issued_at        TEXT,
    token_expires_at       TEXT,
    prev_token             TEXT,
    prev_token_expires_at  TEXT
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

// v1: databases created before tokens expired get the expiry/rotation columns.
if (db.prepare('PRAGMA user_version').get().user_version < 1) {
  const has = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name))
  db.exec('BEGIN')
  for (const col of ['token_issued_at', 'token_expires_at', 'prev_token', 'prev_token_expires_at']) {
    if (!has.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`)
  }
  // Existing tokens get a full lifetime from now; they'll be rotated on next use.
  db.prepare('UPDATE users SET token_issued_at = created_at, token_expires_at = ? WHERE token_expires_at IS NULL')
    .run(new Date(Date.now() + TOKEN_TTL_MS).toISOString())
  db.exec('PRAGMA user_version = 1')
  db.exec('COMMIT')
}
