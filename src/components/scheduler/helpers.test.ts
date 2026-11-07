import assert from 'node:assert/strict'
import test from 'node:test'
import { expandTemplate, seedTemplate } from '../../lib/scheduler/data'
import { seedEmployees } from '../../lib/scheduler/seed-crews'
import { validateSchedule, type Employee, type StaffingSlot } from '../../lib/scheduler'
import { buildMovePreview, candidatesForSlot, createEmployeeId, layoutStorageKey, parseMaxHours, proposeMovedAssignments, readLayoutPreference, spotStatus, unassignableReason } from './helpers'

const slots = expandTemplate(seedTemplate, '2026-10-11')
const [first, second] = slots
const employees = seedEmployees

test('moving onto a filled spot swaps the two people and drops their Keep', () => {
  const assignments = [
    { slotId: first.id, employeeId: 'a', locked: true },
    { slotId: second.id, employeeId: 'b' },
  ]
  const moved = proposeMovedAssignments({ employeeId: 'a', fromSlotId: first.id }, assignments, second.id)
  assert.deepEqual(
    moved.map(({ slotId, employeeId, locked }) => [slotId, employeeId, Boolean(locked)]),
    [
      [first.id, 'b', false],
      [second.id, 'a', false],
    ],
  )
})

test('moving onto an empty spot leaves the old spot empty', () => {
  const moved = proposeMovedAssignments({ employeeId: 'a', fromSlotId: first.id }, [{ slotId: first.id, employeeId: 'a' }], second.id)
  assert.deepEqual(moved, [{ slotId: second.id, employeeId: 'a' }])
})

function kitchenSwap(replacement: Partial<Employee> = {}, unrelatedIssue = false) {
  const availability = { Sunday: [{ start: 540, end: 1380 }] }
  const crew: Employee[] = [
    { id: 'cook', name: 'Cook', roles: ['cook', 'dishwasher'], active: true, newHire: false, allowDoubles: false, recurringAvailability: availability },
    { id: 'dishwasher', name: 'Dishwasher', roles: ['dishwasher'], active: true, newHire: false, allowDoubles: false, recurringAvailability: availability, ...replacement },
  ]
  const kitchenSlots: StaffingSlot[] = [
    { id: 'cook-am', day: 'Sunday', period: 'AM', role: 'cook', label: 'Cook', start: 540, end: 960, required: true },
    { id: 'dishwasher-pm', day: 'Sunday', period: 'PM', role: 'dishwasher', label: 'Dishwasher', start: 1020, end: 1380, required: true },
  ]
  const assignments = [
    { slotId: 'cook-am', employeeId: 'cook' },
    { slotId: 'dishwasher-pm', employeeId: 'dishwasher' },
  ]
  if (unrelatedIssue) {
    crew.push({ ...crew[0], id: 'unrelated', name: 'Unrelated employee', roles: ['dishwasher'] })
    kitchenSlots.push({ ...kitchenSlots[0], id: 'unrelated-cook', day: 'Monday' })
    assignments.push({ slotId: 'unrelated-cook', employeeId: 'unrelated' })
  }
  const move = { employeeId: 'cook', fromSlotId: 'cook-am' }
  return {
    preview: buildMovePreview({
      move, targetSlotId: 'dishwasher-pm', employees: crew, slots: kitchenSlots, assignments,
      assignmentMap: new Map(assignments.map((assignment) => [assignment.slotId, assignment])), weekStart: '2026-11-01',
    }),
    violations: validateSchedule({ employees: crew, slots: kitchenSlots, assignments: proposeMovedAssignments(move, assignments, 'dishwasher-pm') }),
  }
}

test('a swap rejects moving a dishwasher into the cook spot and names the dishwasher', () => {
  const { preview, violations } = kitchenSwap()
  assert.ok(violations.some((violation) => violation.code === 'unqualified_employee'))
  assert.equal(preview?.status, 'invalid')
  assert.match(preview?.message ?? '', /Dishwasher is not trained for Cook/)
})

test('a swap checks the replacement employee availability at the source spot', () => {
  const { preview, violations } = kitchenSwap({ roles: ['cook', 'dishwasher'], recurringAvailability: { Sunday: [{ start: 1020, end: 1380 }] } })
  assert.ok(violations.some((violation) => violation.code === 'unavailable_employee'))
  assert.equal(preview?.status, 'invalid')
  assert.match(preview?.message ?? '', /Dishwasher is not free/)
})

