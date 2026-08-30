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

function shortMonth(utcMs: number) {
  return new Date(utcMs).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

/** "Mar 3-9" within one month, "Mar 30 - Apr 5" across two. */
export function formatWeekRange(weekStart: string) {
  const startMs = toUtcMs(weekStart)
  const endMs = startMs + 6 * DAY_MS
  const start = new Date(startMs)
  const end = new Date(endMs)

  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${shortMonth(startMs)} ${start.getUTCDate()}-${end.getUTCDate()}`
  }

  return `${shortMonth(startMs)} ${start.getUTCDate()} - ${shortMonth(endMs)} ${end.getUTCDate()}`
}

export function weeksBetween(fromWeekStart: string, toWeekStart: string) {
  return Math.round((toUtcMs(toWeekStart) - toUtcMs(fromWeekStart)) / (7 * DAY_MS))
}
