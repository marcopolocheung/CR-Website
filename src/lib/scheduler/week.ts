import { DAYS, type DayOfWeek } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Week keys are plain YYYY-MM-DD strings for the Sunday that starts the week, and every
 * calculation here runs in UTC. Local-time arithmetic drifts by a day across DST boundaries,
 * which would silently file a shift under the wrong week.
 */
function toUtcMs(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function toIsoDate(utcMs: number) {
  return new Date(utcMs).toISOString().slice(0, 10)
}

export function weekStartFor(date: Date) {
  const utcMs = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return toIsoDate(utcMs - new Date(utcMs).getUTCDay() * DAY_MS)
}

export function currentWeekStart() {
  return weekStartFor(new Date())
}

export function shiftWeek(weekStart: string, weeks: number) {
  return toIsoDate(toUtcMs(weekStart) + weeks * 7 * DAY_MS)
}

export function dateForDay(weekStart: string, day: DayOfWeek) {
  return toIsoDate(toUtcMs(weekStart) + DAYS.indexOf(day) * DAY_MS)
}

export function dayOfMonth(weekStart: string, day: DayOfWeek) {
  return new Date(toUtcMs(dateForDay(weekStart, day))).getUTCDate()
}

function monthName(utcMs: number, month: 'short' | 'long') {
  return new Date(utcMs).toLocaleDateString('en-US', { month, timeZone: 'UTC' })
}

/** Spelled out for headings: "September 6 - 12", or "March 29 - April 4" across two months. */
export function formatWeekRange(weekStart: string) {
  const startMs = toUtcMs(weekStart)
  const endMs = startMs + 6 * DAY_MS
  const start = new Date(startMs)
  const end = new Date(endMs)

  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${monthName(startMs, 'long')} ${start.getUTCDate()} - ${end.getUTCDate()}`
  }

  return `${monthName(startMs, 'long')} ${start.getUTCDate()} - ${monthName(endMs, 'long')} ${end.getUTCDate()}`
}

/** Abbreviated for a column header, where the month has to fit: "Sun, Sep 6". */
export function formatDayLabel(weekStart: string, day: DayOfWeek) {
  const utcMs = toUtcMs(dateForDay(weekStart, day))
  return `${day.slice(0, 3)}, ${monthName(utcMs, 'short')} ${new Date(utcMs).getUTCDate()}`
}

export function weeksBetween(fromWeekStart: string, toWeekStart: string) {
  return Math.round((toUtcMs(toWeekStart) - toUtcMs(fromWeekStart)) / (7 * DAY_MS))
}
