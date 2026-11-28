import test from 'node:test'
import assert from 'node:assert/strict'
import { managerSession, SessionChangedError } from './internal-tools/manager-session'
import { fetchRoster, saveRoster } from './employee-store'
import { fetchStaff, saveStaff, undoStaff, verifyStaffPassword } from './staff-store'
import { fetchTemplate, saveTemplate } from './template-store'
import { fetchGoldenWeek, saveGoldenWeek, StoreAuthError, StoreUnavailableError, verifyWriteToken } from './schedule-store'
import { seedTemplate, expandTemplate } from './scheduler/data'
import { buildScheduleSnapshot } from './schedule-snapshot'

// Fetch stubs expose only the response status/body boundary under test, including held or interrupted bodies.
const token = 'synthetic-manager'
const station = 'CR3-diningroom'
const weekStart = '2026-11-22'
const week = { version: 1, weekStart, name: 'Synthetic week', people: [], slotPeople: [] }
const golden = { week, templateHash: 'fixture', visible: true, baseRev: 0 }
const roster = { employees: [], rev: 3, updatedAt: '2026-11-22T12:00:00.000Z' }
function response(status: number, body: unknown): Response {
  return { status, json: async () => body } as Response
}
function defer<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function openSession() {
  managerSession.active = true
  managerSession.expire()
  managerSession.unlock(token)
}
function renewSession() { managerSession.expire(); managerSession.unlock(token) }
async function withSession(run: () => Promise<void>) {
  const original = globalThis.fetch
  openSession()
  try { await run() } finally {
    globalThis.fetch = original
    managerSession.active = false
    managerSession.expire()
  }
}

test('legacy manager acknowledgements retain their wire contract in the shared session', async () => {
  await withSession(async () => {
    const writes: { url: string; init?: RequestInit }[] = []
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      writes.push({ url: String(url), init })
      return response(200, roster)
    }) as unknown as typeof fetch
    assert.equal((await fetchRoster(token, station, weekStart)).rev, 3)
    assert.equal((await fetchStaff(token, station)).rev, 3)
    assert.equal((await saveRoster([], 2, token, station, weekStart)).rev, 3)
    assert.equal((await saveGoldenWeek(weekStart, golden, token, station)).rev, 3)
    assert.equal(managerSession.getSnapshot().token, token)
    assert.ok(writes.every(write => new Headers(write.init?.headers).get('Authorization') === `Bearer ${token}`))
    assert.ok(writes.every(write => write.init?.cache === 'no-store'))
    assert.deepEqual(JSON.parse(String(writes[2].init?.body)), { employees: [], baseRev: 2 })
    assert.deepEqual(JSON.parse(String(writes[3].init?.body)), golden)
  })
})

test('a roster body completing after same-code reauthentication cannot acknowledge an old request', async () => {
  await withSession(async () => {
    const body = defer<unknown>(), started = defer<void>()
    globalThis.fetch = (async () => ({ status: 200, json: () => { started.resolve(); return body.promise } })) as unknown as typeof fetch
    const pending = fetchRoster(token, station, weekStart)
    await started.promise
    renewSession()
    body.resolve(roster)
    await assert.rejects(pending, SessionChangedError)
    assert.equal(managerSession.getSnapshot().token, token)
  })
})

test('late manager 401 responses cannot revoke a newer unlock using the same code', async () => {
  await withSession(async () => {
    const body = defer<unknown>(), started = defer<void>()
    globalThis.fetch = (async () => ({ status: 401, json: () => { started.resolve(); return body.promise } })) as unknown as typeof fetch
    const pending = saveRoster([], 0, token, station, weekStart)
    await started.promise
    renewSession()
    body.resolve({ error: 'unauthorized' })
    await assert.rejects(pending, SessionChangedError)
    assert.equal(managerSession.getSnapshot().token, token)
  })
})

test('current manager 401 and 403 expire access; public denial does not', async () => {
  await withSession(async () => {
    for (const status of [401, 403]) {
      openSession()
      globalThis.fetch = (async () => response(status, {})) as unknown as typeof fetch
      await assert.rejects(fetchRoster(token, station), StoreAuthError)
      assert.equal(managerSession.getSnapshot().token, '')
    }
    openSession()
    globalThis.fetch = (async () => response(403, {})) as unknown as typeof fetch
    await assert.rejects(fetchTemplate(station), StoreUnavailableError)
    assert.equal(managerSession.getSnapshot().token, token)
  })
})

test('staff-password checks and writes never consume the separate manager privilege', async () => {
  await withSession(async () => {
    const generation = managerSession.getSnapshot().generation
    globalThis.fetch = (async (url: unknown) => String(url).endsWith('/api/health')
      ? response(200, { scheduleSnapshotVersion: 1 }) : response(401, {})) as unknown as typeof fetch
    await assert.rejects(verifyStaffPassword('wrong-staff-password', 'CR3-kitchen'), StoreAuthError)
    await assert.rejects(saveStaff([], 0, 'wrong-staff-password', 'CR3-kitchen'), StoreAuthError)
    await assert.rejects(undoStaff(1, 'wrong-staff-password', 'CR3-kitchen'), StoreAuthError)
    await assert.rejects(saveTemplate(seedTemplate, 0, 'wrong-staff-password', 'CR3-kitchen', weekStart, 'staff'), StoreAuthError)
    assert.equal(managerSession.getSnapshot().generation, generation)
    assert.equal(managerSession.getSnapshot().token, token)
  })
})

