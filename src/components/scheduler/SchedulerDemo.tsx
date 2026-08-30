'use client'

import { useEffect, useMemo, useState } from 'react'
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
  schedulerAssumptions,
  seedEmployees,
  seedTemplate,
  summarizeSchedule,
  validateSchedule,
  type DayOfWeek,
  type Diagnostic,
  type Employee,
  type Role,
  type ScheduleAssignment,
  type ScheduleStats,
  type ScheduleStrategy,
  type ShiftPeriod,
  type StaffingSlot,
  type TimeRange,
  type ValidationViolation,
} from '@/lib/scheduler'

type AvailabilityMode = 'all' | 'am' | 'pm' | 'weekdayPm' | 'weekend' | 'gap'

type EmployeeDraft = {
  name: string
  roles: Record<Role, boolean>
  availabilityMode: AvailabilityMode
  maxDaysPerWeek: number
  allowDoubles: boolean
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
  employees: Employee[]
  assignments: ScheduleAssignment[]
  generatedAssignments: ScheduleAssignment[]
  diagnostics: string[]
}

type ScheduleVariant = ScheduleStrategy

type FixIssue = {
  id: string
  title: string
  detail: string
  slot?: StaffingSlot
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
    chip: 'border-zinc-200 bg-white text-zinc-900',
    badge: 'border-green-300 bg-green-50 text-green-900',
    row: 'border-zinc-200 border-l-4 border-l-green-600',
    shiftRow: 'border-l-4 border-l-transparent bg-zinc-50',
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
    chip: 'border-dashed border-zinc-300 bg-white text-zinc-500',
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
  { id: 'similarWeek', label: 'Keep this week similar', description: 'Changes as little as possible from what is on screen now.', icon: 'lock' },
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

function blankDraft(role: Role = 'server', availabilityMode: AvailabilityMode = 'all'): EmployeeDraft {
  return {
    name: '',
    roles: Object.fromEntries(ROLES.map((candidate) => [candidate, candidate === role])) as Record<Role, boolean>,
    availabilityMode,
    maxDaysPerWeek: 5,
    allowDoubles: false,
  }
}

function allDays(ranges: TimeRange[]) {
  return Object.fromEntries(DAYS.map((day) => [day, ranges])) as Employee['recurringAvailability']
}

function onlyDays(days: DayOfWeek[], ranges: TimeRange[]) {
  return Object.fromEntries(days.map((day) => [day, ranges])) as Employee['recurringAvailability']
}

function availabilityFromDraft(draft: EmployeeDraft, gapSlot?: StaffingSlot): Employee['recurringAvailability'] {
  if (draft.availabilityMode === 'gap' && gapSlot) {
    return onlyDays([gapSlot.day], [{ start: gapSlot.start, end: gapSlot.end }])
  }

  if (draft.availabilityMode === 'am') return allDays([amShift])
  if (draft.availabilityMode === 'pm') return allDays([pmShift])
  if (draft.availabilityMode === 'weekdayPm') {
    return onlyDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], [pmShift])
  }
  if (draft.availabilityMode === 'weekend') return onlyDays(['Saturday', 'Sunday'], [fullDay])
  return allDays([fullDay])
}

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

function cloneAssignmentList(assignments: ScheduleAssignment[]) {
  return assignments.map((assignment) => ({ ...assignment }))
}

function uniqueMessages(messages: string[]) {
  return Array.from(new Set(messages))
}

function diagnosticLabel(diagnostic: Diagnostic) {
  const where = diagnostic.day && diagnostic.period ? `${diagnostic.day} ${periodLabels[diagnostic.period]}` : null
  const role = diagnostic.role ? roleLabels[diagnostic.role] : null

  if (diagnostic.code === 'search_exhausted') {
    return 'There is no way to fill every spot with the people and rules you have now.'
  }
  if (diagnostic.code === 'invalid_locked_assignment') {
    return where ? `The person you kept on ${where} no longer fits the rules.` : 'A spot you marked Keep no longer fits the rules.'
  }
  if (where && role && diagnostic.code.startsWith('no_')) {
    return `${where} has nobody who can work as ${role}.`
  }
  if (where && role && diagnostic.code.startsWith('insufficient_')) {
    return `${where} needs more ${role} cover than the staff list can give.`
  }
  if (where && diagnostic.code === 'insufficient_shift_capacity') {
    return `${where} does not have enough people available.`
  }
  if (where && role) {
    return `${where} needs ${role} cover.`
  }

  return diagnostic.message
}

