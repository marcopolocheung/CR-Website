import assert from 'node:assert/strict'
import test from 'node:test'
import { seedEmployees, seedTemplate, expandTemplate } from './data'
import { SCHEDULE_STRATEGIES, generateSchedule, summarizeSchedule } from './solver'
import { validateSchedule } from './validator'
import type { Employee, ScheduleAssignment, StaffingSlot } from './types'
import { minutes } from './time'

const slots = expandTemplate(seedTemplate)

function slot(day: string, period: string, label: string) {
  const found = slots.find((candidate) => candidate.day === day && candidate.period === period && candidate.label === label)
  assert.ok(found, `Missing slot ${day} ${period} ${label}`)
  return found
}

function assignment(targetSlot: StaffingSlot, employeeId: string, locked = false): ScheduleAssignment {
  return { slotId: targetSlot.id, employeeId, locked }
}

function employee(id: string) {
  const found = seedEmployees.find((candidate) => candidate.id === id)
  assert.ok(found, `Missing employee ${id}`)
  return found
}

test('validator catches unavailable employees', () => {
  const target = slot('Thursday', 'PM', 'Cashier 1')
  const violations = validateSchedule({
    employees: seedEmployees,
    slots: [target],
    assignments: [assignment(target, 'mary')],
  })

  assert.ok(violations.some((violation) => violation.code === 'unavailable_employee'))
})

test('validator catches unqualified employees', () => {
  const target = slot('Tuesday', 'AM', 'Cashier 1')
  const violations = validateSchedule({
    employees: seedEmployees,
    slots: [target],
    assignments: [assignment(target, 'eileen')],
  })

  assert.ok(violations.some((violation) => violation.code === 'unqualified_employee'))
})

test('validator catches max days exceeded', () => {
  const marySlots = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Friday'].map((day) => slot(day, 'AM', 'Cashier 1'))
  const violations = validateSchedule({
    employees: seedEmployees,
    slots: marySlots,
    assignments: marySlots.map((target) => assignment(target, 'mary')),
    requireCoverage: false,
  })

  assert.ok(violations.some((violation) => violation.code === 'max_days_exceeded'))
})

test('validator catches prohibited doubles', () => {
  const amSlot = slot('Monday', 'AM', 'Cashier 1')
  const pmSlot = slot('Monday', 'PM', 'Cashier 1')
  const violations = validateSchedule({
    employees: seedEmployees,
    slots: [amSlot, pmSlot],
    assignments: [assignment(amSlot, 'pam'), assignment(pmSlot, 'pam')],
    requireCoverage: false,
  })

  assert.ok(violations.some((violation) => violation.code === 'prohibited_double'))
})

test('validator allows doubles for employees configured to allow them', () => {
  const amSlot = slot('Sunday', 'AM', 'Shift lead')
  const pmSlot = slot('Sunday', 'PM', 'Shift lead')
  const violations = validateSchedule({
    employees: seedEmployees,
    slots: [amSlot, pmSlot],
    assignments: [assignment(amSlot, 'dolores'), assignment(pmSlot, 'dolores')],
    requireCoverage: false,
  })

  assert.deepEqual(violations, [])
})

test('validator catches employee incompatibility', () => {
  const cashier = slot('Friday', 'PM', 'Cashier 1')
  const server = slot('Friday', 'PM', 'Server')
  const violations = validateSchedule({
    employees: seedEmployees,
    slots: [cashier, server],
    assignments: [assignment(cashier, 'chela'), assignment(server, 'emerie')],
    requireCoverage: false,
  })

  assert.ok(violations.some((violation) => violation.code === 'incompatible_pair'))
})

test('validator catches missing manager coverage', () => {
  const managerSlot = slot('Friday', 'PM', 'Friday manager')
  const violations = validateSchedule({
    employees: seedEmployees,
    slots: [managerSlot],
    assignments: [],
  })

  assert.ok(violations.some((violation) => violation.code === 'missing_assignment'))
})

test('validator catches missing staffing coverage', () => {
  const target = slot('Sunday', 'AM', 'Server')
  const violations = validateSchedule({
    employees: seedEmployees,
    slots: [target],
    assignments: [],
  })

  assert.ok(violations.some((violation) => violation.code === 'missing_assignment'))
})

test('weekend availability exception allows Javier on Saturday PM', () => {
  const target = slot('Saturday', 'PM', 'Server')
  const violations = validateSchedule({
    employees: seedEmployees,
    slots: [target],
    assignments: [assignment(target, 'javier')],
  })

  assert.deepEqual(violations, [])
})

