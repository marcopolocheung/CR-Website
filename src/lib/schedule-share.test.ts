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
} from './schedule-share'

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
