import assert from 'node:assert/strict'
import test from 'node:test'
import {
  StoreAuthError,
  StoreConflictError,
  StoreUnavailableError,
  fetchGoldenMonth,
  fetchGoldenWeek,
  saveGoldenWeek,
} from './schedule-store'

function mockFetchOnce(handler: (url: string, init?: RequestInit) => { status: number; payload: unknown }) {
  const original = globalThis.fetch
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const { status, payload } = handler(String(url), init)
    return { status, async json() { return payload } }
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

const goldenWeek = {
  version: 1,
  weekStart: '2026-09-13',
  name: 'Week of Sep 13',
  people: ['Mary'],
  slotPeople: [0],
}

test('fetchGoldenWeek returns null on 404 and the doc on 200', async () => {
  let restore = mockFetchOnce((url) => {
    assert.ok(url.endsWith('/api/schedule/2026-09-13'))
    return { status: 404, payload: { error: 'not_found' } }
  })
  try {
    assert.equal(await fetchGoldenWeek('2026-09-13'), null)
  } finally {
    restore()
  }

  restore = mockFetchOnce(() => ({
    status: 200,
    payload: { v: 3, weekStart: '2026-09-13', rev: 2, week: goldenWeek, visible: true, templateHash: 'a1b2c3d4', updatedAt: 'x' },
  }))
  try {
    const doc = await fetchGoldenWeek('2026-09-13')
    assert.equal(doc?.rev, 2)
    assert.deepEqual(doc?.week.people, ['Mary'])
  } finally {
    restore()
  }
})

test('golden reads map network failure to unavailable', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new Error('down')
  }) as typeof fetch
  try {
    await assert.rejects(() => fetchGoldenWeek('2026-09-13'), StoreUnavailableError)
    await assert.rejects(() => fetchGoldenMonth('2026-09'), StoreUnavailableError)
  } finally {
    globalThis.fetch = original
  }
})

test('fetchGoldenMonth returns weeks and rev on 200 and an empty list for a bad month', async () => {
  let restore = mockFetchOnce((url) => {
    assert.ok(url.includes('/api/schedule?month=2026-09'))
    assert.ok(!url.includes('knownRev'))
    return {
      status: 200,
      payload: {
        weeks: [{ v: 3, weekStart: '2026-09-13', rev: 1, week: goldenWeek, visible: true, templateHash: 'a1b2', updatedAt: 'x' }],
        rev: 3,
        notModified: false,
      },
    }
  })
  try {
    const month = await fetchGoldenMonth('2026-09')
    assert.equal(month.weeks.length, 1)
    assert.equal(month.rev, 3)
    assert.equal(month.notModified, false)
  } finally {
    restore()
  }

  restore = mockFetchOnce(() => ({ status: 400, payload: { error: 'invalid_month' } }))
  try {
    assert.deepEqual(await fetchGoldenMonth('september'), { weeks: [], rev: 0, notModified: false })
  } finally {
    restore()
  }
})

test('fetchGoldenMonth sends knownRev and honors notModified', async () => {
  const restore = mockFetchOnce((url) => {
    assert.ok(url.includes('knownRev=3'))
    return { status: 200, payload: { weeks: [], rev: 3, notModified: true } }
  })
  try {
    assert.deepEqual(await fetchGoldenMonth('2026-09', 3), { weeks: [], rev: 3, notModified: true })
  } finally {
    restore()
  }
})

test('saveGoldenWeek sends the write token and maps 401 to auth', async () => {
  let restore = mockFetchOnce((url, init) => {
    assert.ok(url.endsWith('/api/schedule/2026-09-13'))
    assert.equal(init?.method, 'PUT')
    assert.equal((init?.headers as Record<string, string>)?.Authorization, 'Bearer manager-token')
    return { status: 201, payload: { rev: 1 } }
  })
  try {
    assert.deepEqual(
      await saveGoldenWeek(
        '2026-09-13',
        { week: goldenWeek, templateHash: 'a1b2c3d4', visible: true, baseRev: 0 },
        'manager-token',
      ),
      { rev: 1 },
    )
  } finally {
    restore()
  }

  restore = mockFetchOnce(() => ({ status: 401, payload: { error: 'unauthorized' } }))
  try {
    await assert.rejects(
      () =>
        saveGoldenWeek(
          '2026-09-13',
          { week: goldenWeek, templateHash: 'a1b2c3d4', visible: true, baseRev: 1 },
          'wrong',
        ),
      StoreAuthError,
    )
  } finally {
    restore()
  }
})

test('saveGoldenWeek maps 503 to an unavailable error naming the missing secret', async () => {
  const restore = mockFetchOnce(() => ({ status: 503, payload: { error: 'write_not_configured' } }))
  try {
    const caught = await saveGoldenWeek(
      '2026-09-13',
      { week: goldenWeek, templateHash: 'a1b2c3d4', visible: true, baseRev: 0 },
      'manager-token',
    ).then(
      () => null,
      (error: unknown) => error,
    )
    assert.ok(caught instanceof StoreUnavailableError)
    assert.match((caught as StoreUnavailableError).message, /SCHEDULE_WRITE_TOKEN/)
  } finally {
    restore()
  }
})

test('saveGoldenWeek maps 409 to a conflict carrying the server revision', async () => {
  const restore = mockFetchOnce(() => ({ status: 409, payload: { error: 'conflict', rev: 4 } }))
  try {
    const caught = await saveGoldenWeek(
      '2026-09-13',
      { week: goldenWeek, templateHash: 'a1b2c3d4', visible: true, baseRev: 2 },
      'manager-token',
    ).then(
      () => null,
      (error: unknown) => error,
    )
    assert.ok(caught instanceof StoreConflictError)
    assert.equal((caught as StoreConflictError).rev, 4)
  } finally {
    restore()
  }
})
