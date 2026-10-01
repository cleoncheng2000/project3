import { DatabaseSync } from 'node:sqlite'
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
    token       TEXT NOT NULL UNIQUE,
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
