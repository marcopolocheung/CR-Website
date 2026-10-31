import assert from 'node:assert/strict'
import test from 'node:test'
import handler, {
  cashoutHistoryDates,
  cashoutTotals,
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
  validateCashoutBody,
  validateInventoryBody,
  validateInventoryListBody,
  validateWriteUpForm,
} from './index'
import { DENOMINATIONS, dayTotals } from '../../src/lib/cashout'

function mockEnv(token = 'manager-token', staffPassword?: string) {
  const data = new Map<string, string>()
  const metadata = new Map<string, unknown>()
  return {
    SCHEDULES: {
      async get(key: string) {
        return data.get(key) ?? null
      },
      async put(key: string, value: string, options?: { metadata?: unknown }) {
        data.set(key, value)
        metadata.set(key, options?.metadata)
      },
      // One key per page so the cursor loop is exercised.
      async list({ prefix, cursor }: { prefix: string; cursor?: string }) {
        const names = [...data.keys()].filter((k) => k.startsWith(prefix)).sort()
        const i = cursor ? Number(cursor) : 0
        const keys = names.slice(i, i + 1).map((name) => ({ name, metadata: metadata.get(name) }))
        return { keys, list_complete: i + 1 >= names.length, cursor: String(i + 1) }
      },
    },
    SCHEDULE_WRITE_TOKEN: token,
    STAFF_EDIT_PASSWORD: staffPassword,
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

function rosterGet(query = '', token = 'manager-token'): Request {
  return new Request(`https://api.test/api/employees${query}`, { headers: { Authorization: `Bearer ${token}` } })
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
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ roles: ['Chef!'] })], baseRev: 0 }), null, 'role slugs stay lowercase')
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ roles: ['line cook'] })], baseRev: 0 }), null, 'spaces rejected')
  assert.ok(validateRosterBody({ employees: [rosterEmployee({ roles: ['cook', 'mv-prep'] })], baseRev: 0 }), 'kitchen posts accepted')
  assert.ok(validateRosterBody({ employees: [rosterEmployee({ suspendedFrom: '2026-10-12', suspendedUntil: '2026-10-20', priority: 1 })], baseRev: 0 }), 'suspension and priority accepted')
  assert.ok(validateRosterBody({ employees: [rosterEmployee({ maxHoursPerWeek: 30 })], baseRev: 0 }), 'max hours accepted')
  for (const maxHoursPerWeek of [0, 81, 12.5, '30']) {
    assert.equal(validateRosterBody({ employees: [rosterEmployee({ maxHoursPerWeek } as never)], baseRev: 0 }), null, `max hours ${maxHoursPerWeek} rejected`)
  }
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ suspendedFrom: '2026-10-20', suspendedUntil: '2026-10-12' })], baseRev: 0 }), null, 'backwards range rejected')
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ suspendedUntil: '2026-10-12' })], baseRev: 0 }), null, 'end without start rejected')
  const tuePm = { day: 'Tuesday', period: 'PM', role: 'dishwasher' }
  assert.ok(validateRosterBody({ employees: [rosterEmployee({ shiftRoles: [tuePm] })], baseRev: 0 }), 'shift role accepted')
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ shiftRoles: [{ ...tuePm, period: 'Noon' }] })], baseRev: 0 }), null, 'unknown period rejected')
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ shiftRoles: [{ ...tuePm, role: 'Dish Washer' }] })], baseRev: 0 }), null, 'bad role slug rejected')
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ shiftRoles: [tuePm, { ...tuePm, role: 'cook' }] })], baseRev: 0 }), null, 'two roles on one shift rejected')
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ suspendedFrom: 'next week' })], baseRev: 0 }), null, 'bad date rejected')
  assert.equal(validateRosterBody({ employees: [rosterEmployee({ priority: 0 })], baseRev: 0 }), null, 'priority out of range rejected')
  assert.ok(validateRosterBody({ employees: [rosterEmployee({ roles: ['sushi-chef'] })], baseRev: 0 }), 'custom posts accepted')
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

  const fetched = await handler.fetch(rosterGet(''), env)
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

  const afterDelete = await handler.fetch(rosterGet(''), env)
  const afterDeleteDoc = (await afterDelete.json()) as { employees: unknown[] }
  assert.deepEqual(afterDeleteDoc.employees, [])
})

