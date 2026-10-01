# Trip Planner — Spec (v1)

A small web app for a group of friends/family (~10 people) to plan a trip together:
suggest activities for timeslots, vote on them, and see the day on a map. Changes are live.

## Users & access
- No passwords. Each browser gets a random token from the server on first visit (kept in localStorage).
  It's sent only in the `Authorization` header, rotated about daily, and expires after 90 days unused.
  The live-updates stream uses a single-use, 60-second ticket for one trip instead.
- Creating a trip produces an invite link (`/trip/<id>`). Opening it asks for your name, then you're a member.
- Only members of a trip can see its contents; the server checks this on every request.

## Trips
- A trip has a name, start date and end date. Users can have multiple trips; the home page lists "My trips".
- Times are always the trip's local time (no time-zone conversion).

## Days & slots
- Each trip date is a day (tabs). Each day shows a list of hourly rows (07:00–22:00 by default, toggle for all 24h).
- A **slot** is a time range on a day (default 1h, but start/end are editable, e.g. 10:30–13:00).
- Empty hours stay blank (= free time).

## Suggestions & voting
- Anyone can suggest something for a slot. A suggestion is either:
  - **Activity** — title, address (located on the map), notes.
  - **Travel** — title, from address, to address, travel mode (walk, car, train, bus, flight, boat, other), notes.
- Each person has one vote per slot and can change it.
- The suggestion with the most votes is the slot's plan. **Ties → the earliest suggestion wins.**
- You can edit/delete only your own suggestions. A slot disappears when its last suggestion is deleted.

## Map
- Shows the selected day's winning suggestions in time order.
- Activities → numbered pins. Travel → a line from the start to the end location.
- Addresses are looked up via OpenStreetMap Nominatim (free).

## Live updates
- Server-Sent Events: after any change to a trip, the server notifies everyone viewing it and their page refreshes the data.

## Tech
| Part | Choice |
|---|---|
| Frontend | React 18 + Vite (JavaScript) |
| Server | Node.js + Express (API, permissions, live updates, serves the app) |
| Database | SQLite file via Node's built-in `node:sqlite` — no setup |
| Map | Leaflet + OpenStreetMap tiles |
| Geocoding | Nominatim |
| Hosting | Any always-on Node host with a disk, or your own PC + a tunnel |

## Data model
- `users(id, token, created_at, token_issued_at, token_expires_at, prev_token, prev_token_expires_at)`
- `trips(id, name, start_date, end_date, created_by, created_at)`
- `members(trip_id, user_id, display_name, joined_at)`
- `slots(id, trip_id, day, start_time, end_time)` — unique per (trip, day, start, end)
- `suggestions(id, trip_id, slot_id, created_by, kind, title, notes, address, lat, lng, from_*, to_*, travel_mode, created_at)`
- `votes(trip_id, slot_id, user_id, suggestion_id)` — one per (slot, user)

Permissions (members only, edit/delete own suggestions, one vote per slot) are enforced in `server/index.js`.

## Later (not in v1)
Mobile layout, offline, costs/expense splitting, photos, subgroups, editing trip dates, automatic route calculation.
