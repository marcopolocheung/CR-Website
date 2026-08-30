import { DAYS } from './types'
import type {
  DayOfWeek,
  Diagnostic,
  Employee,
  GenerateScheduleResult,
  ScheduleAssignment,
  SchedulerInput,
  ShiftPeriod,
  StaffingSlot,
} from './types'
import { expandTemplate } from './data'
import { hoursFor, rangesOverlap } from './time'
import {
  areEmployeesIncompatible,
  isEmployeeAvailableForSlot,
  isEmployeeQualified,
  validateSchedule,
} from './validator'

type SolverState = {
  assignments: Map<string, ScheduleAssignment>
  employeeSlots: Map<string, StaffingSlot[]>
}

type CandidateWeights = {
  day: number
  hour: number
  addDay: number
  double: number
  keep: number
}

/**
 * The search is greedy, so the weights it orders candidates by decide the week it lands on.
 * Rather than trust one set, every strategy runs all of these and keeps whichever result scores
 * best against what that strategy is asking for. Same input, same profiles, same answer.
 */
const WEIGHT_PROFILES: CandidateWeights[] = [
  { day: 12, hour: 1, addDay: 6, double: 10, keep: 0 },
  { day: 6, hour: 1, addDay: 3, double: 40, keep: 0 },
  { day: 2, hour: 6, addDay: 1, double: 6, keep: 0 },
  { day: 0, hour: 10, addDay: 0, double: 2, keep: 0 },
  { day: 16, hour: 2, addDay: 8, double: 20, keep: 0 },
  { day: 8, hour: 4, addDay: 4, double: 12, keep: 0 },
]

export const SCHEDULE_STRATEGIES = ['balanced', 'fewestDoubles', 'similarWeek', 'fairHours'] as const

export type ScheduleStrategy = (typeof SCHEDULE_STRATEGIES)[number]

type GenerateOptions = {
  existingAssignments?: ScheduleAssignment[]
  maxNodes?: number
  /**
   * Picks the tie-breaking rule the greedy search follows. Every strategy explores the same
   * feasible space and is fully deterministic; they differ only in which candidate is tried first.
   */
  strategy?: ScheduleStrategy
  /** Schedule to stay close to when the strategy is `similarWeek`. */
  referenceAssignments?: ScheduleAssignment[]
}

export function generateSchedule(input: SchedulerInput, options: GenerateOptions = {}): GenerateScheduleResult {
  const slots = expandTemplate(input.template).filter((slot) => slot.required)
  const diagnostics = preflightDiagnostics(input.employees, slots)
  const blockingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.code.startsWith('no_') || diagnostic.code.startsWith('insufficient_'))

  if (blockingDiagnostics.length > 0) {
    return {
      status: 'INFEASIBLE',
      assignments: [],
      diagnostics,
      objectiveScore: null,
    }
  }

  const strategy = options.strategy ?? 'balanced'
  const referenceBySlot = new Map(
    (options.referenceAssignments ?? []).map((assignment) => [assignment.slotId, assignment.employeeId]),
  )
  const lockedAssignments = (options.existingAssignments ?? []).filter((assignment) => assignment.locked)
  const lockedBySlot = Object.fromEntries(lockedAssignments.map((assignment) => [assignment.slotId, assignment.employeeId]))
  const maxNodes = options.maxNodes ?? 250000

  let bestAssignments: ScheduleAssignment[] | null = null
  let bestObjective = Number.POSITIVE_INFINITY
  let lastFailure: Diagnostic | null = null

  for (const profile of WEIGHT_PROFILES) {
    const weights = strategy === 'similarWeek' ? { ...profile, keep: 100 } : profile
    const attempt = searchSchedule({
      employees: input.employees,
      slots,
      lockedAssignments,
      weights,
      referenceBySlot,
      maxNodes,
    })

    if ('diagnostic' in attempt) {
      lastFailure = attempt.diagnostic
      if (attempt.diagnostic.code === 'invalid_locked_assignment') {
        return {
          status: 'INFEASIBLE',
          assignments: lockedAssignments,
          diagnostics: [...diagnostics, attempt.diagnostic],
          objectiveScore: null,
        }
      }
      continue
    }

    const violations = validateSchedule({
      employees: input.employees,
      slots,
      assignments: attempt.assignments,
      lockedAssignments: lockedBySlot,
    })
    if (violations.length > 0) {
      lastFailure = {
        code: violations[0].code,
        message: violations[0].message,
        slotId: violations[0].slotId,
      }
      continue
    }

    const objective = strategyObjective(strategy, input.employees, slots, attempt.assignments, referenceBySlot)
    if (objective < bestObjective) {
      bestObjective = objective
      bestAssignments = attempt.assignments
    }
  }

  if (!bestAssignments) {
    return {
      status: 'INFEASIBLE',
      assignments: [],
      diagnostics: [
        ...diagnostics,
        lastFailure ?? {
          code: 'search_exhausted',
          message: 'No valid schedule was found with the current rules.',
        },
      ],
      objectiveScore: null,
    }
  }

  return {
    status: 'FEASIBLE',
    assignments: bestAssignments,
    diagnostics,
    objectiveScore: scoreSchedule(input.employees, slots, bestAssignments),
  }
}

