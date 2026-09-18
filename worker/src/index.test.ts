import assert from 'node:assert/strict'
import test from 'node:test'
import handler, {
  goldenMonthsForWeek,
  goldenWeeksForMonth,
  isValidId,
  isValidRestaurant,
  newShareId,
  parseWeekStartParam,
  restaurantFromUrl,
  rosterKeyForWeek,
  templateKeyForWeek,
  validateGoldenWeekBody,
  validatePublishBody,
  validateRosterBody,
  validateTemplateBody,
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

function rosterEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mary',
    name: 'Mary',
    roles: ['server', 'cashier'],
    recurringAvailability: { Sunday: [{ start: 570, end: 960 }] },
    maxDaysPerWeek: 5,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
    newHire: false,
    ...overrides,
  }
}

function rosterPut(body: unknown, token = 'manager-token'): Request {
  return new Request('https://api.test/api/employees', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

const ALL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function templatePayload(overrides: Record<string, unknown[]> = {}) {
  const base: Record<string, unknown[]> = Object.fromEntries(ALL_DAYS.map((day) => [day, []]))
  return {
    ...base,
    Sunday: [{ period: 'AM', role: 'lead', label: 'Shift lead', start: 570, end: 960, required: true }],
    ...overrides,
  }
}

function templatePut(body: unknown, token = 'manager-token'): Request {
  return new Request('https://api.test/api/template', {
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

function verifyGet(token?: string): Request {
  return new Request('https://api.test/api/auth/verify', {
    method: 'GET',
    headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
  })
}

test('auth verify accepts the manager token and nothing else', async () => {
  const env = mockEnv()

  assert.equal((await handler.fetch(verifyGet(), env)).status, 401)
  assert.equal((await handler.fetch(verifyGet('wrong'), env)).status, 401)

  const ok = await handler.fetch(verifyGet('manager-token'), env)
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), { ok: true })
})

test('auth verify fails closed without a configured token', async () => {
  const env = mockEnv('')
  assert.equal((await handler.fetch(verifyGet('anything'), env)).status, 503)
})

test('employee roster bodies are strictly validated', () => {
  const good = { employees: [rosterEmployee()], baseRev: 0 }
  assert.equal(validateRosterBody(good)?.baseRev, 0)
  assert.equal(validateRosterBody({ ...good, baseRev: -1 }), null)
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ id: 'Not Valid!' })], baseRev: 0 }), null)
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ roles: ['chef'] })], baseRev: 0 }), null)
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ recurringAvailability: { Someday: [] } })], baseRev: 0 }), null)
  assert.equal(
    validateRosterBody({ employees: [rosterEmployee({ recurringAvailability: { Sunday: [{ start: 100, end: 50 }] } })], baseRev: 0 }),
    null,
  )
  assert.equal(validateRosterBody({ employees: [rosterEmployee(), rosterEmployee()], baseRev: 0 }), null, 'duplicate ids rejected')
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ active: 'yes' })], baseRev: 0 }), null)
})

test('roster writes need the manager token and create on first save, and real deletes persist', async () => {
  const env = mockEnv()
  const body = { employees: [rosterEmployee()], baseRev: 0 }

  const noToken = await handler.fetch(new Request('https://api.test/api/employees', { method: 'PUT', body: JSON.stringify(body) }), env)
  assert.equal(noToken.status, 401)

  const wrongToken = await handler.fetch(rosterPut(body, 'wrong'), env)
  assert.equal(wrongToken.status, 401)

  const created = await handler.fetch(rosterPut(body), env)
  assert.equal(created.status, 201)
  assert.equal(((await created.json()) as { rev: number }).rev, 1)

  const fetched = await handler.fetch(new Request('https://api.test/api/employees'), env)
  assert.equal(fetched.status, 200)
  const doc = (await fetched.json()) as { rev: number; employees: { id: string }[] }
  assert.equal(doc.rev, 1)
  assert.deepEqual(doc.employees.map((employee) => employee.id), ['mary'])

  const stale = await handler.fetch(rosterPut({ employees: [], baseRev: 0 }), env)
  assert.equal(stale.status, 409)

  // A real delete: the roster shrinks and that shrinkage persists.
  const deleted = await handler.fetch(rosterPut({ employees: [], baseRev: 1 }), env)
  assert.equal(deleted.status, 200)
  assert.equal(((await deleted.json()) as { rev: number }).rev, 2)

  const afterDelete = await handler.fetch(new Request('https://api.test/api/employees'), env)
  const afterDeleteDoc = (await afterDelete.json()) as { employees: unknown[] }
  assert.deepEqual(afterDeleteDoc.employees, [])
})

test('roster writes fail closed without a configured token', async () => {
  const env = mockEnv('')
  const response = await handler.fetch(rosterPut({ employees: [rosterEmployee()], baseRev: 0 }), env)
  assert.equal(response.status, 503)
})

