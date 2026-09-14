import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SHARE_VERSION,
  templateHashForSlots,
  type PublishedWeek,
  buildPublishedWeek,
} from './schedule-share'
import { expandTemplate, seedEmployees, seedTemplate } from './scheduler/data'
import { generateSchedule } from './scheduler/solver'


const week: PublishedWeek = {
  version: SHARE_VERSION,
  weekStart: '2026-03-01',
  name: 'Front of house',
  people: ['Mary', 'Desiree', 'Aurora'],
  slotPeople: [0, 1, 2, -1, 0, 2, 1],
}

test('a built week carries the current share version', () => {
  const slots = expandTemplate(seedTemplate)
  const published = buildPublishedWeek({
    weekStart: '2026-03-01',
    name: 'Front of house',
    slots,
    employees: seedEmployees,
    assignments: [],
  })
  assert.equal(published.version, SHARE_VERSION)
  assert.equal(published.slotPeople.length, slots.length)
  assert.ok(published.slotPeople.every((index) => index === -1))
})

test('a real generated week maps every assignment back by name', () => {
  const slots = expandTemplate(seedTemplate)
  const generated = generateSchedule({ employees: seedEmployees, template: seedTemplate })
  assert.equal(generated.status, 'FEASIBLE')

  const published = buildPublishedWeek({
    weekStart: '2026-03-01',
    name: 'Front of house',
    slots,
    employees: seedEmployees,
    assignments: generated.assignments,
  })

  // The reader rebuilds slot order from the same template, so the lengths must line up.
  assert.equal(published.slotPeople.length, slots.length)

  // Every assignment the scheduler made must come back against the same slot, by name.
  const nameById = new Map(seedEmployees.map((employee) => [employee.id, employee.name]))
  for (const assignment of generated.assignments) {
    const slotIndex = slots.findIndex((slot) => slot.id === assignment.slotId)
    assert.notEqual(slotIndex, -1)
    assert.equal(published.people[published.slotPeople[slotIndex]], nameById.get(assignment.employeeId))
  }

  // Nobody is stored twice, however many shifts they work.
  assert.equal(new Set(published.people).size, published.people.length)

  // Anyone rostered but unscheduled still gets a row to be marked OFF against.
  assert.equal(published.people.length, seedEmployees.filter((employee) => employee.active).length)

  assert.deepEqual(week.people, ['Mary', 'Desiree', 'Aurora'])
})

test('unfilled spots travel as nobody rather than as a stray name', async () => {
  const slots = expandTemplate(seedTemplate)
  const published = buildPublishedWeek({
    weekStart: '2026-03-01',
    name: 'Half a week',
    slots,
    employees: seedEmployees,
    assignments: [{ slotId: slots[0].id, employeeId: 'desiree' }],
  })

  assert.ok(published.slotPeople.slice(1).every((index) => index === -1))
  assert.equal(published.people[published.slotPeople[0]], 'Desiree')

  // Everyone active is listed even with nothing assigned, so the reader can show them as OFF.
  assert.deepEqual(published.people, seedEmployees.filter((employee) => employee.active).map((employee) => employee.name))
})

test('the template hash is stable and changes with the shift layout', () => {
  const slots = expandTemplate(seedTemplate)
  assert.match(templateHashForSlots(slots), /^[0-9a-f]{8}$/)
  assert.equal(templateHashForSlots(slots), templateHashForSlots(expandTemplate(seedTemplate)))
  assert.notEqual(templateHashForSlots(slots), templateHashForSlots(slots.slice(1)))
})