type SearchResult = { assignments: ScheduleAssignment[] } | { diagnostic: Diagnostic }

function searchSchedule({
  employees,
  slots,
  lockedAssignments,
  weights,
  referenceBySlot,
  maxNodes,
}: {
  employees: Employee[]
  slots: StaffingSlot[]
  lockedAssignments: ScheduleAssignment[]
  weights: CandidateWeights
  referenceBySlot: Map<string, string>
  maxNodes: number
}): SearchResult {
  const state: SolverState = {
    assignments: new Map(),
    employeeSlots: new Map(),
  }

  for (const assignment of lockedAssignments) {
    const slot = slots.find((candidate) => candidate.id === assignment.slotId)
    const employee = employees.find((candidate) => candidate.id === assignment.employeeId)
    if (!slot || !employee || !canAssign(employees, employee, slot, state)) {
      return {
        diagnostic: {
          code: 'invalid_locked_assignment',
          message: slot
            ? `The kept assignment for ${slot.day} ${slot.period} ${slot.label} cannot be kept with the current rules.`
            : `A kept assignment cannot be kept with the current rules.`,
          slotId: assignment.slotId,
          day: slot?.day,
          period: slot?.period,
          role: slot?.role,
        },
      }
    }
    applyAssignment(employee, slot, true, state)
  }

  const unassignedSlots = slots
    .filter((slot) => !state.assignments.has(slot.id))
    .sort((a, b) => {
      const byDay = DAYS.indexOf(a.day) - DAYS.indexOf(b.day)
      if (byDay !== 0) return byDay
      if (a.period !== b.period) return a.period === 'AM' ? -1 : 1
      return a.start - b.start || a.label.localeCompare(b.label)
    })

  let visitedNodes = 0

  function search(remainingSlots: StaffingSlot[]): boolean {
    visitedNodes += 1
    if (visitedNodes > maxNodes) return false
    if (remainingSlots.length === 0) return true

    const next = chooseNextSlot(employees, remainingSlots, state, weights, referenceBySlot)
    if (!next) return false
    const { slot, candidates, remaining } = next
    for (const employee of candidates) {
      applyAssignment(employee, slot, false, state)
      if (search(remaining)) return true
      removeAssignment(employee, slot, state)
    }

    return false
  }

  if (!search(unassignedSlots)) {
    return {
      diagnostic: {
        code: 'search_exhausted',
        message: `No valid schedule was found after checking ${visitedNodes.toLocaleString()} assignment states.`,
      },
    }
  }

  return {
    assignments: slots
      .map((slot) => state.assignments.get(slot.id))
      .filter((assignment): assignment is ScheduleAssignment => Boolean(assignment)),
  }
}

