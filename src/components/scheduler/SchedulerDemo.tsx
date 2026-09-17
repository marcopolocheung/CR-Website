'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  DAYS,
  PERIODS,
  ROLES,
  calculateScheduleStats,
  expandTemplate,
  formatTimeRange,
  generateSchedule,
  isEmployeeAvailableForSlot,
  isEmployeeQualified,
  minutes,
  preflightDiagnostics,
  rangesOverlap,
  schedulerAssumptions,
  seedEmployees,
  currentWeekStart,
  formatDayLabel,
  formatWeekRange,
  monthKeyForWeek,
  monthLabel,
  seedTemplate,
  shiftMonth,
  shiftWeek,
  summarizeSchedule,
  validateSchedule,
  weeksForMonth,
  type DayOfWeek,
  type Diagnostic,
  type Employee,
  type Role,
  type ScheduleAssignment,
  type ScheduleStats,
  type ScheduleStrategy,
  type ShiftPeriod,
  type StaffingSlot,
  type StaffingTemplateSlot,
  type TimeRange,
  type ValidationViolation,
  type WeeklyStaffingTemplate,
  type WeekStatus,
  formatUpdatedAt,
  getEmployeeAvailability,
} from '@/lib/scheduler'
import { fetchRoster, rosterFingerprint } from '@/lib/employee-store'
import { fetchTemplate, templateFingerprint } from '@/lib/template-store'
import { fetchGoldenWeek, type GoldenWeekDoc } from '@/lib/schedule-store'
import { assignmentsFromPublishedWeek, templateHashForSlots } from '@/lib/schedule-share'
import { RESTAURANTS, isRestaurantId } from '@/data/restaurants'
import PublishPanel from './PublishPanel'
import RosterPanel from './RosterPanel'
import TemplatePanel from './TemplatePanel'

type EmployeeDraft = {
  name: string
  roles: Record<Role, boolean>
  recurringAvailability: Employee['recurringAvailability']
  maxDaysPerWeek: number
  allowDoubles: boolean
  newHire: boolean
}

type ShiftKey = `${DayOfWeek}-${ShiftPeriod}`

type DragState = {
  employeeId: string
  fromSlotId: string
}

type DropFeedback = {
  slotId: string
  message: string
} | null

type HistorySnapshot = {
  label: string
  weekStart: string
  employees: Employee[]
  template: WeeklyStaffingTemplate
  weeks: WeekAssignments
  generatedWeeks: WeekAssignments
  weekStatus: Record<string, WeekStatus>
  diagnostics: string[]
}

type WeekAssignments = Record<string, ScheduleAssignment[]>

type GenerationReport = {
  id: number
  at: string
  variant: ScheduleVariant
  weekStart: string
  status: 'success' | 'unchanged' | 'failed'
  filled: number
  detail: string
}

type StaffSnapshot = {
  id: string
  name: string
  savedAt: string
  employees: Employee[]
}

function snapshotStorageKey(restaurantId?: string) {
  return `chinarose.scheduler.staffSnapshots.${restaurantId ?? 'default'}`
}

function readStaffSnapshots(restaurantId?: string): StaffSnapshot[] {
  try {
    const raw = window.localStorage.getItem(snapshotStorageKey(restaurantId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (snapshot): snapshot is StaffSnapshot =>
        !!snapshot &&
        typeof snapshot === 'object' &&
        typeof (snapshot as StaffSnapshot).id === 'string' &&
        typeof (snapshot as StaffSnapshot).name === 'string' &&
        Array.isArray((snapshot as StaffSnapshot).employees),
    )
  } catch {
    return []
  }
}

type ScheduleVariant = ScheduleStrategy

type FixIssue = {
  id: string
  title: string
  detail: string
  slot?: StaffingSlot
  relatedSlot?: StaffingSlot
  employee?: Employee
}

type MovePreview = {
  status: 'valid' | 'invalid'
  message: string
  employeeName: string
  replacedName?: string
  isEmptyTarget: boolean
}

const roleLabels: Record<Role, string> = {
  server: 'Server',
  cashier: 'Cashier',
  lead: 'Shift lead',
  manager: 'Manager',
}

const periodLabels: Record<ShiftPeriod, string> = {
  AM: 'Morning',
  PM: 'Dinner',
}

const roleChipClasses: Record<Role, string> = {
  lead: 'border-red-200 bg-red-50 text-red-900',
  manager: 'border-violet-200 bg-violet-50 text-violet-900',
  server: 'border-sky-200 bg-sky-50 text-sky-900',
  cashier: 'border-emerald-200 bg-emerald-50 text-emerald-900',
}

type SpotStatus = 'good' | 'review' | 'missing' | 'idle'

const statusMeta: Record<SpotStatus, { icon: IconName; chip: string; badge: string; row: string; shiftRow: string; shiftLabel: string }> = {
  good: {
    icon: 'check',
    chip: 'border-green-200 bg-green-50 text-green-950',
    badge: 'border-green-300 bg-green-50 text-green-900',
    row: 'border-green-200 border-l-4 border-l-green-600',
    shiftRow: 'border-l-4 border-l-green-600 bg-green-50',
    shiftLabel: 'Ready',
  },
  review: {
    icon: 'warning',
    chip: 'border-amber-500 bg-amber-50 text-amber-950',
    badge: 'border-amber-300 bg-amber-50 text-amber-950',
    row: 'border-amber-200 border-l-4 border-l-amber-500',
    shiftRow: 'border-l-4 border-l-amber-500 bg-amber-50',
    shiftLabel: 'Needs a look',
  },
  missing: {
    icon: 'warning',
    chip: 'border-dashed border-red-500 bg-red-50 text-red-950',
    badge: 'border-red-300 bg-red-50 text-red-900',
    row: 'border-red-200 border-l-4 border-l-red-600',
    shiftRow: 'border-l-4 border-l-red-600 bg-red-50',
    shiftLabel: 'Nobody assigned',
  },
  idle: {
    icon: 'plus',
    chip: 'border-dashed border-zinc-200 bg-white text-zinc-400',
    badge: 'border-zinc-200 bg-zinc-50 text-zinc-600',
    row: 'border-zinc-200 border-l-4 border-l-zinc-300',
    shiftRow: 'border-l-4 border-l-transparent bg-zinc-50',
    shiftLabel: 'Not made yet',
  },
}

const roleInitials: Record<Role, string> = {
  server: 'S',
  cashier: 'C',
  lead: 'L',
  manager: 'M',
}

/** "Cashier 2" becomes C2, so the position fits in a badge and the name gets the room. */
function slotBadge(slot: StaffingSlot) {
  const position = slot.label.match(/(\d+)$/)?.[1] ?? ''
  return `${roleInitials[slot.role]}${position}`
}

/** Compact shift time for chips: 9:30a-4p, 4-11p. Full range stays in the shift editor. */
function shortHour(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const suffix = hour24 >= 12 ? 'p' : 'a'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return minute === 0 ? `${hour12}${suffix}` : `${hour12}:${String(minute).padStart(2, '0')}${suffix}`
}

function shortTimeRange(slot: StaffingSlot) {
  return `${shortHour(slot.start)}-${shortHour(slot.end)}`
}

function clampMaxDays(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(7, Math.max(1, Math.trunc(value)))
}

function availabilitySummary(employee: Employee) {
  const daysAvailable = DAYS.filter((day) => (employee.recurringAvailability[day]?.length ?? 0) > 0)
  if (daysAvailable.length === 0) return 'No availability set'
  const ranges = daysAvailable.flatMap((day) => employee.recurringAvailability[day] ?? [])
  const morningsOnly = ranges.length > 0 && ranges.every((range) => range.end <= minutes(16))
  const dinnersOnly = ranges.length > 0 && ranges.every((range) => range.start >= minutes(16))
  const timeHint = morningsOnly ? 'mornings' : dinnersOnly ? 'dinners' : 'mixed hours'
  if (daysAvailable.length === 7) return `Any day · ${timeHint}`
  const short = daysAvailable.map((day) => day.slice(0, 3)).join(', ')
  return `${short} · ${timeHint}`
}

function spotStatus({
  hasEmployee,
  hasSchedule,
  violations,
}: {
  hasEmployee: boolean
  hasSchedule: boolean
  violations: ValidationViolation[]
}): SpotStatus {
  if (!hasEmployee) return hasSchedule ? 'missing' : 'idle'
  if (violations.length > 0) return 'review'
  return 'good'
}

function shiftStatus(statuses: SpotStatus[]): SpotStatus {
  if (statuses.includes('missing')) return 'missing'
  if (statuses.includes('review')) return 'review'
  if (statuses.length > 0 && statuses.every((status) => status === 'good')) return 'good'
  return 'idle'
}

const fullDay = { start: minutes(9, 30), end: minutes(23) }
const amShift = { start: minutes(9, 30), end: minutes(16) }
const pmShift = { start: minutes(16), end: minutes(23) }

const scheduleVariants: { id: ScheduleVariant; label: string; description: string; icon: IconName }[] = [
  { id: 'balanced', label: 'Balanced', description: 'Spreads the work across everyone.', icon: 'spark' },
  { id: 'fewestDoubles', label: 'Fewest doubles', description: 'Avoids putting anyone on both shifts in one day.', icon: 'target' },
  { id: 'similarWeek', label: 'Like last week', description: 'Keeps as much of the previous week as the rules allow.', icon: 'lock' },
  { id: 'fairHours', label: 'Similar hours for all', description: 'Evens out how many hours each person gets.', icon: 'undo' },
]

function cloneEmployees() {
  return seedEmployees.map((employee) => ({
    ...employee,
    roles: [...employee.roles],
    recurringAvailability: Object.fromEntries(
      Object.entries(employee.recurringAvailability).map(([day, ranges]) => [
        day,
        ranges?.map((range) => ({ ...range })) ?? [],
      ]),
    ) as Employee['recurringAvailability'],
    incompatibleEmployeeIds: [...(employee.incompatibleEmployeeIds ?? [])],
  }))
}

function cloneTemplate(source: WeeklyStaffingTemplate = seedTemplate): WeeklyStaffingTemplate {
  return Object.fromEntries(DAYS.map((day) => [day, source[day].map((slot) => ({ ...slot }))])) as WeeklyStaffingTemplate
}

function blankDraft(role: Role = 'server', recurringAvailability: Employee['recurringAvailability'] = allDays([fullDay])): EmployeeDraft {
  return {
    name: '',
    roles: Object.fromEntries(ROLES.map((candidate) => [candidate, candidate === role])) as Record<Role, boolean>,
    recurringAvailability,
    maxDaysPerWeek: 5,
    allowDoubles: false,
    newHire: false,
  }
}

function allDays(ranges: TimeRange[]) {
  return Object.fromEntries(DAYS.map((day) => [day, ranges])) as Employee['recurringAvailability']
}

function onlyDays(days: DayOfWeek[], ranges: TimeRange[]) {
  return Object.fromEntries(days.map((day) => [day, ranges])) as Employee['recurringAvailability']
}

function gapAvailability(slot: StaffingSlot): Employee['recurringAvailability'] {
  return onlyDays([slot.day], [{ start: slot.start, end: slot.end }])
}

// The per-day AM/PM grid works in canonical shift halves, not arbitrary ranges:
// toggling a checkbox rewrites that day to [amShift]/[pmShift]/[fullDay]/[], and
// reading a day's checkbox state back is "does it overlap that half" so a slot-specific
// gap range (e.g. a 5pm start) still shows as PM-checked before it's ever touched.
function dayAvailabilityFromRanges(ranges: TimeRange[] | undefined) {
  const list = ranges ?? []
  return {
    am: list.some((range) => rangesOverlap(range, amShift)),
    pm: list.some((range) => rangesOverlap(range, pmShift)),
  }
}

function rangesForDayToggle(am: boolean, pm: boolean): TimeRange[] {
  if (am && pm) return [fullDay]
  if (am) return [amShift]
  if (pm) return [pmShift]
  return []
}

const availabilityPresets: { label: string; build: () => Employee['recurringAvailability'] }[] = [
  { label: 'Any day, any shift', build: () => allDays([fullDay]) },
  { label: 'Morning shifts', build: () => allDays([amShift]) },
  { label: 'Dinner shifts', build: () => allDays([pmShift]) },
  { label: 'Weekday dinner shifts', build: () => onlyDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], [pmShift]) },
  { label: 'Saturday and Sunday', build: () => onlyDays(['Saturday', 'Sunday'], [fullDay]) },
]

function createEmployeeId(name: string, employees: Employee[]) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'new-employee'
  const existingIds = new Set(employees.map((employee) => employee.id))
  let id = base
  let suffix = 2

  while (existingIds.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }

  return id
}

function cloneEmployeeList(employees: Employee[]) {
  return employees.map((employee) => ({
    ...employee,
    roles: [...employee.roles],
    recurringAvailability: Object.fromEntries(
      Object.entries(employee.recurringAvailability).map(([day, ranges]) => [
        day,
        ranges?.map((range) => ({ ...range })) ?? [],
      ]),
    ) as Employee['recurringAvailability'],
    incompatibleEmployeeIds: [...(employee.incompatibleEmployeeIds ?? [])],
  }))
}

const emptyAssignments: ScheduleAssignment[] = []

const onboardingStorageKey = 'chinarose.scheduler.onboardingDismissed'

function readOnboardingDismissed() {
  try {
    return window.localStorage.getItem(onboardingStorageKey) === '1'
  } catch {
    return false
  }
}

function statusForWeek(
  weekStatus: Record<string, WeekStatus>,
  weekStart: string,
  assignments: ScheduleAssignment[],
): WeekStatus {
  const explicit = weekStatus[weekStart]
  if (explicit) return explicit
  return assignments.length > 0 ? 'on' : 'off'
}

function cloneWeeks(weeks: WeekAssignments): WeekAssignments {
  return Object.fromEntries(Object.entries(weeks).map(([week, assignments]) => [week, cloneAssignmentList(assignments)]))
}

function cloneAssignmentList(assignments: ScheduleAssignment[]) {
  return assignments.map((assignment) => ({ ...assignment }))
}

function uniqueMessages(messages: string[]) {
  return Array.from(new Set(messages))
}

function assignmentFingerprint(list: ScheduleAssignment[]) {
  return list
    .map((assignment) => `${assignment.slotId}:${assignment.employeeId}`)
    .sort()
    .join('|')
}

function formatReportTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function overlapMinutes(a: StaffingSlot, b: StaffingSlot) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
}

