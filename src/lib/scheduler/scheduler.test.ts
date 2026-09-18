import assert from 'node:assert/strict'
import test from 'node:test'
import { DAYS, formatRoleLabel, isValidRoleSlug, normalizeRoleSlug, rolesForRestaurant } from './types'
import {
  defaultEmployeesForRestaurant,
  defaultTemplateForRestaurant,
  seedEmployees,
  seedKitchenEmployeesCR03,
  seedKitchenTemplateCR03,
  seedTemplate,
  expandTemplate,
} from './data'
import { SCHEDULE_STRATEGIES, generateSchedule, summarizeSchedule } from './solver'
import { validateSchedule } from './validator'
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
  assert.ok(!rolesForRestaurant('CR3-kitchen').includes('meat-prep'))
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

test('CR03 fixed crew covers every required kitchen slot', () => {
  const employees = defaultEmployeesForRestaurant('CR3-kitchen')
  assert.deepEqual(
    employees.map((employee) => employee.id).sort(),
    ['carolina', 'jeffrey', 'muk'],
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
  const cookSlots = slots.filter((slot) => slot.role === 'cook')
  assert.ok(cookSlots.length === 7)
  assert.ok(cookSlots.every((slot) => bySlot.get(slot.id) === 'muk'))
  const tueEarly = slots.find((slot) => slot.day === 'Tuesday' && slot.label === 'M/V Prep (early)')
  assert.ok(tueEarly && bySlot.get(tueEarly.id) === 'jeffrey')
  const sundayLate = slots.filter((slot) => slot.day === 'Sunday' && slot.label === 'M/V Prep (late)')
  assert.equal(sundayLate.length, 0)
})

test('CR03 kitchens never inherit the dining crew and CR02 starts empty', () => {
  const cr03 = defaultEmployeesForRestaurant('CR3-kitchen')
  assert.ok(cr03.every((employee) => !employee.roles.includes('server') && !employee.roles.includes('cashier')))
  assert.deepEqual(defaultEmployeesForRestaurant('CR2-kitchen'), [])
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