/** Lower is better. Each strategy answers "which of these weeks is the one I asked for?". */
function strategyObjective(
  strategy: ScheduleStrategy,
  employees: Employee[],
  slots: StaffingSlot[],
  assignments: ScheduleAssignment[],
  referenceBySlot: Map<string, string>,
) {
  const summary = summarizeSchedule(employees, slots, assignments, Array.from(referenceBySlot, ([slotId, employeeId]) => ({ slotId, employeeId })))
  const spread = hoursDeviation(employees, slots, assignments)

  if (strategy === 'fewestDoubles') return summary.doubles * 1000 + spread
  if (strategy === 'fairHours') return spread * 10 + summary.doubles
  if (strategy === 'similarWeek') return -summary.keptFromReference * 100 + spread
  return spread * 2 + summary.doubles * 5
}

function hoursDeviation(employees: Employee[], slots: StaffingSlot[], assignments: ScheduleAssignment[]) {
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]))
  const hours = employees
    .filter((employee) => employee.active)
    .map((employee) =>
      assignments
        .filter((assignment) => assignment.employeeId === employee.id)
        .map((assignment) => slotsById.get(assignment.slotId))
        .filter((slot): slot is StaffingSlot => Boolean(slot))
        .reduce((total, slot) => total + hoursFor(slot), 0),
    )
  if (hours.length === 0) return 0
  const average = hours.reduce((total, value) => total + value, 0) / hours.length

  return Math.round(hours.reduce((total, value) => total + Math.abs(value - average), 0) * 10) / 10
}

export function preflightDiagnostics(employees: Employee[], slots: StaffingSlot[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const slot of slots) {
    const candidates = employees.filter((employee) => basicCandidate(employee, slot))
    if (candidates.length === 0) {
      diagnostics.push({
        code: `no_${slot.role}_candidate`,
        message: `${slot.day} ${slot.period} requires ${slot.label}, but no active ${slot.role}-qualified employee is available for that time.`,
        day: slot.day,
        period: slot.period,
        role: slot.role,
        slotId: slot.id,
      })
    }
  }

  const groups = groupSlotsByShift(slots)
  for (const [key, shiftSlots] of groups.entries()) {
    const [day, period] = key.split(':') as [DayOfWeek, ShiftPeriod]
    const availableEmployees = employees.filter((employee) =>
      shiftSlots.some((slot) => basicCandidate(employee, slot)),
    )
    if (availableEmployees.length < shiftSlots.length) {
      diagnostics.push({
        code: 'insufficient_shift_capacity',
        message: `${day} ${period} requires ${shiftSlots.length} employees but only ${availableEmployees.length} active qualified employees are available.`,
        day,
        period,
      })
    }

    const roles = [...new Set(shiftSlots.map((slot) => slot.role))]
    for (const role of roles) {
      const roleSlots = shiftSlots.filter((slot) => slot.role === role)
      const roleCandidates = employees.filter((employee) =>
        roleSlots.some((slot) => basicCandidate(employee, slot)),
      )
      if (roleCandidates.length < roleSlots.length) {
        diagnostics.push({
          code: `insufficient_${role}_capacity`,
          message: `${day} ${period} requires ${roleSlots.length} ${role} slot${roleSlots.length === 1 ? '' : 's'} but only ${roleCandidates.length} active qualified employee${roleCandidates.length === 1 ? '' : 's'} are available.`,
          day,
          period,
          role,
        })
      }
    }
  }

  return diagnostics
}

function basicCandidate(employee: Employee, slot: StaffingSlot) {
  return employee.active && isEmployeeQualified(employee, slot) && isEmployeeAvailableForSlot(employee, slot)
}

