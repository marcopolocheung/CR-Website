import assert from 'node:assert/strict'
import test from 'node:test'
import handler, {
  goldenMonthsForWeek,
  goldenWeeksForMonth,
  isValidId,
  newShareId,
  validateGoldenWeekBody,
  validatePublishBody,
  validateUpdateBody,
} from './index'

function mockEnv(token = 'manager-token') {
  const data = new Map<string, string>()
  return {
    SCHEDULES: {
      async get(key: string) {
        return data.get(key) ?? null
      },
      async put(key: string, value: string) {
        data.set(key, value)
      },
    },
    SCHEDULE_WRITE_TOKEN: token,
  }
}

function request(method: string, path: string, body?: unknown): Request {
  return new Request(`https://api.test${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

test('share ids are short, url safe, and valid', () => {
  for (let i = 0; i < 25; i += 1) {
    const id = newShareId()
    assert.match(id, /^[A-Za-z0-9_-]{10}$/)
    assert.ok(isValidId(id))
    assert.equal(encodeURIComponent(id), id)
  }
  assert.equal(isValidId('short'), false)
  assert.equal(isValidId('not-a-real-token'), false)
})

test('publish bodies are strictly validated', () => {
  assert.ok(validatePublishBody({ ciphertext: 'abcDEF123-_', templateHash: 'a1b2c3d4', weekStart: '2026-09-13' }))
  assert.equal(validatePublishBody({ ciphertext: '', templateHash: 'a1b2', weekStart: '2026-09-13' }), null)
  assert.equal(validatePublishBody({ ciphertext: 'has space', templateHash: 'a1b2', weekStart: '2026-09-13' }), null)
  assert.equal(validatePublishBody({ ciphertext: 'abc', templateHash: 'ZZZ', weekStart: '2026-09-13' }), null)
  assert.equal(validatePublishBody({ ciphertext: 'abc', templateHash: 'a1b2', weekStart: 'Sept 13' }), null)
  assert.equal(validatePublishBody({ ciphertext: 'abc', templateHash: 'a1b2', weekStart: '2026-09-13', visible: 'yes' }), null)
  assert.equal(validateUpdateBody({ ciphertext: 'abc', baseRev: 1 })?.baseRev, 1)
  assert.equal(validateUpdateBody({ visible: false, baseRev: 2 })?.visible, false)
  assert.equal(validateUpdateBody({ baseRev: 1 }), null)
  assert.equal(validateUpdateBody({ ciphertext: 'abc', baseRev: 0 }), null)
  assert.equal(validateUpdateBody({ ciphertext: 'abc' }), null)
})

test('a week survives publish, read, update, and conflicts reject stale writes', async () => {
  const env = mockEnv()

  const created = await handler.fetch(request('POST', '/api/weeks', { ciphertext: 'firstPayload', templateHash: 'a1b2c3d4', weekStart: '2026-09-13' }), env)
  assert.equal(created.status, 201)
  const { id, rev } = (await created.json()) as { id: string; rev: number }
  assert.ok(isValidId(id))
  assert.equal(rev, 1)

  const fetched = await handler.fetch(request('GET', `/api/weeks/${id}`), env)
  assert.equal(fetched.status, 200)
  const doc = (await fetched.json()) as { ciphertext: string; rev: number; weekStart: string }
  assert.equal(doc.ciphertext, 'firstPayload')
  assert.equal(doc.rev, 1)

  const stale = await handler.fetch(request('PUT', `/api/weeks/${id}`, { ciphertext: 'stalePayload', baseRev: 999 }), env)
  assert.equal(stale.status, 409)
  const conflict = (await stale.json()) as { error: string; rev: number }
  assert.equal(conflict.error, 'conflict')
  assert.equal(conflict.rev, 1)

  const updated = await handler.fetch(request('PUT', `/api/weeks/${id}`, { ciphertext: 'secondPayload', baseRev: 1 }), env)
  assert.equal(updated.status, 200)
  assert.equal(((await updated.json()) as { rev: number }).rev, 2)

  const refetched = await handler.fetch(request('GET', `/api/weeks/${id}`), env)
  assert.equal(((await refetched.json()) as { ciphertext: string }).ciphertext, 'secondPayload')
})

test('bad ids and bodies fail closed', async () => {
  const env = mockEnv()
  assert.equal((await handler.fetch(request('GET', '/api/weeks/nope'), env)).status, 404)
  assert.equal((await handler.fetch(request('GET', '/api/weeks/not-a-real-token'), env)).status, 404)
  assert.equal((await handler.fetch(request('POST', '/api/weeks', { nope: true }), env)).status, 400)
  assert.equal((await handler.fetch(request('GET', '/api/health'), env)).status, 200)
})

test('month listing shows only visible weeks', async () => {
  const env = mockEnv()
  const first = await handler.fetch(
    request('POST', '/api/weeks', { ciphertext: 'onPayload', templateHash: 'a1b2c3d4', weekStart: '2026-09-13', visible: true }),
    env,
  )
  const { id: onId } = (await first.json()) as { id: string; rev: number }
  const second = await handler.fetch(
    request('POST', '/api/weeks', { ciphertext: 'offPayload', templateHash: 'a1b2c3d4', weekStart: '2026-09-20', visible: false }),
    env,
  )
  const { id: offId } = (await second.json()) as { id: string; rev: number }

  const listed = await handler.fetch(new Request('https://api.test/api/weeks?month=2026-09'), env)
  assert.equal(listed.status, 200)
  const { weeks } = (await listed.json()) as { weeks: { id: string; weekStart: string }[] }
  assert.ok(weeks.some((week) => week.id === onId))
  assert.ok(!weeks.some((week) => week.id === offId))

  const badMonth = await handler.fetch(new Request('https://api.test/api/weeks?month=september'), env)
  assert.equal(badMonth.status, 400)
})

test('golden weeks cover every Sunday touching the month', () => {
  assert.deepEqual(goldenWeeksForMonth('2026-09'), ['2026-08-30', '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'])
  assert.deepEqual(goldenWeeksForMonth('september'), [])
})

function goldenPayload(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    weekStart: '2026-09-13',
    name: 'Week of Sep 13',
    people: ['Mary', 'Desiree'],
    slotPeople: [0, 1, -1],
    ...overrides,
  }
}

function goldenPut(weekStart: string, body: unknown, token = 'manager-token'): Request {
  return new Request(`https://api.test/api/schedule/${weekStart}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

test('golden week bodies are strictly validated', () => {
  const good = { week: goldenPayload(), templateHash: 'a1b2c3d4', visible: true, baseRev: 0 }
  assert.equal(validateGoldenWeekBody(good)?.baseRev, 0)
  assert.equal(validateGoldenWeekBody({ ...good, baseRev: -1 }), null)
  assert.equal(validateGoldenWeekBody({ ...good, week: goldenPayload({ version: 2 }) }), null)
  assert.equal(validateGoldenWeekBody({ ...good, week: goldenPayload({ people: ['Mary', 7] }) }), null)
  assert.equal(validateGoldenWeekBody({ ...good, week: goldenPayload({ slotPeople: [0, 5] }) }), null)
  assert.equal(validateGoldenWeekBody({ ...good, week: goldenPayload({ slotPeople: [0.5] }) }), null)
  assert.equal(validateGoldenWeekBody({ ...good, visible: 'yes' }), null)
  assert.equal(validateGoldenWeekBody({ week: goldenPayload() }), null)
})

test('golden writes need the manager token and create on first save', async () => {
  const env = mockEnv()
  const body = { week: goldenPayload(), templateHash: 'a1b2c3d4', visible: true, baseRev: 0 }

  const noToken = await handler.fetch(
    new Request('https://api.test/api/schedule/2026-09-13', { method: 'PUT', body: JSON.stringify(body) }),
    env,
  )
  assert.equal(noToken.status, 401)

  const wrongToken = await handler.fetch(goldenPut('2026-09-13', body, 'wrong'), env)
  assert.equal(wrongToken.status, 401)

  const created = await handler.fetch(goldenPut('2026-09-13', body), env)
  assert.equal(created.status, 201)
  assert.equal(((await created.json()) as { rev: number }).rev, 1)

  const fetched = await handler.fetch(new Request('https://api.test/api/schedule/2026-09-13'), env)
  assert.equal(fetched.status, 200)
  const doc = (await fetched.json()) as { rev: number; visible: boolean; week: { people: string[] } }
  assert.equal(doc.rev, 1)
  assert.equal(doc.visible, true)
  assert.deepEqual(doc.week.people, ['Mary', 'Desiree'])

  const stale = await handler.fetch(
    goldenPut('2026-09-13', { ...body, baseRev: 0, visible: false }),
    env,
  )
  assert.equal(stale.status, 409)
  assert.equal(((await stale.json()) as { rev: number }).rev, 1)

  const updated = await handler.fetch(
    goldenPut('2026-09-13', { ...body, baseRev: 1, visible: false }),
    env,
  )
  assert.equal(updated.status, 200)
  assert.equal(((await updated.json()) as { rev: number }).rev, 2)
})

test('golden month listing shows only visible weeks', async () => {
  const env = mockEnv()
  await handler.fetch(
    goldenPut('2026-09-13', { week: goldenPayload(), templateHash: 'a1b2c3d4', visible: true, baseRev: 0 }),
    env,
  )
  await handler.fetch(
    goldenPut(
      '2026-09-20',
      { week: goldenPayload({ weekStart: '2026-09-20' }), templateHash: 'a1b2c3d4', visible: false, baseRev: 0 },
    ),
    env,
  )

  const listed = await handler.fetch(new Request('https://api.test/api/schedule?month=2026-09'), env)
  assert.equal(listed.status, 200)
  const { weeks } = (await listed.json()) as { weeks: { weekStart: string }[] }
  assert.ok(weeks.some((week) => week.weekStart === '2026-09-13'))
  assert.ok(!weeks.some((week) => week.weekStart === '2026-09-20'))

  const missing = await handler.fetch(new Request('https://api.test/api/schedule/2026-09-27'), env)
  assert.equal(missing.status, 404)
  const badMonth = await handler.fetch(new Request('https://api.test/api/schedule?month=september'), env)
  assert.equal(badMonth.status, 400)
})

test('golden writes fail closed without a configured token', async () => {
  const env = mockEnv('')
  const response = await handler.fetch(
    goldenPut('2026-09-13', { week: goldenPayload(), templateHash: 'a1b2c3d4', visible: true, baseRev: 0 }),
    env,
  )
  assert.equal(response.status, 503)
})

test('golden month revs answer cheap change checks', async () => {
  assert.deepEqual(goldenMonthsForWeek('2026-09-13'), ['2026-09'])
  assert.deepEqual(goldenMonthsForWeek('2026-08-30'), ['2026-08', '2026-09'])
  assert.deepEqual(goldenMonthsForWeek('nope'), [])

  const env = mockEnv()
  await handler.fetch(
    goldenPut('2026-09-13', { week: goldenPayload(), templateHash: 'a1b2c3d4', visible: true, baseRev: 0 }),
    env,
  )

  const listed = await handler.fetch(new Request('https://api.test/api/schedule?month=2026-09'), env)
  assert.equal(listed.status, 200)
  const first = (await listed.json()) as { weeks: unknown[]; rev: number; notModified: boolean }
  assert.equal(first.weeks.length, 1)
  assert.equal(first.rev, 1)
  assert.equal(first.notModified, false)

  const unchanged = await handler.fetch(new Request('https://api.test/api/schedule?month=2026-09&knownRev=1'), env)
  assert.equal(unchanged.status, 200)
  const cached = (await unchanged.json()) as { weeks: unknown[]; rev: number; notModified: boolean }
  assert.deepEqual(cached.weeks, [])
  assert.equal(cached.rev, 1)
  assert.equal(cached.notModified, true)

  await handler.fetch(
    goldenPut('2026-09-13', { week: goldenPayload(), templateHash: 'a1b2c3d4', visible: true, baseRev: 1 }),
    env,
  )
  const changed = await handler.fetch(new Request('https://api.test/api/schedule?month=2026-09&knownRev=1'), env)
  const second = (await changed.json()) as { weeks: unknown[]; rev: number; notModified: boolean }
  assert.equal(second.weeks.length, 1)
  assert.equal(second.rev, 2)
  assert.equal(second.notModified, false)

  const garbage = await handler.fetch(new Request('https://api.test/api/schedule?month=2026-09&knownRev=lots'), env)
  assert.equal(((await garbage.json()) as { notModified: boolean }).notModified, false)
})

test('golden saves spanning two months bump both revs', async () => {
  const env = mockEnv()
  await handler.fetch(
    goldenPut(
      '2026-08-30',
      { week: goldenPayload({ weekStart: '2026-08-30' }), templateHash: 'a1b2c3d4', visible: true, baseRev: 0 },
    ),
    env,
  )
  for (const month of ['2026-08', '2026-09']) {
    const listed = await handler.fetch(new Request(`https://api.test/api/schedule?month=${month}`), env)
    assert.equal(((await listed.json()) as { rev: number }).rev, 1)
  }
})

test('visibility can toggle without re-encrypting', async () => {
  const env = mockEnv()
  const created = await handler.fetch(
    request('POST', '/api/weeks', { ciphertext: 'payloadOne', templateHash: 'a1b2c3d4', weekStart: '2026-09-13' }),
    env,
  )
  const { id } = (await created.json()) as { id: string; rev: number }
  const toggled = await handler.fetch(request('PUT', `/api/weeks/${id}`, { visible: false, baseRev: 1 }), env)
  assert.equal(toggled.status, 200)
  const refetched = await handler.fetch(request('GET', `/api/weeks/${id}`), env)
  const doc = (await refetched.json()) as { ciphertext: string; visible: boolean; rev: number }
  assert.equal(doc.ciphertext, 'payloadOne')
  assert.equal(doc.visible, false)
  assert.equal(doc.rev, 2)
})
