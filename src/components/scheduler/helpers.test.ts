import assert from 'node:assert/strict'
import test from 'node:test'
import { expandTemplate, seedTemplate } from '../../lib/scheduler/data'
import { seedEmployees } from '../../lib/scheduler/seed-crews'
import { buildMovePreview, candidatesForSlot, createEmployeeId, layoutStorageKey, proposeMovedAssignments, readLayoutPreference, spotStatus, unassignableReason } from './helpers'

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