function canAssign(allEmployees: Employee[], employee: Employee, slot: StaffingSlot, state: SolverState) {
  if (!basicCandidate(employee, slot)) return false

  const existingSlots = state.employeeSlots.get(employee.id) ?? []
  for (const existingSlot of existingSlots) {
    if (existingSlot.day === slot.day && rangesOverlap(existingSlot, slot)) return false
  }

  const workedDays = new Set(existingSlots.map((existingSlot) => existingSlot.day))
  workedDays.add(slot.day)
  if (employee.maxDaysPerWeek !== undefined && workedDays.size > employee.maxDaysPerWeek) return false

  if (employee.maxShiftsPerWeek !== undefined && existingSlots.length + 1 > employee.maxShiftsPerWeek) return false

  const periodsForDay = new Set(existingSlots.filter((existingSlot) => existingSlot.day === slot.day).map((existingSlot) => existingSlot.period))
  periodsForDay.add(slot.period)
  if (!employee.allowDoubles && periodsForDay.size > 1) return false

  const shiftEmployees = Array.from(state.assignments.values())
    .map((assignment) => ({
      assignment,
      assignedSlot: Array.from(state.employeeSlots.get(assignment.employeeId) ?? []).find((candidate) => candidate.id === assignment.slotId),
    }))
    .filter(({ assignedSlot }) => assignedSlot?.day === slot.day && assignedSlot.period === slot.period)
    .map(({ assignment }) => allEmployees.find((candidate) => candidate.id === assignment.employeeId))
    .filter((candidate): candidate is Employee => Boolean(candidate))

  return shiftEmployees.every((assignedEmployee) => !areEmployeesIncompatible(employee, assignedEmployee))
}

function applyAssignment(employee: Employee, slot: StaffingSlot, locked: boolean, state: SolverState) {
  state.assignments.set(slot.id, { slotId: slot.id, employeeId: employee.id, locked })
  const employeeSlots = state.employeeSlots.get(employee.id) ?? []
  employeeSlots.push(slot)
  state.employeeSlots.set(employee.id, employeeSlots)
}

function removeAssignment(employee: Employee, slot: StaffingSlot, state: SolverState) {
  state.assignments.delete(slot.id)
  state.employeeSlots.set(
    employee.id,
    (state.employeeSlots.get(employee.id) ?? []).filter((candidate) => candidate.id !== slot.id),
  )
}

function orderCandidates(
  employees: Employee[],
  slot: StaffingSlot,
  state: SolverState,
  weights: CandidateWeights,
  referenceBySlot: Map<string, string>,
) {
  return employees
    .filter((employee) => basicCandidate(employee, slot))
    .sort(
      (a, b) =>
        candidateScore(a, slot, state, weights, referenceBySlot) -
          candidateScore(b, slot, state, weights, referenceBySlot) || a.name.localeCompare(b.name),
    )
}

function chooseNextSlot(
  employees: Employee[],
  slots: StaffingSlot[],
  state: SolverState,
  weights: CandidateWeights,
  referenceBySlot: Map<string, string>,
) {
  let best:
    | {
        slot: StaffingSlot
        candidates: Employee[]
        index: number
      }
    | null = null

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]
    const candidates = orderCandidates(employees, slot, state, weights, referenceBySlot).filter((employee) =>
      canAssign(employees, employee, slot, state),
    )
    if (candidates.length === 0) return null
    if (!best || candidates.length < best.candidates.length) {
      best = { slot, candidates, index }
      if (candidates.length === 1) break
    }
  }

  if (!best) return null

  return {
    slot: best.slot,
    candidates: best.candidates,
    remaining: slots.filter((_, index) => index !== best?.index),
  }
}

