import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sample, slots as fixtureSlots } from '../../components/scheduler-prototype/model'
import { AssistantStepProblem, prepareAssistantOps } from './assistant'
import { repairSchedule } from './repair'
import { validateSchedule } from './validator'

const fixture = () => ({ ...sample(), slots: fixtureSlots })

test('a call-out takes the person off every spot that date and repair refills without them', async () => {
  const input = fixture()
  const first = input.assignments[0]
  const date = fixtureSlots.find(s => s.id === first.slotId)!.date!
  const prepared = prepareAssistantOps(input, [{ type: 'callout', employeeId: first.employeeId, date }])
  const sameDay = fixtureSlots.filter(s => s.date === date)
  assert.equal(prepared.exclusions.length, sameDay.length)
  assert(!prepared.assignments.some(a => a.employeeId === first.employeeId && sameDay.some(s => s.id === a.slotId)))
  const result = await repairSchedule({ ...input, ...prepared })
  assert(!result.assignments.some(a => a.employeeId === first.employeeId && sameDay.some(s => s.id === a.slotId)))
  assert.equal(validateSchedule({ ...input, assignments: result.assignments }).length, 0)
})

test('two moves in one proposal apply in order as Keeps', () => {
  const input = fixture()
  const { assignments } = prepareAssistantOps(input, [
    { type: 'place', slotId: fixtureSlots[4].id, employeeId: 'sample-0', fromSlotId: fixtureSlots[0].id },
    { type: 'place', slotId: fixtureSlots[13].id, employeeId: 'sample-9' },
  ])
  assert(assignments.some(a => a.slotId === fixtureSlots[4].id && a.employeeId === 'sample-0' && a.locked))
  assert(assignments.some(a => a.slotId === fixtureSlots[13].id && a.employeeId === 'sample-9' && a.locked))
})

test('remove clears one spot and marks that person not-this-shift', () => {
  const input = fixture()
  const target = input.assignments[0]
  const prepared = prepareAssistantOps(input, [{ type: 'remove', slotId: target.slotId }])
  assert(!prepared.assignments.some(a => a.slotId === target.slotId))
  assert.equal(prepared.exclusions.length, 1)
})

test('a failing step names its number and nothing is applied', () => {
  const input = fixture()
  const before = JSON.stringify(input.assignments)
  const fails = (ops: Parameters<typeof prepareAssistantOps>[1], step: number, code: string) =>
    assert.throws(() => prepareAssistantOps(input, ops), (e: unknown) => e instanceof AssistantStepProblem && e.step === step && e.problem.code === code)
  fails([{ type: 'remove', slotId: input.assignments[0].slotId }, { type: 'place', slotId: fixtureSlots[1].id, employeeId: 'sample-6' }], 2, 'unqualified')
  fails([{ type: 'callout', employeeId: 'nobody', date: fixtureSlots[0].date! }], 1, 'unknown')
  fails([{ type: 'callout', employeeId: 'sample-0', date: '1999-01-01' }], 1, 'unknown')
  assert.equal(JSON.stringify(input.assignments), before)
  input.assignments[0] = { ...input.assignments[0], locked: true }
  fails([{ type: 'place', slotId: fixtureSlots[0].id, employeeId: 'sample-2' }], 1, 'keptDestination')
})
