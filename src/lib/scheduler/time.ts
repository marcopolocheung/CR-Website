import type { TimeRange } from './types'

export function minutes(hour: number, minute = 0) {
  return hour * 60 + minute
}

/** Zero padded so times line up when stacked in a column, e.g. "04:00 PM". */
export function formatTime(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`
}

export function formatTimeRange(range: TimeRange) {
  return `${formatTime(range.start)} - ${formatTime(range.end)}`
}

export function rangesOverlap(a: TimeRange, b: TimeRange) {
  return a.start < b.end && b.start < a.end
}

export function rangeContains(container: TimeRange, contained: TimeRange) {
  return container.start <= contained.start && container.end >= contained.end
}

export function hoursFor(range: TimeRange) {
  return (range.end - range.start) / 60
}
