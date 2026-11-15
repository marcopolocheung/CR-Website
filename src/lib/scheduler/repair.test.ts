import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sample, slots as fixtureSlots, dates } from '../../components/scheduler-prototype/model'
import { preparePlacement, reconcileAvailability, repairSchedule, retainValidAssignments, RepairProblem } from './repair'
import { DraftJob } from './draft-job'
import { validateSchedule } from './validator'
import type { Employee, StaffingSlot } from './types'
import { DAYS } from './types'
import { dateForDay } from './week'

const fixture = () => ({ ...sample(), slots: fixtureSlots })
test('occupied placement repairs without a forced swap, preserving multiple Keeps', async () => {
  const input = fixture()
  const next = preparePlacement(input, { slotId: fixtureSlots[4].id, employeeId: 'sample-0', fromSlotId: fixtureSlots[0].id })
  const second = preparePlacement({ ...input, assignments: next }, { slotId: fixtureSlots[13].id, employeeId: 'sample-9' })
  const result = await repairSchedule({ ...input, assignments: second })
  assert.equal(result.openRequiredSlotIds.length, 0)
  assert.equal(result.assignments.filter(a => a.locked).length, 2)
  assert.equal(validateSchedule({ ...input, assignments: result.assignments }).length, 0)
})
test('manual placement rejects role/availability conflicts and kept destinations, but can move kept sources', () => {
  const input = fixture()
  assert.throws(() => preparePlacement(input, { slotId: fixtureSlots[1].id, employeeId: 'sample-6' }), (e: unknown) => e instanceof RepairProblem && e.code === 'unqualified')
  assert.throws(() => preparePlacement(input, { slotId: fixtureSlots[0].id, employeeId: 'sample-8' }), (e: unknown) => e instanceof RepairProblem && e.code === 'unavailable')
  input.assignments[0] = { ...input.assignments[0], locked: true }
  assert.throws(() => preparePlacement(input, { slotId: fixtureSlots[0].id, employeeId: 'sample-2' }), /keptDestination/)
  assert(preparePlacement(input, { slotId: fixtureSlots[4].id, employeeId: 'sample-0', fromSlotId: fixtureSlots[0].id }).some(a => a.slotId === fixtureSlots[4].id && a.locked))
})
test('approval reconciliation releases only newly unavailable Keeps in its employee/date scope', async () => {
  const input = fixture()
  input.assignments[0] = { ...input.assignments[0], locked: true }
  input.assignments[4] = { ...input.assignments[4], locked: true }
  input.employees[0].availabilityOverrides = [{ date: dates[0], ranges: [] }]
  const assignments = reconcileAvailability(input, 'sample-0', dates[0], dates[0])
  assert(!assignments.some(a => a.slotId === fixtureSlots[0].id))
  assert(assignments.some(a => a.slotId === fixtureSlots[4].id && a.locked))
  assert.equal((await repairSchedule({ ...input, assignments })).openRequiredSlotIds.length, 0)
})
test('unrelated invalid Keeps remain actionable, never silently dropped', async () => {
  const input = fixture()
  input.assignments[0] = { ...input.assignments[0], locked: true }
  input.employees[0].active = false
  assert.throws(() => retainValidAssignments(input), /keptConflict/)
  await assert.rejects(repairSchedule(input), /keptConflict/)
})
test('dropping onto the same employee is a no-op, including another shift and a kept destination', () => {
  const input = fixture()
  const source = input.assignments[0]
  const target = input.assignments.find(a => a.employeeId === source.employeeId && a.slotId !== source.slotId)!
  const before = structuredClone(input.assignments)
  assert.deepEqual(preparePlacement(input, { slotId: target.slotId, employeeId: source.employeeId, fromSlotId: source.slotId }), before)
  target.locked = true
  assert.deepEqual(preparePlacement(input, { slotId: target.slotId, employeeId: source.employeeId, fromSlotId: source.slotId }), input.assignments)
  assert(input.assignments.some(a => a.slotId === source.slotId && a.employeeId === source.employeeId))
})
test('valid week remains unchanged and a zero-node limit retains a valid partial fallback', async () => {
  const input = fixture()
  assert.deepEqual((await repairSchedule(input)).assignments, input.assignments)
  input.assignments.pop()
  const result = await repairSchedule(input, { maxNodes: 0 })
  assert(result.limited)
  assert.equal(result.openRequiredSlotIds.length, 1)
  assert.deepEqual(result.assignments, input.assignments)
})
test('required coverage may displace unlocked optional cover; optional Keeps are preserved', async () => {
  const employee: Employee = { id: 'one', name: 'One', roles: ['server'], recurringAvailability: { Sunday: [{ start: 500, end: 1000 }] }, active: true, allowDoubles: false }
  const required: StaffingSlot = { id: 'required', day: 'Sunday', date: '2026-11-15', period: 'AM', role: 'server', label: 'Required', start: 600, end: 900, required: true }
  const input = { employees: [employee], slots: [required, { ...required, id: 'optional', required: false }], assignments: [{ slotId: 'optional', employeeId: 'one' }] }
  const result = await repairSchedule(input)
  assert.deepEqual(result.assignments, [{ slotId: 'required', employeeId: 'one' }])
  const kept = await repairSchedule({ ...input, assignments: [{ ...input.assignments[0], locked: true }] })
  assert.deepEqual(kept.openRequiredSlotIds, ['required'])
  assert.equal(kept.assignments[0].slotId, 'optional')
})
test('repair respects all independent hard constraints and reports impossible coverage as gaps', async () => {
  const input = fixture()
  input.employees = input.employees.map(e => ({ ...e, maxHoursPerWeek: 7, maxDaysPerWeek: 1, maxShiftsPerWeek: 1, allowDoubles: false }))
  const result = await repairSchedule(input, { maxNodes: 300 })
  assert(result.openRequiredSlotIds.length > 0)
  assert.equal(validateSchedule({ ...input, assignments: result.assignments, requireCoverage: false }).length, 0)
})
test('cancellation and replaced/context-changed jobs cannot commit', async () => {
  const input = fixture(); input.assignments.pop()
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(repairSchedule(input, { signal: controller.signal }), { name: 'AbortError' })
  const jobs = new DraftJob()
  const old = jobs.begin('station:week:draft:requests')
  assert(!jobs.canCommit(old, 'other-week'))
  const current = jobs.begin('other-week')
  assert(old.controller.signal.aborted)
  assert(!jobs.canCommit(old, old.key))
  jobs.finish(old)
  assert(jobs.canCommit(current, current.key))
  jobs.cancel()
  assert(!jobs.canCommit(current, current.key))
})

