// Dates are 'YYYY-MM-DD' strings and times are 'HH:MM:SS' strings, always in
// the trip's local time. Using UTC for date math avoids any time-zone shifts.

export function tripDays(startDate, endDate) {
  const days = []
  const d = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

export function formatDay(day) {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

export function formatTime(t) {
  const hhmm = t.slice(0, 5)
  return hhmm === '24:00' ? '00:00' : hhmm
}

export function hourToTime(h) {
  return h === 24 ? '24:00:00' : String(h).padStart(2, '0') + ':00:00'
}

// <input type="time"> gives 'HH:MM'. An end time of 00:00 means midnight
// at the end of the day, which we store as 24:00.
export function inputToTime(value, isEnd) {
  if (isEnd && value === '00:00') return '24:00:00'
  return value + ':00'
}

export function timeToHours(t) {
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}