function candidateScore(
  employee: Employee,
  slot: StaffingSlot,
  state: SolverState,
  weights: CandidateWeights,
  referenceBySlot: Map<string, string>,
) {
  const existingSlots = state.employeeSlots.get(employee.id) ?? []
  const workedDays = new Set(existingSlots.map((existingSlot) => existingSlot.day))
  const hours = existingSlots.reduce((total, existingSlot) => total + hoursFor(existingSlot), 0)
  const wouldAddDay = workedDays.has(slot.day) ? 0 : 1
  const dayPreference = employee.preferences?.find((preference) => preference.day === slot.day && preference.period === slot.period)?.weight ?? 0
  const wouldDouble = existingSlots.some((existingSlot) => existingSlot.day === slot.day && existingSlot.period !== slot.period) ? 1 : 0
  const maxDayPressure =
    employee.maxDaysPerWeek === undefined ? 0 : ((workedDays.size + wouldAddDay) / employee.maxDaysPerWeek) * 4
  const keepsReference = referenceBySlot.get(slot.id) === employee.id ? 1 : 0

  return (
    workedDays.size * weights.day +
    hours * weights.hour +
    wouldAddDay * weights.addDay +
    wouldDouble * weights.double +
    maxDayPressure -
    keepsReference * weights.keep -
    dayPreference
  )
}

export type ScheduleSummary = {
  doubles: number
  mostHours: number
  fewestHours: number
  hoursSpread: number
  keptFromReference: number
}

/** Plain numbers a manager can compare between two generated weeks. */
export function summarizeSchedule(
  employees: Employee[],
  slots: StaffingSlot[],
  assignments: ScheduleAssignment[],
  referenceAssignments: ScheduleAssignment[] = [],
): ScheduleSummary {
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]))
  const referenceBySlot = new Map(referenceAssignments.map((assignment) => [assignment.slotId, assignment.employeeId]))
  const working = employees.filter((employee) =>
    assignments.some((assignment) => assignment.employeeId === employee.id),
  )

  let doubles = 0
  const hoursPerEmployee = working.map((employee) => {
    const employeeSlots = assignments
      .filter((assignment) => assignment.employeeId === employee.id)
      .map((assignment) => slotsById.get(assignment.slotId))
      .filter((slot): slot is StaffingSlot => Boolean(slot))

    for (const day of DAYS) {
      const periods = new Set(employeeSlots.filter((slot) => slot.day === day).map((slot) => slot.period))
      if (periods.size > 1) doubles += 1
    }

    return employeeSlots.reduce((total, slot) => total + hoursFor(slot), 0)
  })

  const mostHours = hoursPerEmployee.length > 0 ? Math.max(...hoursPerEmployee) : 0
  const fewestHours = hoursPerEmployee.length > 0 ? Math.min(...hoursPerEmployee) : 0

  return {
    doubles,
    mostHours,
    fewestHours,
    hoursSpread: Math.round((mostHours - fewestHours) * 10) / 10,
    keptFromReference: assignments.filter((assignment) => referenceBySlot.get(assignment.slotId) === assignment.employeeId)
      .length,
  }
}

function scoreSchedule(employees: Employee[], slots: StaffingSlot[], assignments: ScheduleAssignment[]) {
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]))
  const employeeHours = employees.map((employee) =>
    assignments
      .filter((assignment) => assignment.employeeId === employee.id)
      .map((assignment) => slotsById.get(assignment.slotId))
      .filter((slot): slot is StaffingSlot => Boolean(slot))
      .reduce((total, slot) => total + hoursFor(slot), 0),
  )
  const average = employeeHours.reduce((total, hours) => total + hours, 0) / Math.max(employeeHours.length, 1)

  return Math.round(
    employeeHours.reduce((total, hours) => total + Math.abs(hours - average), 0) +
      assignments.filter((assignment) => assignment.locked).length * -2,
  )
}

function groupSlotsByShift(slots: StaffingSlot[]) {
  const groups = new Map<string, StaffingSlot[]>()
  for (const slot of slots) {
    const key = `${slot.day}:${slot.period}`
    const shiftSlots = groups.get(key) ?? []
    shiftSlots.push(slot)
    groups.set(key, shiftSlots)
  }
  return groups
}
