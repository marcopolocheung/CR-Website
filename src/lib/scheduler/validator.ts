import type {
  DayOfWeek,
  Employee,
  ScheduleAssignment,
  ScheduleStats,
  StaffingSlot,
  TimeRange,
  ValidationViolation,
} from './types'
import { hoursFor, rangeContains, rangesOverlap } from './time'

type ValidationInput = {
  employees: Employee[]
  slots: StaffingSlot[]
  assignments: ScheduleAssignment[]
  lockedAssignments?: Record<string, string>
  requireCoverage?: boolean
}

export function getEmployeeAvailability(employee: Employee, day: DayOfWeek, date?: string): TimeRange[] {
  if (date) {
    const override = employee.availabilityOverrides?.find((item) => item.date === date)
    if (override) return override.ranges
  }

  return employee.recurringAvailability[day] ?? []
}

export function isEmployeeAvailableForSlot(employee: Employee, slot: StaffingSlot) {
  return getEmployeeAvailability(employee, slot.day).some((range) =>
    rangeContains(range, { start: slot.start, end: slot.end }),
  )
}

export function isEmployeeQualified(employee: Employee, slot: StaffingSlot) {
  return employee.roles.includes(slot.role)
}

export function areEmployeesIncompatible(a: Employee, b: Employee) {
  return (
    a.incompatibleEmployeeIds?.includes(b.id) ||
    b.incompatibleEmployeeIds?.includes(a.id) ||
    false
  )
}

