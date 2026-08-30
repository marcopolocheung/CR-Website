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

type GenerateOptions = {
  existingAssignments?: ScheduleAssignment[]
  maxNodes?: number
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

  const lockedAssignments = (options.existingAssignments ?? []).filter((assignment) => assignment.locked)
  const lockedBySlot = Object.fromEntries(lockedAssignments.map((assignment) => [assignment.slotId, assignment.employeeId]))
  const state: SolverState = {
    assignments: new Map(),
    employeeSlots: new Map(),
  }

  for (const assignment of lockedAssignments) {
    const slot = slots.find((candidate) => candidate.id === assignment.slotId)
    const employee = input.employees.find((candidate) => candidate.id === assignment.employeeId)
    if (!slot || !employee || !canAssign(input.employees, employee, slot, state)) {
      return {
        status: 'INFEASIBLE',
        assignments: lockedAssignments,
        diagnostics: [
          ...diagnostics,
          {
            code: 'invalid_locked_assignment',
            message: `A locked assignment for ${assignment.slotId} cannot be kept with the current rules.`,
            slotId: assignment.slotId,
          },
        ],
        objectiveScore: null,
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
  const maxNodes = options.maxNodes ?? 250000

  function search(remainingSlots: StaffingSlot[]): boolean {
    visitedNodes += 1
    if (visitedNodes > maxNodes) return false
    if (remainingSlots.length === 0) return true

    const next = chooseNextSlot(input.employees, remainingSlots, state)
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
      status: 'INFEASIBLE',
      assignments: Array.from(state.assignments.values()),
      diagnostics: [
        ...diagnostics,
        {
          code: 'search_exhausted',
          message: `No valid schedule was found after checking ${visitedNodes.toLocaleString()} assignment states.`,
        },
      ],
      objectiveScore: null,
    }
  }

  const assignments = slots.map((slot) => state.assignments.get(slot.id)).filter((assignment): assignment is ScheduleAssignment => Boolean(assignment))
  const validationViolations = validateSchedule({
    employees: input.employees,
    slots,
    assignments,
    lockedAssignments: lockedBySlot,
  })

  if (validationViolations.length > 0) {
    return {
      status: 'INFEASIBLE',
      assignments,
      diagnostics: validationViolations.map((violation) => ({
        code: violation.code,
        message: violation.message,
        slotId: violation.slotId,
      })),
      objectiveScore: null,
    }
  }

  return {
    status: 'FEASIBLE',
    assignments,
    diagnostics,
    objectiveScore: scoreSchedule(input.employees, slots, assignments),
  }
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

function orderCandidates(employees: Employee[], slot: StaffingSlot, state: SolverState) {
  return employees
    .filter((employee) => basicCandidate(employee, slot))
    .sort((a, b) => candidateScore(a, slot, state) - candidateScore(b, slot, state) || a.name.localeCompare(b.name))
}

function chooseNextSlot(employees: Employee[], slots: StaffingSlot[], state: SolverState) {
  let best:
    | {
        slot: StaffingSlot
        candidates: Employee[]
        index: number
      }
    | null = null

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]
    const candidates = orderCandidates(employees, slot, state).filter((employee) =>
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

function candidateScore(employee: Employee, slot: StaffingSlot, state: SolverState) {
  const existingSlots = state.employeeSlots.get(employee.id) ?? []
  const workedDays = new Set(existingSlots.map((existingSlot) => existingSlot.day))
  const hours = existingSlots.reduce((total, existingSlot) => total + hoursFor(existingSlot), 0)
  const wouldAddDay = workedDays.has(slot.day) ? 0 : 1
  const dayPreference = employee.preferences?.find((preference) => preference.day === slot.day && preference.period === slot.period)?.weight ?? 0
  const wouldDouble = existingSlots.some((existingSlot) => existingSlot.day === slot.day && existingSlot.period !== slot.period) ? 1 : 0
  const maxDayPressure =
    employee.maxDaysPerWeek === undefined ? 0 : ((workedDays.size + wouldAddDay) / employee.maxDaysPerWeek) * 4

  return workedDays.size * 12 + hours + wouldAddDay * 6 + wouldDouble * 10 + maxDayPressure - dayPreference
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