function formatOverlapDuration(totalMinutes: number) {
  if (totalMinutes <= 0) return 'moments'
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours === 0) return `${mins} minute${mins === 1 ? '' : 's'}`
  if (mins === 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${hours} hour${hours === 1 ? '' : 's'} ${mins} minutes`
}

function availabilityText(employee: Employee, day: DayOfWeek) {
  const ranges = getEmployeeAvailability(employee, day)
  if (ranges.length === 0) return `has no ${day} availability at all`
  return `${day} availability is ${ranges.map((range) => formatTimeRange(range)).join(', ')}`
}

function trainedRolesText(employee: Employee) {
  if (employee.roles.length === 0) return 'nothing yet'
  return employee.roles.map((role) => roleLabels[role]).join(', ')
}

function diagnosticLabel(diagnostic: Diagnostic, weekStart: string) {
  const day = diagnostic.day && weekStart ? formatDayLabel(weekStart, diagnostic.day) : diagnostic.day
  const where = day && diagnostic.period ? `${day} ${periodLabels[diagnostic.period]}` : null
  const role = diagnostic.role ? roleLabels[diagnostic.role] : null

  if (diagnostic.code === 'search_exhausted') {
    return 'There is no way to fill every spot with the people and rules you have now. Add availability, add staff, or loosen a limit, then make the schedule again.'
  }
  if (diagnostic.code === 'invalid_locked_assignment') {
    return where ? `The person you kept on ${where} no longer fits the rules — availability, role, or limits changed.` : 'A spot you marked Keep no longer fits the rules.'
  }
  if (where && role && diagnostic.code.startsWith('no_')) {
    return `${where} has nobody who can work as ${role}. Add someone with that role who is free then, or adjust the spot.`
  }
  if (where && role && diagnostic.code.startsWith('insufficient_')) {
    return `${where} needs more ${role} cover than the staff list can give. Add staff or trim a spot.`
  }
  if (where && diagnostic.code === 'insufficient_shift_capacity') {
    return `${where} does not have enough people free. Add availability or staff, or remove a spot from the rules.`
  }
  if (where && role) {
    return `${where} needs ${role} cover.`
  }

  return diagnostic.message
}

function dragErrorMessage(employee: Employee, slot: StaffingSlot, violations: ValidationViolation[], weekStart: string, slots: StaffingSlot[]) {
  const day = weekStart ? formatDayLabel(weekStart, slot.day) : slot.day
  const first = violations[0]
  if (!first) return `${employee.name} cannot work ${day} ${periodLabels[slot.period]}.`

  if (first.code === 'unqualified_employee') return `${employee.name} is not trained for ${slot.label} — trained for ${trainedRolesText(employee)}.`
  if (first.code === 'unavailable_employee') return `${employee.name} is not free ${day} ${periodLabels[slot.period]} (${formatTimeRange(slot)}). ${employee.name} ${availabilityText(employee, slot.day)}.`
  if (first.code === 'inactive_employee') return `${employee.name} is off the list (inactive).`
  if (first.code === 'overlapping_assignment') {
    const conflict = slots.find((candidate) => candidate.id === first.relatedSlotId)
    if (!conflict) return `${employee.name} is already working at that time.`
    return `${employee.name} cannot take ${slot.label} (${formatTimeRange(slot)}) — it overlaps ${conflict.label} (${formatTimeRange(conflict)}) by ${formatOverlapDuration(overlapMinutes(slot, conflict))}. One person cannot be in two places at once, even with doubles allowed.`
  }
  if (first.code === 'max_days_exceeded') return `${employee.name} is limited to ${employee.maxDaysPerWeek ?? 'a set number of'} days a week.`
  if (first.code === 'max_shifts_exceeded') return `${employee.name} is limited to ${employee.maxShiftsPerWeek ?? 'a set number of'} shifts a week.`
  if (first.code === 'prohibited_double') return `${employee.name} does not allow doubles — both shifts that day is not an option.`
  if (first.code === 'incompatible_pair') return first.message

  return first.message
}

function proposeMovedAssignments(
  dragState: DragState,
  assignments: ScheduleAssignment[],
  targetSlotId: string,
) {
  const targetAssignment = assignments.find((assignment) => assignment.slotId === targetSlotId)
  const proposed = assignments
    .map((assignment) => {
      if (assignment.slotId === targetSlotId) {
        return { ...assignment, employeeId: dragState.employeeId, locked: false }
      }
      if (assignment.slotId === dragState.fromSlotId) {
        return targetAssignment?.employeeId
          ? { ...assignment, employeeId: targetAssignment.employeeId, locked: false }
          : { ...assignment, employeeId: '' }
      }
      return assignment
    })
    .filter((assignment) => assignment.employeeId)

  const targetExists = proposed.some((assignment) => assignment.slotId === targetSlotId)
  return targetExists ? proposed : [...proposed, { slotId: targetSlotId, employeeId: dragState.employeeId }]
}

function buildMovePreview({
  move,
  targetSlotId,
  employees,
  slots,
  assignments,
  assignmentMap,
  weekStart,
}: {
  move: DragState
  targetSlotId: string
  employees: Employee[]
  slots: StaffingSlot[]
  assignments: ScheduleAssignment[]
  assignmentMap: Map<string, ScheduleAssignment>
  weekStart: string
}): MovePreview | null {
  if (move.fromSlotId === targetSlotId) return null
  const targetSlot = slots.find((slot) => slot.id === targetSlotId)
  const employee = employees.find((candidate) => candidate.id === move.employeeId)
  if (!targetSlot || !employee) return null

  const targetAssignment = assignmentMap.get(targetSlotId)
  const replacedEmployee = employees.find((candidate) => candidate.id === targetAssignment?.employeeId)
  const isEmptyTarget = !targetAssignment?.employeeId
  const sourceSlot = slots.find((slot) => slot.id === move.fromSlotId)
  const sourceDay = sourceSlot && weekStart ? formatDayLabel(weekStart, sourceSlot.day) : sourceSlot?.day
  const sourceLabel = sourceSlot ? `${sourceDay} ${periodLabels[sourceSlot.period]} ${sourceSlot.label}` : 'the open spot'

  if (assignmentMap.get(move.fromSlotId)?.locked) {
    return { status: 'invalid', employeeName: employee.name, isEmptyTarget, message: `${employee.name} is marked Keep and cannot move yet.` }
  }
  if (targetAssignment?.locked) {
    return { status: 'invalid', employeeName: employee.name, isEmptyTarget, message: `${targetSlot.label} is marked Keep.` }
  }

  const moveViolations = validateSchedule({
    employees,
    slots,
    assignments: proposeMovedAssignments(move, assignments, targetSlotId),
    requireCoverage: false,
  }).filter((violation) => violation.slotId === targetSlotId || violation.employeeId === move.employeeId)

  if (moveViolations.length > 0) {
    return {
      status: 'invalid',
      employeeName: employee.name,
      replacedName: replacedEmployee?.name,
      isEmptyTarget,
      message: dragErrorMessage(employee, targetSlot, moveViolations, weekStart, slots),
    }
  }

  return {
    status: 'valid',
    employeeName: employee.name,
    replacedName: replacedEmployee?.name,
    isEmptyTarget,
    message: replacedEmployee && sourceSlot
      ? `${employee.name} replaces ${replacedEmployee.name} here; ${replacedEmployee.name} goes to ${sourceLabel}.`
      : replacedEmployee
        ? `${employee.name} would replace ${replacedEmployee.name}.`
        : `${employee.name} moves here from ${sourceLabel}.`,
  }
}

function reviewLabel(
  violation: ValidationViolation,
  slot: StaffingSlot | undefined,
  employee: Employee | undefined,
  weekStart: string,
  slots: StaffingSlot[],
  stats?: ScheduleStats,
) {
  const day = slot && weekStart ? formatDayLabel(weekStart, slot.day) : slot?.day
  const shift = slot ? `${day} ${periodLabels[slot.period]}` : 'This schedule'
  const position = slot?.label ?? 'this spot'
  const name = employee?.name ?? 'Someone'

  if (violation.code === 'missing_assignment') return `${shift} needs ${position}${slot ? ` (${formatTimeRange(slot)})` : ''}.`
  if (violation.code === 'unqualified_employee') return `${name} is not trained for ${position} — trained for ${employee ? trainedRolesText(employee) : 'nothing listed'}.`
  if (violation.code === 'unavailable_employee') {
    if (!slot || !employee) return `${name} cannot work ${shift}.`
    return `${name} is not free ${shift} (${formatTimeRange(slot)}). ${name} ${availabilityText(employee, slot.day)}.`
  }
  if (violation.code === 'inactive_employee') return `${name} is off the list (inactive).`
  if (violation.code === 'overlapping_assignment') {
    const conflict = slots.find((candidate) => candidate.id === violation.relatedSlotId)
    if (!conflict || !slot) return `${name} is already working at that time.`
    return `${name} cannot cover ${day} ${periodLabels[slot.period]} ${slot.label} (${formatTimeRange(slot)}) — it overlaps ${conflict.label} (${formatTimeRange(conflict)}) by ${formatOverlapDuration(overlapMinutes(slot, conflict))}. One person cannot be in two places at once, even with doubles allowed.`
  }
  if (violation.code === 'max_days_exceeded') {
    if (stats && employee?.maxDaysPerWeek !== undefined) return `${name} would work ${stats.days} days — the limit is ${employee.maxDaysPerWeek} a week.`
    return `${name} has too many work days.`
  }
  if (violation.code === 'max_shifts_exceeded') {
    if (stats && employee?.maxShiftsPerWeek !== undefined) return `${name} would work ${stats.shifts} shifts — the limit is ${employee.maxShiftsPerWeek} a week.`
    return `${name} has too many shifts.`
  }
  if (violation.code === 'prohibited_double') return `${name} does not allow doubles, but this covers ${day} ${periodLabels.AM} and ${periodLabels.PM}.`
  if (violation.code === 'incompatible_pair') return violation.message
  if (violation.code === 'locked_assignment_changed') return `A kept spot changed and needs review.`

  return violation.message
}

type ScheduleChange = {
  slotId: string
  shiftKey: ShiftKey
  text: string
}

function changesSince(
  generated: ScheduleAssignment[],
  current: ScheduleAssignment[],
  slots: StaffingSlot[],
  employees: Employee[],
  weekStart: string,
): ScheduleChange[] {
  if (generated.length === 0) return []
  const generatedBySlot = new Map(generated.map((assignment) => [assignment.slotId, assignment.employeeId]))
  const currentBySlot = new Map(current.map((assignment) => [assignment.slotId, assignment.employeeId]))
  const nameFor = (employeeId?: string) => employees.find((employee) => employee.id === employeeId)?.name

  return slots.flatMap((slot) => {
    const before = nameFor(generatedBySlot.get(slot.id))
    const after = nameFor(currentBySlot.get(slot.id))
    if (before === after) return []
    const day = weekStart ? formatDayLabel(weekStart, slot.day) : slot.day
    const where = `${day} ${periodLabels[slot.period]} ${slot.label}`
    const text = before && after ? `${where}: ${before} to ${after}` : after ? `${where}: ${after} added` : `${where}: ${before} removed`

    return [{ slotId: slot.id, shiftKey: `${slot.day}-${slot.period}` as ShiftKey, text }]
  })
}

function fixAdvice(code: string) {
  if (code === 'missing_assignment') return 'Pick someone for this spot, or add a new employee with the right role and availability.'
  if (code === 'unavailable_employee') return 'Pick someone free then — check availability in the staff list.'
  if (code === 'unqualified_employee') return 'Pick someone trained for this position, or add the role to them in the staff list.'
  if (code === 'inactive_employee') return 'Turn them back on in the staff list, or pick someone else.'
  if (code === 'overlapping_assignment') return 'Move one of the two shifts to someone else. If the overlap comes from shift times (like the Friday manager starting at 3pm while mornings end at 4pm), adjusting the times in the rules fixes it for everyone.'
  if (code === 'max_days_exceeded') return 'Move a shift to someone else, or raise the weekly day limit in the staff list.'
  if (code === 'max_shifts_exceeded') return 'Move a shift to someone else, or raise the weekly shift limit in the staff list.'
  if (code === 'prohibited_double') return 'Give one of the two shifts to someone else, or allow doubles for them in the staff list.'
  if (code === 'incompatible_pair') return 'These two should not work the same shift. Move one of them.'
  if (code === 'locked_assignment_changed') return 'A spot you marked Keep changed. Confirm it still works.'
  if (code === 'search_exhausted') return 'Add availability, add staff, or loosen a limit — then make the schedule again.'
  if (code === 'invalid_locked_assignment') return 'Release the Keep mark, or fix that person’s availability, role, or limits.'
  if (code.startsWith('no_')) return 'Add someone with that role and availability, or turn an inactive person back on.'
  if (code.startsWith('insufficient_')) return 'Add staff or availability for that shift, or remove a spot from the rules.'
  return 'Nobody on the list can cover this. Add someone, or turn an inactive person back on.'
}

function candidatesForSlot({
  slot,
  employees,
  slots,
  assignments,
}: {
  slot: StaffingSlot
  employees: Employee[]
  slots: StaffingSlot[]
  assignments: ScheduleAssignment[]
}) {
  const others = assignments.filter((assignment) => assignment.slotId !== slot.id)

  return employees.filter((employee) => {
    if (!employee.active || !isEmployeeQualified(employee, slot) || !isEmployeeAvailableForSlot(employee, slot)) return false
    const proposed = [...others, { slotId: slot.id, employeeId: employee.id }]
    return (
      validateSchedule({ employees, slots, assignments: proposed, requireCoverage: false }).filter(
        (violation) => violation.slotId === slot.id || violation.employeeId === employee.id,
      ).length === 0
    )
  })
}

/** Short reason an employee cannot take a slot, for disabled dropdown options. Null means they fit. */
function unassignableReason({
  slot,
  employee,
  employees,
  slots,
  assignments,
}: {
  slot: StaffingSlot
  employee: Employee
  employees: Employee[]
  slots: StaffingSlot[]
  assignments: ScheduleAssignment[]
}): string | null {
  if (!employee.active) return 'off the list'
  if (!isEmployeeQualified(employee, slot)) return 'not trained'
  if (!isEmployeeAvailableForSlot(employee, slot)) return 'not free'
  const others = assignments.filter((assignment) => assignment.slotId !== slot.id)
  const proposed = [...others, { slotId: slot.id, employeeId: employee.id }]
  const problems = validateSchedule({ employees, slots, assignments: proposed, requireCoverage: false }).filter(
    (violation) => violation.slotId === slot.id || violation.employeeId === employee.id,
  )
  if (problems.length === 0) return null
  const code = problems[0].code
  if (code === 'max_days_exceeded' || code === 'max_shifts_exceeded') return 'over limit'
  if (code === 'prohibited_double') return 'double that day'
  if (code === 'overlapping_assignment') {
    const conflict = slots.find((candidate) => candidate.id === problems[0].relatedSlotId)
    return conflict ? `busy then (${conflict.label} ${shortTimeRange(conflict)})` : 'already working then'
  }
  if (code === 'incompatible_pair') return 'not with teammate'
  return 'breaks a rule'
}

function buildFixIssues(
  readinessProblems: Diagnostic[],
  violations: ValidationViolation[],
  slots: StaffingSlot[],
  employees: Employee[],
  weekStart: string,
  assignments: ScheduleAssignment[] = [],
) {
  const issues: FixIssue[] = []

  for (const problem of readinessProblems) {
    const slot = problem.slotId
      ? slots.find((candidate) => candidate.id === problem.slotId)
      : slots.find((candidate) => candidate.day === problem.day && candidate.period === problem.period && candidate.role === problem.role)
    issues.push({
      id: `ready:${problem.code}:${problem.slotId ?? problem.day ?? ''}:${problem.period ?? ''}:${problem.role ?? ''}`,
      title: diagnosticLabel(problem, weekStart),
      detail: fixAdvice(problem.code),
      slot,
    })
  }

  const statsById = new Map(calculateScheduleStats(employees, slots, assignments).map((stat) => [stat.employeeId, stat]))

  for (const violation of violations) {
    const slot = slots.find((candidate) => candidate.id === violation.slotId)
    const relatedSlot = slots.find((candidate) => candidate.id === violation.relatedSlotId)
    const employee = employees.find((candidate) => candidate.id === violation.employeeId)
    issues.push({
      id: `review:${violation.code}:${violation.slotId ?? ''}:${violation.employeeId ?? ''}:${violation.message}`,
      title: reviewLabel(violation, slot, employee, weekStart, slots, statsById.get(violation.employeeId ?? '')),
      detail: fixAdvice(violation.code),
      slot,
      relatedSlot,
      employee,
    })
  }

  return issues
}

export default function SchedulerDemo({ restaurantId }: { restaurantId?: string } = {}) {
  const restaurantName = restaurantId && isRestaurantId(restaurantId) ? RESTAURANTS[restaurantId].name : null
  const [weekStart, setWeekStart] = useState('')
  const [weeks, setWeeks] = useState<WeekAssignments>({})
  const [generatedWeeks, setGeneratedWeeks] = useState<WeekAssignments>({})
  const [weekStatus, setWeekStatus] = useState<Record<string, WeekStatus>>({})
  // Staff lists and shift rules are per-week. Each weekStart gets its own roster
  // and template so edits to week 1 never bleed into week 2. The global docs on
  // the server act as the seed for weeks that have never been customized.
  const [rosters, setRosters] = useState<Record<string, Employee[]>>({})
  const [rosterRevs, setRosterRevs] = useState<Record<string, number>>({})
  const [rosterSnapshots, setRosterSnapshots] = useState<Record<string, string | null>>({})
  const [rosterUpdatedAts, setRosterUpdatedAts] = useState<Record<string, string | null>>({})
  const [rosterLoadedWeeks, setRosterLoadedWeeks] = useState<Record<string, boolean>>({})
  const [defaultRoster, setDefaultRoster] = useState<Employee[]>(cloneEmployees)
  const [defaultRosterLoaded, setDefaultRosterLoaded] = useState(false)
  const [defaultRosterRev, setDefaultRosterRev] = useState(0)
  const [templates, setTemplates] = useState<Record<string, WeeklyStaffingTemplate>>({})
  const [templateRevs, setTemplateRevs] = useState<Record<string, number>>({})
  const [templateSnapshots, setTemplateSnapshots] = useState<Record<string, string | null>>({})
  const [templateUpdatedAts, setTemplateUpdatedAts] = useState<Record<string, string | null>>({})
  const [templateLoadedWeeks, setTemplateLoadedWeeks] = useState<Record<string, boolean>>({})
  const [defaultTemplate, setDefaultTemplate] = useState<WeeklyStaffingTemplate>(() => cloneTemplate())
  const [defaultTemplateLoaded, setDefaultTemplateLoaded] = useState(false)
  const [defaultTemplateRev, setDefaultTemplateRev] = useState(0)
  const employees = weekStart ? (rosters[weekStart] ?? defaultRoster) : defaultRoster
  const template = weekStart ? (templates[weekStart] ?? defaultTemplate) : defaultTemplate
  const rosterRev = weekStart ? (rosterRevs[weekStart] ?? 0) : 0
  const rosterServerSnapshot = weekStart ? (rosterSnapshots[weekStart] ?? null) : null
  const rosterUpdatedAt = weekStart ? (rosterUpdatedAts[weekStart] ?? null) : null
  const templateRev = weekStart ? (templateRevs[weekStart] ?? 0) : 0
  const templateServerSnapshot = weekStart ? (templateSnapshots[weekStart] ?? null) : null
  const templateUpdatedAt = weekStart ? (templateUpdatedAts[weekStart] ?? null) : null
  const rosterLoaded = Boolean(weekStart && defaultRosterLoaded && rosterLoadedWeeks[weekStart])
  const templateLoaded = Boolean(weekStart && defaultTemplateLoaded && templateLoadedWeeks[weekStart])

  function setEmployees(next: Employee[] | ((current: Employee[]) => Employee[])) {
    const target = weekStart
    if (!target) return
    setRosters((current) => {
      const existing = current[target] ?? defaultRoster
      const value = typeof next === 'function' ? (next as (c: Employee[]) => Employee[])(existing) : next
      return { ...current, [target]: value }
    })
  }

  function setTemplate(next: WeeklyStaffingTemplate | ((current: WeeklyStaffingTemplate) => WeeklyStaffingTemplate)) {
    const target = weekStart
    if (!target) return
    setTemplates((current) => {
      const existing = current[target] ?? defaultTemplate
      const value = typeof next === 'function' ? (next as (c: WeeklyStaffingTemplate) => WeeklyStaffingTemplate)(existing) : next
      return { ...current, [target]: value }
    })
  }

  function setRosterSaved(target: string, rev: number, updatedAt: string | null, snapshot: string) {
    setRosterRevs((current) => ({ ...current, [target]: rev }))
    setRosterSnapshots((current) => ({ ...current, [target]: snapshot }))
    setRosterUpdatedAts((current) => ({ ...current, [target]: updatedAt }))
  }

  function setTemplateSaved(target: string, rev: number, updatedAt: string | null, snapshot: string) {
    setTemplateRevs((current) => ({ ...current, [target]: rev }))
    setTemplateSnapshots((current) => ({ ...current, [target]: snapshot }))
    setTemplateUpdatedAts((current) => ({ ...current, [target]: updatedAt }))
  }
  const [monthKey, setMonthKey] = useState('')
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  const [draft, setDraft] = useState<EmployeeDraft>(() => blankDraft())
  const [employeePanelOpen, setEmployeePanelOpen] = useState(false)
  const [openShiftKey, setOpenShiftKey] = useState<ShiftKey | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [moveSource, setMoveSource] = useState<DragState | null>(null)
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null)
  const [dropFeedback, setDropFeedback] = useState<DropFeedback>(null)
  const [history, setHistory] = useState<HistorySnapshot[]>([])
  const [ignoredIssueIds, setIgnoredIssueIds] = useState<string[]>([])
  const [guidedChoosing, setGuidedChoosing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [staffQuery, setStaffQuery] = useState('')
  const [selectedVariant, setSelectedVariant] = useState<ScheduleVariant>('balanced')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingVariant, setGeneratingVariant] = useState<ScheduleVariant | null>(null)
  const [lastReport, setLastReport] = useState<GenerationReport | null>(null)
  const reportId = useRef(0)
  const [onboardingDismissed, setOnboardingDismissed] = useState(true)
  const [rosterLoadError, setRosterLoadError] = useState('')
  const [confirmingClearStaff, setConfirmingClearStaff] = useState(false)
  const [staffSnapshots, setStaffSnapshots] = useState<StaffSnapshot[]>([])
  const [snapshotName, setSnapshotName] = useState('')
  const [rosterPanelOpen, setRosterPanelOpen] = useState(false)
  // Before the first server response arrives the editor only holds the built-in
  // seeds. Treat dirty as false until loaded so Publish never tries to save
  // seeds over live data with a stale rev.
  const rosterDirty = !rosterLoaded
    ? false
    : rosterServerSnapshot === null
      ? employees.length > 0
      : rosterFingerprint(employees) !== rosterServerSnapshot
  const [templateLoadError, setTemplateLoadError] = useState('')
  const [confirmingClearWeek, setConfirmingClearWeek] = useState(false)
  const [publishedWeeks, setPublishedWeeks] = useState<Record<string, GoldenWeekDoc | null>>({})
  const [hydratedWeeks, setHydratedWeeks] = useState<Record<string, boolean>>({})
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false)
  const templateDirty = !templateLoaded
    ? false
    : templateServerSnapshot === null
      ? templateFingerprint(template) !== templateFingerprint(seedTemplate)
      : templateFingerprint(template) !== templateServerSnapshot
  const isDefaultRoster = useMemo(() => rosterFingerprint(employees) === rosterFingerprint(seedEmployees), [employees])
  const isDefaultTemplate = useMemo(() => templateFingerprint(template) === templateFingerprint(seedTemplate), [template])
  const assignments = weeks[weekStart] ?? emptyAssignments
  const generatedAssignments = generatedWeeks[weekStart] ?? emptyAssignments
  const weekVisibility = weekStart ? statusForWeek(weekStatus, weekStart, assignments) : 'off'
  const monthWeeks = monthKey ? weeksForMonth(monthKey) : []
  const onWeeksCount = useMemo(
    () => Object.keys(weeks).filter((key) => statusForWeek(weekStatus, key, weeks[key] ?? []) === 'on').length,
    [weeks, weekStatus],
  )

  function setAssignments(next: ScheduleAssignment[] | ((current: ScheduleAssignment[]) => ScheduleAssignment[])) {
    setWeeks((current) => {
      const existing = current[weekStart] ?? emptyAssignments
      return { ...current, [weekStart]: typeof next === 'function' ? next(existing) : next }
    })
  }

  function setGeneratedAssignments(next: ScheduleAssignment[]) {
    setGeneratedWeeks((current) => ({ ...current, [weekStart]: next }))
  }

  const slots = useMemo(() => expandTemplate(template), [template])
  const readinessProblems = useMemo(() => preflightDiagnostics(employees, slots), [employees, slots])
  const firstGap = readinessProblems.find((problem) => problem.day && problem.period && problem.role)
  const gapSlot = useMemo(
    () =>
      firstGap
        ? slots.find((slot) => slot.day === firstGap.day && slot.period === firstGap.period && slot.role === firstGap.role)
        : undefined,
    [firstGap, slots],
  )
  const violations = useMemo(
    () =>
      validateSchedule({
        employees,
        slots,
        assignments: assignments.filter((assignment) => assignment.employeeId),
        requireCoverage: assignments.length > 0,
      }),
    [assignments, employees, slots],
  )
  const stats = useMemo(() => calculateScheduleStats(employees, slots, assignments), [assignments, employees, slots])
  const assignmentMap = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.slotId, assignment])),
    [assignments],
  )
  const activeMove = dragState ?? moveSource
  const movePreviews = useMemo(() => {
    const previews = new Map<string, MovePreview>()
    if (!activeMove) return previews
    for (const slot of slots) {
      const preview = buildMovePreview({ move: activeMove, targetSlotId: slot.id, employees, slots, assignments, assignmentMap, weekStart })
      if (preview) previews.set(slot.id, preview)
    }
    return previews
  }, [activeMove, assignmentMap, assignments, employees, slots, weekStart])
  const movingEmployee = employees.find((employee) => employee.id === moveSource?.employeeId)

  const fixIssues = useMemo(
    () => buildFixIssues(readinessProblems, violations, slots, employees, weekStart, assignments),
    [assignments, employees, readinessProblems, slots, violations, weekStart],
  )
  const visibleFixIssues = fixIssues.filter((issue) => !ignoredIssueIds.includes(issue.id))
  const nextIssue = visibleFixIssues[0]
  const highlightedSlotIds = useMemo(() => {
    const ids = new Set<string>()
    if (nextIssue?.slot) ids.add(nextIssue.slot.id)
    if (nextIssue?.relatedSlot) ids.add(nextIssue.relatedSlot.id)
    return ids
  }, [nextIssue])
  const changes = useMemo(
    () => changesSince(generatedAssignments, assignments, slots, employees, weekStart),
    [assignments, employees, generatedAssignments, slots, weekStart],
  )
  const changedSlotIds = useMemo(() => new Set(changes.map((change) => change.slotId)), [changes])
  const fixCandidates = useMemo(
    () =>
      nextIssue?.slot
        ? candidatesForSlot({ slot: nextIssue.slot, employees, slots, assignments })
        : [],
    [assignments, employees, nextIssue, slots],
  )
  const fixExcluded = useMemo(() => {
    if (!nextIssue?.slot) return [] as { employee: Employee; reason: string }[]
    const candidateIds = new Set(fixCandidates.map((candidate) => candidate.id))
    return employees
      .filter((employee) => !candidateIds.has(employee.id))
      .map((employee) => ({
        employee,
        reason:
          unassignableReason({ slot: nextIssue.slot as StaffingSlot, employee, employees, slots, assignments }) ??
          'not available',
      }))
  }, [assignments, employees, fixCandidates, nextIssue, slots])
  const ignoredCount = fixIssues.filter((issue) => ignoredIssueIds.includes(issue.id)).length
  const activeEmployeeCount = employees.filter((employee) => employee.active).length
  const keptCount = assignments.filter((assignment) => assignment.locked && assignment.employeeId).length
  const schedulePassing = assignments.length > 0 && violations.length === 0
  const blockers = [
    activeEmployeeCount === 0 ? 'Nobody is marked as working.' : null,
    readinessProblems.length > 0
      ? `${readinessProblems.length} shift${readinessProblems.length === 1 ? '' : 's'} nobody on the list can cover.`
      : null,
    assignments.length === 0 ? 'No schedule has been made yet.' : null,
    assignments.length > 0 && !schedulePassing ? 'Some spots still need fixing.' : null,
  ].filter((blocker): blocker is string => Boolean(blocker))
  const selectedRoles = ROLES.filter((role) => draft.roles[role])
  const canAddEmployee = draft.name.trim().length > 0 && (selectedRoles.length > 0 || draft.newHire)

  useEffect(() => {
    // The date has to wait for the browser: this page is prerendered,
    // so reading it during render would not match the HTML that shipped.
    // Drafts live only in memory now; the Worker store is the source of truth.
    const start = currentWeekStart()
    setWeekStart(start)
    setMonthKey(monthKeyForWeek(start))
    setOnboardingDismissed(readOnboardingDismissed())
  }, [])

  useEffect(() => {
    setRosters({})
    setRosterRevs({})
    setRosterSnapshots({})
    setRosterUpdatedAts({})
    setRosterLoadedWeeks({})
    setDefaultRoster(cloneEmployees())
    setDefaultRosterLoaded(false)
    setDefaultRosterRev(0)
    setTemplates({})
    setTemplateRevs({})
    setTemplateSnapshots({})
    setTemplateUpdatedAts({})
    setTemplateLoadedWeeks({})
    setDefaultTemplate(cloneTemplate())
    setDefaultTemplateLoaded(false)
    setDefaultTemplateRev(0)
    setWeeks({})
    setGeneratedWeeks({})
    setWeekStatus({})
    setDiagnostics([])
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setSharing(false)
    setPublishedWeeks({})
    setHydratedWeeks({})
    setConfirmingClearStaff(false)
    setConfirmingClearWeek(false)
    setSnapshotName('')
    setStaffSnapshots(readStaffSnapshots(restaurantId))
  }, [restaurantId])

  useEffect(() => {
    let cancelled = false
    setRosterLoadError('')
    setDefaultRosterLoaded(false)
    fetchRoster(restaurantId)
      .then((doc) => {
        if (cancelled) return
        if (doc.rev > 0 && doc.employees.length > 0) {
          setDefaultRoster(doc.employees as Employee[])
        }
        setDefaultRosterRev(doc.rev)
        setDefaultRosterLoaded(true)
      })
      .catch(() => {
        if (!cancelled) {
          setRosterLoadError('Could not reach the staff list store. Showing the built-in demo list — save once the connection works to keep changes.')
          setDefaultRosterLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  useEffect(() => {
    let cancelled = false
    setTemplateLoadError('')
    setDefaultTemplateLoaded(false)
    fetchTemplate(restaurantId)
      .then((doc) => {
        if (cancelled) return
        if (doc.rev > 0 && doc.template) {
          setDefaultTemplate(doc.template)
        }
        setDefaultTemplateRev(doc.rev)
        setDefaultTemplateLoaded(true)
      })
      .catch(() => {
        if (!cancelled) {
          setTemplateLoadError('Could not reach the schedule-rules store. Showing the built-in default rules — save once the connection works to keep changes.')
          setDefaultTemplateLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  useEffect(() => {
    if (!weekStart || !defaultRosterLoaded || rosterLoadedWeeks[weekStart]) return
    let cancelled = false
    fetchRoster(restaurantId, weekStart)
      .then((doc) => {
        if (cancelled) return
        if (doc.rev > 0) {
          setRosters((current) => ({ ...current, [weekStart]: cloneEmployeeList(doc.employees as Employee[]) }))
          setRosterRevs((current) => ({ ...current, [weekStart]: doc.rev }))
          setRosterSnapshots((current) => ({ ...current, [weekStart]: rosterFingerprint(doc.employees as Employee[]) }))
          setRosterUpdatedAts((current) => ({ ...current, [weekStart]: doc.updatedAt }))
        } else {
          setRosters((current) => {
            if (current[weekStart]) return current
            const seed = (doc.employees.length > 0 ? (doc.employees as Employee[]) : defaultRoster) ?? []
            return { ...current, [weekStart]: cloneEmployeeList(seed) }
          })
          setRosterRevs((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: 0 }))
          setRosterSnapshots((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: null }))
          setRosterUpdatedAts((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: null }))
        }
        setRosterLoadedWeeks((current) => ({ ...current, [weekStart]: true }))
      })
      .catch(() => {
        if (cancelled) return
        setRosters((current) =>
          current[weekStart] ? current : { ...current, [weekStart]: cloneEmployeeList(defaultRoster) },
        )
        setRosterLoadedWeeks((current) => ({ ...current, [weekStart]: true }))
        setRosterLoadError('Could not reach the staff list store. Showing the built-in demo list — save once the connection works to keep changes.')
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, restaurantId, defaultRosterLoaded, defaultRoster, rosterLoadedWeeks])

  useEffect(() => {
    if (!weekStart || !defaultTemplateLoaded || templateLoadedWeeks[weekStart]) return
    let cancelled = false
    fetchTemplate(restaurantId, weekStart)
      .then((doc) => {
        if (cancelled) return
        if (doc.rev > 0 && doc.template) {
          setTemplates((current) => ({ ...current, [weekStart]: cloneTemplate(doc.template as WeeklyStaffingTemplate) }))
          setTemplateRevs((current) => ({ ...current, [weekStart]: doc.rev }))
          setTemplateSnapshots((current) => ({ ...current, [weekStart]: templateFingerprint(doc.template as WeeklyStaffingTemplate) }))
          setTemplateUpdatedAts((current) => ({ ...current, [weekStart]: doc.updatedAt }))
        } else {
          setTemplates((current) => {
            if (current[weekStart]) return current
            const seed = (doc.template as WeeklyStaffingTemplate | null) ?? defaultTemplate
            return { ...current, [weekStart]: cloneTemplate(seed) }
          })
          setTemplateRevs((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: 0 }))
          setTemplateSnapshots((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: null }))
          setTemplateUpdatedAts((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: null }))
        }
        setTemplateLoadedWeeks((current) => ({ ...current, [weekStart]: true }))
      })
      .catch(() => {
        if (cancelled) return
        setTemplates((current) =>
          current[weekStart] ? current : { ...current, [weekStart]: cloneTemplate(defaultTemplate) },
        )
        setTemplateLoadedWeeks((current) => ({ ...current, [weekStart]: true }))
        setTemplateLoadError('Could not reach the schedule-rules store. Showing the built-in default rules — save once the connection works to keep changes.')
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, restaurantId, defaultTemplateLoaded, defaultTemplate, templateLoadedWeeks])

  useEffect(() => {
    if (!weekStart) return
    let cancelled = false
    fetchGoldenWeek(weekStart, restaurantId)
      .then((doc) => {
        if (cancelled) return
        setPublishedWeeks((current) => ({ ...current, [weekStart]: doc }))
        if (doc) {
          setWeekStatus((current) =>
            current[weekStart] ? current : { ...current, [weekStart]: doc.visible ? 'on' : 'off' },
          )
        }
      })
      .catch(() => {
        if (!cancelled) setPublishedWeeks((current) => (current[weekStart] === undefined ? current : current))
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, restaurantId])

  useEffect(() => {
    if (!weekStart || !rosterLoaded || !templateLoaded || hydratedWeeks[weekStart]) return
    const doc = publishedWeeks[weekStart]
    if (doc === undefined || doc === null) return
    if ((weeks[weekStart]?.length ?? 0) > 0) {
      setHydratedWeeks((current) => ({ ...current, [weekStart]: true }))
      return
    }
    if (templateHashForSlots(slots) !== doc.templateHash) {
      setHydratedWeeks((current) => ({ ...current, [weekStart]: true }))
      setDiagnostics((current) =>
        current.length > 0
          ? current
          : ['The published week uses different shift rules, so it was not loaded into the editor. Review the rules before overwriting it.'],
      )
      return
    }
    const hydrated = assignmentsFromPublishedWeek({ slots, employees, published: doc.week })
    setWeeks((current) => (current[weekStart] ? current : { ...current, [weekStart]: hydrated }))
    setGeneratedWeeks((current) =>
      current[weekStart] ? current : { ...current, [weekStart]: hydrated.map((assignment) => ({ ...assignment })) },
    )
    setHydratedWeeks((current) => ({ ...current, [weekStart]: true }))
    if (hydrated.length > 0) {
      setDiagnostics((current) => [...current, 'Loaded the published week from the server.'])
    }
  }, [weekStart, restaurantId, rosterLoaded, templateLoaded, publishedWeeks, hydratedWeeks, slots, employees, weeks])

  function dismissOnboarding() {
    setOnboardingDismissed(true)
    try {
      window.localStorage.setItem(onboardingStorageKey, '1')
    } catch {
      return
    }
  }

  useEffect(() => {
    if (!dragState && !moveSource) return
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDragState(null)
        setMoveSource(null)
        setDragOverSlotId(null)
      }
    }
    window.addEventListener('keydown', cancelOnEscape)
    return () => window.removeEventListener('keydown', cancelOnEscape)
  }, [dragState, moveSource])

  const staffStatsById = useMemo(() => new Map(stats.map((stat) => [stat.employeeId, stat])), [stats])
  const filteredEmployees = useMemo(() => {
    const query = staffQuery.trim().toLowerCase()
    if (!query) return employees
    return employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(query) ||
        employee.roles.some((role) => roleLabels[role].toLowerCase().includes(query)),
    )
  }, [employees, staffQuery])

  // Messages, skipped issues and an open shift all describe the week that was on screen.
  // Staff and rules travel with the week: opening a week with no saved list yet
  // copies the list and rules from the week being left, so week 1 (11 staff) and
  // week 2 (12 staff) stay independent.
  function goToWeek(nextWeekStart: string) {
    if (!nextWeekStart || nextWeekStart === weekStart) return
    const fromWeek = weekStart
    if (fromWeek) {
      setRosters((current) => {
        if (current[nextWeekStart]) return current
        const source = current[fromWeek] ?? defaultRoster
        return { ...current, [nextWeekStart]: cloneEmployeeList(source) }
      })
      setTemplates((current) => {
        if (current[nextWeekStart]) return current
        const source = current[fromWeek] ?? defaultTemplate
        return { ...current, [nextWeekStart]: cloneTemplate(source) }
      })
      setRosterRevs((current) => (current[nextWeekStart] !== undefined ? current : { ...current, [nextWeekStart]: 0 }))
      setTemplateRevs((current) => (current[nextWeekStart] !== undefined ? current : { ...current, [nextWeekStart]: 0 }))
    }
    setWeekStart(nextWeekStart)
    setMonthKey(monthKeyForWeek(nextWeekStart))
    setDiagnostics([])
    setLastReport(null)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setSharing(false)
    setConfirmingReset(false)
    setOpenShiftKey(null)
    setDropFeedback(null)
    setMoveSource(null)
    setDragState(null)
    setDragOverSlotId(null)
    setConfirmingClearWeek(false)
  }

  function goToMonth(nextMonth: string) {
    if (!nextMonth || nextMonth === monthKey) return
    setMonthKey(nextMonth)
    const firstWeek = weeksForMonth(nextMonth)[0]
    if (firstWeek) goToWeek(firstWeek)
  }

  function setWeekVisibility(targetWeek: string, status: WeekStatus) {
    if (!targetWeek) return
    remember(status === 'on' ? 'turned a week on' : 'turned a week off')
    setWeekStatus((current) => ({ ...current, [targetWeek]: status }))
    setDiagnostics([
      status === 'on'
        ? 'That week is now on. Staff see it on /schedule once you save.'
        : 'That week is now off. Staff stop seeing it once you save.',
    ])
  }

  function copyPriorWeek() {
    if (!weekStart) return
    const prior = shiftWeek(weekStart, -1)
    const source = weeks[prior] ?? emptyAssignments
    if (source.length === 0) {
      setDiagnostics(['The prior week has no schedule to copy yet.'])
      return
    }
    remember('copied the prior week')
    setWeeks((current) => ({ ...current, [weekStart]: cloneAssignmentList(source) }))
    setWeekStatus((current) => ({ ...current, [weekStart]: 'on' }))
    const priorRoster = rosters[prior]
    if (priorRoster) {
      setRosters((current) => ({ ...current, [weekStart]: cloneEmployeeList(priorRoster) }))
    }
    const priorTemplate = templates[prior]
    if (priorTemplate) {
      setTemplates((current) => ({ ...current, [weekStart]: cloneTemplate(priorTemplate) }))
    }
    setDiagnostics(['Prior week copied here — schedule, staff list, and rules. Review it, then publish when it looks right.'])
  }

  function remember(label: string) {
    setHistory((current) => [
      {
        label,
        weekStart,
        employees: cloneEmployeeList(employees),
        template: cloneTemplate(template),
        weeks: cloneWeeks(weeks),
        generatedWeeks: cloneWeeks(generatedWeeks),
        weekStatus: { ...weekStatus },
        diagnostics: [...diagnostics],
      },
      ...current.slice(0, 5),
    ])
  }

  function undoLastChange() {
    const [snapshot, ...rest] = history
    if (!snapshot) return
    const target = snapshot.weekStart || weekStart
    if (target) {
      setRosters((current) => ({ ...current, [target]: cloneEmployeeList(snapshot.employees) }))
      setTemplates((current) => ({ ...current, [target]: cloneTemplate(snapshot.template) }))
    }
    setWeeks(cloneWeeks(snapshot.weeks))
    setGeneratedWeeks(cloneWeeks(snapshot.generatedWeeks))
    setWeekStatus({ ...snapshot.weekStatus })
    setDiagnostics([`Undone: ${snapshot.label}.`])
    setHistory(rest)
    setDropFeedback(null)
    setDragState(null)
    setMoveSource(null)
    setDragOverSlotId(null)
    setConfirmingReset(false)
  }

  function restoreEverything() {
    if (generatedAssignments.length === 0) return
    remember('put the schedule back')
    setAssignments(cloneAssignmentList(generatedAssignments))
    setDropFeedback(null)
    setDiagnostics(['The schedule is back the way it was generated.'])
  }

  function restoreShift(shiftKey: ShiftKey) {
    const shiftSlotIds = new Set(
      slots.filter((slot) => `${slot.day}-${slot.period}` === shiftKey).map((slot) => slot.id),
    )
    if (shiftSlotIds.size === 0) return
    remember('put one shift back')
    setAssignments((current) => [
      ...current.filter((assignment) => !shiftSlotIds.has(assignment.slotId)),
      ...generatedAssignments.filter((assignment) => shiftSlotIds.has(assignment.slotId)).map((assignment) => ({ ...assignment })),
    ])
    setDropFeedback(null)
  }

  function openSlot(slotId?: string) {
    if (!slotId) return
    const slot = slots.find((candidate) => candidate.id === slotId)
    if (!slot) return
    setOpenShiftKey(`${slot.day}-${slot.period}`)
  }

  function addEmployeeForSlot(slot?: StaffingSlot) {
    if (slot) {
      setDraft(blankDraft(slot.role, gapAvailability(slot)))
      setOpenShiftKey(`${slot.day}-${slot.period}`)
    } else if (firstGap?.role && gapSlot) {
      setDraft(blankDraft(firstGap.role, gapAvailability(gapSlot)))
    } else {
      setDraft(blankDraft())
    }
    setEmployeePanelOpen(true)
  }

  function fixNextIssue() {
    if (!nextIssue) return
    setGuidedChoosing(true)
    openSlot(nextIssue.slot?.id)
    const shiftKey = nextIssue.slot ? `${nextIssue.slot.day}-${nextIssue.slot.period}` : null
    if (shiftKey) {
      requestAnimationFrame(() => {
        document.getElementById(`${shiftKey}-detail`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }

  // Staying in guided mode after a pick walks the manager straight to the next spot.
  function chooseForIssue(employeeId: string) {
    const slotId = nextIssue?.slot?.id
    if (!slotId) return
    setEmployeeAssignment(slotId, employeeId)
  }

  function ignoreNextIssue() {
    if (!nextIssue) return
    setIgnoredIssueIds((current) => [...current, nextIssue.id])
  }

  function showIgnoredIssues() {
    setIgnoredIssueIds([])
    setGuidedChoosing(true)
  }

  function generationMessage(variant: ScheduleVariant, summary: ReturnType<typeof summarizeSchedule>, kept: number) {
    const hours = `Hours run from ${summary.fewestHours} to ${summary.mostHours}.`

    if (variant === 'fewestDoubles') {
      return summary.doubles === 0
        ? 'Nobody works both shifts in the same day this week.'
        : `${summary.doubles} double shift${summary.doubles === 1 ? '' : 's'} left. That was the fewest possible with these rules.`
    }
    if (variant === 'similarWeek') {
      return `${summary.keptFromReference} of ${kept} spots stayed with the same person.`
    }
    if (variant === 'fairHours') {
      return `Hours evened out as far as the rules allow. ${hours}`
    }

    return `Balanced schedule made. ${hours}`
  }

  async function generate(variant: ScheduleVariant = selectedVariant) {
    if (isGenerating) return
    remember('previous schedule')
    setSelectedVariant(variant)
    setGeneratingVariant(variant)
    setIsGenerating(true)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    // Let the spinner paint before the synchronous solver blocks the main thread.
    await new Promise((resolve) => setTimeout(resolve, 350))
    // similarWeek should anchor to the week before this one, not to whatever is on screen.
    const previousAssignments = variant === 'similarWeek' ? weeks[shiftWeek(weekStart, -1)] ?? assignments : assignments
    try {
      const result = generateSchedule(
        { employees, template },
        {
          strategy: variant,
          referenceAssignments: previousAssignments,
          existingAssignments: assignments.filter((assignment) => assignment.locked),
        },
      )

      if (result.status === 'INFEASIBLE') {
        const messages = uniqueMessages(result.diagnostics.map((diagnostic) => diagnosticLabel(diagnostic, weekStart)))
        setDiagnostics(['The schedule could not be made with these rules.', ...messages])
        reportId.current += 1
        setLastReport({
          id: reportId.current,
          at: formatReportTime(),
          variant,
          weekStart,
          status: 'failed',
          filled: 0,
          detail: messages[0] ?? 'No spots could be filled with these rules.',
        })
        return
      }

      const summary = summarizeSchedule(employees, slots, result.assignments, previousAssignments)
      const message = generationMessage(variant, summary, previousAssignments.length || result.assignments.length)
      setDiagnostics([
        message,
        ...uniqueMessages(result.diagnostics.map((diagnostic) => diagnosticLabel(diagnostic, weekStart))),
      ])
      const unchanged = assignmentFingerprint(result.assignments) === assignmentFingerprint(assignments)
      setAssignments(result.assignments)
      setGeneratedAssignments(cloneAssignmentList(result.assignments))
      setWeekStatus((current) => ({ ...current, [weekStart]: 'on' }))
      reportId.current += 1
      setLastReport({
        id: reportId.current,
        at: formatReportTime(),
        variant,
        weekStart,
        status: unchanged ? 'unchanged' : 'success',
        filled: result.assignments.length,
        detail: unchanged
          ? `Same ${result.assignments.length} spots — nothing new to show.`
          : message,
      })
    } finally {
      setIsGenerating(false)
      setGeneratingVariant(null)
    }
  }

  function reset() {
    // Inline confirm in the header calls this only after an explicit second click.
    // remember() keeps the pre-reset state so Undo can bring it back.
    remember('reset demo')
    setEmployees(cloneEmployees())
    setTemplate(cloneTemplate())
    setWeeks({})
    setGeneratedWeeks({})
    setWeekStatus({})
    setDiagnostics([])
    setLastReport(null)
    setDraft(blankDraft())
    setEmployeePanelOpen(false)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setSelectedVariant('balanced')
    setConfirmingReset(false)
  }

  function restoreDefaultRoster() {
    if (isDefaultRoster) return
    remember('restored default staff list')
    setEmployees(cloneEmployees())
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics(['Staff list for this week restored to the built-in defaults. Save to keep it — Undo brings back your list.'])
  }

  function restoreDefaultTemplate() {
    if (isDefaultTemplate) return
    remember('restored default schedule rules')
    setTemplate(cloneTemplate())
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics(['Schedule rules for this week restored to the built-in defaults. Save to keep them — Undo brings back your rules.'])
  }

  function startBlankStation() {
    remember('started blank station')
    setEmployees([])
    setWeeks({})
    setGeneratedWeeks({})
    setWeekStatus({})
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics(['Blank staff list ready for this week. Add employees below, then save the staff list to keep it.'])
  }

  function clearWeek() {
    if (assignments.length === 0) {
      setConfirmingClearWeek(false)
      return
    }
    remember('cleared week')
    setAssignments([])
    setConfirmingClearWeek(false)
    setDiagnostics(['This week’s assignments are cleared. Undo brings them back — publishing saves the cleared week.'])
  }

  function clearStaff() {
    if (employees.length === 0) {
      setConfirmingClearStaff(false)
      return
    }
    remember('cleared staff list')
    setEmployees([])
    setConfirmingClearStaff(false)
    setEmployeePanelOpen(false)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics(['Staff list for this week cleared. Undo brings everyone back — saving the staff list makes the empty list permanent for this week.'])
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(snapshotStorageKey(restaurantId), JSON.stringify(staffSnapshots))
    } catch {
      return
    }
  }, [staffSnapshots, restaurantId])

  function saveStaffSnapshot() {
    if (employees.length === 0) {
      setDiagnostics(['Add someone to the staff list before saving it as a snapshot.'])
      return
    }
    const name = snapshotName.trim() || `Snapshot ${staffSnapshots.length + 1} — ${employees.length} staff`
    const snapshot: StaffSnapshot = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      savedAt: new Date().toISOString(),
      employees: cloneEmployeeList(employees),
    }
    setStaffSnapshots((current) => [snapshot, ...current].slice(0, 10))
    setSnapshotName('')
    setDiagnostics([`Saved “${name}”. Restore it anytime from Saved staff lists.`])
  }

  function restoreStaffSnapshot(snapshot: StaffSnapshot) {
    remember(`restored snapshot ${snapshot.name}`)
    setEmployees(cloneEmployeeList(snapshot.employees))
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics([`Restored “${snapshot.name}” (${snapshot.employees.length} staff). Save the staff list to keep it — Undo brings back the previous list.`])
  }

  function deleteStaffSnapshot(id: string) {
    setStaffSnapshots((current) => current.filter((snapshot) => snapshot.id !== id))
  }

  // Both revs start at 0, so require the loads to finish before calling a
  // station new — otherwise every deploy/reload flashes the new-station banner
  // with seeds while the fetch is still in flight.
  const storeLoading = !rosterLoaded || !templateLoaded
  const storeOffline = Boolean(rosterLoadError || templateLoadError)
  const isNewStation = !storeLoading && defaultRosterRev === 0 && defaultTemplateRev === 0 && rosterRev === 0 && templateRev === 0

  function setEmployeeAssignment(slotId: string, employeeId: string) {
    remember('changed one assignment')
    setDropFeedback(null)
    setAssignments((current) => {
      const existing = current.find((assignment) => assignment.slotId === slotId)
      if (!employeeId) return current.filter((assignment) => assignment.slotId !== slotId)
      if (existing) {
        return current.map((assignment) =>
          assignment.slotId === slotId ? { ...assignment, employeeId } : assignment,
        )
      }
      return [...current, { slotId, employeeId }]
    })
  }

  function setLocked(slotId: string, locked: boolean) {
    remember(locked ? 'kept one assignment' : 'released one kept assignment')
    setAssignments((current) =>
      current.map((assignment) => (assignment.slotId === slotId ? { ...assignment, locked } : assignment)),
    )
  }

  function moveAssignmentTo(targetSlotId: string) {
    const move = activeMove
    setDragOverSlotId(null)
    setMoveSource(null)
    setDragState(null)
    if (!move || move.fromSlotId === targetSlotId) return
    const targetSlot = slots.find((slot) => slot.id === targetSlotId)
    const employee = employees.find((candidate) => candidate.id === move.employeeId)
    if (!targetSlot || !employee) return

    const preview = movePreviews.get(targetSlotId)
    if (!preview || preview.status === 'invalid') {
      setOpenShiftKey(`${targetSlot.day}-${targetSlot.period}`)
      setDropFeedback({ slotId: targetSlotId, message: preview?.message ?? `${employee.name} cannot move here.` })
      return
    }

    remember(`moved ${employee.name}`)
    setAssignments(proposeMovedAssignments(move, assignments, targetSlotId))
    setDropFeedback(null)
  }
  function activateSlot(slotId: string) {
    const assignment = assignmentMap.get(slotId)
    if (activeMove) {
      if (activeMove.fromSlotId === slotId) {
        cancelMove()
        return
      }
      moveAssignmentTo(slotId)
      return
    }
    if (assignment?.employeeId) {
      toggleMoveSource({ employeeId: assignment.employeeId, fromSlotId: slotId })
      return
    }
    const slot = slots.find((candidate) => candidate.id === slotId)
    if (slot) setOpenShiftKey(`${slot.day}-${slot.period}`)
  }

  function startAssignmentDrag(nextDragState: DragState) {
    setDropFeedback(null)
    setDragOverSlotId(null)
    setMoveSource(null)
    setDragState(nextDragState)
  }

  function toggleMoveSource(nextMoveSource: DragState) {
    setDropFeedback(null)
    setMoveSource((current) => (current?.fromSlotId === nextMoveSource.fromSlotId ? null : nextMoveSource))
  }

  function cancelMove() {
    setMoveSource(null)
    setDragState(null)
    setDragOverSlotId(null)
    setDropFeedback(null)
  }

  function endAssignmentDrag() {
    setDragState(null)
    setDragOverSlotId(null)
  }

  function previewDropSlot(slotId: string) {
    if (!activeMove || activeMove.fromSlotId === slotId) return
    setDragOverSlotId(slotId)
  }

  function clearDropPreview(slotId: string) {
    setDragOverSlotId((current) => (current === slotId ? null : current))
  }

  function updateEmployee(employeeId: string, update: Partial<Employee>) {
    remember('updated staff list')
    setEmployees((current) =>
      current.map((employee) => (employee.id === employeeId ? { ...employee, ...update } : employee)),
    )
  }

  function removeEmployee(employeeId: string) {
    remember('removed employee')
    setEmployees((current) => current.filter((employee) => employee.id !== employeeId))
  }

  function addEmployee() {
    if (!canAddEmployee) return
    remember('added employee')
    const employee: Employee = {
      id: createEmployeeId(draft.name, employees),
      name: draft.name.trim(),
      roles: selectedRoles,
      recurringAvailability: draft.recurringAvailability,
      maxDaysPerWeek: draft.maxDaysPerWeek,
      allowDoubles: draft.allowDoubles,
      newHire: draft.newHire,
      incompatibleEmployeeIds: [],
      active: true,
    }

    setEmployees((current) => [...current, employee])
    setDraft(blankDraft(firstGap?.role ?? selectedRoles[0], firstGap && gapSlot ? gapAvailability(gapSlot) : undefined))
    setEmployeePanelOpen(false)
    setIgnoredIssueIds([])
    setDiagnostics([`${employee.name} was added. Make the schedule again when the staff list looks right.`])
  }

  function makeInfeasible() {
    remember('gap example')
    setEmployees((current) =>
      current.map((employee) =>
        employee.roles.includes('lead') || employee.roles.includes('manager')
          ? { ...employee, active: false }
          : employee,
      ),
    )
    setIgnoredIssueIds([])
    setDiagnostics(['Everyone who can run a shift is now off the list. Press Make schedule to see what a week with missing cover looks like.'])
  }

  return (
    <div className="bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              {restaurantName ? `${restaurantName} · Scheduler` : 'Scheduler demo'}
            </p>
            <h1 className="text-2xl font-bold md:text-3xl">Weekly staff schedule</h1>
            {onWeeksCount > 0 && (
              <p className="mt-1 text-sm text-zinc-600">
                {onWeeksCount} week{onWeeksCount === 1 ? '' : 's'} on · off weeks stay hidden from staff
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              tone="primary"
              onClick={() => void generate()}
              icon="spark"
              loading={isGenerating}
              disabled={activeEmployeeCount === 0 || isGenerating}
              title={activeEmployeeCount === 0 ? 'Add someone to the staff list first.' : 'Build the week from the staff list.'}
            >
              {isGenerating ? 'Making schedule…' : 'Make schedule'}
            </Button>
            <Button onClick={fixNextIssue} icon="target" disabled={!nextIssue} badge={visibleFixIssues.length}>
              Fix next issue
            </Button>
            <Button
              onClick={() => setSharing((open) => !open)}
              icon="share"
              disabled={!weekStart || storeLoading}
              title={
                storeLoading
                  ? 'Waiting for the schedule store — saving is paused until the saved data loads.'
                  : 'Save this week to the /schedule golden schedule.'
              }
            >
              Publish to staff
            </Button>
            {keptCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                <Icon name="lock" />
                Keep: {keptCount}
              </span>
            )}
            <span aria-hidden="true" className="mx-1 hidden h-8 w-px bg-zinc-200 sm:block" />
            <Disclosure summary="More actions" tone="quiet">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={undoLastChange}
                  icon="undo"
                  disabled={history.length === 0}
                  title={history[0] ? `Undo ${history[0].label}` : 'Nothing to undo yet.'}
                >
                  Undo
                </Button>
                <Button
                  onClick={() => window.print()}
                  icon="print"
                  disabled={!schedulePassing}
                  title={!schedulePassing ? 'Fix every spot before printing.' : 'Print the passing schedule.'}
                >
                  Print
                </Button>
                {confirmingReset ? (
                  <span className="inline-flex flex-wrap items-center gap-2 rounded border border-red-300 bg-red-50 px-2 py-1">
                    <span className="text-xs font-semibold text-red-900">Clear everything? You can undo.</span>
                    <button
                      type="button"
                      className="rounded bg-red-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                      onClick={reset}
                    >
                      Yes, start over
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                      onClick={() => setConfirmingReset(false)}
                    >
                      Keep everything
                    </button>
                  </span>
                ) : (
                  <Button onClick={() => setConfirmingReset(true)} icon="reset">
                    Start over
                  </Button>
                )}
              </div>
            </Disclosure>
          </div>
        </div>
        {activeEmployeeCount === 0 && (
          <p className="mx-auto w-full max-w-none px-4 pb-3 text-sm text-zinc-600">
            Add someone to the staff list before making a schedule.
          </p>
        )}
      </header>

      <div className="mx-auto grid w-full max-w-none min-w-0 gap-5 overflow-x-clip px-4 py-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="order-1 min-w-0 space-y-4">
          {storeLoading && (
            <section className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 shadow-sm print:hidden" role="status">
              <h2 className="text-sm font-semibold text-zinc-900">Connecting to the schedule store…</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Showing the built-in defaults until the saved staff list, rules, and published week load. Saving is
                paused so defaults cannot overwrite what is on the server — a deploy never deletes server data, it
                just reloads this page.
              </p>
            </section>
          )}

          {!storeLoading && storeOffline && (
            <section className="rounded-lg border border-amber-500 bg-amber-50 p-4 shadow-sm print:hidden" role="alert">
              <h2 className="text-sm font-semibold text-amber-950">Could not reach the schedule store</h2>
              <p className="mt-1 text-sm text-amber-900">
                What you see below is the built-in demo list, not your saved data — your staff, rules, and published
                weeks are still on the server. Do not save these defaults over them. Check your connection, then
                reload to retry.
              </p>
            </section>
          )}

          {!onboardingDismissed && assignments.length === 0 && (
            <OnboardingBanner activeEmployeeCount={activeEmployeeCount} onDismiss={dismissOnboarding} />
          )}

          {isNewStation && (
            <section className="rounded-lg border border-sky-300 bg-sky-50 p-4 shadow-sm print:hidden">
              <h2 className="text-sm font-semibold text-sky-950">New station — start from the China Rose template or blank</h2>
              <p className="mt-1 text-sm text-sky-900">
                Nothing is saved for{restaurantName ? ` ${restaurantName}` : ' this station'} yet. The list below is the built-in
                template so you have something to work from. Save to keep it, or start blank.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                  onClick={() => setDiagnostics(['Template ready — review the staff list, then save the staff list and rules to keep them.'])}
                >
                  Keep template
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  onClick={startBlankStation}
                >
                  Start blank
                </button>
              </div>
            </section>
          )}

          {sharing && weekStart && (
            <PublishPanel
              weekStart={weekStart}
              weekLabel={formatWeekRange(weekStart)}
              slots={slots}
              employees={employees}
              assignments={assignments}
              visible={weekVisibility === 'on'}
              onVisibilityChange={(status) => setWeekVisibility(weekStart, status)}
              onClose={() => setSharing(false)}
              restaurantId={restaurantId}
              restaurantName={restaurantName ?? undefined}
              template={template}
              rosterRev={rosterRev}
              templateRev={templateRev}
              rosterDirty={rosterDirty}
              templateDirty={templateDirty}
              onRosterSaved={(rev, updatedAt) => {
                setRosterSaved(weekStart, rev, updatedAt, rosterFingerprint(employees))
              }}
              onTemplateSaved={(rev, updatedAt) => {
                setTemplateSaved(weekStart, rev, updatedAt, templateFingerprint(template))
              }}
            />
          )}

          <GuidedFixPanel
            nextIssue={nextIssue}
            weekStart={weekStart}
            issueCount={visibleFixIssues.length}
            totalCount={fixIssues.length}
            ignoredCount={ignoredCount}
            candidates={fixCandidates}
            excluded={fixExcluded}
            choosing={guidedChoosing}
            hasSchedule={assignments.length > 0}
            onChooseEmployee={fixNextIssue}
            onPickEmployee={chooseForIssue}
            onAddEmployee={() => addEmployeeForSlot(nextIssue?.slot)}
            onIgnore={ignoreNextIssue}
            onShowIgnored={showIgnoredIssues}
          />

          <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <MonthStrip
              monthKey={monthKey}
              weekStart={weekStart}
              monthWeeks={monthWeeks}
              weeks={weeks}
              weekStatus={weekStatus}
              onSelectWeek={goToWeek}
              onSelectMonth={goToMonth}
              onToggleWeek={setWeekVisibility}
            />
            <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1">
                <IconButton
                  icon="chevronLeft"
                  label="Previous week"
                  onClick={() => goToWeek(shiftWeek(weekStart, -1))}
                  disabled={!weekStart}
                />
                <h2 className="min-w-0 flex-1 truncate px-2 text-center text-lg font-semibold">
                  {weekStart ? formatWeekRange(weekStart) : '—'}
                </h2>
                <IconButton
                  icon="chevronRight"
                  label="Next week"
                  onClick={() => goToWeek(shiftWeek(weekStart, 1))}
                  disabled={!weekStart}
                />
                {weekStart && weekStart !== currentWeekStart() && (
                  <button
                    type="button"
                    className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    onClick={() => goToWeek(currentWeekStart())}
                  >
                    This week
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <WeekVisibilityToggle weekStart={weekStart} status={weekVisibility} onToggle={setWeekVisibility} />
                <button
                  type="button"
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  onClick={copyPriorWeek}
                  disabled={!weekStart}
                  title="Copy last week's assignments into this week."
                >
                  Copy last week
                </button>
                {confirmingClearWeek ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      className="rounded bg-red-800 px-2 py-1 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                      onClick={clearWeek}
                    >
                      Yes, clear
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                      onClick={() => setConfirmingClearWeek(false)}
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    onClick={() => setConfirmingClearWeek(true)}
                    disabled={!weekStart || assignments.length === 0}
                    title="Remove every assignment from this week. You can undo."
                  >
                    Clear week
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm text-zinc-600 print:hidden">
              Click a name to move it, then click where it goes.
              {weekStart && publishedWeeks[weekStart] && (
                <> Last published: {formatUpdatedAt(publishedWeeks[weekStart]?.updatedAt)}.</>
              )}
            </p>

            {weekVisibility === 'off' && weekStart && (
              <div className="mt-3 rounded border border-zinc-300 bg-zinc-100 p-3 text-sm text-zinc-700" role="status">
                This week is off and hidden from staff. Turn it on to share it.
              </div>
            )}

            {movingEmployee && (
              <div
                className="mt-3 flex flex-col gap-2 rounded border border-green-300 bg-green-50 p-3 sm:flex-row sm:items-center sm:justify-between print:hidden"
                role="status"
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-green-950">
                  <Icon name="move" />
                  Moving {movingEmployee.name}. Click a green spot to put them there.
                </p>
                <Button onClick={cancelMove} icon="close">
                  Cancel move
                </Button>
              </div>
            )}
            {lastReport && lastReport.weekStart === weekStart && (
              <GenerationReportBanner report={lastReport} onDismiss={() => setLastReport(null)} />
            )}
            <WeeklyScheduleBoard
              slots={slots}
              weekStart={weekStart}
              hasSchedule={assignments.length > 0}
              employees={employees}
              assignments={assignments}
              assignmentMap={assignmentMap}
              violations={violations}
              openShiftKey={openShiftKey}
              activeMove={activeMove}
              changedSlotIds={changedSlotIds}
              highlightedSlotIds={highlightedSlotIds}
              onResetShift={restoreShift}
              dragOverSlotId={dragOverSlotId}
              dropFeedback={dropFeedback}
              movePreviews={movePreviews}
              onOpenShift={setOpenShiftKey}
              onAssign={setEmployeeAssignment}
              onLock={setLocked}
              onDragStart={startAssignmentDrag}
              onDragEnd={endAssignmentDrag}
              onDragOverSlot={previewDropSlot}
              onDragLeaveSlot={clearDropPreview}
              onDropAssignment={moveAssignmentTo}
              onActivateSlot={activateSlot}
            />
            <div className="print:hidden">
              <VariantControls selectedVariant={selectedVariant} pendingVariant={generatingVariant} disabled={isGenerating} onGenerate={(id) => void generate(id)} />
            </div>
          </section>

          {changes.length > 0 && (
            <div className="print:hidden">
              <Disclosure summary={`Changes since you made the schedule (${changes.length})`}>
                <ul className="space-y-1 text-sm text-zinc-700">
                  {changes.map((change) => (
                    <li key={change.slotId}>{change.text}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  onClick={restoreEverything}
                >
                  <Icon name="reset" />
                  Put the whole week back
                </button>
              </Disclosure>
            </div>
          )}

          {diagnostics.length > 0 && (
            <div aria-live="polite" className="print:hidden">
              <Disclosure summary={`Messages (${diagnostics.length})`} tone="quiet">
                <ul className="space-y-1 text-sm text-zinc-700">
                  {diagnostics.map((message, index) => (
                    <li key={`${message}-${index}`}>{message}</li>
                  ))}
                </ul>
              </Disclosure>
            </div>
          )}

          <div className="space-y-1 pt-2 print:hidden">
            <Disclosure summary="Hours for each person" tone="quiet">
              <HoursSummary stats={stats} employees={employees} />
            </Disclosure>

            <TemplateEditor
              template={template}
              onChange={(next) => {
                remember('changed schedule rules')
                setTemplate(next)
              }}
              onUseDefault={restoreDefaultTemplate}
              isDefaultTemplate={isDefaultTemplate}
              rev={templateRev}
              dirty={templateDirty}
              loadError={templateLoadError}
              loadPending={storeLoading}
              panelOpen={templatePanelOpen}
              onTogglePanel={() => setTemplatePanelOpen((open) => !open)}
              onSaved={(rev, updatedAt) => {
                if (weekStart) setTemplateSaved(weekStart, rev, updatedAt, templateFingerprint(template))
              }}
              onClosePanel={() => setTemplatePanelOpen(false)}
              restaurantId={restaurantId}
              updatedAt={templateUpdatedAt}
              weekStart={weekStart}
            />

          <Disclosure summary="About this demo" tone="quiet">
            <ul className="space-y-2 text-sm text-zinc-700">
              {schedulerAssumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              onClick={makeInfeasible}
            >
              <Icon name="warning" />
              Show what a missing-coverage week looks like
            </button>
            </Disclosure>
          </div>
        </main>

        <aside className="order-2 min-w-0 space-y-4 print:hidden">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Staff{weekStart ? ` — week of ${formatWeekRange(weekStart)}` : ''}</h2>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {activeEmployeeCount} working, {employees.length - activeEmployeeCount} off the list
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Last saved: {formatUpdatedAt(rosterUpdatedAt)}{rosterDirty ? ' · unsaved changes' : ''} · changes stay in this week only
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <IconButton
                  icon="check"
                  label={storeLoading ? 'Waiting for the schedule store' : rosterPanelOpen ? 'Close save staff list' : 'Save staff list'}
                  onClick={() => setRosterPanelOpen((open) => !open)}
                  disabled={storeLoading}
                />
                <IconButton
                  icon={employeePanelOpen ? 'close' : 'plus'}
                  label={employeePanelOpen ? 'Close employee form' : 'Add employee'}
                  tone="accent"
                  onClick={() => setEmployeePanelOpen((open) => !open)}
                />
              </div>
            </div>

            {rosterLoadError && <p className="mt-2 text-xs font-medium text-amber-800">{rosterLoadError}</p>}

            {rosterPanelOpen && (
              <RosterPanel
                employees={employees}
                rev={rosterRev}
                dirty={rosterDirty}
                loadPending={storeLoading}
                onSaved={(rev, updatedAt) => {
                  if (weekStart) setRosterSaved(weekStart, rev, updatedAt, rosterFingerprint(employees))
                }}
                onClose={() => setRosterPanelOpen(false)}
                restaurantId={restaurantId}
                weekStart={weekStart}
              />
            )}

            {employeePanelOpen && (
              <EmployeeForm
                draft={draft}
                gapSlot={gapSlot}
                weekStart={weekStart}
                canAddEmployee={canAddEmployee}
                onDraftChange={setDraft}
                onAdd={addEmployee}
              />
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-600">Mistake? Bring back the built-in demo list.</p>
              <button
                type="button"
                className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={restoreDefaultRoster}
                disabled={isDefaultRoster}
                title={
                  isDefaultRoster
                    ? 'Already using the built-in demo staff list.'
                    : 'Replace the staff list with the built-in demo list. You can undo, then save to keep them.'
                }
              >
                Restore default staff
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
              <p className="text-xs text-zinc-600">Start fresh with an empty list. Undo brings everyone back.</p>
              {confirmingClearStaff ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded bg-red-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    onClick={clearStaff}
                  >
                    Yes, clear all
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    onClick={() => setConfirmingClearStaff(false)}
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  onClick={() => setConfirmingClearStaff(true)}
                  disabled={employees.length === 0}
                  title="Remove everyone from the staff list. You can undo, then save to keep it."
                >
                  Clear staff list
                </button>
              )}
            </div>

            <div className="mt-3 border-t border-zinc-100 pt-3">
              <Disclosure summary={`Saved staff lists (${staffSnapshots.length})`} tone="quiet">
                <p className="text-xs text-zinc-600">Keep a copy of a staff list on this device and bring it back anytime.</p>
                <div className="mt-2 flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    value={snapshotName}
                    onChange={(event) => setSnapshotName(event.target.value)}
                    placeholder={`Name this list (${employees.length} staff)`}
                    aria-label="Snapshot name"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    onClick={saveStaffSnapshot}
                    disabled={employees.length === 0}
                    title="Save a copy of the current staff list on this device."
                  >
                    Save
                  </button>
                </div>
                {staffSnapshots.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {staffSnapshots.map((snapshot) => (
                      <li key={snapshot.id} className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-zinc-900">{snapshot.name}</p>
                          <p className="text-xs text-zinc-500">{snapshot.employees.length} staff · {formatUpdatedAt(snapshot.savedAt)}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                            onClick={() => restoreStaffSnapshot(snapshot)}
                            title={`Replace the staff list with “${snapshot.name}”. You can undo.`}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                            onClick={() => deleteStaffSnapshot(snapshot.id)}
                            title={`Delete “${snapshot.name}”.`}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Disclosure>
            </div>

            <div className="mt-3 border-t border-zinc-100 pt-3">
              <label className="block text-sm font-medium text-zinc-800">
                <span className="sr-only">Search staff</span>
                <input
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  value={staffQuery}
                  onChange={(event) => setStaffQuery(event.target.value)}
                  placeholder={employees.length > 8 ? `Search ${employees.length} staff by name or position` : 'Search by name or position'}
                />
              </label>
              <details className="mt-2" open={staffQuery.trim().length > 0}>
                <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
                  Everyone on the list ({filteredEmployees.length}/{employees.length})
                </summary>
                <div className="mt-3 space-y-3">
                  {filteredEmployees.map((employee) => (
                    <EmployeeCard
                      key={employee.id}
                      employee={employee}
                      stat={staffStatsById.get(employee.id)}
                      onUpdate={updateEmployee}
                      onRemove={removeEmployee}
                    />
                  ))}
                  {filteredEmployees.length === 0 && (
                    <p className="text-sm text-zinc-600">Nobody matches &ldquo;{staffQuery.trim()}&rdquo;.</p>
                  )}
                </div>
              </details>
            </div>
          </section>

          {blockers.length > 0 && (
            <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
              <h2 className="font-semibold text-amber-950">Before you print</h2>
              <ul className="mt-3 space-y-2">
                {blockers.map((blocker) => (
                  <li key={blocker} className="flex items-start gap-2 text-sm text-amber-900">
                    <span className="mt-0.5 shrink-0 text-amber-700">
                      <Icon name="warning" />
                    </span>
                    {blocker}
                  </li>
                ))}
              </ul>
            </section>
          )}

        </aside>
      </div>
    </div>
  )
}

function AvailabilityGridEditor({
  recurringAvailability,
  onToggle,
}: {
  recurringAvailability: Employee['recurringAvailability']
  onToggle: (day: DayOfWeek, period: 'am' | 'pm', checked: boolean) => void
}) {
  return (
    <div className="mt-2 grid grid-cols-[2.5rem_1fr_1fr] items-center gap-x-3 gap-y-1.5">
      <span />
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">AM</span>
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">PM</span>
      {DAYS.map((day) => {
        const { am, pm } = dayAvailabilityFromRanges(recurringAvailability[day])
        return (
          <Fragment key={day}>
            <span className="text-xs text-zinc-700">{day.slice(0, 3)}</span>
            <label className="flex items-center justify-start">
              <input type="checkbox" checked={am} onChange={(event) => onToggle(day, 'am', event.target.checked)} />
            </label>
            <label className="flex items-center justify-start">
              <input type="checkbox" checked={pm} onChange={(event) => onToggle(day, 'pm', event.target.checked)} />
            </label>
          </Fragment>
        )
      })}
    </div>
  )
}

function EmployeeForm({
  draft,
  gapSlot,
  weekStart,
  canAddEmployee,
  onDraftChange,
  onAdd,
}: {
  draft: EmployeeDraft
  gapSlot?: StaffingSlot
  weekStart: string
  canAddEmployee: boolean
  onDraftChange: (draft: EmployeeDraft) => void
  onAdd: () => void
}) {
  const saveHint = !draft.name.trim()
    ? 'Add a name to save.'
    : ROLES.every((role) => !draft.roles[role]) && !draft.newHire
      ? 'Pick at least one position, or mark them a new hire, to save.'
      : null

  function toggleAvailabilityDay(day: DayOfWeek, period: 'am' | 'pm', checked: boolean) {
    const current = dayAvailabilityFromRanges(draft.recurringAvailability[day])
    const next = { ...current, [period]: checked }
    onDraftChange({
      ...draft,
      recurringAvailability: { ...draft.recurringAvailability, [day]: rangesForDayToggle(next.am, next.pm) },
    })
  }
  return (
    <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3">
      <label className="block text-sm font-medium text-zinc-800">
        Employee name
        <input
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          value={draft.name}
          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
          placeholder="Name"
        />
      </label>

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-zinc-800">Positions</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={draft.roles[role]}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    roles: { ...draft.roles, [role]: event.target.checked },
                  })
                }
              />
              {roleLabels[role]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-zinc-800">Availability</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {availabilityPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              onClick={() => onDraftChange({ ...draft, recurringAvailability: preset.build() })}
            >
              {preset.label}
            </button>
          ))}
          {gapSlot && (
            <button
              type="button"
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              onClick={() => onDraftChange({ ...draft, recurringAvailability: gapAvailability(gapSlot) })}
            >
              {weekStart ? formatDayLabel(weekStart, gapSlot.day) : gapSlot.day} {periodLabels[gapSlot.period]} only
            </button>
          )}
        </div>
        <AvailabilityGridEditor recurringAvailability={draft.recurringAvailability} onToggle={toggleAvailabilityDay} />
      </fieldset>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-zinc-800">
          Max days (1–7)
          <input
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            min={1}
            max={7}
            type="number"
            value={draft.maxDaysPerWeek}
            onChange={(event) => onDraftChange({ ...draft, maxDaysPerWeek: clampMaxDays(Number(event.target.value)) })}
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm font-medium text-zinc-800">
          <input
            type="checkbox"
            checked={draft.allowDoubles}
            onChange={(event) => onDraftChange({ ...draft, allowDoubles: event.target.checked })}
          />
          Can work doubles
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-zinc-800">
        <input
          type="checkbox"
          checked={draft.newHire}
          onChange={(event) => onDraftChange({ ...draft, newHire: event.target.checked })}
        />
        New hire (can be placed in any position, still limited by max days)
      </label>

      <button
        type="button"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        disabled={!canAddEmployee}
        onClick={onAdd}
        title={saveHint ?? 'Save this person to the staff list.'}
        aria-disabled={!canAddEmployee}
      >
        <Icon name="plus" />
        Save employee
      </button>
      {saveHint && (
        <p className="mt-2 text-xs text-zinc-600" role="note">
          {saveHint}
        </p>
      )}
    </div>
  )
}

function EmployeeCard({
  employee,
  stat,
  onUpdate,
  onRemove,
}: {
  employee: Employee
  stat?: ScheduleStats
  onUpdate: (employeeId: string, update: Partial<Employee>) => void
  onRemove: (employeeId: string) => void
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  function toggleRole(role: Role, enabled: boolean) {
    const roles = enabled ? [...employee.roles, role] : employee.roles.filter((candidate) => candidate !== role)
    onUpdate(employee.id, { roles: ROLES.filter((candidate) => roles.includes(candidate)) })
  }

  return (
    <div className="rounded border border-zinc-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-zinc-950">{employee.name}</div>
          <p className="mt-0.5 text-xs text-zinc-600">
            {availabilitySummary(employee)} · {stat && stat.shifts > 0 ? `${stat.hours.toFixed(1)}h · ${stat.days}d this week` : 'off this week'}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={employee.active}
            onChange={(event) => onUpdate(employee.id, { active: event.target.checked })}
          />
          Working
        </label>
      </div>

      {confirmingRemove ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-red-300 bg-red-50 px-2 py-1.5">
          <span className="text-xs font-semibold text-red-900">Remove {employee.name} from the staff list?</span>
          <button
            type="button"
            className="rounded bg-red-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={() => onRemove(employee.id)}
          >
            Yes, remove
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={() => setConfirmingRemove(false)}
          >
            Keep them
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-red-800 hover:text-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={() => setConfirmingRemove(true)}
        >
          Remove from staff list
        </button>
      )}

      <fieldset className="mt-2">
        <legend className="sr-only">Positions {employee.name} can work</legend>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((role) => {
            const checked = employee.roles.includes(role)
            return (
              <label
                key={role}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${
                  checked ? roleChipClasses[role] : 'border-zinc-200 bg-white text-zinc-400'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={checked}
                  onChange={(event) => toggleRole(role, event.target.checked)}
                />
                {roleLabels[role]}
              </label>
            )
          })}
        </div>
      </fieldset>

      {employee.roles.length === 0 && !employee.newHire && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
          <Icon name="warning" />
          No positions picked, so {employee.name} cannot be scheduled.
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm text-zinc-700">
          Max days (1–7)
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            min={1}
            max={7}
            type="number"
            value={employee.maxDaysPerWeek ?? 7}
            onChange={(event) => onUpdate(employee.id, { maxDaysPerWeek: clampMaxDays(Number(event.target.value)) })}
          />
        </label>
        <label className="flex items-end gap-2 pb-1 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={employee.allowDoubles}
            onChange={(event) => onUpdate(employee.id, { allowDoubles: event.target.checked })}
          />
          Doubles
        </label>
      </div>

      <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={Boolean(employee.newHire)}
          onChange={(event) => onUpdate(employee.id, { newHire: event.target.checked })}
        />
        New hire (any position, still limited by max days)
      </label>

      <Disclosure summary="Edit availability" tone="quiet">
        <AvailabilityGridEditor
          recurringAvailability={employee.recurringAvailability}
          onToggle={(day, period, checked) => {
            const current = dayAvailabilityFromRanges(employee.recurringAvailability[day])
            const next = { ...current, [period]: checked }
            onUpdate(employee.id, {
              recurringAvailability: { ...employee.recurringAvailability, [day]: rangesForDayToggle(next.am, next.pm) },
            })
          }}
        />
      </Disclosure>
    </div>
  )
}

function OnboardingBanner({
  activeEmployeeCount,
  onDismiss,
}: {
  activeEmployeeCount: number
  onDismiss: () => void
}) {
  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 shadow-sm print:hidden" aria-label="Getting started">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-sky-950">Getting started</h2>
          <p className="mt-1 text-sm text-sky-900">Four steps to a published schedule:</p>
        </div>
        <IconButton icon="close" label="Dismiss getting-started tips" onClick={onDismiss} />
      </div>
      <div className="mt-3 space-y-2">
        <ChecklistItem complete={activeEmployeeCount > 0} label="Add everyone working this week to the Staff list" />
        <ChecklistItem complete={false} label={'Press "Make schedule" to build the week'} />
        <ChecklistItem complete={false} label={'Use "Fix next issue" to settle anything that needs a decision'} />
        <ChecklistItem complete={false} label={'Press "Publish to staff" when it looks right'} />
      </div>
    </section>
  )
}

function GuidedFixPanel({
  nextIssue,
  weekStart,
  issueCount,
  totalCount,
  ignoredCount,
  candidates,
  excluded,
  choosing,
  hasSchedule,
  onChooseEmployee,
  onPickEmployee,
  onAddEmployee,
  onIgnore,
  onShowIgnored,
}: {
  nextIssue?: FixIssue
  weekStart: string
  issueCount: number
  totalCount: number
  ignoredCount: number
  candidates: Employee[]
  excluded: { employee: Employee; reason: string }[]
  choosing: boolean
  hasSchedule: boolean
  onChooseEmployee: () => void
  onPickEmployee: (employeeId: string) => void
  onAddEmployee: () => void
  onIgnore: () => void
  onShowIgnored: () => void
}) {
  if (!nextIssue) {
    return (
      <section className="rounded-lg border border-green-300 bg-green-50 p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-start gap-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-700 text-white">
            <Icon name="check" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-green-950">
              {hasSchedule ? 'Nothing left to fix' : 'Ready when you are'}
            </h2>
            <p className="mt-1 text-sm text-green-900">
              {hasSchedule
                ? 'Every spot is filled and nobody is double-booked.'
                : 'Press Make schedule. Anything that needs a decision will show up here, one at a time.'}
            </p>
          </div>
          {ignoredCount > 0 && (
            <Button onClick={onShowIgnored} icon="undo">
              Show {ignoredCount} skipped
            </Button>
          )}
        </div>
      </section>
    )
  }

  const isBlocker = nextIssue.id.includes('missing_assignment') || nextIssue.id.startsWith('ready:')
  const position = totalCount > 0 ? totalCount - issueCount + 1 : 1
  return (
    <section
      className={`rounded-lg border p-4 shadow-sm print:hidden ${isBlocker ? 'border-red-400 bg-red-50' : 'border-amber-400 bg-amber-50'}`}
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${isBlocker ? 'text-red-900' : 'text-amber-900'}`}>
            Fix {position} of {totalCount}
            {ignoredCount > 0 && ` · ${ignoredCount} skipped`}
          </p>
          <p className="mt-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-bold ${
                isBlocker ? 'border-red-300 bg-white text-red-900' : 'border-amber-300 bg-white text-amber-950'
              }`}
            >
              <Icon name={isBlocker ? 'warning' : 'target'} />
              {isBlocker ? 'Must fix before printing' : 'You can skip this'}
            </span>
          </p>
          <h2 className={`mt-1 text-lg font-semibold ${isBlocker ? 'text-red-950' : 'text-amber-950'}`}>{nextIssue.title}</h2>
          <p className={`mt-1 text-sm ${isBlocker ? 'text-red-900' : 'text-amber-900'}`}>{nextIssue.detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={onChooseEmployee} icon="target" disabled={!nextIssue.slot}>
            Choose employee
          </Button>
          <Button onClick={onAddEmployee} icon="plus">
            Add employee
          </Button>
          <Button onClick={onIgnore} icon="close" disabled={isBlocker} title={isBlocker ? 'An empty spot must be filled — skipping would hide missing cover.' : 'Skip this for now.'}>
            Ignore for now
          </Button>
        </div>
      </div>
      {isBlocker && (
        <p className="mt-2 text-xs font-medium text-red-900">
          Empty spots block printing. Skipping is turned off so missing cover stays visible.
        </p>
      )}

      {choosing && nextIssue.slot && (
        <div className="mt-4 rounded border border-amber-300 bg-white p-3">
          {candidates.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-zinc-900">
                Who should work {weekStart ? formatDayLabel(weekStart, nextIssue.slot.day) : nextIssue.slot.day} {periodLabels[nextIssue.slot.period]} as {nextIssue.slot.label}?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="inline-flex items-center gap-2 rounded border border-green-500 bg-green-50 px-3 py-2 text-sm font-semibold text-green-950 hover:bg-green-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    onClick={() => onPickEmployee(candidate.id)}
                  >
                    <Icon name="check" />
                    {candidate.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500">Everyone here is free and trained for this position.</p>
              {excluded.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-700 hover:text-zinc-900">
                    Why {excluded.length} other{excluded.length === 1 ? '' : 's'} can&apos;t cover this
                  </summary>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-600">
                    {excluded.map(({ employee, reason }) => (
                      <li key={employee.id}>
                        <span className="font-medium text-zinc-800">{employee.name}</span> — {reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-700">
                Nobody on the list is free and trained for this spot. Add someone, or open the shift below to override it.
              </p>
              {excluded.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                  {excluded.map(({ employee, reason }) => (
                    <li key={employee.id}>
                      <span className="font-medium text-zinc-800">{employee.name}</span> — {reason}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

function MonthStrip({
  monthKey,
  weekStart,
  monthWeeks,
  weeks,
  weekStatus,
  onSelectWeek,
  onSelectMonth,
  onToggleWeek,
}: {
  monthKey: string
  weekStart: string
  monthWeeks: string[]
  weeks: WeekAssignments
  weekStatus: Record<string, WeekStatus>
  onSelectWeek: (weekStart: string) => void
  onSelectMonth: (monthKey: string) => void
  onToggleWeek: (weekStart: string, status: WeekStatus) => void
}) {
  if (!monthKey) return null
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton icon="chevronLeft" label="Previous month" onClick={() => onSelectMonth(shiftMonth(monthKey, -1))} />
        <h3 className="min-w-36 text-center text-base font-bold">{monthLabel(monthKey)}</h3>
        <IconButton icon="chevronRight" label="Next month" onClick={() => onSelectMonth(shiftMonth(monthKey, 1))} />
        <button
          type="button"
          className="ml-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          onClick={() => onSelectMonth(monthKeyForWeek(currentWeekStart()))}
        >
          This month
        </button>
      </div>
      <div className="mt-2 grid w-full min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5" role="listbox" aria-label="Weeks in this month">
        {monthWeeks.map((week) => {
          const list = weeks[week] ?? emptyAssignments
          const status = statusForWeek(weekStatus, week, list)
          const selected = week === weekStart
          const filled = list.filter((assignment) => assignment.employeeId).length
          return (
            <div
              key={week}
              role="option"
              aria-selected={selected}
              className={`flex min-w-0 items-center gap-1.5 rounded border px-2 py-1.5 text-left ${
                selected ? 'border-red-800 bg-red-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'
              } ${status === 'off' ? 'opacity-70' : ''}`}
            >
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectWeek(week)} title={formatWeekRange(week)}>
                <span className="block truncate text-xs font-semibold text-zinc-900">{formatWeekRange(week)}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-500">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${status === 'on' ? 'bg-green-600' : 'bg-zinc-300'}`} />
                  {status === 'on' ? 'On' : 'Off'} · {filled} filled
                </span>
              </button>
              <FlipSwitch
                on={status === 'on'}
                onFlip={() => onToggleWeek(week, status === 'on' ? 'off' : 'on')}
                label={`Week of ${formatWeekRange(week)}`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekVisibilityToggle({
  weekStart,
  status,
  onToggle,
}: {
  weekStart: string
  status: WeekStatus
  onToggle: (weekStart: string, status: WeekStatus) => void
}) {
  if (!weekStart) return null
  const on = status === 'on'
  return (
    <span className="inline-flex items-center gap-1.5">
      <FlipSwitch on={on} onFlip={() => onToggle(weekStart, on ? 'off' : 'on')} label="This week" />
      <span className={`text-xs font-bold ${on ? 'text-green-900' : 'text-zinc-500'}`}>Week {on ? 'on' : 'off'}</span>
    </span>
  )
}

function FlipSwitch({
  on,
  onFlip,
  label,
}: {
  on: boolean
  onFlip: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label} ${on ? 'on' : 'off'}`}
      title={on ? `Turn ${label.toLowerCase()} off.` : `Turn ${label.toLowerCase()} on.`}
      onClick={onFlip}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
        on ? 'bg-green-600' : 'bg-zinc-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

function GenerationReportBanner({ report, onDismiss }: { report: GenerationReport; onDismiss: () => void }) {
  const failed = report.status === 'failed'
  return (
    <div
      key={report.id}
      role={failed ? 'alert' : 'status'}
      aria-live="polite"
      className={`mt-3 flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between print:hidden ${
        failed
          ? 'border-red-300 bg-red-50'
          : report.status === 'success'
            ? 'border-green-300 bg-green-50'
            : 'border-zinc-300 bg-zinc-50'
      }`}
    >
      <p
        className={`flex items-center gap-2 text-sm font-semibold ${
          failed ? 'text-red-950' : report.status === 'success' ? 'text-green-950' : 'text-zinc-800'
        }`}
      >
        <Icon name={failed ? 'warning' : report.status === 'success' ? 'check' : 'spark'} />
        {failed ? `Couldn’t make the schedule (${report.at}). ` : `Schedule ${report.status === 'success' ? 'updated' : 'checked'} at ${report.at}. `}
        <span className="font-normal">{report.detail}</span>
      </p>
      <button
        type="button"
        className="shrink-0 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  )
}

function VariantControls({
  selectedVariant,
  pendingVariant,
  disabled = false,
  onGenerate,
}: {
  selectedVariant: ScheduleVariant
  pendingVariant: ScheduleVariant | null
  disabled?: boolean
  onGenerate: (variant: ScheduleVariant) => void
}) {
  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <p className="text-sm text-zinc-600">Other ways to build this week. Anyone marked Keep stays put.</p>
      <div className="mt-2 flex flex-wrap gap-2">
      {scheduleVariants.map((variant) => {
        const pending = pendingVariant === variant.id
        return (
          <button
            key={variant.id}
            type="button"
            className={`inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-70 ${
              selectedVariant === variant.id
                ? 'border-red-800 bg-red-800 text-white'
                : 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100'
            }`}
            onClick={() => onGenerate(variant.id)}
            disabled={disabled}
            aria-busy={pending}
            title={pending ? 'Building this schedule…' : variant.description}
          >
            {pending ? (
              <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Icon name={variant.icon} />
            )}
            {pending ? 'Making…' : variant.label}
          </button>
        )
      })}
      </div>
    </div>
  )
}

function HoursSummary({ stats, employees }: { stats: ScheduleStats[]; employees: Employee[] }) {
  const working = stats.filter((stat) => stat.shifts > 0)
  if (working.length === 0) {
    return <p className="text-sm text-zinc-600">Make a schedule to see how the hours land.</p>
  }

  const mostHours = Math.max(...working.map((stat) => stat.hours))
  const idle = stats.filter((stat) => stat.shifts === 0)
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))

  return (
    <div>
      <ul className="divide-y divide-zinc-100">
        {working.map((stat) => {
          const employee = employeeById.get(stat.employeeId)
          const maxDays = employee?.maxDaysPerWeek ?? 7
          const maxShifts = employee?.maxShiftsPerWeek
          const overloaded = stat.days > maxDays || (maxShifts !== undefined && stat.shifts > maxShifts)
          return (
            <li key={stat.employeeId} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="w-24 shrink-0 truncate font-medium text-zinc-900">
                {stat.name}
                {overloaded && <span className="ml-1 font-bold text-red-700">· over</span>}
              </span>
              <span aria-hidden="true" className={`h-1.5 min-w-0 flex-1 rounded-full ${overloaded ? 'bg-red-100' : 'bg-zinc-100'}`}>
                <span
                  className={`block h-full rounded-full ${overloaded ? 'bg-red-600' : 'bg-zinc-400'}`}
                  style={{ width: `${Math.round((stat.hours / mostHours) * 100)}%` }}
                />
              </span>
              <span className={`w-14 shrink-0 text-right font-semibold ${overloaded ? 'text-red-800' : 'text-zinc-900'}`}>
                {stat.hours.toFixed(1)}h
              </span>
              <span className={`w-20 shrink-0 text-right text-xs ${overloaded ? 'font-semibold text-red-700' : 'text-zinc-500'}`}>
                {stat.days}d · {stat.shifts} shift{stat.shifts === 1 ? '' : 's'}
              </span>
            </li>
          )
        })}
      </ul>
      {idle.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">
          Not working this week: {idle.map((stat) => stat.name).join(', ')}
        </p>
      )}
    </div>
  )
}

function minutesToTimeValue(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function timeValueToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

function blankTemplateSlot(): StaffingTemplateSlot {
  return { period: 'AM', role: 'server', label: 'Server', start: minutes(9, 30), end: minutes(16), required: true }
}

function TemplateEditor({
  template,
  onChange,
  onUseDefault,
  isDefaultTemplate,
  rev,
  dirty,
  loadError,
  loadPending,
  panelOpen,
  onTogglePanel,
  onSaved,
  onClosePanel,
  restaurantId,
  updatedAt,
  weekStart,
}: {
  template: WeeklyStaffingTemplate
  onChange: (template: WeeklyStaffingTemplate) => void
  onUseDefault: () => void
  isDefaultTemplate: boolean
  rev: number
  dirty: boolean
  loadError: string
  loadPending: boolean
  panelOpen: boolean
  onTogglePanel: () => void
  onSaved: (rev: number, updatedAt: string | null) => void
  onClosePanel: () => void
  restaurantId?: string
  updatedAt: string | null
  weekStart?: string
}) {
  function updateDay(day: DayOfWeek, daySlots: StaffingTemplateSlot[]) {
    onChange({ ...template, [day]: daySlots })
  }

  function updateSlot(day: DayOfWeek, index: number, update: Partial<StaffingTemplateSlot>) {
    updateDay(day, template[day].map((slot, candidate) => (candidate === index ? { ...slot, ...update } : slot)))
  }

  function removeSlot(day: DayOfWeek, index: number) {
    updateDay(day, template[day].filter((_, candidate) => candidate !== index))
  }

  function addSlot(day: DayOfWeek) {
    updateDay(day, [...template[day], blankTemplateSlot()])
  }

  return (
    <Disclosure summary="Schedule rules" tone="quiet">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-zinc-600">Who the restaurant needs on each shift for this week. Add, remove, or change any spot.</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Last saved: {formatUpdatedAt(updatedAt)}{dirty ? ' · unsaved changes' : ''} · changes stay in this week only
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={onUseDefault}
            disabled={isDefaultTemplate}
            title={
              isDefaultTemplate
                ? 'Already using the built-in default rules.'
                : 'Replace these rules with the built-in defaults. You can undo, then save to keep them.'
            }
          >
            Restore default rules
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={onTogglePanel}
            disabled={loadPending}
            title={loadPending ? 'Waiting for the schedule store.' : undefined}
          >
            {panelOpen ? 'Close save rules' : 'Save rules'}
          </button>
        </div>
      </div>
      {loadError && <p className="mt-2 text-xs font-medium text-amber-800">{loadError}</p>}
      {panelOpen && (
        <div className="mt-2">
          <TemplatePanel template={template} rev={rev} dirty={dirty} loadPending={loadPending} onSaved={onSaved} onClose={onClosePanel} restaurantId={restaurantId} weekStart={weekStart} />
        </div>
      )}
      <div className="mt-3 space-y-3">
        {DAYS.map((day) => (
          <div key={day} className="rounded border border-zinc-200 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-zinc-900">{day}</h4>
              <button
                type="button"
                className="shrink-0 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={() => addSlot(day)}
              >
                + Add spot
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {template[day].length === 0 && <p className="text-xs text-zinc-500">No spots this day.</p>}
              {template[day].map((slot, index) => (
                <div key={index} className="flex flex-wrap items-center gap-1.5 rounded bg-zinc-50 p-1.5">
                  <select
                    className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs"
                    value={slot.period}
                    onChange={(event) => updateSlot(day, index, { period: event.target.value as ShiftPeriod })}
                  >
                    {PERIODS.map((period) => (
                      <option key={period} value={period}>
                        {periodLabels[period]}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs"
                    value={slot.role}
                    onChange={(event) => updateSlot(day, index, { role: event.target.value as Role })}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                  <input
                    className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
                    value={slot.label}
                    onChange={(event) => updateSlot(day, index, { label: event.target.value })}
                    placeholder="Label"
                  />
                  <input
                    type="time"
                    className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs"
                    value={minutesToTimeValue(slot.start)}
                    onChange={(event) => updateSlot(day, index, { start: timeValueToMinutes(event.target.value) })}
                  />
                  <span aria-hidden="true" className="text-xs text-zinc-500">to</span>
                  <input
                    type="time"
                    className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs"
                    value={minutesToTimeValue(slot.end)}
                    onChange={(event) => updateSlot(day, index, { end: timeValueToMinutes(event.target.value) })}
                  />
                  <label className="flex items-center gap-1 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={slot.required}
                      onChange={(event) => updateSlot(day, index, { required: event.target.checked })}
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    className="ml-auto rounded border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    onClick={() => removeSlot(day, index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Disclosure>
  )
}

function Button({
  children,
  icon,
  tone = 'plain',
  badge,
  onClick,
  disabled = false,
  loading = false,
  title,
}: {
  children: React.ReactNode
  icon: IconName
  tone?: 'plain' | 'primary'
  badge?: number
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  title?: string
}) {
  const className =
    tone === 'primary'
      ? 'inline-flex items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'
      : 'inline-flex items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled || loading} aria-busy={loading} title={title}>
      {loading ? (
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Icon name={icon} />
      )}
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-200 px-1.5 text-xs font-bold text-amber-950">
          {badge}
        </span>
      )}
    </button>
  )
}

function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  tone = 'plain',
}: {
  icon: IconName
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'plain' | 'accent'
}) {
  const className =
    tone === 'accent'
      ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'
      : 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  )
}

function Disclosure({
  summary,
  tone = 'default',
  children,
}: {
  summary: string
  tone?: 'default' | 'quiet'
  children: React.ReactNode
}) {
  if (tone === 'quiet') {
    return (
      <details className="px-1">
        <summary className="cursor-pointer py-1 text-sm text-zinc-500 hover:text-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
          {summary}
        </summary>
        <div className="py-2">{children}</div>
      </details>
    )
  }

  return (
    <details className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-4 py-3 font-semibold text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
        {summary}
      </summary>
      <div className="border-t border-zinc-100 px-4 py-3">{children}</div>
    </details>
  )
}

function ChecklistItem({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-700">
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          complete ? 'border-green-700 bg-green-700 text-white' : 'border-amber-400 bg-amber-50 text-amber-900'
        }`}
      >
        {complete ? <Icon name="check" /> : '!'}
      </span>
      {label}
    </div>
  )
}