export function validateSchedule({
  employees,
  slots,
  assignments,
  lockedAssignments = {},
  requireCoverage = true,
}: ValidationInput): ValidationViolation[] {
  const violations: ValidationViolation[] = []
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]))
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]))
  const assignmentsBySlot = new Map<string, ScheduleAssignment[]>()

  for (const assignment of assignments) {
    const existing = assignmentsBySlot.get(assignment.slotId) ?? []
    existing.push(assignment)
    assignmentsBySlot.set(assignment.slotId, existing)
  }

  if (requireCoverage) {
    for (const slot of slots) {
      if (!slot.required) continue
      const slotAssignments = assignmentsBySlot.get(slot.id)?.filter((assignment) => assignment.employeeId) ?? []
      if (slotAssignments.length === 0) {
        violations.push({
          code: 'missing_assignment',
          slotId: slot.id,
          message: `${slot.day} ${slot.period} ${slot.label} is required but has no employee assigned.`,
        })
      }
    }
  }

  for (const assignment of assignments) {
    const slot = slotsById.get(assignment.slotId)
    const employee = employeesById.get(assignment.employeeId)

    if (!slot) {
      violations.push({
        code: 'unknown_slot',
        slotId: assignment.slotId,
        employeeId: assignment.employeeId,
        message: `Assignment references an unknown slot: ${assignment.slotId}.`,
      })
      continue
    }

    if (!employee) {
      violations.push({
        code: 'unknown_employee',
        slotId: slot.id,
        employeeId: assignment.employeeId,
        message: `${slot.day} ${slot.period} ${slot.label} is assigned to an unknown employee.`,
      })
      continue
    }

    if (!employee.active) {
      violations.push({
        code: 'inactive_employee',
        slotId: slot.id,
        employeeId: employee.id,
        message: `${employee.name} is inactive and cannot be assigned to ${slot.day} ${slot.period} ${slot.label}.`,
      })
    }

    if (!isEmployeeQualified(employee, slot)) {
      violations.push({
        code: 'unqualified_employee',
        slotId: slot.id,
        employeeId: employee.id,
        message: `${employee.name} is not qualified for ${slot.day} ${slot.period} ${slot.label}.`,
      })
    }

    if (!isEmployeeAvailableForSlot(employee, slot)) {
      violations.push({
        code: 'unavailable_employee',
        slotId: slot.id,
        employeeId: employee.id,
        message: `${employee.name} is unavailable for ${slot.day} ${slot.period} ${slot.label}.`,
      })
    }
  }

  for (const [slotId, lockedEmployeeId] of Object.entries(lockedAssignments)) {
    const assignment = assignmentsBySlot.get(slotId)?.[0]
    if (assignment?.employeeId !== lockedEmployeeId) {
      violations.push({
        code: 'locked_assignment_changed',
        slotId,
        employeeId: assignment?.employeeId,
        message: `Locked assignment for ${slotId} changed from ${lockedEmployeeId} to ${assignment?.employeeId ?? 'unassigned'}.`,
      })
    }
  }

  const employeeAssignments = new Map<string, { assignment: ScheduleAssignment; slot: StaffingSlot }[]>()
  for (const assignment of assignments) {
    const slot = slotsById.get(assignment.slotId)
    if (!slot) continue
    const employeeSlots = employeeAssignments.get(assignment.employeeId) ?? []
    employeeSlots.push({ assignment, slot })
    employeeAssignments.set(assignment.employeeId, employeeSlots)
  }

  for (const [employeeId, employeeSlots] of employeeAssignments.entries()) {
    const employee = employeesById.get(employeeId)
    if (!employee) continue

    const workedDays = new Set(employeeSlots.map(({ slot }) => slot.day))
    if (employee.maxDaysPerWeek !== undefined && workedDays.size > employee.maxDaysPerWeek) {
      violations.push({
        code: 'max_days_exceeded',
        employeeId,
        message: `${employee.name} is assigned ${workedDays.size} days, exceeding the max of ${employee.maxDaysPerWeek}.`,
      })
    }

    if (employee.maxShiftsPerWeek !== undefined && employeeSlots.length > employee.maxShiftsPerWeek) {
      violations.push({
        code: 'max_shifts_exceeded',
        employeeId,
        message: `${employee.name} is assigned ${employeeSlots.length} shifts, exceeding the max of ${employee.maxShiftsPerWeek}.`,
      })
    }

    const byDay = new Map<DayOfWeek, StaffingSlot[]>()
    for (const { slot } of employeeSlots) {
      const slotsForDay = byDay.get(slot.day) ?? []
      slotsForDay.push(slot)
      byDay.set(slot.day, slotsForDay)
    }

    for (const [day, slotsForDay] of byDay.entries()) {
      const periods = new Set(slotsForDay.map((slot) => slot.period))
      if (!employee.allowDoubles && periods.size > 1) {
        violations.push({
          code: 'prohibited_double',
          employeeId,
          message: `${employee.name} is assigned both AM and PM on ${day}, but doubles are prohibited.`,
        })
      }

      for (let i = 0; i < slotsForDay.length; i += 1) {
        for (let j = i + 1; j < slotsForDay.length; j += 1) {
          const first = slotsForDay[i]
          const second = slotsForDay[j]
          if (rangesOverlap(first, second)) {
            violations.push({
              code: 'overlapping_assignment',
              employeeId,
              slotId: second.id,
              message: `${employee.name} has overlapping assignments on ${day}: ${first.label} and ${second.label}.`,
            })
          }
        }
      }
    }
  }

  for (const slot of slots) {
    const shiftAssignments = assignments.filter((assignment) => {
      const assignedSlot = slotsById.get(assignment.slotId)
      return assignedSlot?.day === slot.day && assignedSlot.period === slot.period
    })

    for (let i = 0; i < shiftAssignments.length; i += 1) {
      for (let j = i + 1; j < shiftAssignments.length; j += 1) {
        const first = employeesById.get(shiftAssignments[i].employeeId)
        const second = employeesById.get(shiftAssignments[j].employeeId)
        if (!first || !second || !areEmployeesIncompatible(first, second)) continue
        violations.push({
          code: 'incompatible_pair',
          employeeId: first.id,
          message: `${first.name} and ${second.name} cannot work together on ${slot.day} ${slot.period}.`,
        })
      }
    }
  }

  return dedupeViolations(violations)
}

export function calculateScheduleStats(
  employees: Employee[],
  slots: StaffingSlot[],
  assignments: ScheduleAssignment[],
): ScheduleStats[] {
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]))

  return employees.map((employee) => {
    const assignedSlots = assignments
      .filter((assignment) => assignment.employeeId === employee.id)
      .map((assignment) => slotsById.get(assignment.slotId))
      .filter((slot): slot is StaffingSlot => Boolean(slot))

    return {
      employeeId: employee.id,
      name: employee.name,
      days: new Set(assignedSlots.map((slot) => slot.day)).size,
      shifts: assignedSlots.length,
      hours: assignedSlots.reduce((total, slot) => total + hoursFor(slot), 0),
    }
  })
}

function dedupeViolations(violations: ValidationViolation[]) {
  const seen = new Set<string>()
  return violations.filter((violation) => {
    const key = `${violation.code}:${violation.slotId ?? ''}:${violation.employeeId ?? ''}:${violation.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