function dragErrorMessage(employee: Employee, slot: StaffingSlot, violations: ValidationViolation[]) {
  const first = violations[0]
  if (!first) return `${employee.name} cannot work ${slot.day} ${periodLabels[slot.period]}.`

  if (first.code === 'unqualified_employee') return `${employee.name} is not set up for ${slot.label}.`
  if (first.code === 'unavailable_employee') return `${employee.name} cannot work ${slot.day} ${periodLabels[slot.period]}.`
  if (first.code === 'inactive_employee') return `${employee.name} is inactive.`
  if (first.code === 'overlapping_assignment') return `${employee.name} is already working at that time.`
  if (first.code === 'max_days_exceeded') return `${employee.name} would go over the weekly day limit.`
  if (first.code === 'max_shifts_exceeded') return `${employee.name} would go over the weekly shift limit.`
  if (first.code === 'prohibited_double') return `${employee.name} cannot work both shifts that day.`
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
}: {
  move: DragState
  targetSlotId: string
  employees: Employee[]
  slots: StaffingSlot[]
  assignments: ScheduleAssignment[]
  assignmentMap: Map<string, ScheduleAssignment>
}): MovePreview | null {
  if (move.fromSlotId === targetSlotId) return null
  const targetSlot = slots.find((slot) => slot.id === targetSlotId)
  const employee = employees.find((candidate) => candidate.id === move.employeeId)
  if (!targetSlot || !employee) return null

  const targetAssignment = assignmentMap.get(targetSlotId)
  const replacedEmployee = employees.find((candidate) => candidate.id === targetAssignment?.employeeId)
  const isEmptyTarget = !targetAssignment?.employeeId

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
      message: dragErrorMessage(employee, targetSlot, moveViolations),
    }
  }

  return {
    status: 'valid',
    employeeName: employee.name,
    replacedName: replacedEmployee?.name,
    isEmptyTarget,
    message: replacedEmployee
      ? `${employee.name} would replace ${replacedEmployee.name}.`
      : `${employee.name} fits here.`,
  }
}

function reviewLabel(violation: ValidationViolation, slot?: StaffingSlot, employee?: Employee) {
  const shift = slot ? `${slot.day} ${periodLabels[slot.period]}` : 'This schedule'
  const position = slot?.label ?? 'this spot'
  const name = employee?.name ?? 'Someone'

  if (violation.code === 'missing_assignment') return `${shift} needs ${position}.`
  if (violation.code === 'unqualified_employee') return `${name} is not set up for ${position}.`
  if (violation.code === 'unavailable_employee') return `${name} cannot work ${shift}.`
  if (violation.code === 'inactive_employee') return `${name} is inactive.`
  if (violation.code === 'overlapping_assignment') return `${name} is already working at that time.`
  if (violation.code === 'max_days_exceeded') return `${name} has too many work days.`
  if (violation.code === 'max_shifts_exceeded') return `${name} has too many shifts.`
  if (violation.code === 'prohibited_double') return `${name} cannot work both shifts that day.`
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
): ScheduleChange[] {
  if (generated.length === 0) return []
  const generatedBySlot = new Map(generated.map((assignment) => [assignment.slotId, assignment.employeeId]))
  const currentBySlot = new Map(current.map((assignment) => [assignment.slotId, assignment.employeeId]))
  const nameFor = (employeeId?: string) => employees.find((employee) => employee.id === employeeId)?.name

  return slots.flatMap((slot) => {
    const before = nameFor(generatedBySlot.get(slot.id))
    const after = nameFor(currentBySlot.get(slot.id))
    if (before === after) return []
    const where = `${slot.day} ${periodLabels[slot.period]} ${slot.label}`
    const text = before && after ? `${where}: ${before} to ${after}` : after ? `${where}: ${after} added` : `${where}: ${before} removed`

    return [{ slotId: slot.id, shiftKey: `${slot.day}-${slot.period}` as ShiftKey, text }]
  })
}

