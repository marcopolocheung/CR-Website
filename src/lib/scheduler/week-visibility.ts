import type { ScheduleAssignment } from './types'
import { shiftWeek } from './week'

export type WeekStatus = 'on' | 'off'

export type WeekStateEntry = {
  status: WeekStatus
  assignments: ScheduleAssignment[]
  generated: ScheduleAssignment[]
}

export type WeekState = Record<string, WeekStateEntry>

export type LegacyWeeks = Record<string, ScheduleAssignment[]>

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

function cloneAssignments(assignments: ScheduleAssignment[]): ScheduleAssignment[] {
  return assignments.map((assignment) => ({ ...assignment }))
}

export function emptyWeekEntry(status: WeekStatus = 'off'): WeekStateEntry {
  return { status, assignments: [], generated: [] }
}

export function ensureWeek(state: WeekState, weekStart: string): WeekState {
  if (!WEEK_RE.test(weekStart)) return state
  if (state[weekStart]) return state
  return { ...state, [weekStart]: emptyWeekEntry() }
}

export function setWeekStatus(state: WeekState, weekStart: string, status: WeekStatus): WeekState {
  const existing = state[weekStart] ?? emptyWeekEntry(status)
  return { ...state, [weekStart]: { ...existing, status } }
}

export function setWeekAssignments(
  state: WeekState,
  weekStart: string,
  assignments: ScheduleAssignment[],
): WeekState {
  const existing = state[weekStart] ?? emptyWeekEntry()
  return { ...state, [weekStart]: { ...existing, assignments: cloneAssignments(assignments) } }
}

export function setWeekGenerated(
  state: WeekState,
  weekStart: string,
  generated: ScheduleAssignment[],
): WeekState {
  const existing = state[weekStart] ?? emptyWeekEntry()
  return { ...state, [weekStart]: { ...existing, generated: cloneAssignments(generated) } }
}

export function visibleWeeks(state: WeekState): string[] {
  return Object.entries(state)
    .filter(([, entry]) => entry.status === 'on')
    .map(([weekStart]) => weekStart)
    .sort()
}

export function copyWeekForward(state: WeekState, fromWeekStart: string, toWeekStart: string): WeekState {
  const source = state[fromWeekStart]
  if (!source) return ensureWeek(state, toWeekStart)
  const target = state[toWeekStart] ?? emptyWeekEntry(source.status)
  return {
    ...state,
    [toWeekStart]: { ...target, assignments: cloneAssignments(source.assignments) },
  }
}

function toUtcMs(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function toIsoDate(utcMs: number) {
  return new Date(utcMs).toISOString().slice(0, 10)
}

const DAY_MS = 24 * 60 * 60 * 1000

export function monthKeyForWeek(weekStart: string): string {
  return weekStart.slice(0, 7)
}

export function currentMonthKey(today = new Date()) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(monthKey: string, months: number): string {
  if (!MONTH_RE.test(monthKey)) return monthKey
  const [year, month] = monthKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + months, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(monthKey: string): string {
  if (!MONTH_RE.test(monthKey)) return monthKey
  const [year, month] = monthKey.split('-').map(Number)
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return name
}

/** Every Sunday-week that touches the month, so the editor and staff see the same strip. */
export function weeksForMonth(monthKey: string): string[] {
  if (!MONTH_RE.test(monthKey)) return []
  const [year, month] = monthKey.split('-').map(Number)
  const firstMs = Date.UTC(year, month - 1, 1)
  const lastMs = Date.UTC(year, month, 0)
  const firstSundayMs = firstMs - new Date(firstMs).getUTCDay() * DAY_MS
  const weeks: string[] = []
  for (let cursor = firstSundayMs; cursor <= lastMs; cursor += 7 * DAY_MS) {
    weeks.push(toIsoDate(cursor))
  }
  return weeks
}

export function monthKeyForDate(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/** v1 stored bare assignment lists; v2 stores status + draft + generated per week. */
export function migrateV1Weeks(
  weeks: LegacyWeeks | undefined,
  generatedWeeks: LegacyWeeks | undefined,
): WeekState {
  const state: WeekState = {}
  for (const [weekStart, assignments] of Object.entries(weeks ?? {})) {
    if (!WEEK_RE.test(weekStart) || !Array.isArray(assignments)) continue
    state[weekStart] = {
      status: assignments.length > 0 ? 'on' : 'off',
      assignments: cloneAssignments(assignments),
      generated: [],
    }
  }
  for (const [weekStart, generated] of Object.entries(generatedWeeks ?? {})) {
    if (!WEEK_RE.test(weekStart) || !Array.isArray(generated)) continue
    const existing = state[weekStart] ?? emptyWeekEntry(generated.length > 0 ? 'on' : 'off')
    state[weekStart] = { ...existing, generated: cloneAssignments(generated) }
  }
  return state
}

export function previousWeekStart(weekStart: string): string {
  return shiftWeek(weekStart, -1)
}