test('roster and crew reads need the manager token', async () => {
  const env = mockEnv('manager-token', 'test')
  assert.equal((await handler.fetch(rosterPut({ employees: [rosterEmployee()], baseRev: 0 }), env)).status, 201)

  // No token, a wrong token, and the staff password are all refused: rosters hold availability and who is kept apart.
  assert.equal((await handler.fetch(new Request('https://api.test/api/employees'), env)).status, 401)
  assert.equal((await handler.fetch(rosterGet('', 'wrong'), env)).status, 401)
  assert.equal((await handler.fetch(rosterGet('?weekStart=2026-09-13', 'wrong'), env)).status, 401)
  assert.equal((await handler.fetch(new Request('https://api.test/api/staff?restaurant=CR3-kitchen'), env)).status, 401)
  assert.equal((await handler.fetch(staffGet('CR3-kitchen', 'test'), env)).status, 401)

  const ok = await handler.fetch(rosterGet(), env)
  assert.equal(ok.status, 200)
  assert.deepEqual(((await ok.json()) as { employees: { id: string }[] }).employees.map((e) => e.id), ['mary'])
  assert.equal((await handler.fetch(staffGet(), env)).status, 200)

  // Reads fail closed when no manager token is configured.
  assert.equal((await handler.fetch(rosterGet(), mockEnv(''))).status, 503)
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
      template: templatePayload({ Monday: [{ period: 'AM', role: 'Chef!', label: 'Server', start: 570, end: 960, required: true }] }),
      baseRev: 0,
    }),
    null,
    'role slugs stay lowercase',
  )
  assert.ok(
    validateTemplateBody({
      template: templatePayload({ Monday: [{ period: 'AM', role: 'mv-prep', label: 'M/V Prep (early)', start: 360, end: 810, required: true }] }),
      baseRev: 0,
    }),
    'kitchen post slots accepted',
  )
  assert.ok(
    validateTemplateBody({
      template: templatePayload({ Monday: [{ period: 'AM', role: 'sushi-chef', label: 'Sushi Chef', start: 570, end: 960, required: true }] }),
      baseRev: 0,
    }),
    'custom post slots accepted',
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
  assert.equal((await handler.fetch(rosterGet('?restaurant=nope'), env)).status, 400)
  assert.equal((await handler.fetch(new Request('https://api.test/api/template?restaurant=nope'), env)).status, 400)
  assert.equal((await handler.fetch(new Request('https://api.test/api/schedule?month=2026-09&restaurant=nope'), env)).status, 400)
  assert.equal((await handler.fetch(new Request('https://api.test/api/schedule/2026-09-13?restaurant=nope'), env)).status, 400)
})

test('rosters are isolated per restaurant', async () => {
  const env = mockEnv()
  const dining = { employees: [rosterEmployee()], baseRev: 0 }
  const created = await handler.fetch(rosterPut(dining), env)
  assert.equal(created.status, 201)

  const otherPut = new Request('https://api.test/api/employees?restaurant=CR2-kitchen', {
    method: 'PUT',
    headers: { Authorization: 'Bearer manager-token' },
    body: JSON.stringify(dining),
  })
  const createdOther = await handler.fetch(otherPut, env)
  assert.equal(createdOther.status, 201)

  const fetchedDefault = await handler.fetch(rosterGet(''), env)
  const defaultDoc = (await fetchedDefault.json()) as { rev: number }
  assert.equal(defaultDoc.rev, 1)

  const fetchedOther = await handler.fetch(rosterGet('?restaurant=CR2-kitchen'), env)
  const otherDoc = (await fetchedOther.json()) as { rev: number }
  assert.equal(otherDoc.rev, 1)

  // Deleting in one station does not touch the other.
  const deleted = await handler.fetch(rosterPut({ employees: [], baseRev: 1 }), env)
  assert.equal(deleted.status, 200)
  const afterOther = await handler.fetch(rosterGet('?restaurant=CR2-kitchen'), env)
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
      async list() {
        return { keys: [], list_complete: true }
      },
    },
    SCHEDULE_WRITE_TOKEN: 'manager-token',
  }
  const rosterDefault = await handler.fetch(rosterGet(''), env)
  assert.equal(((await rosterDefault.json()) as { rev: number }).rev, 1)
  const rosterOther = await handler.fetch(rosterGet('?restaurant=CR3-kitchen'), env)
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

  const emptyWeek1 = await handler.fetch(rosterGet(`?weekStart=${week1}`), env)
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

  const fetched1 = await handler.fetch(rosterGet(`?weekStart=${week1}`), env)
  const doc1 = (await fetched1.json()) as { employees: { id: string }[]; rev: number; inherited: boolean }
  assert.equal(doc1.rev, 1)
  assert.equal(doc1.inherited, false)
  assert.equal(doc1.employees.length, 11)

  const fetched2 = await handler.fetch(rosterGet(`?weekStart=${week2}`), env)
  const doc2 = (await fetched2.json()) as { employees: { id: string }[]; rev: number }
  assert.equal(doc2.employees.length, 12)

  const stale = await handler.fetch(weekRosterPut(week1, { employees: [], baseRev: 0 }), env)
  assert.equal(stale.status, 409)
  assert.equal(((await stale.json()) as { rev: number }).rev, 1)

  const global = await handler.fetch(rosterGet(''), env)
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

