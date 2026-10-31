import assert from 'node:assert/strict'
import test from 'node:test'
import { DAYS, formatRoleLabel, isValidRoleSlug, normalizeRoleSlug, rolesForRestaurant } from './types'
import {
  defaultEmployeesForRestaurant,
  defaultTemplateForRestaurant,
  seedKitchenTemplateCR03,
  seedTemplate,
  expandTemplate,
} from './data'
import { seedEmployees, seedKitchenEmployeesCR03 } from './seed-crews'
import { SCHEDULE_STRATEGIES, generateSchedule, preflightDiagnostics, summarizeSchedule } from './solver'
import { isEmployeeQualified, validateSchedule } from './validator'
import { REQUEST_POLICY, withApprovedRequests, type ScheduleRequest } from './requests'
import { dragErrorMessage } from '../../components/scheduler/helpers'
import type { Employee, ScheduleAssignment, StaffingSlot, WeeklyStaffingTemplate } from './types'
import { formatTime, formatTimeRange, minutes } from './time'
import { dateForDay, dayOfMonth, formatDayLabel, formatWeekRange, shiftWeek, weekStartFor, weeksBetween } from './week'

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

test('new hires bypass the role check but still need to be available', () => {
  const target = slot('Tuesday', 'AM', 'Cashier 1')
  const newHireEmployees = seedEmployees.map((candidate) =>
    candidate.id === 'eileen' ? { ...candidate, newHire: true } : candidate,
  )

  const violations = validateSchedule({
    employees: newHireEmployees,
    slots: [target],
    assignments: [assignment(target, 'eileen')],
  })

  assert.ok(!violations.some((violation) => violation.code === 'unqualified_employee'))

  const unavailableTarget = slot('Thursday', 'PM', 'Cashier 1')
  const unavailableViolations = validateSchedule({
    employees: newHireEmployees,
    slots: [unavailableTarget],
    assignments: [assignment(unavailableTarget, 'eileen')],
  })

  assert.ok(unavailableViolations.some((violation) => violation.code === 'unavailable_employee'))
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

test('overlapping assignment violation references both conflicting slots', () => {
  const first: StaffingSlot = {
    id: 'overlap-a',
    day: 'Monday',
    period: 'AM',
    role: 'lead',
    label: 'Shift lead',
    start: minutes(9, 30),
    end: minutes(16),
    required: true,
  }
  const second: StaffingSlot = {
    id: 'overlap-b',
    day: 'Monday',
    period: 'AM',
    role: 'lead',
    label: 'Shift lead (extra)',
    start: minutes(12),
    end: minutes(18),
    required: true,
  }
  const violations = validateSchedule({
    employees: [employee('dolores')],
    slots: [first, second],
    assignments: [assignment(first, 'dolores'), assignment(second, 'dolores')],
    requireCoverage: false,
  })

  const overlap = violations.find((violation) => violation.code === 'overlapping_assignment')
  assert.ok(overlap)
  assert.equal(overlap?.slotId, 'overlap-b')
  assert.equal(overlap?.relatedSlotId, 'overlap-a')
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

test('week keys land on Sunday regardless of the day inside the week', () => {
  // 2026-03-04 is a Wednesday; its week starts Sunday 2026-03-01.
  for (const [date, expected] of [
    ['2026-03-01', '2026-03-01'],
    ['2026-03-04', '2026-03-01'],
    ['2026-03-07', '2026-03-01'],
    ['2026-03-08', '2026-03-08'],
  ] as const) {
    const [year, month, day] = date.split('-').map(Number)
    assert.equal(weekStartFor(new Date(year, month - 1, day)), expected, date)
  }
})

test('week maths survives a daylight saving change', () => {
  // US DST starts 2026-03-08. Stepping across it must stay on Sundays.
  assert.equal(shiftWeek('2026-03-01', 1), '2026-03-08')
  assert.equal(shiftWeek('2026-03-08', -1), '2026-03-01')
  assert.equal(shiftWeek('2026-03-01', 4), '2026-03-29')
  assert.equal(weeksBetween('2026-03-01', '2026-03-29'), 4)
})

test('day dates follow the day order used by the board', () => {
  assert.equal(dateForDay('2026-03-01', 'Sunday'), '2026-03-01')
  assert.equal(dateForDay('2026-03-01', 'Saturday'), '2026-03-07')
  assert.equal(dayOfMonth('2026-03-01', 'Wednesday'), 4)
})

test('week ranges spell the month out for headings', () => {
  assert.equal(formatWeekRange('2026-09-06'), 'September 6 - 12')
  assert.equal(formatWeekRange('2026-03-01'), 'March 1 - 7')
  assert.equal(formatWeekRange('2026-03-29'), 'March 29 - April 4')
})

test('day labels abbreviate for the table header', () => {
  assert.equal(formatDayLabel('2026-09-06', 'Sunday'), 'Sun, Sep 6')
  assert.equal(formatDayLabel('2026-09-06', 'Saturday'), 'Sat, Sep 12')
  // A week that crosses a month must show the right month on each day.
  assert.equal(formatDayLabel('2026-03-29', 'Sunday'), 'Sun, Mar 29')
  assert.equal(formatDayLabel('2026-03-29', 'Wednesday'), 'Wed, Apr 1')
})

test('times always read as a padded 12 hour clock with AM or PM', () => {
  assert.equal(formatTime(minutes(9, 30)), '09:30 AM')
  assert.equal(formatTime(minutes(16)), '04:00 PM')
  assert.equal(formatTime(minutes(12)), '12:00 PM')
  assert.equal(formatTime(minutes(0)), '12:00 AM')
  // A morning and an evening shift must never render the same way.
  assert.notEqual(formatTime(minutes(4)), formatTime(minutes(16)))
  assert.equal(formatTimeRange({ start: minutes(16), end: minutes(23) }), '04:00 PM - 11:00 PM')
})

const midAvailability = [{ start: minutes(12), end: minutes(19) }]
const eveningAvailability = [{ start: minutes(16), end: minutes(19) }]

function customWorker(id: string, ranges: { start: number; end: number }[], allowDoubles: boolean): Employee {
  return {
    id,
    name: id,
    roles: ['cashier'],
    recurringAvailability: Object.fromEntries(DAYS.map((day) => [day, ranges.map((range) => ({ ...range }))])),
    maxDaysPerWeek: 7,
    allowDoubles,
    incompatibleEmployeeIds: [],
    active: true,
  }
}

function customSlot(id: string, period: 'AM' | 'PM', startHour: number, startMinute: number, endHour: number, endMinute: number): StaffingSlot {
  return {
    id,
    day: 'Monday',
    period,
    role: 'cashier',
    label: id,
    start: minutes(startHour, startMinute),
    end: minutes(endHour, endMinute),
    required: true,
  }
}

function emptyTemplate(): WeeklyStaffingTemplate {
  return Object.fromEntries(DAYS.map((day) => [day, []])) as unknown as WeeklyStaffingTemplate
}

test('mid 12-7 worker fits a 12-4 extra slot but not full AM or PM halves', () => {
  const mid = customWorker('mid', midAvailability, true)
  const midSlot = customSlot('mid-extra', 'AM', 12, 0, 16, 0)
  const fullAm = customSlot('full-am', 'AM', 9, 30, 16, 0)
  const fullPm = customSlot('full-pm', 'PM', 16, 0, 23, 0)

  assert.deepEqual(
    validateSchedule({ employees: [mid], slots: [midSlot], assignments: [assignment(midSlot, 'mid')] }),
    [],
  )
  assert.ok(
    validateSchedule({ employees: [mid], slots: [fullAm], assignments: [assignment(fullAm, 'mid')] }).some(
      (violation) => violation.code === 'unavailable_employee',
    ),
  )
  assert.ok(
    validateSchedule({ employees: [mid], slots: [fullPm], assignments: [assignment(fullPm, 'mid')] }).some(
      (violation) => violation.code === 'unavailable_employee',
    ),
  )
})

test('evening 4-7 worker fits a 4-7 extra slot but not the full 4-11 PM', () => {
  const evening = customWorker('evening', eveningAvailability, false)
  const eveningSlot = customSlot('evening-extra', 'PM', 16, 0, 19, 0)
  const fullPm = customSlot('full-pm', 'PM', 16, 0, 23, 0)

  assert.deepEqual(
    validateSchedule({ employees: [evening], slots: [eveningSlot], assignments: [assignment(eveningSlot, 'evening')] }),
    [],
  )
  assert.ok(
    validateSchedule({ employees: [evening], slots: [fullPm], assignments: [assignment(fullPm, 'evening')] }).some(
      (violation) => violation.code === 'unavailable_employee',
    ),
  )
})

test('mid worker spanning AM and PM extra slots needs doubles allowed', () => {
  const noDoubles = customWorker('mid-no-doubles', midAvailability, false)
  const allowsDoubles = customWorker('mid-doubles', midAvailability, true)
  const amExtra = customSlot('am-extra', 'AM', 12, 0, 16, 0)
  const pmExtra = customSlot('pm-extra', 'PM', 16, 0, 19, 0)

  const prohibited = validateSchedule({
    employees: [noDoubles],
    slots: [amExtra, pmExtra],
    assignments: [assignment(amExtra, 'mid-no-doubles'), assignment(pmExtra, 'mid-no-doubles')],
    requireCoverage: false,
  })
  assert.ok(prohibited.some((violation) => violation.code === 'prohibited_double'))

  assert.deepEqual(
    validateSchedule({
      employees: [allowsDoubles],
      slots: [amExtra, pmExtra],
      assignments: [assignment(amExtra, 'mid-doubles'), assignment(pmExtra, 'mid-doubles')],
      requireCoverage: false,
    }),
    [],
  )
})

test('kitchen pages offer kitchen posts only — no dining posts', () => {
  for (const restaurant of ['CR2-kitchen', 'CR3-kitchen']) {
    const roles = rolesForRestaurant(restaurant)
    assert.ok(!roles.includes('server') && !roles.includes('cashier') && !roles.includes('lead'))
    assert.ok(roles.includes('cook') && roles.includes('dishwasher') && roles.includes('shadow'))
  }
  assert.ok(rolesForRestaurant('CR2-kitchen').includes('meat-prep'))
  assert.ok(rolesForRestaurant('CR2-kitchen').includes('veggie-prep'))
  assert.ok(rolesForRestaurant('CR2-kitchen').includes('manager'))
  assert.ok(rolesForRestaurant('CR3-kitchen').includes('mv-prep'))
  assert.ok(rolesForRestaurant('CR3-kitchen').includes('meat-prep'))
  assert.ok(!rolesForRestaurant('CR3-kitchen').includes('manager'))
  assert.deepEqual(rolesForRestaurant('CR3-diningroom'), ['server', 'cashier', 'lead', 'manager'])
})

test('custom posts slugify, validate, and label for display', () => {
  assert.equal(normalizeRoleSlug('M/V Prep'), 'mv-prep')
  assert.equal(normalizeRoleSlug('  Sushi Chef '), 'sushi-chef')
  assert.ok(isValidRoleSlug('sushi-chef'))
  assert.ok(!isValidRoleSlug('Sushi Chef'))
  assert.equal(formatRoleLabel('mv-prep'), 'M/V Prep')
  assert.equal(formatRoleLabel('sushi-chef'), 'Sushi Chef')
})

test('CR03 sample crew covers every required kitchen slot', () => {
  const employees = structuredClone(seedKitchenEmployeesCR03)
  assert.equal(employees.length, 19)
  assert.deepEqual(
    employees.map((employee) => employee.id).sort(),
    [
      'alfredo',
      'carolina',
      'cris',
      'daniel',
      'eddie',
      'isaiah',
      'issac',
      'jay',
      'jayden',
      'jeffery',
      'jeremiah',
      'jeremy',
      'jerry',
      'jorge',
      'levelle',
      'michaela',
      'muk',
      'robert',
      'stef',
    ],
  )
  const requiredTemplate = Object.fromEntries(
    DAYS.map((day) => [day, seedKitchenTemplateCR03[day].filter((slot) => slot.required)]),
  ) as typeof seedKitchenTemplateCR03
  const result = generateSchedule({ employees, template: requiredTemplate })
  assert.equal(result.status, 'FEASIBLE')
  if (result.status !== 'FEASIBLE') return

  const slots = expandTemplate(requiredTemplate)
  assert.deepEqual(validateSchedule({ employees, slots, assignments: result.assignments }), [])

  const bySlot = new Map(result.assignments.map((assignment) => [assignment.slotId, assignment.employeeId]))
  // Every required spot is filled, lunch + dinner cook each day, no Sunday late prep.
  assert.ok(slots.every((slot) => bySlot.get(slot.id)))
  assert.equal(slots.filter((slot) => slot.role === 'cook').length, 14)
  assert.equal(slots.filter((slot) => slot.label === 'Line Cook (AM)' && slot.period === 'AM').length, 7)
  assert.equal(slots.filter((slot) => slot.period === 'PM' && slot.required).length, 28)
  assert.equal(slots.filter((slot) => slot.day === 'Sunday' && slot.label === 'M/V Prep (late)').length, 0)
})

test('CR03 crew carries the sheet’s post qualifications and double limits', () => {
  const employees = structuredClone(seedKitchenEmployeesCR03)
  const byId = new Map(employees.map((employee) => [employee.id, employee]))
  assert.deepEqual(byId.get('muk')?.roles, ['cook'])
  assert.deepEqual(byId.get('alfredo')?.roles, ['fried-rice'])
  assert.ok(byId.get('stef')?.roles.includes('shadow'))
  assert.ok(byId.get('cris')?.roles.includes('meat-prep'))
  // Per-person double caps from the sheet.
  assert.equal(byId.get('stef')?.maxDoublesPerWeek, 1)
  assert.equal(byId.get('jay')?.maxDoublesPerWeek, 2)
  assert.equal(byId.get('jorge')?.maxDoublesPerWeek, 1)
  // PM-only and 4-day people.
  assert.equal(byId.get('isaiah')?.maxDaysPerWeek, 4)
  assert.equal(byId.get('isaiah')?.allowDoubles, false)
  assert.equal(byId.get('jayden')?.allowDoubles, false)
  // Morning-and-night hires: no doubles, max 5 days.
  assert.equal(byId.has('alex'), false)
  assert.deepEqual(byId.get('levelle')?.roles, ['fried-rice'])
  assert.deepEqual(byId.get('michaela')?.roles, ['line-cook'])
  assert.deepEqual(byId.get('jerry')?.roles, ['line-cook'])
  for (const id of ['levelle', 'michaela', 'jerry']) {
    const hire = byId.get(id)
    assert.equal(hire?.maxDaysPerWeek, 5)
    assert.equal(hire?.allowDoubles, false)
    assert.equal(Object.keys(hire?.recurringAvailability ?? {}).length, 7)
    assert.deepEqual(hire?.recurringAvailability.Monday, [{ start: minutes(9), end: minutes(23) }])
  }
})

test('M/V prep qualification implies meat prep, but not the reverse', () => {
  const mv: Employee = { id: 'mv', name: 'MV', roles: ['mv-prep'], recurringAvailability: {}, allowDoubles: false, active: true }
  const mp: Employee = { id: 'mp', name: 'MP', roles: ['meat-prep'], recurringAvailability: {}, allowDoubles: false, active: true }
  const meatSlot: StaffingSlot = {
    id: 'meat',
    day: 'Monday',
    period: 'AM',
    role: 'meat-prep',
    label: 'Meat Prep',
    start: minutes(9),
    end: minutes(16),
    required: true,
  }
  const mvSlot: StaffingSlot = { ...meatSlot, id: 'mv', role: 'mv-prep', label: 'M/V Prep' }
  // An M/V prep worker can cover meat prep...
  assert.equal(isEmployeeQualified(mv, meatSlot), true)
  // ...but a meat-prep-only worker (Cris) cannot cover M/V prep.
  assert.equal(isEmployeeQualified(mp, mvSlot), false)
})

test('a shift role limits a person to one post on that shift only', () => {
  const anyDay = Object.fromEntries(DAYS.map((day) => [day, [{ start: minutes(9), end: minutes(23) }]]))
  const maria: Employee = {
    id: 'maria',
    name: 'Maria',
    roles: ['cook', 'dishwasher'],
    recurringAvailability: anyDay,
    allowDoubles: true,
    active: true,
    newHire: true,
    shiftRoles: [{ day: 'Tuesday', period: 'PM', role: 'dishwasher' }],
  }
  const cook: StaffingSlot = { id: 'c', day: 'Tuesday', period: 'PM', role: 'cook', label: 'Cook', start: minutes(16), end: minutes(23), required: true }
  const dish: StaffingSlot = { ...cook, id: 'd', role: 'dishwasher', label: 'Dishwasher' }
  assert.equal(isEmployeeQualified(maria, cook), false, 'shift role beats both trained roles and new-hire')
  assert.equal(isEmployeeQualified(maria, dish), true)
  assert.equal(isEmployeeQualified(maria, { ...cook, period: 'AM' }), true, 'other shifts are untouched')

  const other: Employee = { ...maria, id: 'other', name: 'Other', newHire: false, shiftRoles: undefined }
  const template = Object.fromEntries(DAYS.map((day) => [day, []])) as unknown as WeeklyStaffingTemplate
  template.Tuesday = [
    { period: 'PM', role: 'cook', label: 'Cook', start: minutes(16), end: minutes(23), required: true },
    { period: 'PM', role: 'dishwasher', label: 'Dishwasher', start: minutes(16), end: minutes(23), required: true },
  ]
  const result = generateSchedule({ employees: [maria, other], template })
  assert.notEqual(result.status, 'INFEASIBLE')
  const dishSlot = expandTemplate(template).find((slot) => slot.role === 'dishwasher')
  assert.equal(result.assignments.find((assignment) => assignment.slotId === dishSlot?.id)?.employeeId, 'maria')
})

test('optional spots are filled when a candidate exists, and left open when not', () => {
  const solo: Employee = {
    id: 'solo',
    name: 'Solo',
    roles: ['server'],
    recurringAvailability: Object.fromEntries(DAYS.map((day) => [day, [{ start: minutes(9), end: minutes(23) }]])),
    maxDaysPerWeek: 7,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
  }
  const template = Object.fromEntries(DAYS.map((day) => [day, []])) as unknown as WeeklyStaffingTemplate
  template.Monday = [
    { period: 'AM', role: 'server', label: 'Server (AM)', start: minutes(9), end: minutes(16), required: true },
    { period: 'PM', role: 'server', label: 'Server (PM)', start: minutes(16), end: minutes(23), required: false },
    { period: 'PM', role: 'cook', label: 'Cook (PM)', start: minutes(16), end: minutes(23), required: false },
  ]
  const result = generateSchedule({ employees: [solo], template })
  assert.equal(result.status, 'FEASIBLE')
  if (result.status !== 'FEASIBLE') return
  const slots = expandTemplate(template)
  const bySlot = new Map(result.assignments.map((assignment) => [assignment.slotId, assignment.employeeId]))
  const required = slots.find((slot) => slot.label === 'Server (AM)')
  const optionalServer = slots.find((slot) => slot.label === 'Server (PM)')
  const optionalCook = slots.find((slot) => slot.label === 'Cook (PM)')
  assert.ok(required && bySlot.get(required.id) === 'solo')
  // Optional spot with a qualified candidate is filled even though it is not required.
  assert.ok(optionalServer && bySlot.get(optionalServer.id) === 'solo')
  // Optional spot nobody is qualified for stays open.
  assert.ok(optionalCook && bySlot.get(optionalCook.id) === undefined)
})

test('M/V prep qualification implies meat prep, but not the reverse', () => {
  const mv: Employee = { id: 'mv', name: 'MV', roles: ['mv-prep'], recurringAvailability: {}, allowDoubles: false, active: true }
  const mp: Employee = { id: 'mp', name: 'MP', roles: ['meat-prep'], recurringAvailability: {}, allowDoubles: false, active: true }
  const meatSlot: StaffingSlot = {
    id: 'meat',
    day: 'Monday',
    period: 'AM',
    role: 'meat-prep',
    label: 'Meat Prep',
    start: minutes(9),
    end: minutes(16),
    required: true,
  }
  const mvSlot: StaffingSlot = { ...meatSlot, id: 'mv', role: 'mv-prep', label: 'M/V Prep' }
  // An M/V prep worker can cover meat prep...
  assert.equal(isEmployeeQualified(mv, meatSlot), true)
  // ...but a meat-prep-only worker (Cris) cannot cover M/V prep.
  assert.equal(isEmployeeQualified(mp, mvSlot), false)
})

test('optional spots are filled when a candidate exists, and left open when not', () => {
  const solo: Employee = {
    id: 'solo',
    name: 'Solo',
    roles: ['server'],
    recurringAvailability: Object.fromEntries(DAYS.map((day) => [day, [{ start: minutes(9), end: minutes(23) }]])),
    maxDaysPerWeek: 7,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
  }
  const template = Object.fromEntries(DAYS.map((day) => [day, []])) as unknown as WeeklyStaffingTemplate
  template.Monday = [
    { period: 'AM', role: 'server', label: 'Server (AM)', start: minutes(9), end: minutes(16), required: true },
    { period: 'PM', role: 'server', label: 'Server (PM)', start: minutes(16), end: minutes(23), required: false },
    { period: 'PM', role: 'cook', label: 'Cook (PM)', start: minutes(16), end: minutes(23), required: false },
  ]
  const result = generateSchedule({ employees: [solo], template })
  assert.equal(result.status, 'FEASIBLE')
  if (result.status !== 'FEASIBLE') return
  const slots = expandTemplate(template)
  const bySlot = new Map(result.assignments.map((assignment) => [assignment.slotId, assignment.employeeId]))
  const required = slots.find((slot) => slot.label === 'Server (AM)')
  const optionalServer = slots.find((slot) => slot.label === 'Server (PM)')
  const optionalCook = slots.find((slot) => slot.label === 'Cook (PM)')
  assert.ok(required && bySlot.get(required.id) === 'solo')
  // Optional spot with a qualified candidate is filled even though it is not required.
  assert.ok(optionalServer && bySlot.get(optionalServer.id) === 'solo')
  // Optional spot nobody is qualified for stays open.
  assert.ok(optionalCook && bySlot.get(optionalCook.id) === undefined)
})

test('max doubles per week is a hard constraint', () => {
  const employee: Employee = {
    id: 'doubler',
    name: 'Doubler',
    roles: ['server'],
    recurringAvailability: Object.fromEntries(DAYS.map((day) => [day, [{ start: minutes(9), end: minutes(23) }]])),
    maxDaysPerWeek: 7,
    allowDoubles: true,
    maxDoublesPerWeek: 1,
    incompatibleEmployeeIds: [],
    active: true,
  }
  const slots = ['Monday', 'Tuesday'].flatMap((day) =>
    (['AM', 'PM'] as const).map((period) => ({
      id: `${day}-${period}`,
      day: day as (typeof DAYS)[number],
      period,
      role: 'server',
      label: 'Server',
      start: period === 'AM' ? minutes(9) : minutes(16),
      end: period === 'AM' ? minutes(16) : minutes(23),
      required: true,
    })),
  )
  // Two double days with a cap of one is rejected.
  const twoDoubles = slots.map((slot) => ({ slotId: slot.id, employeeId: 'doubler' }))
  assert.ok(
    validateSchedule({ employees: [employee], slots, assignments: twoDoubles }).some(
      (violation) => violation.code === 'max_doubles_exceeded',
    ),
  )
  // One double day is fine.
  const oneDouble = twoDoubles.filter((assignment) => assignment.slotId.startsWith('Monday'))
  assert.deepEqual(
    validateSchedule({ employees: [employee], slots, assignments: oneDouble }).filter(
      (violation) => violation.code === 'max_doubles_exceeded',
    ),
    [],
  )
})

test('max hours per week is a hard constraint', () => {
  const capped: Employee = {
    id: 'capped',
    name: 'Capped',
    roles: ['server'],
    recurringAvailability: Object.fromEntries(DAYS.map((day) => [day, [{ start: minutes(9), end: minutes(23) }]])),
    maxDaysPerWeek: 7,
    maxHoursPerWeek: 15,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
  }
  // Three 7-hour shifts: 21h against a 15h cap.
  const slots: StaffingSlot[] = ['Monday', 'Tuesday', 'Wednesday'].map((day) => ({
    id: day,
    day: day as (typeof DAYS)[number],
    period: 'AM',
    role: 'server',
    label: 'Server',
    start: minutes(9),
    end: minutes(16),
    required: false,
  }))
  const allThree = slots.map((target) => ({ slotId: target.id, employeeId: 'capped' }))
  assert.ok(
    validateSchedule({ employees: [capped], slots, assignments: allThree, requireCoverage: false }).some(
      (violation) => violation.code === 'max_hours_exceeded',
    ),
  )
  assert.deepEqual(
    validateSchedule({ employees: [capped], slots, assignments: allThree.slice(0, 2), requireCoverage: false }).filter(
      (violation) => violation.code === 'max_hours_exceeded',
    ),
    [],
  )

  const template = Object.fromEntries(DAYS.map((day) => [day, slots.filter((target) => target.day === day).map(({ id, day, ...rest }) => rest)])) as WeeklyStaffingTemplate
  const result = generateSchedule({ employees: [capped], template })
  assert.equal(result.assignments.filter((a) => a.employeeId === 'capped').length, 2, 'solver stops at the cap')
})

test('optional spots never block readiness — only required slots are checked', () => {
  const employees = structuredClone(seedKitchenEmployeesCR03)
  const slots = expandTemplate(defaultTemplateForRestaurant('CR3-kitchen'))
  assert.ok(slots.some((slot) => !slot.required), 'kitchen template has optional cover')
  // The board checks readiness the way the solver does: required slots only.
  assert.deepEqual(
    preflightDiagnostics(
      employees,
      slots.filter((slot) => slot.required),
    ),
    [],
  )
})

test('CR03 kitchens never inherit the dining crew and no station ships a built-in crew', () => {
  const cr03 = seedKitchenEmployeesCR03
  assert.ok(cr03.every((employee) => !employee.roles.includes('server') && !employee.roles.includes('cashier')))
  // No station ships a built-in crew: names and availability stay on the Worker, behind the manager code.
  for (const station of ['CR3-diningroom', 'CR3-kitchen', 'CR2-kitchen', 'CR2-diningroom', undefined]) {
    assert.deepEqual(defaultEmployeesForRestaurant(station), [])
  }
  const cr02Roles = new Set(defaultTemplateForRestaurant('CR2-kitchen').Sunday.map((slot) => slot.role))
  assert.ok(cr02Roles.has('meat-prep') && cr02Roles.has('manager') && !cr02Roles.has('server'))
  assert.ok(!seedKitchenEmployeesCR03.some((employee) => employee.id === 'mary'))
})

test('custom roles qualify and schedule like built-in ones', () => {
  const chef: Employee = {
    id: 'sushi',
    name: 'Sushi',
    roles: ['sushi-chef'],
    recurringAvailability: Object.fromEntries(DAYS.map((day) => [day, [{ start: minutes(9), end: minutes(17) }]])),
    maxDaysPerWeek: 7,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }
  const template = emptyTemplate()
  template.Monday = [{ period: 'AM', role: 'sushi-chef', label: 'Sushi Chef', start: minutes(9), end: minutes(17), required: true }]
  const result = generateSchedule({ employees: [chef], template })
  assert.equal(result.status, 'FEASIBLE')
})

test('extra mid and evening slots schedule on top of core AM/PM coverage', () => {
  const coreAm = { ...customWorker('core-am', [{ start: minutes(9, 30), end: minutes(16) }], false), roles: ['cashier' as const] }
  const corePm = { ...customWorker('core-pm', [{ start: minutes(16), end: minutes(23) }], false), roles: ['cashier' as const] }
  const mid = customWorker('mid', midAvailability, true)
  const evening = customWorker('evening', eveningAvailability, false)
  const employees = [coreAm, corePm, mid, evening]

  const template = emptyTemplate()
  template.Monday = [
    { period: 'AM', role: 'cashier', label: 'Cashier 1', start: minutes(10, 30), end: minutes(16), required: true },
    { period: 'AM', role: 'cashier', label: 'Mid support', start: minutes(12), end: minutes(16), required: true },
    { period: 'PM', role: 'cashier', label: 'Cashier 1', start: minutes(16), end: minutes(23), required: true },
    { period: 'PM', role: 'cashier', label: 'Evening support', start: minutes(16), end: minutes(19), required: true },
  ]

  const result = generateSchedule({ employees, template })
  assert.equal(result.status, 'FEASIBLE')
  if (result.status !== 'FEASIBLE') return

  const slotsForCheck = expandTemplate(template)
  assert.deepEqual(validateSchedule({ employees, slots: slotsForCheck, assignments: result.assignments }), [])

  const bySlot = new Map(result.assignments.map((candidate) => [candidate.slotId, candidate.employeeId]))
  const slotIdFor = (label: string, period: 'AM' | 'PM') =>
    slotsForCheck.find((candidate) => candidate.label === label && candidate.period === period)?.id ?? ''
  // Core halves stay with full-half workers; extras go to the custom-hour workers.
  assert.equal(bySlot.get(slotIdFor('Cashier 1', 'AM')), 'core-am')
  assert.equal(bySlot.get(slotIdFor('Cashier 1', 'PM')), 'core-pm')
  assert.equal(bySlot.get(slotIdFor('Mid support', 'AM')), 'mid')
  assert.equal(bySlot.get(slotIdFor('Evening support', 'PM')), 'evening')
})

test('suspended employees are skipped only on dates inside the range', () => {
  const server = (id: string, extra: Partial<Employee> = {}): Employee => ({
    id,
    name: id,
    roles: ['server'],
    recurringAvailability: Object.fromEntries(DAYS.map((day) => [day, [{ start: minutes(9), end: minutes(23) }]])),
    maxDaysPerWeek: 7,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
    ...extra,
  })
  const template = Object.fromEntries(DAYS.map((day) => [day, []])) as unknown as WeeklyStaffingTemplate
  template.Monday = [{ period: 'AM', role: 'server', label: 'Server', start: minutes(9), end: minutes(16), required: true }]
  template.Wednesday = [{ period: 'AM', role: 'server', label: 'Server', start: minutes(9), end: minutes(16), required: true }]
  // Week of 2026-10-11: Monday is 10-12, Wednesday is 10-14.
  const suspended = server('sus', { suspendedFrom: '2026-10-12', suspendedUntil: '2026-10-13', priority: 1 })
  const result = generateSchedule({ employees: [suspended, server('backup')], template, weekStart: '2026-10-11' })
  assert.equal(result.status, 'FEASIBLE')
  if (result.status !== 'FEASIBLE') return
  const slots = expandTemplate(template, '2026-10-11')
  const byDay = new Map(result.assignments.map((a) => [slots.find((s) => s.id === a.slotId)?.day, a.employeeId]))
  assert.equal(byDay.get('Monday'), 'backup')
  assert.equal(byDay.get('Wednesday'), 'sus', 'back after the range ends, and priority 1 wins')

  // Without a week the suspension cannot be dated, so nothing is blocked.
  const undated = generateSchedule({ employees: [suspended], template })
  assert.equal(undated.status, 'FEASIBLE')
  // With a week, the only person being suspended makes Monday impossible.
  assert.equal(generateSchedule({ employees: [suspended], template, weekStart: '2026-10-11' }).status, 'INFEASIBLE')
})

test('higher priority staff are picked first for required and optional spots', () => {
  const server = (id: string, priority?: number): Employee => ({
    id,
    name: id,
    roles: ['server'],
    recurringAvailability: { Monday: [{ start: minutes(9), end: minutes(23) }] },
    maxDaysPerWeek: 7,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
    priority,
  })
  const template = Object.fromEntries(DAYS.map((day) => [day, []])) as unknown as WeeklyStaffingTemplate
  template.Monday = [
    { period: 'AM', role: 'server', label: 'Server', start: minutes(9), end: minutes(16), required: true },
    { period: 'PM', role: 'server', label: 'Extra', start: minutes(16), end: minutes(23), required: false },
  ]
  // Alphabetical tiebreak would pick "a" first; priority must override it.
  const result = generateSchedule({ employees: [server('a', 5), server('b'), server('c', 1)], template })
  assert.equal(result.status, 'FEASIBLE')
  if (result.status !== 'FEASIBLE') return
  const slots = expandTemplate(template)
  const bySlot = new Map(result.assignments.map((a) => [slots.find((s) => s.id === a.slotId)?.label, a.employeeId]))
  assert.equal(bySlot.get('Server'), 'c')
  assert.equal(bySlot.get('Extra'), 'b')
})

test('only approved dated requests change generation and manual validation; suspension stays separate', () => {
  const server = (id: string, extra: Partial<Employee> = {}): Employee => ({
    id, name: id, roles: ['server'], maxDaysPerWeek: 7, allowDoubles: true, incompatibleEmployeeIds: [], active: true,
    recurringAvailability: Object.fromEntries(DAYS.map((day) => [day, [{ start: minutes(9), end: minutes(23) }]])), ...extra,
  })
  const request = (status: ScheduleRequest['status'], patch: Partial<ScheduleRequest> = {}): ScheduleRequest => ({
    id: `request-${status}`, employee: { stationId: 'CR3-diningroom', sourceEmployeeId: 'ana', name: 'ana' },
    kind: 'time-off', startDate: '2026-10-12', endDate: '2026-10-12', ranges: [], reason: '',
    requestedAt: '2026-10-01T12:00:00.000Z', enteredAt: '2026-10-01T13:00:00.000Z', enteredBy: 'Manager',
    policyVersion: REQUEST_POLICY, status, review: status === 'pending' ? null : { by: 'Manager', at: '2026-10-02T12:00:00.000Z', reason: '' }, ...patch,
  })
  const data = (...requests: ScheduleRequest[]) => ({ version: 1 as const, stationId: 'CR3-diningroom' as const, requests })
  const template = Object.fromEntries(DAYS.map((day) => [day, []])) as unknown as WeeklyStaffingTemplate
  template.Monday = [{ period: 'AM', role: 'server', label: 'Server', start: minutes(9), end: minutes(16), required: true }]
  template.Wednesday = [{ period: 'AM', role: 'server', label: 'Server', start: minutes(9), end: minutes(16), required: true }]
  const week = '2026-10-11' // Monday 10-12, Wednesday 10-14
  const weekSlots = expandTemplate(template, week)
  const monday = weekSlots.find((s) => s.day === 'Monday')!
  const roster = [server('ana', { priority: 1 }), server('backup')]
  const mondayPick = (employees: Employee[]) => {
    const result = generateSchedule({ employees, template, weekStart: week })
    assert.equal(result.status, 'FEASIBLE')
    return result.assignments.find((a) => a.slotId === monday.id)?.employeeId
  }
  const manualProblems = (employees: Employee[]) =>
    validateSchedule({ employees, slots: [monday], assignments: [assignment(monday, 'ana')] }).map((v) => v.code)

  // Scenario 1: identical shift, only the approved request blocks it.
  for (const status of ['pending', 'declined'] as const) {
    const employees = withApprovedRequests(roster, data(request(status)), week)
    assert.equal(mondayPick(employees), 'ana')
    assert.deepEqual(manualProblems(employees), [])
  }
  const approved = withApprovedRequests(roster, data(request('approved')), week)
  assert.equal(mondayPick(approved), 'backup')
  assert.deepEqual(manualProblems(approved), ['unavailable_employee'])
  assert.equal(roster[0].availabilityOverrides, undefined, 'saved staff list is never mutated')
  assert.deepEqual(withApprovedRequests(roster, data(request('approved')), '2026-10-18'), roster, 'other weeks unaffected')

  // Temporary availability replaces hours only on its dates, both narrowing and widening.
  const narrowed = withApprovedRequests(roster, data(request('approved', { kind: 'availability', ranges: [{ start: minutes(9), end: minutes(12) }] })), week)
  assert.deepEqual(manualProblems(narrowed), ['unavailable_employee'])
  const unavailable = [server('ana', { recurringAvailability: {} })]
  const widened = withApprovedRequests(unavailable, data(request('approved', { kind: 'availability', ranges: [{ start: minutes(8), end: minutes(17) }] })), week)
  assert.deepEqual(manualProblems(unavailable), ['unavailable_employee'])
  assert.deepEqual(manualProblems(widened), [])

  // Scenario 2: actionable coverage warning and a message that names the request, not a suspension.
  const alone = withApprovedRequests([server('ana')], data(request('approved')), week)
  assert.ok(preflightDiagnostics(alone, weekSlots).some((d) => d.code === 'no_server_candidate' && d.day === 'Monday'))
  const offMessage = dragErrorMessage(alone[0], monday, validateSchedule({ employees: alone, slots: [monday], assignments: [assignment(monday, 'ana')] }), week, weekSlots)
  assert.match(offMessage, /approved time off on 2026-10-12/)
  assert.doesNotMatch(offMessage, /suspended/)
  const suspendedToo = withApprovedRequests([server('ana', { suspendedFrom: '2026-10-12' })], data(request('approved')), week)
  assert.match(dragErrorMessage(suspendedToo[0], monday, [{ code: 'unavailable_employee', message: '' }], week, weekSlots), /suspended on 2026-10-12/)

  // Scenario 3: a kept spot that conflicts with a new approval is reported, not silently dropped.
  const kept = generateSchedule({ employees: approved, template, weekStart: week }, { existingAssignments: [assignment(monday, 'ana', true)] })
  assert.equal(kept.status, 'INFEASIBLE')
  assert.ok(kept.diagnostics.some((d) => d.code === 'invalid_locked_assignment' && d.slotId === monday.id))
  assert.equal(generateSchedule({ employees: withApprovedRequests(roster, data(request('pending')), week), template, weekStart: week },
    { existingAssignments: [assignment(monday, 'ana', true)] }).status, 'FEASIBLE')
})
