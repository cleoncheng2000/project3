# Trip Planner

A shared itinerary planner for a group of friends/family. Suggest activities or travel for
timeslots, vote on the best one, and see each day on a map — all live. See [SPEC.md](SPEC.md).

No accounts or external services to set up: a small Node server stores everything in a local
SQLite file (`data/trips.db`) using Node's built-in SQLite, and pushes live updates to browsers.

## Run it
Requires Node.js 22.13 or newer.
```bash
npm install
npm run dev        # http://localhost:5173 (auto-reloads while developing)
```
For a production build:
```bash
npm run build
npm start          # serves the built app + API on http://localhost:5173 (PORT env var to change)
```
Create a trip and share the invite link (`/trip/<id>`). Friends need to reach the server, so for
real use host it somewhere always-on (any Node host with a persistent disk), or share it from your
own PC with a tunnel such as `cloudflared tunnel --url http://localhost:5173`.

> **Only share `npm start`, never `npm run dev`.** The dev server serves the project's source files
> and only listens on this machine (`127.0.0.1`), so don't tunnel it or override that with `HOST`.
> `npm start` serves just the built app and listens on all interfaces (set `HOST` to change).

> **npm certificate errors (Zscaler / corporate proxy):** run
> `NODE_OPTIONS=--use-system-ca npm install` so Node trusts the Windows certificate store.

## How it works
- **Identity:** each browser gets a random token (stored in localStorage); you just type your name
  when joining. A different browser/device counts as a different person. The server only stores a
  hash of each token.
- **Slots:** click **+ Suggest** on an empty hour. Times default to 1 hour but can be changed.
- **Voting:** one vote per person per slot (click again to remove). Most votes wins; ties go to the earliest suggestion.
- **Travel** is its own suggestion type with a from/to address and mode; it's drawn as a line on the map.
- **Map:** use **Find** on an address (OpenStreetMap search) to place it on the map.
- **Backups:** everything is in `data/trips.db` — copy that file to back up.

## Project layout
```
server/index.js      API, permissions, live updates (Server-Sent Events), serves the app
server/db.js         SQLite tables
src/lib/             API client, live trip data hook, helpers
src/pages/           Home (my trips / new trip), Trip (join + planner)
src/components/      DaySchedule, SlotCard, SuggestionForm, AddressField, DayMap
```
