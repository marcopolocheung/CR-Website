import {
  DAYS,
  calculateScheduleStats,
  defaultTemplateForRestaurant,
  formatRoleLabel,
  formatTimeRange,
  isEmployeeAvailableForSlot,
  isEmployeeQualified,
  isSuspendedOn,
  isValidRoleSlug,
  minutes,
  rangesOverlap,
  rolesForRestaurant,
  shiftRoleFor,
  formatDayLabel,
  validateSchedule,
  type DayOfWeek,
  type Diagnostic,
  type Employee,
  type ScheduleAssignment,
  type ScheduleStats,
  type ScheduleStrategy,
  type ShiftPeriod,
  type StaffingSlot,
  type TimeRange,
  type ValidationViolation,
  type WeeklyStaffingTemplate,
  type WeekStatus,
  getEmployeeAvailability,
} from '../../lib/scheduler'
import type { IconName } from './ui'
export type EmployeeDraft = {
  name: string
  roles: Record<string, boolean>
  recurringAvailability: Employee['recurringAvailability']
  maxDaysPerWeek: number
  allowDoubles: boolean
  newHire: boolean
}

export type ShiftKey = `${DayOfWeek}-${ShiftPeriod}`

export type DragState = {
  employeeId: string
  fromSlotId: string
}

export type DropFeedback = {
  slotId: string
  message: string
} | null

export type HistorySnapshot = {
  label: string
  weekStart: string
  employees: Employee[]
  template: WeeklyStaffingTemplate
  weeks: WeekAssignments
  generatedWeeks: WeekAssignments
  weekStatus: Record<string, WeekStatus>
  diagnostics: string[]
}

export type WeekAssignments = Record<string, ScheduleAssignment[]>

export type GenerationReport = {
  id: number
  at: string
  variant: ScheduleVariant
  weekStart: string
  status: 'success' | 'unchanged' | 'failed'
  filled: number
  detail: string
}

export type StaffSnapshot = {
  id: string
  name: string
  savedAt: string
  employees: Employee[]
}

export function snapshotStorageKey(restaurantId?: string) {
  return `chinarose.scheduler.staffSnapshots.${restaurantId ?? 'default'}`
}

