import { useState } from 'react'
import { hourToTime, timeToHours } from '../lib/time.js'
import SlotCard from './SlotCard.jsx'
import SuggestionForm from './SuggestionForm.jsx'

const DEFAULT_FIRST_HOUR = 7
const DEFAULT_LAST_HOUR = 22

// A day as a list: real slots (with suggestions) plus blank hourly rows for
// any hour not covered by a slot. Blank rows are free time.
export default function DaySchedule({ trip, day, slots, user, namesById, onChange }) {
  const [allHours, setAllHours] = useState(false)
  const [newAt, setNewAt] = useState(null) // hour whose blank row has the form open

  const first = allHours ? 0 : DEFAULT_FIRST_HOUR
  const last = allHours ? 23 : DEFAULT_LAST_HOUR

  const covered = (h) =>
    slots.some((s) => timeToHours(s.start_time) < h + 1 && timeToHours(s.end_time) > h)

  const rows = slots.map((slot) => ({ key: slot.id, sortAt: timeToHours(slot.start_time), slot }))
  for (let h = first; h <= last; h++) {
    if (!covered(h)) rows.push({ key: 'hour-' + h, sortAt: h, hour: h })
  }
  rows.sort((a, b) => a.sortAt - b.sortAt || (a.slot ? -1 : 1))

  return (
    <div className="schedule">
      <div className="schedule-toolbar">
        <label className="checkbox">
          <input type="checkbox" checked={allHours} onChange={(e) => setAllHours(e.target.checked)} />
          Show all 24 hours
        </label>
      </div>
      {rows.map((row) =>
        row.slot ? (
          <SlotCard key={row.key} slot={row.slot} trip={trip} user={user} namesById={namesById} onChange={onChange} />
        ) : (
          <div key={row.key} className="hour-row">
            <span className="time">{String(row.hour).padStart(2, '0')}:00</span>
            {newAt === row.hour ? (
              <SuggestionForm
                trip={trip}
                day={day}
                start={hourToTime(row.hour)}
                end={hourToTime(row.hour + 1)}
                onDone={() => {
                  setNewAt(null)
                  onChange()
                }}
                onCancel={() => setNewAt(null)}
              />
            ) : (
              <button className="ghost" onClick={() => setNewAt(row.hour)}>+ Suggest</button>
            )}
          </div>
        ),
      )}
    </div>
  )
}