test('staff acknowledgements also belong to the manager visit that issued them', async () => {
  await withSession(async () => {
    const body = defer<unknown>(), started = defer<void>()
    globalThis.fetch = (async () => ({ status: 200, json: () => { started.resolve(); return body.promise } })) as unknown as typeof fetch
    const pending = saveStaff([], 1, 'synthetic-staff-password', 'CR3-kitchen')
    await started.promise
    renewSession()
    body.resolve({ ...roster, canUndo: true })
    await assert.rejects(pending, SessionChangedError)
    assert.equal(managerSession.getSnapshot().token, token)
  })
})

test('a session change during capability discovery prevents dependent template and schedule writes', async () => {
  await withSession(async () => {
    const snapshot = buildScheduleSnapshot(expandTemplate(seedTemplate, weekStart))
    const operations = [
      () => saveTemplate(seedTemplate, 0, token, station, weekStart),
      () => saveGoldenWeek(weekStart, { ...golden, snapshot }, token, station),
    ]
    for (const operation of operations) {
      const body = defer<unknown>(), started = defer<void>()
      const methods: string[] = []
      globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
        methods.push(init?.method ?? 'GET')
        return { status: 200, json: () => { started.resolve(); return body.promise } }
      }) as unknown as typeof fetch
      const pending = operation()
      await started.promise
      renewSession()
      body.resolve({ scheduleSnapshotVersion: 1 })
      await assert.rejects(pending, SessionChangedError)
      assert.deepEqual(methods, ['GET'])
    }
  })
})

test('gate verification works while locked but cannot finish in a replacement visit', async () => {
  await withSession(async () => {
    managerSession.expire()
    globalThis.fetch = (async () => response(200, {})) as unknown as typeof fetch
    await verifyWriteToken(token)
    assert.equal(managerSession.getSnapshot().token, '')
    const body = defer<unknown>(), started = defer<void>()
    globalThis.fetch = (async () => ({ status: 401, json: () => { started.resolve(); return body.promise } })) as unknown as typeof fetch
    const pending = verifyWriteToken('wrong-gate-code')
    await started.promise
    managerSession.unlock(token)
    body.resolve({})
    await assert.rejects(pending, SessionChangedError)
    assert.equal(managerSession.getSnapshot().token, token)
  })
})

test('lost write bodies remain unconfirmed and are never replayed', async () => {
  await withSession(async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      return { status: 200, json: async () => { throw new Error('body interrupted') } }
    }) as unknown as typeof fetch
    await assert.rejects(saveRoster([], 0, token, station, weekStart), StoreUnavailableError)
    assert.equal(calls, 1)
    assert.equal(managerSession.getSnapshot().token, token)
    const body = defer<unknown>(), started = defer<void>()
    globalThis.fetch = (async () => ({ status: 200, json: () => { started.resolve(); return body.promise } })) as unknown as typeof fetch
    const pending = saveGoldenWeek(weekStart, golden, token, station)
    await started.promise
    renewSession()
    body.reject(new Error('body interrupted'))
    await assert.rejects(pending, SessionChangedError)
    assert.equal(managerSession.getSnapshot().token, token)
  })
})

test('public schedule results are discarded when their captured visit changes', async () => {
  await withSession(async () => {
    const body = defer<unknown>(), started = defer<void>()
    globalThis.fetch = (async () => ({ status: 404, json: () => { started.resolve(); return body.promise } })) as unknown as typeof fetch
    const pending = fetchGoldenWeek(weekStart, station)
    await started.promise
    renewSession()
    body.resolve({})
    await assert.rejects(pending, SessionChangedError)
    assert.equal(managerSession.getSnapshot().token, token)
  })
})

test('locked or mismatched manager privileges cannot send private writes', async () => {
  await withSession(async () => {
    let calls = 0
    globalThis.fetch = (async () => { calls++; return response(200, roster) }) as unknown as typeof fetch
    await assert.rejects(saveRoster([], 0, 'old-manager-code', station, weekStart), SessionChangedError)
    managerSession.expire()
    await assert.rejects(saveStaff([], 0, 'previous-staff-password', 'CR3-kitchen'), SessionChangedError)
    await assert.rejects(saveTemplate(seedTemplate, 0, token, station, weekStart), SessionChangedError)
    assert.equal(calls, 0)
  })
})

test('a rejected verification candidate does not revoke existing manager access', async () => {
  await withSession(async () => {
    const generation = managerSession.getSnapshot().generation
    globalThis.fetch = (async () => response(401, {})) as unknown as typeof fetch
    await assert.rejects(verifyWriteToken('wrong-candidate'), StoreAuthError)
    assert.equal(managerSession.getSnapshot().token, token)
    assert.equal(managerSession.getSnapshot().generation, generation)
  })
})

test('transport header normalization does not change the captured manager credential identity', async () => {
  await withSession(async () => {
    const entered = `${token} `
    managerSession.unlock(entered)
    globalThis.fetch = (async () => response(200, roster)) as unknown as typeof fetch
    assert.equal((await fetchRoster(entered, station)).rev, 3)
    assert.equal(managerSession.getSnapshot().token, entered)
  })
})