export function readStaffSnapshots(restaurantId?: string): StaffSnapshot[] {
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

export type ScheduleVariant = ScheduleStrategy

export type FixIssue = {
  id: string
  title: string
  detail: string
  slot?: StaffingSlot
  relatedSlot?: StaffingSlot
  employee?: Employee
}

export type MovePreview = {
  status: 'valid' | 'invalid'
  message: string
  employeeName: string
  replacedName?: string
  isEmptyTarget: boolean
}

export function roleLabel(role: string): string {
  return formatRoleLabel(role)
}

export const periodLabels: Record<ShiftPeriod, string> = {
  AM: 'Morning',
  PM: 'Dinner',
}

export const KNOWN_ROLE_CHIP_CLASSES: Record<string, string> = {
  lead: 'border-rose-200 bg-rose-50 text-rose-900',
  manager: 'border-violet-200 bg-violet-50 text-violet-900',
  server: 'border-sky-200 bg-sky-50 text-sky-900',
  cashier: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  cook: 'border-orange-200 bg-orange-50 text-orange-900',
  'line-cook': 'border-amber-200 bg-amber-50 text-amber-900',
  'fried-rice': 'border-yellow-200 bg-yellow-50 text-yellow-900',
  dishwasher: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  'meat-prep': 'border-rose-200 bg-rose-50 text-rose-900',
  'veggie-prep': 'border-lime-200 bg-lime-50 text-lime-900',
  'mv-prep': 'border-teal-200 bg-teal-50 text-teal-900',
  shadow: 'border-zinc-200 bg-zinc-50 text-zinc-700',
}

export const FALLBACK_CHIP_CLASSES = [
  'border-sky-200 bg-sky-50 text-sky-900',
  'border-emerald-200 bg-emerald-50 text-emerald-900',
  'border-violet-200 bg-violet-50 text-violet-900',
  'border-orange-200 bg-orange-50 text-orange-900',
  'border-teal-200 bg-teal-50 text-teal-900',
  'border-rose-200 bg-rose-50 text-rose-900',
]

export function roleChipClass(role: string): string {
  const known = KNOWN_ROLE_CHIP_CLASSES[role]
  if (known) return known
  let hash = 0
  for (let i = 0; i < role.length; i += 1) hash = (hash * 31 + role.charCodeAt(i)) >>> 0
  return FALLBACK_CHIP_CLASSES[hash % FALLBACK_CHIP_CLASSES.length]
}

export type SpotStatus = 'good' | 'review' | 'missing' | 'open' | 'idle'

export const statusMeta: Record<SpotStatus, { icon: IconName; chip: string; badge: string; row: string; shiftRow: string; shiftLabel: string }> = {
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
  open: {
    icon: 'plus',
    chip: 'border-dashed border-amber-300 bg-amber-50 text-amber-800',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
    row: 'border-amber-100 border-l-4 border-l-amber-300',
    shiftRow: 'border-l-4 border-l-amber-300 bg-amber-50',
    shiftLabel: 'Open (optional)',
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

export const KNOWN_ROLE_INITIALS: Record<string, string> = {
  server: 'S',
  cashier: 'C',
  lead: 'L',
  manager: 'M',
  cook: 'K',
  'line-cook': 'LC',
  'fried-rice': 'FR',
  dishwasher: 'D',
  'meat-prep': 'MP',
  'veggie-prep': 'VP',
  'mv-prep': 'MV',
  shadow: 'Sh',
}

export function roleInitial(role: string): string {
  const known = KNOWN_ROLE_INITIALS[role]
  if (known) return known
  const initials = role
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
  return initials || '?'
}

/** "Cashier 2" becomes C2, so the position fits in a badge and the name gets the room. */
export function slotBadge(slot: StaffingSlot) {
  const position = slot.label.match(/(\d+)$/)?.[1] ?? ''
  return `${roleInitial(slot.role)}${position}`
}

/** Compact shift time for chips: 9:30a-4p, 4-11p. Full range stays in the shift editor. */
export function shortHour(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const suffix = hour24 >= 12 ? 'p' : 'a'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return minute === 0 ? `${hour12}${suffix}` : `${hour12}:${String(minute).padStart(2, '0')}${suffix}`
}

export function shortTimeRange(slot: StaffingSlot) {
  return `${shortHour(slot.start)}-${shortHour(slot.end)}`
}

export function clampMaxDays(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(7, Math.max(1, Math.trunc(value)))
}

export function availabilitySummary(employee: Employee) {
  const daysAvailable = DAYS.filter((day) => (employee.recurringAvailability[day]?.length ?? 0) > 0)
  if (daysAvailable.length === 0) return 'No availability set'
  const ranges = daysAvailable.flatMap((day) => employee.recurringAvailability[day] ?? [])
  const uniqueRanges = new Set(ranges.map((range) => `${range.start}-${range.end}`))
  // Uniform custom hours (e.g. 12-7 every day) read clearer as exact times than "mixed hours".
  if (uniqueRanges.size === 1 && ranges.length > 0) {
    const only = ranges[0]
    const isStandard =
      (only.start === amShift.start && only.end === amShift.end) ||
      (only.start === pmShift.start && only.end === pmShift.end) ||
      (only.start === fullDay.start && only.end === fullDay.end)
    if (!isStandard) {
      const timeHint = formatTimeRange(only)
      if (daysAvailable.length === 7) return `Any day · ${timeHint}`
      const short = daysAvailable.map((day) => day.slice(0, 3)).join(', ')
      return `${short} · ${timeHint}`
    }
  }
  const morningsOnly = ranges.length > 0 && ranges.every((range) => range.end <= minutes(16))
  const dinnersOnly = ranges.length > 0 && ranges.every((range) => range.start >= minutes(16))
  const timeHint = morningsOnly ? 'mornings' : dinnersOnly ? 'dinners' : 'mixed hours'
  if (daysAvailable.length === 7) return `Any day · ${timeHint}`
  const short = daysAvailable.map((day) => day.slice(0, 3)).join(', ')
  return `${short} · ${timeHint}`
}

export function spotStatus({
  hasEmployee,
  hasSchedule,
  optional,
  violations,
}: {
  hasEmployee: boolean
  hasSchedule: boolean
  optional?: boolean
  violations: ValidationViolation[]
}): SpotStatus {
  if (!hasEmployee) return hasSchedule ? (optional ? 'open' : 'missing') : 'idle'
  if (violations.length > 0) return 'review'
  return 'good'
}

export function shiftStatus(statuses: SpotStatus[]): SpotStatus {
  if (statuses.includes('missing')) return 'missing'
  if (statuses.includes('review')) return 'review'
  if (statuses.includes('good')) return 'good'
  return 'idle'
}

export const fullDay = { start: minutes(9, 30), end: minutes(23) }

export const amShift = { start: minutes(9, 30), end: minutes(16) }

export const pmShift = { start: minutes(16), end: minutes(23) }

// Rogue / non-traditional shifts: extra coverage that spans or sits inside the standard halves.
// Mid 12-7 spans AM+PM (needs allowDoubles when split across two slots); evening 4-7 sits inside PM.
export const midShift = { start: minutes(12), end: minutes(19) }

export const eveningShift = { start: minutes(16), end: minutes(19) }

export const scheduleVariants: { id: ScheduleVariant; label: string; description: string }[] = [
  { id: 'balanced', label: 'Balanced', description: 'Spreads the work across everyone.' },
  { id: 'fewestDoubles', label: 'Fewest doubles', description: 'Avoids putting anyone on both shifts in one day.' },
  { id: 'similarWeek', label: 'Like last week', description: 'Keeps as much of the previous week as the rules allow.' },
  { id: 'fairHours', label: 'Similar hours for all', description: 'Evens out how many hours each person gets.' },
]

export function cloneTemplate(source?: WeeklyStaffingTemplate, restaurantId?: string): WeeklyStaffingTemplate {
  const base = source ?? defaultTemplateForRestaurant(restaurantId)
  return Object.fromEntries(DAYS.map((day) => [day, base[day].map((slot) => ({ ...slot }))])) as WeeklyStaffingTemplate
}

export function blankDraft(
  role: string = 'server',
  recurringAvailability: Employee['recurringAvailability'] = allDays([fullDay]),
  roles: string[] = rolesForRestaurant(),
): EmployeeDraft {
  return {
    name: '',
    roles: Object.fromEntries(roles.map((candidate) => [candidate, candidate === role])) as Record<string, boolean>,
    recurringAvailability,
    maxDaysPerWeek: 5,
    allowDoubles: false,
    newHire: false,
  }
}

/** Every post in play: page defaults plus any custom post already used by staff or rules. */
export function rolesInUse(employees: Employee[], template: WeeklyStaffingTemplate, restaurantId?: string): string[] {
  const seen = new Set<string>(rolesForRestaurant(restaurantId))
  for (const employee of employees) {
    for (const role of employee.roles) {
      if (isValidRoleSlug(role)) seen.add(role)
    }
  }
  for (const day of DAYS) {
    for (const slot of template[day] ?? []) {
      if (isValidRoleSlug(slot.role)) seen.add(slot.role)
    }
  }
  return [...seen]
}

export function allDays(ranges: TimeRange[]) {
  return Object.fromEntries(DAYS.map((day) => [day, ranges])) as Employee['recurringAvailability']
}

export function onlyDays(days: DayOfWeek[], ranges: TimeRange[]) {
  return Object.fromEntries(days.map((day) => [day, ranges])) as Employee['recurringAvailability']
}

export function gapAvailability(slot: StaffingSlot): Employee['recurringAvailability'] {
  return onlyDays([slot.day], [{ start: slot.start, end: slot.end }])
}

// The per-day AM/PM grid works in canonical shift halves, not arbitrary ranges:
// toggling a checkbox rewrites that day to [amShift]/[pmShift]/[fullDay]/[], and
// reading a day's checkbox state back is "does it overlap that half" so a slot-specific
// gap range (e.g. a 5pm start) still shows as PM-checked before it's ever touched.
export function dayAvailabilityFromRanges(ranges: TimeRange[] | undefined) {
  const list = ranges ?? []
  return {
    am: list.some((range) => rangesOverlap(range, amShift)),
    pm: list.some((range) => rangesOverlap(range, pmShift)),
  }
}

export function rangesForDayToggle(am: boolean, pm: boolean): TimeRange[] {
  if (am && pm) return [fullDay]
  if (am) return [amShift]
  if (pm) return [pmShift]
  return []
}

export function isCustomDayRanges(ranges: TimeRange[] | undefined) {
  const list = ranges ?? []
  if (list.length !== 1) return list.length > 1
  const only = list[0]
  const canonical =
    (only.start === amShift.start && only.end === amShift.end) ||
    (only.start === pmShift.start && only.end === pmShift.end) ||
    (only.start === fullDay.start && only.end === fullDay.end)
  return !canonical
}

export function clampAvailabilityRange(start: number, end: number): TimeRange | null {
  const dayStart = 0
  const dayEnd = minutes(23, 59)
  const safeStart = Math.min(dayEnd - 30, Math.max(dayStart, Math.trunc(start)))
  const safeEnd = Math.min(dayEnd, Math.max(safeStart + 30, Math.trunc(end)))
  if (!Number.isFinite(safeStart) || !Number.isFinite(safeEnd) || safeEnd <= safeStart) return null
  return { start: safeStart, end: safeEnd }
}

export const availabilityPresets: { label: string; build: () => Employee['recurringAvailability'] }[] = [
  { label: 'Any day, any shift', build: () => allDays([fullDay]) },
  { label: 'Morning shifts', build: () => allDays([amShift]) },
  { label: 'Dinner shifts', build: () => allDays([pmShift]) },
  { label: 'Midday 12-7', build: () => allDays([{ ...midShift }]) },
  { label: 'Evening 4-7', build: () => allDays([{ ...eveningShift }]) },
  { label: 'Weekday dinner shifts', build: () => onlyDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], [pmShift]) },
  { label: 'Saturday and Sunday', build: () => onlyDays(['Saturday', 'Sunday'], [fullDay]) },
]

export function createEmployeeId(name: string, employees: Employee[]) {
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

export function cloneEmployeeList(employees: Employee[]) {
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

export const emptyAssignments: ScheduleAssignment[] = []

export const UNDO_LIMIT = 30

export const onboardingStorageKey = 'chinarose.scheduler.onboardingDismissed'

export function readOnboardingDismissed() {
  try {
    return window.localStorage.getItem(onboardingStorageKey) === '1'
  } catch {
    return false
  }
}

export function statusForWeek(
  weekStatus: Record<string, WeekStatus>,
  weekStart: string,
  assignments: ScheduleAssignment[],
): WeekStatus {
  const explicit = weekStatus[weekStart]
  if (explicit) return explicit
  return assignments.length > 0 ? 'on' : 'off'
}

export function cloneWeeks(weeks: WeekAssignments): WeekAssignments {
  return Object.fromEntries(Object.entries(weeks).map(([week, assignments]) => [week, cloneAssignmentList(assignments)]))
}

export function cloneAssignmentList(assignments: ScheduleAssignment[]) {
  return assignments.map((assignment) => ({ ...assignment }))
}

export function uniqueMessages(messages: string[]) {
  return Array.from(new Set(messages))
}

export function assignmentFingerprint(list: ScheduleAssignment[]) {
  return list
    .filter((assignment) => assignment.employeeId)
    .map((assignment) => `${assignment.slotId}:${assignment.employeeId}`)
    .sort()
    .join('|')
}

export function formatReportTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function overlapMinutes(a: StaffingSlot, b: StaffingSlot) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
}

export function formatOverlapDuration(totalMinutes: number) {
  if (totalMinutes <= 0) return 'moments'
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours === 0) return `${mins} minute${mins === 1 ? '' : 's'}`
  if (mins === 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${hours} hour${hours === 1 ? '' : 's'} ${mins} minutes`
}

export function availabilityText(employee: Employee, day: DayOfWeek) {
  const ranges = getEmployeeAvailability(employee, day)
  if (ranges.length === 0) return `has no ${day} availability at all`
  return `${day} availability is ${ranges.map((range) => formatTimeRange(range)).join(', ')}`
}

export function suspensionText(employee: Employee) {
  const until = employee.suspendedUntil ?? employee.suspendedFrom
  return until === employee.suspendedFrom ? `on ${employee.suspendedFrom}` : `${employee.suspendedFrom} to ${until}`
}

export function trainedRolesText(employee: Employee) {
  if (employee.roles.length === 0) return 'nothing yet'
  return employee.roles.map((role) => roleLabel(role)).join(', ')
}

export function notTrainedText(employee: Employee, slot: StaffingSlot) {
  const onlyRole = shiftRoleFor(employee, slot.day, slot.period)
  if (onlyRole && onlyRole !== slot.role) return `${employee.name} only works ${roleLabel(onlyRole)} on ${slot.day} ${periodLabels[slot.period]}.`
  return `${employee.name} is not trained for ${slot.label} — trained for ${trainedRolesText(employee)}.`
}

export function diagnosticLabel(diagnostic: Diagnostic, weekStart: string) {
  const day = diagnostic.day && weekStart ? formatDayLabel(weekStart, diagnostic.day) : diagnostic.day
  const where = day && diagnostic.period ? `${day} ${periodLabels[diagnostic.period]}` : null
  const role = diagnostic.role ? roleLabel(diagnostic.role) : null

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

export function dragErrorMessage(employee: Employee, slot: StaffingSlot, violations: ValidationViolation[], weekStart: string, slots: StaffingSlot[]) {
  const day = weekStart ? formatDayLabel(weekStart, slot.day) : slot.day
  const first = violations[0]
  if (!first) return `${employee.name} cannot work ${day} ${periodLabels[slot.period]}.`

  if (first.code === 'unqualified_employee') return notTrainedText(employee, slot)
  if (first.code === 'unavailable_employee' && isSuspendedOn(employee, slot.date)) return `${employee.name} is suspended ${suspensionText(employee)}.`
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

export function proposeMovedAssignments(
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

export function buildMovePreview({
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

export function reviewLabel(
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
  if (violation.code === 'unqualified_employee') return employee && slot ? notTrainedText(employee, slot) : `${name} is not trained for ${position}.`
  if (violation.code === 'unavailable_employee') {
    if (!slot || !employee) return `${name} cannot work ${shift}.`
    if (isSuspendedOn(employee, slot.date)) return `${name} is suspended ${suspensionText(employee)}.`
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

export type ScheduleChange = {
  slotId: string
  shiftKey: ShiftKey
  text: string
}

export function changesSince(
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

export function fixAdvice(code: string) {
  if (code === 'missing_assignment') return 'Pick someone for this spot, or add a new employee with the right role and availability.'
  if (code === 'unavailable_employee') return 'Pick someone free then — check availability in the staff list.'
  if (code === 'unqualified_employee') return 'Pick someone trained for this position, or add the role to them in the staff list.'
  if (code === 'inactive_employee') return 'Turn them back on in the staff list, or pick someone else.'
  if (code === 'overlapping_assignment') return 'Move one of the two shifts to someone else. If the overlap comes from shift times (like the Friday manager starting at 3pm while mornings end at 4pm), adjusting the times in the rules fixes it for everyone.'
  if (code === 'max_days_exceeded') return 'Move a shift to someone else, or raise the weekly day limit in the staff list.'
  if (code === 'max_shifts_exceeded') return 'Move a shift to someone else, or raise the weekly shift limit in the staff list.'
  if (code === 'prohibited_double') return 'Give one of the two shifts to someone else, or allow doubles for them in the staff list.'
  if (code === 'max_doubles_exceeded') return 'Give one of their double shifts to someone else, or raise their double limit in the staff list.'
  if (code === 'incompatible_pair') return 'These two should not work the same shift. Move one of them.'
  if (code === 'locked_assignment_changed') return 'A spot you marked Keep changed. Confirm it still works.'
  if (code === 'search_exhausted') return 'Add availability, add staff, or loosen a limit — then make the schedule again.'
  if (code === 'invalid_locked_assignment') return 'Release the Keep mark, or fix that person’s availability, role, or limits.'
  if (code.startsWith('no_')) return 'Add someone with that role and availability, or turn an inactive person back on.'
  if (code.startsWith('insufficient_')) return 'Add staff or availability for that shift, or remove a spot from the rules.'
  return 'Nobody on the list can cover this. Add someone, or turn an inactive person back on.'
}

export function candidatesForSlot({
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
export function unassignableReason({
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
  const onlyRole = shiftRoleFor(employee, slot.day, slot.period)
  if (onlyRole && onlyRole !== slot.role) return `only ${roleLabel(onlyRole)} that shift`
  if (!isEmployeeQualified(employee, slot)) return 'not trained'
  if (isSuspendedOn(employee, slot.date)) return 'suspended'
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

export function buildFixIssues(
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