test('validator catches changed locked assignments', () => {
  const target = slot('Sunday', 'AM', 'Server')
  const violations = validateSchedule({
    employees: seedEmployees,
    slots: [target],
    assignments: [assignment(target, 'pam')],
    lockedAssignments: { [target.id]: 'mary' },
  })

  assert.ok(violations.some((violation) => violation.code === 'locked_assignment_changed'))
})

test('solver returns infeasible when no lead or manager is active', () => {
  const noLeads: Employee[] = seedEmployees.map((candidate) =>
    candidate.roles.includes('lead') || candidate.roles.includes('manager')
      ? { ...candidate, active: false }
      : candidate,
  )
  const result = generateSchedule({ employees: noLeads, template: seedTemplate })

  assert.equal(result.status, 'INFEASIBLE')
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code.includes('lead')))
})

test('generated seed schedule passes independent validation', () => {
  const result = generateSchedule({ employees: seedEmployees, template: seedTemplate })
  assert.notEqual(result.status, 'INFEASIBLE')
  if (result.status === 'INFEASIBLE') return

  const violations = validateSchedule({
    employees: seedEmployees,
    slots,
    assignments: result.assignments,
  })
  assert.deepEqual(violations, [])
})

test('manual locked assignment is preserved during regeneration', () => {
  const target = slot('Sunday', 'AM', 'Server')
  const result = generateSchedule({
    employees: seedEmployees,
    template: seedTemplate,
  }, {
    existingAssignments: [assignment(target, 'javier', true)],
  })

  assert.notEqual(result.status, 'INFEASIBLE')
  if (result.status === 'INFEASIBLE') return
  assert.equal(result.assignments.find((candidate) => candidate.slotId === target.id)?.employeeId, 'javier')
})

test('availability is checked against exact slot time, not only shift name', () => {
  const weekdayPmServer: StaffingSlot = {
    id: 'weekday-pm-server',
    day: 'Monday',
    period: 'PM',
    role: 'server',
    label: 'Server',
    start: minutes(16),
    end: minutes(23),
    required: true,
  }
  const violations = validateSchedule({
    employees: [employee('javier')],
    slots: [weekdayPmServer],
    assignments: [assignment(weekdayPmServer, 'javier')],
  })

  assert.ok(violations.some((violation) => violation.code === 'unavailable_employee'))
})

test('every schedule strategy produces a valid week', () => {
  for (const strategy of SCHEDULE_STRATEGIES) {
    const result = generateSchedule({ employees: seedEmployees, template: seedTemplate }, { strategy })
    assert.equal(result.status, 'FEASIBLE', `${strategy} should be feasible`)
    assert.equal(
      validateSchedule({ employees: seedEmployees, slots, assignments: result.assignments }).length,
      0,
      `${strategy} should pass validation`,
    )
  }
})

test('the same strategy always returns the same week', () => {
  for (const strategy of SCHEDULE_STRATEGIES) {
    const first = generateSchedule({ employees: seedEmployees, template: seedTemplate }, { strategy })
    const second = generateSchedule({ employees: seedEmployees, template: seedTemplate }, { strategy })
    assert.deepEqual(second.assignments, first.assignments, `${strategy} should be deterministic`)
  }
})

test('fewest doubles strategy does not increase double shifts', () => {
  const balanced = generateSchedule({ employees: seedEmployees, template: seedTemplate }, { strategy: 'balanced' })
  const fewest = generateSchedule({ employees: seedEmployees, template: seedTemplate }, { strategy: 'fewestDoubles' })

  assert.ok(
    summarizeSchedule(seedEmployees, slots, fewest.assignments).doubles <=
      summarizeSchedule(seedEmployees, slots, balanced.assignments).doubles,
  )
})

test('keep similar strategy stays closer to the week it is given', () => {
  const previous = generateSchedule({ employees: seedEmployees, template: seedTemplate }, { strategy: 'fairHours' })
  const similar = generateSchedule(
    { employees: seedEmployees, template: seedTemplate },
    { strategy: 'similarWeek', referenceAssignments: previous.assignments },
  )
  const balanced = generateSchedule(
    { employees: seedEmployees, template: seedTemplate },
    { strategy: 'balanced', referenceAssignments: previous.assignments },
  )

  assert.ok(
    summarizeSchedule(seedEmployees, slots, similar.assignments, previous.assignments).keptFromReference >=
      summarizeSchedule(seedEmployees, slots, balanced.assignments, previous.assignments).keptFromReference,
  )
})
