import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SHARE_VERSION,
  layoutForWeek,
  layoutForPublication,
  publishedWeekFingerprint,
  assignmentsFromPublishedWeek,
  templateHashForSlots,
  type PublishedWeek,
  buildPublishedWeek,
} from './schedule-share'
import { defaultTemplateForRestaurant, expandTemplate, seedTemplate } from './scheduler/data'
import { seedEmployees } from './scheduler/seed-crews'
import { generateSchedule } from './scheduler/solver'
import { buildScheduleSnapshot, validScheduleSnapshot } from './schedule-snapshot'


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

test('a published week round-trips back into editor assignments', () => {
  const slots = expandTemplate(seedTemplate)
  const generated = generateSchedule({ employees: seedEmployees, template: seedTemplate })
  assert.equal(generated.status, 'FEASIBLE')

  const published = buildPublishedWeek({
    weekStart: '2026-03-01',
    name: 'Round trip',
    slots,
    employees: seedEmployees,
    assignments: generated.assignments,
  })
  const back = assignmentsFromPublishedWeek({ slots, employees: seedEmployees, published })
  assert.equal(back.length, generated.assignments.length)
  const bySlot = new Map(back.map((assignment) => [assignment.slotId, assignment.employeeId]))
  for (const assignment of generated.assignments) {
    assert.equal(bySlot.get(assignment.slotId), assignment.employeeId)
  }
})

test('removed staff come back unassigned instead of misfiled', () => {
  const slots = expandTemplate(seedTemplate)
  const published = buildPublishedWeek({
    weekStart: '2026-03-01',
    name: 'Eleven left',
    slots,
    employees: seedEmployees,
    assignments: [{ slotId: slots[0].id, employeeId: seedEmployees[0].id }],
  })
  const withoutFirst = seedEmployees.slice(1)
  const back = assignmentsFromPublishedWeek({ slots, employees: withoutFirst, published })
  assert.deepEqual(back, [])
})

test('the template hash is stable and changes with the shift layout', () => {
  const slots = expandTemplate(seedTemplate)
  assert.match(templateHashForSlots(slots), /^[0-9a-f]{8}$/)
  assert.equal(templateHashForSlots(slots), templateHashForSlots(expandTemplate(seedTemplate)))
  assert.notEqual(templateHashForSlots(slots), templateHashForSlots(slots.slice(1)))
})

test('a kitchen week published with the default kitchen rules opens on /schedule', () => {
  // The editor publishes with dated slots; the viewer reads with undated ones — the hash must agree.
  const published = templateHashForSlots(expandTemplate(defaultTemplateForRestaurant('CR3-kitchen'), '2026-10-11'))
  assert.equal(layoutForWeek([null], 'CR3-kitchen', published).matches, true)
  // The dining-room layout is not a stand-in for a kitchen station.
  assert.equal(layoutForWeek([null], 'CR3-diningroom', published).matches, false)
})

test('a kitchen week published before kitchen posts existed still opens', () => {
  const published = templateHashForSlots(expandTemplate(seedTemplate, '2026-09-13'))
  const { slots, matches } = layoutForWeek([null, null], 'CR3-kitchen', published)
  assert.equal(matches, true)
  assert.equal(templateHashForSlots(slots), published)
})

test('a week published with its own saved rules is read with those rules', () => {
  const custom = { ...seedTemplate, Monday: seedTemplate.Monday.slice(1) }
  const published = templateHashForSlots(expandTemplate(custom, '2026-10-11'))
  assert.equal(layoutForWeek([custom], 'CR3-diningroom', published).matches, true)
  assert.equal(layoutForWeek([null], 'CR3-diningroom', published).matches, false)
})

test('publication snapshots pin times and index order independently of changed rules', () => {
  const original = expandTemplate(seedTemplate, '2026-11-22')
  const snapshot = buildScheduleSnapshot(original)
  const doc = { snapshot, templateHash: templateHashForSlots(original), week: { slotPeople: original.map(() => -1) } }
  const changed = structuredClone(seedTemplate)
  changed.Thursday = []
  changed.Wednesday = changed.Wednesday.map(slot => ({ ...slot, end: Math.min(slot.end, 1140) }))
  const layout = layoutForPublication(doc, [changed], 'CR3-diningroom')
  assert.equal(layout.matches, true)
  assert.deepEqual(layout.slots.map(slot => slot.id), original.map(slot => slot.id))
  assert.equal(layout.slots[0].end, original[0].end)
  assert.ok(layout.slots.every(slot => !('date' in slot)))
  original[0].end -= 60
  assert.notEqual(snapshot.slots[0].end, original[0].end, 'snapshot does not share mutable slot objects')
})

test('time-only edits change the publication fingerprint without changing slot identity', () => {
  const slots = expandTemplate(seedTemplate)
  const before = buildScheduleSnapshot(slots)
  const after = buildScheduleSnapshot(slots.map((slot, index) => index === 0 ? { ...slot, end: slot.end - 60 } : slot))
  assert.equal(templateHashForSlots(before.slots), templateHashForSlots(after.slots))
  assert.notEqual(publishedWeekFingerprint(week, before), publishedWeekFingerprint(week, after))
  assert.equal(publishedWeekFingerprint(week, before), publishedWeekFingerprint(week, { ...before, basis: 'legacy-captured' }))
})

test('invalid or unknown snapshots fail closed even when normal rules match', () => {
  const slots = expandTemplate(seedTemplate)
  const valid = buildScheduleSnapshot(slots)
  const doc = { snapshot: valid, templateHash: templateHashForSlots(slots), week: { slotPeople: slots.map(() => -1) } }
  assert.equal(validScheduleSnapshot(valid, slots.length), true)
  for (const snapshot of [null, { ...valid, version: 2 }, { ...valid, slots: valid.slots.slice(1) },
    { ...valid, slots: valid.slots.map((s, index) => index === 1 ? { ...s, id: valid.slots[0].id } : s) },
    { ...valid, slots: valid.slots.map((s, index) => index === 0 ? { ...s, end: s.start } : s) }]) {
    assert.equal(validScheduleSnapshot(snapshot, slots.length), false)
    assert.deepEqual(layoutForPublication({ ...doc, snapshot: snapshot as typeof valid }, [seedTemplate]), { slots: [], matches: false })
  }
})