function fixAdvice(code: string) {
  if (code === 'missing_assignment') return 'Pick someone for this spot, or add a new employee.'
  if (code === 'unavailable_employee') return 'They are not free then. Pick someone else for this spot.'
  if (code === 'unqualified_employee') return 'Pick someone trained for this position.'
  if (code === 'inactive_employee') return 'They are off the list. Pick someone else, or turn them back on.'
  if (code === 'overlapping_assignment') return 'They are in two places at once. Move one of the two.'
  if (code === 'max_days_exceeded') return 'Give this shift to someone else, or raise their weekly day limit.'
  if (code === 'max_shifts_exceeded') return 'Give this shift to someone else, or raise their weekly shift limit.'
  if (code === 'prohibited_double') return 'Pick someone else for one of the two shifts that day.'
  if (code === 'incompatible_pair') return 'These two should not work the same shift. Move one of them.'
  if (code === 'locked_assignment_changed') return 'A spot you marked Keep changed. Confirm it still works.'
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

function buildFixIssues(
  readinessProblems: Diagnostic[],
  violations: ValidationViolation[],
  slots: StaffingSlot[],
  employees: Employee[],
) {
  const issues: FixIssue[] = []

  for (const problem of readinessProblems) {
    const slot = problem.slotId
      ? slots.find((candidate) => candidate.id === problem.slotId)
      : slots.find((candidate) => candidate.day === problem.day && candidate.period === problem.period && candidate.role === problem.role)
    issues.push({
      id: `ready:${problem.code}:${problem.slotId ?? problem.day ?? ''}:${problem.period ?? ''}:${problem.role ?? ''}`,
      title: diagnosticLabel(problem),
      detail: fixAdvice(problem.code),
      slot,
    })
  }

  for (const violation of violations) {
    const slot = slots.find((candidate) => candidate.id === violation.slotId)
    const employee = employees.find((candidate) => candidate.id === violation.employeeId)
    issues.push({
      id: `review:${violation.code}:${violation.slotId ?? ''}:${violation.employeeId ?? ''}:${violation.message}`,
      title: reviewLabel(violation, slot, employee),
      detail: fixAdvice(violation.code),
      slot,
      employee,
    })
  }

  return issues
}

export default function SchedulerDemo() {
  const [employees, setEmployees] = useState<Employee[]>(cloneEmployees)
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([])
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  const [draft, setDraft] = useState<EmployeeDraft>(() => blankDraft())
  const [employeePanelOpen, setEmployeePanelOpen] = useState(false)
  const [openShiftKey, setOpenShiftKey] = useState<ShiftKey | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [moveSource, setMoveSource] = useState<DragState | null>(null)
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null)
  const [dropFeedback, setDropFeedback] = useState<DropFeedback>(null)
  const [history, setHistory] = useState<HistorySnapshot[]>([])
  const [generatedAssignments, setGeneratedAssignments] = useState<ScheduleAssignment[]>([])
  const [ignoredIssueIds, setIgnoredIssueIds] = useState<string[]>([])
  const [guidedChoosing, setGuidedChoosing] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<ScheduleVariant>('balanced')
  const slots = useMemo(() => expandTemplate(seedTemplate), [])
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
      const preview = buildMovePreview({ move: activeMove, targetSlotId: slot.id, employees, slots, assignments, assignmentMap })
      if (preview) previews.set(slot.id, preview)
    }
    return previews
  }, [activeMove, assignmentMap, assignments, employees, slots])
  const movingEmployee = employees.find((employee) => employee.id === moveSource?.employeeId)

  const fixIssues = useMemo(
    () => buildFixIssues(readinessProblems, violations, slots, employees),
    [employees, readinessProblems, slots, violations],
  )
  const visibleFixIssues = fixIssues.filter((issue) => !ignoredIssueIds.includes(issue.id))
  const nextIssue = visibleFixIssues[0]
  const changes = useMemo(
    () => changesSince(generatedAssignments, assignments, slots, employees),
    [assignments, employees, generatedAssignments, slots],
  )
  const changedSlotIds = useMemo(() => new Set(changes.map((change) => change.slotId)), [changes])
  const fixCandidates = useMemo(
    () =>
      nextIssue?.slot
        ? candidatesForSlot({ slot: nextIssue.slot, employees, slots, assignments })
        : [],
    [assignments, employees, nextIssue, slots],
  )
  const ignoredCount = fixIssues.filter((issue) => ignoredIssueIds.includes(issue.id)).length
  const activeEmployeeCount = employees.filter((employee) => employee.active).length
  const schedulePassing = assignments.length > 0 && violations.length === 0
  const selectedRoles = ROLES.filter((role) => draft.roles[role])
  const canAddEmployee = draft.name.trim().length > 0 && selectedRoles.length > 0

  useEffect(() => {
    if (!moveSource) return
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoveSource(null)
    }
    window.addEventListener('keydown', cancelOnEscape)
    return () => window.removeEventListener('keydown', cancelOnEscape)
  }, [moveSource])

  function remember(label: string) {
    setHistory((current) => [
      {
        label,
        employees: cloneEmployeeList(employees),
        assignments: cloneAssignmentList(assignments),
        generatedAssignments: cloneAssignmentList(generatedAssignments),
        diagnostics: [...diagnostics],
      },
      ...current.slice(0, 5),
    ])
  }

  function undoLastChange() {
    const [snapshot, ...rest] = history
    if (!snapshot) return
    setEmployees(cloneEmployeeList(snapshot.employees))
    setAssignments(cloneAssignmentList(snapshot.assignments))
    setGeneratedAssignments(cloneAssignmentList(snapshot.generatedAssignments))
    setDiagnostics([`Undone: ${snapshot.label}.`])
    setHistory(rest)
    setDropFeedback(null)
    setDragState(null)
    setDragOverSlotId(null)
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
      setDraft(blankDraft(slot.role, 'gap'))
      setOpenShiftKey(`${slot.day}-${slot.period}`)
    } else if (firstGap?.role) {
      setDraft(blankDraft(firstGap.role, 'gap'))
    } else {
      setDraft(blankDraft())
    }
    setEmployeePanelOpen(true)
  }

  function fixNextIssue() {
    if (!nextIssue) return
    setGuidedChoosing(true)
    openSlot(nextIssue.slot?.id)
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

  function generate(variant: ScheduleVariant = selectedVariant) {
    remember('previous schedule')
    setSelectedVariant(variant)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    const previousAssignments = assignments
    const result = generateSchedule(
      { employees, template: seedTemplate },
      {
        strategy: variant,
        referenceAssignments: previousAssignments,
        existingAssignments: assignments.filter((assignment) => assignment.locked),
      },
    )

    if (result.status === 'INFEASIBLE') {
      setDiagnostics([
        'The schedule could not be made with these rules.',
        ...uniqueMessages(result.diagnostics.map(diagnosticLabel)),
      ])
      return
    }

    const summary = summarizeSchedule(employees, slots, result.assignments, previousAssignments)
    setDiagnostics([
      generationMessage(variant, summary, previousAssignments.length || result.assignments.length),
      ...uniqueMessages(result.diagnostics.map(diagnosticLabel)),
    ])
    setAssignments(result.assignments)
    setGeneratedAssignments(cloneAssignmentList(result.assignments))
  }

  function reset() {
    remember('reset demo')
    setEmployees(cloneEmployees())
    setAssignments([])
    setGeneratedAssignments([])
    setDiagnostics([])
    setDraft(blankDraft())
    setEmployeePanelOpen(false)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setSelectedVariant('balanced')
  }

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

  function openEmployeePanelForGap() {
    addEmployeeForSlot(gapSlot)
  }

  function addEmployee() {
    if (!canAddEmployee) return
    remember('added employee')
    const employee: Employee = {
      id: createEmployeeId(draft.name, employees),
      name: draft.name.trim(),
      roles: selectedRoles,
      recurringAvailability: availabilityFromDraft(draft, gapSlot),
      maxDaysPerWeek: draft.maxDaysPerWeek,
      allowDoubles: draft.allowDoubles,
      incompatibleEmployeeIds: [],
      active: true,
    }

    setEmployees((current) => [...current, employee])
    setDraft(blankDraft(firstGap?.role ?? selectedRoles[0], firstGap ? 'gap' : 'all'))
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
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Scheduler demo</p>
            <h1 className="text-2xl font-bold md:text-3xl">Weekly staff schedule</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button tone="primary" onClick={() => generate()} icon="spark">
              Make schedule
            </Button>
            <Button onClick={fixNextIssue} icon="target" disabled={!nextIssue} badge={visibleFixIssues.length}>
              Fix next issue
            </Button>
            <span aria-hidden="true" className="mx-1 hidden h-8 w-px bg-zinc-200 sm:block" />
            <IconButton
              icon="undo"
              label={history[0] ? `Undo ${history[0].label}` : 'Undo last change'}
              onClick={undoLastChange}
              disabled={history.length === 0}
            />
            <IconButton icon="plus" label="Add employee" onClick={openEmployeePanelForGap} />
            <IconButton icon="print" label="Print schedule" onClick={() => window.print()} />
            <IconButton icon="reset" label="Start over" onClick={reset} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-5 px-4 py-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="order-1 space-y-4">
          <GuidedFixPanel
            nextIssue={nextIssue}
            issueCount={visibleFixIssues.length}
            ignoredCount={ignoredCount}
            candidates={fixCandidates}
            choosing={guidedChoosing}
            hasSchedule={assignments.length > 0}
            onChooseEmployee={fixNextIssue}
            onPickEmployee={chooseForIssue}
            onAddEmployee={() => addEmployeeForSlot(nextIssue?.slot)}
            onIgnore={ignoreNextIssue}
            onShowIgnored={showIgnoredIssues}
          />

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-lg font-semibold">This week</h2>
              <p className="text-sm text-zinc-600">Click a name to move it, then click where it goes. Dragging works too.</p>
            </div>

            {movingEmployee && (
              <div
                className="mt-3 flex flex-col gap-2 rounded border border-green-300 bg-green-50 p-3 sm:flex-row sm:items-center sm:justify-between"
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
            <WeeklyScheduleBoard
              slots={slots}
              hasSchedule={assignments.length > 0}
              employees={employees}
              assignmentMap={assignmentMap}
              violations={violations}
              openShiftKey={openShiftKey}
              activeMove={activeMove}
              changedSlotIds={changedSlotIds}
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
            <VariantControls selectedVariant={selectedVariant} onGenerate={generate} />
          </section>

          {changes.length > 0 && (
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
          )}

          {diagnostics.length > 0 && (
            <Disclosure summary={`Messages (${diagnostics.length})`}>
              <ul className="space-y-1 text-sm text-zinc-700">
                {diagnostics.map((message, index) => (
                  <li key={`${message}-${index}`}>{message}</li>
                ))}
              </ul>
            </Disclosure>
          )}

          <Disclosure summary="Hours for each person">
            <HoursSummary stats={stats} />
          </Disclosure>

          <ScheduleRules slots={slots} />

          <Disclosure summary="About this demo">
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
        </main>

        <aside className="order-2 space-y-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Staff</h2>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {activeEmployeeCount} working, {employees.length - activeEmployeeCount} off the list
                </p>
              </div>
              <IconButton
                icon={employeePanelOpen ? 'close' : 'plus'}
                label={employeePanelOpen ? 'Close employee form' : 'Add employee'}
                tone="accent"
                onClick={() => setEmployeePanelOpen((open) => !open)}
              />
            </div>

            {employeePanelOpen && (
              <EmployeeForm
                draft={draft}
                gapSlot={gapSlot}
                canAddEmployee={canAddEmployee}
                onDraftChange={setDraft}
                onAdd={addEmployee}
              />
            )}

            <details className="mt-3 border-t border-zinc-100 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800">Everyone on the list</summary>
              <div className="mt-3 space-y-3">
                {employees.map((employee) => (
                  <EmployeeCard key={employee.id} employee={employee} onUpdate={updateEmployee} />
                ))}
              </div>
            </details>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Before you print</h2>
            <div className="mt-3 space-y-2">
              <ChecklistItem complete={activeEmployeeCount > 0} label={`${activeEmployeeCount} people ready to work`} />
              <ChecklistItem
                complete={readinessProblems.length === 0}
                label={
                  readinessProblems.length === 0
                    ? 'Every shift can be covered'
                    : `${readinessProblems.length} shift${readinessProblems.length === 1 ? '' : 's'} nobody can cover`
                }
              />
              <ChecklistItem complete={schedulePassing} label={schedulePassing ? 'Nothing left to fix' : 'Some spots still need fixing'} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function EmployeeForm({
  draft,
  gapSlot,
  canAddEmployee,
  onDraftChange,
  onAdd,
}: {
  draft: EmployeeDraft
  gapSlot?: StaffingSlot
  canAddEmployee: boolean
  onDraftChange: (draft: EmployeeDraft) => void
  onAdd: () => void
}) {
  return (
    <div className="mt-4 rounded border border-red-100 bg-red-50 p-3">
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

      <label className="mt-3 block text-sm font-medium text-zinc-800">
        Availability
        <select
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          value={draft.availabilityMode === 'gap' && !gapSlot ? 'all' : draft.availabilityMode}
          onChange={(event) => onDraftChange({ ...draft, availabilityMode: event.target.value as AvailabilityMode })}
        >
          <option value="all">Any day, any shift</option>
          <option value="am">Morning shifts</option>
          <option value="pm">Dinner shifts</option>
          <option value="weekdayPm">Weekday dinner shifts</option>
          <option value="weekend">Saturday and Sunday</option>
          {(gapSlot || draft.availabilityMode === 'gap') && (
            <option value="gap">
              {gapSlot ? `${gapSlot.day} ${periodLabels[gapSlot.period]} only` : 'Coverage gap only'}
            </option>
          )}
        </select>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-zinc-800">
          Max days
          <input
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            min={1}
            max={7}
            type="number"
            value={draft.maxDaysPerWeek}
            onChange={(event) => onDraftChange({ ...draft, maxDaysPerWeek: Number(event.target.value) })}
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

      <button
        type="button"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        disabled={!canAddEmployee}
        onClick={onAdd}
      >
        <Icon name="plus" />
        Save employee
      </button>
    </div>
  )
}

function EmployeeCard({ employee, onUpdate }: { employee: Employee; onUpdate: (employeeId: string, update: Partial<Employee>) => void }) {
  function toggleRole(role: Role, enabled: boolean) {
    const roles = enabled ? [...employee.roles, role] : employee.roles.filter((candidate) => candidate !== role)
    onUpdate(employee.id, { roles: ROLES.filter((candidate) => roles.includes(candidate)) })
  }

  return (
    <div className="rounded border border-zinc-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-950">{employee.name}</div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={employee.active}
            onChange={(event) => onUpdate(employee.id, { active: event.target.checked })}
          />
          Working
        </label>
      </div>

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

      {employee.roles.length === 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
          <Icon name="warning" />
          No positions picked, so {employee.name} cannot be scheduled.
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm text-zinc-700">
          Max days
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            min={1}
            max={7}
            type="number"
            value={employee.maxDaysPerWeek ?? 7}
            onChange={(event) => onUpdate(employee.id, { maxDaysPerWeek: Number(event.target.value) })}
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
    </div>
  )
}

function GuidedFixPanel({
  nextIssue,
  issueCount,
  ignoredCount,
  candidates,
  choosing,
  hasSchedule,
  onChooseEmployee,
  onPickEmployee,
  onAddEmployee,
  onIgnore,
  onShowIgnored,
}: {
  nextIssue?: FixIssue
  issueCount: number
  ignoredCount: number
  candidates: Employee[]
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
      <section className="rounded-lg border border-green-300 bg-green-50 p-4 shadow-sm">
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

  return (
    <section className="rounded-lg border border-amber-400 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {issueCount} spot{issueCount === 1 ? '' : 's'} need fixing
            {ignoredCount > 0 && ` · ${ignoredCount} skipped`}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-amber-950">{nextIssue.title}</h2>
          <p className="mt-1 text-sm text-amber-900">{nextIssue.detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={onChooseEmployee} icon="target" disabled={!nextIssue.slot}>
            Choose employee
          </Button>
          <Button onClick={onAddEmployee} icon="plus">
            Add employee
          </Button>
          <Button onClick={onIgnore} icon="close">
            Ignore for now
          </Button>
        </div>
      </div>

      {choosing && nextIssue.slot && (
        <div className="mt-4 rounded border border-amber-300 bg-white p-3">
          {candidates.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-zinc-900">
                Who should work {nextIssue.slot.day} {periodLabels[nextIssue.slot.period]} as {nextIssue.slot.label}?
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
            </>
          ) : (
            <p className="text-sm text-zinc-700">
              Nobody on the list is free and trained for this spot. Add someone, or open the shift below to override it.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function VariantControls({
  selectedVariant,
  onGenerate,
}: {
  selectedVariant: ScheduleVariant
  onGenerate: (variant: ScheduleVariant) => void
}) {
  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <p className="text-sm text-zinc-600">Other ways to build this week. Anyone marked Keep stays put.</p>
      <div className="mt-2 flex flex-wrap gap-2">
      {scheduleVariants.map((variant) => (
        <button
          key={variant.id}
          type="button"
          className={`inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
            selectedVariant === variant.id
              ? 'border-red-800 bg-red-800 text-white'
              : 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100'
          }`}
          onClick={() => onGenerate(variant.id)}
          title={variant.description}
        >
          <Icon name={variant.icon} />
          {variant.label}
        </button>
      ))}
      </div>
    </div>
  )
}

function HoursSummary({ stats }: { stats: ScheduleStats[] }) {
  const working = stats.filter((stat) => stat.shifts > 0)
  if (working.length === 0) {
    return <p className="text-sm text-zinc-600">Make a schedule to see how the hours land.</p>
  }

  const mostHours = Math.max(...working.map((stat) => stat.hours))
  const idle = stats.filter((stat) => stat.shifts === 0)

  return (
    <div>
      <ul className="divide-y divide-zinc-100">
        {working.map((stat) => (
          <li key={stat.employeeId} className="flex items-center gap-3 py-1.5 text-sm">
            <span className="w-24 shrink-0 truncate font-medium text-zinc-900">{stat.name}</span>
            <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 rounded-full bg-zinc-100">
              <span
                className="block h-full rounded-full bg-zinc-400"
                style={{ width: `${Math.round((stat.hours / mostHours) * 100)}%` }}
              />
            </span>
            <span className="w-14 shrink-0 text-right font-semibold text-zinc-900">{stat.hours.toFixed(1)}h</span>
            <span className="w-20 shrink-0 text-right text-xs text-zinc-500">
              {stat.days}d · {stat.shifts} shift{stat.shifts === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
      {idle.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">
          Not working this week: {idle.map((stat) => stat.name).join(', ')}
        </p>
      )}
    </div>
  )
}

function ScheduleRules({ slots }: { slots: StaffingSlot[] }) {
  return (
    <Disclosure summary="Schedule rules">
      <p className="text-sm text-zinc-600">Who the restaurant needs on each shift. The schedule maker follows this list.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="py-2 pr-3">Day</th>
              <th className="py-2 pr-3">Shift</th>
              <th className="py-2 pr-3">Position</th>
              <th className="py-2 pr-3">Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {slots.map((slot) => (
              <tr key={slot.id}>
                <td className="py-2 pr-3 font-medium text-zinc-900">{slot.day}</td>
                <td className="py-2 pr-3 text-zinc-700">{periodLabels[slot.period]}</td>
                <td className="py-2 pr-3 text-zinc-700">{slot.label}</td>
                <td className="py-2 pr-3 text-zinc-700">{formatTimeRange(slot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
}: {
  children: React.ReactNode
  icon: IconName
  tone?: 'plain' | 'primary'
  badge?: number
  onClick: () => void
  disabled?: boolean
}) {
  const className =
    tone === 'primary'
      ? 'inline-flex items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'
      : 'inline-flex items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
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

function Disclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
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
  hasSchedule,
  employees,
  assignmentMap,
  violations,
  openShiftKey,
  dragOverSlotId,
  dropFeedback,
  movePreviews,
  activeMove,
  changedSlotIds,
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
  hasSchedule: boolean
  employees: Employee[]
  assignmentMap: Map<string, ScheduleAssignment>
  violations: ValidationViolation[]
  openShiftKey: ShiftKey | null
  dragOverSlotId: string | null
  dropFeedback: DropFeedback
  movePreviews: Map<string, MovePreview>
  activeMove: DragState | null
  changedSlotIds: Set<string>
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
    <div className="mt-4">
      <div className="divide-y divide-zinc-100">
        {DAYS.map((day) => (
          <div
            key={day}
            className="py-2 md:grid md:grid-cols-[92px_minmax(0,1fr)] md:items-start md:gap-3"
          >
            <h3 className="px-1 py-2 text-base font-bold text-zinc-900">{day}</h3>
            <div className="space-y-1">
              {PERIODS.map((period) => {
                const shiftKey = `${day}-${period}` as ShiftKey
                const shiftSlots = slots.filter((slot) => slot.day === day && slot.period === period)
                return (
                  <ShiftRow
                    key={shiftKey}
                    shiftKey={shiftKey}
                    period={period}
                    slots={shiftSlots}
                    hasSchedule={hasSchedule}
                    employees={employees}
                    assignmentMap={assignmentMap}
                    violations={violations}
                    open={openShiftKey === shiftKey}
                    dragOverSlotId={dragOverSlotId}
                    dropFeedback={dropFeedback}
                    movePreviews={movePreviews}
                    activeMove={activeMove}
                    changedSlotIds={changedSlotIds}
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
          </div>
        ))}
      </div>
      <BoardLegend />
    </div>
  )
}

function BoardLegend() {
  const statusOrder: SpotStatus[] = ['review', 'missing']

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
        <span className="text-zinc-500">Marked only when:</span>
        {statusOrder.map((status) => (
          <span key={status} className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-medium ${statusMeta[status].badge}`}>
            <Icon name={statusMeta[status].icon} />
            {statusMeta[status].shiftLabel}
          </span>
        ))}
      </div>
    </div>
  )
}

function ShiftRow({
  shiftKey,
  period,
  slots,
  hasSchedule,
  employees,
  assignmentMap,
  violations,
  open,
  dragOverSlotId,
  dropFeedback,
  movePreviews,
  activeMove,
  changedSlotIds,
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
  period: ShiftPeriod
  slots: StaffingSlot[]
  hasSchedule: boolean
  employees: Employee[]
  assignmentMap: Map<string, ScheduleAssignment>
  violations: ValidationViolation[]
  open: boolean
  dragOverSlotId: string | null
  dropFeedback: DropFeedback
  movePreviews: Map<string, MovePreview>
  activeMove: DragState | null
  changedSlotIds: Set<string>
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
    <div className={`overflow-hidden rounded ${statusMeta[status].shiftRow}`}>
      <div className="grid w-full gap-3 px-3 py-3 md:grid-cols-[84px_minmax(0,1fr)_auto]">
        <button
          type="button"
          className="flex items-center gap-2 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={() => onOpenShift(open ? null : shiftKey)}
          aria-expanded={open}
          aria-controls={`${shiftKey}-detail`}
        >
          <Icon name={open ? 'chevronDown' : 'chevronRight'} />
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{periodLabels[period]}</span>
        </button>
        <div className="flex flex-wrap gap-2">
          {slots.map((slot, index) => (
            <AssignmentChip
              key={slot.id}
              slot={slot}
              assignment={assignmentMap.get(slot.id)}
              employee={employees.find((candidate) => candidate.id === assignmentMap.get(slot.id)?.employeeId)}
              status={slotStatuses[index]}
              isChanged={changedSlotIds.has(slot.id)}
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
        {status !== 'good' && (
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 self-start rounded border px-2 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${statusMeta[status].badge}`}
            onClick={() => onOpenShift(open ? null : shiftKey)}
            aria-expanded={open}
            aria-controls={`${shiftKey}-detail`}
          >
            <Icon name={statusMeta[status].icon} />
            {statusLabel}
          </button>
        )}
      </div>

      {open && (
        <div id={`${shiftKey}-detail`} className="border-t border-zinc-200 bg-white p-3">
          <div className="grid gap-3 md:grid-cols-2">
            {slots.map((slot, index) => (
              <SlotEditor
                key={slot.id}
                slot={slot}
                status={slotStatuses[index]}
                activeMove={activeMove}
                employees={employees}
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
          {slots.some((slot) => changedSlotIds.has(slot.id)) && (
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
      )}
    </div>
  )
}

function AssignmentChip({
  slot,
  assignment,
  employee,
  status,
  isChanged,
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
  assignment?: ScheduleAssignment
  employee?: Employee
  status: SpotStatus
  isChanged: boolean
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
      ? `Move ${movingName} to ${slot.day} ${periodLabels[slot.period]} ${slot.label}. ${preview.message}`
      : canDrag
        ? `Move ${employee?.name} out of ${slot.day} ${periodLabels[slot.period]} ${slot.label}`
        : `Open ${slot.day} ${periodLabels[slot.period]} to fill ${slot.label}`

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
      onFocus={() => {
        if (isMoveActive) onDragOverSlot(slot.id)
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
        className={`inline-flex h-5 shrink-0 items-center justify-center rounded-sm border px-1 text-[10px] font-bold leading-none ${roleChipClasses[slot.role]}`}
      >
        {slotBadge(slot)}
      </span>
      <span className={`truncate text-sm ${primaryTone}${isGhosted ? ' italic opacity-80' : ''}`}>{primaryText}</span>
      {!isMoveActive && isChanged && (
        <>
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
          <span className="sr-only">Changed since the schedule was made.</span>
        </>
      )}
      {!isMoveActive && status !== 'good' && status !== 'idle' && <Icon name={statusMeta[status].icon} />}
      {isMoveActive && !isSource && preview && <Icon name={preview.status === 'valid' ? 'check' : 'close'} />}
      {assignment?.locked && <Icon name="lock" />}
      <span className="sr-only">{`${slot.label}. ${statusMeta[status].shiftLabel}.`}</span>
    </button>
  )
}

function SlotEditor({
  slot,
  status,
  activeMove,
  employees,
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
  status: SpotStatus
  activeMove: DragState | null
  employees: Employee[]
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
  const eligibleEmployees = employees.filter((employee) => employee.active && isEmployeeQualified(employee, slot) && isEmployeeAvailableForSlot(employee, slot))
  const otherEmployees = employees.filter((employee) => !eligibleEmployees.includes(employee))
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
          <optgroup label="Best choices">
            {eligibleEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </optgroup>
        )}
        {otherEmployees.length > 0 && (
          <optgroup label="Other employees">
            {otherEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
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
              {reviewLabel(violation, slot, employees.find((candidate) => candidate.id === violation.employeeId))}
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
  }: {
    status: SpotStatus
    isMoveActive: boolean
    isSource: boolean
    isHovered: boolean
    preview: MovePreview | null
    wouldReplace: boolean
  },
) {
  const base =
    'inline-flex min-h-9 max-w-full items-center gap-2 rounded border px-2 py-1.5 text-left transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'

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
  | 'chevronRight'
  | 'close'
  | 'lock'
  | 'move'
  | 'plus'
  | 'print'
  | 'reset'
  | 'spark'
  | 'target'
  | 'undo'
  | 'warning'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    check: <path d="M5 12l4 4L19 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronRight: <path d="M9 6l6 6-6 6" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z" />,
    move: <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />,
    plus: <path d="M12 5v14M5 12h14" />,
    print: <path d="M7 8V4h10v4M7 17H5V9h14v8h-2M7 14h10v6H7z" />,
    reset: <path d="M4 12a8 8 0 1 0 2.3-5.7M4 5v5h5" />,
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