test('staffing template bodies are strictly validated', () => {
  const good = { template: templatePayload(), baseRev: 0 }
  assert.ok(validateTemplateBody(good))
  assert.equal(validateTemplateBody({ ...good, baseRev: -1 }), null)
  assert.equal(validateTemplateBody({ template: templatePayload({ Someday: [] }), baseRev: 0 }), null, 'unknown day key rejected')
  assert.equal(
    validateTemplateBody({
      template: templatePayload({ Monday: [{ period: 'EVENING', role: 'server', label: 'Server', start: 570, end: 960, required: true }] }),
      baseRev: 0,
    }),
    null,
  )
  assert.equal(
    validateTemplateBody({
      template: templatePayload({ Monday: [{ period: 'AM', role: 'chef', label: 'Server', start: 570, end: 960, required: true }] }),
      baseRev: 0,
    }),
    null,
  )
  assert.equal(
    validateTemplateBody({
      template: templatePayload({ Monday: [{ period: 'AM', role: 'server', label: 'Server', start: 960, end: 570, required: true }] }),
      baseRev: 0,
    }),
    null,
    'end before start rejected',
  )
})

test('template writes need the manager token, create on first save, and round-trip', async () => {
  const env = mockEnv()
  const body = { template: templatePayload(), baseRev: 0 }

  const noToken = await handler.fetch(new Request('https://api.test/api/template', { method: 'PUT', body: JSON.stringify(body) }), env)
  assert.equal(noToken.status, 401)

  const created = await handler.fetch(templatePut(body), env)
  assert.equal(created.status, 201)
  assert.equal(((await created.json()) as { rev: number }).rev, 1)

  const fetched = await handler.fetch(new Request('https://api.test/api/template'), env)
  assert.equal(fetched.status, 200)
  const doc = (await fetched.json()) as { rev: number; template: Record<string, unknown[]> }
  assert.equal(doc.rev, 1)
  assert.equal(doc.template.Sunday.length, 1)

  const stale = await handler.fetch(templatePut({ ...body, baseRev: 0 }), env)
  assert.equal(stale.status, 409)

  const updated = await handler.fetch(templatePut({ template: templatePayload({ Sunday: [] }), baseRev: 1 }), env)
  assert.equal(updated.status, 200)
  assert.equal(((await updated.json()) as { rev: number }).rev, 2)
})