test('a full-sized kitchen week repairs a gap without changing other placements', async () => {
  const roles = ['cook', 'line-cook', 'fried-rice', 'dishwasher']
  const employees: Employee[] = Array.from({ length: 32 }, (_, i) => ({
    id: `fixture-${i}`, name: `Fixture ${i}`, roles: [roles[i % 4]], active: true, allowDoubles: false,
    maxDaysPerWeek: 5, maxHoursPerWeek: 35,
    recurringAvailability: Object.fromEntries(DAYS.map(day => [day, [{ start: 570, end: 1380 }]])),
  }))
  const slots: StaffingSlot[] = DAYS.flatMap(day => (['AM', 'PM'] as const).flatMap(period => roles.map(role => ({
    id: `${day}-${period}-${role}`, day, date: dateForDay('2026-11-15', day), period, role, label: role, required: true,
    start: period === 'AM' ? 570 : 960, end: period === 'AM' ? 960 : 1380,
  }))))
  const assignments = slots.map((slot, i) => ({ slotId: slot.id, employeeId: employees[i % 32].id, locked: i === 20 }))
  const missing = assignments.pop()!
  const input = { employees, slots, assignments }
  const result = await repairSchedule(input)
  assert.equal(result.openRequiredSlotIds.length, 0)
  assert.equal(result.changes.length, 1)
  assert.equal(result.changes[0].slotId, missing.slotId)
  assert.equal(validateSchedule({ ...input, assignments: result.assignments }).length, 0)
  assert(result.assignments.some(a => a.slotId === assignments[20].slotId && a.locked))
})
