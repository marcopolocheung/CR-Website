import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SHARE_VERSION,
  UnreadableShareError,
  WrongCodeError,
  decryptWeek,
  deserializePublishedWeek,
  encryptWeek,
  serializePublishedWeek,
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

test('a published week survives a round trip through a link', async () => {
  const token = await encryptWeek(week, 'break room')
  assert.deepEqual(await decryptWeek(token, 'break room'), week)
})

test('the wrong code is rejected rather than returning garbage', async () => {
  const token = await encryptWeek(week, 'break room')
  await assert.rejects(() => decryptWeek(token, 'break rooms'), WrongCodeError)
})

test('the token reveals nothing without the code', async () => {
  const token = await encryptWeek(week, 'break room')
  for (const secret of [...week.people, week.name, week.weekStart]) {
    assert.ok(!token.includes(secret), `${secret} should not appear in the token`)
  }
})

test('the same week encrypts differently every time', async () => {
  const first = await encryptWeek(week, 'break room')
  const second = await encryptWeek(week, 'break room')
  assert.notEqual(first, second, 'a fresh salt and IV should make the tokens differ')
})

test('a token stays URL safe', async () => {
  const token = await encryptWeek(week, 'break room')
  assert.match(token, /^[A-Za-z0-9_-]+$/)
  assert.equal(encodeURIComponent(token), token)
})

test('junk links fail as unreadable, not as a wrong code', async () => {
  await assert.rejects(() => decryptWeek('not-a-real-token', 'break room'), UnreadableShareError)
  await assert.rejects(() => decryptWeek('', 'break room'), UnreadableShareError)
})

test('a payload from a future format version is refused', () => {
  const future = serializePublishedWeek({ ...week, version: SHARE_VERSION + 1 })
  assert.throws(() => deserializePublishedWeek(future), UnreadableShareError)
})

test('a link stays small enough to print as a QR code', async () => {
  const fullWeek: PublishedWeek = {
    ...week,
    people: ['Mary', 'Chela', 'Pam', 'Aurora', 'Eileen', 'Stephanie', 'Emerie', 'Javier', 'Serenity', 'Desiree', 'Shorty', 'Dolores'],
    slotPeople: Array.from({ length: 52 }, (_, index) => index % 12),
  }
  const token = await encryptWeek(fullWeek, 'break room')
  assert.ok(token.length < 900, `token was ${token.length} characters`)
})

test('a real generated week survives publish, encrypt, decrypt and read back', async () => {
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

  const reopened = await decryptWeek(await encryptWeek(published, 'break room'), 'break room')

  // Every assignment the scheduler made must come back against the same slot, by name.
  const nameById = new Map(seedEmployees.map((employee) => [employee.id, employee.name]))
  for (const assignment of generated.assignments) {
    const slotIndex = slots.findIndex((slot) => slot.id === assignment.slotId)
    assert.notEqual(slotIndex, -1)
    assert.equal(reopened.people[reopened.slotPeople[slotIndex]], nameById.get(assignment.employeeId))
  }

  // Nobody is stored twice, however many shifts they work.
  assert.equal(new Set(reopened.people).size, reopened.people.length)
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

  assert.equal(published.slotPeople[0], 0)
  assert.ok(published.slotPeople.slice(1).every((index) => index === -1))
  assert.deepEqual(published.people, ['Desiree'])
})