test('template GET answers rev 0 and null template before anything is saved', async () => {
  const env = mockEnv()
  const fetched = await handler.fetch(new Request('https://api.test/api/template'), env)
  const doc = (await fetched.json()) as { rev: number; template: unknown }
  assert.equal(doc.rev, 0)
  assert.equal(doc.template, null)
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

test('restaurant ids validate and default when omitted', () => {
  assert.equal(isValidRestaurant('CR3-diningroom'), true)
  assert.equal(isValidRestaurant('CR3-kitchen'), true)
  assert.equal(isValidRestaurant('CR2-kitchen'), true)
  assert.equal(isValidRestaurant('CR2-diningroom'), true)
  assert.equal(isValidRestaurant('nope'), false)
  assert.equal(isValidRestaurant(''), false)
  assert.equal(restaurantFromUrl(new URL('https://api.test/api/employees')), 'CR3-diningroom')
  assert.equal(restaurantFromUrl(new URL('https://api.test/api/employees?restaurant=CR3-kitchen')), 'CR3-kitchen')
  assert.equal(restaurantFromUrl(new URL('https://api.test/api/employees?restaurant=nope')), null)
})

test('invalid restaurant ids fail closed', async () => {
  const env = mockEnv()
  assert.equal((await handler.fetch(new Request('https://api.test/api/employees?restaurant=nope'), env)).status, 400)
  assert.equal((await handler.fetch(new Request('https://api.test/api/template?restaurant=nope'), env)).status, 400)
  assert.equal((await handler.fetch(new Request('https://api.test/api/schedule?month=2026-09&restaurant=nope'), env)).status, 400)
  assert.equal((await handler.fetch(new Request('https://api.test/api/schedule/2026-09-13?restaurant=nope'), env)).status, 400)
})

test('rosters are isolated per restaurant', async () => {
  const env = mockEnv()
  const dining = { employees: [rosterEmployee()], baseRev: 0 }
  const created = await handler.fetch(rosterPut(dining), env)
  assert.equal(created.status, 201)

  const otherPut = new Request('https://api.test/api/employees?restaurant=CR3-kitchen', {
    method: 'PUT',
    headers: { Authorization: 'Bearer manager-token' },
    body: JSON.stringify(dining),
  })
  const createdOther = await handler.fetch(otherPut, env)
  assert.equal(createdOther.status, 201)

  const fetchedDefault = await handler.fetch(new Request('https://api.test/api/employees'), env)
  const defaultDoc = (await fetchedDefault.json()) as { rev: number }
  assert.equal(defaultDoc.rev, 1)

  const fetchedOther = await handler.fetch(new Request('https://api.test/api/employees?restaurant=CR3-kitchen'), env)
  const otherDoc = (await fetchedOther.json()) as { rev: number }
  assert.equal(otherDoc.rev, 1)

  // Deleting in one station does not touch the other.
  const deleted = await handler.fetch(rosterPut({ employees: [], baseRev: 1 }), env)
  assert.equal(deleted.status, 200)
  const afterOther = await handler.fetch(new Request('https://api.test/api/employees?restaurant=CR3-kitchen'), env)
  const afterOtherDoc = (await afterOther.json()) as { employees: unknown[] }
  assert.equal(afterOtherDoc.employees.length, 1)
})

test('golden weeks and month revs are isolated per restaurant', async () => {
  const env = mockEnv()
  await handler.fetch(
    goldenPut('2026-09-13', { week: goldenPayload(), templateHash: 'a1b2c3d4', visible: true, baseRev: 0 }),
    env,
  )
  const otherGoldenPut = new Request('https://api.test/api/schedule/2026-09-13?restaurant=CR2-kitchen', {
    method: 'PUT',
    headers: { Authorization: 'Bearer manager-token' },
    body: JSON.stringify({ week: goldenPayload(), templateHash: 'a1b2c3d4', visible: true, baseRev: 0 }),
  })
  await handler.fetch(otherGoldenPut, env)

  const listedDefault = await handler.fetch(new Request('https://api.test/api/schedule?month=2026-09'), env)
  const defaultMonth = (await listedDefault.json()) as { rev: number; weeks: unknown[] }
  assert.equal(defaultMonth.rev, 1)
  assert.equal(defaultMonth.weeks.length, 1)

  const listedOther = await handler.fetch(new Request('https://api.test/api/schedule?month=2026-09&restaurant=CR2-kitchen'), env)
  const otherMonth = (await listedOther.json()) as { rev: number; weeks: unknown[] }
  assert.equal(otherMonth.rev, 1)
  assert.equal(otherMonth.weeks.length, 1)

  const missing = await handler.fetch(new Request('https://api.test/api/schedule/2026-09-13?restaurant=CR2-diningroom'), env)
  assert.equal(missing.status, 404)
})

test('legacy singleton docs fall back to the default restaurant only', async () => {
  const data = new Map<string, string>()
  data.set('roster:current', JSON.stringify({ v: 1, rev: 1, employees: [rosterEmployee()], updatedAt: 'x' }))
  data.set('template:current', JSON.stringify({ v: 1, rev: 1, template: templatePayload(), updatedAt: 'x' }))
  const env = {
    SCHEDULES: {
      async get(key: string) {
        return data.get(key) ?? null
      },
      async put(key: string, value: string) {
        data.set(key, value)
      },
    },
    SCHEDULE_WRITE_TOKEN: 'manager-token',
  }
  const rosterDefault = await handler.fetch(new Request('https://api.test/api/employees'), env)
  assert.equal(((await rosterDefault.json()) as { rev: number }).rev, 1)
  const rosterOther = await handler.fetch(new Request('https://api.test/api/employees?restaurant=CR3-kitchen'), env)
  assert.equal(((await rosterOther.json()) as { rev: number }).rev, 0)
  const templateDefault = await handler.fetch(new Request('https://api.test/api/template'), env)
  assert.equal(((await templateDefault.json()) as { rev: number }).rev, 1)
  const templateOther = await handler.fetch(new Request('https://api.test/api/template?restaurant=CR2-kitchen'), env)
  assert.equal(((await templateOther.json()) as { rev: number }).rev, 0)
})

test('weekStart params parse and per-week keys are namespaced', () => {
  assert.deepEqual(parseWeekStartParam(new URL('https://api.test/api/employees')), { present: false })
  assert.deepEqual(parseWeekStartParam(new URL('https://api.test/api/employees?weekStart=2026-09-13')), {
    present: true,
    valid: true,
    value: '2026-09-13',
  })
  assert.equal(parseWeekStartParam(new URL('https://api.test/api/employees?weekStart=sept-13')).present, true)
  assert.equal(
    (parseWeekStartParam(new URL('https://api.test/api/employees?weekStart=sept-13')) as { valid: boolean }).valid,
    false,
  )
  assert.equal(rosterKeyForWeek('CR3-diningroom', '2026-09-13'), 'r:CR3-diningroom:roster:2026-09-13')
  assert.equal(templateKeyForWeek('CR3-diningroom', '2026-09-13'), 'r:CR3-diningroom:template:2026-09-13')
})

test('rosters are isolated per week and fall back to the global seed', async () => {
  const env = mockEnv()
  const week1 = '2026-09-06'
  const week2 = '2026-09-13'

  function weekRosterPut(weekStart: string, body: unknown, token = 'manager-token'): Request {
    return new Request(`https://api.test/api/employees?weekStart=${weekStart}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  }

  const seed = await handler.fetch(rosterPut({ employees: [rosterEmployee()], baseRev: 0 }), env)
  assert.equal(seed.status, 201)

  const emptyWeek1 = await handler.fetch(new Request(`https://api.test/api/employees?weekStart=${week1}`), env)
  assert.equal(emptyWeek1.status, 200)
  const emptyDoc = (await emptyWeek1.json()) as { employees: unknown[]; rev: number; inherited: boolean }
  assert.equal(emptyDoc.rev, 0)
  assert.equal(emptyDoc.inherited, true)
  assert.equal(emptyDoc.employees.length, 1)

  const eleven = Array.from({ length: 11 }, (_, i) => rosterEmployee({ id: `w1-${i}`, name: `W1 ${i}` }))
  const created1 = await handler.fetch(weekRosterPut(week1, { employees: eleven, baseRev: 0 }), env)
  assert.equal(created1.status, 201)

  const twelve = Array.from({ length: 12 }, (_, i) => rosterEmployee({ id: `w2-${i}`, name: `W2 ${i}` }))
  const created2 = await handler.fetch(weekRosterPut(week2, { employees: twelve, baseRev: 0 }), env)
  assert.equal(created2.status, 201)

  const fetched1 = await handler.fetch(new Request(`https://api.test/api/employees?weekStart=${week1}`), env)
  const doc1 = (await fetched1.json()) as { employees: { id: string }[]; rev: number; inherited: boolean }
  assert.equal(doc1.rev, 1)
  assert.equal(doc1.inherited, false)
  assert.equal(doc1.employees.length, 11)

  const fetched2 = await handler.fetch(new Request(`https://api.test/api/employees?weekStart=${week2}`), env)
  const doc2 = (await fetched2.json()) as { employees: { id: string }[]; rev: number }
  assert.equal(doc2.employees.length, 12)

  const stale = await handler.fetch(weekRosterPut(week1, { employees: [], baseRev: 0 }), env)
  assert.equal(stale.status, 409)
  assert.equal(((await stale.json()) as { rev: number }).rev, 1)

  const global = await handler.fetch(new Request('https://api.test/api/employees'), env)
  assert.equal(((await global.json()) as { employees: unknown[] }).employees.length, 1)

  const bad = await handler.fetch(new Request('https://api.test/api/employees?weekStart=sept-13'), env)
  assert.equal(bad.status, 400)
})

test('templates are isolated per week and fall back to the global seed', async () => {
  const env = mockEnv()
  const week1 = '2026-09-06'
  const week2 = '2026-09-13'

  function weekTemplatePut(weekStart: string, body: unknown): Request {
    return new Request(`https://api.test/api/template?weekStart=${weekStart}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer manager-token' },
      body: JSON.stringify(body),
    })
  }

  const seed = await handler.fetch(templatePut({ template: templatePayload(), baseRev: 0 }), env)
  assert.equal(seed.status, 201)

  const emptyWeek = await handler.fetch(new Request(`https://api.test/api/template?weekStart=${week1}`), env)
  const emptyDoc = (await emptyWeek.json()) as { template: unknown; rev: number; inherited: boolean }
  assert.equal(emptyDoc.rev, 0)
  assert.equal(emptyDoc.inherited, true)

  const week1Template = templatePayload({ Sunday: [] })
  const created1 = await handler.fetch(weekTemplatePut(week1, { template: week1Template, baseRev: 0 }), env)
  assert.equal(created1.status, 201)

  const fetched1 = await handler.fetch(new Request(`https://api.test/api/template?weekStart=${week1}`), env)
  const doc1 = (await fetched1.json()) as { template: Record<string, unknown[]>; rev: number; inherited: boolean }
  assert.equal(doc1.rev, 1)
  assert.equal(doc1.inherited, false)
  assert.equal(doc1.template.Sunday.length, 0)

  const fetched2 = await handler.fetch(new Request(`https://api.test/api/template?weekStart=${week2}`), env)
  const doc2 = (await fetched2.json()) as { rev: number; inherited: boolean }
  assert.equal(doc2.rev, 0)
  assert.equal(doc2.inherited, true)

  const stale = await handler.fetch(weekTemplatePut(week1, { template: templatePayload(), baseRev: 0 }), env)
  assert.equal(stale.status, 409)

  const bad = await handler.fetch(new Request('https://api.test/api/template?weekStart=bad'), env)
  assert.equal(bad.status, 400)
})
