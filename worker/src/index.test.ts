import assert from 'node:assert/strict'
import test from 'node:test'
import handler, { isValidId, newShareId, validatePublishBody, validateUpdateBody } from './index'

function mockEnv() {
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
