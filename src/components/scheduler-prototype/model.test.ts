import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dates, editAvailability, place, repair, sample, slots, violations } from './model'

test('sample is a valid fully covered Monday–Sunday week', () => {
  const state = sample()
  assert.equal(slots[0].day, 'Monday')
  assert.equal(slots[24].day, 'Sunday')
  assert.equal(violations(state).length, 0)
})
test('callout removes Keep only on the selected date, repairs and preserves other placements', async () => {
  let state = sample()
  const first = state.assignments[0]
  state.assignments[0] = { ...first, locked: true }
  const other = state.assignments.find(a => slots.find(s => s.id === a.slotId)!.date !== dates[0])!
  other.locked = true
  state = editAvailability(state, first.employeeId, dates[0], [], false)
  assert(!state.assignments.some(a => a.slotId === first.slotId))
  assert(state.assignments.some(a => a.slotId === other.slotId && a.locked))
  assert.equal(state.employees[0].recurringAvailability.Monday?.length, 1)
  const result = await repair(state)
  assert.equal(violations(result.state).length, 0)
  assert(result.state.assignments.some(a => a.slotId === other.slotId && a.employeeId === other.employeeId && a.locked))
})
test('occupied destination relocates former occupant and retains two manual placements', async () => {
  let state = sample()
  const source = state.assignments[0]
  const target = state.assignments[4]
  state = place(state, target.slotId, source.employeeId, source.slotId)
  let result = await repair(state)
  assert.equal(violations(result.state).length, 0)
  assert(result.state.assignments.find(a => a.slotId === target.slotId)?.locked)
  const destination = slots[13]
  state = place(result.state, destination.id, 'sample-9')
  result = await repair(state)
  for (const [slotId, id] of [[target.slotId, source.employeeId], [destination.id, 'sample-9']]) {
    assert(result.state.assignments.some(a => a.slotId === slotId && a.employeeId === id && a.locked))
  }
  assert.equal(violations(result.state).length, 0)
})
test('invalid placements reject and kept sources can explicitly move', () => {
  let state = sample()
  assert.throws(() => place(state, slots[1].id, 'sample-6'), /trained/)
  assert.throws(() => place(state, slots[0].id, 'sample-8'), /unavailable/)
  state = place(state, slots[0].id, 'sample-0', slots[0].id)
  assert.throws(() => place(state, slots[0].id, 'sample-2'), /Release Keep/)
  const next = place(state, slots[4].id, 'sample-0', slots[0].id)
  assert(!next.assignments.some(a => a.slotId === slots[0].id))
  assert(next.assignments.find(a => a.slotId === slots[4].id)?.locked)
})
test('partial availability and recurring edits affect the intended windows', () => {
  let state = sample()
  state = editAvailability(state, 'sample-0', dates[0], [{ start: 960, end: 1380 }], false)
  assert(!state.assignments.some(a => a.employeeId === 'sample-0' && a.slotId === slots[0].id))
  state = editAvailability(state, 'sample-0', dates[0], [], true)
  assert.deepEqual(state.employees[0].recurringAvailability.Monday, [])
  assert.equal(state.employees[0].availabilityOverrides?.length, 0)
})
test('impossible coverage reports gaps; bounded search does not claim infeasibility', async () => {
  const state = sample()
  state.employees.forEach(e => { e.roles = [] })
  const exhausted = await repair(state)
  assert.equal(exhausted.limited, false)
  assert.equal(exhausted.state.assignments.length, 0)
  const bounded = await repair(sample(), 0)
  assert.equal(bounded.limited, true)
  assert.equal(violations(bounded.state).length, 0)
})
test('a covered valid week does not reshuffle for better balance', async () => {
  const state = sample()
  const result = await repair(state)
  assert.deepEqual(new Map(result.state.assignments.map(a => [a.slotId, a.employeeId])), new Map(state.assignments.map(a => [a.slotId, a.employeeId])))
})