function WeeklyScheduleBoard({
  slots,
  weekStart,
  hasSchedule,
  employees,
  assignments,
  assignmentMap,
  violations,
  openShiftKey,
  dragOverSlotId,
  dropFeedback,
  movePreviews,
  activeMove,
  changedSlotIds,
  highlightedSlotIds,
  onResetShift,
  onOpenShift,
  onAssign,
  onLock,
  onDragStart,
  onDragEnd,
  onDragOverSlot,
  onDragLeaveSlot,
  onDropAssignment,
  onActivateSlot,
}: {
  slots: StaffingSlot[]
  weekStart: string
  hasSchedule: boolean
  employees: Employee[]
  assignments: ScheduleAssignment[]
  assignmentMap: Map<string, ScheduleAssignment>
  violations: ValidationViolation[]
  openShiftKey: ShiftKey | null
  dragOverSlotId: string | null
  dropFeedback: DropFeedback
  movePreviews: Map<string, MovePreview>
  activeMove: DragState | null
  changedSlotIds: Set<string>
  highlightedSlotIds: Set<string>
  onResetShift: (shiftKey: ShiftKey) => void
  onOpenShift: (shiftKey: ShiftKey | null) => void
  onAssign: (slotId: string, employeeId: string) => void
  onLock: (slotId: string, locked: boolean) => void
  onDragStart: (dragState: DragState) => void
  onDragEnd: () => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (targetSlotId: string) => void
  onActivateSlot: (slotId: string) => void
}) {
  return (
    <div className="mt-4 min-w-0">
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {DAYS.map((day) => {
          const daySlots = slots.filter((slot) => slot.day === day)
          const filled = daySlots.filter((slot) => assignmentMap.get(slot.id)?.employeeId).length
          const dayComplete = daySlots.length > 0 && filled === daySlots.length
          return (
            <div key={day} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/60 p-2">
              <h3 className="flex min-w-0 items-baseline gap-1 px-0.5 text-sm font-bold text-zinc-900">
                <span className="truncate">{weekStart ? formatDayLabel(weekStart, day) : day.slice(0, 3)}</span>
                <span
                  className={`ml-auto inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[11px] font-semibold ${
                    daySlots.length === 0
                      ? 'border-zinc-200 bg-zinc-50 text-zinc-500'
                      : dayComplete
                        ? 'border-green-300 bg-green-50 text-green-900'
                        : hasSchedule
                          ? 'border-amber-300 bg-amber-50 text-amber-950'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                  }`}
                >
                  {filled}/{daySlots.length}
                </span>
              </h3>
              {PERIODS.map((period) => {
                const shiftKey = `${day}-${period}` as ShiftKey
                const shiftSlots = slots.filter((slot) => slot.day === day && slot.period === period)
                return (
                  <ShiftRow
                    key={shiftKey}
                    shiftKey={shiftKey}
                    weekStart={weekStart}
                    period={period}
                    slots={shiftSlots}
                    allSlots={slots}
                    hasSchedule={hasSchedule}
                    employees={employees}
                    assignments={assignments}
                    assignmentMap={assignmentMap}
                    violations={violations}
                    open={openShiftKey === shiftKey}
                    dragOverSlotId={dragOverSlotId}
                    dropFeedback={dropFeedback}
                    movePreviews={movePreviews}
                    activeMove={activeMove}
                    changedSlotIds={changedSlotIds}
                    highlightedSlotIds={highlightedSlotIds}
                    onResetShift={onResetShift}
                    onOpenShift={onOpenShift}
                    onAssign={onAssign}
                    onLock={onLock}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDragOverSlot={onDragOverSlot}
                    onDragLeaveSlot={onDragLeaveSlot}
                    onDropAssignment={onDropAssignment}
                    onActivateSlot={onActivateSlot}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      {openShiftKey && (
        <OpenShiftDetail
          shiftKey={openShiftKey}
          weekStart={weekStart}
          slots={slots}
          employees={employees}
          assignments={assignments}
          assignmentMap={assignmentMap}
          violations={violations}
          changedSlotIds={changedSlotIds}
          activeMove={activeMove}
          dragOverSlotId={dragOverSlotId}
          dropFeedback={dropFeedback}
          movePreviews={movePreviews}
          onResetShift={onResetShift}
          onOpenShift={onOpenShift}
          onAssign={onAssign}
          onLock={onLock}
          onDragOverSlot={onDragOverSlot}
          onDragLeaveSlot={onDragLeaveSlot}
          onDropAssignment={onDropAssignment}
        />
      )}
      <BoardLegend />
    </div>
  )
}

function BoardLegend() {
  const statusOrder: SpotStatus[] = ['good', 'review', 'missing', 'idle']

  return (
    <div className="space-y-2 border-t border-zinc-100 pt-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-500">Position:</span>
        {ROLES.map((role) => (
          <span key={role} className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-medium ${roleChipClasses[role]}`}>
            <span aria-hidden="true" className="font-bold">
              {roleInitials[role]}
            </span>
            {roleLabels[role]}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-500">Spot:</span>
        {statusOrder.map((status) => (
          <span key={status} className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-medium ${statusMeta[status].chip}`}>
            <Icon name={statusMeta[status].icon} />
            {statusMeta[status].shiftLabel}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          Changed
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
          Keep
        </span>
      </div>
    </div>
  )
}

function ShiftRow({
  shiftKey,
  weekStart,
  period,
  slots,
  allSlots,
  hasSchedule,
  employees,
  assignments,
  assignmentMap,
  violations,
  open,
  dragOverSlotId,
  dropFeedback,
  movePreviews,
  activeMove,
  changedSlotIds,
  highlightedSlotIds,
  onResetShift,
  onOpenShift,
  onAssign,
  onLock,
  onDragStart,
  onDragEnd,
  onDragOverSlot,
  onDragLeaveSlot,
  onDropAssignment,
  onActivateSlot,
}: {
  shiftKey: ShiftKey
  weekStart: string
  period: ShiftPeriod
  slots: StaffingSlot[]
  allSlots: StaffingSlot[]
  hasSchedule: boolean
  employees: Employee[]
  assignments: ScheduleAssignment[]
  assignmentMap: Map<string, ScheduleAssignment>
  violations: ValidationViolation[]
  open: boolean
  dragOverSlotId: string | null
  dropFeedback: DropFeedback
  movePreviews: Map<string, MovePreview>
  activeMove: DragState | null
  changedSlotIds: Set<string>
  highlightedSlotIds: Set<string>
  onResetShift: (shiftKey: ShiftKey) => void
  onOpenShift: (shiftKey: ShiftKey | null) => void
  onAssign: (slotId: string, employeeId: string) => void
  onLock: (slotId: string, locked: boolean) => void
  onDragStart: (dragState: DragState) => void
  onDragEnd: () => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (targetSlotId: string) => void
  onActivateSlot: (slotId: string) => void
}) {
  const slotStatuses = slots.map((slot) =>
    spotStatus({
      hasEmployee: Boolean(assignmentMap.get(slot.id)?.employeeId),
      hasSchedule,
      violations: violations.filter((violation) => violation.slotId === slot.id),
    }),
  )
  const status = shiftStatus(slotStatuses)
  const missingCount = slotStatuses.filter((slotStatus) => slotStatus === 'missing').length
  const reviewCount = slotStatuses.filter((slotStatus) => slotStatus === 'review').length
  const statusLabel =
    status === 'missing'
      ? `Needs ${missingCount} more`
      : status === 'review'
        ? `${reviewCount} to check`
        : statusMeta[status].shiftLabel

  return (
    <div className={`min-w-0 overflow-hidden rounded ${statusMeta[status].shiftRow}`}>
      <div className="flex min-w-0 flex-col gap-1.5 px-2 py-2">
        <button
          type="button"
          className="flex min-w-0 items-center gap-1.5 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={() => onOpenShift(open ? null : shiftKey)}
          aria-expanded={open}
          aria-controls={`${shiftKey}-detail`}
        >
          <Icon name={open ? 'chevronDown' : 'chevronRight'} />
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{periodLabels[period]}</span>
          {status !== 'good' && (
            <span className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px text-[11px] font-semibold ${statusMeta[status].badge}`}>
              <Icon name={statusMeta[status].icon} />
              {statusLabel}
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-col gap-1.5">
          {slots.map((slot, index) => (
            <AssignmentChip
              key={slot.id}
              slot={slot}
              weekStart={weekStart}
              assignment={assignmentMap.get(slot.id)}
              employee={employees.find((candidate) => candidate.id === assignmentMap.get(slot.id)?.employeeId)}
              status={slotStatuses[index]}
              isChanged={changedSlotIds.has(slot.id)}
              isHighlighted={highlightedSlotIds.has(slot.id)}
              activeMove={activeMove}
              dragOverSlotId={dragOverSlotId}
              movePreview={movePreviews.get(slot.id) ?? null}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOverSlot={onDragOverSlot}
              onDragLeaveSlot={onDragLeaveSlot}
              onDropAssignment={onDropAssignment}
              onActivateSlot={onActivateSlot}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function OpenShiftDetail({
  shiftKey,
  weekStart,
  slots,
  employees,
  assignments,
  assignmentMap,
  violations,
  changedSlotIds,
  activeMove,
  dragOverSlotId,
  dropFeedback,
  movePreviews,
  onResetShift,
  onOpenShift,
  onAssign,
  onLock,
  onDragOverSlot,
  onDragLeaveSlot,
  onDropAssignment,
}: {
  shiftKey: ShiftKey
  weekStart: string
  slots: StaffingSlot[]
  employees: Employee[]
  assignments: ScheduleAssignment[]
  assignmentMap: Map<string, ScheduleAssignment>
  violations: ValidationViolation[]
  changedSlotIds: Set<string>
  activeMove: DragState | null
  dragOverSlotId: string | null
  dropFeedback: DropFeedback
  movePreviews: Map<string, MovePreview>
  onResetShift: (shiftKey: ShiftKey) => void
  onOpenShift: (shiftKey: ShiftKey | null) => void
  onAssign: (slotId: string, employeeId: string) => void
  onLock: (slotId: string, locked: boolean) => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (targetSlotId: string) => void
}) {
  const [day, period] = shiftKey.split('-') as [DayOfWeek, ShiftPeriod]
  const shiftSlots = slots.filter((slot) => slot.day === day && slot.period === period)
  if (shiftSlots.length === 0) return null
  return (
    <div id={`${shiftKey}-detail`} className="mt-2 rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-zinc-900">
          {weekStart ? formatDayLabel(weekStart, day) : day} {periodLabels[period]} · {shiftSlots.length} spots
        </h4>
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          onClick={() => onOpenShift(null)}
        >
          Close
        </button>
      </div>
      <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {shiftSlots.map((slot) => (
          <SlotEditor
            key={slot.id}
            slot={slot}
            weekStart={weekStart}
            status={spotStatus({
              hasEmployee: Boolean(assignmentMap.get(slot.id)?.employeeId),
              hasSchedule: assignments.length > 0,
              violations: violations.filter((violation) => violation.slotId === slot.id),
            })}
            activeMove={activeMove}
            employees={employees}
            allSlots={slots}
            allAssignments={assignments}
            assignment={assignmentMap.get(slot.id)}
            violations={violations.filter((violation) => violation.slotId === slot.id)}
            dragOverSlotId={dragOverSlotId}
            movePreview={movePreviews.get(slot.id) ?? null}
            dropFeedback={dropFeedback?.slotId === slot.id ? dropFeedback.message : null}
            onAssign={onAssign}
            onLock={onLock}
            onDragOverSlot={onDragOverSlot}
            onDragLeaveSlot={onDragLeaveSlot}
            onDropAssignment={onDropAssignment}
          />
        ))}
      </div>
      {shiftSlots.some((slot) => changedSlotIds.has(slot.id)) && (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={() => onResetShift(shiftKey)}
        >
          <Icon name="reset" />
          Put this shift back
        </button>
      )}
    </div>
  )
}

function AssignmentChip({
  slot,
  weekStart,
  assignment,
  employee,
  status,
  isChanged,
  isHighlighted,
  activeMove,
  dragOverSlotId,
  movePreview,
  onDragStart,
  onDragEnd,
  onDragOverSlot,
  onDragLeaveSlot,
  onDropAssignment,
  onActivateSlot,
}: {
  slot: StaffingSlot
  weekStart: string
  assignment?: ScheduleAssignment
  employee?: Employee
  status: SpotStatus
  isChanged: boolean
  isHighlighted: boolean
  activeMove: DragState | null
  dragOverSlotId: string | null
  movePreview: MovePreview | null
  onDragStart: (dragState: DragState) => void
  onDragEnd: () => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (targetSlotId: string) => void
  onActivateSlot: (slotId: string) => void
}) {
  const canDrag = Boolean(assignment?.employeeId && employee)
  const isMoveActive = Boolean(activeMove)
  const isSource = activeMove?.fromSlotId === slot.id
  const isHovered = dragOverSlotId === slot.id && isMoveActive && !isSource
  const preview = isSource ? null : movePreview
  const isGhosted = isHovered && preview?.status === 'valid'
  const movingName = activeMove ? preview?.employeeName : undefined
  const day = weekStart ? formatDayLabel(weekStart, slot.day) : slot.day

  // Whatever matters most for this spot gets the big text: a name when there is one,
  // otherwise the position that still needs filling.
  let primaryText = employee?.name ?? slot.label
  if (isSource) {
    primaryText = 'Open'
  } else if (isGhosted && preview) {
    primaryText = preview.employeeName
  }
  const primaryTone = employee && !isSource ? 'font-semibold text-zinc-900' : 'font-medium'

  const label = isSource
    ? `Stop moving ${employee?.name ?? 'this person'}`
    : isMoveActive && preview
      ? `Move ${movingName} to ${day} ${periodLabels[slot.period]} ${slot.label}. ${preview.message}`
      : canDrag
        ? `Move ${employee?.name} out of ${day} ${periodLabels[slot.period]} ${slot.label}`
        : `Open ${day} ${periodLabels[slot.period]} to fill ${slot.label}`

  return (
    <button
      type="button"
      className={assignmentChipClass({
        status,
        isMoveActive,
        isSource,
        isHovered,
        preview,
        wouldReplace: Boolean(employee),
        isHighlighted,
      })}
      draggable={canDrag}
      aria-label={label}
      aria-pressed={isSource}
      title={preview?.message ?? label}
      onClick={(event) => {
        event.stopPropagation()
        onActivateSlot(slot.id)
      }}
      onDragStart={(event) => {
        if (!assignment?.employeeId) return
        event.stopPropagation()
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', assignment.employeeId)
        onDragStart({ employeeId: assignment.employeeId, fromSlotId: slot.id })
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!isMoveActive) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOverSlot(slot.id)
      }}
      onDragEnter={() => {
        onDragOverSlot(slot.id)
      }}
      onDragLeave={(event) => {
        if (!leftDropTarget(event)) return
        onDragLeaveSlot(slot.id)
      }}
      onMouseEnter={() => {
        if (isMoveActive) onDragOverSlot(slot.id)
      }}
      onMouseLeave={() => onDragLeaveSlot(slot.id)}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDropAssignment(slot.id)
      }}
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-6 shrink-0 items-center justify-center rounded-sm border px-1 text-xs font-bold leading-none ${roleChipClasses[slot.role]}`}
      >
        {slotBadge(slot)}
      </span>
      <span className={`truncate text-sm ${primaryTone}${isGhosted ? ' italic opacity-80' : ''}`}>
        {primaryText}
        <span aria-hidden="true" className="ml-1 font-normal opacity-70">
          · {shortTimeRange(slot)}
        </span>
      </span>
      {!isMoveActive && isChanged && (
        <>
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 ring-2 ring-white" />
          <span className="sr-only">Changed since the schedule was made.</span>
        </>
      )}
      {!isMoveActive && status !== 'good' && status !== 'idle' && <Icon name={statusMeta[status].icon} />}
      {isMoveActive && !isSource && preview && <Icon name={preview.status === 'valid' ? 'check' : 'close'} />}
      {assignment?.locked && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-zinc-900 px-1.5 py-0.5 text-xs font-bold leading-none text-white [&>svg]:h-3 [&>svg]:w-3">
          <Icon name="lock" />
          <span aria-hidden="true">Keep</span>
          <span className="sr-only">Kept in place.</span>
        </span>
      )}
      <span className="sr-only">{`${slot.label} ${shortTimeRange(slot)}. ${statusMeta[status].shiftLabel}.`}</span>
    </button>
  )
}

function SlotEditor({
  slot,
  weekStart,
  status,
  activeMove,
  employees,
  allSlots,
  allAssignments,
  assignment,
  violations,
  dragOverSlotId,
  movePreview,
  dropFeedback,
  onAssign,
  onLock,
  onDragOverSlot,
  onDragLeaveSlot,
  onDropAssignment,
}: {
  slot: StaffingSlot
  weekStart: string
  status: SpotStatus
  activeMove: DragState | null
  employees: Employee[]
  allSlots: StaffingSlot[]
  allAssignments: ScheduleAssignment[]
  assignment?: ScheduleAssignment
  violations: ValidationViolation[]
  dragOverSlotId: string | null
  movePreview: MovePreview | null
  dropFeedback: string | null
  onAssign: (slotId: string, employeeId: string) => void
  onLock: (slotId: string, locked: boolean) => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (targetSlotId: string) => void
}) {
  const currentId = assignment?.employeeId ?? ''
  const eligibleEmployees = employees.filter(
    (employee) =>
      unassignableReason({ slot, employee, employees, slots: allSlots, assignments: allAssignments }) === null,
  )
  const otherEmployees = employees.filter((employee) => !eligibleEmployees.includes(employee))
  const currentReason = employees.find((employee) => employee.id === currentId)
    ? unassignableReason({
        slot,
        employee: employees.find((employee) => employee.id === currentId) as Employee,
        employees,
        slots: allSlots,
        assignments: allAssignments,
      })
    : null
  const showInvalidKept = Boolean(currentId && currentReason)
  const isSource = activeMove?.fromSlotId === slot.id
  const isDropTarget = dragOverSlotId === slot.id && Boolean(activeMove) && !isSource
  const panelTone =
    isDropTarget
      ? movePreview?.status === 'invalid'
        ? 'border-red-500 bg-red-50 ring-2 ring-red-200'
        : 'border-green-500 bg-green-50 ring-2 ring-green-200'
      : isSource
        ? 'border-dashed border-zinc-400 bg-zinc-50'
        : dropFeedback
          ? 'border-amber-400 bg-amber-50'
          : `bg-white ${statusMeta[status].row}`

  return (
    <div
      className={`rounded border p-3 transition duration-150 ${panelTone}`}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOverSlot(slot.id)
      }}
      onDragEnter={() => {
        onDragOverSlot(slot.id)
      }}
      onDragLeave={(event) => {
        if (!leftDropTarget(event)) return
        onDragLeaveSlot(slot.id)
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDropAssignment(slot.id)
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{slot.label}</div>
          <div className="text-xs text-zinc-500">{formatTimeRange(slot)}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${roleChipClasses[slot.role]}`}>
            <span aria-hidden="true" className="font-bold">
              {roleInitials[slot.role]}
            </span>
            {roleLabels[slot.role]}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${statusMeta[status].badge}`}>
            <Icon name={statusMeta[status].icon} />
            {statusMeta[status].shiftLabel}
          </span>
        </div>
      </div>
      <select
        className="mt-3 w-full rounded border border-zinc-300 bg-white px-2 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        value={assignment?.employeeId ?? ''}
        onChange={(event) => onAssign(slot.id, event.target.value)}
      >
        <option value="">Unassigned</option>
        {eligibleEmployees.length > 0 && (
          <optgroup label="Best choices — free and trained">
            {eligibleEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </optgroup>
        )}
        {otherEmployees.length > 0 && (
          <optgroup label="Other employees — needs a fix">
            {otherEmployees.map((employee) => {
              const reason = unassignableReason({ slot, employee, employees, slots: allSlots, assignments: allAssignments })
              const isCurrent = employee.id === currentId
              return (
                <option key={employee.id} value={employee.id} disabled={!isCurrent}>
                  {employee.name} — {reason}
                </option>
              )
            })}
          </optgroup>
        )}
      </select>
      {showInvalidKept && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-950" role="note">
          {employees.find((employee) => employee.id === currentId)?.name} is kept here but {currentReason}. Pick someone from
          Best choices to fix it.
        </p>
      )}
      <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
        <input
          type="checkbox"
          disabled={!assignment}
          checked={assignment?.locked ?? false}
          onChange={(event) => onLock(slot.id, event.target.checked)}
        />
        Keep this person here
      </label>
      {isDropTarget && movePreview && (
        <div
          className={`mt-2 rounded border bg-white px-2 py-1 text-xs font-medium ${
            movePreview.status === 'valid'
              ? 'border-green-300 text-green-900'
              : 'border-red-300 text-red-900'
          }`}
        >
          {movePreview.message}
        </div>
      )}
      {dropFeedback && (
        <div className="mt-2 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-950">
          {dropFeedback}
        </div>
      )}
      {violations.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs leading-4 text-amber-900">
          {violations.map((violation) => (
            <li key={`${slot.id}-${violation.code}-${violation.employeeId ?? ''}`}>
              {reviewLabel(violation, slot, employees.find((candidate) => candidate.id === violation.employeeId), weekStart, allSlots)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function assignmentChipClass({
    status,
    isMoveActive,
    isSource,
    isHovered,
    preview,
    wouldReplace,
    isHighlighted,
  }: {
    status: SpotStatus
    isMoveActive: boolean
    isSource: boolean
    isHovered: boolean
    preview: MovePreview | null
    wouldReplace: boolean
    isHighlighted: boolean
  },
) {
  const base =
    'flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded border px-1.5 py-1.5 text-left transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700' +
    (isHighlighted ? ' ring-2 ring-offset-1 ring-blue-500' : '')

  if (isSource) {
    return `${base} border-dashed border-zinc-400 bg-zinc-50 text-zinc-500 opacity-70`
  }

  if (isMoveActive && preview) {
    if (preview.status === 'invalid') {
      return `${base} border-dashed border-red-400 bg-red-50 text-red-900 ${isHovered ? 'ring-2 ring-red-400' : 'opacity-70'}`
    }
    // An empty spot is the one we most want the manager to notice.
    const emphasis = preview.isEmptyTarget ? 'ring-2 ring-green-400 shadow-sm' : 'ring-1 ring-green-200'
    const hovered = isHovered ? 'ring-4 ring-green-400 shadow-md' : emphasis
    const pulse = isHovered && wouldReplace ? ' animate-pulse' : ''
    return `${base} border-green-500 bg-green-50 text-green-950 ${hovered}${pulse}`
  }

  if (isMoveActive) {
    return `${base} border-zinc-200 bg-white text-zinc-500 opacity-70`
  }

  return `${base} ${statusMeta[status].chip}`
}

function leftDropTarget(event: React.DragEvent<HTMLElement>) {
  const nextTarget = event.relatedTarget
  return !(nextTarget instanceof Node && event.currentTarget.contains(nextTarget))
}

type IconName =
  | 'check'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'lock'
  | 'move'
  | 'plus'
  | 'print'
  | 'reset'
  | 'share'
  | 'spark'
  | 'target'
  | 'undo'
  | 'warning'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    check: <path d="M5 12l4 4L19 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronLeft: <path d="M15 6l-6 6 6 6" />,
    chevronRight: <path d="M9 6l6 6-6 6" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z" />,
    move: <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />,
    plus: <path d="M12 5v14M5 12h14" />,
    print: <path d="M7 8V4h10v4M7 17H5V9h14v8h-2M7 14h10v6H7z" />,
    reset: <path d="M4 12a8 8 0 1 0 2.3-5.7M4 5v5h5" />,
    share: <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M12 3v13M8 7l4-4 4 4" />,
    spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />,
    target: <path d="M12 2v4M12 18v4M2 12h4M18 12h4M7 12a5 5 0 1 0 10 0 5 5 0 0 0-10 0zM10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" />,
    undo: <path d="M9 14l-4-4 4-4M5 10h9a5 5 0 1 1 0 10h-1" />,
    warning: <path d="M12 9v4M12 17h.01M10.3 4.9L2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.9a2 2 0 0 0-3.4 0z" />,
  }

  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