test('schedule-only stations refuse roster and global template writes', async () => {
  const env = mockEnv()
  const lockedRoster = await handler.fetch(
    new Request('https://api.test/api/employees?restaurant=CR3-kitchen', {
      method: 'PUT',
      headers: { Authorization: 'Bearer manager-token' },
      body: JSON.stringify({ employees: [rosterEmployee()], baseRev: 0 }),
    }),
    env,
  )
  assert.equal(lockedRoster.status, 403)
  assert.deepEqual(await lockedRoster.json(), { error: 'station_locked' })

  const lockedTemplate = await handler.fetch(
    new Request('https://api.test/api/template?restaurant=CR3-kitchen', {
      method: 'PUT',
      headers: { Authorization: 'Bearer manager-token' },
      body: JSON.stringify({ template: templatePayload(), baseRev: 0 }),
    }),
    env,
  )
  assert.equal(lockedTemplate.status, 403)
  assert.deepEqual(await lockedTemplate.json(), { error: 'station_locked' })

  // Per-week rules unlock with the staff password; a wrong password is refused.
  const weekTemplate = (password: string) =>
    new Request('https://api.test/api/template?restaurant=CR3-kitchen&weekStart=2026-09-13', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${password}` },
      body: JSON.stringify({ template: templatePayload(), baseRev: 0 }),
    })
  assert.equal((await handler.fetch(weekTemplate('nope'), env)).status, 401)
  assert.equal((await handler.fetch(weekTemplate('test'), env)).status, 201)

  // An unlocked station still accepts the same writes.
  const openRoster = await handler.fetch(
    new Request('https://api.test/api/employees?restaurant=CR2-kitchen', {
      method: 'PUT',
      headers: { Authorization: 'Bearer manager-token' },
      body: JSON.stringify({ employees: [rosterEmployee()], baseRev: 0 }),
    }),
    env,
  )
  assert.equal(openRoster.status, 201)
})

test('schedule-only stations still accept schedule writes', async () => {
  const env = mockEnv()
  const saved = await handler.fetch(
    new Request('https://api.test/api/schedule/2026-09-13?restaurant=CR3-kitchen', {
      method: 'PUT',
      headers: { Authorization: 'Bearer manager-token' },
      body: JSON.stringify({ week: goldenPayload(), templateHash: 'a1b2c3d4', visible: true, baseRev: 0 }),
    }),
    env,
  )
  assert.equal(saved.status, 201)
})

function staffGet(restaurant = 'CR3-kitchen', token = 'manager-token'): Request {
  return new Request(`https://api.test/api/staff?restaurant=${restaurant}`, { headers: { Authorization: `Bearer ${token}` } })
}

function staffVerify(password: string | undefined, restaurant = 'CR3-kitchen'): Request {
  return new Request(`https://api.test/api/staff/verify?restaurant=${restaurant}`, {
    headers: password === undefined ? {} : { Authorization: `Bearer ${password}` },
  })
}

function staffPut(body: unknown, password: string | undefined, restaurant = 'CR3-kitchen'): Request {
  return new Request(`https://api.test/api/staff?restaurant=${restaurant}`, {
    method: 'PUT',
    headers: password === undefined ? {} : { Authorization: `Bearer ${password}` },
    body: JSON.stringify(body),
  })
}

function staffUndo(body: unknown, password: string | undefined, restaurant = 'CR3-kitchen'): Request {
  return new Request(`https://api.test/api/staff/undo?restaurant=${restaurant}`, {
    method: 'POST',
    headers: password === undefined ? {} : { Authorization: `Bearer ${password}` },
    body: JSON.stringify(body),
  })
}

test('staff editing is password-gated and starts empty', async () => {
  const env = mockEnv('manager-token', 'test')

  const empty = await handler.fetch(staffGet(), env)
  assert.equal(empty.status, 200)
  assert.deepEqual(await empty.json(), { employees: null, rev: 0, updatedAt: null, canUndo: false })

  assert.equal((await handler.fetch(staffVerify('wrong'), env)).status, 401)
  assert.equal((await handler.fetch(staffVerify(undefined), env)).status, 401)
  assert.equal((await handler.fetch(staffVerify('test'), env)).status, 200)

  // The manager token still works for crew writes.
  assert.equal((await handler.fetch(staffVerify('manager-token'), env)).status, 200)
})

test('crew saves persist for every week and undo steps back through history', async () => {
  const env = mockEnv('manager-token', 'test')

  const first = await handler.fetch(staffPut({ employees: [rosterEmployee()], baseRev: 0 }, 'test'), env)
  assert.equal(first.status, 201)
  const firstDoc = (await first.json()) as { employees: { id: string }[]; rev: number; canUndo: boolean }
  assert.equal(firstDoc.rev, 1)
  assert.equal(firstDoc.employees.length, 1)
  // The first save is undoable back to "no saved crew" (the built-in seed).
  assert.equal(firstDoc.canUndo, true)

  const two = [rosterEmployee(), rosterEmployee({ id: 'levelle', name: 'Levelle', roles: ['fried-rice'] })]
  const second = await handler.fetch(staffPut({ employees: two, baseRev: 1 }, 'test'), env)
  assert.equal(second.status, 200)
  const secondDoc = (await second.json()) as { rev: number; canUndo: boolean }
  assert.equal(secondDoc.rev, 2)
  assert.equal(secondDoc.canUndo, true)

  // The crew is station-wide: any week reads the same saved crew.
  const read = await handler.fetch(staffGet(), env)
  const readDoc = (await read.json()) as { employees: unknown[]; rev: number; canUndo: boolean }
  assert.equal(readDoc.employees.length, 2)
  assert.equal(readDoc.rev, 2)
  assert.equal(readDoc.canUndo, true)

  // Undo returns the previously saved crew and keeps one older step.
  const undone = await handler.fetch(staffUndo({ baseRev: 2 }, 'test'), env)
  assert.equal(undone.status, 200)
  const undoneDoc = (await undone.json()) as { employees: { id: string }[]; rev: number; canUndo: boolean }
  assert.equal(undoneDoc.rev, 3)
  assert.equal(undoneDoc.employees.length, 1)
  assert.equal(undoneDoc.employees[0].id, 'mary')
  assert.equal(undoneDoc.canUndo, true)

  // Undoing the first save restores "no saved crew" (built-in seed on the client).
  const undoneAgain = await handler.fetch(staffUndo({ baseRev: 3 }, 'test'), env)
  assert.equal(undoneAgain.status, 200)
  const finalDoc = (await undoneAgain.json()) as { employees: unknown; rev: number; canUndo: boolean }
  assert.equal(finalDoc.employees, null)
  assert.equal(finalDoc.rev, 4)
  assert.equal(finalDoc.canUndo, false)

  const nothingLeft = await handler.fetch(staffUndo({ baseRev: 4 }, 'test'), env)
  assert.equal(nothingLeft.status, 409)
  assert.equal(((await nothingLeft.json()) as { error: string }).error, 'nothing_to_undo')
})

test('staff writes reject stale revisions and unauthorized callers', async () => {
  const env = mockEnv('manager-token', 'test')
  assert.equal((await handler.fetch(staffPut({ employees: [rosterEmployee()], baseRev: 0 }, 'wrong'), env)).status, 401)
  assert.equal((await handler.fetch(staffPut({ employees: [rosterEmployee()], baseRev: 0 }, undefined), env)).status, 401)

  const created = await handler.fetch(staffPut({ employees: [rosterEmployee()], baseRev: 0 }, 'test'), env)
  assert.equal(created.status, 201)

  const stale = await handler.fetch(staffPut({ employees: [], baseRev: 0 }, 'test'), env)
  assert.equal(stale.status, 409)
  assert.equal(((await stale.json()) as { rev: number }).rev, 1)

  const badBody = await handler.fetch(staffPut({ employees: [{ id: 'Bad Id!' }], baseRev: 1 }, 'test'), env)
  assert.equal(badBody.status, 400)
})

test('staff password falls back to the hardcoded demo value and locked stations are refused', async () => {
  const noPassword = mockEnv('manager-token')
  // The manager token still authorizes.
  const saved = await handler.fetch(staffPut({ employees: [rosterEmployee()], baseRev: 0 }, 'manager-token'), noPassword)
  assert.equal(saved.status, 201)
  // With no env password, the hardcoded default "test" unlocks and writes.
  assert.equal((await handler.fetch(staffVerify('test'), noPassword)).status, 200)
  assert.equal((await handler.fetch(staffPut({ employees: [rosterEmployee()], baseRev: 1 }, 'test'), noPassword)).status, 200)
  assert.equal((await handler.fetch(staffVerify('anything'), noPassword)).status, 401)

  const env = mockEnv('manager-token', 'test')
  assert.equal((await handler.fetch(staffGet('CR2-kitchen'), env)).status, 403)
  const locked = await handler.fetch(staffPut({ employees: [rosterEmployee()], baseRev: 0 }, 'test', 'CR2-kitchen'), env)
  assert.equal(locked.status, 403)
  assert.equal(((await locked.json()) as { error: string }).error, 'staff_editing_not_enabled')

  // An explicit env password overrides the hardcoded default.
  const custom = mockEnv('manager-token', 'hunter2')
  assert.equal((await handler.fetch(staffVerify('hunter2'), custom)).status, 200)
  assert.equal((await handler.fetch(staffVerify('test'), custom)).status, 401)
})

const cashier = { name: 'Alice', counts: [5, 2, 0, 1, 0, 2, 0, 2, 0, 0, 0], toast: '520' }
const cashoutBody = {
  sheet: { am: [cashier], pm: [], zReport: '' },
  totals: { amDeposit: 51250, pmDeposit: 0, amOverShort: -750, pmOverShort: 0, deposit: 51250, overShort: -750, zOverShort: null },
}

function authed(method: string, path: string, body?: unknown, token = 'manager-token'): Request {
  return new Request(`https://api.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

test('cash-out days need the manager token to read or write', async () => {
  const env = mockEnv()
  assert.equal((await handler.fetch(request('GET', '/api/cashout/CR3/2026-10-10'), env)).status, 401)
  assert.equal((await handler.fetch(authed('PUT', '/api/cashout/CR3/2026-10-10', cashoutBody, 'wrong'), env)).status, 401)
  assert.equal((await handler.fetch(request('GET', '/api/cashout/CR3?to=2026-10-10'), env)).status, 401)
})

test('cash-out day saves, loads, and shows in the 30-day history', async () => {
  const env = mockEnv()
  assert.equal((await handler.fetch(authed('GET', '/api/cashout/CR3/2026-10-10'), env)).status, 404)
  assert.equal((await handler.fetch(authed('PUT', '/api/cashout/CR3/2026-10-10', cashoutBody), env)).status, 200)
  assert.equal((await handler.fetch(authed('PUT', '/api/cashout/CR3/2026-09-10', cashoutBody), env)).status, 200)

  const day = await (await handler.fetch(authed('GET', '/api/cashout/CR3/2026-10-10'), env)).json()
  assert.deepEqual(day.sheet, cashoutBody.sheet)
  assert.equal(day.totals.amDeposit, 51250)

  const history = await (await handler.fetch(authed('GET', '/api/cashout/CR3?to=2026-10-10'), env)).json()
  // 2026-09-10 is 30 days back, one past the window.
  assert.deepEqual(history.days.map((d: { date: string }) => d.date), ['2026-10-10'])
  const other = await (await handler.fetch(authed('GET', '/api/cashout/CR2?to=2026-10-10'), env)).json()
  assert.deepEqual(other.days, [])
})

test('cash-out bodies are strictly validated', () => {
  assert.ok(validateCashoutBody(cashoutBody))
  const bad = (patch: (b: typeof cashoutBody) => unknown) => validateCashoutBody(patch(structuredClone(cashoutBody)))
  assert.equal(bad((b) => ({ ...b, sheet: { ...b.sheet, am: [{ ...cashier, counts: [1, 2] }] } })), null)
  assert.equal(bad((b) => ({ ...b, sheet: { ...b.sheet, am: [{ ...cashier, counts: cashier.counts.map(() => -1) }] } })), null)
  assert.equal(bad((b) => ({ ...b, sheet: { ...b.sheet, am: [{ ...cashier, counts: cashier.counts.map(() => 1.5) }] } })), null)
  assert.equal(bad((b) => ({ ...b, sheet: { ...b.sheet, am: [{ ...cashier, counts: cashier.counts.map(() => null) }] } })), null)
  assert.equal(bad((b) => ({ ...b, sheet: { ...b.sheet, am: [{ ...cashier, counts: cashier.counts.map(() => 100001) }] } })), null)
  assert.equal(bad((b) => ({ ...b, sheet: { ...b.sheet, zReport: '1e9' } })), null)
  assert.equal(bad((b) => ({ ...b, sheet: { ...b.sheet, zReport: '1.005' } })), null)
  assert.equal(bad((b) => ({ ...b, sheet: { ...b.sheet, pm: Array(21).fill(cashier) } })), null)
  assert.equal(bad(() => ({})), null)
})

test('cash-out totals are recalculated on the server, ignoring what the client sent', () => {
  const expected = { amDeposit: 51250, pmDeposit: 0, amOverShort: -750, pmOverShort: 0, deposit: 51250, overShort: -750, zOverShort: null }
  // Older pages always send totals; tampered, malformed or missing totals all give the same stored result.
  for (const totals of [cashoutBody.totals, { ...cashoutBody.totals, deposit: 99999999, overShort: 0 }, { deposit: 1.5 }, 'x', undefined]) {
    assert.deepEqual(validateCashoutBody({ ...cashoutBody, totals })?.totals, expected)
  }
})

test('cash-out PUT stores server totals even when the client tampers', async () => {
  const env = mockEnv()
  const tampered = { ...cashoutBody, totals: { ...cashoutBody.totals, deposit: 1, amDeposit: 1, overShort: 0 } }
  assert.equal((await handler.fetch(authed('PUT', '/api/cashout/CR3/2026-10-10', tampered), env)).status, 200)
  const day = await (await handler.fetch(authed('GET', '/api/cashout/CR3/2026-10-10'), env)).json()
  assert.equal(day.totals.deposit, 51250)
  assert.equal(day.totals.overShort, -750)
})

test('server cash-out totals match the browser on the DEC-02 notebook examples', () => {
  const drawer = (cents: number) => {
    const counts = DENOMINATIONS.map(() => 0)
    for (const [i, d] of DENOMINATIONS.entries()) { counts[i] = Math.floor(cents / d); cents %= d }
    return counts
  }
  const c = (drawerCents: number, toast: string) => ({ name: 'X', counts: drawer(drawerCents), toast })
  const sheets = [
    { am: [c(30000, '200')], pm: [], zReport: '' }, // balanced
    { am: [c(30000, '199.75')], pm: [], zReport: '' }, // over $0.25
    { am: [c(30000, '205')], pm: [], zReport: '' }, // short $5
    { am: [c(10000, '0')], pm: [], zReport: '' }, // float only, explicit zero Toast
    { am: [c(30000, '')], pm: [], zReport: '' }, // Toast blank -> null
    { am: [c(30000, '0')], pm: [], zReport: '0' }, // explicit zero Toast and Z
    { am: [c(30000, '199.75')], pm: [c(10000, '0')], zReport: '200' }, // day example
    { am: [c(30000, '199.75')], pm: [c(10000, '0')], zReport: '' }, // blank Z -> null
    { am: [c(30000, '200'), c(30000, '200')], pm: [], zReport: '400' }, // $100 kept per drawer
    { am: [c(5000, '')], pm: [], zReport: '' }, // under-float drawer goes negative
    { am: [c(12345, '0.29'), c(6789, '-1.15')], pm: [c(100, '.5'), c(0, '-')], zReport: '0.1' }, // rounding edges
    { am: [], pm: [], zReport: '' },
  ]
  for (const sheet of sheets) {
    assert.deepEqual(cashoutTotals(sheet), dayTotals(sheet.am, sheet.pm, sheet.zReport), JSON.stringify(sheet))
  }
  assert.deepEqual(cashoutTotals(sheets[6]), {
    amDeposit: 20000, pmDeposit: 0, amOverShort: 25, pmOverShort: 0, deposit: 20000, overShort: 25, zOverShort: 0,
  })
  assert.equal(cashoutTotals(sheets[4]).amOverShort, null)
  assert.equal(cashoutTotals(sheets[5]).amOverShort, 20000)
  assert.equal(cashoutTotals(sheets[7]).zOverShort, null)
  assert.equal(cashoutTotals(sheets[8]).deposit, 40000)
  assert.equal(cashoutTotals(sheets[9]).amDeposit, -5000)
})

test('cash-out history spans 30 days, newest first, across a month edge', () => {
  const dates = cashoutHistoryDates('2026-03-01')
  assert.equal(dates.length, 30)
  assert.equal(dates[0], '2026-03-01')
  assert.equal(dates[1], '2026-02-28')
  assert.equal(dates.at(-1), '2026-01-31')
})

const inventoryBody = { counts: { rice: { inv: '11', order: '4' }, 'chicken-breast': { inv: '3B/2T', order: '' }, pork: { inv: '✓', order: '' } } }

test('inventory counts need the manager token', async () => {
  const env = mockEnv()
  assert.equal((await handler.fetch(request('GET', '/api/inventory/CR3?to=2026-10-08'), env)).status, 401)
  assert.equal((await handler.fetch(authed('PUT', '/api/inventory/CR3/2026-10-08', inventoryBody, 'wrong'), env)).status, 401)
  assert.equal((await handler.fetch(authed('PUT', '/api/inventory/CR2/2026-10-08', inventoryBody), env)).status, 404)
})

test('inventory days save and come back in the 14-day history, newest first', async () => {
  const env = mockEnv()
  for (const date of ['2026-10-01', '2026-10-04', '2026-10-08', '2026-09-24']) {
    assert.equal((await handler.fetch(authed('PUT', `/api/inventory/CR3/${date}`, inventoryBody), env)).status, 200)
  }
  const history = await (await handler.fetch(authed('GET', '/api/inventory/CR3?to=2026-10-08'), env)).json()
  // 2026-09-24 is 14 days back, one past the window.
  assert.deepEqual(history.days.map((d: { date: string }) => d.date), ['2026-10-08', '2026-10-04', '2026-10-01'])
  assert.deepEqual(history.days[0].counts, inventoryBody.counts)
  assert.equal((await handler.fetch(authed('GET', '/api/inventory/CR3?to=soon'), env)).status, 400)
  assert.equal((await handler.fetch(authed('PUT', '/api/inventory/CR3/2026-10-08', { counts: { rice: { inv: '<b>', order: '' } } }), env)).status, 400)
})

test('inventory bodies are strictly validated', () => {
  assert.ok(validateInventoryBody(inventoryBody))
  assert.ok(validateInventoryBody({ counts: {} }))
  assert.equal(validateInventoryBody({ counts: [] }), null)
  assert.equal(validateInventoryBody({ counts: { Rice: { inv: '1', order: '' } } }), null)
  assert.equal(validateInventoryBody({ counts: { rice: { inv: 1, order: '' } } }), null)
  assert.equal(validateInventoryBody({ counts: { rice: { inv: '1234567890123', order: '' } } }), null)
  assert.equal(validateInventoryBody({ counts: { rice: null } }), null)
  assert.deepEqual(validateInventoryBody({ counts: { rice: { inv: '1', order: '4', done: true }, egg: { inv: '', order: '', done: false } } }), { counts: { rice: { inv: '1', order: '4', done: true }, egg: { inv: '', order: '' } } })
  assert.equal(validateInventoryBody({ counts: { rice: { inv: '1', order: '4', done: 'yes' } } }), null)
  const many = Object.fromEntries(Array.from({ length: 301 }, (_, i) => [`item-${i}`, { inv: '', order: '' }]))
  assert.equal(validateInventoryBody({ counts: many }), null)
})

const listSheet = { id: 'cooler', useLabel: 'Use', showSup: true, items: [{ id: 'egg', name: 'Egg', sup: 'D/L', use: '5', gray: true }] }
const pepsiSheet = { id: 'pepsi', title: 'PEPSI PRODCUTS', account: '3923058', useLabel: 'UNOPEN BOX', showSup: false, items: [{ id: 'pepsi', name: 'PEPSI', sup: 'Pepsi', use: '6', gray: false }] }

test('the inventory item list needs the manager token and starts empty', async () => {
  const env = mockEnv()
  assert.equal((await handler.fetch(request('GET', '/api/inventory/CR3/list'), env)).status, 401)
  assert.equal((await handler.fetch(authed('PUT', '/api/inventory/CR3/list', { sheets: [listSheet], baseRev: 0 }, 'wrong'), env)).status, 401)
  const empty = await (await handler.fetch(authed('GET', '/api/inventory/CR3/list'), env)).json()
  assert.deepEqual([empty.rev, empty.sheets], [0, null])
})

test('inventory item list saves with a rev and rejects stale writes', async () => {
  const env = mockEnv()
  const save = (baseRev: number, sheets: unknown[] = [listSheet, pepsiSheet]) =>
    handler.fetch(authed('PUT', '/api/inventory/CR3/list', { sheets, baseRev }), env)
  const first = await save(0)
  assert.equal(first.status, 200)
  assert.equal((await first.json()).rev, 1)
  const stale = await save(0)
  assert.equal(stale.status, 409)
  assert.equal((await stale.json()).rev, 1)
  assert.equal((await save(1)).status, 200)
  const saved = await (await handler.fetch(authed('GET', '/api/inventory/CR3/list'), env)).json()
  assert.equal(saved.rev, 2)
  assert.deepEqual(saved.sheets, [listSheet, pepsiSheet])
  // A count day still saves alongside the list.
  assert.equal((await handler.fetch(authed('PUT', '/api/inventory/CR3/2026-10-15', inventoryBody), env)).status, 200)
})

test('inventory item lists are strictly validated', () => {
  const ok = { sheets: [listSheet, pepsiSheet], baseRev: 0 }
  assert.ok(validateInventoryListBody(ok))
  const withItem = (patch: object) => ({ sheets: [{ ...listSheet, items: [{ ...listSheet.items[0], ...patch }] }], baseRev: 0 })
  assert.equal(validateInventoryListBody({ ...ok, baseRev: -1 }), null)
  assert.equal(validateInventoryListBody({ sheets: [], baseRev: 0 }), null)
  assert.equal(validateInventoryListBody(withItem({ name: '   ' })), null)
  assert.equal(validateInventoryListBody(withItem({ id: 'Bad Id' })), null)
  assert.equal(validateInventoryListBody(withItem({ use: '✓' })), null)
  assert.equal(validateInventoryListBody(withItem({ gray: 'yes' })), null)
  assert.equal(validateInventoryListBody(withItem({ extra: '<script>' }))?.sheets[0].items[0].hasOwnProperty('extra'), false)
  // Ids are unique across sheets, since counts are keyed by item id alone.
  assert.equal(validateInventoryListBody({ sheets: [listSheet, { ...pepsiSheet, items: listSheet.items }], baseRev: 0 }), null)
  const many = Array.from({ length: 301 }, (_, i) => ({ ...listSheet.items[0], id: `item-${i}` }))
  assert.equal(validateInventoryListBody({ sheets: [{ ...listSheet, items: many }], baseRev: 0 }), null)
})

const writeUp = {
  date: '2026-10-09',
  employee: 'Alice Smith',
  manager: 'Bob',
  violations: ['attendance', 'others'],
  otherSpecify: 'Phone on line',
  actions: ['verbal'],
  incident: 'Late three times this week.',
  incidentCont: '',
  expected: 'Arrive on time.',
  employeeComments: '',
  employeeSignature: '',
  employeeSignedDate: '',
  managerSignature: 'Bob',
  managerSignedDate: '2026-10-09',
}

test('write-ups need the manager token to read or write', async () => {
  const env = mockEnv()
  assert.equal((await handler.fetch(request('GET', '/api/writeups'), env)).status, 401)
  assert.equal((await handler.fetch(authed('POST', '/api/writeups', writeUp, 'wrong'), env)).status, 401)
  assert.equal((await handler.fetch(request('GET', '/api/writeups/abcdefghij'), env)).status, 401)
  assert.equal((await handler.fetch(request('PUT', '/api/writeups/abcdefghij/label', { label: 'x' }), env)).status, 401)
})

test('write-ups save, list newest first, and only the label can change', async () => {
  const env = mockEnv()
  const save = async (form: object) => {
    const res = await handler.fetch(authed('POST', '/api/writeups', form), env)
    assert.equal(res.status, 201)
    return ((await res.json()) as { id: string }).id
  }
  const alice = await save(writeUp)
  await save({ ...writeUp, employee: 'Carl', date: '2026-10-09' })
  await save({ ...writeUp, employee: 'Dana', date: '2026-10-10' })

  const list = (await (await handler.fetch(authed('GET', '/api/writeups'), env)).json()) as { writeUps: { employee: string }[] }
  assert.deepEqual(list.writeUps.map((w) => w.employee), ['Dana', 'Alice Smith', 'Carl'])

  const labeled = await handler.fetch(authed('PUT', `/api/writeups/${alice}/label`, { label: '  Final warning  ' }), env)
  assert.equal(labeled.status, 200)
  const doc = (await (await handler.fetch(authed('GET', `/api/writeups/${alice}`), env)).json()) as {
    form: typeof writeUp
    label: string
  }
  assert.equal(doc.label, 'Final warning')
  assert.deepEqual(doc.form, writeUp)
  const listed = (await (await handler.fetch(authed('GET', '/api/writeups'), env)).json()) as { writeUps: { label: string }[] }
  assert.equal(listed.writeUps[1].label, 'Final warning')

  // The form itself has no update route.
  assert.equal((await handler.fetch(authed('PUT', `/api/writeups/${alice}`, writeUp), env)).status, 404)
  assert.equal((await handler.fetch(authed('PUT', '/api/writeups/missing123/label', { label: 'x' }), env)).status, 404)
  assert.equal((await handler.fetch(authed('PUT', `/api/writeups/${alice}/label`, { label: 'x'.repeat(121) }), env)).status, 400)
})

test('write-up forms are strictly validated', () => {
  assert.ok(validateWriteUpForm(writeUp))
  const bad = (patch: object) => validateWriteUpForm({ ...writeUp, ...patch })
  assert.equal(bad({ employee: '   ' }), null)
  assert.equal(bad({ date: '10/09/2026' }), null)
  assert.equal(bad({ violations: ['stealing'] }), null)
  assert.equal(bad({ actions: ['verbal', 'verbal'] }), null)
  assert.equal(bad({ incident: 'x'.repeat(3001) }), null)
  assert.equal(bad({ managerSignedDate: 'yesterday' }), null)
  assert.equal(bad({ manager: undefined }), null)
  assert.equal((validateWriteUpForm({ ...writeUp, extra: 'dropped' }) as Record<string, unknown>).extra, undefined)
})