test('a swap checks the replacement employee weekly limits', () => {
  const { preview, violations } = kitchenSwap({ roles: ['cook', 'dishwasher'], maxHoursPerWeek: 6 })
  assert.ok(violations.some((violation) => violation.code === 'max_hours_exceeded'))
  assert.equal(preview?.status, 'invalid')
  assert.match(preview?.message ?? '', /Dishwasher is limited to 6 hours/)
})

test('a swap accepts two qualified available employees', () => {
  const { preview, violations } = kitchenSwap({ roles: ['cook', 'dishwasher'] })
  assert.deepEqual(violations, [])
  assert.equal(preview?.status, 'valid')
})

test('unrelated existing issues do not block a valid swap', () => {
  const { preview, violations } = kitchenSwap({ roles: ['cook', 'dishwasher'] }, true)
  assert.ok(violations.some((violation) => violation.employeeId === 'unrelated'))
  assert.equal(preview?.status, 'valid')
})

test('a person marked Keep cannot be moved', () => {
  const assignment = { slotId: first.id, employeeId: employees[0].id, locked: true }
  const preview = buildMovePreview({
    move: { employeeId: employees[0].id, fromSlotId: first.id },
    targetSlotId: second.id,
    employees,
    slots,
    assignments: [assignment],
    assignmentMap: new Map([[first.id, assignment]]),
    weekStart: '2026-10-11',
  })
  assert.equal(preview?.status, 'invalid')
  assert.match(preview?.message ?? '', /marked Keep/)
})

test('candidates are exactly the people with no reason to refuse the spot', () => {
  const candidates = candidatesForSlot({ slot: first, employees, slots, assignments: [] })
  for (const employee of employees) {
    const reason = unassignableReason({ slot: first, employee, employees, slots, assignments: [] })
    assert.equal(candidates.includes(employee), reason === null, `${employee.name}: ${reason}`)
  }
  const off = { ...employees[0], active: false }
  assert.equal(unassignableReason({ slot: first, employee: off, employees: [off], slots, assignments: [] }), 'off the list')
})

test('an empty optional spot is open, an empty required spot is missing', () => {
  assert.equal(spotStatus({ hasEmployee: false, hasSchedule: true, optional: true, violations: [] }), 'open')
  assert.equal(spotStatus({ hasEmployee: false, hasSchedule: true, optional: false, violations: [] }), 'missing')
  assert.equal(spotStatus({ hasEmployee: false, hasSchedule: false, violations: [] }), 'idle')
})

test('new employee ids never collide', () => {
  const taken = [{ ...employees[0], id: 'mary' }, { ...employees[0], id: 'mary-2' }]
  assert.equal(createEmployeeId(' Mary ', taken), 'mary-3')
  assert.equal(createEmployeeId('!!!', []), 'new-employee')
})

test('layout preference defaults to new, keeps a stored classic choice, and survives blocked storage', () => {
  const globals = globalThis as unknown as { window?: { localStorage: { getItem: (key: string) => string | null } } }
  assert.equal(readLayoutPreference(), 'new', 'no browser storage means the new default')
  const stored = new Map<string, string>()
  globals.window = {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
    },
  }
  try {
    assert.equal(readLayoutPreference(), 'new')
    stored.set(layoutStorageKey, 'classic')
    assert.equal(readLayoutPreference(), 'classic')
    stored.set(layoutStorageKey, 'new')
    assert.equal(readLayoutPreference(), 'new')
  } finally {
    delete globals.window
  }
  globals.window = {
    localStorage: {
      getItem: () => {
        throw new Error('storage blocked')
      },
    },
  }
  try {
    assert.equal(readLayoutPreference(), 'new')
  } finally {
    delete globals.window
  }
})

test('max hours: blank is no limit, otherwise whole hours from 1 to 80', () => {
  assert.equal(parseMaxHours(''), undefined)
  assert.equal(parseMaxHours('30'), 30)
  assert.equal(parseMaxHours('0'), 1)
  assert.equal(parseMaxHours('200'), 80)
  assert.equal(parseMaxHours('12.5'), 12)
})
